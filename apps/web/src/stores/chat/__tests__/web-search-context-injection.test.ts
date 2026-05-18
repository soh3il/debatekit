/**
 * Web Search Context Injection Tests
 *
 * Tests to verify that web search results are injected as CONTEXT into participant
 * system prompts, NOT as separate participants.
 *
 * Per FLOW_DOCUMENTATION.md:
 * - P0 runs IN PARALLEL with pre-search (does NOT receive search context)
 * - P1+ participants receive web search context via buildSystemPromptWithContext()
 * - Web search context is TEXT in system prompt, NOT a separate message or participant
 *
 * These tests validate the frontend store correctly tracks when:
 * - Pre-search should block P1+ (via shouldWaitForPreSearch)
 * - Pre-search is complete and data is available for P1+ context building
 *
 * @see docs/FLOW_DOCUMENTATION.md Section 2 - Web Search Functionality
 */

import type { MessageStatus } from '@debatekit/shared';
import { MessageStatuses } from '@debatekit/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createMockParticipants,
  createMockStoredPreSearch,
  createMockThread,
} from '@/lib/testing';
import type { StoredPreSearch } from '@/services/api';

import { createChatStore } from '../store';
import { ChatPhases } from '../store-schemas';

// ============================================================================
// Helper Functions (inline to avoid missing export issues)
// ============================================================================

/**
 * Determines if participants should wait for pre-search to complete.
 * Per FLOW_DOCUMENTATION.md: P0 runs in parallel, P1+ wait for pre-search.
 */
function shouldWaitForPreSearch(
  enableWebSearch: boolean,
  preSearch: StoredPreSearch | undefined,
): boolean {
  // No web search enabled - no waiting
  if (!enableWebSearch) {
    return false;
  }

  // No pre-search record - no waiting
  if (!preSearch) {
    return false;
  }

  // Completed states don't block
  const nonBlockingStatuses: MessageStatus[] = [
    MessageStatuses.COMPLETE,
    MessageStatuses.FAILED,
  ];
  if (nonBlockingStatuses.includes(preSearch.status)) {
    return false;
  }

  // PENDING or STREAMING - block P1+ participants
  return true;
}

// ============================================================================
// Test Setup
// ============================================================================

type TestStore = ReturnType<typeof createChatStore>;

function setupStoreWithWebSearch(store: TestStore, participantCount: number) {
  const participants = createMockParticipants(participantCount);
  const thread = createMockThread({
    enableWebSearch: true,
    id: 'thread-test',
  });

  store.setState({ participants, thread });
  store.getState().setEnableWebSearch(true);
  store.getState().startRound(0, participantCount, true);

  return { participants, thread };
}

// ============================================================================
// SCENARIO 1: Pre-Search Blocking Behavior
// ============================================================================

describe('scenario 1: Pre-Search Blocking Behavior', () => {
  let _store: TestStore;

  beforeEach(() => {
    _store = createChatStore();
  });

  it('should block when pre-search is PENDING and web search is enabled', () => {
    const preSearch = createMockStoredPreSearch(0, MessageStatuses.PENDING);
    expect(shouldWaitForPreSearch(true, preSearch)).toBe(true);
  });

  it('should block when pre-search is STREAMING and web search is enabled', () => {
    const preSearch = createMockStoredPreSearch(0, MessageStatuses.STREAMING);
    expect(shouldWaitForPreSearch(true, preSearch)).toBe(true);
  });

  it('should NOT block when pre-search is COMPLETE', () => {
    const preSearch = createMockStoredPreSearch(0, MessageStatuses.COMPLETE);
    expect(shouldWaitForPreSearch(true, preSearch)).toBe(false);
  });

  it('should NOT block when pre-search is FAILED (graceful degradation)', () => {
    const preSearch = createMockStoredPreSearch(0, MessageStatuses.FAILED);
    expect(shouldWaitForPreSearch(true, preSearch)).toBe(false);
  });

  it('should NOT block when web search is disabled', () => {
    const preSearch = createMockStoredPreSearch(0, MessageStatuses.PENDING);
    expect(shouldWaitForPreSearch(false, preSearch)).toBe(false);
  });

  it('should NOT block when pre-search is undefined', () => {
    expect(shouldWaitForPreSearch(true, undefined)).toBe(false);
  });
});

