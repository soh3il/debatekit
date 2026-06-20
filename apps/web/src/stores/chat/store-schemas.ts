/**
 * Chat Store Schemas
 *
 * AI SDK owns: messages, status, error, resume.
 * Custom store owns: phase machine, participant tracking, pre-search/changelog,
 * form state, UI state, attachments, title animation, tracking/dedup.
 *
 * Types inferred from Zod schemas (single source of truth).
 */

import type { ChatMode, MessageStatus } from '@debatekit/shared';
import { ChatModeSchema, DataSourceEntrySchema, ModeratorFormatIdSchema, ScreenModeSchema } from '@debatekit/shared';
import { z } from 'zod';

import type { PendingAttachment } from '@/hooks/utils/attachment-schemas';
import { PendingAttachmentSchema } from '@/hooks/utils/attachment-schemas';
import type { FilePreview } from '@/hooks/utils/use-file-preview';
import type { UploadItem } from '@/hooks/utils/use-file-upload';
import type { ExtendedFilePart, ParticipantConfig } from '@/lib/schemas';
import { ChatParticipantSchema, ExtendedFilePartSchema, ParticipantConfigSchema } from '@/lib/schemas';
import type { ApiChangelog, ChatParticipant, ChatThread, PreSearchDataPayload, StoredPreSearch } from '@/services/api';

// ============================================================================
// ROUND SENTINEL - Uninitialized round marker
// ============================================================================

/**
 * Sentinel value indicating no round has been initialized yet.
 * Used in navigation resets to reject stale callbacks.
 */
export const ROUND_UNINITIALIZED = -1 as const;

// ============================================================================
// PARTICIPANT SNAPSHOT - Immutable identity snapshot for round safety
// ============================================================================

/**
 * Sentinel modelId for placeholder snapshot entries created during resume
 * when participants haven't been hydrated yet (route loader still fetching).
 * The UI can detect this to render skeleton cards instead of model-specific icons.
 * These placeholders are enriched with real data once initializeThread runs.
 */
export const PLACEHOLDER_MODEL_ID = '__placeholder__' as const;

export const ParticipantSnapshotEntrySchema = z.object({
  modelId: z.string(),
  role: z.string().nullable(),
});
export type ParticipantSnapshotEntry = z.infer<typeof ParticipantSnapshotEntrySchema>;

// ============================================================================
// CHAT PHASE - Core state machine (DebateKit-specific)
// ============================================================================

export const ChatPhaseValues = ['idle', 'presearch', 'participants', 'moderator', 'complete'] as const;
export const DEFAULT_CHAT_PHASE: ChatPhase = 'idle';
export const ChatPhaseSchema = z.enum(ChatPhaseValues);
export type ChatPhase = z.infer<typeof ChatPhaseSchema>;

export const ChatPhases = {
  COMPLETE: 'complete',
  IDLE: 'idle',
  MODERATOR: 'moderator',
  PARTICIPANTS: 'participants',
  PRESEARCH: 'presearch',
} as const satisfies Record<string, ChatPhase>;

// ============================================================================
// TITLE ANIMATION
// ============================================================================

export const TitleAnimationPhaseValues = ['idle', 'deleting', 'typing', 'complete'] as const;
export const DEFAULT_TITLE_ANIMATION_PHASE: TitleAnimationPhase = 'idle';
export const TitleAnimationPhaseSchema = z.enum(TitleAnimationPhaseValues);
export type TitleAnimationPhase = z.infer<typeof TitleAnimationPhaseSchema>;

export const TitleAnimationPhases = {
  COMPLETE: 'complete',
  DELETING: 'deleting',
  IDLE: 'idle',
  TYPING: 'typing',
} as const satisfies Record<string, TitleAnimationPhase>;

// ============================================================================
// CORE STATE SCHEMAS (Simplified)
// ============================================================================

/**
 * Thread and message state
 *
 * PHASE MACHINE IS SOURCE OF TRUTH:
 * - phase: The single source of truth for streaming state
 *
 * DERIVED STATE (use selectors from ./selectors.ts):
 * - deriveIsStreaming(phase): phase === PRESEARCH | PARTICIPANTS | MODERATOR
 * - deriveIsModeratorStreaming(phase): phase === MODERATOR
 * - deriveWaitingToStartStreaming(phase, pendingMessage): phase === IDLE && pendingMessage !== null
 *
 * Messages are managed by AI SDK -- not stored here.
 * Selectors are preferred over direct state access for streaming checks.
 */
