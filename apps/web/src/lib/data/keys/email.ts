import { queryOptions } from '@tanstack/react-query';

import { getEmailPreferences } from '@/server/email-preferences';

import { GC_TIMES, STALE_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

export const emailKeys = {
  emailPreferences: {
    all: QueryKeyFactory.base('emailPreferences'),
    list: () => QueryKeyFactory.list('emailPreferences'),
  },
} as const;

export const emailPreferencesQueryOptions = queryOptions({
  gcTime: GC_TIMES.STANDARD,
  queryFn: () => getEmailPreferences(),
  queryKey: emailKeys.emailPreferences.list(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: false,
  staleTime: STALE_TIMES.emailPreferences,
});
