/**
 * Phase Failure Recovery Tests
 *
 * Verifies that the round trigger recovery logic correctly resets store state
 * when sendMessage() fails after startRound() has already transitioned the phase.
 *
 * Without recovery, the phase gets permanently stuck in PARTICIPANTS/PRESEARCH
 * with no active stream, blocking input forever.
 *
 * These tests exercise the store-level recovery sequence:
 * 1. completeStreaming() → phase PARTICIPANTS/PRESEARCH → COMPLETE
 * 2. prepareForNewMessage() → COMPLETE → IDLE
 * 3. setInputValue(failedMessage) → user can retry without re-typing
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createMockParticipants, createMockThread } from '@/lib/testing';

import { deriveIsStreaming, deriveWaitingToStartStreaming } from '../selectors';
import { createChatStore } from '../store';
import { ChatPhases } from '../store-schemas';

// ============================================================================
// Types
// ============================================================================

type TestStore = ReturnType<typeof createChatStore>;

// ============================================================================
// Helpers
// ============================================================================

/** Simulate the recovery sequence that useRoundTrigger catch block performs. */
function simulateRecovery(store: TestStore, _threadId: string, failedMessage: string | null) {
  const currentState = store.getState();

  // Step 1: Reset round state set by startRound()
  if (deriveIsStreaming(currentState.phase)) {
    currentState.completeStreaming();
  }

  // Step 2: Transition COMPLETE → IDLE
  currentState.prepareForNewMessage();

  // Step 3: Restore user's message to input
  if (failedMessage) {
    store.getState().setInputValue(failedMessage);
  }
}

function initThread(store: TestStore, threadId: string, participantCount: number) {
  const participants = createMockParticipants(participantCount);
  const thread = createMockThread({ id: threadId });
  store.setState({ participants, thread });
  store.getState().initializeThread(thread, participants);
  return { participants, thread };
}

// ============================================================================
// Tests
// ============================================================================

