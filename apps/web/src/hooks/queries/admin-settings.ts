/**
 * Admin Settings Query Hook
 *
 * TanStack Query hook for fetching admin settings
 */

import { useQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { adminSettingsQueryOptions } from '@/lib/data/keys/admin';

/**
 * Query hook for fetching admin settings
 */
export function useAdminSettingsQuery() {
  const { isAuthenticated } = useAuthCheck();

  return useQuery({
    ...adminSettingsQueryOptions,
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    retry: false,
    throwOnError: false,
  });
}
