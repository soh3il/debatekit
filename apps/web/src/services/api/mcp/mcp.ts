/**
 * MCP Service - Credit Balance, Usage, and History API
 *
 * 100% type-safe RPC service for MCP dashboard operations
 * All types automatically inferred from backend Hono routes via InferResponseType
 */

import type { InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';

import type { ApiClientType } from '@/lib/api/client';
import { createApiClient } from '@/lib/api/client';

// ============================================================================
// Type Inference - Automatically derived from backend routes
// ============================================================================

type GetMcpCreditsEndpoint = ApiClientType['mcp']['mcp']['credits']['$get'];
export type GetMcpCreditsResponse = InferResponseType<GetMcpCreditsEndpoint, 200>;

type GetMcpUsageEndpoint = ApiClientType['mcp']['mcp']['usage']['$get'];
export type GetMcpUsageResponse = InferResponseType<GetMcpUsageEndpoint, 200>;

type GetMcpHistoryEndpoint = ApiClientType['mcp']['mcp']['history']['$get'];
export type GetMcpHistoryResponse = InferResponseType<GetMcpHistoryEndpoint, 200>;

// ============================================================================
// Derived Types
// ============================================================================

type McpCreditsSuccessResponse = Extract<GetMcpCreditsResponse, { success: true }>;
export type McpCreditsData = McpCreditsSuccessResponse['data'];

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get MCP credit balance and plan information
 * Protected endpoint - requires authentication
 */
export async function getMcpCreditsService(options?: {
  bypassCache?: boolean;
  cookieHeader?: string;
}) {
  const client = createApiClient({
    bypassCache: options?.bypassCache,
    cookieHeader: options?.cookieHeader,
  });
  return parseResponse(client.mcp.mcp.credits.$get());
}

/**
 * Get MCP usage counters across time windows
 * Protected endpoint - requires authentication
 */
export async function getMcpUsageService(options?: {
  bypassCache?: boolean;
  cookieHeader?: string;
}) {
  const client = createApiClient({
    bypassCache: options?.bypassCache,
    cookieHeader: options?.cookieHeader,
  });
  return parseResponse(client.mcp.mcp.usage.$get());
}

/**
 * Get MCP credit transaction history
 * Protected endpoint - requires authentication
 *
 * @param params - Pagination params (limit, offset)
 * @param options - Service options (cookieHeader for SSR)
 */
export async function getMcpHistoryService(params?: {
  limit?: number;
  offset?: number;
}, options?: {
  cookieHeader?: string;
}) {
  const client = createApiClient({ cookieHeader: options?.cookieHeader });
  return parseResponse(
    client.mcp.mcp.history.$get({
      query: {
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
      },
    }),
  );
}
