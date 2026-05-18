/**
 * Navigate-Back End-to-End Integration Tests
 *
 * Simulates the full lifecycle of:
 *   create thread → navigate away → navigate back
 *
 * Tests both fixes together against scenarios from FLOW_DOCUMENTATION.md:
 * - Fix 1: handleNoActiveStream IDLE phase handling
 * - Fix 2: useSyncHydrateStore title polling re-trigger
 *
 * Each scenario simulates the complete sequence of store operations that
 * would occur across provider, hooks, and store during a real navigation.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createMockParticipants, createMockThread } from '@/lib/testing';

import { deriveIsStreaming, deriveWaitingToStartStreaming } from '../selectors';
import { createChatStore } from '../store';
import { ChatPhases } from '../store-schemas';

// ============================================================================
// Types & Helpers
// ============================================================================

type TestStore = ReturnType<typeof createChatStore>;

type ThreadSetup = {
  threadId: string;
  participantCount: number;
  enableWebSearch?: boolean;
  projectId?: string | null;
  isAiGeneratedTitle?: boolean;
};

/**
 * Phase 1: Create thread and start streaming (user sends first message).
 */
function createThreadAndStartStreaming(store: TestStore, setup: ThreadSetup) {
  const { enableWebSearch = false, participantCount, projectId = null, threadId } = setup;

  const participants = createMockParticipants(participantCount, threadId);
  const thread = createMockThread({
    enableWebSearch,
    id: threadId,
    isAiGeneratedTitle: false,
    projectId,
    slug: `slug-${threadId}`,
  });

  store.setState({ participants, thread });
  store.getState().initializeThread(thread, participants);
  store.getState().setCreatedThreadId(threadId);
  if (projectId) {
    store.getState().setCreatedThreadProjectId(projectId);
  }
  store.getState().setHasInitiallyLoaded(true);
  store.getState().setPendingMessage('User prompt');
  store.getState().setCurrentRoundNumber(0);
  store.getState().startRound(0, participantCount, enableWebSearch);

  return { participants, thread };
}

/**
 * Phase 2: Navigate away (useNavigationCleanup fires).
 * Optionally saves streaming cache if phase is streaming.
 */
function navigateAway(store: TestStore) {
  // Reset store (what navigation cleanup does)
  store.getState().resetForThreadNavigation();
}

/**
 * Phase 3: Navigate back (route loader + useSyncHydrateStore).
 * Simulates hydration with the given thread state.
 */
function navigateBack(
  store: TestStore,
  setup: ThreadSetup & {
    hasMessages: boolean;
    roundNumber?: number;
    isAiGeneratedTitle?: boolean;
  },
) {
  const {
    hasMessages,
    isAiGeneratedTitle = false,
    participantCount,
    projectId = null,
    roundNumber = 0,
    threadId,
  } = setup;

  const participants = createMockParticipants(participantCount, threadId);
  const thread = createMockThread({
    enableWebSearch: setup.enableWebSearch ?? false,
    id: threadId,
    isAiGeneratedTitle,
    projectId,
    slug: `slug-${threadId}`,
  });

  const state = store.getState();

  // useSyncHydrateStore sequence
  state.initializeThread(thread, participants);
  state.setCurrentRoundNumber(roundNumber);
  state.setSelectedMode(thread.mode);
  state.setEnableWebSearch(thread.enableWebSearch);
  state.setInputValue('');

  // Fix 2: Title polling re-trigger
  const initialMessagesLength = hasMessages ? 3 : 0;
  if (!thread.isAiGeneratedTitle && initialMessagesLength > 0) {
    state.setCreatedThreadId(thread.id);
    if (thread.projectId) {
      state.setCreatedThreadProjectId(thread.projectId);
    }
  }

  state.setHasInitiallyLoaded(true);
  state.setShowInitialUI(false);

  return { participants, thread };
}

/**
 * Phase 4: AI SDK resume GET returns 204 → handleNoActiveStream fires.
 * Simulates the Fix 1 logic.
 */
function handleNoActiveStream204(store: TestStore): { invalidated: boolean } {
  const state = store.getState();

  if (!state.thread) {
    return { invalidated: false };
  }

  if (state.phase === 'idle') {
    if (
      state.hasInitiallyLoaded
      && state.currentRoundNumber !== null
      && state.currentRoundNumber >= 0
      && !state.pendingMessage
    ) {
      // queryClient.invalidateQueries fires here in real provider
      state.prepareForNewMessage();
      return { invalidated: true };
    }
    return { invalidated: false };
  }

  if (state.pendingMessage) {
    return { invalidated: false };
  }

  const threadId = state.thread.id;
  if (state.phase !== 'complete') {
    state.completeStreaming();
  }

  const freshState = store.getState();
  if (freshState.thread?.id === threadId) {
    freshState.prepareForNewMessage();
  }

  return { invalidated: false };
}

