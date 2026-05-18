/**
 * Chat Store Derived Selectors - Simplified for AI SDK v6
 *
 * Centralized selector functions following Zustand v5 best practices.
 * These selectors combine multiple state fields for common use cases,
 * reducing code duplication and ensuring consistent logic across components.
 *
 * SIMPLIFICATION: AI SDK v6 provides native status tracking:
 * - status: 'submitted' | 'streaming' | 'ready' | 'error'
 * - messages: UIMessage[] with parts array
 * - error: Error object
 * - resume: Automatic reconnection via GET endpoint
 *
 * DebateKit derives streaming state from the PHASE MACHINE:
 * - IDLE: No streaming, user can submit
 * - PRESEARCH: Web search is active (blocks P1+)
 * - PARTICIPANTS: Participants are streaming
 * - MODERATOR: Moderator is streaming
 * - COMPLETE: Round finished
 *
 * PATTERNS:
 * - Pure functions that derive state from ChatStore
 * - Selector hooks using useChatStore with useShallow for objects
 * - Named exports for tree-shaking
 * - Derive streaming state from phase (single source of truth)
 *
 * Location: /src/stores/chat/selectors.ts
 */

import { useChatStore } from '@/components/providers/chat-store-provider/context';
import { useShallow } from '@/lib/store';

import type { ChatStore } from './store-schemas';
import { ChatPhases } from './store-schemas';

// ============================================================================
// DERIVED STATE HELPERS
// These compute streaming states from the phase machine
// ============================================================================

/**
 * Derive isStreaming from phase.
 * True when any streaming is happening (presearch, participants, or moderator).
 *
 * EXPORTED: Can be used by components that need to derive streaming state
 * from phase without subscribing to the full store.
 */
export function deriveIsStreaming(phase: ChatStore['phase']): boolean {
  return (
    phase === ChatPhases.PRESEARCH
    || phase === ChatPhases.PARTICIPANTS
    || phase === ChatPhases.MODERATOR
  );
}

/**
 * Derive isModeratorStreaming from phase.
 * True when moderator phase is active.
 *
 * EXPORTED: Can be used by components that need to derive moderator streaming
 * state from phase without subscribing to the full store.
 */
export function deriveIsModeratorStreaming(phase: ChatStore['phase']): boolean {
  return phase === ChatPhases.MODERATOR;
}

/**
 * Derive waitingToStartStreaming from state.
 * True when user has submitted message but streaming hasn't started.
 * This is indicated by having a pendingMessage while still in IDLE phase.
 *
 * EXPORTED: Can be used by components that need to derive waiting state
 * from phase + pendingMessage without subscribing to the full store.
 */
export function deriveWaitingToStartStreaming(
  phase: ChatStore['phase'],
  pendingMessage: ChatStore['pendingMessage'],
): boolean {
  return (phase === ChatPhases.IDLE || phase === ChatPhases.COMPLETE) && pendingMessage !== null;
}

// ============================================================================
// PRE-SEARCH SELECTORS
// Access pre-search data filtered by current thread
// ============================================================================

/**
 * Select pre-searches filtered by current thread.
 * Prevents cross-thread contamination during navigation.
 */
export function selectPreSearchesForCurrentThread(state: ChatStore) {
  const threadId = state.thread?.id;
  if (!threadId || !Array.isArray(state.preSearches)) {
    return [];
  }
  return state.preSearches.filter(ps => ps.threadId === threadId);
}

// ============================================================================
// PRE-SEARCH HOOKS
// ============================================================================

/**
 * Hook for getting pre-search state with batch selection.
 * Uses useShallow to prevent re-renders when object identity changes.
 */
export function usePreSearchState() {
  return useChatStore(
    useShallow(s => ({
      currentRoundNumber: s.currentRoundNumber,
      enableWebSearch: s.enableWebSearch,
      preSearches: selectPreSearchesForCurrentThread(s),
      threadId: s.thread?.id ?? null,
    })),
  );
}
