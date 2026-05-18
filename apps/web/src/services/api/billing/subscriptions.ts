/**
 * Subscriptions Service - Stripe Subscriptions API
 *
 * 100% type-safe RPC service for Stripe subscription operations
 * All types automatically inferred from backend Hono routes
 */

import type { InferRequestType, InferResponseType } from 'hono/client';

import type { ApiClientType } from '@/lib/api/client';
import { createApiClient, ServiceFetchError } from '@/lib/api/client';
import type { ServiceOptions } from '@/services/api/types';

// ============================================================================
// Type Inference - Endpoint definitions
// ============================================================================

type ListSubscriptionsEndpoint = ApiClientType['billing']['billing']['subscriptions']['$get'];
type GetSubscriptionEndpoint = ApiClientType['billing']['billing']['subscriptions'][':id']['$get'];

// ============================================================================
// Type Exports - Request/Response types
// ============================================================================

export type ListSubscriptionsResponse = InferResponseType<ListSubscriptionsEndpoint, 200>;
export type GetSubscriptionRequest = InferRequestType<GetSubscriptionEndpoint>;
export type GetSubscriptionResponse = InferResponseType<GetSubscriptionEndpoint, 200>;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all subscriptions for authenticated user
 * Protected endpoint - requires authentication
 */
export async function getSubscriptionsService(options?: ServiceOptions): Promise<ListSubscriptionsResponse> {
  const client = createApiClient({
    bypassCache: options?.bypassCache,
    cookieHeader: options?.cookieHeader,
  });
  const res = await client.billing.billing.subscriptions.$get();
  if (!res.ok) {
    throw new ServiceFetchError(`Failed to fetch subscriptions: ${res.statusText}`, res.status, res.statusText);
  }
  return res.json();
}

/**
 * Get a specific subscription by ID
 * Protected endpoint - requires authentication and ownership
 */
export async function getSubscriptionService(data: GetSubscriptionRequest): Promise<GetSubscriptionResponse> {
  const client = createApiClient();
  const res = await client.billing.billing.subscriptions[':id'].$get(data);
  if (!res.ok) {
    throw new ServiceFetchError(`Failed to fetch subscription: ${res.statusText}`, res.status, res.statusText);
  }
  return res.json();
}

// ============================================================================
// Derived Types
// ============================================================================

type SubscriptionsSuccessData = Extract<ListSubscriptionsResponse, { success: true }> extends { data: infer D } ? D : never;
type SubscriptionItem = SubscriptionsSuccessData extends { items: (infer S)[] } ? S : never;

/**
 * Subscription - Subscription item derived from API response
 */
export type Subscription = SubscriptionItem;

// ============================================================================
// Type Guards - Use proper API response types for type safety
// ============================================================================

type SuccessResponse = Extract<ListSubscriptionsResponse, { success: true }>;

/**
 * Type guard to check if subscriptions response is successful
 * Uses runtime check to avoid TypeScript literal type comparison issues
 */
export function isSubscriptionsSuccess(response: unknown): response is SuccessResponse {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  return 'success' in response && response.success === true && 'data' in response && response.data !== null && response.data !== undefined;
}

/**
 * Type guard to check if response is an error
 */
export function isSubscriptionsError(response: unknown): response is { success: false; data: null } {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  return 'success' in response && response.success === false;
}

/**
 * Extract subscriptions array from response safely
 * Uses proper type inference from API response
 */
export function getSubscriptionsFromResponse(response: unknown): Subscription[] {
  if (!isSubscriptionsSuccess(response)) {
    return [];
  }
  return response.data.items;
}