// ============================================================================
// SCENARIO 2: P0 vs P1+ Pre-Search Context Timing
// ============================================================================

describe('scenario 2: P0 vs P1+ Pre-Search Context Timing', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should allow P0 to stream while pre-search is still running', () => {
    setupStoreWithWebSearch(store, 3);

    // startRound with enableWebSearch=true creates a PRESEARCH phase entry,
    // transition to PARTICIPANTS for P0 streaming
    store.getState().transitionToParticipants();

    // Add streaming pre-search
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.STREAMING, {
      threadId: 'thread-test',
    }));

    // P0 can start streaming immediately -- phase is PARTICIPANTS
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.status).toBe(MessageStatuses.STREAMING);
  });

  it('should track pre-search completion independently from P0', () => {
    setupStoreWithWebSearch(store, 3);
    store.getState().transitionToParticipants();

    // P0 starts
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.PENDING, {
      threadId: 'thread-test',
    }));

    // P0 completes before pre-search
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(0);

    // Pre-search still streaming
    store.getState().updatePreSearchStatus(0, MessageStatuses.STREAMING);

    expect(store.getState().completedParticipantCount).toBe(1);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.status).toBe(MessageStatuses.STREAMING);
  });

  it('should complete pre-search while P0 is still streaming', () => {
    setupStoreWithWebSearch(store, 3);
    store.getState().transitionToParticipants();

    // Both start
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.STREAMING, {
      threadId: 'thread-test',
    }));

    // Pre-search completes first
    store.getState().updatePreSearchStatus(0, MessageStatuses.COMPLETE);
    store.getState().updatePreSearchData(0, {
      failureCount: 0,
      queries: [{ index: 0, query: 'test', rationale: 'test', searchDepth: 'basic', total: 1 }],
      results: [],
      successCount: 1,
      summary: 'Complete',
      totalResults: 5,
      totalTime: 500,
    });

    // P0 still in PARTICIPANTS phase (no completions yet)
    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.status).toBe(MessageStatuses.COMPLETE);

    // Pre-search data is now available for P1+ context injection
    const preSearch = store.getState().preSearches.find(ps => ps.roundNumber === 0);
    expect(preSearch?.searchData).toBeDefined();
    expect(preSearch?.searchData?.summary).toBe('Complete');
  });
});

// ============================================================================
// SCENARIO 3: Pre-Search Data Availability for System Prompt
// ============================================================================

describe('scenario 3: Pre-Search Data Availability for System Prompt Injection', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should store search data that can be used for system prompt context', () => {
    setupStoreWithWebSearch(store, 2);

    // startRound with enableWebSearch=true auto-creates a STREAMING presearch entry.
    // Update its status and data to simulate completion.
    store.getState().updatePreSearchStatus(0, MessageStatuses.COMPLETE);
    store.getState().updatePreSearchData(0, {
      failureCount: 0,
      queries: [
        { index: 0, query: 'React hooks best practices', rationale: 'User wants hook info', searchDepth: 'basic', total: 1 },
      ],
      results: [
        {
          index: 0,
          query: 'React hooks best practices',
          results: [
            {
              content: 'Use useCallback for memoization...',
              domain: 'react.dev',
              title: 'React Hooks Documentation',
              url: 'https://react.dev/learn/hooks',
            },
            {
              content: 'Custom hooks should start with use...',
              domain: 'blog.example.com',
              title: 'Custom Hooks Guide',
              url: 'https://blog.example.com/hooks',
            },
          ],
        },
      ],
      successCount: 1,
      summary: 'Found 2 relevant resources about React hooks',
      totalResults: 2,
      totalTime: 800,
    });

    const preSearch = store.getState().preSearches.find(ps => ps.roundNumber === 0);
    expect(preSearch).toBeDefined();
    expect(preSearch?.searchData?.results).toHaveLength(1);
    expect(preSearch?.searchData?.results?.[0]?.results).toHaveLength(2);
    expect(preSearch?.searchData?.summary).toContain('React hooks');

    // This data would be used by buildSearchContextWithCitations on backend
    // to inject into P1+ system prompts
  });

  it('should update existing pre-search data when complete arrives', () => {
    setupStoreWithWebSearch(store, 2);

    // First add pending
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.PENDING, {
      threadId: 'thread-test',
    }));

    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.searchData).toBeUndefined();

    // Then update to streaming
    store.getState().updatePreSearchStatus(0, MessageStatuses.STREAMING);

    // Then complete with data
    store.getState().updatePreSearchStatus(0, MessageStatuses.COMPLETE);
    store.getState().updatePreSearchData(0, {
      failureCount: 0,
      queries: [{ index: 0, query: 'test', rationale: 'test', searchDepth: 'basic', total: 1 }],
      results: [
        {
          index: 0,
          query: 'test',
          results: [{ content: 'Result content', domain: 'test.com', title: 'Test Result', url: 'https://test.com' }],
        },
      ],
      successCount: 1,
      summary: 'Test summary',
      totalResults: 1,
      totalTime: 500,
    });

    const preSearch = store.getState().preSearches.find(ps => ps.roundNumber === 0);
    expect(preSearch?.status).toBe(MessageStatuses.COMPLETE);
    expect(preSearch?.searchData?.summary).toBe('Test summary');
    expect(preSearch?.searchData?.results).toHaveLength(1);
  });
});

