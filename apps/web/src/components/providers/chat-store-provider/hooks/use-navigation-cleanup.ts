/** Navigation cleanup on route changes. Uses useLayoutEffect for synchronous cleanup. */

import { ChatStoreContext } from '@ai-sdk-tools/store';
import type { QueryClient } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import type { RefObject } from 'react';
import { use, useLayoutEffect } from 'react';

import { queryKeys } from '@/lib/data/keys';
import { clearSplitCache } from '@/lib/utils/split-unified-stream-messages';
import type { GetThreadBySlugResponse } from '@/services/api';
import type { ChatStoreApi } from '@/stores/chat';
import { ChatPhases, deriveIsStreaming } from '@/stores/chat';

type UseNavigationCleanupParams = {
  prevPathnameRef: RefObject<string | null>;
  queryClient: QueryClient;
  store: ChatStoreApi;
};

export function useNavigationCleanup({
  prevPathnameRef,
  queryClient,
  store,
}: UseNavigationCleanupParams) {
  const { pathname } = useLocation();
  const aiSdkStore = use(ChatStoreContext);

  // NOTE: React fires child useLayoutEffects BEFORE parent. So useSyncHydrateStore
  // (child) runs first, THEN this cleanup runs. Guards below prevent overwriting
  // data the child just hydrated for the destination thread.
  useLayoutEffect(() => {
    /** Clear AI SDK store messages to prevent cross-thread state leaking. */
    const clearAiSdkStore = () => aiSdkStore?.getState().reset();
    const prevPath = prevPathnameRef.current;

    if (prevPath === null) {
      prevPathnameRef.current = pathname;
      if (pathname === '/chat') {
        store.getState().clearAllPreSearchTracking();
      }
      return;
    }

    if (prevPath === pathname) {
      return;
    }

    const currentState = store.getState();

    /** Extract thread slug from a chat pathname */
    const extractThreadSlug = (path: string | null): string | null => {
      if (!path) {
        return null;
      }
      const chatMatch = path.match(/^\/chat\/([^/]+)$/);
      const projectMatch = path.match(/^\/chat\/projects\/[^/]+\/([^/]+)$/);
      return chatMatch?.[1] ?? projectMatch?.[1] ?? null;
    };

    /**
     * Check if store already has the thread for the given pathname (child hydrated it).
     * NAVIGATION FIX: Also check hasInitiallyLoaded to confirm hydration is complete.
     * Without this, the slug can match but the store is in a partial state from
     * initializeThread's partial init path, causing the guard to pass when it
     * shouldn't, or to fail when the slug comparison is stale.
     */
    const isStoreAlreadyHydratedForPath = (path: string | null): boolean => {
      const targetSlug = extractThreadSlug(path);
      if (!targetSlug || !currentState.thread) {
        return false;
      }
      const slugMatch = targetSlug === currentState.thread.slug || targetSlug === currentState.thread.previousSlug;
      return slugMatch && currentState.hasInitiallyLoaded;
    };

    // Invalidate the thread query cache when leaving a thread so the route loader
    // fetches fresh data (including streamingState from Redis) on navigate-back.
    // Without this, ensureQueryData returns stale cached data (5min staleTime) that
    // may be missing streamingState, causing the store to hydrate without streaming
    // context and the user to see incomplete/stale messages.
    const invalidateThreadCache = (leavingPath: string | null) => {
      if (!leavingPath) {
        return;
      }
      const slug = extractThreadSlug(leavingPath);
      if (slug && slug !== 'projects' && slug !== 'billing' && slug !== 'new') {
        // Remove presearch TQ cache BEFORE invalidating the thread cache.
        // The loader uses getQueryData (bypasses stale checks), so invalidation
        // alone doesn't help — stale STREAMING status persists and causes shimmer
        // on navigate-back. removeQueries forces a fresh fetch on return.
        const cached = queryClient.getQueryData<GetThreadBySlugResponse>(queryKeys.threads.bySlug(slug));
        const threadId = cached?.success && cached.data?.thread?.id;
        if (threadId) {
          queryClient.removeQueries({ queryKey: queryKeys.threads.preSearches(threadId) });
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.threads.bySlug(slug) });
      }
    };

    const isNewThreadPath = (path: string | null): boolean =>
      path === '/chat' || (path?.endsWith('/new') ?? false);

    const isProjectOverviewPath = (path: string | null): boolean =>
      path?.match(/^\/chat\/projects\/[^/]+$/) !== null;

    const prevIsNewPath = isNewThreadPath(prevPath);
    const prevIsProjectOverview = isProjectOverviewPath(prevPath);
    const nextIsNewPath = isNewThreadPath(pathname);
    const nextIsProjectOverview = isProjectOverviewPath(pathname);

    const isLeavingThread = prevPath?.startsWith('/chat/') && prevPath !== '/chat' && !prevIsNewPath && !prevIsProjectOverview;
    const isGoingToOverview = pathname === '/chat' || nextIsProjectOverview;
    const isGoingToThread = pathname?.startsWith('/chat/') && pathname !== '/chat' && !nextIsNewPath && !nextIsProjectOverview;

    const isNavigatingBetweenThreads
      = prevPath?.startsWith('/chat/')
        && pathname?.startsWith('/chat/')
        && prevPath !== pathname
        && !prevIsNewPath
        && !nextIsNewPath
        && !prevIsProjectOverview
        && !nextIsProjectOverview;

    const isFromOverviewToThread = (prevIsNewPath || prevIsProjectOverview) && isGoingToThread;
    const isComingFromNonChatPage = prevPath && !prevPath.startsWith('/chat') && isGoingToOverview;

    const isStreaming = deriveIsStreaming(currentState.phase);

    // Skip cleanup when navigating TO the just-created thread; cleanup if navigating AWAY
    const isActiveThreadCreation = currentState.createdThreadId !== null;
    if (isActiveThreadCreation) {
      const createdSlug = currentState.thread?.slug;
      const previousSlug = currentState.thread?.previousSlug;
      const targetSlug = extractThreadSlug(pathname);

      // Match by slug (current or previous) — slug changes during title regeneration
      // shouldn't trigger a reset when the underlying thread is the same
      const isNavigatingToCreatedThread = targetSlug
        && (targetSlug === createdSlug || targetSlug === previousSlug);

      // HYDRATION-RACE FIX: When navigating between threads, child hydration
      // overwrites currentState.thread with the destination. The slug comparison
      // above would incorrectly match destination against itself, skipping cleanup.
      // When going thread-to-thread with createdThreadId set, we're always leaving
      // the created thread (overview→thread is handled by isFromOverviewToThread).
      if (isNavigatingBetweenThreads) {
        invalidateThreadCache(prevPath);
        clearAiSdkStore();
        clearSplitCache();
        // Can't call resetForThreadNavigation() — child already hydrated destination.
        // Targeted reset: clear stale phase + creation state so resume works on return.
        currentState.resetToIdle();
        currentState.setCreatedThreadId(null);
        currentState.setCreatedThreadProjectId(null);
        prevPathnameRef.current = pathname;
        return;
      }

      if (isNavigatingToCreatedThread || isFromOverviewToThread) {
        prevPathnameRef.current = pathname;
        return;
      }

      // Navigating AWAY from created thread -- reset store only, never abort.
      // AI SDK manages stream lifecycle; aborting corrupts resumable streams.
      // Backend continues via waitUntil; resume reconnects cleanly on return.
      invalidateThreadCache(prevPath);
      clearAiSdkStore();
      clearSplitCache();
      if (isGoingToOverview) {
        currentState.resetToOverview();
      } else {
        currentState.resetForThreadNavigation();
      }
      prevPathnameRef.current = pathname;
      return;
    }

    // Preserve waitingToStartStreaming for overview->thread (new thread needs it for stream trigger)
    const isWaitingToStartStreaming = currentState.phase === ChatPhases.IDLE && currentState.pendingMessage !== null;
    const shouldClearWaiting = isWaitingToStartStreaming
      && !isFromOverviewToThread
      && (isGoingToOverview || isNavigatingBetweenThreads || isComingFromNonChatPage);

    if (shouldClearWaiting) {
      currentState.resetToIdle();
      currentState.setPendingMessage(null);
    }

    // Full reset leaving thread for overview -- prevents stale data flash.
    // AI SDK manages stream lifecycle; aborting corrupts resumable streams.
    // Backend continues via waitUntil; resume reconnects cleanly on return.
    // Guard: Skip if store was already reset (e.g., by sidebar's resetToNewChat).
    if (isGoingToOverview && isLeavingThread) {
      invalidateThreadCache(prevPath);
      if (currentState.thread !== null || currentState.createdThreadId !== null) {
        clearAiSdkStore();
        clearSplitCache();
        currentState.resetToOverview();
      }
    }
    if (isGoingToOverview && isComingFromNonChatPage) {
      currentState.clearAllPreSearchTracking();
    }

    // Reset store for thread-to-thread navigation; never abort the stream.
    // AI SDK manages stream lifecycle; aborting corrupts resumable streams.
    // Backend continues via waitUntil; resume reconnects cleanly on return.
    if (isNavigatingBetweenThreads) {
      invalidateThreadCache(prevPath);

      // HYDRATION-CLEANUP RACE FIX: If useSyncHydrateStore (child) already
      // hydrated the destination thread, the store has correct data. Resetting
      // would overwrite it causing a blank frame before re-hydration fixes it.
      // AI SDK manages messages per chatId — when chatId changes (threadId changed),
      // AI SDK switches to the new Chat instance. Don't clear messages here as the
      // resume GET needs them for dedup via replaceMessage. Split cache can be stale.
      if (isStoreAlreadyHydratedForPath(pathname)) {
        // RESUME FIX: Do NOT clear AI SDK store when navigating back to a hydrated thread.
        // AI SDK needs existing messages for dedup via replaceMessage during resume replay.
        // Clearing them forces resume to create new messages instead of replacing, causing
        // duplicates or empty content. Split cache is safe to clear (rebuilt on demand).
        clearSplitCache();
        // Reset stale phase from previous thread so needsResumeInit() returns true
        // and resumeIntoStreaming() can set up placeholders on navigate-back.
        currentState.resetToIdle();
        prevPathnameRef.current = pathname;
        return;
      }

      clearAiSdkStore();
      clearSplitCache();
      currentState.resetForThreadNavigation();
      currentState.clearAllPreSearchTracking();
    }

    // Reset for overview->different thread (new thread creation handled by early return above)
    if (isFromOverviewToThread && currentState.thread) {
      if (!isStoreAlreadyHydratedForPath(pathname) && !isStreaming) {
        // AI SDK manages stream lifecycle; aborting corrupts resumable streams.
        // Backend continues via waitUntil; resume reconnects cleanly on navigate back.
        clearAiSdkStore();
        clearSplitCache();
        currentState.resetForThreadNavigation();
      }
    }

    prevPathnameRef.current = pathname;
  }, [pathname, store, prevPathnameRef, queryClient, aiSdkStore]);
}
