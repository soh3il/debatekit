/**
 * Sidebar Thread Query Hook
 *
 * Lightweight endpoint for sidebar - only essential fields
 * Shorter TTL (30s) for fresher titles after updates
 *
 * CRITICAL: Uses shared queryOptions from query-options.ts
 * This ensures SSR hydration works correctly - same config in loader and hook
 */

import { useInfiniteQuery } from '@tanstack/react-query';

import { LIMITS } from '@/constants';
import { useAuthCheck } from '@/hooks/utils';
import { useIsAnonymous } from '@/hooks/utils/use-is-anonymous';
import { queryKeys, sidebarThreadsQueryOptions } from '@/lib/data/keys';
import { STALE_TIMES } from '@/lib/data/stale-times';
import { listSidebarThreadsService } from '@/services/api';

/**
 * Hook to fetch sidebar threads with lightweight payload
 * Returns only essential fields: id, title, slug, previousSlug, isFavorite, isPublic, timestamps
 *
 * ✅ SSR HYDRATION: Non-search queries DON'T use `enabled` gating
 * - Route loader (_protected.tsx) already verified auth in beforeLoad
 * - Data is SSR prefetched using sidebarThreadsQueryOptions
 * - Using `enabled: isAuthenticated` causes hydration mismatch when useSession isPending
 * - Disabled queries return isLoading:false with no data → shows empty state instead of skeletons
 *
 * Search queries still use `enabled` since they're client-only (not SSR prefetched)
 *
 * @param search - Optional search query to filter threads by title
 */
export function useSidebarThreadsQuery(search?: string) {
  const { isAuthenticated } = useAuthCheck();
  const isAnonymous = useIsAnonymous();

  // Determine query options based on search parameter
  // IMPORTANT: We must call useInfiniteQuery unconditionally to satisfy React hooks rules
  const isSearchQuery = Boolean(search);

  return useInfiniteQuery({
    // Use shared SSR options for non-search, custom options for search
    ...(isSearchQuery
      ? {
          // Search queries are client-only, gate on auth
          enabled: isAuthenticated,
          getNextPageParam: (lastPage: Awaited<ReturnType<typeof listSidebarThreadsService>> | undefined) => {
            if (!lastPage?.success) {
              return undefined;
            }
            return lastPage.data?.pagination?.nextCursor;
          },
          initialPageParam: undefined as string | undefined,
          queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
            const params: { cursor?: string; search: string; limit: number } = {
              limit: LIMITS.SEARCH_RESULTS,
              search: search ?? '',
            };
            if (pageParam) {
              params.cursor = pageParam;
            }
            return listSidebarThreadsService({ query: params });
          },
          queryKey: queryKeys.threads.sidebar(search),
          staleTime: STALE_TIMES.threadsSidebar,
        }
      : sidebarThreadsQueryOptions),
    // Non-search queries: DON'T gate on auth (SSR prefetched for authenticated,
    // client-only for anonymous). Anonymous sidebar fetch works after useEffect
    // in _protected.tsx calls authClient.signIn.anonymous() for unauthenticated visitors.
    // Search queries: always disable for anonymous (no search in guest mode).
    ...(isAnonymous && isSearchQuery ? { enabled: false } : {}),
    retry: false,
    throwOnError: false,
  });
}
