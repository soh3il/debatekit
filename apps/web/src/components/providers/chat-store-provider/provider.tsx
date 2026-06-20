/**
 * Chat Store Provider
 *
 * Creates SSR-isolated store, passes store directly to useDebateKitChat
 * (handler has direct store access — no callback ref chain).
 * Lifecycle callbacks (round complete, no active stream, error) are inlined here.
 */

import type { StreamPhase } from '@debatekit/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useExtractMemoryMutation, useRestoreMemoryMutation } from '@/hooks/mutations/project-mutations';
import { useDebateKitChat } from '@/hooks/streaming/use-debatekit-chat';
import { queryKeys } from '@/lib/data/keys';
import { threadBySlugQueryOptions } from '@/lib/data/keys/chat';
import { useShallow, useStore } from '@/lib/store';
import { showApiErrorToast } from '@/lib/toast';
import { getRoundNumberFromMetadata } from '@/lib/utils';
import { countEnabledParticipants } from '@/lib/utils/streaming-helpers';
import { createChatStore } from '@/stores/chat';
import { deriveWaitingToStartStreaming } from '@/stores/chat/selectors';
import { ROUND_UNINITIALIZED } from '@/stores/chat/store-schemas';

import { ChatStoreContext } from './context';
import {
  useNavigationCleanup,
  useTitleAnimationController,
  useTitlePolling,
} from './hooks';
import { useRoundTrigger } from './hooks/use-round-trigger';
import type { MemoryNotification } from './memory-notification-context';
import { MemoryNotificationContext } from './memory-notification-context';
import type { ChatStoreProviderProps } from './types';

/** Extract thread slug from a chat pathname, or null if not on a thread page. */
function extractSlugFromPathname(pathname: string): string | null {
  const chatMatch = pathname.match(/^\/chat\/([^/]+)$/);
  const projectMatch = pathname.match(/^\/chat\/projects\/[^/]+\/([^/]+)$/);
  const slug = chatMatch?.[1] ?? projectMatch?.[1] ?? null;

  if (!slug || slug === 'projects' || slug === 'billing') {
    return null;
  }

  return slug;
}

