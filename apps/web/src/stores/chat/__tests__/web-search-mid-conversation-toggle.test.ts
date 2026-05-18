/**
 * Web Search Mid-Conversation Toggle Tests
 *
 * Tests specifically for the bug report scenario:
 * - Web search being enabled/disabled mid-way through multiple rounds
 * - Ensuring web search NEVER creates new participants
 * - Verifying all participants see web search data in their context
 *
 * @see docs/FLOW_DOCUMENTATION.md Section 2 - Web Search Functionality
 */

import { MessageStatuses } from '@debatekit/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createMockParticipants,
  createMockStoredPreSearch,
  createMockThread,
} from '@/lib/testing';

import { createChatStore } from '../store';

// ============================================================================
// Test Setup
// ============================================================================

type TestStore = ReturnType<typeof createChatStore>;

function completeRound(store: TestStore, _roundNumber: number, participantCount: number) {
  for (let i = 0; i < participantCount; i++) {
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(i);
  }
  store.getState().onModeratorComplete();
}

// ============================================================================
// SCENARIO: Complex Multi-Round Toggle Patterns
// ============================================================================

describe('complex Multi-Round Web Search Toggle Patterns', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should handle: R0(off) -> R1(on) -> R2(on) -> R3(off) -> R4(on) -> R5(off)', () => {
    const thread = createMockThread({
      enableWebSearch: false,
      id: 'thread-toggle-test',
    });
    const participants = createMockParticipants(3);

    store.setState({ participants, thread });
    store.getState().setEnableWebSearch(false);

    // Track participant count at each step
    const participantCounts: number[] = [];
    const preSearchCounts: number[] = [];

    // Round 0: OFF
    store.getState().startRound(0, 3);
    completeRound(store, 0, 3);
    participantCounts.push(store.getState().participants.length);
    preSearchCounts.push(store.getState().preSearches.length);

    // Round 1: ON
    store.getState().setEnableWebSearch(true);
    store.getState().startRound(1, 3, true);
    store.getState().transitionToParticipants();
    store.getState().addPreSearch(createMockStoredPreSearch(1, MessageStatuses.COMPLETE, {
      threadId: 'thread-toggle-test',
    }));
    completeRound(store, 1, 3);
    participantCounts.push(store.getState().participants.length);
    preSearchCounts.push(store.getState().preSearches.length);

    // Round 2: ON
    store.getState().startRound(2, 3, true);
    store.getState().transitionToParticipants();
    store.getState().addPreSearch(createMockStoredPreSearch(2, MessageStatuses.COMPLETE, {
      threadId: 'thread-toggle-test',
    }));
    completeRound(store, 2, 3);
    participantCounts.push(store.getState().participants.length);
    preSearchCounts.push(store.getState().preSearches.length);

    // Round 3: OFF
    store.getState().setEnableWebSearch(false);
    store.getState().startRound(3, 3);
    completeRound(store, 3, 3);
    participantCounts.push(store.getState().participants.length);
    preSearchCounts.push(store.getState().preSearches.length);

    // Round 4: ON
    store.getState().setEnableWebSearch(true);
    store.getState().startRound(4, 3, true);
    store.getState().transitionToParticipants();
    store.getState().addPreSearch(createMockStoredPreSearch(4, MessageStatuses.COMPLETE, {
      threadId: 'thread-toggle-test',
    }));
    completeRound(store, 4, 3);
    participantCounts.push(store.getState().participants.length);
    preSearchCounts.push(store.getState().preSearches.length);

    // Round 5: OFF
    store.getState().setEnableWebSearch(false);
    store.getState().startRound(5, 3);
    completeRound(store, 5, 3);
    participantCounts.push(store.getState().participants.length);
    preSearchCounts.push(store.getState().preSearches.length);

    // CRITICAL: Participant count should NEVER change
    expect(participantCounts).toEqual([3, 3, 3, 3, 3, 3]);

    // Pre-search counts should match toggle pattern
    // startRound with enableWebSearch=true auto-creates a presearch entry,
    // plus we add one manually. The auto-created ones share threadId+roundNumber
    // so addPreSearch deduplicates. Expect 3 total (rounds 1, 2, 4).
    expect(preSearchCounts).toEqual([0, 1, 2, 2, 3, 3]);

    // Verify final state
    expect(store.getState().participants).toHaveLength(3);
    expect(store.getState().preSearches).toHaveLength(3);
  });

  it('should correctly associate pre-search data with the right round', () => {
    const participants = createMockParticipants(2);
    store.setState({
      participants,
      thread: createMockThread({ enableWebSearch: true, id: 'thread-round-assoc' }),
    });

    // Add pre-searches for specific rounds with distinct data
    store.getState().addPreSearch({
      ...createMockStoredPreSearch(0, MessageStatuses.COMPLETE),
      searchData: {
        failureCount: 0,
        queries: [{ index: 0, query: 'round 0 query', rationale: '', searchDepth: 'basic', total: 1 }],
        results: [],
        successCount: 1,
        summary: 'Round 0 summary',
        totalResults: 10,
        totalTime: 500,
      },
      threadId: 'thread-round-assoc',
    });

    store.getState().addPreSearch({
      ...createMockStoredPreSearch(2, MessageStatuses.COMPLETE),
      searchData: {
        failureCount: 0,
        queries: [{ index: 0, query: 'round 2 query', rationale: '', searchDepth: 'basic', total: 1 }],
        results: [],
        successCount: 1,
        summary: 'Round 2 summary',
        totalResults: 15,
        totalTime: 700,
      },
      threadId: 'thread-round-assoc',
    });

    // Skip round 1 (no web search)
    store.getState().addPreSearch({
      ...createMockStoredPreSearch(4, MessageStatuses.COMPLETE),
      searchData: {
        failureCount: 0,
        queries: [{ index: 0, query: 'round 4 query', rationale: '', searchDepth: 'basic', total: 1 }],
        results: [],
        successCount: 1,
        summary: 'Round 4 summary',
        totalResults: 20,
        totalTime: 900,
      },
      threadId: 'thread-round-assoc',
    });

    // Verify data integrity
    const r0 = store.getState().preSearches.find(ps => ps.roundNumber === 0);
    const r1 = store.getState().preSearches.find(ps => ps.roundNumber === 1);
    const r2 = store.getState().preSearches.find(ps => ps.roundNumber === 2);
    const r4 = store.getState().preSearches.find(ps => ps.roundNumber === 4);

    expect(r0?.searchData?.summary).toBe('Round 0 summary');
    expect(r1).toBeUndefined(); // No pre-search for round 1
    expect(r2?.searchData?.summary).toBe('Round 2 summary');
    expect(r4?.searchData?.summary).toBe('Round 4 summary');

    // Participant count unchanged
    expect(store.getState().participants).toHaveLength(2);
  });

  it('should NOT add gemini models as participants when web search completes', () => {
    const participants = [
      { ...createMockParticipants(1)[0], modelId: 'anthropic/claude-sonnet-4' },
      { ...createMockParticipants(1)[0], id: 'p1', modelId: 'openai/gpt-5', priority: 1 },
    ];

    store.setState({
      participants,
      thread: createMockThread({ enableWebSearch: true, id: 'thread-no-gemini' }),
    });

    store.getState().setEnableWebSearch(true);
    store.getState().startRound(0, 2, true);
    store.getState().transitionToParticipants();

    // Add pre-search (which internally uses gemini-2.5-flash)
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.COMPLETE, {
      searchData: {
        failureCount: 0,
        queries: [{ index: 0, query: 'test', rationale: '', searchDepth: 'basic', total: 1 }],
        results: [
          {
            index: 0,
            query: 'test',
            results: [
              { content: 'Content', domain: 'test.com', title: 'Test', url: 'https://test.com' },
            ],
          },
        ],
        successCount: 1,
        summary: 'Search done',
        totalResults: 1,
        totalTime: 500,
      },
      threadId: 'thread-no-gemini',
    }));

    // Complete round
    completeRound(store, 0, 2);

    // CRITICAL: Only user-configured models should exist
    const modelIds = store.getState().participants.map(p => p.modelId);
    expect(modelIds).toEqual(['anthropic/claude-sonnet-4', 'openai/gpt-5']);
    expect(modelIds).not.toContain('google/gemini-2.5-flash');
    expect(modelIds).not.toContain('google/gemini-2.0-flash-001');
    expect(store.getState().participants).toHaveLength(2);
  });

  it('should maintain participant count consistency with web search toggle', () => {
    const participants = createMockParticipants(2);
    store.setState({
      participants,
      thread: createMockThread({ enableWebSearch: false, id: 'thread-model-ids' }),
    });

    // Enable web search
    store.getState().setEnableWebSearch(true);
    store.getState().startRound(0, 2, true);
    store.getState().transitionToParticipants();

    // Add pre-search
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.COMPLETE, {
      threadId: 'thread-model-ids',
    }));

    // Participant count should NOT change
    expect(store.getState().participants).toHaveLength(2);
    expect(store.getState().activeRoundParticipantCount).toBe(2);

    // No web search model should appear as a participant
    const participantModelIds = store.getState().participants.map(p => p.modelId);
    expect(participantModelIds).not.toContain('google/gemini-2.5-flash');
  });
});

