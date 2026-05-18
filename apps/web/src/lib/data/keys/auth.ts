import { queryOptions } from '@tanstack/react-query';

import { getApiKeys } from '@/server/api-keys';
import { getSession } from '@/server/auth';

import { GC_TIMES, STALE_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

export const authKeys = {
  apiKeys: {
    all: QueryKeyFactory.base('apiKeys'),
    detail: (id: string) => QueryKeyFactory.detail('apiKeys', id),
    details: () => [...authKeys.apiKeys.all, 'detail'] as const,
    list: () => QueryKeyFactory.list('apiKeys'),
    lists: () => [...authKeys.apiKeys.all, 'list'] as const,
  },

  session: {
    all: QueryKeyFactory.base('session'),
    current: () => QueryKeyFactory.current('session'),
  },
} as const;

export const apiKeysListQueryOptions = queryOptions({
  gcTime: GC_TIMES.STANDARD,
  queryFn: () => getApiKeys(),
  queryKey: authKeys.apiKeys.list(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: false,
  staleTime: STALE_TIMES.apiKeys,
});

export const sessionQueryOptions = queryOptions({
  gcTime: GC_TIMES.SESSION,
  queryFn: () => getSession(),
  queryKey: authKeys.session.current(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: STALE_TIMES.session,
});
