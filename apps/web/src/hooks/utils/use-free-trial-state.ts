import { BorderVariants, PlanTypes, TrialStates } from '@debatekit/shared';
import { useEffect, useMemo, useRef } from 'react';

import { useChatStore } from '@/components/providers/chat-store-provider/context';
import { useSidebarThreadsQuery, useUsageStatsQuery } from '@/hooks/queries';
import { useIsAnonymous } from '@/hooks/utils/use-is-anonymous';
import { AnalyticsEvents, useAnalytics } from '@/lib/analytics';
import { validateUsageStatsCache } from '@/stores/chat/actions/types';

const FREE_TRIAL_STORAGE_KEY = 'rt_free_round_used';

/** Read persisted trial state from localStorage (client-only). */
function getPersistedTrialUsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return localStorage.getItem(FREE_TRIAL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persist trial-used flag so subsequent page loads block immediately. */
function persistTrialUsed(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(FREE_TRIAL_STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable (private browsing, quota exceeded)
  }
}

/**
 * Hook to determine free trial state for a user.
 *
 * Free users get ONE thread + ONE round upon signup.
 * Once they create a thread, they've used their quota.
 * Anonymous users are always free users — derive state from threads + usage.
 */
export function useFreeTrialState() {
  const isAnonymous = useIsAnonymous();
  const { data: statsData, isLoading: isLoadingStats } = useUsageStatsQuery();
  const { data: threadsData } = useSidebarThreadsQuery();
  const hasLocalThread = useChatStore(state => state.thread !== null || state.createdThreadId !== null);

  const validated = useMemo(() => validateUsageStatsCache(statsData), [statsData]);

  const isFreeUser = useMemo(() => {
    if (isAnonymous) {
      return true;
    }
    if (!validated) {
      return false;
    }
    return validated.plan.type !== PlanTypes.PAID;
  }, [isAnonymous, validated]);

  const freeRoundUsedFromApi = validated?.plan.freeRoundUsed ?? false;

  const hasExistingThread = useMemo(() => {
    if (!threadsData?.pages?.[0]?.success) {
      return false;
    }
    const threads = threadsData.pages[0].data?.items ?? [];
    return threads.length > 0;
  }, [threadsData]);

  // localStorage fallback — survives page refresh and stale query cache
  const persistedTrialUsed = useMemo(() => getPersistedTrialUsed(), []);

  const hasUsedTrial = useMemo(() => {
    // Anonymous users: block as soon as they have ANY thread (started OR completed).
    // They get ONE thread + ONE round — once a thread exists, they're done.
    // This catches mid-stream, completed, and navigate-back scenarios.
    if (isAnonymous) {
      if (freeRoundUsedFromApi || hasExistingThread || hasLocalThread || persistedTrialUsed) {
        return true;
      }
      return false;
    }
    // Logged-in free users: API is the source of truth for round completion.
    // Thread existence alone is too aggressive — an incomplete round (stream died mid-round)
    // should NOT block a logged-in user from retrying.
    if (validated) {
      return freeRoundUsedFromApi;
    }
    // localStorage persisted from a previous session — block immediately
    if (persistedTrialUsed) {
      return true;
    }
    return hasExistingThread || hasLocalThread;
  }, [isAnonymous, hasExistingThread, hasLocalThread, freeRoundUsedFromApi, validated, persistedTrialUsed]);

  const isWarningState = hasUsedTrial;

  const borderVariant = useMemo(() => {
    if (!isFreeUser) {
      return BorderVariants.DEFAULT;
    }
    return hasUsedTrial ? BorderVariants.WARNING : BorderVariants.SUCCESS;
  }, [isFreeUser, hasUsedTrial]);

  const trialState = hasUsedTrial ? TrialStates.USED : TrialStates.AVAILABLE;

  const { track } = useAnalytics();
  const trackedRef = useRef(false);
  useEffect(() => {
    if (isAnonymous && hasUsedTrial && !trackedRef.current) {
      trackedRef.current = true;
      track(AnalyticsEvents.ANONYMOUS_TRIAL_COMPLETED);
    }
  }, [isAnonymous, hasUsedTrial, track]);

  // Persist to localStorage when trial is consumed (from API or thread fallback)
  useEffect(() => {
    if (hasUsedTrial && isFreeUser) {
      persistTrialUsed();
    }
  }, [hasUsedTrial, isFreeUser]);

  return {
    borderVariant,
    hasUsedTrial,
    isFreeUser,
    isLoadingStats,
    isWarningState,
    statsData,
    trialState,
  };
}
