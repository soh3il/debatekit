/**
 * DebateKit Chat Hook
 *
 * Thin wrapper over @ai-sdk-tools/store that:
 * - Uses @ai-sdk-tools/store's useChat for message management + resume
 * - Store phase is the single source of truth (no hook-level phase tracking)
 * - Handler has direct store access (no callback ref chain)
 *
 * Components access messages via @ai-sdk-tools/store hooks (useMessageIds, useMessageById).
 *
 * @module hooks/streaming/use-debatekit-chat
 */

import { useChat } from '@ai-sdk-tools/store';
import type { StreamPhase } from '@debatekit/shared';
import {
  AiSdkStatuses,
  MessageStatuses,
  StreamPhases,
  unifiedDataPartSchemas,
  UnifiedMessageMetadataSchema,
} from '@debatekit/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStreamTransport } from '@/hooks/streaming/config/stream-transport';
import type { DataPart } from '@/hooks/streaming/handlers/handle-data-part';
import { createDataPartHandler, isDataPart, storeRound } from '@/hooks/streaming/handlers/handle-data-part';
import { useLatestRef } from '@/hooks/utils/use-latest-ref';
import type { ExtendedFilePart } from '@/lib/schemas';
import { useStore } from '@/lib/store';
import { clearSplitCache } from '@/lib/utils/split-unified-stream-messages';
import type { ChatStoreApi } from '@/stores/chat';
import { ChatPhases } from '@/stores/chat';

// TYPES

export type { DataPart };

export type UseDebateKitChatOptions = {
  /** Attachment IDs for file uploads */
  attachmentIds?: string[] | null;
  /** Number of enabled participants */
  participantCount: number;
  /** Enable automatic stream resumption (default: true) */
  resume?: boolean;
  /** Current round number (0-indexed) */
  roundNumber: number;
  /** Zustand store for direct state access */
  store: ChatStoreApi;
  /** Thread ID */
  threadId: string;

  // Remaining lifecycle callbacks (provider-level)
  onError?: (phase: StreamPhase, error: string, participantIndex?: number) => void;
  onNoActiveStream?: () => void;
  onRoundComplete?: (completedPhases?: StreamPhase[]) => void;
};

export type UseDebateKitChatReturn = {
  currentParticipantIndex: number | null;
  error: Error | null;
  isResumeInProgress: boolean;
  isStreaming: boolean;
  startRound: (userMessage: string, overrideRoundNumber?: number, fileParts?: ExtendedFilePart[] | null) => Promise<void>;
  status: 'idle' | 'streaming' | 'complete' | 'error';
  stop: () => void;
};

// HELPERS

/** Map store ChatPhase to StreamPhase for error/lifecycle callbacks */
function toStreamPhase(chatPhase: string): StreamPhase {
  if (chatPhase === ChatPhases.PRESEARCH) {
    return StreamPhases.PRESEARCH;
  }
  if (chatPhase === ChatPhases.MODERATOR) {
    return StreamPhases.MODERATOR;
  }
  return StreamPhases.PARTICIPANT;
}

// HOOK

