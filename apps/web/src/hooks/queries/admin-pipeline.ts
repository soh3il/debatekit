/**
 * Admin Pipeline Query Hooks
 *
 * TanStack Query hooks for fetching admin content pipeline runs
 */

import { ACTIVE_CONTENT_PIPELINE_STATUSES } from '@debatekit/shared/enums';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { adminPipelineRunsInfiniteQueryOptions } from '@/lib/data/keys/admin';
import type { PipelineRun } from '@/services/api/admin/pipeline';

/**
 * Infinite query hook for paginated admin pipeline runs
 * Smart polling: 5s when active runs exist, 30s when idle
 *
 * IMPORTANT: Spreads adminPipelineRunsInfiniteQueryOptions to ensure
 * SSR-prefetched data from the route loader is used (same queryKey + queryFn).
 */
export function useAdminPipelineRunsInfiniteQuery() {
  const { isAuthenticated } = useAuthCheck();

  return useInfiniteQuery({
    ...adminPipelineRunsInfiniteQueryOptions,
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const pages = query.state.data?.pages ?? [];
      const hasActiveRuns = pages.some(page =>
        page.data.runs.some((run: PipelineRun) => ACTIVE_CONTENT_PIPELINE_STATUSES.has(run.status)),
      );
      return hasActiveRuns ? 5000 : 30000;
    },
    refetchOnMount: 'always',
    throwOnError: false,
  });
}
