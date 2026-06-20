/**
 * Data Part Handler
 *
 * Handles all custom data parts received from AI SDK v6 useChat `onData`.
 * Phase reads use store.getState().phase as the single source of truth.
 * Participant completion uses a simple counter (completedParticipantCount).
 *
 * @module hooks/streaming/handlers/handle-data-part
 */

import type {
  DomainSourceProgressData,
  PhaseMarkerData,
  RoundCompleteData,
  StreamErrorData,
  StreamPhase,
} from '@debatekit/shared';
import { AiSdkPhaseStatuses, MessageStatuses, StreamPhases } from '@debatekit/shared';
import type { MutableRefObject } from 'react';

import { isDataPart as isDataPartGeneric } from '@/lib/schemas/data-part-schema';
import { countEnabledParticipants } from '@/lib/utils/streaming-helpers';
import type { ChatStoreApi } from '@/stores/chat';
import { ChatPhases } from '@/stores/chat';

// TYPES

export type DataPart
  = | { data: DomainSourceProgressData; type: 'data-domain-source-progress' }
    | { data: PhaseMarkerData; type: 'data-phase' }
    | { data: RoundCompleteData; type: 'data-round-complete' }
    | { data: StreamErrorData; type: 'data-error' };

const VALID_DATA_PART_TYPES = new Set<string>([
  'data-domain-source-progress',
  'data-phase',
  'data-round-complete',
  'data-error',
]);

/** Type guard for DataPart - uses Zod schema for structural validation, then narrows to specific union */
export function isDataPart(value: unknown): value is DataPart {
  if (!isDataPartGeneric(value)) {
    return false;
  }
  return VALID_DATA_PART_TYPES.has(value.type);
}

/**
 * All refs and callbacks that the data part handler depends on.
 * Store is sole source of truth for phase — no currentPhaseRef or updatePhase.
 *
 * NOTE: Properties are sorted alphabetically per `perfectionist/sort-objects` lint rule.
 */
export type DataPartHandlerDeps = {
  currentParticipantRef: MutableRefObject<{ id: string; index: number } | null>;
  currentThreadIdRef: MutableRefObject<string | null>;
  dispatchedCompletionsRef: MutableRefObject<Set<string>>;
  expectedThreadId: string;
  onErrorRef: MutableRefObject<((phase: StreamPhase, error: string, participantIndex?: number) => void) | undefined>;
  onRoundCompleteRef: MutableRefObject<((completedPhases?: StreamPhase[]) => void) | undefined>;
  roundCompleteDispatchedRef: MutableRefObject<boolean>;
  setCurrentParticipantIndex: (index: number | null) => void;
  setStreamError: (error: Error | null) => void;
  store: ChatStoreApi;
};

// HELPERS

/** Get fresh participant count from store */
function getFreshCount(store: ChatStoreApi): number {
  const state = store.getState();
  let count = countEnabledParticipants(state.participants);
  if (count === 0 && state.selectedParticipants.length > 0) {
    count = state.selectedParticipants.length;
  }
  return count;
}

/**
 * Get current round number from store with safe fallback.
 * Exported so dedup keys are derived from a single canonical source (the store's
 * currentRoundNumber) everywhere — never a parallel React prop/ref round number.
 */
export function storeRound(store: ChatStoreApi): number {
  const state = store.getState();
  return state.currentRoundNumber !== null && state.currentRoundNumber >= 0 ? state.currentRoundNumber : 0;
}

/**
 * Check if store needs resume initialization for the current round.
 * IDLE or COMPLETE means the store hasn't been set up for active streaming.
 */
function needsResumeInit(store: ChatStoreApi): boolean {
  const phase = store.getState().phase;
  return phase === ChatPhases.IDLE || phase === ChatPhases.COMPLETE;
}

// FACTORY FUNCTION

/**
 * Creates a data part handler function.
 *
 * All phase reads use store.getState().phase (ChatPhase) as the single source of truth.
 * Phase transitions happen via store actions called by the inlined callback logic.
 * Participant completion uses incrementCompletedParticipants() + onParticipantComplete().
 */
