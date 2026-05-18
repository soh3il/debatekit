/**
 * Admin Tweets Service
 *
 * 100% type-safe RPC service for admin scheduled tweet operations
 * Types fully inferred from backend via Hono RPC - no hardcoded types
 */

import type { InferRequestType, InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';

import type { ApiClientType } from '@/lib/api/client';
import { createApiClient } from '@/lib/api/client';
import type { ServiceOptions } from '@/services/api/types';

// ============================================================================
// Type Inference - Endpoint definitions
// ============================================================================

type ListTweetsEndpoint = ApiClientType['admin']['admin']['tweets']['$get'];
type CreateTweetEndpoint = ApiClientType['admin']['admin']['tweets']['$post'];
type UpdateTweetEndpoint = ApiClientType['admin']['admin']['tweets'][':id']['$patch'];
type SendTweetEndpoint = ApiClientType['admin']['admin']['tweets'][':id']['send']['$post'];
type DeleteTweetEndpoint = ApiClientType['admin']['admin']['tweets'][':id']['$delete'];

// ============================================================================
// Type Exports - Request/Response types inferred from backend
// ============================================================================

// List tweets
export type ListTweetsParams = InferRequestType<ListTweetsEndpoint>;
export type ListTweetsResponse = InferResponseType<ListTweetsEndpoint, 200>;
type ListSuccessResponse = Extract<ListTweetsResponse, { success: true }>;
export type ListTweetsData = ListSuccessResponse['data'];
export type ScheduledTweet = ListTweetsData['tweets'][number];

// Create tweet
export type CreateTweetParams = InferRequestType<CreateTweetEndpoint>;
export type CreateTweetResponse = InferResponseType<CreateTweetEndpoint, 201>;

// Update tweet
export type UpdateTweetParams = InferRequestType<UpdateTweetEndpoint>;
export type UpdateTweetResponse = InferResponseType<UpdateTweetEndpoint, 200>;

// Send tweet
export type SendTweetParams = InferRequestType<SendTweetEndpoint>;
export type SendTweetResponse = InferResponseType<SendTweetEndpoint, 200>;

// Delete tweet
export type DeleteTweetParams = InferRequestType<DeleteTweetEndpoint>;
export type DeleteTweetResponse = InferResponseType<DeleteTweetEndpoint, 200>;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * List scheduled tweets (admin only)
 */
export async function listTweetsService(
  params?: { query?: ListTweetsParams['query'] },
  options?: ServiceOptions,
) {
  const client = createApiClient({ cookieHeader: options?.cookieHeader });
  const requestParams = { query: params?.query ?? {} };
  return parseResponse(client.admin.admin.tweets.$get(requestParams));
}

/**
 * Create a scheduled tweet (admin only)
 */
export async function createTweetService(data: CreateTweetParams) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.tweets.$post(data));
}

/**
 * Update a scheduled tweet (admin only)
 */
export async function updateTweetService(params: UpdateTweetParams) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.tweets[':id'].$patch(params));
}

/**
 * Send tweet immediately (admin only)
 */
export async function sendTweetService(params: SendTweetParams) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.tweets[':id'].send.$post(params));
}

/**
 * Delete a scheduled tweet (admin only)
 */
export async function deleteTweetService(params: DeleteTweetParams) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.tweets[':id'].$delete(params));
}