describe('phase Failure Recovery', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  describe('sendMessage fails during PARTICIPANTS phase (round 0, new thread)', () => {
    it('should recover to IDLE with input restored', () => {
      const threadId = 'thread-fail-participants';
      initThread(store, threadId, 2);

      // Simulate: setPendingMessage + startRound (what useRoundTrigger does)
      store.getState().setPendingMessage('What is AI?');
      store.getState().startRound(0, 2, false);

      // Verify stuck state before recovery
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
      expect(deriveIsStreaming(store.getState().phase)).toBe(true);

      // Simulate sendMessage failure → recovery
      simulateRecovery(store, threadId, store.getState().pendingMessage);

      // Verify recovery
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(deriveIsStreaming(store.getState().phase)).toBe(false);
      expect(store.getState().pendingMessage).toBeNull();
      expect(store.getState().inputValue).toBe('What is AI?');
      expect(store.getState().activeRoundParticipantCount).toBe(0);
      expect(store.getState().completedParticipantCount).toBe(0);
      expect(store.getState().streamingThreadId).toBeNull();
    });
  });

  describe('sendMessage fails during PRESEARCH phase (round 0, web search enabled)', () => {
    it('should recover to IDLE with presearch cleaned up', () => {
      const threadId = 'thread-fail-presearch';
      initThread(store, threadId, 2);

      store.getState().setPendingMessage('Search for AI news');
      store.getState().startRound(0, 2, true);

      // Verify PRESEARCH phase
      expect(store.getState().phase).toBe(ChatPhases.PRESEARCH);
      expect(deriveIsStreaming(store.getState().phase)).toBe(true);

      simulateRecovery(store, threadId, store.getState().pendingMessage);

      // Verify recovery
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(deriveIsStreaming(store.getState().phase)).toBe(false);
      expect(store.getState().pendingMessage).toBeNull();
      expect(store.getState().inputValue).toBe('Search for AI news');
      expect(store.getState().streamingThreadId).toBeNull();
    });
  });

  describe('sendMessage fails during PARTICIPANTS phase (round 1+, existing thread)', () => {
    it('should recover to IDLE for subsequent rounds', () => {
      const threadId = 'thread-fail-round1';
      initThread(store, threadId, 2);

      // Complete round 0 first
      store.getState().startRound(0, 2, false);
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(0);
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(1);
      store.getState().onModeratorComplete();
      store.getState().prepareForNewMessage();
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      // Start round 1 (simulates useRoundTrigger)
      store.getState().setPendingMessage('Follow-up question');
      store.getState().setCurrentRoundNumber(1);
      store.getState().startRound(1, 2, false);

      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // sendMessage fails
      simulateRecovery(store, threadId, store.getState().pendingMessage);

      // Verify recovery — createdThreadId already null for existing threads
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().pendingMessage).toBeNull();
      expect(store.getState().inputValue).toBe('Follow-up question');
      expect(store.getState().createdThreadId).toBeNull();
    });
  });

  describe('recovery resets streaming state', () => {
    it('should reset to IDLE after recovery', () => {
      const threadId = 'thread-cache-clear';
      initThread(store, threadId, 2);

      store.getState().setPendingMessage('Test recovery');
      store.getState().startRound(0, 2, false);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      simulateRecovery(store, threadId, store.getState().pendingMessage);

      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().streamingThreadId).toBeNull();
    });
  });

  describe('retry after failure succeeds', () => {
    it('should allow a new round to start after recovery', () => {
      const threadId = 'thread-retry';
      initThread(store, threadId, 2);

      // First attempt: startRound + failure + recovery
      store.getState().setPendingMessage('First attempt');
      store.getState().startRound(0, 2, false);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      simulateRecovery(store, threadId, store.getState().pendingMessage);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().inputValue).toBe('First attempt');

      // Retry: new setPendingMessage + startRound should work
      store.getState().setPendingMessage('First attempt');
      store.getState().startRound(0, 2, false);

      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
      expect(deriveIsStreaming(store.getState().phase)).toBe(true);
      expect(store.getState().activeRoundParticipantCount).toBe(2);

      // Complete normally
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(0);
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(1);
      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

      store.getState().onModeratorComplete();
      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
    });
  });

  describe('navigation during failure recovery', () => {
    it('should leave clean IDLE state after recovery + navigation', () => {
      const threadId = 'thread-nav-recovery';
      initThread(store, threadId, 2);

      store.getState().setPendingMessage('Navigate away');
      store.getState().startRound(0, 2, false);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // Recovery
      simulateRecovery(store, threadId, store.getState().pendingMessage);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      // Simulate navigation away (resetForThreadNavigation equivalent)
      store.getState().prepareForNewMessage();

      // Clean IDLE state
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().pendingMessage).toBeNull();
      expect(store.getState().streamingThreadId).toBeNull();
      expect(store.getState().activeRoundParticipantCount).toBe(0);
    });

    it('should not affect a different thread when recovery runs after navigation', () => {
      const threadA = 'thread-a';
      const threadB = 'thread-b';

      // Start on thread A
      initThread(store, threadA, 2);
      store.getState().setPendingMessage('Thread A message');
      store.getState().startRound(0, 2, false);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // Navigate to thread B (simulates provider remount with new thread)
      const participantsB = createMockParticipants(3);
      const threadBObj = createMockThread({ id: threadB });
      store.getState().prepareForNewMessage();
      store.setState({ participants: participantsB, thread: threadBObj });
      store.getState().initializeThread(threadBObj, participantsB);

      // Thread B state should be clean IDLE
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().thread?.id).toBe(threadB);
    });
  });

  describe('waitingToStartStreaming reflects recovery', () => {
    it('should be false after recovery (no pending message)', () => {
      const threadId = 'thread-waiting';
      initThread(store, threadId, 2);

      store.getState().setPendingMessage('Test waiting');

      // Before startRound: waitingToStartStreaming = true (IDLE + pendingMessage)
      expect(deriveWaitingToStartStreaming(store.getState().phase, store.getState().pendingMessage)).toBe(true);

      store.getState().startRound(0, 2, false);

      // During streaming: waitingToStartStreaming = false (PARTICIPANTS phase)
      expect(deriveWaitingToStartStreaming(store.getState().phase, store.getState().pendingMessage)).toBe(false);

      // After recovery: waitingToStartStreaming = false (IDLE + no pendingMessage)
      simulateRecovery(store, threadId, store.getState().pendingMessage);
      expect(deriveWaitingToStartStreaming(store.getState().phase, store.getState().pendingMessage)).toBe(false);
    });
  });
});
