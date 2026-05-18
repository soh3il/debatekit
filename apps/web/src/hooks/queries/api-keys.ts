/**
 * API Keys Query Hooks
 *
 * TanStack Query hooks for fetching API keys
 * Uses shared apiKeysListQueryOptions for SSR hydration consistency
 */

import { useQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { queryKeys } from '@/lib/data/keys';
import { apiKeysListQueryOptions } from '@/lib/data/keys/auth';
import { GC_TIMES, STALE_TIMES } from '@/lib/data/stale-times';
import {
  getApiKeyService,
} from '@/services/api';

/**
 * Query hook for fetching all API keys
 * Uses shared queryOptions for SSR hydration consistency
 */
export function useApiKeysQuery(enabled = true) {
  const { isAuthenticated } = useAuthCheck();

  return useQuery({
    ...apiKeysListQueryOptions,
    enabled: isAuthenticated && enabled,
    throwOnError: false,
  });
}

/**
 * Query hook for fetching a specific API key by ID
 */
export function useApiKeyQuery(keyId: string) {
  const { isAuthenticated } = useAuthCheck();

  return useQuery({
    enabled: isAuthenticated && !!keyId,
    gcTime: GC_TIMES.STANDARD, // 5 minutes
    queryFn: () => getApiKeyService({ param: { keyId } }),
    queryKey: queryKeys.apiKeys.detail(keyId),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: STALE_TIMES.apiKeys, // 5 minutes
    throwOnError: false,
  });
}