export function createDataPartHandler(deps: DataPartHandlerDeps) {
  const {
    currentParticipantRef,
    currentThreadIdRef,
    dispatchedCompletionsRef,
    expectedThreadId,
    onErrorRef,
    onRoundCompleteRef,
    roundCompleteDispatchedRef,
    setCurrentParticipantIndex,
    setStreamError,
    store,
  } = deps;

  return (dataPart: DataPart) => {
    // CROSS-THREAD GUARD
    if (currentThreadIdRef.current !== expectedThreadId) {
      return;
    }

    // Read store phase (single source of truth)
    const currentStorePhase = store.getState().phase;

    // RACE GUARD: Drop data parts after round complete.
    // Exception: During resume, the backend replays ALL SSE events so we must allow
    // data-phase events through (START triggers resumeIntoStreaming, COMPLETE tracks progress).
    // Also allow data-round-complete during resume so the store can finalize.
    if (currentStorePhase === ChatPhases.COMPLETE) {
      if (dataPart.type === 'data-phase') {
        // Allow all phase events during resume -- needsResumeInit handles setup.
        // START events trigger resumeIntoStreaming, COMPLETE events track progress.
      } else if (dataPart.type === 'data-round-complete' && needsResumeInit(store)) {
        // Allow round-complete during resume -- store hasn't transitioned yet
      } else {
        return;
      }
    }

    // CROSS-THREAD GUARD: Block spurious events in idle.
    if (currentStorePhase === ChatPhases.IDLE) {
      if (dataPart.type === 'data-error') {
        return; // Always drop errors in IDLE
      }
      if (dataPart.type === 'data-round-complete') {
        // Allow through during resume -- onRoundComplete handles cleanup.
        // Block otherwise -- spurious round-complete for already-finished rounds.
        if (!store.getState().thread) {
          return;
        }
        // If we have a thread but are IDLE, this is a resume scenario.
        // Let it through -- onRoundComplete will call completeStreaming + prepareForNewMessage.
      }
    }

    if (dataPart.type === 'data-domain-source-progress') {
      store.getState().updateDomainSourceProgress(dataPart.data);
      return;
    }

    if (dataPart.type === 'data-phase') {
      const { error, participantId, participantIndex, phase, status, totalParticipants } = dataPart.data;

      // STALE DATA GUARD: Skip 'complete' events that don't match current phase.
      if (status === AiSdkPhaseStatuses.COMPLETE) {
        const currPhase = store.getState().phase;
        if (phase === StreamPhases.PARTICIPANT && (currPhase === ChatPhases.IDLE || currPhase === ChatPhases.PRESEARCH)) {
          return;
        }
      }

      if (status === AiSdkPhaseStatuses.START) {
        if (phase === StreamPhases.PRESEARCH) {
          // GUARD: Don't regress phase backwards
          const currPhase = store.getState().phase;
          if (currPhase === ChatPhases.PARTICIPANTS || currPhase === ChatPhases.MODERATOR) {
            return;
          }

          const state = store.getState();
          if (state.thread) {
            const roundNumber = storeRound(store);
            if (needsResumeInit(store)) {
              const freshParticipantCount = getFreshCount(store);
              state.resumeIntoStreaming(roundNumber, freshParticipantCount, ChatPhases.PRESEARCH);
            }

            const freshState = store.getState();
            const threadId = freshState.thread?.id ?? freshState.createdThreadId ?? null;
            const existingPreSearch = freshState.preSearches.find(ps => ps.roundNumber === roundNumber);
            if (!existingPreSearch && threadId !== null && threadId.length > 0) {
              freshState.addPreSearch({
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
        } else if (phase === StreamPhases.PARTICIPANT) {
          const idx = participantIndex ?? 0;

          if (totalParticipants !== undefined && idx >= totalParticipants) {
            return;
          }

          // PHASE GUARD: Never reset participant pointers once the round has advanced to
          // MODERATOR within the active stream. Mirrors the PRESEARCH-start guard. Without
          // this, a late/duplicate participant START (e.g. when the client count was lower
          // than the server's) would regress the UI onto a participant card on top of an
          // active moderator and drop that participant's turn.
          // (COMPLETE is intentionally NOT blocked here: during resume the store starts in
          // COMPLETE and a replayed participant START must be allowed through to trigger
          // resumeIntoStreaming — the RACE GUARD above already permits that path.)
          if (store.getState().phase === ChatPhases.MODERATOR) {
            return;
          }

          // RECONCILE: The server's per-event totalParticipants is the authoritative
          // round cardinality. The client snapshot in startRound can diverge (participant
          // toggled after capture, hydration skew). Reconcile up so onParticipantComplete
          // doesn't transition to MODERATOR before every participant has streamed.
          if (totalParticipants !== undefined) {
            store.getState().setActiveRoundParticipantCount(totalParticipants);
          }

          // GUARD: Don't start participants while presearch is active
          if (store.getState().phase === ChatPhases.PRESEARCH) {
            return;
          }

          setCurrentParticipantIndex(idx);
          currentParticipantRef.current = { id: participantId || '', index: idx };

          const state = store.getState();
          if (state.thread) {
            const roundNumber = storeRound(store);
            const startDedupKey = `start:r${roundNumber}:p${idx}`;
            if (!dispatchedCompletionsRef.current.has(startDedupKey)) {
              dispatchedCompletionsRef.current.add(startDedupKey);

              if (needsResumeInit(store)) {
                const freshParticipantCount = totalParticipants ?? getFreshCount(store);
                store.getState().resumeIntoStreaming(roundNumber, freshParticipantCount, ChatPhases.PARTICIPANTS);
              }

              // RESUME FIX: Enrich placeholder snapshot with actual model when available.
              // During resume, resumeIntoStreaming creates PLACEHOLDER snapshots. As each
              // participant:start replays, look up the model from the hydrated participants
              // or from participantId to enrich the placeholder with the real model name.
              if (participantId) {
                const freshState = store.getState();
                const matchedParticipant = freshState.participants.find(p => p.id === participantId);
                if (matchedParticipant) {
                  freshState.enrichParticipantSnapshot(roundNumber, idx, matchedParticipant.modelId);
                }
              }

              store.getState().setCurrentParticipantIndex(idx);
            }
          }
        } else if (phase === StreamPhases.MODERATOR) {
          const state = store.getState();
          if (state.thread) {
            const roundNumber = storeRound(store);
            const startDedupKey = `start:r${roundNumber}:moderator`;
            if (!dispatchedCompletionsRef.current.has(startDedupKey)) {
              dispatchedCompletionsRef.current.add(startDedupKey);

              if (needsResumeInit(store)) {
                const freshParticipantCount = getFreshCount(store);
                store.getState().resumeIntoStreaming(roundNumber, freshParticipantCount, ChatPhases.MODERATOR);
              }

              const freshState = store.getState();
              if (freshState.phase === ChatPhases.PARTICIPANTS) {
                freshState.setPhaseToModerator();
              }
            }
          }
        }
      } else if (status === AiSdkPhaseStatuses.COMPLETE) {
        if (phase === StreamPhases.PRESEARCH) {
          const state = store.getState();
          if (state.thread) {
            const roundNumber = storeRound(store);
            const dedupKey = `presearch:r${roundNumber}`;
            if (!dispatchedCompletionsRef.current.has(dedupKey)) {
              dispatchedCompletionsRef.current.add(dedupKey);
              state.updatePreSearchStatus(roundNumber, MessageStatuses.COMPLETE);

              const currentState = store.getState();
              if (currentState.phase === ChatPhases.PRESEARCH) {
                currentState.transitionToParticipants();
              }
            }
          }
        } else if (phase === StreamPhases.PARTICIPANT) {
          const idx = participantIndex ?? currentParticipantRef.current?.index ?? 0;
          setCurrentParticipantIndex(null);
          currentParticipantRef.current = null;

          const dedupKey = `r${storeRound(store)}:p${idx}`;
          if (!dispatchedCompletionsRef.current.has(dedupKey)) {
            dispatchedCompletionsRef.current.add(dedupKey);

            const state = store.getState();
            if (state.thread) {
              const roundNumber = storeRound(store);

              if (needsResumeInit(store)) {
                const freshParticipantCount = getFreshCount(store);
                state.resumeIntoStreaming(roundNumber, freshParticipantCount, ChatPhases.PARTICIPANTS);
              }

              store.getState().incrementCompletedParticipants();
              const freshState = store.getState();
              if (freshState.phase !== ChatPhases.COMPLETE) {
                freshState.onParticipantComplete(idx);
              }
            }
          }
        } else if (phase === StreamPhases.MODERATOR) {
          const modDedupKey = `r${storeRound(store)}:moderator`;
          if (!dispatchedCompletionsRef.current.has(modDedupKey)) {
            dispatchedCompletionsRef.current.add(modDedupKey);

            const state = store.getState();
            if (state.thread) {
              store.getState().onModeratorComplete();
            }
          }
        }
      } else if (status === AiSdkPhaseStatuses.ERROR) {
        setStreamError(new Error(error || 'Unknown error'));

        if (phase === StreamPhases.PRESEARCH) {
          const state = store.getState();
          if (state.thread) {
            const roundNumber = storeRound(store);
            state.updatePreSearchStatus(roundNumber, MessageStatuses.FAILED);

            const currentState = store.getState();
            if (currentState.phase === ChatPhases.PRESEARCH) {
              currentState.transitionToParticipants();
            }
          }
        }

        if (phase === StreamPhases.PARTICIPANT) {
          const idx = participantIndex ?? currentParticipantRef.current?.index ?? 0;
          // Clear the in-flight participant ref, mirroring the COMPLETE branch.
          // Without this, onFinish's force-complete would re-count this already-errored
          // participant (its dedup key can diverge from the handler's round source),
          // overshooting completedParticipantCount and skipping a later turn.
          setCurrentParticipantIndex(null);
          currentParticipantRef.current = null;

          const dedupKey = `r${storeRound(store)}:p${idx}`;
          if (!dispatchedCompletionsRef.current.has(dedupKey)) {
            dispatchedCompletionsRef.current.add(dedupKey);

            const state = store.getState();
            if (state.thread) {
              store.getState().incrementCompletedParticipants();
              const freshState = store.getState();
              if (freshState.phase !== ChatPhases.COMPLETE) {
                freshState.onParticipantComplete(idx);
              }
            }
          }
        }

        if (phase === StreamPhases.MODERATOR) {
          const modDedupKey = `r${storeRound(store)}:moderator`;
          if (!dispatchedCompletionsRef.current.has(modDedupKey)) {
            dispatchedCompletionsRef.current.add(modDedupKey);

            const state = store.getState();
            if (state.thread) {
              store.getState().onModeratorComplete();
            }
          }
        }

        onErrorRef.current?.(phase, error || 'Unknown error', participantIndex);
      }
    } else if (dataPart.type === 'data-round-complete') {
      // STRAGGLER RECONCILIATION: A participant phase-complete is transient (AI SDK v6
      // does not replay it), so a single dropped frame on a still-open connection leaves
      // completedParticipantCount short and the phase machine stuck in PARTICIPANTS.
      // Reconcile against the known expected set [0, total) using the SAME dedup-key
      // convention as the live completion handlers, then drive the phase machine once.
      const currentRound = storeRound(store);
      const expectedTotal = store.getState().activeRoundParticipantCount;
      let reconciledAny = false;
      for (let idx = 0; idx < expectedTotal; idx++) {
        const dedupKey = `r${currentRound}:p${idx}`;
        if (dispatchedCompletionsRef.current.has(dedupKey)) {
          continue;
        }
        dispatchedCompletionsRef.current.add(dedupKey);
        if (store.getState().thread) {
          store.getState().incrementCompletedParticipants();
          reconciledAny = true;
        }
      }
      if (reconciledAny && expectedTotal > 0) {
        const freshState = store.getState();
        if (freshState.phase === ChatPhases.PARTICIPANTS && freshState.thread) {
          freshState.onParticipantComplete(expectedTotal - 1);
        }
      }

      // onRoundComplete callback calls completeStreaming() which sets store.phase to COMPLETE
      const { completedPhases } = dataPart.data;
      if (!roundCompleteDispatchedRef.current) {
        roundCompleteDispatchedRef.current = true;
        onRoundCompleteRef.current?.(completedPhases);
      }
    } else if (dataPart.type === 'data-error') {
      const { error, participantIndex, phase } = dataPart.data;

      // A participant-scoped error is recoverable: the backend keeps streaming the
      // remaining participants and persists this turn as a hasError placeholder. Surface
      // it via the error callback only -- do NOT set a sticky global streamError, which
      // would flip hook status to 'error' for the rest of a still-streaming round and
      // disable resume. Reserve setStreamError for genuinely fatal/non-participant errors.
      const isParticipantScoped = phase === StreamPhases.PARTICIPANT && participantIndex !== undefined;
      if (!isParticipantScoped) {
        setStreamError(new Error(error));
      }
      onErrorRef.current?.(phase, error, participantIndex);
    }
  };
}
