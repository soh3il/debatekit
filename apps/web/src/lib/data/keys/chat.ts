/**
 * Chat domain query keys & options
 *
 * Contains threads, customRoles, and podcast key definitions,
 * plus thread-related query options for SSR hydration consistency.
 */
import type { PodcastScope } from '@debatekit/shared/enums';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getSidebarThreads } from '@/server/sidebar-threads';
import { getThreadBySlug, getThreadChangelog, getThreadPreSearches } from '@/server/thread';

import { GC_TIMES, STALE_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

export const chatKeys = {
  // Chat Custom Roles
  customRoles: {
    all: QueryKeyFactory.base('customRoles'),
    detail: (id: string) => QueryKeyFactory.detail('customRoles', id),
    details: () => [...chatKeys.customRoles.all, 'detail'] as const,
    list: (cursor?: string) =>
      cursor
        ? QueryKeyFactory.action('customRoles', 'list', cursor)
        : QueryKeyFactory.list('customRoles'),
    lists: () => [...chatKeys.customRoles.all, 'list'] as const,
  },

  // Podcast
  podcast: {
    all: QueryKeyFactory.base('podcast'),
    audio: (threadId: string, scope: PodcastScope, roundNumber?: number) =>
      [...QueryKeyFactory.base('podcast'), 'audio', threadId, scope, ...(roundNumber !== undefined ? [String(roundNumber)] : [])] as const,
    detail: (threadId: string, scope: PodcastScope, roundNumber?: number) =>
      [...QueryKeyFactory.base('podcast'), 'detail', threadId, scope, ...(roundNumber !== undefined ? [String(roundNumber)] : [])] as const,
    episodes: (threadId: string) =>
      [...QueryKeyFactory.base('podcast'), 'episodes', threadId] as const,
    public: (slug: string) => QueryKeyFactory.action('podcast', 'public', slug),
    publicEpisodes: (slug: string) => [...QueryKeyFactory.base('podcast'), 'public-episodes', slug] as const,
  },

  // Chat Threads
  threads: {
    all: QueryKeyFactory.base('threads'),
    bySlug: (slug: string) => QueryKeyFactory.action('threads', 'slug', slug),
    changelog: (id: string) => QueryKeyFactory.action('threads', 'changelog', id),
    detail: (id: string) => QueryKeyFactory.detail('threads', id),
    details: () => [...chatKeys.threads.all, 'detail'] as const,
    list: (cursor?: string) =>
      cursor
        ? QueryKeyFactory.action('threads', 'list', cursor)
        : QueryKeyFactory.list('threads'),
    lists: (search?: string) =>
      search
        ? [...chatKeys.threads.all, 'list', 'search', search] as const
        : [...chatKeys.threads.all, 'list'] as const,
    messages: (id: string) => QueryKeyFactory.action('threads', 'messages', id),
    preSearches: (id: string) => QueryKeyFactory.action('threads', 'pre-searches', id),
    public: (slug: string) => QueryKeyFactory.action('threads', 'public', slug),
    publicSlugs: () => QueryKeyFactory.action('threads', 'public', 'slugs'),
    roundChangelog: (id: string, roundNumber: number) =>
      QueryKeyFactory.action('threads', 'changelog', id, 'round', String(roundNumber)),
    sidebar: (search?: string) =>
      search
        ? [...chatKeys.threads.all, 'sidebar', 'search', search] as const
        : [...chatKeys.threads.all, 'sidebar'] as const,
    slugStatus: (id: string) => QueryKeyFactory.action('threads', 'slug-status', id),
  },
} as const;

export const sidebarThreadsQueryOptions = infiniteQueryOptions({
  queryFn: async () => {
    const result = await getSidebarThreads();
    if (!result.success) {
      throw new Error('Failed to fetch sidebar threads');
    }
    return result;
  },
  initialPageParam: undefined as string | undefined,
  getNextPageParam: lastPage => lastPage.data?.pagination?.nextCursor,
  queryKey: chatKeys.threads.sidebar(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: STALE_TIMES.threadsSidebar,
});

export function threadBySlugQueryOptions(slug: string) {
  return queryOptions({
    gcTime: GC_TIMES.LONG,
    queryFn: () => getThreadBySlug({ data: slug }),
    queryKey: chatKeys.threads.bySlug(slug),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: STALE_TIMES.threadMetadata,
  });
}

export function threadChangelogQueryOptions(threadId: string) {
  return queryOptions({
    queryFn: () => getThreadChangelog({ data: threadId }),
    queryKey: chatKeys.threads.changelog(threadId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: STALE_TIMES.threadChangelog,
  });
}

export function threadPreSearchesQueryOptions(threadId: string) {
  return queryOptions({
    queryFn: () => getThreadPreSearches({ data: threadId }),
    queryKey: chatKeys.threads.preSearches(threadId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: STALE_TIMES.preSearch,
  });
}
