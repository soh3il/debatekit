/**
 * DebateKit Chat Store
 *
 * AI SDK owns: messages, status, error, resume.
 * This store tracks DebateKit-specific state:
 *
 * - Phase machine: idle -> presearch -> participants -> moderator -> complete -> idle
 * - Participant tracking: snapshots, counts, completion
 * - Pre-search/changelog: Web research and config changes
 * - Form state: Input, participants, mode, web search
 * - UI state: Screen mode, creating thread, analyzing prompt
 * - Attachments, title animation, tracking/dedup
 */

import type { MessageStatus } from '@debatekit/shared';
import { MessageStatuses, ScreenModes } from '@debatekit/shared';

import type { PendingAttachment } from '@/hooks/utils/attachment-schemas';
import type { FilePreview } from '@/hooks/utils/use-file-preview';
import type { UploadItem } from '@/hooks/utils/use-file-upload';
import type { ParticipantConfig } from '@/lib/schemas';
import { createStore } from '@/lib/store';
import {
  countEnabledParticipants,
} from '@/lib/utils/streaming-helpers';
import type { ApiChangelog, ChatParticipant, ChatThread, StoredPreSearch } from '@/services/api';
import type { PreSearchDataPayload } from '@/services/api/chat/pre-search';

import {
  FORM_DEFAULTS,
  OVERVIEW_RESET,
  STORE_DEFAULTS,
  STREAMING_COMPLETE_RESET,
  THREAD_NAVIGATION_RESET,
} from './store-defaults';
import type { ChatPhase, ChatStore, DomainSourceStatus, ParticipantSnapshotEntry } from './store-schemas';
import { ChatPhases, PLACEHOLDER_MODEL_ID, ROUND_UNINITIALIZED, TitleAnimationPhases } from './store-schemas';

export type ChatStoreApi = ReturnType<typeof createChatStore>;

/**
 * Initial state options for SSR hydration.
 * Messages are now managed by AI SDK -- only thread/participant data is hydrated.
 */
export type ChatStoreInitialState = {
  participants?: ChatParticipant[];
  thread?: ChatThread | null;
  preSearches?: StoredPreSearch[];
  changelogItems?: ApiChangelog[];
  hasInitiallyLoaded?: boolean;
};

/**
 * Enrich placeholder snapshot entries with real participant data.
 * Returns a new Map if any placeholders were replaced, or the original if unchanged.
 */
function enrichPlaceholderSnapshots(
  snapshotMap: Map<number, ParticipantSnapshotEntry[]>,
  enabledParticipants: ChatParticipant[],
): Map<number, ParticipantSnapshotEntry[]> | null {
  let changed = false;
  const newMap = new Map(snapshotMap);
  for (const [roundNum, snapshot] of newMap) {
    const hasPlaceholders = snapshot.some(
      entry => entry.modelId === PLACEHOLDER_MODEL_ID,
    );
    if (hasPlaceholders) {
      const enriched: ParticipantSnapshotEntry[] = snapshot.map((entry, idx) => {
        if (entry.modelId !== PLACEHOLDER_MODEL_ID) {
          return entry;
        }
        const realParticipant = enabledParticipants[idx];
        if (realParticipant) {
          return { modelId: realParticipant.modelId, role: realParticipant.role ?? null };
        }
        return entry;
      });
      newMap.set(roundNum, enriched);
      changed = true;
    }
  }
  return changed ? newMap : null;
}

/**
 * Create chat store with frame-based flow tracking.
 *
 * @param initialState - Optional initial state for SSR hydration.
 *   When provided, the store is created with data already populated,
 *   preventing the flash that occurs when hydrating an empty store.
 */
