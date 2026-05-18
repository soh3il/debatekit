/**
 * Moderator Tracking Unit Tests
 *
 * Tests the chat store's moderator tracking functionality following TDD principles.
 * Covers: trigger tracking, streaming state, phase transitions, deduplication,
 * thread navigation, and round 2+ behavior.
 *
 * References: docs/FLOW_DOCUMENTATION.md
 * - Frame 5: All Participants Complete -> Moderator Starts
 * - Frame 6: Round 1 Complete (Moderator finishes)
 * - Frame 11-12: Round 2 moderator flow
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockParticipants, createMockThread } from '@/lib/testing';

import { deriveIsModeratorStreaming, deriveIsStreaming } from '../selectors';
import { createChatStore } from '../store';
import { ChatPhases } from '../store-schemas';

// ============================================================================
// Test Helpers
// ============================================================================

type TestStore = ReturnType<typeof createChatStore>;

function setupRoundWithParticipants(
  store: TestStore,
  participantCount: number,
  roundNumber = 0,
) {
  const participants = createMockParticipants(participantCount);
  const thread = createMockThread({ id: `thread-test-${roundNumber}` });
  store.setState({ participants });
  store.getState().initializeThread(thread, participants);
  store.getState().startRound(roundNumber, participantCount);
  return participants;
}

function completeParticipant(
  store: TestStore,
  index: number,
) {
  store.getState().incrementCompletedParticipants();
  store.getState().onParticipantComplete(index);
}

function completeAllParticipants(
  store: TestStore,
  participantCount: number,
) {
  for (let i = 0; i < participantCount; i++) {
    completeParticipant(store, i);
  }
}

describe('moderator Tracking', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. MODERATOR TRIGGER TRACKING
  // ===========================================================================

  describe('moderator trigger tracking', () => {
    describe('hasModeratorStreamBeenTriggered', () => {
      it('should return false for untriggered moderator', () => {
        const moderatorId = 'thread_123_r0_moderator';
        const roundNumber = 0;

        const result = store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber);

        expect(result).toBe(false);
      });

      it('should return true when moderator ID has been triggered', () => {
        const moderatorId = 'thread_123_r0_moderator';
        const roundNumber = 0;

        store.getState().markModeratorStreamTriggered(moderatorId, roundNumber);

        const result = store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber);

        expect(result).toBe(true);
      });

      it('should return true when round number has been triggered (different ID)', () => {
        const moderatorId1 = 'thread_123_r0_moderator';
        const moderatorId2 = 'thread_456_r0_moderator';
        const roundNumber = 0;

        store.getState().markModeratorStreamTriggered(moderatorId1, roundNumber);

        // Different ID but same round should still be considered triggered
        const result = store.getState().hasModeratorStreamBeenTriggered(moderatorId2, roundNumber);

        expect(result).toBe(true);
      });

      it('should check both triggeredModeratorIds and triggeredModeratorRounds Sets', () => {
        const moderatorId = 'thread_123_r0_moderator';
        const roundNumber = 0;

        // Mark triggered
        store.getState().markModeratorStreamTriggered(moderatorId, roundNumber);

        const state = store.getState();

        // Verify both Sets contain the values
        expect(state.triggeredModeratorIds.has(moderatorId)).toBe(true);
        expect(state.triggeredModeratorRounds.has(roundNumber)).toBe(true);
      });
    });

    describe('markModeratorStreamTriggered', () => {
      it('should add moderator ID to triggeredModeratorIds Set', () => {
        const moderatorId = 'thread_123_r0_moderator';
        const roundNumber = 0;

        store.getState().markModeratorStreamTriggered(moderatorId, roundNumber);

        expect(store.getState().triggeredModeratorIds.has(moderatorId)).toBe(true);
      });

      it('should add round number to triggeredModeratorRounds Set', () => {
        const moderatorId = 'thread_123_r0_moderator';
        const roundNumber = 0;

        store.getState().markModeratorStreamTriggered(moderatorId, roundNumber);

        expect(store.getState().triggeredModeratorRounds.has(roundNumber)).toBe(true);
      });

      it('should add to both Sets simultaneously', () => {
        const moderatorId = 'thread_123_r1_moderator';
        const roundNumber = 1;

        store.getState().markModeratorStreamTriggered(moderatorId, roundNumber);

        const state = store.getState();
        expect(state.triggeredModeratorIds.has(moderatorId)).toBe(true);
        expect(state.triggeredModeratorRounds.has(roundNumber)).toBe(true);
      });

      it('should handle multiple moderator triggers across rounds', () => {
        const moderator0 = { id: 'thread_123_r0_moderator', round: 0 };
        const moderator1 = { id: 'thread_123_r1_moderator', round: 1 };
        const moderator2 = { id: 'thread_123_r2_moderator', round: 2 };

        store.getState().markModeratorStreamTriggered(moderator0.id, moderator0.round);
        store.getState().markModeratorStreamTriggered(moderator1.id, moderator1.round);
        store.getState().markModeratorStreamTriggered(moderator2.id, moderator2.round);

        const state = store.getState();
        expect(state.triggeredModeratorIds.size).toBe(3);
        expect(state.triggeredModeratorRounds.size).toBe(3);
      });
    });

    describe('clearModeratorTracking', () => {
      it('should clear triggeredModeratorIds Set', () => {
        const moderatorId = 'thread_123_r0_moderator';
        store.getState().markModeratorStreamTriggered(moderatorId, 0);
        expect(store.getState().triggeredModeratorIds.size).toBe(1);

        store.getState().clearModeratorTracking();

        expect(store.getState().triggeredModeratorIds.size).toBe(0);
      });

      it('should clear triggeredModeratorRounds Set', () => {
        const moderatorId = 'thread_123_r0_moderator';
        store.getState().markModeratorStreamTriggered(moderatorId, 0);
        expect(store.getState().triggeredModeratorRounds.size).toBe(1);

        store.getState().clearModeratorTracking();

        expect(store.getState().triggeredModeratorRounds.size).toBe(0);
      });

      it('should clear both Sets simultaneously', () => {
        store.getState().markModeratorStreamTriggered('mod1', 0);
        store.getState().markModeratorStreamTriggered('mod2', 1);

        store.getState().clearModeratorTracking();

        const state = store.getState();
        expect(state.triggeredModeratorIds.size).toBe(0);
        expect(state.triggeredModeratorRounds.size).toBe(0);
      });
    });
  });

  // ===========================================================================
  // 2. MODERATOR STREAMING STATE (derived from phase)
  // ===========================================================================

  describe('moderator streaming state', () => {
    describe('deriveIsModeratorStreaming from phase transitions', () => {
      it('should derive moderator streaming as false when phase is IDLE', () => {
        expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(false);
      });

      it('should derive moderator streaming as true when phase is MODERATOR', () => {
        // Transition to PARTICIPANTS first (required for MODERATOR transition)
        setupRoundWithParticipants(store, 2);
        expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

        // Complete all participants to transition to MODERATOR
        completeAllParticipants(store, 2);
        expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

        expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(true);
      });

      it('should derive moderator streaming as false after onModeratorComplete', () => {
        // Setup: get to MODERATOR phase
        setupRoundWithParticipants(store, 2);
        completeAllParticipants(store, 2);
        expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(true);

        store.getState().onModeratorComplete();

        expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(false);
        expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
      });
    });

    describe('onModeratorComplete', () => {
      it('should transition phase to COMPLETE', () => {
        // Setup: get to MODERATOR phase
        setupRoundWithParticipants(store, 2);
        completeAllParticipants(store, 2);
        expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

        store.getState().onModeratorComplete();

        expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
      });

      it('should derive isStreaming as false after completion', () => {
        // Setup
        setupRoundWithParticipants(store, 2);
        completeAllParticipants(store, 2);
        expect(deriveIsStreaming(store.getState().phase)).toBe(true);

        store.getState().onModeratorComplete();

        expect(deriveIsStreaming(store.getState().phase)).toBe(false);
      });

      it('should derive isModeratorStreaming as false after completion', () => {
        // Setup: moderator is streaming
        setupRoundWithParticipants(store, 2);
        completeAllParticipants(store, 2);
        expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(true);

        store.getState().onModeratorComplete();

        expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(false);
      });
    });

    describe('completeStreaming during MODERATOR phase', () => {
      it('should transition from MODERATOR to COMPLETE phase', () => {
        // Setup: in MODERATOR phase
        setupRoundWithParticipants(store, 2);
        completeAllParticipants(store, 2);
        expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

        store.getState().completeStreaming();

        expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
      });

      it('should derive isStreaming as false when completing from MODERATOR phase', () => {
        setupRoundWithParticipants(store, 2);
        completeAllParticipants(store, 2);
        expect(deriveIsStreaming(store.getState().phase)).toBe(true);

        store.getState().completeStreaming();

        expect(deriveIsStreaming(store.getState().phase)).toBe(false);
      });

      it('should transition to COMPLETE from PARTICIPANTS phase', () => {
        setupRoundWithParticipants(store, 2);
        expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

        store.getState().completeStreaming();

        // completeStreaming transitions to COMPLETE from any active streaming phase
        expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
      });
    });
  });

  // ===========================================================================
  // 3. MODERATOR TIMING (Frame 5 -> Frame 6)
  // ===========================================================================

  describe('moderator timing (Frame 5 -> Frame 6)', () => {
    it('should be in PARTICIPANTS phase before moderator can start', () => {
      setupRoundWithParticipants(store, 2);

      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    });

    it('should transition to MODERATOR phase when all participants complete', () => {
      // Start round
      setupRoundWithParticipants(store, 2);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // Complete all participants
      completeAllParticipants(store, 2);

      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);
    });

    it('should not transition to MODERATOR if not all participants are complete', () => {
      setupRoundWithParticipants(store, 2);

      // Only first participant complete
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(0);

      // Should still be in PARTICIPANTS (only 1 of 2 completed)
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    });

    it('should transition to COMPLETE phase after moderator finishes', () => {
      // Start round and complete all participants
      setupRoundWithParticipants(store, 2);
      completeAllParticipants(store, 2);

      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

      // Moderator completes
      store.getState().onModeratorComplete();

      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
    });

    it('should handle out-of-order participant completion', () => {
      setupRoundWithParticipants(store, 2);

      // P1 completes before P0
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(1);

      // Should still be in PARTICIPANTS (P0 not complete)
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // Now P0 completes
      completeParticipant(store, 0);

      // Now should be in MODERATOR
      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);
    });
  });

  // ===========================================================================
  // 4. DEDUPLICATION FOR MODERATOR
  // ===========================================================================

  describe('deduplication for moderator', () => {
    it('should not trigger same moderator ID twice', () => {
      const moderatorId = 'thread_123_r0_moderator';
      const roundNumber = 0;

      // First trigger
      store.getState().markModeratorStreamTriggered(moderatorId, roundNumber);
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber)).toBe(true);

      // Second trigger (should be detected as duplicate)
      const isAlreadyTriggered = store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber);
      expect(isAlreadyTriggered).toBe(true);
    });

    it('should not trigger same round number twice', () => {
      const moderatorId1 = 'thread_123_r0_moderator';
      const moderatorId2 = 'thread_456_r0_moderator';
      const roundNumber = 0;

      // First trigger for round 0
      store.getState().markModeratorStreamTriggered(moderatorId1, roundNumber);

      // Second trigger with different ID but same round
      const isAlreadyTriggered = store.getState().hasModeratorStreamBeenTriggered(moderatorId2, roundNumber);
      expect(isAlreadyTriggered).toBe(true);
    });

    it('should return true after marking moderator as triggered', () => {
      const moderatorId = 'thread_123_r0_moderator';
      const roundNumber = 0;

      // Before marking
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber)).toBe(false);

      // Mark
      store.getState().markModeratorStreamTriggered(moderatorId, roundNumber);

      // After marking
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber)).toBe(true);
    });

    it('should allow different rounds to be triggered independently', () => {
      const moderatorR0 = { id: 'thread_123_r0_moderator', round: 0 };
      const moderatorR1 = { id: 'thread_123_r1_moderator', round: 1 };

      // Trigger round 0
      store.getState().markModeratorStreamTriggered(moderatorR0.id, moderatorR0.round);

      // Round 1 should not be triggered yet
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorR1.id, moderatorR1.round)).toBe(false);

      // Trigger round 1
      store.getState().markModeratorStreamTriggered(moderatorR1.id, moderatorR1.round);

      // Both should be triggered
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorR0.id, moderatorR0.round)).toBe(true);
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorR1.id, moderatorR1.round)).toBe(true);
    });

    it('should handle multiple concurrent trigger checks without race conditions', () => {
      const moderatorId = 'thread_123_r0_moderator';
      const roundNumber = 0;

      // Simulate concurrent checks (like from multiple useEffect hooks)
      const check1 = store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber);
      const check2 = store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber);

      expect(check1).toBe(false);
      expect(check2).toBe(false);

      // First one marks
      store.getState().markModeratorStreamTriggered(moderatorId, roundNumber);

      // Subsequent checks should see it as triggered
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorId, roundNumber)).toBe(true);
    });
  });

  // ===========================================================================
  // 5. THREAD NAVIGATION CLEARS MODERATOR TRACKING
  // ===========================================================================

  describe('thread navigation clears moderator tracking', () => {
    beforeEach(() => {
      // Transition to MODERATOR phase so deriveIsModeratorStreaming returns true
      setupRoundWithParticipants(store, 2);
      completeAllParticipants(store, 2);
      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);
      expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(true);

      // Setup moderator tracking AFTER initializeThread (which clears tracking)
      store.getState().markModeratorStreamTriggered('mod1', 0);
      store.getState().markModeratorStreamTriggered('mod2', 1);
    });

    it('should clear triggeredModeratorIds on resetForThreadNavigation', () => {
      expect(store.getState().triggeredModeratorIds.size).toBeGreaterThanOrEqual(2);

      store.getState().resetForThreadNavigation();

      expect(store.getState().triggeredModeratorIds.size).toBe(0);
    });

    it('should clear triggeredModeratorRounds on resetForThreadNavigation', () => {
      expect(store.getState().triggeredModeratorRounds.size).toBeGreaterThanOrEqual(2);

      store.getState().resetForThreadNavigation();

      expect(store.getState().triggeredModeratorRounds.size).toBe(0);
    });

    it('should reset phase on resetForThreadNavigation (phase derives moderator streaming)', () => {
      // Phase is MODERATOR, so deriveIsModeratorStreaming returns true
      expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(true);

      store.getState().resetForThreadNavigation();

      // After navigation reset, phase is back to IDLE
      // so deriveIsModeratorStreaming returns false
      expect(deriveIsModeratorStreaming(store.getState().phase)).toBe(false);
    });

    it('should reset moderator tracking Sets on resetForThreadNavigation', () => {
      store.getState().resetForThreadNavigation();

      const state = store.getState();
      // Tracking Sets ARE reset (they are explicitly included in THREAD_NAVIGATION_RESET)
      expect(state.triggeredModeratorIds.size).toBe(0);
      expect(state.triggeredModeratorRounds.size).toBe(0);
    });

    it('should clear moderator tracking on resetToOverview', () => {
      store.getState().resetToOverview();

      const state = store.getState();
      expect(state.triggeredModeratorIds.size).toBe(0);
      expect(state.triggeredModeratorRounds.size).toBe(0);
    });

    it('should clear moderator tracking on resetToNewChat', () => {
      store.getState().resetToNewChat();

      const state = store.getState();
      expect(state.triggeredModeratorIds.size).toBe(0);
      expect(state.triggeredModeratorRounds.size).toBe(0);
    });
  });

  // ===========================================================================
  // 6. ROUND 2+ MODERATOR BEHAVIOR
  // ===========================================================================

  describe('round 2+ moderator behavior', () => {
    it('should allow new round to trigger new moderator after previous round complete', () => {
      // Round 0
      const moderatorR0 = 'thread_123_r0_moderator';
      store.getState().markModeratorStreamTriggered(moderatorR0, 0);
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorR0, 0)).toBe(true);

      // Round 1 should be allowed
      const moderatorR1 = 'thread_123_r1_moderator';
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorR1, 1)).toBe(false);

      store.getState().markModeratorStreamTriggered(moderatorR1, 1);
      expect(store.getState().hasModeratorStreamBeenTriggered(moderatorR1, 1)).toBe(true);
    });

    it('should maintain separate tracking for each round', () => {
      // Trigger moderators for rounds 0, 1, 2
      store.getState().markModeratorStreamTriggered('mod_r0', 0);
      store.getState().markModeratorStreamTriggered('mod_r1', 1);
      store.getState().markModeratorStreamTriggered('mod_r2', 2);

      // Verify each round is independently tracked
      expect(store.getState().triggeredModeratorRounds.has(0)).toBe(true);
      expect(store.getState().triggeredModeratorRounds.has(1)).toBe(true);
      expect(store.getState().triggeredModeratorRounds.has(2)).toBe(true);
      expect(store.getState().triggeredModeratorRounds.has(3)).toBe(false);
    });

    it('should not let previous round moderator tracking affect new round', () => {
      // Complete round 0
      setupRoundWithParticipants(store, 2, 0);
      store.getState().markModeratorStreamTriggered('mod_r0', 0);
      completeAllParticipants(store, 2);
      store.getState().onModeratorComplete();

      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);

      // Start round 1
      store.getState().prepareForNewMessage();
      setupRoundWithParticipants(store, 2, 1);

      // Round 1 moderator should be fresh (not triggered)
      expect(store.getState().hasModeratorStreamBeenTriggered('mod_r1', 1)).toBe(false);

      // Can trigger round 1 moderator
      store.getState().markModeratorStreamTriggered('mod_r1', 1);
      expect(store.getState().hasModeratorStreamBeenTriggered('mod_r1', 1)).toBe(true);
    });

    it('should correctly complete full flow for multiple rounds', () => {
      for (let round = 0; round < 3; round++) {
        if (round > 0) {
          store.getState().prepareForNewMessage();
        }

        // Initialize round
        // NOTE: initializeThread (called by setupRoundWithParticipants) resets
        // moderator tracking Sets, so tracking is per-thread-init, not accumulated.
        setupRoundWithParticipants(store, 2, round);
        expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

        // Complete participants
        completeAllParticipants(store, 2);

        // Should transition to MODERATOR
        expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

        // Mark moderator triggered
        const moderatorId = `mod_r${round}`;
        expect(store.getState().hasModeratorStreamBeenTriggered(moderatorId, round)).toBe(false);
        store.getState().markModeratorStreamTriggered(moderatorId, round);
        expect(store.getState().hasModeratorStreamBeenTriggered(moderatorId, round)).toBe(true);

        // Complete moderator
        store.getState().onModeratorComplete();
        expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
      }

      // Verify last round's tracking is present
      // initializeThread resets tracking per thread init, so only the latest round's tracking survives
      expect(store.getState().triggeredModeratorRounds.has(2)).toBe(true);
    });
  });

  // ===========================================================================
  // 7. PHASE-BASED PARTICIPANT COMPLETION TRACKING
  // ===========================================================================

  describe('phase-based participant completion tracking', () => {
    it('should track completed participant count after startRound', () => {
      setupRoundWithParticipants(store, 3);

      const state = store.getState();
      expect(state.completedParticipantCount).toBe(0);
      expect(state.activeRoundParticipantCount).toBe(3);
    });

    it('should increment completed count on incrementCompletedParticipants', () => {
      setupRoundWithParticipants(store, 3);

      store.getState().incrementCompletedParticipants();

      expect(store.getState().completedParticipantCount).toBe(1);
    });

    it('should transition to MODERATOR when all participants complete', () => {
      setupRoundWithParticipants(store, 3);

      completeAllParticipants(store, 3);

      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);
      expect(store.getState().completedParticipantCount).toBe(3);
    });

    it('should reset completed count on prepareForNewMessage', () => {
      setupRoundWithParticipants(store, 2);
      completeAllParticipants(store, 2);
      store.getState().onModeratorComplete();

      store.getState().prepareForNewMessage();

      expect(store.getState().completedParticipantCount).toBe(0);
      expect(store.getState().activeRoundParticipantCount).toBe(0);
    });
  });

  // ===========================================================================
  // 8. GUARD CONDITIONS
  // ===========================================================================

  describe('guard conditions', () => {
    it('should not transition on completeStreaming if already in COMPLETE phase', () => {
      // Need thread for completeStreaming guard to pass
      const thread = createMockThread({ id: 'thread-guard' });
      store.setState({ phase: ChatPhases.COMPLETE, thread });

      // completeStreaming guards against non-streaming phases
      store.getState().completeStreaming();

      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
    });

    it('should not transition to MODERATOR from IDLE phase via onParticipantComplete', () => {
      // onParticipantComplete has a guard: phase must be PARTICIPANTS
      store.getState().onParticipantComplete(0);

      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });

    it('should handle onModeratorComplete gracefully when not in MODERATOR phase', () => {
      // Set up with a thread (required by guard) but stay in PARTICIPANTS phase
      const thread = createMockThread({ id: 'thread-guard-2' });
      store.setState({ phase: ChatPhases.PARTICIPANTS, thread });

      // onModeratorComplete has a guard: phase must be MODERATOR
      store.getState().onModeratorComplete();

      // Should NOT transition (guard rejects non-MODERATOR phase)
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    });
  });
});
