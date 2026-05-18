import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getAdminJobs } from '@/server/admin-jobs';
import { getAdminPipelineRuns } from '@/server/admin-pipeline';
import { getAdminSettings } from '@/server/admin-settings';
import { getAdminTweets } from '@/server/admin-tweets';

import { GC_TIMES, STALE_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

export const adminKeys = {
  adminJobs: {
    all: QueryKeyFactory.base('adminJobs'),
    detail: (id: string) => QueryKeyFactory.detail('adminJobs', id),
    details: () => [...adminKeys.adminJobs.all, 'detail'] as const,
    list: (status?: string) =>
      status
        ? QueryKeyFactory.action('adminJobs', 'list', status)
        : QueryKeyFactory.list('adminJobs'),
    lists: () => [...adminKeys.adminJobs.all, 'list'] as const,
  },

  adminPipeline: {
    all: QueryKeyFactory.base('adminPipeline'),
    detail: (id: string) => QueryKeyFactory.detail('adminPipeline', id),
    details: () => [...adminKeys.adminPipeline.all, 'detail'] as const,
    list: (status?: string) =>
      status
        ? QueryKeyFactory.action('adminPipeline', 'list', status)
        : QueryKeyFactory.list('adminPipeline'),
    lists: () => [...adminKeys.adminPipeline.all, 'list'] as const,
  },

  adminSettings: {
    all: QueryKeyFactory.base('adminSettings'),
    current: () => QueryKeyFactory.current('adminSettings'),
  },

  adminTweets: {
    all: QueryKeyFactory.base('adminTweets'),
    detail: (id: string) => QueryKeyFactory.detail('adminTweets', id),
    details: () => [...adminKeys.adminTweets.all, 'detail'] as const,
    list: (status?: string) =>
      status
        ? QueryKeyFactory.action('adminTweets', 'list', status)
        : QueryKeyFactory.list('adminTweets'),
    lists: () => [...adminKeys.adminTweets.all, 'list'] as const,
  },
} as const;

export const adminJobsQueryOptions = queryOptions({
  gcTime: GC_TIMES.SHORT,
  queryFn: () => getAdminJobs(),
  queryKey: adminKeys.adminJobs.list(),
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  retry: false,
  staleTime: STALE_TIMES.adminJobs,
});

export const adminJobsInfiniteQueryOptions = infiniteQueryOptions({
  gcTime: GC_TIMES.SHORT,
  queryFn: async () => {
    const result = await getAdminJobs();
    if (!result.success) {
      throw new Error('Failed to fetch admin jobs');
    }
    return result;
  },
  initialPageParam: undefined as string | undefined,
  getNextPageParam: lastPage => lastPage.data?.nextCursor ?? undefined,
  queryKey: adminKeys.adminJobs.lists(),
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  staleTime: STALE_TIMES.adminJobs,
});

export const adminSettingsQueryOptions = queryOptions({
  gcTime: GC_TIMES.STANDARD,
  queryFn: () => getAdminSettings(),
  queryKey: adminKeys.adminSettings.current(),
  staleTime: STALE_TIMES.adminSettings,
});

export const adminPipelineRunsInfiniteQueryOptions = infiniteQueryOptions({
  gcTime: GC_TIMES.SHORT,
  queryFn: async () => {
    const result = await getAdminPipelineRuns();
    if (!result.success) {
      throw new Error('Failed to fetch pipeline runs');
    }
    return result;
  },
  initialPageParam: undefined as string | undefined,
  getNextPageParam: lastPage => lastPage.data?.nextCursor ?? undefined,
  queryKey: adminKeys.adminPipeline.list(),
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  staleTime: STALE_TIMES.adminPipeline,
});

export const adminTweetsInfiniteQueryOptions = infiniteQueryOptions({
  gcTime: GC_TIMES.SHORT,
  queryFn: async () => {
    const result = await getAdminTweets();
    if (!result.success) {
      throw new Error('Failed to fetch admin tweets');
    }
    return result;
  },
  initialPageParam: undefined as string | undefined,
  getNextPageParam: lastPage => lastPage.data?.nextCursor ?? undefined,
  queryKey: adminKeys.adminTweets.list(),
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  staleTime: STALE_TIMES.adminTweets,
});
