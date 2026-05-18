import { queryOptions } from '@tanstack/react-query';

import { getUsageStats } from '@/server/usage-stats';

import { STALE_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

export const usageKeys = {
  usage: {
    all: QueryKeyFactory.base('usage'),
    quotas: () => [...usageKeys.usage.all, 'quotas'] as const,
    stats: () => QueryKeyFactory.action('usage', 'stats'),
  },
} as const;

export const usageQueryOptions = queryOptions({
  queryFn: () => getUsageStats(),
  queryKey: usageKeys.usage.stats(),
  refetchOnMount: true,
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: STALE_TIMES.usageStats,
});
