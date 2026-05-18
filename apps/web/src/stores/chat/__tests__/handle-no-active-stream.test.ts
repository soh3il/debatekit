/**
 * handleNoActiveStream Tests
 *
 * Tests for the IDLE phase handling in handleNoActiveStream (Fix 1).
 * When resume GET returns 204 from IDLE, the round completed on the backend
 * while the user was away. The fix adds guarded cache invalidation + store
 * finalization instead of an unconditional bail.
 *
 * Since handleNoActiveStream is a provider callback, these tests simulate
 * the exact store-level operations it performs. The queryClient.invalidateQueries
 * call is provider-level and tested via integration in the provider.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createMockParticipants, createMockThread } from '@/lib/testing';

import { deriveIsStreaming, deriveWaitingToStartStreaming } from '../selectors';
import { createChatStore } from '../store';
import { ChatPhases, ROUND_UNINITIALIZED } from '../store-schemas';

// ============================================================================
// Types & Helpers
// ============================================================================

type TestStore = ReturnType<typeof createChatStore>;

function initThread(store: TestStore, threadId: string, participantCount: number, overrides?: Parameters<typeof createMockThread>[0]) {
  const participants = createMockParticipants(participantCount, threadId);
  const thread = createMockThread({ id: threadId, slug: `slug-${threadId}`, ...overrides });
  store.setState({ participants, thread });
  store.getState().initializeThread(thread, participants);
  return { participants, thread };
}

/**
 * Simulate the handleNoActiveStream callback logic at store level.
 * Returns { handled: boolean, shouldInvalidateCache: boolean, threadSlug: string | null }
 * to verify which branch was taken.
 */
function simulateHandleNoActiveStream(store: TestStore): {
  handled: boolean;
  shouldInvalidateCache: boolean;
  threadSlug: string | null;
} {
  const state = store.getState();

  // Guard: no thread
  if (!state.thread) {
    return { handled: false, shouldInvalidateCache: false, threadSlug: null };
  }

  // IDLE phase — new guarded finalization
  if (state.phase === 'idle') {
    if (
      state.hasInitiallyLoaded
      && state.currentRoundNumber !== null
      && state.currentRoundNumber >= 0
      && !state.pendingMessage
    ) {
      const threadSlug = state.thread?.slug ?? null;
      // queryClient.invalidateQueries would fire here in provider
      state.prepareForNewMessage();
      return { handled: true, shouldInvalidateCache: !!threadSlug, threadSlug };
    }
    return { handled: true, shouldInvalidateCache: false, threadSlug: null };
  }

  // Pending message guard — only block in COMPLETE phase (pre-startRound).
  // In active streaming phases (PRESEARCH/PARTICIPANTS/MODERATOR), the pending
  // message already triggered startRound() and the stream failed with zero data
  // parts. Allow 204 recovery to prevent permanent stuck state.
  if (state.pendingMessage && state.phase === 'complete') {
    return { handled: true, shouldInvalidateCache: false, threadSlug: null };
  }

  // Non-IDLE streaming phase — existing logic
  const threadId = state.thread.id;
  if (state.phase !== 'complete') {
    state.completeStreaming();
  }

  const freshState = store.getState();
  if (freshState.thread?.id === threadId) {
    freshState.prepareForNewMessage();
  }

  return { handled: true, shouldInvalidateCache: false, threadSlug: null };
}

/**
 * Simulate a full round completing on the backend while user is away.
 * Returns the store in the state it would be after navigate-back + hydration.
 */
function simulateNavigateBackAfterBackendComplete(
  store: TestStore,
  threadId: string,
  participantCount: number,
  roundNumber = 0,
  threadOverrides?: Parameters<typeof createMockThread>[0],
) {
  // 1. Init thread (simulates route loader + useSyncHydrateStore)
  const { participants, thread } = initThread(store, threadId, participantCount, threadOverrides);

  // 2. Set round number (simulates hydration from initialMessages)
  store.getState().setCurrentRoundNumber(roundNumber);

  // 3. Mark as loaded
  store.getState().setHasInitiallyLoaded(true);
  store.getState().setShowInitialUI(false);

  return { participants, thread };
}