export function useDebateKitChat(
  options: UseDebateKitChatOptions,
): UseDebateKitChatReturn {
  const {
    attachmentIds,
    onError,
    onNoActiveStream,
    onRoundComplete,
    resume: externalResume = true,
    roundNumber,
    store,
    threadId,
  } = options;

  // Store phase (reactive subscription for status derivation)
  const storePhase = useStore(store, s => s.phase);

  // LOCAL STATE
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState<number | null>(null);
  const [streamError, setStreamError] = useState<Error | null>(null);

  // REFS
  const currentParticipantRef = useRef<{ id: string; index: number } | null>(null);
  const currentThreadIdRef = useRef<string | null>(threadId || null);
  currentThreadIdRef.current = threadId || null;
  const dispatchedCompletionsRef = useRef<Set<string>>(new Set());
  const hasFatalErrorRef = useRef(false);
  const roundCompleteDispatchedRef = useRef(false);
  const resumeInitiatedRef = useRef<string | null>(null);
  // Track threadId changes for deferred resume guard (prevents layout-effect re-render blocking)
  const prevResumeThreadRef = useRef<string | null>(null);
  const sendMessageLockRef = useRef(false);
  const startedRoundRef = useRef<number | null>(null);

  // CALLBACK REFS (only 3 remaining — lifecycle callbacks from provider)
  const onErrorRef = useLatestRef(onError);
  const onNoActiveStreamRef = useLatestRef(onNoActiveStream);
  const onRoundCompleteRef = useLatestRef(onRoundComplete);

  // Track whether data parts arrived during a resume cycle (for 204 detection)
  const dataPartsReceivedRef = useRef(false);
  const prevChatStatusRef = useRef<string | null>(null);
  // Timeout fallback: fire onNoActiveStream if status stays SUBMITTED for too long
  const noActiveStreamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which thread entered SUBMITTED state for cross-thread 204 detection guard
  const submittedForThreadRef = useRef<string | null>(null);

  // Prop refs
  const attachmentIdsRef = useLatestRef(attachmentIds ?? null);
  const participantCountRef = useLatestRef(options.participantCount);
  const roundNumberRef = useLatestRef(roundNumber);

  // STREAM TRANSPORT
  const { apiEndpoint, apiEndpointRef, chatId, transport } = useStreamTransport({
    attachmentIdsRef,
    roundNumber,
    threadId,
  });

  const isStreamEnabled = Boolean(threadId && apiEndpoint);
  const isStreamEnabledRef = useLatestRef(isStreamEnabled);

  // Stable chatId: preserve across stream disable/enable
  const lastRealChatIdRef = useRef<string | null>(null);
  if (chatId && chatId !== 'unified_') {
    lastRealChatIdRef.current = chatId;
  }
  const stableChatId = lastRealChatIdRef.current ?? 'unified-stream-disabled-placeholder';

  // DATA PART HANDLER — direct store access, store phase is sole source of truth
  const handleDataPart = useMemo(() => createDataPartHandler({
    currentParticipantRef,
    currentThreadIdRef,
    dispatchedCompletionsRef,
    expectedThreadId: threadId,
    onErrorRef,
    onRoundCompleteRef,
    roundCompleteDispatchedRef,
    setCurrentParticipantIndex,
    setStreamError,
    store,
  }), [threadId, store]); // eslint-disable-line react-hooks/exhaustive-deps -- refs are stable

  // Refs for useChat inline callbacks
  const handleDataPartRef = useRef(handleDataPart);
  handleDataPartRef.current = handleDataPart;

  // Infer which phases completed and dispatch round-complete.
  const inferAndDispatchRoundComplete = useCallback(
    () => {
      const phase = store.getState().phase;
      if (phase === ChatPhases.COMPLETE || roundCompleteDispatchedRef.current) {
        return;
      }

      // Derive the round from the store's currentRoundNumber (the single canonical
      // source the handler also dedups on) so these keys are byte-identical to the
      // handler's. Mixing a prop/ref round with the store-derived round would let
      // dedup checks miss and double-count participants/moderator.
      const effectiveRound = storeRound(store);
      const inferredPhases: StreamPhase[] = [];
      const dispatched = dispatchedCompletionsRef.current;
      const pCount = participantCountRef.current;

      let dispatchedParticipants = 0;
      for (const key of dispatched) {
        if (key.startsWith(`r${effectiveRound}:p`)) {
          dispatchedParticipants++;
        }
      }
      if (dispatchedParticipants >= pCount) {
        inferredPhases.push(StreamPhases.PARTICIPANT);
      }
      if (dispatched.has(`r${effectiveRound}:moderator`)) {
        inferredPhases.push(StreamPhases.MODERATOR);
      }

      roundCompleteDispatchedRef.current = true;
      onRoundCompleteRef.current?.(inferredPhases);
    },
    [roundNumber, store], // eslint-disable-line react-hooks/exhaustive-deps -- refs are stable
  );

  const inferAndDispatchRoundCompleteRef = useRef(inferAndDispatchRoundComplete);
  inferAndDispatchRoundCompleteRef.current = inferAndDispatchRoundComplete;

  // RESUME GATE: Prevent double-fire while allowing navigate-back resume.
  //
  // Problem: AI SDK's useChat resume useEffect has no cleanup, so Strict Mode
  // double-fires resumeStream() causing concurrent makeRequest() races.
  // Original fix: set resumeInitiatedRef during render (sync) to block the 2nd call.
  //
  // But that breaks navigate-back: layout effects (navigation cleanup) trigger a
  // synchronous re-render. If the ref was set in Render 1, Render 2 computes
  // shouldResume=false, and effects fire with resume=false — resume never happens.
  //
  // Fix: Detect fresh thread changes and DEFER ref setting for one render cycle.
  // On the first render after threadId changes, don't set the ref — let layout
  // effects settle. On the subsequent render (same threadId), set the ref normally
  // to prevent Strict Mode double-fire on future mounts.
  const threadIdJustChanged = (threadId || null) !== prevResumeThreadRef.current;
  prevResumeThreadRef.current = threadId || null;

  const shouldResume = externalResume && isStreamEnabled && !streamError && resumeInitiatedRef.current !== threadId;
  if (shouldResume && threadId && !threadIdJustChanged) {
    resumeInitiatedRef.current = threadId;
  }

  // AI SDK CHAT via @ai-sdk-tools/store
  const {
    error: chatError,
    sendMessage,
    status: chatStatus,
    stop: stopChat,
  } = useChat({
    dataPartSchemas: unifiedDataPartSchemas,
    enableBatching: true,
    id: stableChatId,
    messageMetadataSchema: UnifiedMessageMetadataSchema,
    onData: (dataPart) => {
      // BUG M5 fix: Clear stale dedup keys on first data part of a resume cycle.
      // During resume, startRound() is never called so its clear() never runs.
      // The thread-change effect may fire AFTER data arrives (effects are async),
      // so we eagerly clear here to prevent stale keys from suppressing completions.
      if (!dataPartsReceivedRef.current) {
        dispatchedCompletionsRef.current.clear();
        roundCompleteDispatchedRef.current = false;
      }
      dataPartsReceivedRef.current = true;

      // BUG H5 fix: Set startedRoundRef during resume when we receive
      // a START event. During resume, startRound() is never called so
      // startedRoundRef stays null, causing onFinish to use a potentially
      // stale roundNumber prop as fallback.
      if (
        startedRoundRef.current === null
        && isDataPart(dataPart)
        && dataPart.type === 'data-phase'
        && dataPart.data.status === 'start'
      ) {
        startedRoundRef.current = roundNumberRef.current;
      }

      if (!isStreamEnabledRef.current) {
        if (isDataPart(dataPart) && dataPart.type === 'data-phase') {
          handleDataPartRef.current(dataPart);
        }
        return;
      }
      if (isDataPart(dataPart)) {
        handleDataPartRef.current(dataPart);
      }
    },
    onError: (err) => {
      if (!currentThreadIdRef.current) {
        return;
      }
      if (!isStreamEnabledRef.current) {
        return;
      }

      const currentStorePhase = store.getState().phase;

      if (err.message.includes('ROUND_MISMATCH')) {
        startedRoundRef.current = null;
        store.getState().resetToIdle();
        onErrorRef.current?.(toStreamPhase(currentStorePhase), 'ROUND_MISMATCH');
        return;
      }

      const isFatalError = err.message.includes('404')
        || err.message.includes('500')
        || err.message.includes('Not Found')
        || err.message.includes('Internal Server Error');

      if (isFatalError) {
        hasFatalErrorRef.current = true;
        store.getState().resetToIdle();
        onNoActiveStreamRef.current?.();
      }

      setStreamError(err);
      onErrorRef.current?.(toStreamPhase(currentStorePhase), err.message);
    },
    onFinish: ({ isAbort, isDisconnect, isError }) => {
      if (!isStreamEnabledRef.current || hasFatalErrorRef.current) {
        return;
      }

      const currentStorePhase = store.getState().phase;
      if (currentStorePhase === ChatPhases.IDLE) {
        return;
      }

      // Guard: 204 no-active-stream fires onFinish with empty flags but no data.
      // The 204 detection effect (chatStatus) handles this case separately.
      if (!dataPartsReceivedRef.current) {
        return;
      }

      // Handle server errors (500, stream timeout) that are not abort/disconnect.
      // Set local error state so the UI reflects the failure, then still
      // force-complete the round below so it doesn't hang in an intermediate phase.
      if (isError && !isAbort && !isDisconnect) {
        setStreamError(prev => prev ?? new Error('Stream ended with a server error'));
        onErrorRef.current?.(toStreamPhase(currentStorePhase), 'Stream ended with a server error');
      }

      // Derive the round from the store's currentRoundNumber so force-complete dedup
      // keys are byte-identical to the handler's (which uses storeRound). Using the
      // prop/ref round here could diverge during resume/navigate-back and re-count.
      const effectiveRound = storeRound(store);

      // Force-complete active participant when stream closes mid-participant
      if (currentParticipantRef.current !== null) {
        const activeIdx = currentParticipantRef.current.index;
        if (!isAbort) {
          const dedupKey = `r${effectiveRound}:p${activeIdx}`;
          if (!dispatchedCompletionsRef.current.has(dedupKey)) {
            dispatchedCompletionsRef.current.add(dedupKey);
            if (store.getState().thread) {
              store.getState().incrementCompletedParticipants();
              const freshState = store.getState();
              if (freshState.phase !== ChatPhases.COMPLETE) {
                freshState.onParticipantComplete(activeIdx);
              }
            }
          }
        }
        currentParticipantRef.current = null;
      }

      // Force-complete moderator when stream closes mid-moderator
      if (!isAbort && store.getState().phase === ChatPhases.MODERATOR) {
        const modDedupKey = `r${effectiveRound}:moderator`;
        if (!dispatchedCompletionsRef.current.has(modDedupKey)) {
          dispatchedCompletionsRef.current.add(modDedupKey);
          if (store.getState().thread) {
            store.getState().onModeratorComplete();
          }
        }
      }

      // Force-complete presearch when stream closes during PRESEARCH phase.
      // Without this, the store gets permanently stuck in PRESEARCH if the
      // stream ends before a presearch-complete event is received.
      if (!isAbort) {
        const currentState = store.getState();
        if (currentState.phase === ChatPhases.PRESEARCH) {
          const roundNum = effectiveRound;
          currentState.updatePreSearchStatus(roundNum, MessageStatuses.COMPLETE);
          currentState.transitionToParticipants();
          // Early return: presearch force-complete transitions to PARTICIPANTS,
          // not COMPLETE. Falling through to inferAndDispatchRoundComplete()
          // would dispatch a misleading round-complete with 0 participants.
          return;
        }
      }

      if (!isAbort) {
        // disconnect OR clean end without a round-complete event: force-complete the round.
        inferAndDispatchRoundCompleteRef.current();
      }

      // BUG 2 FIX: Mark resume as initiated after successful stream completion.
      // Without this, when prepareForNewMessage() clears createdThreadId after
      // round 0 on a new thread, resume becomes true (effectiveThreadId !== null)
      // but resumeInitiatedRef is null (initial resume was blocked by createdThreadId),
      // causing a spurious resume GET that returns 204.
      // Page refresh still works because fresh component = fresh refs (null).
      if (currentThreadIdRef.current) {
        resumeInitiatedRef.current = currentThreadIdRef.current;
      }
    },
    resume: shouldResume,
    transport,
  });

  // 204 DETECTION: resume GET returned no active stream
  const NO_ACTIVE_STREAM_TIMEOUT_MS = 5_000;

  useEffect(() => {
    const prev = prevChatStatusRef.current;
    prevChatStatusRef.current = chatStatus;

    // Normal 204 detection: submitted→ready without data parts
    if (
      prev === AiSdkStatuses.SUBMITTED
      && chatStatus === AiSdkStatuses.READY
      && !dataPartsReceivedRef.current
      && submittedForThreadRef.current === currentThreadIdRef.current
    ) {
      if (noActiveStreamTimeoutRef.current !== null) {
        clearTimeout(noActiveStreamTimeoutRef.current);
        noActiveStreamTimeoutRef.current = null;
      }
      onNoActiveStreamRef.current?.();
    }

    // Clear timeout when data parts arrive or status transitions to streaming
    if (chatStatus === AiSdkStatuses.STREAMING || dataPartsReceivedRef.current) {
      if (noActiveStreamTimeoutRef.current !== null) {
        clearTimeout(noActiveStreamTimeoutRef.current);
        noActiveStreamTimeoutRef.current = null;
      }
    }

    // Start timeout when entering SUBMITTED state
    if (chatStatus === AiSdkStatuses.SUBMITTED) {
      dataPartsReceivedRef.current = false;
      submittedForThreadRef.current = currentThreadIdRef.current;

      if (noActiveStreamTimeoutRef.current !== null) {
        clearTimeout(noActiveStreamTimeoutRef.current);
      }

      // RESUME FIX: Skip fallback timeout during resume GET cycles.
      // During resume, startRound() is never called so startedRoundRef stays null.
      // The SUBMITTED→READY transition (above) still handles legitimate 204s.
      // The timeout fallback is for sendMessage POST edge cases where status gets
      // stuck in SUBMITTED. Resume GETs rely on the backend's 45s defense-in-depth
      // timeout for hung connections. Without this guard, the 5s timeout fires
      // prematurely during resume (backend needs time for D1 lookup + Redis
      // reconnect), calling onNoActiveStream which disrupts the resume flow by
      // resetting state and invalidating caches.
      const isResumeCycle = startedRoundRef.current === null;
      if (isResumeCycle) {
        noActiveStreamTimeoutRef.current = null;
      } else {
        const capturedThreadId = currentThreadIdRef.current;
        noActiveStreamTimeoutRef.current = setTimeout(() => {
          noActiveStreamTimeoutRef.current = null;
          if (
            prevChatStatusRef.current === AiSdkStatuses.SUBMITTED
            && !dataPartsReceivedRef.current
            && currentThreadIdRef.current === capturedThreadId
          ) {
            onNoActiveStreamRef.current?.();
          }
        }, NO_ACTIVE_STREAM_TIMEOUT_MS);
      }
    }

    // Clear timeout when status leaves SUBMITTED
    if (prev === AiSdkStatuses.SUBMITTED && chatStatus !== AiSdkStatuses.SUBMITTED) {
      if (noActiveStreamTimeoutRef.current !== null) {
        clearTimeout(noActiveStreamTimeoutRef.current);
        noActiveStreamTimeoutRef.current = null;
      }
    }

    return () => {
      if (noActiveStreamTimeoutRef.current !== null) {
        clearTimeout(noActiveStreamTimeoutRef.current);
        noActiveStreamTimeoutRef.current = null;
      }
    };
  }, [chatStatus]); // eslint-disable-line react-hooks/exhaustive-deps -- onNoActiveStreamRef is a stable ref

  // THREAD CHANGE RESET
  const prevThreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentTid = threadId || null;
    const prevTid = prevThreadIdRef.current;

    if (prevTid === null) {
      if (currentTid) {
        prevThreadIdRef.current = currentTid;
        // RESUME FIX: Reset resumeInitiatedRef when threadId transitions null→value.
        // Without this, a stale resumeInitiatedRef from a previous thread blocks
        // resume for the new/returning thread. The different-thread branch (below)
        // handles prevTid→currentTid, but this null→value path was missing the reset.
        resumeInitiatedRef.current = null;
        dataPartsReceivedRef.current = false;
      }
      return;
    }

    // When threadId becomes falsy: reset ALL local refs
    if (!currentTid) {
      prevThreadIdRef.current = null;
      currentParticipantRef.current = null;
      hasFatalErrorRef.current = false;
      dataPartsReceivedRef.current = false;
      dispatchedCompletionsRef.current.clear();
      resumeInitiatedRef.current = null;
      roundCompleteDispatchedRef.current = false;
      startedRoundRef.current = null;
      sendMessageLockRef.current = false;
      submittedForThreadRef.current = null;
      if (noActiveStreamTimeoutRef.current !== null) {
        clearTimeout(noActiveStreamTimeoutRef.current);
        noActiveStreamTimeoutRef.current = null;
      }
      return;
    }

    if (prevTid === currentTid) {
      // Same-thread re-entry: reset stale refs
      dataPartsReceivedRef.current = false;
      hasFatalErrorRef.current = false;
      resumeInitiatedRef.current = null;
      currentParticipantRef.current = null;
      sendMessageLockRef.current = false;
      if (noActiveStreamTimeoutRef.current !== null) {
        clearTimeout(noActiveStreamTimeoutRef.current);
        noActiveStreamTimeoutRef.current = null;
      }
      dispatchedCompletionsRef.current.clear();
      roundCompleteDispatchedRef.current = false;

      if (store.getState().phase === ChatPhases.COMPLETE) {
        startedRoundRef.current = null;
        setStreamError(null);
      }
      return;
    }

    // Different thread - reset state
    prevThreadIdRef.current = currentTid;
    currentParticipantRef.current = null;
    hasFatalErrorRef.current = false;
    dataPartsReceivedRef.current = false;
    dispatchedCompletionsRef.current.clear();
    resumeInitiatedRef.current = null;
    roundCompleteDispatchedRef.current = false;
    startedRoundRef.current = null;
    sendMessageLockRef.current = false;
    submittedForThreadRef.current = null;
    if (noActiveStreamTimeoutRef.current !== null) {
      clearTimeout(noActiveStreamTimeoutRef.current);
      noActiveStreamTimeoutRef.current = null;
    }

    // Clear stale split cache from previous thread to prevent misattributed
    // participant content on navigate-back. Navigation cleanup also clears it,
    // but this covers the race where the thread change effect fires first.
    clearSplitCache();

    setCurrentParticipantIndex(null);
    setStreamError(null);
  }, [threadId, store]);

  // START ROUND
  const startRound = useCallback(
    async (userMessage: string, overrideRoundNumber?: number, fileParts?: ExtendedFilePart[] | null) => {
      const effectiveRoundNumber = overrideRoundNumber ?? roundNumber;

      if (sendMessageLockRef.current) {
        return;
      }
      sendMessageLockRef.current = true;

      if (!threadId) {
        setStreamError(new Error('Missing threadId'));
        sendMessageLockRef.current = false;
        return;
      }

      // Block re-entry for completed round
      const currentStorePhase = store.getState().phase;
      const isNewRound = startedRoundRef.current !== null && effectiveRoundNumber > startedRoundRef.current;
      if (currentStorePhase === ChatPhases.COMPLETE && !isNewRound) {
        sendMessageLockRef.current = false;
        return;
      }

      if (startedRoundRef.current === effectiveRoundNumber) {
        sendMessageLockRef.current = false;
        return;
      }
      startedRoundRef.current = effectiveRoundNumber;

      if (overrideRoundNumber !== undefined && overrideRoundNumber !== roundNumber) {
        apiEndpointRef.current = `/api/v1/chat/threads/${threadId}/rounds/${effectiveRoundNumber}/unified-stream`;
      }

      // Reset round state (refs only — store phase is managed by store actions)
      currentParticipantRef.current = null;
      hasFatalErrorRef.current = false;
      dispatchedCompletionsRef.current.clear();
      roundCompleteDispatchedRef.current = false;

      setCurrentParticipantIndex(null);
      setStreamError(null);

      try {
        await sendMessage({
          files: fileParts?.length ? fileParts : undefined,
          metadata: { role: 'user', roundNumber: effectiveRoundNumber },
          text: userMessage,
        });
      } catch (err) {
        startedRoundRef.current = null;
        setStreamError(err instanceof Error ? err : new Error(String(err)));
        throw err; // Propagate to useRoundTrigger for phase recovery
      } finally {
        sendMessageLockRef.current = false;
      }
    },
    [roundNumber, sendMessage, store, threadId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // STOP
  const stop = useCallback(() => {
    stopChat();
    store.getState().resetToIdle();
    currentParticipantRef.current = null;
    dispatchedCompletionsRef.current.clear();
    roundCompleteDispatchedRef.current = false;
    startedRoundRef.current = null;
    sendMessageLockRef.current = false;
    if (noActiveStreamTimeoutRef.current) {
      clearTimeout(noActiveStreamTimeoutRef.current);
      noActiveStreamTimeoutRef.current = null;
    }
  }, [stopChat, store]);

  // DERIVED STATE
  const isStreaming = chatStatus === AiSdkStatuses.STREAMING || chatStatus === AiSdkStatuses.SUBMITTED;
  const error = streamError || chatError || null;

  // RESUME IN-PROGRESS: true when a resume GET is in-flight (SUBMITTED without startRound).
  // Used by provider to guard handleNoActiveStream during resume cycles.
  const isResumeInProgress = (chatStatus === AiSdkStatuses.SUBMITTED || chatStatus === AiSdkStatuses.STREAMING)
    && startedRoundRef.current === null
    && !dataPartsReceivedRef.current;

  const status = useMemo(() => {
    if (error) {
      return 'error' as const;
    }
    if (isStreaming) {
      return 'streaming' as const;
    }
    if (storePhase === ChatPhases.COMPLETE) {
      return 'complete' as const;
    }
    return 'idle' as const;
  }, [error, isStreaming, storePhase]);

  return useMemo(
    () => ({
      currentParticipantIndex,
      error,
      isResumeInProgress,
      isStreaming,
      startRound,
      status,
      stop,
    }),
    [currentParticipantIndex, error, isResumeInProgress, isStreaming, startRound, status, stop],
  );
}