// ============================================================================
// SCENARIO: Error Recovery with Web Search
// ============================================================================

describe('error Recovery with Web Search', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should maintain participant integrity when pre-search fails then succeeds in next round', () => {
    const participants = createMockParticipants(2);
    store.setState({
      participants,
      thread: createMockThread({ enableWebSearch: true, id: 'thread-error-recovery' }),
    });

    // Round 0: Pre-search fails
    // startRound with enableWebSearch=true auto-creates a STREAMING presearch entry
    store.getState().setEnableWebSearch(true);
    store.getState().startRound(0, 2, true);
    store.getState().updatePreSearchStatus(0, MessageStatuses.FAILED);
    store.getState().transitionToParticipants();

    // Complete round 0 despite failed pre-search
    completeRound(store, 0, 2);
    expect(store.getState().participants).toHaveLength(2);

    // Round 1: Pre-search succeeds (auto-created by startRound)
    store.getState().startRound(1, 2, true);
    store.getState().updatePreSearchStatus(1, MessageStatuses.COMPLETE);
    store.getState().transitionToParticipants();

    completeRound(store, 1, 2);

    // Still only 2 participants
    expect(store.getState().participants).toHaveLength(2);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.status).toBe(MessageStatuses.FAILED);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 1)?.status).toBe(MessageStatuses.COMPLETE);
  });

  it('should handle pre-search status transitions correctly', () => {
    const participants = createMockParticipants(2);
    store.setState({
      participants,
      thread: createMockThread({ enableWebSearch: true, id: 'thread-status-trans' }),
    });

    store.getState().setEnableWebSearch(true);
    // startRound with enableWebSearch=true auto-creates a STREAMING presearch entry
    store.getState().startRound(0, 2, true);

    // Auto-created with STREAMING status
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.status).toBe(MessageStatuses.STREAMING);
    expect(store.getState().participants).toHaveLength(2);

    // COMPLETE
    store.getState().updatePreSearchStatus(0, MessageStatuses.COMPLETE);
    store.getState().updatePreSearchData(0, {
      failureCount: 0,
      queries: [],
      results: [],
      successCount: 1,
      summary: 'Done',
      totalResults: 5,
      totalTime: 500,
    });
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.status).toBe(MessageStatuses.COMPLETE);
    expect(store.getState().participants).toHaveLength(2);
  });
});