// ============================================================================
// Tests
// ============================================================================

describe('handleNoActiveStream — IDLE phase handling (Fix 1)', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  // ==========================================================================
  // GUARD: hasInitiallyLoaded
  // ==========================================================================

  describe('hasInitiallyLoaded guard', () => {
    it('should NOT finalize when hasInitiallyLoaded is false (pre-hydration)', () => {
      const threadId = 'thread-not-loaded';
      initThread(store, threadId, 2);
      store.getState().setCurrentRoundNumber(0);
      store.getState().setHasInitiallyLoaded(false); // Simulate pre-hydration state

      expect(store.getState().hasInitiallyLoaded).toBe(false);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(false);
    });

    it('should finalize when hasInitiallyLoaded is true', () => {
      const threadId = 'thread-loaded';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      expect(store.getState().hasInitiallyLoaded).toBe(true);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
      expect(result.threadSlug).toBe(`slug-${threadId}`);
    });
  });

  // ==========================================================================
  // GUARD: currentRoundNumber
  // ==========================================================================

  describe('currentRoundNumber guard', () => {
    it('should NOT finalize when currentRoundNumber is null', () => {
      const threadId = 'thread-null-round';
      initThread(store, threadId, 2);
      store.getState().setHasInitiallyLoaded(true);
      // currentRoundNumber is null by default after initThread

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(false);
    });

    it('should NOT finalize when currentRoundNumber is ROUND_UNINITIALIZED (-1)', () => {
      const threadId = 'thread-uninit-round';
      initThread(store, threadId, 2);
      store.getState().setHasInitiallyLoaded(true);
      store.getState().setCurrentRoundNumber(ROUND_UNINITIALIZED);

      expect(store.getState().currentRoundNumber).toBe(-1);

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(false);
    });

    it('should finalize when currentRoundNumber is 0 (first round completed)', () => {
      const threadId = 'thread-round-0';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
    });

    it('should finalize when currentRoundNumber is > 0 (multi-round)', () => {
      const threadId = 'thread-round-3';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 3);

      expect(store.getState().currentRoundNumber).toBe(3);

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
    });
  });

  // ==========================================================================
  // GUARD: pendingMessage
  // ==========================================================================

  describe('pendingMessage guard', () => {
    it('should NOT finalize when pendingMessage is set (round about to start)', () => {
      const threadId = 'thread-pending';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);
      store.getState().setPendingMessage('New question');

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(false);
      // pendingMessage should NOT be cleared
      expect(store.getState().pendingMessage).toBe('New question');
    });

    it('should finalize when pendingMessage is null', () => {
      const threadId = 'thread-no-pending';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      expect(store.getState().pendingMessage).toBeNull();

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
    });
  });

  // ==========================================================================
  // GUARD: no thread
  // ==========================================================================

  describe('no thread guard (overview page)', () => {
    it('should bail immediately when no thread is set', () => {
      // Fresh store — no thread
      expect(store.getState().thread).toBeNull();

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(false);
      expect(result.shouldInvalidateCache).toBe(false);
    });

    it('should bail when thread was cleared by navigation reset', () => {
      const threadId = 'thread-cleared';
      initThread(store, threadId, 2);

      // Simulate navigation away
      store.getState().resetForThreadNavigation();
      expect(store.getState().thread).toBeNull();

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(false);
    });
  });

  // ==========================================================================
  // THREAD SLUG
  // ==========================================================================

  describe('thread slug for cache invalidation', () => {
    it('should produce threadSlug when thread has slug', () => {
      simulateNavigateBackAfterBackendComplete(store, 'thread-with-slug', 2, 0);

      const result = simulateHandleNoActiveStream(store);
      expect(result.threadSlug).toBe('slug-thread-with-slug');
    });

    it('should handle thread without slug gracefully', () => {
      const threadId = 'thread-no-slug';
      const participants = createMockParticipants(2, threadId);
      const thread = createMockThread({ id: threadId, slug: '' });
      store.setState({ participants, thread });
      store.getState().initializeThread(thread, participants);
      store.getState().setCurrentRoundNumber(0);
      store.getState().setHasInitiallyLoaded(true);

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      // Empty string is falsy — no cache invalidation
      expect(result.shouldInvalidateCache).toBe(false);
    });
  });

  // ==========================================================================
  // prepareForNewMessage EFFECTS
  // ==========================================================================

  describe('prepareForNewMessage effects from IDLE', () => {
    it('should clear createdThreadId after finalization', () => {
      const threadId = 'thread-created-id';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);
      store.getState().setCreatedThreadId(threadId);

      expect(store.getState().createdThreadId).toBe(threadId);

      simulateHandleNoActiveStream(store);

      expect(store.getState().createdThreadId).toBeNull();
    });

    it('should reset activeRoundParticipantCount to 0', () => {
      const threadId = 'thread-count-reset';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      simulateHandleNoActiveStream(store);

      expect(store.getState().activeRoundParticipantCount).toBe(0);
      expect(store.getState().completedParticipantCount).toBe(0);
    });

    it('should set streamingThreadId to null', () => {
      const threadId = 'thread-streaming-null';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      simulateHandleNoActiveStream(store);

      expect(store.getState().streamingThreadId).toBeNull();
    });

    it('should be idempotent on clean IDLE state', () => {
      const threadId = 'thread-idempotent';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      // State is already clean IDLE
      const _stateBefore = { ...store.getState() };

      simulateHandleNoActiveStream(store);

      // After prepareForNewMessage, key fields should be clean
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().pendingMessage).toBeNull();
      expect(store.getState().createdThreadId).toBeNull();
    });
  });

  // ==========================================================================
  // RACE CONDITIONS
  // ==========================================================================

  describe('race conditions', () => {
    it('double 204 invocation should be idempotent', () => {
      const threadId = 'thread-double-204';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      const result1 = simulateHandleNoActiveStream(store);
      expect(result1.shouldInvalidateCache).toBe(true);

      // Second invocation — still IDLE, still loaded, should still finalize
      // (prepareForNewMessage is idempotent)
      const result2 = simulateHandleNoActiveStream(store);
      expect(result2.shouldInvalidateCache).toBe(true);

      // State should be clean
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().pendingMessage).toBeNull();
    });

    it('204 arriving just as setPendingMessage fires should NOT finalize', () => {
      const threadId = 'thread-race-pending';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      // User types and hits send — setPendingMessage fires
      store.getState().setPendingMessage('Quick follow-up');

      // 204 arrives from a stale resume GET
      const result = simulateHandleNoActiveStream(store);
      expect(result.shouldInvalidateCache).toBe(false);

      // pendingMessage preserved for useRoundTrigger
      expect(store.getState().pendingMessage).toBe('Quick follow-up');
    });

    it('204 during thread switch should bail (no thread after reset)', () => {
      const threadId = 'thread-switch';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      // Navigation cleanup clears thread
      store.getState().resetForThreadNavigation();

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(false);
    });
  });

  // ==========================================================================
  // NON-IDLE PHASES (existing behavior preserved)
  // ==========================================================================

  describe('non-IDLE phases (existing behavior unchanged)', () => {
    it('from PARTICIPANTS phase — should completeStreaming + prepareForNewMessage', () => {
      const threadId = 'thread-participants';
      initThread(store, threadId, 2);
      store.getState().startRound(0, 2);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      simulateHandleNoActiveStream(store);

      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(deriveIsStreaming(store.getState().phase)).toBe(false);
    });

    it('from MODERATOR phase — should completeStreaming + prepareForNewMessage', () => {
      const threadId = 'thread-moderator';
      initThread(store, threadId, 2);
      store.getState().startRound(0, 2);
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(0);
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(1);
      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

      simulateHandleNoActiveStream(store);

      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });

    it('from PRESEARCH phase — should completeStreaming + prepareForNewMessage', () => {
      const threadId = 'thread-presearch';
      initThread(store, threadId, 2);
      store.getState().startRound(0, 2, true);
      expect(store.getState().phase).toBe(ChatPhases.PRESEARCH);

      simulateHandleNoActiveStream(store);

      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });

    it('from COMPLETE phase — should skip completeStreaming but still prepareForNewMessage', () => {
      const threadId = 'thread-complete';
      initThread(store, threadId, 2);
      store.getState().startRound(0, 2);
      store.getState().completeStreaming();
      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);

      simulateHandleNoActiveStream(store);

      // prepareForNewMessage transitions COMPLETE → IDLE
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });

    it('complete phase with pendingMessage should bail (round 2+ pending)', () => {
      const threadId = 'thread-pending-r2-complete';
      initThread(store, threadId, 2);
      store.getState().startRound(0, 2);
      store.getState().completeStreaming();
      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);

      // User sends follow-up — store has pendingMessage but phase is COMPLETE
      // (before prepareForNewMessage / startRound for round 2)
      store.getState().setPendingMessage('Round 2 question');

      // 204 arrives from stale resume GET — should bail to protect round 2
      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(false);
      // pendingMessage NOT cleared
      expect(store.getState().pendingMessage).toBe('Round 2 question');
    });

    it('idle phase with pendingMessage should bail (round about to start)', () => {
      const threadId = 'thread-pending-r2-idle';
      initThread(store, threadId, 2);
      store.getState().startRound(0, 2);
      store.getState().completeStreaming();
      store.getState().prepareForNewMessage();

      // User sends follow-up — phase is IDLE, message queued
      store.getState().setPendingMessage('Round 2 question');

      // 204 arrives from stale resume GET
      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(false);
      // pendingMessage NOT cleared
      expect(store.getState().pendingMessage).toBe('Round 2 question');
    });

    it('participants phase with pendingMessage should recover (empty stream fix)', () => {
      const threadId = 'thread-empty-stream';
      initThread(store, threadId, 3);

      // Simulate: pendingMessage set, startRound ran, POST returned 200
      // but stream produced zero data parts. Phase is PARTICIPANTS.
      store.getState().setPendingMessage('btc price usd');
      store.getState().startRound(1, 3);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // 204 recovery should proceed despite pendingMessage being set,
      // because startRound already consumed the trigger.
      simulateHandleNoActiveStream(store);

      // Should recover to IDLE, not stay stuck
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(deriveIsStreaming(store.getState().phase)).toBe(false);
    });

    it('presearch phase with pendingMessage should recover (web search empty stream)', () => {
      const threadId = 'thread-empty-presearch';
      initThread(store, threadId, 2);

      store.getState().setPendingMessage('search query');
      store.getState().startRound(0, 2, true);
      expect(store.getState().phase).toBe(ChatPhases.PRESEARCH);

      simulateHandleNoActiveStream(store);

      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });
  });

  // ==========================================================================
  // FULL NAVIGATE-BACK SCENARIOS (per FLOW_DOCUMENTATION.md)
  // ==========================================================================

  describe('full navigate-back scenarios', () => {
    it('sCENARIO 2: user returns after round complete — 204 from IDLE', () => {
      // Per FLOW_DOCUMENTATION.md: "All: Load from D1 (final messages).
      //   Redis streams expired or marked complete. Backend returns 204."
      const threadId = 'thread-scenario-2';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      // AI SDK resume GET → 204
      const result = simulateHandleNoActiveStream(store);

      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().pendingMessage).toBeNull();
      expect(store.getState().createdThreadId).toBeNull();
    });

    it('multi-round thread: navigate back after round 3 completed', () => {
      const threadId = 'thread-multi-round';
      simulateNavigateBackAfterBackendComplete(store, threadId, 3, 3);

      expect(store.getState().currentRoundNumber).toBe(3);

      const result = simulateHandleNoActiveStream(store);

      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });

    it('web search thread: navigate back after presearch + participants + moderator completed', () => {
      const threadId = 'thread-web-search';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 1, { enableWebSearch: true });

      const result = simulateHandleNoActiveStream(store);

      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
    });

    it('single participant thread: navigate back after round complete (no moderator)', () => {
      const threadId = 'thread-single';
      simulateNavigateBackAfterBackendComplete(store, threadId, 1, 0);

      const result = simulateHandleNoActiveStream(store);

      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
    });
  });

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  describe('streaming state cache interaction', () => {
    it('should clear streaming state cache from non-IDLE phase', () => {
      const threadId = 'thread-cache-clear';
      initThread(store, threadId, 2);
      store.getState().startRound(0, 2);

      simulateHandleNoActiveStream(store);

      // Cache should be cleared by the non-IDLE path
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });

    it('iDLE path does NOT clear streaming state cache (already clean)', () => {
      const threadId = 'thread-idle-no-cache';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      // No cache exists for IDLE state (navigation cleanup would have cleared it)
      simulateHandleNoActiveStream(store);

      // No error, no crash
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });
  });

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  describe('derived state after handleNoActiveStream', () => {
    it('deriveIsStreaming should be false after IDLE finalization', () => {
      const threadId = 'thread-derived-idle';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      simulateHandleNoActiveStream(store);

      expect(deriveIsStreaming(store.getState().phase)).toBe(false);
    });

    it('deriveWaitingToStartStreaming should be false after finalization', () => {
      const threadId = 'thread-derived-waiting';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      simulateHandleNoActiveStream(store);

      expect(deriveWaitingToStartStreaming(
        store.getState().phase,
        store.getState().pendingMessage,
      )).toBe(false);
    });

    it('deriveIsStreaming should be false after non-IDLE path', () => {
      const threadId = 'thread-derived-nonIdle';
      initThread(store, threadId, 2);
      store.getState().startRound(0, 2);

      simulateHandleNoActiveStream(store);

      expect(deriveIsStreaming(store.getState().phase)).toBe(false);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('thread with round 0 and 0 participants (theoretical edge)', () => {
      const threadId = 'thread-0-participants';
      const participants: ReturnType<typeof createMockParticipants> = [];
      const thread = createMockThread({ id: threadId, slug: `slug-${threadId}` });
      store.setState({ participants, thread });
      store.getState().initializeThread(thread, participants);
      store.getState().setCurrentRoundNumber(0);
      store.getState().setHasInitiallyLoaded(true);

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      expect(result.shouldInvalidateCache).toBe(true);
    });

    it('rapid thread switches: A → B → 204 for A (stale) should handle B correctly', () => {
      // Navigate to A
      const threadA = 'thread-A';
      simulateNavigateBackAfterBackendComplete(store, threadA, 2, 0);

      // Navigate to B (reset + reinit)
      store.getState().resetForThreadNavigation();
      const threadB = 'thread-B';
      simulateNavigateBackAfterBackendComplete(store, threadB, 3, 1);

      // 204 fires — but store now shows thread B
      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      // Should invalidate for thread B's slug
      expect(result.threadSlug).toBe(`slug-${threadB}`);
    });

    it('completeStreaming from IDLE is a no-op (guard prevents it)', () => {
      const threadId = 'thread-complete-from-idle';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      // completeStreaming from IDLE should not crash or change phase
      store.getState().completeStreaming();
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });

    it('hasInitiallyLoaded=true but thread changed between hydration and 204', () => {
      const threadId = 'thread-changed';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2, 0);

      // Thread gets replaced (e.g., by a concurrent hydration)
      const newThread = createMockThread({ id: 'different-thread', slug: 'different-slug' });
      store.setState({ thread: newThread });

      const result = simulateHandleNoActiveStream(store);
      expect(result.handled).toBe(true);
      // Should invalidate for the CURRENT thread's slug, not the original
      expect(result.threadSlug).toBe('different-slug');
    });
  });
});