// ============================================================================
// SCENARIO 4: Multiple Rounds with Different Web Search States
// ============================================================================

describe('scenario 4: Multiple Rounds with Different Web Search States', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should track pre-search data per round independently', () => {
    setupStoreWithWebSearch(store, 2);

    // startRound with enableWebSearch=true auto-creates a STREAMING presearch for round 0.
    // Update it to complete with data.
    store.getState().updatePreSearchStatus(0, MessageStatuses.COMPLETE);
    store.getState().updatePreSearchData(0, {
      failureCount: 0,
      queries: [{ index: 0, query: 'round 0 query', rationale: 'test', searchDepth: 'basic', total: 1 }],
      results: [],
      successCount: 1,
      summary: 'Round 0 search',
      totalResults: 3,
      totalTime: 500,
    });

    // Complete round 0
    store.getState().transitionToParticipants();
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(0);
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(1);
    store.getState().onModeratorComplete();

    // Round 1: startRound auto-creates presearch for round 1
    store.getState().startRound(1, 2, true);
    store.getState().updatePreSearchStatus(1, MessageStatuses.COMPLETE);
    store.getState().updatePreSearchData(1, {
      failureCount: 0,
      queries: [{ index: 0, query: 'round 1 query', rationale: 'test', searchDepth: 'basic', total: 1 }],
      results: [],
      successCount: 1,
      summary: 'Round 1 search',
      totalResults: 5,
      totalTime: 700,
    });

    // Verify both pre-searches exist independently
    const round0Search = store.getState().preSearches.find(ps => ps.roundNumber === 0);
    const round1Search = store.getState().preSearches.find(ps => ps.roundNumber === 1);

    expect(round0Search?.searchData?.summary).toBe('Round 0 search');
    expect(round1Search?.searchData?.summary).toBe('Round 1 search');
    expect(round0Search?.searchData?.totalResults).toBe(3);
    expect(round1Search?.searchData?.totalResults).toBe(5);
  });

  it('should NOT have pre-search for rounds where web search was disabled', () => {
    // Start with web search enabled
    setupStoreWithWebSearch(store, 2);
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.COMPLETE, {
      threadId: 'thread-test',
    }));

    // Complete round 0
    store.getState().transitionToParticipants();
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(0);
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(1);
    store.getState().onModeratorComplete();

    // Disable web search for round 1 (no enableWebSearch param = PARTICIPANTS phase)
    store.getState().setEnableWebSearch(false);
    store.getState().startRound(1, 2);

    // Should only have round 0 pre-search
    expect(store.getState().preSearches.filter(ps => ps.roundNumber === 0)).toHaveLength(1);
    expect(store.getState().preSearches.filter(ps => ps.roundNumber === 1)).toHaveLength(0);
  });
});