export const ThreadStateSchema = z.object({
  /**
   * Captured participant count at round start.
   * Used to prevent count divergence during streaming.
   * Set by startRound(), consumed by useDebateKitChat callbacks.
   */
  activeRoundParticipantCount: z.number(),
  /** Number of participants that have completed (complete or error) in the current round */
  completedParticipantCount: z.number(),
  /** Index of currently streaming participant (0-based) */
  currentParticipantIndex: z.number(),
  /** Current round number (0-based, null if no round active) */
  currentRoundNumber: z.number().nullable(),
  /** Whether user's message was sent (prevents duplicate sends) */
  hasSentPendingMessage: z.boolean(),
  /** Whether currently regenerating a round */
  isRegenerating: z.boolean(),
  /** Thread participants (enabled/disabled models) */
  participants: z.array(ChatParticipantSchema),
  /**
   * Snapshot of selectedParticipants at the start of each round.
   * Prevents participant identity corruption when participants change between rounds.
   * The fallback lookup in chat-message-list uses this instead of the current participants array.
   * Keyed by round number, preserved across rounds.
   */
  // z.custom: Map is runtime-only store state, not serialized across boundaries
  participantSnapshotsByRound: z.custom<Map<number, ParticipantSnapshotEntry[]>>(val => val instanceof Map),
  /** Current phase of the round flow - SOURCE OF TRUTH for streaming state */
  phase: ChatPhaseSchema,
  /** Round being regenerated (null if not regenerating) */
  regeneratingRoundNumber: z.number().nullable(),
  /**
   * Thread ID captured at round start (startRound/resumeIntoStreaming).
   * Used by completeStreaming/onModeratorComplete to reject zombie callbacks
   * from a previous thread after partial init sets a new thread object.
   */
  streamingThreadId: z.string().nullable(),
  /** Thread data */
  // z.custom: ChatThread is a complex API type used as runtime-only store state, not serialized across boundaries
  thread: z.custom<ChatThread | null>(val => val === null || (typeof val === 'object' && val !== null)),
});

/** Form state */
export const FormStateSchema = z.object({
  activePresetId: z.string().optional(),
  autoMode: z.boolean(),
  dataSources: z.array(DataSourceEntrySchema).optional(),
  enableWebSearch: z.boolean(),
  inputValue: z.string(),
  modelOrder: z.array(z.string()),
  moderatorFormat: ModeratorFormatIdSchema.optional(),
  pendingMessage: z.string().nullable(),
  selectedMode: ChatModeSchema.nullable(),
  selectedParticipants: z.array(ParticipantConfigSchema),
});

/**
 * UI state
 *
 * PHASE MACHINE IS SOURCE OF TRUTH:
 * - phase: The single source of truth for streaming state
 *
 * DERIVED STATE (use selectors from ./selectors.ts):
 * - deriveIsModeratorStreaming(phase): phase === MODERATOR
 * - deriveWaitingToStartStreaming(phase, pendingMessage): phase === IDLE && pendingMessage !== null
 *
 * Selectors are preferred over direct state access for streaming checks.
 */
export const UIStateSchema = z.object({
  createdThreadId: z.string().nullable(),
  createdThreadProjectId: z.string().nullable(),
  hasInitiallyLoaded: z.boolean(),
  isAnalyzingPrompt: z.boolean(),
  isCreatingThread: z.boolean(),
  isResumeInProgress: z.boolean(),
  screenMode: ScreenModeSchema.nullable(),
  showInitialUI: z.boolean(),
});

/** Attachments state */
export const AttachmentsStateSchema = z.object({
  pendingAttachmentIds: z.array(z.string()).nullable(),
  pendingAttachments: z.array(PendingAttachmentSchema),
  pendingFileParts: z.array(ExtendedFilePartSchema).nullable(),
});

/** Domain source progress entry (runtime-only) */
export type DomainSourceStatus = {
  error?: string;
  label: string;
  sourceId: string;
  status: 'start' | 'complete' | 'error';
};

