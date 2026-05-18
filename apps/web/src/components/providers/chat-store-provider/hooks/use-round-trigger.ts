/** Round trigger lifecycle: reset refs on thread change, fire streaming trigger. */

import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { ExtendedFilePart } from '@/lib/schemas';
import { showApiErrorToast } from '@/lib/toast';
import { countEnabledParticipants } from '@/lib/utils/streaming-helpers';
import type { ChatStoreApi } from '@/stores/chat';
import { ChatPhases, deriveIsStreaming } from '@/stores/chat';
import { ROUND_UNINITIALIZED } from '@/stores/chat/store-schemas';
// Delay for subsequent rounds to let AI SDK's Chat instance finish cleanup between rounds
const SUBSEQUENT_ROUND_DELAY_MS = 300;

type UseRoundTriggerDeps = {
  effectiveThreadId: string | null;
  enableWebSearch: boolean;
  /** Optional external ref to share with provider for resume condition */
  postInFlightRef?: MutableRefObject<boolean>;
  store: ChatStoreApi;
  unifiedStartRound: (message: string, roundNumber?: number, fileParts?: ExtendedFilePart[] | null) => Promise<void>;
  waitingToStartStreaming: boolean;
};

type UseRoundTriggerReturn = {
  postInFlightRef: MutableRefObject<boolean>;
};

