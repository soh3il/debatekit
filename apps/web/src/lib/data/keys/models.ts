import { queryOptions } from '@tanstack/react-query';

import { getModels } from '@/server/models';

import { GC_TIMES, STALE_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

export const modelKeys = {
  models: {
    all: QueryKeyFactory.base('models'),
    list: () => QueryKeyFactory.list('models'),
  },
} as const;

export const modelsQueryOptions = queryOptions({
  gcTime: GC_TIMES.INFINITE,
  queryFn: () => getModels(),
  queryKey: modelKeys.models.list(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 2,
  staleTime: STALE_TIMES.models,
});
