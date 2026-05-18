/**
 * Chat Store Public API - Minimal Rewrite
 */

// Store
// ============================================================================
// UTILITY EXPORTS
// Helper functions and hooks used by screens
// ============================================================================
import { MessageStatuses } from '@debatekit/shared';
import type { UIMessage } from 'ai';
import { useLayoutEffect, useRef } from 'react';

import { useChatStoreApi } from '@/components/providers/chat-store-provider/context';
import { chatParticipantsToConfig, extractPresearchDataFromMessageParts, getCurrentRoundNumber } from '@/lib/utils';
import type { ApiChangelog, ChatParticipant, ChatThread, StoredPreSearch } from '@/services/api';

import { deriveIsStreaming } from './selectors';

declare global {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Window {
    __HYDRATED__?: boolean;
  }
}

export type { ChatStoreApi, ChatStoreInitialState } from './store';
export { createChatStore } from './store';

// Schemas & Types
export type {
  AttachmentsState,
  ChangelogState,
  ChatPhase,
  ChatStore,
  ChatStoreActions,
  ChatStoreState,
  FormState,
  PreSearchState,
  ThreadState,
  TitleAnimationPhase,
  TitleAnimationState,
  TrackingState,
  UIState,
} from './store-schemas';
export {
  ChatPhases,
  ChatPhaseSchema,
  ChatPhaseValues,
  PLACEHOLDER_MODEL_ID,
} from './store-schemas';

// Defaults
export {
  DEFAULT_PRESET_MODE,
  DEFAULT_PRESET_PARTICIPANTS,
  FORM_DEFAULTS,
  STORE_DEFAULTS,
} from './store-defaults';

// Actions (kept files)
export type { UseAutoModeAnalysisReturn } from './actions/auto-mode-actions';
export { useAutoModeAnalysis } from './actions/auto-mode-actions';
export type { AttachmentInfo, UseChatFormActionsReturn } from './actions/form-actions';
export { useChatFormActions } from './actions/form-actions';
export { useNavigationReset } from './actions/navigation-reset';
export type { UseOverviewActionsOptions, UseOverviewActionsReturn, UseOverviewFormCallbacksOptions, UseOverviewFormCallbacksReturn } from './actions/overview-actions';
export { useOverviewActions, useOverviewFormCallbacks } from './actions/overview-actions';
export type { UseThreadActionsOptions, UseThreadActionsReturn } from './actions/thread-actions';
export { useThreadActions } from './actions/thread-actions';

// Cache validation utilities
export type {
  InfiniteQueryCache,
  PaginatedPageCache,
  ThreadDetailCacheData,
  ThreadDetailPayloadCache,
  ThreadDetailResponseCache,
  ThreadsListCachePage,
} from './actions/types';
export {
  ChatThreadCacheSchema,
  validateInfiniteQueryCache,
  validateThreadDetailCache,
  validateThreadDetailPayloadCache,
  validateThreadDetailResponseCache,
  validateThreadsListPages,
} from './actions/types';

// Derived Selectors - Streaming state combinations
export {
  // Derive helpers (compute streaming state from phase)
  deriveIsModeratorStreaming,
  deriveIsStreaming,
  deriveWaitingToStartStreaming,
  // Pure selector function (for use with useChatStore or testing)
  selectPreSearchesForCurrentThread,
  // Selector hook (for direct use in components)
  usePreSearchState,
} from './selectors';

type SyncHydrateOptions = {
  thread: ChatThread;
  participants: ChatParticipant[];
  initialMessages: UIMessage[];
  initialPreSearches?: StoredPreSearch[];
  initialChangelog?: ApiChangelog[];
};

/**
 * Sync hydrate store hook - hydrates store from server data on SSR/refresh.
 *
 * AI SDK now owns messages and streaming placeholders. This hook only
 * hydrates DebateKit-specific state: thread, participants, form, pre-searches,
 * changelog, and UI flags.
 *
 * Uses useLayoutEffect to ensure data is in store BEFORE first paint.
 */
