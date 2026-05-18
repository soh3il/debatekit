/**
 * Admin Tweets Query Hooks
 *
 * TanStack Query hooks for fetching admin scheduled tweets
 */

import { ACTIVE_SCHEDULED_TWEET_STATUSES } from '@debatekit/shared/enums';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { adminTweetsInfiniteQueryOptions } from '@/lib/data/keys/admin';
import type { ScheduledTweet } from '@/services/api';

/**
 * Infinite query hook for paginated admin tweets
 * Smart polling: 5s when scheduled tweets exist, 30s when idle
 *
 * IMPORTANT: Spreads adminTweetsInfiniteQueryOptions to ensure
 * SSR-prefetched data from the route loader is used (same queryKey + queryFn).
 */
export function useAdminTweetsInfiniteQuery() {
  const { isAuthenticated } = useAuthCheck();

  return useInfiniteQuery({
    ...adminTweetsInfiniteQueryOptions,
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const pages = query.state.data?.pages ?? [];
      const hasScheduledTweets = pages.some(page =>
        page.data.tweets.some((tweet: ScheduledTweet) =>
          ACTIVE_SCHEDULED_TWEET_STATUSES.has(tweet.status),
        ),
      );
      return hasScheduledTweets ? 5000 : 30000;
    },
    refetchOnMount: 'always',
    throwOnError: false,
  });
}