/**
 * Simulate backend completing a round while user is away:
 * completes all participants + moderator in the store.
 */
function _completeRoundInStore(store: TestStore, participantCount: number) {
  for (let i = 0; i < participantCount; i++) {
    store.getState().incrementCompletedParticipants();
    store.getState().onParticipantComplete(i);
  }
  if (participantCount >= 2) {
    store.getState().onModeratorComplete();
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('navigate-back E2E integration', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  // ==========================================================================
  // SCENARIO: Create → navigate away immediately → navigate back (backend done)
  // ==========================================================================

  describe('create → navigate away immediately → navigate back (backend completed)', () => {
    it('should show complete messages and trigger title polling', () => {
      const threadId = 'e2e-create-away-back';

      // 1. Create thread + start streaming
      createThreadAndStartStreaming(store, {
        participantCount: 2,
        threadId,
      });
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // 2. Navigate away immediately (phase still PARTICIPANTS)
      navigateAway(store);
      expect(store.getState().thread).toBeNull();
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      // 3. Backend completes round while user is away.

      // 4. Navigate back — route loader returns complete D1 data
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: false, // Title hasn't generated yet
        participantCount: 2,
        threadId,
      });

      // Phase should be IDLE (not streaming — backend already done)
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().hasInitiallyLoaded).toBe(true);

      // Fix 2: createdThreadId set for title polling
      expect(store.getState().createdThreadId).toBe(threadId);

      // 5. AI SDK resume GET → 204 (backend cleaned up active_stream)
      const result = handleNoActiveStream204(store);

      // Fix 1: Cache invalidated to force D1 refetch
      expect(result.invalidated).toBe(true);

      // Store finalized
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().pendingMessage).toBeNull();
      // prepareForNewMessage clears createdThreadId — but title polling already captured it
      expect(store.getState().createdThreadId).toBeNull();
    });
  });

  // ==========================================================================
  // SCENARIO: Create → navigate away during streaming → back (backend still active)
  // ==========================================================================

  describe('create → navigate away during streaming → back (backend still active)', () => {
    it('should hydrate as IDLE and let AI SDK resume reconnect', () => {
      const threadId = 'e2e-resume-active';

      // 1. Create + start streaming
      createThreadAndStartStreaming(store, {
        participantCount: 2,
        threadId,
      });

      // Simulate P0 complete
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(0);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // 2. Navigate away
      navigateAway(store);

      // 3. Navigate back — phase starts IDLE, AI SDK resume reconnects
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      // Phase is IDLE until AI SDK resume replays data-phase START markers
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().hasInitiallyLoaded).toBe(true);

      // AI SDK resume GET would return 200 + SSE here (not 204)
      // Streaming resumes via handleDataPart's resumeIntoStreaming()
    });
  });

  // ==========================================================================
  // SCENARIO: Create → navigate away during streaming → back (backend completed)
  // ==========================================================================

  describe('create → navigate away during streaming → back (backend completed while away)', () => {
    it('should invalidate cache and show D1 data', () => {
      const threadId = 'e2e-streaming-to-complete';

      // 1. Create + start streaming
      createThreadAndStartStreaming(store, {
        participantCount: 2,
        threadId,
      });
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      // 2. Navigate away during PARTICIPANTS
      navigateAway(store);

      // 3. Backend completes while user is away — cache is now stale.
      //    In production, the cache TTL (5 min) may expire, or the backend

      // 4. Navigate back — no cache to restore, phase stays IDLE
      store = createChatStore();
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      // Phase is IDLE (backend completed, no cache to restore)
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      // 5. Resume GET → 204
      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(true);
    });
  });

  // ==========================================================================
  // SCENARIO: Navigate back with title already generated
  // ==========================================================================

  describe('navigate back with title already generated', () => {
    it('should NOT trigger title polling when title exists', () => {
      const threadId = 'e2e-title-exists';

      // 1. Create + stream + navigate away
      createThreadAndStartStreaming(store, {
        participantCount: 2,
        threadId,
      });
      navigateAway(store);

      // 2. Backend completes + generates title while away

      // 3. Navigate back — title was generated
      store = createChatStore();
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: true, // Title generated!
        participantCount: 2,
        threadId,
      });

      // Fix 2: No title polling needed
      expect(store.getState().createdThreadId).toBeNull();

      // Fix 1: Cache still invalidated for data freshness
      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(true);
    });
  });

  // ==========================================================================
  // SCENARIO: Multi-round thread navigate-back
  // ==========================================================================

  describe('multi-round thread navigate-back', () => {
    it('round 2 completed on backend → navigate back → D1 data shows', () => {
      const threadId = 'e2e-multi-round';

      // Simulate already on round 2 (rounds 0-1 completed previously)
      store = createChatStore();
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 3,
        roundNumber: 2,
        threadId,
      });

      expect(store.getState().currentRoundNumber).toBe(2);

      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(true);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });
  });

  // ==========================================================================
  // SCENARIO: Web search thread navigate-back
  // ==========================================================================

  describe('web search thread navigate-back', () => {
    it('presearch + participants + moderator completed → navigate back', () => {
      const threadId = 'e2e-web-search';

      // 1. Create with web search
      createThreadAndStartStreaming(store, {
        enableWebSearch: true,
        participantCount: 2,
        threadId,
      });
      expect(store.getState().phase).toBe(ChatPhases.PRESEARCH);

      // 2. Navigate away during presearch
      navigateAway(store);

      // 3. Everything completes on backend

      // 4. Navigate back — no cache, phase stays IDLE
      store = createChatStore();
      navigateBack(store, {
        enableWebSearch: true,
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      // 5. Resume GET → 204 from IDLE (Fix 1 path)
      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(true);
      expect(store.getState().createdThreadId).toBeNull(); // Cleared by prepareForNewMessage
    });
  });

  // ==========================================================================
  // SCENARIO: Project thread navigate-back
  // ==========================================================================

  describe('project thread navigate-back', () => {
    it('should set both createdThreadId and projectId for title polling', () => {
      const threadId = 'e2e-project';
      const projectId = 'proj-abc';

      createThreadAndStartStreaming(store, {
        participantCount: 2,
        projectId,
        threadId,
      });
      navigateAway(store);

      store = createChatStore();
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        projectId,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
      expect(store.getState().createdThreadProjectId).toBe(projectId);
    });
  });

  // ==========================================================================
  // SCENARIO: Normal streaming (no navigation) — regression check
  // ==========================================================================

  describe('normal streaming without navigation (regression)', () => {
    it('full round lifecycle should work without triggering IDLE finalization', () => {
      const threadId = 'e2e-no-nav';
      const { thread: _thread } = createThreadAndStartStreaming(store, {
        participantCount: 2,
        threadId,
      });

      // Phase machine: PARTICIPANTS
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
      expect(deriveIsStreaming(store.getState().phase)).toBe(true);

      // Complete P0
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(0);

      // Complete P1 → MODERATOR
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(1);
      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

      // Complete moderator → COMPLETE
      store.getState().onModeratorComplete();
      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);

      // prepareForNewMessage → IDLE
      store.getState().prepareForNewMessage();
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().createdThreadId).toBeNull();

      // No 204 handler should fire during normal flow
      // (resume GET only fires on navigate-back, not during active streaming)
    });

    it('single participant round completes without moderator', () => {
      const threadId = 'e2e-single-p';
      createThreadAndStartStreaming(store, {
        participantCount: 1,
        threadId,
      });

      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(0);

      // Single participant skips moderator → COMPLETE
      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);
    });
  });

  // ==========================================================================
  // SCENARIO: Overview page — handleNoActiveStream should not fire
  // ==========================================================================

  describe('overview page guard', () => {
    it('should not finalize when on overview (no thread)', () => {
      // Fresh store represents overview page
      expect(store.getState().thread).toBeNull();

      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(false);
    });

    it('should not finalize when navigated to overview after thread', () => {
      const threadId = 'e2e-overview-after';
      simulateNavigateBackAfterBackendComplete(store, threadId, 2);

      // Navigate to overview
      store.getState().resetForThreadNavigation();
      expect(store.getState().thread).toBeNull();

      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(false);
    });
  });

  // ==========================================================================
  // SCENARIO: Rapid navigation A → B → back to A
  // ==========================================================================

  describe('rapid navigation between threads', () => {
    it('a → B → back to A: should finalize correctly for thread A', () => {
      const threadA = 'e2e-thread-A';
      const threadB = 'e2e-thread-B';

      // Create A
      createThreadAndStartStreaming(store, {
        participantCount: 2,
        threadId: threadA,
      });

      // Navigate to B
      navigateAway(store);
      store = createChatStore();
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 3,
        threadId: threadB,
      });

      // Navigate back to A
      store.getState().resetForThreadNavigation();
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId: threadA,
      });

      // Verify thread A state
      expect(store.getState().thread?.id).toBe(threadA);
      expect(store.getState().createdThreadId).toBe(threadA); // Title polling

      // 204 for A — IDLE path (Fix 1)
      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(true);
    });

    it('rapid back-and-forth should not corrupt state', () => {
      const threadA = 'e2e-rapid-A';
      const threadB = 'e2e-rapid-B';

      // 6 iterations: A, B, A, B, A, B — final is B (i=5 is odd)
      for (let i = 0; i < 6; i++) {
        const isA = i % 2 === 0;
        const threadId = isA ? threadA : threadB;

        if (store.getState().thread) {
          store.getState().resetForThreadNavigation();
        }

        navigateBack(store, {
          hasMessages: true,
          isAiGeneratedTitle: isA, // A has title, B doesn't
          participantCount: 2,
          threadId,
        });

        expect(store.getState().thread?.id).toBe(threadId);
        expect(store.getState().phase).toBe(ChatPhases.IDLE);
      }

      // Final state: thread B (i=5, odd iteration)
      expect(store.getState().thread?.id).toBe(threadB);
      expect(store.getState().createdThreadId).toBe(threadB); // B is untitled
    });
  });

  // ==========================================================================
  // SCENARIO: Navigate back then immediately send new message
  // ==========================================================================

  describe('navigate back then send new message', () => {
    it('should allow new round after navigate-back + 204', () => {
      const threadId = 'e2e-send-after-back';

      // Navigate back to completed thread
      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 2,
        roundNumber: 0,
        threadId,
      });

      // 204 fires
      handleNoActiveStream204(store);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      // User sends new message (round 1)
      store.getState().setPendingMessage('Follow-up question');
      expect(deriveWaitingToStartStreaming(
        store.getState().phase,
        store.getState().pendingMessage,
      )).toBe(true);

      // useRoundTrigger starts round
      store.getState().setCurrentRoundNumber(1);
      store.getState().startRound(1, 2, false);

      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);
      expect(deriveIsStreaming(store.getState().phase)).toBe(true);
    });

    it('204 should NOT clear pendingMessage if user already typed', () => {
      const threadId = 'e2e-pending-race';

      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 2,
        threadId,
      });

      // User types and sends before 204 arrives
      store.getState().setPendingMessage('Quick question');

      // 204 arrives — pendingMessage guard protects
      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(false);
      expect(store.getState().pendingMessage).toBe('Quick question');
    });
  });

  // ==========================================================================
  // SCENARIO: Navigate back during presearch phase
  // ==========================================================================

  describe('navigate back during presearch phase', () => {
    it('cache restores presearch phase, then backend completes → 204', () => {
      const threadId = 'e2e-presearch-away';

      // Create with web search → PRESEARCH
      createThreadAndStartStreaming(store, {
        enableWebSearch: true,
        participantCount: 2,
        threadId,
      });
      expect(store.getState().phase).toBe(ChatPhases.PRESEARCH);

      // Navigate away
      navigateAway(store);

      // Navigate back — phase is IDLE (no cache restore), AI SDK resume handles reconnection
      navigateBack(store, {
        enableWebSearch: true,
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      // Backend already completed — resume GET returns 204
      handleNoActiveStream204(store);

      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(deriveIsStreaming(store.getState().phase)).toBe(false);
    });
  });

  // ==========================================================================
  // SCENARIO: Multiple rounds completed while away
  // ==========================================================================

  describe('multiple rounds completed while away (edge case)', () => {
    it('user left during round 1, backend completed rounds 1-3, navigate back', () => {
      const threadId = 'e2e-multi-complete';

      // User was on round 1, navigated away
      // Backend completed rounds 1, 2, 3 (hypothetical auto-continue)
      // User navigates back — D1 shows round 3 data

      navigateBack(store, {
        hasMessages: true,
        isAiGeneratedTitle: true, // Title generated during rounds 2-3
        participantCount: 2,
        roundNumber: 3,
        threadId,
      });

      expect(store.getState().currentRoundNumber).toBe(3);

      // Resume GET → 204
      const result = handleNoActiveStream204(store);
      expect(result.invalidated).toBe(true);
      expect(store.getState().phase).toBe(ChatPhases.IDLE);

      // No title polling needed (title already generated)
      expect(store.getState().createdThreadId).toBeNull();
    });
  });
});

// ============================================================================
// Standalone helper for overview guard (used in describe block above)
// ============================================================================

function simulateNavigateBackAfterBackendComplete(
  store: TestStore,
  threadId: string,
  participantCount: number,
) {
  const participants = createMockParticipants(participantCount, threadId);
  const thread = createMockThread({ id: threadId, slug: `slug-${threadId}` });
  store.setState({ participants, thread });
  store.getState().initializeThread(thread, participants);
  store.getState().setCurrentRoundNumber(0);
  store.getState().setHasInitiallyLoaded(true);
}
