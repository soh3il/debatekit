/**
 * Usage Service - Chat Usage and Quota API
 *
 * 100% type-safe RPC service for usage tracking operations
 * All types automatically inferred from backend Hono routes via InferResponseType
 */

import type { InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';

import type { ApiClientType } from '@/lib/api/client';
import { createApiClient } from '@/lib/api/client';

// ============================================================================
// Type Inference - Automatically derived from backend routes
// ============================================================================

type GetUsageStatsEndpoint = ApiClientType['utility']['usage']['stats']['$get'];
export type GetUsageStatsResponse = InferResponseType<GetUsageStatsEndpoint, 200>;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get comprehensive usage statistics
 * Protected endpoint - requires authentication
 *
 * Returns ALL quota information:
 * - threads: { used, limit, remaining, percentage, status }
 * - messages: { used, limit, remaining, percentage, status }
 * - analysis: { used, limit, remaining, percentage, status }
 * - customRoles: { used, limit, remaining, percentage, status }
 * - period: { start, end, daysRemaining }
 * - subscription: { tier, isAnnual }
 */
export async function getUserUsageStatsService(options?: {
  bypassCache?: boolean;
  cookieHeader?: string;
}) {
  const client = createApiClient({
    bypassCache: options?.bypassCache,
    cookieHeader: options?.cookieHeader,
  });
  return parseResponse(client.utility.usage.stats.$get());
}

// ============================================================================
// Type Guards - Use proper API response types for type safety
// ============================================================================

type SuccessResponse = Extract<GetUsageStatsResponse, { success: true }>;

/**
 * Usage stats data shape - derived from successful response
 */
export type UsageStatsData = SuccessResponse['data'];

/**
 * Plan type from usage stats - derived from response data
 */
export type UsagePlanType = NonNullable<UsageStatsData['plan']>['type'];

/**
 * Type guard to check if usage stats response is successful
 * Uses runtime check to avoid TypeScript literal type comparison issues
 */
export function isUsageStatsSuccess(response: unknown): response is SuccessResponse {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  return 'success' in response && response.success === true && 'data' in response && response.data !== null && response.data !== undefined;
}

/**
 * Type guard to check if response is an error
 */
export function isUsageStatsError(response: unknown): response is { success: false; data: null } {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  return 'success' in response && response.success === false;
}

/**
 * Get plan type from usage stats response safely
 * Uses proper type inference from API response
 */
export function getPlanTypeFromUsageStats(response: unknown): UsagePlanType | undefined {
  if (!isUsageStatsSuccess(response)) {
    return undefined;
  }
  return response.data.plan?.type;
}
