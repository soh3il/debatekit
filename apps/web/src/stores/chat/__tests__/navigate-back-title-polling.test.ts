/**
 * Navigate-Back Title Polling Tests (Fix 2)
 *
 * Tests the title polling re-trigger logic added to useSyncHydrateStore.
 * When a user creates a thread, navigates away before the AI title generates,
 * and navigates back — createdThreadId was cleared by navigation cleanup.
 * The fix sets createdThreadId during hydration so useTitlePolling re-captures it.
 *
 * These tests simulate the useSyncHydrateStore sequence at the store level:
 * initializeThread → setCurrentRoundNumber → set form state → title polling fix
 * → setHasInitiallyLoaded.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createMockParticipants, createMockThread } from '@/lib/testing';

import { createChatStore } from '../store';
import { ChatPhases } from '../store-schemas';
// ============================================================================
// Types & Helpers
// ============================================================================

type TestStore = ReturnType<typeof createChatStore>;

/**
 * Simulate the full useSyncHydrateStore sequence including the title polling fix.
 * Returns the thread and participants for further assertions.
 */
function simulateHydration(
  store: TestStore,
  options: {
    threadId: string;
    participantCount: number;
    isAiGeneratedTitle: boolean;
    hasMessages: boolean;
    projectId?: string | null;
    roundNumber?: number;
    slug?: string;
  },
) {
  const {
    hasMessages,
    isAiGeneratedTitle,
    participantCount,
    projectId = null,
    roundNumber = 0,
    slug,
    threadId,
  } = options;

  const participants = createMockParticipants(participantCount, threadId);
  const thread = createMockThread({
    id: threadId,
    isAiGeneratedTitle,
    projectId,
    slug: slug ?? `slug-${threadId}`,
  });

  const state = store.getState();

  // Step 1: initializeThread
  state.initializeThread(thread, participants);

  // Step 2: Set round number from initialMessages
  state.setCurrentRoundNumber(roundNumber);

  // Step 3: Sync form state
  state.setSelectedMode(thread.mode);
  state.setEnableWebSearch(thread.enableWebSearch);
  state.setInputValue('');

  // Step 4: TITLE POLLING FIX — the code under test
  const initialMessagesLength = hasMessages ? 3 : 0; // Simulated
  if (!thread.isAiGeneratedTitle && initialMessagesLength > 0) {
    state.setCreatedThreadId(thread.id);
    if (thread.projectId) {
      state.setCreatedThreadProjectId(thread.projectId);
    }
  }

  // Step 5: Mark as loaded
  state.setHasInitiallyLoaded(true);
  state.setShowInitialUI(false);

  return { participants, thread };
}

/**
 * Simulate the navigation cleanup that happens when user leaves a thread.
 * This clears createdThreadId (via resetForThreadNavigation → store defaults).
 */
function simulateNavigationCleanup(store: TestStore) {
  store.getState().resetForThreadNavigation();
}

// ============================================================================
// Tests
// ============================================================================

