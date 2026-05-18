/**
 * Email Preferences Query Hooks
 *
 * TanStack Query hooks for fetching email preferences
 * Uses shared emailPreferencesQueryOptions for SSR hydration consistency
 */

import { useQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { emailPreferencesQueryOptions } from '@/lib/data/keys/email';

/**
 * Query hook for fetching email preferences
 * Uses shared queryOptions for SSR hydration consistency
 */
export function useEmailPreferencesQuery(enabled = true) {
  const { isAuthenticated } = useAuthCheck();

  return useQuery({
    ...emailPreferencesQueryOptions,
    enabled: isAuthenticated && enabled,
    throwOnError: false,
  });
}