export function useSyncHydrateStore(options: SyncHydrateOptions): void {
  const storeApi = useChatStoreApi();
  const hasHydratedRef = useRef(false);
  const threadIdRef = useRef<string | null>(null);

  // Use layoutEffect for synchronous hydration before paint
  useLayoutEffect(() => {
    const { initialChangelog, initialMessages, initialPreSearches, participants, thread } = options;

    const state = storeApi.getState();

    // Skip if already hydrated for this thread -- BUT detect store reset.
    // HYDRATION-CLEANUP RACE FIX: React fires child layoutEffects BEFORE parent's.
    // So useSyncHydrateStore (child) runs before useNavigationCleanup (parent).
    // When navigating between threads: (1) child hydrates new thread, (2) parent
    // cleanup calls resetForThreadNavigation() -> OVERWRITES what we just set
    // (thread=null, currentRoundNumber=-1). On re-render, this ref guard would
    // normally skip, but the store is in reset state. Detect this and re-hydrate.
    if (hasHydratedRef.current && threadIdRef.current === thread.id) {
      const storeThreadId = state.thread?.id;
      if (storeThreadId === thread.id) {
        return; // Store is consistent -- truly skip
      }
      // Fall through to re-hydrate
    }

    // CRITICAL FIX (H4): Skip hydration while store is actively streaming.
    // When navigating thread-to-thread during streaming, D1 data lags behind
    // Redis so server loader returns stale state. Overwriting live SSE data
    // with stale D1 data causes UI glitches. deriveIsStreaming checks phase
    // (PRESEARCH | PARTICIPANTS | MODERATOR) which is the single source of truth.
    //
    // NOTE: We only skip for ACTIVE streaming phases, NOT for waitingToStartStreaming.
    // waitingToStartStreaming means the user submitted but SSE hasn't started yet.
    // In that state, config may still be syncing from the PATCH response, and the
    // store should accept hydration data (especially on page refresh scenarios).
    // The PATCH→setPendingMessage ordering fix in form-actions ensures pendingMessage
    // is only set after config is applied, so hydration won't clobber in-flight config.
    //
    // BUG-14 FIX: Only skip hydration if streaming on the SAME thread. When
    // navigating from thread A (streaming) to thread B, the store still holds
    // A's phase (PARTICIPANTS/MODERATOR), so deriveIsStreaming() returns true
    // and blocks hydration of thread B's data. Compare the store's threadId
    // against the thread being hydrated -- if they differ, always hydrate.
    //
    // STALE PHASE FIX: Also require that the store actually has a thread set.
    // After resetForThreadNavigation(), thread is null but phase could be set
    // back to a streaming value by a zombie SSE callback from the old stream.
    // When storeThreadId is null, the phase is orphaned (belongs to no thread)
    // and must not block hydration of the new thread.
    const storeThreadId = state.thread?.id;
    if (storeThreadId && deriveIsStreaming(state.phase) && storeThreadId === thread.id) {
      hasHydratedRef.current = true;
      threadIdRef.current = thread.id;
      if (typeof window !== 'undefined') {
        window.__HYDRATED__ = true;
      }
      return;
    }

    // AI SDK owns messages and streaming placeholders.
    // Just hydrate thread, participants, and DebateKit-specific state.
    state.initializeThread(thread, participants);

    // RESUME FIX: Set currentRoundNumber from initial messages so AI SDK resume
    // GET hits the correct round endpoint. Without this, currentRoundNumber stays
    // null on page refresh, causing the resume URL to default to round 0 even when
    // the active stream is on a later round. The backend returns 204 (no active
    // stream) for the wrong round, silently failing the resume.
    const hydratedRound = getCurrentRoundNumber(initialMessages);
    state.setCurrentRoundNumber(hydratedRound);

    // Mark that first hydration completed
    if (typeof window !== 'undefined') {
      window.__HYDRATED__ = true;
    }

    // Sync participant configs to form state
    const participantConfigs = chatParticipantsToConfig(participants);
    state.setSelectedParticipants(participantConfigs);
    state.setSelectedMode(thread.mode);
    state.setEnableWebSearch(thread.enableWebSearch);
    state.setInputValue('');

    // Hydrate pre-searches if provided.
    // MERGE FIX: Don't blindly overwrite — if store already has searchData
    // from streaming (populated by artifact-based presearch during SSE),
    // preserve it. D1 data from route loader may lag behind Redis/streaming
    // and return presearch entries without searchData, which would wipe the
    // accumulated data causing "nothing shows when expanded" after completion.
    //
    // RESUME FIX: When both store and D1 data lack searchData (page refresh),
    // extract presearch data from AI SDK message parts as a fallback. AI SDK
    // persists artifact data parts (data-artifact-presearch) in the message
    // parts array, so they survive page refresh even though the
    // presearch-complete event (transient) is NOT replayed.
    if (initialPreSearches && initialPreSearches.length > 0) {
      const existing = state.preSearches;

      // Lazy-compute message parts extraction only if needed
      let messagePartsData: ReturnType<typeof extractPresearchDataFromMessageParts> | undefined;
      const getMessagePartsData = () => {
        if (messagePartsData === undefined) {
          messagePartsData = extractPresearchDataFromMessageParts(initialMessages);
        }
        return messagePartsData;
      };

      if (existing.length > 0) {
        const merged = initialPreSearches.map((incoming) => {
          const storeEntry = existing.find(e => e.roundNumber === incoming.roundNumber);
          // Keep store's searchData if it's richer than the incoming D1 data
          if (storeEntry?.searchData && !incoming.searchData) {
            return { ...incoming, searchData: storeEntry.searchData };
          }
          // Keep store's searchData if incoming has fewer results (stale D1 snapshot)
          if (storeEntry?.searchData?.results?.length && incoming.searchData?.results?.length
            && storeEntry.searchData.results.length > incoming.searchData.results.length) {
            return { ...incoming, searchData: storeEntry.searchData };
          }
          // RESUME FIX: Neither store nor D1 has searchData — extract from message parts
          if (!incoming.searchData && !storeEntry?.searchData) {
            const fromParts = getMessagePartsData();
            if (fromParts) {
              return { ...incoming, searchData: fromParts };
            }
          }
          return incoming;
        });
        state.setPreSearches(merged);
      } else {
        // RESUME FIX: Store is empty (fresh mount). If any presearch entry
        // lacks searchData, try extracting from AI SDK message parts.
        const hasAnyMissingSearchData = initialPreSearches.some(ps => !ps.searchData);
        if (hasAnyMissingSearchData) {
          const fromParts = getMessagePartsData();
          if (fromParts) {
            const enriched = initialPreSearches.map(ps =>
              ps.searchData ? ps : { ...ps, searchData: fromParts },
            );
            state.setPreSearches(enriched);
          } else {
            state.setPreSearches(initialPreSearches);
          }
        } else {
          state.setPreSearches(initialPreSearches);
        }
      }
    }

    // STALE STATUS FIX: Normalize presearch entries stuck in STREAMING/PENDING.
    // When presearch completes during streaming, only the Zustand store is updated —
    // D1 may still have the old status. On navigate-back, the store was cleared but
    // the TQ cache (or D1) returns stale status, causing shimmer. If AI SDK message
    // parts contain completed presearch data, the presearch is definitively done.
    const hydratedPreSearches = state.preSearches;
    const hasStaleStatus = hydratedPreSearches.some(
      ps => ps.status === MessageStatuses.STREAMING || ps.status === MessageStatuses.PENDING,
    );
    if (hasStaleStatus && initialMessages.length > 0) {
      const presearchFromParts = extractPresearchDataFromMessageParts(initialMessages);
      if (presearchFromParts && presearchFromParts.results.length > 0) {
        const normalized = hydratedPreSearches.map(ps =>
          ps.status === MessageStatuses.STREAMING || ps.status === MessageStatuses.PENDING
            ? { ...ps, searchData: ps.searchData ?? presearchFromParts, status: MessageStatuses.COMPLETE as typeof ps.status }
            : ps,
        );
        state.setPreSearches(normalized);
      }
    }

    // Hydrate changelog if provided
    if (initialChangelog && initialChangelog.length > 0) {
      state.setChangelogItems(initialChangelog);
    }

    // Mark as loaded
    state.setHasInitiallyLoaded(true);
    state.setShowInitialUI(false);

    // NOTE: Do NOT set createdThreadId here. It was previously set for title
    // polling re-trigger on navigate-back, but it blocks the resume gate
    // (resume = effectiveThreadId !== createdThreadId). Title polling already
    // captures createdThreadId on initial creation (handleCreateThread) into
    // local state (pollingStartedForRef), so it continues independently of
    // the store field. On page refresh, title is fetched from D1 on next load.

    hasHydratedRef.current = true;
    threadIdRef.current = thread.id;
  }, [storeApi, options]);
}