export function createChatStore(initialState?: ChatStoreInitialState) {
  // Compute initial values from provided state
  const initialParticipants = initialState?.participants ?? [];
  const initialThread = initialState?.thread ?? null;
  const initialPreSearches = initialState?.preSearches ?? [];
  const initialChangelogItems = initialState?.changelogItems ?? [];
  const initialHasLoaded = initialState?.hasInitiallyLoaded ?? false;

  return createStore<ChatStore>((set, get) => ({
    ...STORE_DEFAULTS,
    // Apply initial state overrides for SSR
    ...(initialState
      ? {
          changelogItems: initialChangelogItems,
          hasInitiallyLoaded: initialHasLoaded,
          participants: initialParticipants,
          phase: ChatPhases.IDLE,
          preSearches: initialPreSearches,
          screenMode: initialThread ? ScreenModes.THREAD : STORE_DEFAULTS.screenMode,
          showInitialUI: !initialThread,
          thread: initialThread,
        }
      : {}),

    // ============================================================
    // PHASE TRANSITIONS - Core Flow Machine
    // ============================================================

    addAttachments: (attachments: PendingAttachment[]) => {
      set(state => ({
        pendingAttachments: [...state.pendingAttachments, ...attachments],
      }), false, 'attachments/addAttachments');
    },

    /**
     * ADD CHANGELOG - Frame 8/9
     */
    addChangelogItems: (items: ApiChangelog[]) => {
      const existing = get().changelogItems;
      const ids = new Set(existing.map(i => i.id));
      const newItems = items.filter(i => !ids.has(i.id));
      if (newItems.length > 0) {
        set({ changelogItems: [...existing, ...newItems] }, false, 'changelog/addChangelogItems');
      }
    },

    addParticipant: (participant: ParticipantConfig) => {
      set((state) => {
        if (state.selectedParticipants.some(p => p.modelId === participant.modelId)) {
          return {};
        }
        return {
          selectedParticipants: [...state.selectedParticipants, { ...participant, priority: state.selectedParticipants.length }],
        };
      }, false, 'form/addParticipant');
    },

    /**
     * ADD PRE-SEARCH - Frame 10
     */
    addPreSearch: (preSearch: StoredPreSearch) => {
      set((state) => {
        const existingIdx = state.preSearches.findIndex(
          ps => ps.threadId === preSearch.threadId && ps.roundNumber === preSearch.roundNumber,
        );
        if (existingIdx === -1) {
          return { preSearches: [...state.preSearches, preSearch] };
        }
        if (state.preSearches[existingIdx]?.status === MessageStatuses.FAILED) {
          // Allow retry: replace failed entry with new one
          return { preSearches: state.preSearches.map((ps, i) => i === existingIdx ? preSearch : ps) };
        }
        return {};
      }, false, 'preSearch/addPreSearch');
    },

    clearAllPreSearches: () => set({ preSearches: [] }, false, 'preSearch/clearAllPreSearches'),

    clearAllPreSearchTracking: () => {
      set({
        preSearchActivityTimes: new Map<number, number>(),
        triggeredPreSearchRounds: new Set<number>(),
      }, false, 'preSearch/clearAllPreSearchTracking');
    },
    clearAttachments: () => set({ pendingAttachments: [] }, false, 'attachments/clearAttachments'),
    clearModeratorTracking: () => {
      set({
        triggeredModeratorIds: new Set<string>(),
        triggeredModeratorRounds: new Set<number>(),
      }, false, 'tracking/clearModeratorTracking');
    },
    clearPreSearchActivity: (roundNumber: number) => {
      set(state => ({
        preSearchActivityTimes: new Map([...state.preSearchActivityTimes].filter(([k]) => k !== roundNumber)),
      }), false, 'preSearch/clearPreSearchActivity');
    },
    clearPreSearchTracking: (roundNumber: number) => {
      set(state => ({
        preSearchActivityTimes: new Map([...state.preSearchActivityTimes].filter(([k]) => k !== roundNumber)),
        triggeredPreSearchRounds: new Set([...state.triggeredPreSearchRounds].filter(r => r !== roundNumber)),
      }), false, 'preSearch/clearPreSearchTracking');
    },
    completeRegeneration: () => {
      set({
        isRegenerating: false,
        regeneratingRoundNumber: null,
      }, false, 'operations/completeRegeneration');
    },

    /**
     * COMPLETE STREAMING - Phase transition only.
     * AI SDK manages message cleanup.
     */
    completeStreaming: () => {
      const state = get();

      // GUARD: Only complete from PRESEARCH, PARTICIPANTS, or MODERATOR phase.
      if (state.phase !== ChatPhases.PRESEARCH && state.phase !== ChatPhases.PARTICIPANTS && state.phase !== ChatPhases.MODERATOR) {
        return;
      }

      // GUARD: Prevent zombie completion after navigation reset.
      if (!state.thread) {
        return;
      }

      // BUG C3 FIX: Reject zombie callbacks from a previous thread.
      // During thread-to-thread navigation, partial init sets the NEW thread
      // while phase is still active from the old stream. streamingThreadId
      // captures which thread started the round.
      if (state.streamingThreadId && state.thread.id !== state.streamingThreadId) {
        return;
      }

      set(state => ({
        ...STREAMING_COMPLETE_RESET,
        pendingMessage: null,
        phase: ChatPhases.COMPLETE,
        preSearches: state.preSearches.map(ps =>
          (ps.status === MessageStatuses.STREAMING || ps.status === MessageStatuses.PENDING)
            ? { ...ps, status: MessageStatuses.COMPLETE }
            : ps,
        ),
        streamingThreadId: null,
      }), false, 'operations/completeStreaming');
    },

    completeTitleAnimation: () => {
      set({
        animatingThreadId: null,
        animationPhase: TitleAnimationPhases.IDLE,
        displayedTitle: null,
        newTitle: null,
        oldTitle: null,
      }, false, 'titleAnimation/complete');
    },

    enrichParticipantSnapshot: (roundNumber, participantIndex, modelId) => {
      const snapshots = get().participantSnapshotsByRound;
      const roundSnapshot = snapshots.get(roundNumber);
      if (!roundSnapshot || participantIndex >= roundSnapshot.length) {
        return;
      }
      const entry = roundSnapshot[participantIndex];
      // Only enrich placeholder entries — don't overwrite real data
      if (entry && entry.modelId === PLACEHOLDER_MODEL_ID) {
        const updated = [...roundSnapshot];
        updated[participantIndex] = { modelId, role: entry.role };
        set(s => ({
          participantSnapshotsByRound: new Map([...s.participantSnapshotsByRound, [roundNumber, updated]]),
        }), false, 'resume/enrichSnapshot');
      }
    },
    getAttachments: () => get().pendingAttachments,
    hasModeratorStreamBeenTriggered: (moderatorId: string, roundNumber: number) => {
      const state = get();
      return state.triggeredModeratorIds.has(moderatorId) || state.triggeredModeratorRounds.has(roundNumber);
    },

    hasPreSearchBeenTriggered: (roundNumber: number) => get().triggeredPreSearchRounds.has(roundNumber),

    /** Increment completed participant counter (counts both complete and error as done) */
    incrementCompletedParticipants: () => {
      set(state => ({
        completedParticipantCount: state.completedParticipantCount + 1,
      }), false, 'streaming/incrementCompletedParticipants');
    },

    /**
     * INITIALIZE THREAD
     * Sets up thread state. AI SDK manages messages.
     */
    initializeThread: (thread: ChatThread, participants: ChatParticipant[]) => {
      const currentState = get();

      // GUARD: Skip full re-init if already initialized with same thread and loaded.
      // FIX P3: Still allow participant data refresh — during overview→thread navigation,
      // handleCreateThread calls initializeThread first (setting hasInitiallyLoaded=true),
      // then the route loader calls it again with fresh participants from DB (sorted by
      // priority). Without refreshing, the participant snapshot in startRound() could use
      // stale ordering, causing the wrong model to speak first.
      if (currentState.thread?.id === thread.id && currentState.hasInitiallyLoaded) {
        if (participants.length > 0) {
          set({ participants }, false, 'operations/initializeThread-refresh-participants');

          // ISSUE-04 FIX: Enrich placeholder snapshots with real participant data.
          const enabledParticipants = participants.filter(p => p.isEnabled);
          if (enabledParticipants.length > 0) {
            const enriched = enrichPlaceholderSnapshots(get().participantSnapshotsByRound, enabledParticipants);
            if (enriched) {
              set({ participantSnapshotsByRound: enriched }, false, 'operations/initializeThread-enrich-snapshots');
            }
          }
        }
        return;
      }

      // Check for active streaming phases
      const isInActivePhase = currentState.phase === ChatPhases.PRESEARCH
        || currentState.phase === ChatPhases.PARTICIPANTS
        || currentState.phase === ChatPhases.MODERATOR;

      // During active streaming, do partial init -- set thread/participants/screenMode
      const needsPartialInit = isInActivePhase
        && currentState.thread?.id !== thread.id;

      if (needsPartialInit) {
        set({
          hasInitiallyLoaded: true,
          participants,
          screenMode: ScreenModes.THREAD,
          showInitialUI: false,
          thread,
        }, false, 'operations/initializeThread-partial');

        // ISSUE-04 FIX: Enrich placeholder snapshots during partial init.
        const enabledParticipants = participants.filter(p => p.isEnabled);
        if (enabledParticipants.length > 0) {
          const enriched = enrichPlaceholderSnapshots(get().participantSnapshotsByRound, enabledParticipants);
          if (enriched) {
            set({ participantSnapshotsByRound: enriched }, false, 'operations/initializeThread-enrich-snapshots-partial');
          }
        }

        return;
      }

      // Full block only if same thread and already has data
      if (isInActivePhase && currentState.thread?.id === thread.id) {
        if (currentState.participants.length === 0 && participants.length > 0) {
          set({ participants }, false, 'operations/initializeThread-participants-during-active-phase');

          // ISSUE-04 FIX: Enrich placeholder snapshots during active phase hydration.
          const enabledParticipants = participants.filter(p => p.isEnabled);
          if (enabledParticipants.length > 0) {
            const enriched = enrichPlaceholderSnapshots(get().participantSnapshotsByRound, enabledParticipants);
            if (enriched) {
              set({ participantSnapshotsByRound: enriched }, false, 'operations/initializeThread-enrich-snapshots-active-phase');
            }
          }
        }
        return;
      }

      set({
        changelogItems: [],
        hasInitiallyLoaded: true,
        hasSentPendingMessage: false,
        participants,
        participantSnapshotsByRound: new Map(),
        phase: ChatPhases.IDLE,
        preSearchActivityTimes: new Map<number, number>(),
        preSearches: [],
        screenMode: ScreenModes.THREAD,
        showInitialUI: false,
        thread,
        triggeredModeratorIds: new Set<string>(),
        triggeredModeratorRounds: new Set<number>(),
        triggeredPreSearchRounds: new Set<number>(),
      }, false, 'operations/initializeThread');
    },

    markModeratorStreamTriggered: (moderatorId: string, roundNumber: number) => {
      set(state => ({
        triggeredModeratorIds: new Set([...state.triggeredModeratorIds, moderatorId]),
        triggeredModeratorRounds: new Set([...state.triggeredModeratorRounds, roundNumber]),
      }), false, 'tracking/markModeratorStreamTriggered');
    },

    markPreSearchTriggered: (roundNumber: number) => {
      set(state => ({
        triggeredPreSearchRounds: new Set([...state.triggeredPreSearchRounds, roundNumber]),
      }), false, 'preSearch/markPreSearchTriggered');
    },

    /**
     * MODERATOR COMPLETE - Frame 6/12
     */
    onModeratorComplete: () => {
      const state = get();

      if (!state.thread) {
        return;
      }

      if (state.phase !== ChatPhases.MODERATOR) {
        return;
      }

      // BUG C3 FIX: Reject zombie callbacks from a previous thread.
      if (state.streamingThreadId && state.thread.id !== state.streamingThreadId) {
        return;
      }

      set(state => ({
        ...STREAMING_COMPLETE_RESET,
        pendingMessage: null,
        phase: ChatPhases.COMPLETE,
        preSearches: state.preSearches.map(ps =>
          (ps.status === MessageStatuses.STREAMING || ps.status === MessageStatuses.PENDING)
            ? { ...ps, status: MessageStatuses.COMPLETE }
            : ps,
        ),
        streamingThreadId: null,
      }), false, 'phase/complete');
    },

    /**
     * PARTICIPANT COMPLETE - Frame 3/4/5 or 10/11
     */
    onParticipantComplete: (_participantIndex: number) => {
      const state = get();

      // Only advance from PARTICIPANTS phase
      if (state.phase !== ChatPhases.PARTICIPANTS) {
        return;
      }

      const enabledCount = state.activeRoundParticipantCount;
      const allComplete = state.completedParticipantCount >= enabledCount && enabledCount > 0;

      if (allComplete) {
        // Skip moderator when only 1 participant -- no synthesis needed
        if (enabledCount < 2) {
          set(state => ({
            ...STREAMING_COMPLETE_RESET,
            // Reset the round cardinality so it doesn't leak stale into the next
            // round. STREAMING_COMPLETE_RESET only clears currentParticipantIndex,
            // and the single-participant path never runs prepareForNewMessage.
            activeRoundParticipantCount: 0,
            completedParticipantCount: 0,
            pendingMessage: null,
            phase: ChatPhases.COMPLETE,
            preSearches: state.preSearches.map(ps =>
              (ps.status === MessageStatuses.STREAMING || ps.status === MessageStatuses.PENDING)
                ? { ...ps, status: MessageStatuses.COMPLETE }
                : ps,
            ),
            streamingThreadId: null,
          }), false, 'streaming/skipModeratorSingleParticipant');
          return;
        }

        // Guard: Don't transition if phase already advanced to MODERATOR
        // (onModeratorStart may have fired before deferred participant completions)
        if (get().phase === ChatPhases.PARTICIPANTS) {
          set({
            currentParticipantIndex: enabledCount - 1,
            phase: ChatPhases.MODERATOR,
          }, false, 'phase/toModerator');
        }
      }
    },

    prepareForNewMessage: () => {
      set({
        activeRoundParticipantCount: 0,
        completedParticipantCount: 0,
        createdThreadId: null,
        currentParticipantIndex: 0,
        domainSourceProgress: [],
        hasSentPendingMessage: false,
        pendingMessage: null,
        phase: ChatPhases.IDLE,
        streamingThreadId: null,
      }, false, 'operations/prepareForNewMessage');
    },
    removeAttachment: (id: string) => {
      set(state => ({
        pendingAttachments: state.pendingAttachments.filter(a => a.id !== id),
      }), false, 'attachments/removeAttachment');
    },
    removeParticipant: (participantId: string) => {
      set((state) => {
        const filtered = state.selectedParticipants.filter(
          p => p.id !== participantId && p.modelId !== participantId,
        );
        if (filtered.length === state.selectedParticipants.length) {
          return {};
        }
        return { selectedParticipants: filtered.map((p, i) => ({ ...p, priority: i })) };
      }, false, 'form/removeParticipant');
    },
    reorderParticipants: (fromIndex: number, toIndex: number) => {
      set((state) => {
        const arr = [...state.selectedParticipants];
        const [removed] = arr.splice(fromIndex, 1);
        if (!removed) {
          return {};
        }
        arr.splice(toIndex, 0, removed);
        return { selectedParticipants: arr.map((p, i) => ({ ...p, priority: i })) };
      }, false, 'form/reorderParticipants');
    },
    resetForm: () => set(FORM_DEFAULTS, false, 'form/resetForm'),
    resetForThreadNavigation: () => {
      set({
        ...THREAD_NAVIGATION_RESET,
        // Sentinel value: zombie callbacks from old thread pass roundNumber=0,
        // but currentRoundNumber=ROUND_UNINITIALIZED fails the `roundNumber !== currentRound` check.
        currentRoundNumber: ROUND_UNINITIALIZED,
        streamingThreadId: null,
      }, false, 'operations/resetForThreadNavigation');
    },
    resetToIdle: () => {
      set({
        pendingMessage: null,
        phase: ChatPhases.IDLE,
      }, false, 'phase/toIdle');
    },
    resetToNewChat: () => {
      set({
        ...OVERVIEW_RESET,
        currentRoundNumber: ROUND_UNINITIALIZED,
      }, false, 'operations/resetToNewChat');
    },

    resetToOverview: () => {
      set({
        ...OVERVIEW_RESET,
        currentRoundNumber: ROUND_UNINITIALIZED,
        streamingThreadId: null,
      }, false, 'operations/resetToOverview');
    },

    /**
     * RESUME INTO STREAMING
     * Called when AI SDK resume finds an active stream after page refresh.
     * Sets up store state for streaming without the normal phase transition guards.
     */
    resumeIntoStreaming: (
      roundNumber: number,
      participantCount: number,
      targetPhase: ChatPhase,
    ) => {
      const state = get();

      // Guard: Reject sentinel ROUND_UNINITIALIZED
      if (roundNumber < 0) {
        return;
      }

      // Guard: Don't resume if already streaming
      if (state.phase !== ChatPhases.IDLE && state.phase !== ChatPhases.COMPLETE) {
        return;
      }

      // Create participant snapshot - prefer API-synced participants (source of truth)
      const snapState = get();
      const enabledApiParticipants = snapState.participants.filter(p => p.isEnabled);
      // FIX P2: Sort fallback selectedParticipants by priority to match backend ordering
      const participantSnapshot = enabledApiParticipants.length > 0
        ? enabledApiParticipants.slice(0, participantCount).map(p => ({
            modelId: p.modelId,
            role: p.role ?? null,
          }))
        : [...snapState.selectedParticipants]
            .sort((a, b) => {
              const priorityDiff = (a.priority ?? 0) - (b.priority ?? 0);
              if (priorityDiff !== 0) {
                return priorityDiff;
              }
              // Tiebreaker by modelId to match startRound() and backend ordering determinism
              return a.modelId.localeCompare(b.modelId);
            })
            .slice(0, participantCount)
            .map(p => ({
              modelId: p.modelId,
              role: p.role ?? null,
            }));

      // H3 FIX: Pad snapshot when source participants are fewer than expected count.
      if (participantSnapshot.length > 0 && participantSnapshot.length < participantCount) {
        while (participantSnapshot.length < participantCount) {
          participantSnapshot.push({ modelId: PLACEHOLDER_MODEL_ID, role: null });
        }
      }

      // ISSUE-03 FIX: Create placeholder snapshot entries when no participants are hydrated yet.
      if (participantSnapshot.length === 0 && participantCount > 0) {
        for (let i = 0; i < participantCount; i++) {
          participantSnapshot.push({ modelId: PLACEHOLDER_MODEL_ID, role: null });
        }
      }

      if (participantSnapshot.length > 0) {
        set(s => ({
          participantSnapshotsByRound: new Map([...s.participantSnapshotsByRound, [roundNumber, participantSnapshot]]),
        }), false, 'resume/snapshot-capture');
      }

      // Set streaming state
      set({
        activeRoundParticipantCount: participantCount,
        completedParticipantCount: 0,
        currentRoundNumber: roundNumber,
        phase: targetPhase,
        streamingThreadId: state.thread?.id ?? null,
      }, false, 'resume/intoStreaming');

      // Create pre-search entry when resuming into PRESEARCH phase
      if (targetPhase === ChatPhases.PRESEARCH) {
        const threadId = state.thread?.id;
        if (threadId) {
          const existingPreSearch = state.preSearches.find(ps => ps.roundNumber === roundNumber);
          if (!existingPreSearch) {
            get().addPreSearch({
              completedAt: null,
              createdAt: new Date().toISOString(),
              errorMessage: null,
              id: `presearch-${threadId}-r${roundNumber}`,
              roundNumber,
              searchData: undefined,
              status: MessageStatuses.STREAMING,
              threadId,
              userQuery: '',
            });
          }
        }
      }
    },

    retryLastRound: () => {
      set({
        phase: ChatPhases.IDLE,
      }, false, 'operations/retryLastRound');
    },

    setActivePresetId: id => set({ activePresetId: id }, false, 'form/setActivePresetId'),

    /**
     * RECONCILE ACTIVE-ROUND PARTICIPANT COUNT
     * The server's per-event totalParticipants is the authoritative round cardinality.
     * Clamp to a sane upper bound (mirroring startRound) so a malformed count can't
     * strand the round waiting for participants that never stream.
     */
    setActiveRoundParticipantCount: (count: number) => {
      const MAX_REASONABLE_PARTICIPANTS = 10;
      if (count <= 0 || count > MAX_REASONABLE_PARTICIPANTS) {
        return;
      }
      if (get().activeRoundParticipantCount === count) {
        return;
      }
      set({ activeRoundParticipantCount: count }, false, 'streaming/setActiveRoundParticipantCount');
    },

    setAnimationPhase: phase => set({ animationPhase: phase }, false, 'titleAnimation/setAnimationPhase'),
    setAutoMode: enabled => set({ autoMode: enabled }, false, 'form/setAutoMode'),
    setChangelogItems: items => set({ changelogItems: items }, false, 'changelog/setChangelogItems'),

    setCreatedThreadId: id => set({ createdThreadId: id }, false, 'ui/setCreatedThreadId'),
    setCreatedThreadProjectId: projectId => set({ createdThreadProjectId: projectId }, false, 'ui/setCreatedThreadProjectId'),
    setCurrentParticipantIndex: index => set({ currentParticipantIndex: index }, false, 'thread/setCurrentParticipantIndex'),
    setCurrentRoundNumber: round => set({ currentRoundNumber: round }, false, 'thread/setCurrentRoundNumber'),
    setDataSources: dataSources => set({ dataSources }, false, 'form/setDataSources'),
    setEnableWebSearch: enabled => set({ enableWebSearch: enabled }, false, 'form/setEnableWebSearch'),
    setHasInitiallyLoaded: loaded => set({ hasInitiallyLoaded: loaded }, false, 'ui/setHasInitiallyLoaded'),

    setHasSentPendingMessage: sent => set({ hasSentPendingMessage: sent }, false, 'thread/setHasSentPendingMessage'),

    setInputValue: value => set({ inputValue: value }, false, 'form/setInputValue'),

    setIsAnalyzingPrompt: analyzing => set({ isAnalyzingPrompt: analyzing }, false, 'ui/setIsAnalyzingPrompt'),

    setIsCreatingThread: creating => set({ isCreatingThread: creating }, false, 'ui/setIsCreatingThread'),

    setIsRegenerating: regenerating => set({ isRegenerating: regenerating }, false, 'thread/setIsRegenerating'),

    setIsResumeInProgress: inProgress => set({ isResumeInProgress: inProgress }, false, 'ui/setIsResumeInProgress'),

    setModelOrder: (modelIds) => {
      set({ modelOrder: modelIds }, false, 'form/setModelOrder');
    },
    setModeratorFormat: format => set({ moderatorFormat: format }, false, 'form/setModeratorFormat'),
    setParticipants: participants => set({ participants }, false, 'thread/setParticipants'),
    setPendingAttachmentIds: ids => set({ pendingAttachmentIds: ids }, false, 'attachments/setPendingAttachmentIds'),
    setPendingFileParts: parts => set({ pendingFileParts: parts }, false, 'attachments/setPendingFileParts'),
    setPendingMessage: message => set({ pendingMessage: message }, false, 'form/setPendingMessage'),

    /**
     * SET PHASE TO MODERATOR - Lightweight phase transition
     * Only allows PARTICIPANTS -> MODERATOR (per phase machine contract).
     */
    setPhaseToModerator: () => {
      const state = get();
      // Guard: only allow PARTICIPANTS -> MODERATOR (phase is source of truth)
      if (state.phase === ChatPhases.MODERATOR) {
        return;
      }
      if (state.phase !== ChatPhases.PARTICIPANTS) {
        console.error(`setPhaseToModerator blocked: current phase is ${state.phase}, expected ${ChatPhases.PARTICIPANTS}`);
        return;
      }
      set({
        phase: ChatPhases.MODERATOR,
      }, false, 'phase/toModerator-direct');
    },

    setPreSearches: preSearches => set({ preSearches }, false, 'preSearch/setPreSearches'),

    setRegeneratingRoundNumber: round => set({ regeneratingRoundNumber: round }, false, 'thread/setRegeneratingRoundNumber'),
    setScreenMode: mode => set({ screenMode: mode }, false, 'ui/setScreenMode'),
    setSelectedMode: mode => set({ selectedMode: mode }, false, 'form/setSelectedMode'),
    setSelectedParticipants: (participants) => {
      set({ selectedParticipants: participants }, false, 'form/setSelectedParticipants');
    },

    setShowInitialUI: show => set({ showInitialUI: show }, false, 'ui/setShowInitialUI'),

    setThread: thread => set({ thread }, false, 'thread/setThread'),

    startRegeneration: (roundNumber: number) => {
      set({
        isRegenerating: true,
        regeneratingRoundNumber: roundNumber,
      }, false, 'operations/startRegeneration');
    },

    /**
     * START ROUND - Frame 2/8
     * Called when user sends message and round should start.
     *
     * CRITICAL: Captures participant count at round start to prevent divergence
     * during the streaming phase.
     *
     * AI SDK manages messages -- this only handles phase transitions
     * and participant snapshots.
     */
    startRound: (roundNumber: number, participantCount: number, shouldRunPresearch?: boolean) => {
      const state = get();

      const stateEnabledCount = countEnabledParticipants(state.participants);

      if (participantCount === 0 && stateEnabledCount === 0) {
        return;
      }

      const MAX_REASONABLE_PARTICIPANTS = 10;
      const actualCount = participantCount > 0 && participantCount <= MAX_REASONABLE_PARTICIPANTS
        ? participantCount
        : Math.max(stateEnabledCount, 1);

      // CRITICAL FIX: Save participant snapshot for this round BEFORE any streaming starts.
      const enabledApiParticipants = state.participants.filter(p => p.isEnabled);
      // FIX P2: Sort fallback selectedParticipants by priority to match backend DB ordering
      const snapshotSource = enabledApiParticipants.length > 0
        ? enabledApiParticipants.slice(0, actualCount).map(p => ({
            modelId: p.modelId,
            role: p.role ?? null,
          }))
        : [...state.selectedParticipants]
            .sort((a, b) => {
              const priorityDiff = (a.priority ?? 0) - (b.priority ?? 0);
              if (priorityDiff !== 0) {
                return priorityDiff;
              }
              return a.modelId.localeCompare(b.modelId);
            })
            .slice(0, actualCount)
            .map(p => ({
              modelId: p.modelId,
              role: p.role ?? null,
            }));
      const participantSnapshot = snapshotSource;
      if (participantSnapshot.length > 0) {
        set((s) => {
          const newMap = new Map([...s.participantSnapshotsByRound, [roundNumber, participantSnapshot]]);

          const MAX_SNAPSHOTS = 50;
          if (newMap.size > MAX_SNAPSHOTS) {
            const sortedKeys = [...newMap.keys()].sort((a, b) => a - b);
            const keysToRemove = sortedKeys.slice(0, sortedKeys.length - MAX_SNAPSHOTS);
            for (const key of keysToRemove) {
              newMap.delete(key);
            }
          }

          return { participantSnapshotsByRound: newMap };
        }, false, 'snapshot/capture');
      }

      // PRESEARCH FIX: If web search or domain data sources are active, start in PRESEARCH phase
      if (shouldRunPresearch) {
        set({
          activeRoundParticipantCount: actualCount,
          completedParticipantCount: 0,
          currentParticipantIndex: 0,
          currentRoundNumber: roundNumber,
          phase: ChatPhases.PRESEARCH,
          streamingThreadId: state.thread?.id ?? null,
        }, false, 'phase/startRound-presearch');

        const tid = state.thread?.id ?? '';
        const existingPreSearch = state.preSearches.find(ps => ps.roundNumber === roundNumber);
        if (!existingPreSearch && tid) {
          get().addPreSearch({
            completedAt: null,
            createdAt: new Date().toISOString(),
            errorMessage: null,
            id: `presearch-${tid}-r${roundNumber}`,
            roundNumber,
            searchData: undefined,
            status: MessageStatuses.STREAMING,
            threadId: tid,
            userQuery: '',
          });
        }

        return;
      }

      set({
        activeRoundParticipantCount: actualCount,
        completedParticipantCount: 0,
        currentParticipantIndex: 0,
        currentRoundNumber: roundNumber,
        phase: ChatPhases.PARTICIPANTS,
        streamingThreadId: state.thread?.id ?? null,
      }, false, 'phase/startRound');
    },

    startTitleAnimation: (threadId: string, oldTitle: string | null, newTitle: string) => {
      set({
        animatingThreadId: threadId,
        animationPhase: TitleAnimationPhases.DELETING,
        displayedTitle: oldTitle,
        newTitle,
        oldTitle,
      }, false, 'titleAnimation/start');
    },

    /**
     * Sync changelog items from API for a specific round
     */
    syncChangelogFromApi: (roundNumber: number, apiItems: ApiChangelog[]) => {
      const existing = get().changelogItems;
      const filtered = existing.filter(item => item.roundNumber !== roundNumber);
      set({ changelogItems: [...filtered, ...apiItems] }, false, 'changelog/syncFromApi');
    },

    /**
     * Transition from PRESEARCH to PARTICIPANTS phase.
     */
    transitionToParticipants: () => {
      const state = get();
      let actualCount = state.activeRoundParticipantCount;

      if (state.phase !== ChatPhases.PRESEARCH) {
        return;
      }

      // M2 FIX: Fall back to enabled participant count when activeRoundParticipantCount is 0.
      if (actualCount === 0) {
        actualCount = countEnabledParticipants(state.participants);
        if (actualCount === 0) {
          actualCount = state.selectedParticipants.length;
        }
        if (actualCount > 0) {
          set({ activeRoundParticipantCount: actualCount }, false, 'phase/fixParticipantCount');
        }
      }

      set({
        phase: ChatPhases.PARTICIPANTS,
      }, false, 'phase/transitionToParticipants');
    },

    tryMarkPreSearchTriggered: (roundNumber: number) => {
      const state = get();
      if (state.triggeredPreSearchRounds.has(roundNumber)) {
        return false;
      }
      set(s => ({
        triggeredPreSearchRounds: new Set([...s.triggeredPreSearchRounds, roundNumber]),
      }), false, 'preSearch/tryMarkPreSearchTriggered');
      return true;
    },

    updateAttachmentPreview: (id: string, preview: FilePreview) => {
      set(state => ({
        pendingAttachments: state.pendingAttachments.map(a =>
          a.id === id ? { ...a, preview } : a,
        ),
      }), false, 'attachments/updateAttachmentPreview');
    },

    updateAttachmentUpload: (id: string, upload: UploadItem) => {
      set(state => ({
        pendingAttachments: state.pendingAttachments.map(a =>
          a.id === id ? { ...a, uploadItem: upload } : a,
        ),
      }), false, 'attachments/updateAttachmentUpload');
    },

    updateDisplayedTitle: (title: string) => set({ displayedTitle: title }, false, 'titleAnimation/updateDisplayedTitle'),

    updateDomainSourceProgress: (data) => {
      set((state) => {
        const existing = state.domainSourceProgress.findIndex(d => d.sourceId === data.sourceId);
        const entry: DomainSourceStatus = {
          error: data.error,
          label: data.label,
          sourceId: data.sourceId,
          status: data.status,
        };
        if (existing >= 0) {
          const updated = [...state.domainSourceProgress];
          updated[existing] = entry;
          return { domainSourceProgress: updated };
        }
        return { domainSourceProgress: [...state.domainSourceProgress, entry] };
      }, false, 'presearch/updateDomainSourceProgress');
    },

    updateParticipant: (participantId: string, updates: Partial<ParticipantConfig>) => {
      set(state => ({
        selectedParticipants: state.selectedParticipants.map(p =>
          (p.id === participantId || p.modelId === participantId) ? { ...p, ...updates } : p,
        ),
      }), false, 'form/updateParticipant');
    },

    updateParticipants: (participants: ChatParticipant[]) => {
      const currentRound = get().currentRoundNumber;
      const phase = get().phase;

      // Block during active streaming phases
      const isActiveStreamingPhase = phase === ChatPhases.PRESEARCH
        || phase === ChatPhases.PARTICIPANTS
        || phase === ChatPhases.MODERATOR;
      if (currentRound !== null && isActiveStreamingPhase) {
        return false;
      }

      set({ participants }, false, 'operations/updateParticipants');
      return true;
    },

    updatePreSearchActivity: (roundNumber: number) => {
      set(state => ({
        preSearchActivityTimes: new Map([...state.preSearchActivityTimes, [roundNumber, Date.now()]]),
      }), false, 'preSearch/updatePreSearchActivity');
    },

    /**
     * UPDATE PRE-SEARCH DATA - Frame 11 transition
     */
    updatePreSearchData: (roundNumber: number, searchData: PreSearchDataPayload | null) => {
      set(state => ({
        preSearches: state.preSearches.map(ps =>
          ps.roundNumber === roundNumber
            ? { ...ps, completedAt: new Date().toISOString(), searchData, status: MessageStatuses.COMPLETE as typeof ps.status }
            : ps,
        ),
      }), false, 'preSearch/updatePreSearchData');
    },

    updatePreSearchStatus: (roundNumber: number, status: MessageStatus) => {
      set(state => ({
        preSearches: state.preSearches.map(ps =>
          ps.roundNumber === roundNumber ? { ...ps, status } : ps,
        ),
      }), false, 'preSearch/updatePreSearchStatus');
    },
  }));
}
