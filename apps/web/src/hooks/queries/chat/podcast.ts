/**
 * Podcast Query Hooks
 *
 * TanStack Query hooks for fetching podcast metadata.
 * Protected and public variants for authenticated/anonymous access.
 */

import type { PodcastScope } from '@debatekit/shared/enums';
import { PodcastScopes, UserRoles } from '@debatekit/shared/enums';
import { useQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { useSession } from '@/lib/auth/client';
import { queryKeys } from '@/lib/data/keys';
import { GC_TIMES, STALE_TIME_PRESETS } from '@/lib/data/stale-times';
import {
  getPodcastEpisodesService,
  getPodcastService,
  getPublicPodcastEpisodesService,
  getPublicPodcastService,
} from '@/services/api';

/**
 * Hook to fetch podcast metadata for a thread
 * Protected endpoint - requires authentication
 *
 * @param threadId - Thread ID
 * @param scope - Podcast scope ('thread' or 'round')
 * @param roundNumber - Optional round number (required when scope is 'round')
 */
export function usePodcastQuery(
  threadId: string,
  scope: PodcastScope = PodcastScopes.THREAD,
  roundNumber?: number,
) {
  const { isAuthenticated } = useAuthCheck();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === UserRoles.ADMIN;

  return useQuery({
    enabled: isAuthenticated && isAdmin && !!threadId,
    gcTime: GC_TIMES.STANDARD,
    queryFn: () => getPodcastService({ roundNumber, scope, threadId }),
    queryKey: queryKeys.podcast.detail(threadId, scope, roundNumber),
    retry: false,
    staleTime: STALE_TIME_PRESETS.medium,
    throwOnError: false,
  });
}

/**
 * Hook to fetch public podcast metadata by slug
 * Public endpoint - no authentication required
 *
 * @param slug - Thread slug
 */
export function usePublicPodcastQuery(slug: string) {
  return useQuery({
    enabled: !!slug,
    gcTime: GC_TIMES.STANDARD,
    queryFn: () => getPublicPodcastService({ slug }),
    queryKey: queryKeys.podcast.public(slug),
    retry: false,
    staleTime: STALE_TIME_PRESETS.long,
    throwOnError: false,
  });
}

/**
 * Hook to fetch all podcast episodes for a thread
 * Protected endpoint - requires authentication
 *
 * Returns completed round-level podcasts for playlist playback.
 */
export function usePodcastEpisodesQuery(
  threadId: string,
  options?: { refetchInterval?: number | false },
) {
  const { isAuthenticated } = useAuthCheck();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === UserRoles.ADMIN;

  return useQuery({
    enabled: isAuthenticated && isAdmin && !!threadId,
    gcTime: GC_TIMES.STANDARD,
    queryFn: () => getPodcastEpisodesService({ threadId }),
    queryKey: queryKeys.podcast.episodes(threadId),
    refetchInterval: options?.refetchInterval ?? false,
    retry: false,
    staleTime: STALE_TIME_PRESETS.medium,
    throwOnError: false,
  });
}

/**
 * Hook to fetch podcast episodes for a public thread by slug.
 * Public endpoint - no authentication required.
 *
 * refetchOnMount: 'always' overrides the global default (false) because
 * public pages are edge-cached via ISR. The SSR-hydrated podcast data can
 * be hours old (podcast generated after the page was cached), so we always
 * refetch on mount to show the Listen button as soon as episodes exist.
 */
export function usePublicPodcastEpisodesQuery(
  slug: string,
  options?: { refetchInterval?: number | false },
) {
  return useQuery({
    enabled: !!slug,
    gcTime: GC_TIMES.STANDARD,
    queryFn: () => getPublicPodcastEpisodesService({ slug }),
    queryKey: queryKeys.podcast.publicEpisodes(slug),
    refetchInterval: options?.refetchInterval ?? false,
    refetchOnMount: 'always',
    retry: 1,
    staleTime: STALE_TIME_PRESETS.short,
    throwOnError: false,
  });
}