// Factory pattern ensures SSR isolation - each request gets fresh store.
export function ChatStoreProvider({ children, initialState }: ChatStoreProviderProps) {
  const queryClient = useQueryClient();

  const [store] = useState(() => createChatStore(initialState));

  const prevPathnameRef = useRef<string | null>(null);
  const queryClientRef = useRef(queryClient);
  const postInFlightRef = useRef(false);
  const isResumeInProgressRef = useRef(false);

  const lastEffectiveThreadIdRef = useRef<string | null>(null);
  const roundNumberBySlugRef = useRef<Map<string, number>>(new Map());

  const { createdThreadId, thread } = useStore(store, useShallow(s => ({
    createdThreadId: s.createdThreadId,
    thread: s.thread,
  })));

  const { currentRoundNumber, phase } = useStore(store, useShallow(s => ({
    currentRoundNumber: s.currentRoundNumber,
    phase: s.phase,
  })));

  const { enableWebSearch, participants } = useStore(store, useShallow(s => ({
    enableWebSearch: s.enableWebSearch,
    participants: s.participants,
  })));

  const pendingMessage = useStore(store, s => s.pendingMessage);

  const waitingToStartStreaming = deriveWaitingToStartStreaming(phase, pendingMessage);

  const { pathname } = useLocation();
  const slug = useMemo(() => extractSlugFromPathname(pathname), [pathname]);

  const prevSlugRef = useRef(slug);
  // Track threadId by slug so navigate-back can restore effectiveThreadId immediately
  // without waiting for TQ refetch. Only clear lastEffectiveThreadIdRef when navigating
  // to a genuinely NEW slug (not returning to a previously-seen one).
  const threadIdBySlugRef = useRef<Map<string, string>>(new Map());
  if (prevSlugRef.current !== slug) {
    prevSlugRef.current = slug;
    // Preserve lastEffectiveThreadIdRef for navigate-back: check if we've seen this slug before
    if (slug && threadIdBySlugRef.current.has(slug)) {
      lastEffectiveThreadIdRef.current = threadIdBySlugRef.current.get(slug) ?? null;
    } else {
      lastEffectiveThreadIdRef.current = null;
    }
  }

  const cachedThreadId = useMemo(() => {
    if (!slug) {
      return null;
    }

    const options = threadBySlugQueryOptions(slug);
    const cached = queryClient.getQueryData(options.queryKey);
    const threadId = cached?.success ? cached.data?.thread?.id : null;

    return threadId ?? null;
  }, [slug, queryClient]);

  const cachedRoundNumber = useMemo(() => {
    if (!slug) {
      return null;
    }

    const options = threadBySlugQueryOptions(slug);
    const cached = queryClient.getQueryData(options.queryKey);
    if (!cached?.success || !cached.data?.messages?.length) {
      return null;
    }

    const messages = cached.data.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && typeof msg === 'object' && 'role' in msg && msg.role === 'user') {
        return getRoundNumberFromMetadata(msg);
      }
    }

    return null;
  }, [slug, queryClient]);

  const effectiveThreadId = useMemo(() => {
    const resolved = cachedThreadId || thread?.id || createdThreadId || null;

    if (resolved) {
      lastEffectiveThreadIdRef.current = resolved;
      // Cache threadId by slug for navigate-back resume
      if (slug) {
        threadIdBySlugRef.current.set(slug, resolved);
      }
      return resolved;
    }

    if (slug && lastEffectiveThreadIdRef.current) {
      return lastEffectiveThreadIdRef.current;
    }

    lastEffectiveThreadIdRef.current = null;
    return null;
  }, [cachedThreadId, thread?.id, createdThreadId, slug]);

  const enabledParticipantCount = useMemo(
    () => countEnabledParticipants(participants),
    [participants],
  );

  const pendingAttachmentIds = useStore(store, s => s.pendingAttachmentIds);

  const resolvedRoundNumber = useMemo(() => {
    if (currentRoundNumber !== null && currentRoundNumber !== ROUND_UNINITIALIZED) {
      if (slug) {
        roundNumberBySlugRef.current.set(slug, currentRoundNumber);
      }
      return currentRoundNumber;
    }

    // RESUME FIX: Check slug ref BEFORE TQ cache. The ref survives cache invalidation
    // and store resets, making it more reliable during the navigate-back critical window.
    if (slug) {
      const savedRound = roundNumberBySlugRef.current.get(slug);
      if (savedRound !== undefined) {
        return savedRound;
      }
    }

    if (cachedRoundNumber !== null) {
      if (slug) {
        roundNumberBySlugRef.current.set(slug, cachedRoundNumber);
      }
      return cachedRoundNumber;
    }

    return 0;
  }, [currentRoundNumber, cachedRoundNumber, slug]);

  // ============================================================================
  // LIFECYCLE CALLBACKS (inlined from use-round-lifecycle.ts)
  // ============================================================================

  /** Invalidate caches after a round completes */
  const invalidatePostRoundCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.usage.stats() });
    const threadSlug = store.getState().thread?.slug;
    if (threadSlug) {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.bySlug(threadSlug) });
    }
    const threadId = store.getState().thread?.id;
    if (threadId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId) });
    }
  }, [queryClient, store]);

  const handleRoundComplete = useCallback((completedPhases?: StreamPhase[]) => {
    const state = store.getState();

    if (!state.thread) {
      return;
    }

    const roundNumber = state.currentRoundNumber !== null && state.currentRoundNumber >= 0 ? state.currentRoundNumber : 0;
    const capturedThreadId = state.thread?.id;
    const storePhase = state.phase;

    // ALREADY-COMPLETE PATH: A faster transition (onModeratorComplete, single-participant
    // skip, or completeStreaming) may set COMPLETE before data-round-complete arrives.
    // The early-return below would then swallow the post-round cleanup (cache invalidation
    // + prepareForNewMessage) for essentially every live round — stale usage counters and
    // thread list/detail. Run finalization here, guarded by thread id + round, so the
    // finished round still resets state and refreshes caches regardless of which
    // transition won the race.
    if (storePhase === 'complete') {
      requestAnimationFrame(() => {
        const postState = store.getState();
        if (postState.currentRoundNumber === roundNumber && postState.thread?.id === capturedThreadId) {
          postState.prepareForNewMessage();
          invalidatePostRoundCaches();
        }
      });
      return;
    }

    // CROSS-THREAD GUARD: Only finalize when store is actually streaming
    if (storePhase !== 'participants' && storePhase !== 'moderator' && storePhase !== 'presearch') {
      return;
    }

    // Detect moderator failure from completedPhases
    const participantCount = state.activeRoundParticipantCount;
    const moderatorExpected = participantCount >= 2;
    const moderatorCompleted = completedPhases?.includes('moderator') ?? false;

    if (moderatorExpected && !moderatorCompleted) {
      showApiErrorToast('Moderator synthesis failed', new Error('The moderator could not generate a summary. Your participant responses are preserved.'));

      store.getState().completeStreaming();

      requestAnimationFrame(() => {
        const postModFailState = store.getState();
        if (postModFailState.currentRoundNumber === roundNumber && postModFailState.thread?.id === capturedThreadId) {
          postModFailState.prepareForNewMessage();
          invalidatePostRoundCaches();
        }
      });
      return;
    }

    // Normal completion
    // BUG C3/C4: completeStreaming() now verifies streamingThreadId internally,
    // rejecting zombie calls from a previous thread. capturedThreadId is captured
    // BEFORE completeStreaming() runs, so the rAF guard below also catches
    // cross-thread contamination if partial init raced with this callback.
    store.getState().completeStreaming();

    requestAnimationFrame(() => {
      const postCompleteState = store.getState();
      if (postCompleteState.currentRoundNumber === roundNumber && postCompleteState.thread?.id === capturedThreadId) {
        postCompleteState.prepareForNewMessage();
        invalidatePostRoundCaches();
      }
    });
  }, [invalidatePostRoundCaches, store]);

  const handleStreamError = useCallback((streamPhase: StreamPhase, error: string) => {
    const state = store.getState();

    if (!state.thread) {
      return;
    }

    showApiErrorToast(`Stream error (${streamPhase})`, new Error(error));
  }, [store]);

  const handleNoActiveStream = useCallback(() => {
    const state = store.getState();

    if (!state.thread) {
      return;
    }

    if (state.phase === 'idle') {
      // RESUME FIX: Skip state reset when a resume GET is still in-flight.
      // The resume hook detects 204 via SUBMITTED→READY transition, which is
      // authoritative. The timeout fallback (5s) is skipped during resume,
      // but this guard provides defense-in-depth against any edge case where
      // onNoActiveStream fires while the resume GET hasn't received data yet.
      if (isResumeInProgressRef.current) {
        return;
      }

      // When resume GET returns 204 from IDLE, the round completed on the backend
      // while the user was away. D1 should have complete messages, but the TQ cache
      // might be stale (cached before backend wrote completions). Invalidate to
      // force a refetch so initialMessages picks up complete data from D1.
      if (state.hasInitiallyLoaded && state.currentRoundNumber !== null && state.currentRoundNumber >= 0 && !state.pendingMessage) {
        const threadSlug = state.thread?.slug;
        if (threadSlug) {
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.bySlug(threadSlug) });
        }
        state.prepareForNewMessage();
      }
      return;
    }

    // BUG 2 FIX: Don't reset when there's a pending message about to trigger
    // a new round. This prevents the 204 handler from clearing state set by
    // handleUpdateThreadAndSend for round 2+.
    // Only guard in COMPLETE phase (pre-startRound, message queued but not yet triggered).
    // In PRESEARCH/PARTICIPANTS/MODERATOR (post-startRound), the pending message already
    // triggered and the stream failed with zero data parts — allow 204 recovery to
    // prevent permanent stuck state.
    if (state.pendingMessage && state.phase === 'complete') {
      return;
    }

    // Capture thread identity before any mutations so we can verify
    // the user hasn't navigated to a different thread between the
    // hook detecting 204 and this callback executing.
    const threadId = state.thread.id;

    if (state.phase !== 'complete') {
      state.completeStreaming();
    }

    // Normalize stale presearch entries after 204 (no active stream).
    // completeStreaming() normalizes presearches internally, but the guard
    // above skips it when phase is already 'complete'. Any STREAMING/PENDING
    // presearches at this point are definitively stale since the server
    // confirmed no active stream via 204.
    const postCompleteState = store.getState();
    const hasStalePreSearches = postCompleteState.preSearches.some(
      ps => ps.status === 'streaming' || ps.status === 'pending',
    );
    if (hasStalePreSearches) {
      for (const ps of postCompleteState.preSearches) {
        if (ps.status === 'streaming' || ps.status === 'pending') {
          postCompleteState.updatePreSearchStatus(ps.roundNumber, 'complete');
        }
      }
    }

    // Re-read state after completeStreaming -- if thread changed during
    // that call (or between detection and now), skip prepareForNewMessage
    // to avoid resetting the wrong thread's state.
    const freshState = store.getState();
    if (freshState.thread?.id === threadId) {
      freshState.prepareForNewMessage();
    }
  }, [queryClient, store]);

  // ============================================================================
  // STREAMING HOOK — direct store access
  // ============================================================================

  const {
    isResumeInProgress,
    startRound,
  } = useDebateKitChat({
    attachmentIds: pendingAttachmentIds,
    onError: handleStreamError,
    onNoActiveStream: handleNoActiveStream,
    onRoundComplete: handleRoundComplete,
    participantCount: enabledParticipantCount,
    resume: effectiveThreadId !== createdThreadId && !postInFlightRef.current,
    roundNumber: resolvedRoundNumber,
    store,
    threadId: effectiveThreadId ?? '',
  });

  // Sync resume-in-progress to ref so handleNoActiveStream callback can read it.
  // The callback is defined before useDebateKitChat (useCallback ordering), so
  // it reads the ref at call time rather than capturing the value at definition time.
  isResumeInProgressRef.current = isResumeInProgress;

  // Sync resume-in-progress to store so UI can show streaming placeholders
  // during the gap between navigate-back and resume SSE data arrival.
  useEffect(() => {
    store.getState().setIsResumeInProgress(isResumeInProgress);
  }, [isResumeInProgress, store]);

  useRoundTrigger({
    effectiveThreadId,
    enableWebSearch,
    postInFlightRef,
    store,
    unifiedStartRound: startRound,
    waitingToStartStreaming,
  });

  // ============================================================================
  // MEMORY AUTO-EXTRACTION (fire-and-forget on user message in project context)
  // ============================================================================

  const projectId = useStore(store, s => s.createdThreadProjectId ?? s.thread?.projectId ?? null);
  const extractMemory = useExtractMemoryMutation(projectId ?? '');
  const restoreMemory = useRestoreMemoryMutation(projectId ?? '');
  const lastExtractedMessageRef = useRef<string | null>(null);

  const [memoryNotification, setMemoryNotification] = useState<MemoryNotification | null>(null);

  useEffect(() => {
    if (!projectId || !pendingMessage || !waitingToStartStreaming) {
      return;
    }
    // Deduplicate: don't re-extract for the same message
    if (lastExtractedMessageRef.current === pendingMessage) {
      return;
    }
    lastExtractedMessageRef.current = pendingMessage;

    // Clear stale notification from previous message before extracting new one
    setMemoryNotification(null);

    extractMemory.mutate(pendingMessage, {
      onSuccess: (data) => {
        if (data.success && data.data?.extracted && data.data.summary) {
          setMemoryNotification({
            previousContent: data.data.previousContent ?? null,
            summary: data.data.summary,
          });
        }
      },
    });
  }, [projectId, pendingMessage, waitingToStartStreaming, extractMemory]);

  const dismissMemoryNotification = useCallback(() => {
    setMemoryNotification(null);
  }, []);

  const undoMemoryExtraction = useCallback(() => {
    if (!memoryNotification) {
      return;
    }
    restoreMemory.mutate(memoryNotification.previousContent);
    setMemoryNotification(null);
  }, [memoryNotification, restoreMemory]);

  const memoryNotificationValue = useMemo(() => ({
    dismiss: dismissMemoryNotification,
    notification: memoryNotification,
    undo: undoMemoryExtraction,
  }), [dismissMemoryNotification, memoryNotification, undoMemoryExtraction]);

  useNavigationCleanup({
    prevPathnameRef,
    queryClient,
    store,
  });

  useTitlePolling({ queryClientRef, store });
  useTitleAnimationController({ store });

  return (
    <MemoryNotificationContext value={memoryNotificationValue}>
      <ChatStoreContext value={store}>
        {children}
      </ChatStoreContext>
    </MemoryNotificationContext>
  );
}