// ============================================================================
// SCENARIO: Phase-Based Isolation from Pre-Search
// ============================================================================

describe('phase-Based Isolation from Pre-Search', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should keep activeRoundParticipantCount separate from presearch tracking', () => {
    const participants = createMockParticipants(3);
    store.setState({
      participants,
      thread: createMockThread({ enableWebSearch: true, id: 'thread-sub-isolation' }),
    });

    store.getState().setEnableWebSearch(true);
    store.getState().startRound(0, 3, true);

    // Add pre-search
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.STREAMING, {
      threadId: 'thread-sub-isolation',
    }));

    // activeRoundParticipantCount should be exactly 3
    expect(store.getState().activeRoundParticipantCount).toBe(3);

    // Pre-search array is separate
    expect(store.getState().preSearches).toHaveLength(1);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.status).toBe(MessageStatuses.STREAMING);
  });

  it('should NOT add pre-search model to participant count', () => {
    const participants = createMockParticipants(2);
    store.setState({
      participants,
      thread: createMockThread({ enableWebSearch: true, id: 'thread-no-presearch-sub' }),
    });

    store.getState().setEnableWebSearch(true);
    store.getState().startRound(0, 2, true);

    const initialParticipantCount = store.getState().activeRoundParticipantCount;

    // Add multiple pre-searches
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.COMPLETE, {
      threadId: 'thread-no-presearch-sub',
    }));
    store.getState().addPreSearch(createMockStoredPreSearch(1, MessageStatuses.COMPLETE, {
      threadId: 'thread-no-presearch-sub',
    }));

    // Participant count should remain unchanged
    expect(store.getState().activeRoundParticipantCount).toBe(initialParticipantCount);
  });
});