/** Pre-search state */
export const PreSearchStateSchema = z.object({
  domainSourceProgress: z.custom<DomainSourceStatus[]>(val => Array.isArray(val)),
  // z.custom: StoredPreSearch[] is runtime-only store state, not serialized across boundaries
  preSearches: z.custom<StoredPreSearch[]>(val => Array.isArray(val)),
});

/** Changelog state */
export const ChangelogStateSchema = z.object({
  // z.custom: ApiChangelog[] is runtime-only store state, not serialized across boundaries
  changelogItems: z.custom<ApiChangelog[]>(val => Array.isArray(val)),
});

/** Title animation state */
export const TitleAnimationStateSchema = z.object({
  animatingThreadId: z.string().nullable(),
  animationPhase: TitleAnimationPhaseSchema,
  displayedTitle: z.string().nullable(),
  newTitle: z.string().nullable(),
  oldTitle: z.string().nullable(),
});

/** Tracking state for deduplication */
export const TrackingStateSchema = z.object({
  // z.custom: Map/Set are runtime-only store state, not serialized across boundaries
  preSearchActivityTimes: z.custom<Map<number, number>>(val => val instanceof Map),
  triggeredModeratorIds: z.custom<Set<string>>(val => val instanceof Set),
  triggeredModeratorRounds: z.custom<Set<number>>(val => val instanceof Set),
  triggeredPreSearchRounds: z.custom<Set<number>>(val => val instanceof Set),
});

// ============================================================================
// COMBINED STATE
// ============================================================================

