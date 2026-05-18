/**
 * Edge Case Bug Tests
 *
 * Tests that expose actual bugs found in code review.
 * Only tests for store operations that exist after AI SDK migration:
 * - Phase transitions (startRound, onParticipantComplete, completeStreaming, onModeratorComplete)
 * - Participant management (setParticipants, setCurrentParticipantIndex)
 * - Participant completion tracking (incrementCompletedParticipants, onParticipantComplete)
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createMockParticipants,
  createMockThread,
} from '@/lib/testing';

import { deriveIsStreaming } from '../selectors';
import { createChatStore } from '../store';
import { ChatPhases } from '../store-schemas';

// ============================================================================
// Test Setup
// ============================================================================

type TestStore = ReturnType<typeof createChatStore>;

function setupRoundWithParticipants(
  store: TestStore,
  participantCount: number,
  roundNumber = 0,
) {
  const participants = createMockParticipants(participantCount);
  const thread = createMockThread();
  store.setState({ participants, thread });
  store.getState().initializeThread(thread, participants);
  store.getState().startRound(roundNumber, participantCount);
  return participants;
}

function completeParticipant(store: TestStore, index: number) {
  store.getState().incrementCompletedParticipants();
  store.getState().onParticipantComplete(index);
}

function completeAllParticipants(store: TestStore, count: number) {
  for (let i = 0; i < count; i++) {
    completeParticipant(store, i);
  }
}

// ============================================================================
// BUG 4: Invalid Participant Index Handling
// Issue: No validation that participant index is valid
// ============================================================================

describe('bUG 4: Invalid Participant Index Handling', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
    setupRoundWithParticipants(store, 2);
  });

  it('should handle NaN participant index gracefully in onParticipantComplete', () => {
    const nanIndex = Number.NaN;

    expect(() => {
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(nanIndex);
    }).not.toThrow();

    // Phase should remain PARTICIPANTS since only 1 of 2 completed
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
  });

  it('should handle negative participant index gracefully', () => {
    expect(() => {
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(-1);
    }).not.toThrow();

    // Phase should remain PARTICIPANTS since only 1 of 2 completed
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
  });

  it('should handle out-of-bounds participant index gracefully', () => {
    expect(() => {
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(99);
    }).not.toThrow();

    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
  });
});

// ============================================================================
// BUG 5: Phase Not Reaching COMPLETE on All Error Paths
// Issue: If streaming encounters errors, phase may not transition to COMPLETE
// ============================================================================

describe('bUG 5: Phase Transition Error Handling', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should reach COMPLETE phase when all participants complete and moderator completes', () => {
    setupRoundWithParticipants(store, 2);

    expect(deriveIsStreaming(store.getState().phase)).toBe(true);

    // All participants complete (error or success both increment completed count)
    completeAllParticipants(store, 2);

    // After all participants complete, phase should transition to MODERATOR
    expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

    // Complete moderator to finalize the round
    store.getState().onModeratorComplete();

    // Phase should be COMPLETE
    expect(deriveIsStreaming(store.getState().phase)).toBe(false);
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
  });

  it('should handle completeStreaming as a fallback during any streaming phase', () => {
    setupRoundWithParticipants(store, 2);

    // completeStreaming should work as a force-complete (thread is set by setup)
    store.getState().completeStreaming();

    expect(deriveIsStreaming(store.getState().phase)).toBe(false);
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
  });
});

// ============================================================================
// BUG 8: Participant Count Mismatch
// Issue: startRound creates participant tracking with a count, but if
// actual participants array has different length, completion tracking may fail
// ============================================================================

describe('bUG 8: Participant Count Mismatch', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
    const participants = createMockParticipants(3);
    const thread = createMockThread();
    store.setState({ participants, thread });
  });

  it('should track participant count from startRound, not from participants array', () => {
    // Start round for 5 participants when only 3 exist in the participants array
    store.getState().startRound(0, 5);

    expect(store.getState().activeRoundParticipantCount).toBe(5);

    // Incrementing completed participants works regardless of participants array length
    for (let i = 0; i < 5; i++) {
      store.getState().incrementCompletedParticipants();
    }
    expect(store.getState().completedParticipantCount).toBe(5);
  });

  it('should handle fewer tracked participants than participants array', () => {
    // Start round for 2 participants when 3 exist
    store.getState().startRound(0, 2);

    expect(store.getState().activeRoundParticipantCount).toBe(2);

    // Complete both tracked participants
    completeAllParticipants(store, 2);

    // Should transition to MODERATOR since both tracked participants completed
    expect(store.getState().phase).toBe(ChatPhases.MODERATOR);
  });

  it('should not transition prematurely with fewer completions than expected', () => {
    store.getState().startRound(0, 3);

    // Only complete 2 of 3
    completeParticipant(store, 0);
    completeParticipant(store, 1);

    // Should still be in PARTICIPANTS
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    expect(store.getState().completedParticipantCount).toBe(2);
    expect(store.getState().activeRoundParticipantCount).toBe(3);
  });
});

// ============================================================================
// BUG 9: Phase Transition Guards with Participant Completion
// Issue: onParticipantComplete relies on completedParticipantCount >= activeRoundParticipantCount
// which guards against premature transition
// ============================================================================

describe('bUG 9: Phase Transition Guards', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
    const participants = createMockParticipants(2);
    const thread = createMockThread();
    store.setState({ participants, thread });
  });

  it('should NOT transition to MODERATOR if not all participants complete', () => {
    store.getState().startRound(0, 2);

    // Only mark first participant complete
    completeParticipant(store, 0);

    // Should stay in PARTICIPANTS since P1 is still incomplete
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    expect(store.getState().completedParticipantCount).toBe(1);
  });

  it('should transition to MODERATOR when all participants complete', () => {
    store.getState().startRound(0, 2);

    completeAllParticipants(store, 2);

    // Both complete, should transition
    expect(store.getState().phase).toBe(ChatPhases.MODERATOR);
  });

  it('should skip MODERATOR and go to COMPLETE for single participant', () => {
    // Single participant skips moderator phase (no synthesis needed)
    const participants = createMockParticipants(1);
    store.setState({ participants });
    store.getState().startRound(0, 1);

    completeParticipant(store, 0);

    // Should go directly to COMPLETE
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
    expect(deriveIsStreaming(store.getState().phase)).toBe(false);
  });
});

// ============================================================================
// Participant Management Edge Cases
// ============================================================================

describe('participant Management Edge Cases', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should allow setting participants', () => {
    const participants = createMockParticipants(3);
    store.getState().setParticipants(participants);

    expect(store.getState().participants).toHaveLength(3);
  });

  it('should allow setCurrentParticipantIndex to any value (no bounds check)', () => {
    const participants = createMockParticipants(2);
    store.setState({ participants });

    // Valid index
    store.getState().setCurrentParticipantIndex(0);
    expect(store.getState().currentParticipantIndex).toBe(0);

    store.getState().setCurrentParticipantIndex(1);
    expect(store.getState().currentParticipantIndex).toBe(1);

    // Out of bounds - store allows it (no guard), consumer should validate
    store.getState().setCurrentParticipantIndex(99);
    expect(store.getState().currentParticipantIndex).toBe(99);
  });

  it('should replace participants when setParticipants is called again', () => {
    const first = createMockParticipants(2);
    store.getState().setParticipants(first);
    expect(store.getState().participants).toHaveLength(2);

    const second = createMockParticipants(5);
    store.getState().setParticipants(second);
    expect(store.getState().participants).toHaveLength(5);
  });
});

// ============================================================================
// Phase Transition Edge Cases
// ============================================================================

describe('phase Transition Edge Cases', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should transition through full round lifecycle', () => {
    expect(store.getState().phase).toBe(ChatPhases.IDLE);

    setupRoundWithParticipants(store, 2);
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    expect(deriveIsStreaming(store.getState().phase)).toBe(true);

    // Complete all participants
    completeAllParticipants(store, 2);

    // Should transition to moderator (2 participants requires synthesis)
    expect(store.getState().phase).toBe(ChatPhases.MODERATOR);
    expect(deriveIsStreaming(store.getState().phase)).toBe(true);

    // Complete moderator
    store.getState().onModeratorComplete();
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
    expect(deriveIsStreaming(store.getState().phase)).toBe(false);
  });

  it('should handle completeStreaming from PARTICIPANTS phase', () => {
    setupRoundWithParticipants(store, 2);
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

    store.getState().completeStreaming();
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
  });

  it('should handle completeStreaming from MODERATOR phase', () => {
    setupRoundWithParticipants(store, 2);

    // Complete both participants to reach MODERATOR
    completeAllParticipants(store, 2);
    expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

    store.getState().completeStreaming();
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
  });

  it('should NOT transition from IDLE via completeStreaming', () => {
    expect(store.getState().phase).toBe(ChatPhases.IDLE);

    store.getState().completeStreaming();
    // Should stay IDLE (guard prevents transition from non-streaming phase)
    expect(store.getState().phase).toBe(ChatPhases.IDLE);
  });

  it('should NOT transition from COMPLETE via completeStreaming', () => {
    setupRoundWithParticipants(store, 2);
    store.getState().completeStreaming();
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);

    // Calling again should be a no-op
    store.getState().completeStreaming();
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
  });

  it('should reset to idle', () => {
    setupRoundWithParticipants(store, 2);
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

    store.getState().resetToIdle();
    expect(store.getState().phase).toBe(ChatPhases.IDLE);
    expect(deriveIsStreaming(store.getState().phase)).toBe(false);
  });
});