export function useRoundTrigger(deps: UseRoundTriggerDeps): UseRoundTriggerReturn {
  const {
    effectiveThreadId,
    enableWebSearch,
    store,
    unifiedStartRound,
    waitingToStartStreaming,
  } = deps;

  const hasTriggeredRef = useRef(false);
  const lastTriggerKeyRef = useRef<string | null>(null);
  const lastTriggeredThreadIdRef = useRef<string | null>(null);
  const internalPostInFlightRef = useRef(false);
  const postInFlightRef = deps.postInFlightRef ?? internalPostInFlightRef;

  useEffect(() => {
    // M2 FIX: When effectiveThreadId becomes null (navigated to overview/non-thread page),
    // reset lastTriggeredThreadIdRef so re-entry to the same thread triggers a full reset.
    // Without this, thread-a → overview → thread-a skips the reset because
    // effectiveThreadId still matches the stale lastTriggeredThreadIdRef.
    if (!effectiveThreadId) {
      lastTriggeredThreadIdRef.current = null;
      return;
    }

    if (effectiveThreadId !== lastTriggeredThreadIdRef.current) {
      hasTriggeredRef.current = false;
      lastTriggerKeyRef.current = null;
      lastTriggeredThreadIdRef.current = effectiveThreadId;

      // Reset post-in-flight to prevent stale state from old thread blocking new thread resume
      postInFlightRef.current = false;
    }
  }, [effectiveThreadId, store, postInFlightRef]);

  useEffect(() => {
    if (!waitingToStartStreaming) {
      return;
    }

    const freshState = store.getState();
    const roundNumber = freshState.currentRoundNumber !== null && freshState.currentRoundNumber >= 0 ? freshState.currentRoundNumber : 0;

    if (!effectiveThreadId || freshState.currentRoundNumber === null || freshState.currentRoundNumber === ROUND_UNINITIALIZED) {
      return;
    }

    const triggerKey = `${effectiveThreadId}_r${roundNumber}`;
    if (lastTriggerKeyRef.current === triggerKey && hasTriggeredRef.current) {
      return;
    }

    // Only block if actively streaming -- 'complete' phase is from previous round, not a duplicate
    const currentPhase = freshState.phase;

    if (currentPhase === ChatPhases.PARTICIPANTS || currentPhase === ChatPhases.MODERATOR || currentPhase === ChatPhases.PRESEARCH) {
      return;
    }

    // Use pendingMessage directly -- AI SDK manages messages
    const userMessageText = freshState.pendingMessage;
    if (!userMessageText) {
      return;
    }

    // Read pending file parts BEFORE marking as triggered -- consumed once per round
    const fileParts = freshState.pendingFileParts;
    // Clear immediately to prevent reuse on re-renders
    store.getState().setPendingFileParts(null);

    hasTriggeredRef.current = true;
    lastTriggerKeyRef.current = triggerKey;

    const freshParticipants = freshState.participants;
    const freshSelectedParticipants = freshState.selectedParticipants;
    const freshEnabledCount = countEnabledParticipants(freshParticipants);

    // Fall back to selectedParticipants when participants[] not yet populated from API
    const selectedCount = freshSelectedParticipants.length;
    const effectiveEnabledCount = freshEnabledCount > 0 ? freshEnabledCount : selectedCount;

    const enabledCount = effectiveEnabledCount;

    // Read enableWebSearch and dataSources from fresh store state to avoid stale closure
    const freshEnableWebSearch = freshState.enableWebSearch;
    const freshHasDataSources = (freshState.dataSources?.length ?? 0) > 0;

    // Phase transition happens inside startRound, making waitingToStartStreaming false
    try {
      store.getState().startRound(roundNumber, enabledCount, freshEnableWebSearch || freshHasDataSources);
    } catch (err) {
      showApiErrorToast('Failed to initialize round', err instanceof Error ? err : new Error(String(err)));
      store.getState().setPendingMessage(null);
      hasTriggeredRef.current = false;
      lastTriggerKeyRef.current = null;
      return;
    }

    // Stabilization delay for subsequent rounds -- AI SDK may still be cleaning up
    const triggerStream = async () => {
      // BUG 2 FIX: Set postInFlightRef BEFORE the delay to prevent resume GET
      // from firing during the 300ms stabilization window. Without this, the
      // provider's resume condition (!postInFlightRef.current) is true during
      // the delay, allowing a spurious GET that returns 204 and destroys the round.
      postInFlightRef.current = true;

      if (roundNumber > 0) {
        await new Promise(resolve => void setTimeout(resolve, SUBSEQUENT_ROUND_DELAY_MS));

        // Guard: If phase reverted to a non-streaming state during the delay, it means
        // something external (navigation cleanup, error) cancelled the round.
        // BUT: startRound() already transitioned phase to PARTICIPANTS/PRESEARCH above,
        // so IDLE means explicit cancellation. COMPLETE means prior round's state leaked.
        // Only bail if phase is IDLE (cancelled) — COMPLETE should not happen here since
        // startRound() was already called. If it IS COMPLETE, something went wrong.
        const postDelayPhase = store.getState().phase;
        if (postDelayPhase === ChatPhases.IDLE) {
          hasTriggeredRef.current = false;
          lastTriggerKeyRef.current = null;
          postInFlightRef.current = false;
          store.getState().setPendingMessage(null);
          return;
        }
      }

      // Capture thread identity before the async POST so we can verify
      // the user hasn't navigated away by the time a failure is caught.
      const capturedThreadId = effectiveThreadId;

      try {
        // Pass roundNumber and fileParts directly to bypass potentially stale hook selector props
        await unifiedStartRound(userMessageText, roundNumber, fileParts);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        showApiErrorToast('Failed to start round', error);

        // Only recover if we're still on the same thread --
        // if the user navigated away during the POST, recovery would wipe
        // the NEW thread's state.
        const currentState = store.getState();
        if (currentState.thread?.id === capturedThreadId || currentState.createdThreadId === capturedThreadId) {
          const failedMessage = currentState.pendingMessage;

          // Reset round state set by startRound() — phase, counters, streamingThreadId
          if (deriveIsStreaming(currentState.phase)) {
            currentState.completeStreaming();
          }
          currentState.prepareForNewMessage();

          // Restore user's message to input for retry
          if (failedMessage) {
            store.getState().setInputValue(failedMessage);
          }
        }

        hasTriggeredRef.current = false;
        lastTriggerKeyRef.current = null;
      } finally {
        postInFlightRef.current = false;
      }
    };

    triggerStream();
  }, [
    waitingToStartStreaming,
    effectiveThreadId,
    store,
    enableWebSearch,
    postInFlightRef,
    unifiedStartRound,
  ]);

  return { postInFlightRef };
}