export const ChatStoreStateSchema = z.intersection(
  z.intersection(
    z.intersection(
      z.intersection(
        z.intersection(
          z.intersection(
            z.intersection(
              ThreadStateSchema,
              FormStateSchema,
            ),
            UIStateSchema,
          ),
          AttachmentsStateSchema,
        ),
        PreSearchStateSchema,
      ),
      ChangelogStateSchema,
    ),
    TitleAnimationStateSchema,
  ),
  TrackingStateSchema,
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ThreadState = z.infer<typeof ThreadStateSchema>;
export type FormState = z.infer<typeof FormStateSchema>;
export type UIState = z.infer<typeof UIStateSchema>;
export type AttachmentsState = z.infer<typeof AttachmentsStateSchema>;
export type PreSearchState = z.infer<typeof PreSearchStateSchema>;
export type ChangelogState = z.infer<typeof ChangelogStateSchema>;
export type TitleAnimationState = z.infer<typeof TitleAnimationStateSchema>;
export type TrackingState = z.infer<typeof TrackingStateSchema>;
export type ChatStoreState = z.infer<typeof ChatStoreStateSchema>;

export type ChatStoreActions = {
  // === PHASE TRANSITIONS ===
  startRound: (roundNumber: number, participantCount: number, shouldRunPresearch?: boolean) => void;
  transitionToParticipants: () => void;
  onParticipantComplete: (participantIndex: number) => void;
  setPhaseToModerator: () => void;
  onModeratorComplete: () => void;
  resetToIdle: () => void;

  // === THREAD ===
  setThread: (thread: ChatThread | null) => void;
  setParticipants: (participants: ChatParticipant[]) => void;
  setCurrentParticipantIndex: (index: number) => void;
  setCurrentRoundNumber: (round: number | null) => void;
  setHasSentPendingMessage: (sent: boolean) => void;
  setIsRegenerating: (regenerating: boolean) => void;
  setRegeneratingRoundNumber: (round: number | null) => void;
  // === FORM ===
  setActivePresetId: (id: string | undefined) => void;
  setInputValue: (value: string) => void;
  setPendingMessage: (message: string | null) => void;
  setSelectedParticipants: (participants: ParticipantConfig[]) => void;
  addParticipant: (participant: ParticipantConfig) => void;
  removeParticipant: (participantId: string) => void;
  reorderParticipants: (fromIndex: number, toIndex: number) => void;
  updateParticipant: (participantId: string, updates: Partial<ParticipantConfig>) => void;
  setSelectedMode: (mode: ChatMode | null) => void;
  setAutoMode: (enabled: boolean) => void;
  setDataSources: (dataSources: FormState['dataSources']) => void;
  setEnableWebSearch: (enabled: boolean) => void;
  setModeratorFormat: (format: FormState['moderatorFormat']) => void;
  setModelOrder: (modelIds: string[]) => void;
  resetForm: () => void;

  // === UI ===
  setCreatedThreadId: (id: string | null) => void;
  setCreatedThreadProjectId: (projectId: string | null) => void;
  setIsCreatingThread: (creating: boolean) => void;
  setIsResumeInProgress: (inProgress: boolean) => void;
  setIsAnalyzingPrompt: (analyzing: boolean) => void;
  // NOTE: setIsResumingStream removed - AI SDK resume: true handles resumption natively
  setShowInitialUI: (show: boolean) => void;
  setHasInitiallyLoaded: (loaded: boolean) => void;
  setScreenMode: (mode: z.infer<typeof ScreenModeSchema> | null) => void;

  // === ATTACHMENTS ===
  addAttachments: (attachments: PendingAttachment[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  updateAttachmentUpload: (id: string, upload: UploadItem) => void;
  updateAttachmentPreview: (id: string, preview: FilePreview) => void;
  setPendingAttachmentIds: (ids: string[] | null) => void;
  setPendingFileParts: (parts: ExtendedFilePart[] | null) => void;
  getAttachments: () => PendingAttachment[];

  // === PRE-SEARCH ===
  setPreSearches: (preSearches: StoredPreSearch[]) => void;
  addPreSearch: (preSearch: StoredPreSearch) => void;
  updatePreSearchStatus: (roundNumber: number, status: MessageStatus) => void;
  /** Update complete pre-search data when web search finishes */
  updatePreSearchData: (roundNumber: number, searchData: PreSearchDataPayload | null) => void;
  updatePreSearchActivity: (roundNumber: number) => void;
  clearPreSearchActivity: (roundNumber: number) => void;
  clearAllPreSearches: () => void;
  clearAllPreSearchTracking: () => void;
  hasPreSearchBeenTriggered: (roundNumber: number) => boolean;
  markPreSearchTriggered: (roundNumber: number) => void;
  tryMarkPreSearchTriggered: (roundNumber: number) => boolean;
  clearPreSearchTracking: (roundNumber: number) => void;
  /** Update domain source progress (upsert by sourceId) */
  updateDomainSourceProgress: (data: { error?: string; label: string; sourceId: string; status: 'start' | 'complete' | 'error' }) => void;

  // === CHANGELOG ===
  setChangelogItems: (items: ApiChangelog[]) => void;
  addChangelogItems: (items: ApiChangelog[]) => void;
  /** Sync changelog items from API for a specific round (API is source of truth) */
  syncChangelogFromApi: (roundNumber: number, apiItems: ApiChangelog[]) => void;

  // === TITLE ANIMATION ===
  startTitleAnimation: (threadId: string, oldTitle: string | null, newTitle: string) => void;
  updateDisplayedTitle: (title: string) => void;
  setAnimationPhase: (phase: TitleAnimationPhase) => void;
  completeTitleAnimation: () => void;

  // === TRACKING (deduplication) ===
  hasModeratorStreamBeenTriggered: (moderatorId: string, roundNumber: number) => boolean;
  markModeratorStreamTriggered: (moderatorId: string, roundNumber: number) => void;
  clearModeratorTracking: () => void;

  /** Resume into streaming state after page refresh - bypasses normal phase guards */
  resumeIntoStreaming: (roundNumber: number, participantCount: number, targetPhase: ChatPhase) => void;
  /** Enrich a placeholder participant snapshot with actual model data during resume */
  enrichParticipantSnapshot: (roundNumber: number, participantIndex: number, modelId: string) => void;
  /** Increment the completed participant counter (counts both complete and error as done) */
  incrementCompletedParticipants: () => void;
  /** Reconcile the active-round participant count to the server's authoritative total */
  setActiveRoundParticipantCount: (count: number) => void;

  // === OPERATIONS ===
  initializeThread: (thread: ChatThread, participants: ChatParticipant[]) => void;
  resetForThreadNavigation: () => void;
  resetToOverview: () => void;
  resetToNewChat: () => void;
  completeStreaming: () => void;
  updateParticipants: (participants: ChatParticipant[]) => boolean;
  prepareForNewMessage: () => void;
  retryLastRound: () => void;
  startRegeneration: (roundNumber: number) => void;
  completeRegeneration: () => void;

};

export type ChatStore = ChatStoreState & ChatStoreActions;