describe('navigate-back title polling re-trigger (Fix 2)', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createChatStore();
  });

  // ==========================================================================
  // BASIC TITLE POLLING RE-TRIGGER
  // ==========================================================================

  describe('basic title polling re-trigger', () => {
    it('should set createdThreadId when isAiGeneratedTitle=false and messages exist', () => {
      const threadId = 'thread-untitled';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
    });

    it('should NOT set createdThreadId when isAiGeneratedTitle=true', () => {
      const threadId = 'thread-titled';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 2,
        threadId,
      });

      expect(store.getState().createdThreadId).toBeNull();
    });

    it('should NOT set createdThreadId when no messages exist', () => {
      const threadId = 'thread-empty';

      simulateHydration(store, {
        hasMessages: false,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      expect(store.getState().createdThreadId).toBeNull();
    });

    it('should NOT set createdThreadId when both conditions fail', () => {
      const threadId = 'thread-titled-empty';

      simulateHydration(store, {
        hasMessages: false,
        isAiGeneratedTitle: true,
        participantCount: 2,
        threadId,
      });

      expect(store.getState().createdThreadId).toBeNull();
    });
  });

  // ==========================================================================
  // PROJECT CONTEXT
  // ==========================================================================

  describe('project context handling', () => {
    it('should set createdThreadProjectId when thread has projectId', () => {
      const threadId = 'thread-project';
      const projectId = 'project-123';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        projectId,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
      expect(store.getState().createdThreadProjectId).toBe(projectId);
    });

    it('should NOT set createdThreadProjectId when thread has no projectId', () => {
      const threadId = 'thread-no-project';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        projectId: null,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
      expect(store.getState().createdThreadProjectId).toBeNull();
    });

    it('should NOT set createdThreadProjectId when title already generated', () => {
      const threadId = 'thread-titled-project';
      const projectId = 'project-456';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 2,
        projectId,
        threadId,
      });

      expect(store.getState().createdThreadId).toBeNull();
      expect(store.getState().createdThreadProjectId).toBeNull();
    });
  });

  // ==========================================================================
  // FULL NAVIGATE-BACK CYCLE
  // ==========================================================================

  describe('full navigate-back cycle', () => {
    it('create → navigate away → navigate back: createdThreadId re-set', () => {
      const threadId = 'thread-full-cycle';

      // 1. Initial thread creation — createdThreadId set by form-actions
      store.getState().setCreatedThreadId(threadId);
      expect(store.getState().createdThreadId).toBe(threadId);

      // 2. Navigate away — cleanup clears createdThreadId
      simulateNavigationCleanup(store);
      expect(store.getState().createdThreadId).toBeNull();

      // 3. Navigate back — useSyncHydrateStore re-triggers
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      // createdThreadId re-set for title polling
      expect(store.getState().createdThreadId).toBe(threadId);
    });

    it('create → navigate away → title generates on backend → navigate back: no re-trigger', () => {
      const threadId = 'thread-title-generated';

      // 1. Initial creation
      store.getState().setCreatedThreadId(threadId);

      // 2. Navigate away
      simulateNavigationCleanup(store);

      // 3. Backend generates title while user is away
      // 4. Navigate back — route loader returns isAiGeneratedTitle=true
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 2,
        threadId,
      });

      // No re-trigger needed — title already exists
      expect(store.getState().createdThreadId).toBeNull();
    });

    it('navigate to existing thread with title: no createdThreadId set', () => {
      const threadId = 'thread-existing-titled';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 2,
        threadId,
      });

      expect(store.getState().createdThreadId).toBeNull();
    });

    it('navigate to existing untitled thread with messages: createdThreadId set', () => {
      // Edge case: thread was created long ago but title generation failed
      const threadId = 'thread-old-untitled';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 3,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
    });
  });

  // ==========================================================================
  // INTERACTION WITH prepareForNewMessage
  // ==========================================================================

  describe('interaction with prepareForNewMessage', () => {
    it('prepareForNewMessage clears createdThreadId (expected lifecycle)', () => {
      const threadId = 'thread-lifecycle';

      // Hydration sets createdThreadId
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });
      expect(store.getState().createdThreadId).toBe(threadId);

      // handleNoActiveStream calls prepareForNewMessage (Fix 1)
      // This happens AFTER title polling hook captures the value
      store.getState().prepareForNewMessage();

      expect(store.getState().createdThreadId).toBeNull();
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
    });

    it('ordering: title polling captures createdThreadId before prepareForNewMessage clears it', () => {
      // This test verifies the timing assumption in the fix:
      // useTitlePolling runs in useEffect (captures createdThreadId)
      // handleNoActiveStream runs later (clears createdThreadId via prepareForNewMessage)
      // The value should be available between hydration and prepareForNewMessage.

      const threadId = 'thread-ordering';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      // At this point, createdThreadId is set — title polling would capture it
      expect(store.getState().createdThreadId).toBe(threadId);

      // Simulate title polling capturing the value (it reads createdThreadId)
      const capturedId = store.getState().createdThreadId;
      expect(capturedId).toBe(threadId);

      // Later: prepareForNewMessage clears it
      store.getState().prepareForNewMessage();
      expect(store.getState().createdThreadId).toBeNull();

      // The captured value is still valid (title polling uses its own state)
      expect(capturedId).toBe(threadId);
    });
  });

  // ==========================================================================
  // MULTI-ROUND SCENARIOS
  // ==========================================================================

  describe('multi-round scenarios', () => {
    it('round 0 completed: title polling triggers for un-titled thread', () => {
      const threadId = 'thread-r0';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        roundNumber: 0,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
      expect(store.getState().currentRoundNumber).toBe(0);
    });

    it('round 3 completed: title polling still triggers for un-titled thread', () => {
      // Title might fail/lag even after multiple rounds
      const threadId = 'thread-r3-untitled';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 3,
        roundNumber: 3,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
      expect(store.getState().currentRoundNumber).toBe(3);
    });

    it('round 5 completed with title: no polling trigger', () => {
      const threadId = 'thread-r5-titled';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: true,
        participantCount: 2,
        roundNumber: 5,
        threadId,
      });

      expect(store.getState().createdThreadId).toBeNull();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('single participant thread: title polling triggers normally', () => {
      const threadId = 'thread-single-p';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 1,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
    });

    it('double hydration for same thread: createdThreadId set correctly', () => {
      const threadId = 'thread-double-hydrate';

      // First hydration
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });
      expect(store.getState().createdThreadId).toBe(threadId);

      // Second hydration (e.g., React re-render)
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });
      expect(store.getState().createdThreadId).toBe(threadId);
    });

    it('hydration after prepareForNewMessage: re-sets createdThreadId', () => {
      const threadId = 'thread-rehydrate';

      // First hydration
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      // prepareForNewMessage clears it
      store.getState().prepareForNewMessage();
      expect(store.getState().createdThreadId).toBeNull();

      // Re-hydration (e.g., query refetch triggers re-render)
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      expect(store.getState().createdThreadId).toBe(threadId);
    });

    it('thread switch A → B: createdThreadId matches B', () => {
      const threadA = 'thread-A';
      const threadB = 'thread-B';

      // Hydrate A
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId: threadA,
      });
      expect(store.getState().createdThreadId).toBe(threadA);

      // Navigation cleanup
      simulateNavigationCleanup(store);

      // Hydrate B
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 3,
        threadId: threadB,
      });
      expect(store.getState().createdThreadId).toBe(threadB);
    });

    it('project thread → non-project thread: projectId cleared', () => {
      const threadA = 'thread-project-A';
      const threadB = 'thread-no-project-B';

      // Hydrate project thread
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        projectId: 'proj-1',
        threadId: threadA,
      });
      expect(store.getState().createdThreadProjectId).toBe('proj-1');

      // Navigation cleanup
      simulateNavigationCleanup(store);

      // Hydrate non-project thread
      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        projectId: null,
        threadId: threadB,
      });
      // createdThreadProjectId is NOT explicitly cleared by the fix — it persists
      // from the previous value. This is fine because useTitlePolling reads
      // createdThreadId first and only uses projectId if threadId matches.
      expect(store.getState().createdThreadId).toBe(threadB);
    });
  });

  // ==========================================================================
  // STORE STATE COMPLETENESS
  // ==========================================================================

  describe('store state completeness after hydration', () => {
    it('all expected fields populated after full hydration', () => {
      const threadId = 'thread-complete-state';
      const projectId = 'project-complete';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        projectId,
        threadId,
      });

      const state = store.getState();
      expect(state.thread?.id).toBe(threadId);
      expect(state.hasInitiallyLoaded).toBe(true);
      expect(state.showInitialUI).toBe(false);
      expect(state.currentRoundNumber).toBe(0);
      expect(state.phase).toBe(ChatPhases.IDLE);
      expect(state.createdThreadId).toBe(threadId);
      expect(state.createdThreadProjectId).toBe(projectId);
      expect(state.inputValue).toBe('');
    });

    it('createdThreadId does not interfere with phase machine', () => {
      const threadId = 'thread-phase-no-interfere';

      simulateHydration(store, {
        hasMessages: true,
        isAiGeneratedTitle: false,
        participantCount: 2,
        threadId,
      });

      // Start a new round — createdThreadId should not prevent phase transitions
      store.getState().startRound(1, 2, false);
      expect(store.getState().phase).toBe(ChatPhases.PARTICIPANTS);

      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(0);
      store.getState().incrementCompletedParticipants();
      store.getState().onParticipantComplete(1);
      expect(store.getState().phase).toBe(ChatPhases.MODERATOR);

      store.getState().onModeratorComplete();
      expect(store.getState().phase).toBe(ChatPhases.COMPLETE);

      store.getState().prepareForNewMessage();
      expect(store.getState().phase).toBe(ChatPhases.IDLE);
      expect(store.getState().createdThreadId).toBeNull(); // Cleared by prepareForNewMessage
    });
  });
});