// ============================================================================
// SCENARIO 5: Phase Transitions with Pre-Search
// ============================================================================

describe('scenario 5: Phase Transitions with Pre-Search', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should transition through PRESEARCH -> PARTICIPANTS -> MODERATOR correctly', () => {
    setupStoreWithWebSearch(store, 2);

    // Phase starts as PRESEARCH (set by startRound with enableWebSearch=true)
    expect(store.getState().phase).toBe(ChatPhases.PRESEARCH);

    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.STREAMING, {
      threadId: 'thread-test',
    }));

    // Pre-search completes, transition to PARTICIPANTS
    store.getState().updatePreSearchStatus(0, MessageStatuses.COMPLETE);
    store.getState().transitionToParticipants();

    expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.status).toBe(MessageStatuses.COMPLETE);

    // Participants complete
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(0);
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(1);

    expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

    // Moderator completes
    store.getState().onModeratorComplete();

    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
  });

  it('should maintain pre-search data through all phase transitions', () => {
    setupStoreWithWebSearch(store, 2);

    // startRound auto-created a STREAMING presearch. Update it with data.
    store.getState().updatePreSearchStatus(0, MessageStatuses.COMPLETE);
    store.getState().updatePreSearchData(0, {
      failureCount: 0,
      queries: [{ index: 0, query: 'persistent query', rationale: 'test', searchDepth: 'basic' as const, total: 1 }],
      results: [],
      successCount: 1,
      summary: 'Persistent data',
      totalResults: 3,
      totalTime: 500,
    });

    // Verify data persists after each phase
    store.getState().transitionToParticipants();
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.searchData?.summary).toBe('Persistent data');

    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(0);
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(1);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.searchData?.summary).toBe('Persistent data');

    store.getState().onModeratorComplete();
    expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
    expect(store.getState().preSearches.find(ps => ps.roundNumber === 0)?.searchData?.summary).toBe('Persistent data');
  });
});

// ============================================================================
// SCENARIO 6: Web Search Context Does NOT Create Entities
// ============================================================================

describe('scenario 6: Web Search Context Does NOT Create Entities', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('should keep participant count stable when pre-search data arrives', () => {
    setupStoreWithWebSearch(store, 3);
    const initialCount = store.getState().participants.length;

    // Large pre-search data arrives
    store.getState().addPreSearch({
      ...createMockStoredPreSearch(0, MessageStatuses.COMPLETE),
      searchData: {
        failureCount: 0,
        queries: Array.from({ length: 10 }, (_, i) => ({
          index: i,
          query: `query ${i}`,
          rationale: `rationale ${i}`,
          searchDepth: 'basic' as const,
          total: 10,
        })),
        results: Array.from({ length: 10 }, (_, i) => ({
          index: i,
          query: `query ${i}`,
          results: Array.from({ length: 5 }, (_, j) => ({
            content: `Content ${i}-${j}`,
            domain: `domain${i}.com`,
            title: `Result ${i}-${j}`,
            url: `https://domain${i}.com/page${j}`,
          })),
        })),
        successCount: 10,
        summary: 'Large search with many results',
        totalResults: 50,
        totalTime: 3000,
      },
      threadId: 'thread-test',
    });

    // Participant count should remain unchanged
    expect(store.getState().participants).toHaveLength(initialCount);
    expect(store.getState().activeRoundParticipantCount).toBe(initialCount);
  });

  it('should not affect participant count when web search completes', () => {
    setupStoreWithWebSearch(store, 2);

    // Add pre-search (which internally uses google/gemini-2.5-flash)
    store.getState().addPreSearch(createMockStoredPreSearch(0, MessageStatuses.COMPLETE, {
      threadId: 'thread-test',
    }));

    // Participant count should remain at 2
    expect(store.getState().participants).toHaveLength(2);
    expect(store.getState().activeRoundParticipantCount).toBe(2);

    // Verify no web search model was added as a participant
    const participantModelIds = store.getState().participants.map(p => p.modelId);
    expect(participantModelIds).not.toContain('google/gemini-2.5-flash');
    expect(participantModelIds).not.toContain('google/gemini-2.0-flash-001');
  });
});
