/**
 * MCP Query Hooks
 *
 * TanStack Query hooks for fetching MCP credit balance, usage, and history.
 * Uses shared queryOptions for SSR hydration consistency.
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { mcpCreditsQueryOptions, mcpHistoryInfiniteQueryOptions, mcpUsageQueryOptions } from '@/lib/data/keys';

/**
 * Query hook for fetching MCP credit balance and plan info.
 * Uses shared queryOptions so SSR-prefetched data is a cache hit.
 */
export function useMcpCreditsQuery() {
  const { isAuthenticated } = useAuthCheck();

  return useQuery({
    ...mcpCreditsQueryOptions,
    enabled: isAuthenticated,
    throwOnError: false,
  });
}

/**
 * Query hook for fetching MCP usage counters (rate limits, cooldowns).
 * Uses shared queryOptions so SSR-prefetched data is a cache hit.
 * Polls every 60s when tab is focused to keep limits fresh.
 */
export function useMcpUsageQuery() {
  const { isAuthenticated } = useAuthCheck();

  return useQuery({
    ...mcpUsageQueryOptions,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    throwOnError: false,
  });
}

/**
 * Infinite query hook for fetching MCP transaction history with pagination.
 * Loads pages of 20 items as user scrolls.
 */
export function useMcpHistoryInfiniteQuery() {
  const { isAuthenticated } = useAuthCheck();

  return useInfiniteQuery({
    ...mcpHistoryInfiniteQueryOptions,
    enabled: isAuthenticated,
    throwOnError: false,
  });
}
