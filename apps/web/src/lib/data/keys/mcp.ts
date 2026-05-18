import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getMcpCredits, getMcpHistory, getMcpUsage } from '@/server/mcp';
import type { GetMcpHistoryResponse } from '@/services/api';
import { getMcpHistoryService } from '@/services/api';

import { GC_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

type McpHistorySuccessPage = Extract<GetMcpHistoryResponse, { success: true }>;

const MCP_HISTORY_PAGE_SIZE = 20;

export const mcpKeys = {
  mcp: {
    all: QueryKeyFactory.base('mcp'),
    credits: () => QueryKeyFactory.action('mcp', 'credits'),
    history: (limit?: number) =>
      limit
        ? [...QueryKeyFactory.base('mcp'), 'history', String(limit)] as const
        : QueryKeyFactory.action('mcp', 'history'),
    historyInfinite: () => [...QueryKeyFactory.base('mcp'), 'history', 'infinite'] as const,
    usage: () => QueryKeyFactory.action('mcp', 'usage'),
  },
} as const;

export const mcpCreditsQueryOptions = queryOptions({
  gcTime: GC_TIMES.STANDARD,
  queryFn: () => getMcpCredits(),
  queryKey: mcpKeys.mcp.credits(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: 30 * 1000,
});

export const mcpUsageQueryOptions = queryOptions({
  gcTime: GC_TIMES.SHORT,
  queryFn: () => getMcpUsage(),
  queryKey: mcpKeys.mcp.usage(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: 15 * 1000,
});

export const mcpHistoryQueryOptions = queryOptions({
  gcTime: GC_TIMES.STANDARD,
  queryFn: () => getMcpHistory(),
  queryKey: mcpKeys.mcp.history(20),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: 30 * 1000,
});

export const mcpHistoryInfiniteQueryOptions = infiniteQueryOptions({
  gcTime: GC_TIMES.STANDARD,
  queryFn: async ({ pageParam = 0 }): Promise<McpHistorySuccessPage> => {
    const result = await getMcpHistoryService({ limit: MCP_HISTORY_PAGE_SIZE, offset: pageParam });
    if (!result.success) {
      throw new Error('Failed to fetch MCP history');
    }
    return result as McpHistorySuccessPage;
  },
  initialPageParam: 0,
  getNextPageParam: (lastPage: McpHistorySuccessPage, _allPages: McpHistorySuccessPage[], lastPageParam: number) => {
    if (!lastPage.data.hasMore) {
      return undefined;
    }
    return lastPageParam + lastPage.data.items.length;
  },
  queryKey: mcpKeys.mcp.historyInfinite(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: 30 * 1000,
});
