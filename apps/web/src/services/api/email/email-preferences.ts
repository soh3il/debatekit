/**
 * Email Preferences Service - Email Preference Management
 *
 * 100% type-safe RPC service for email preference operations
 * All types automatically inferred from backend Hono routes via InferResponseType
 */

import type { InferRequestType, InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';

import type { ApiClientType } from '@/lib/api/client';
import { createApiClient } from '@/lib/api/client';
import type { ServiceOptions } from '@/services/api/types';

// ============================================================================
// Type Inference - Automatically derived from backend routes
// ============================================================================

// Authenticated preference endpoints
type GetEmailPreferencesEndpoint = ApiClientType['email']['email']['preferences']['$get'];
export type GetEmailPreferencesResponse = InferResponseType<GetEmailPreferencesEndpoint, 200>;
export type GetEmailPreferencesRequest = InferRequestType<GetEmailPreferencesEndpoint>;

type UpdateEmailPreferencesEndpoint = ApiClientType['email']['email']['preferences']['$put'];
export type UpdateEmailPreferencesResponse = InferResponseType<UpdateEmailPreferencesEndpoint, 200>;
export type UpdateEmailPreferencesRequest = InferRequestType<UpdateEmailPreferencesEndpoint>;

// Public unsubscribe/resubscribe endpoints
type ValidateUnsubscribeEndpoint = ApiClientType['email']['email']['unsubscribe']['$get'];
export type ValidateUnsubscribeResponse = InferResponseType<ValidateUnsubscribeEndpoint, 200>;
export type ValidateUnsubscribeRequest = InferRequestType<ValidateUnsubscribeEndpoint>;

type ConfirmUnsubscribeEndpoint = ApiClientType['email']['email']['unsubscribe']['$post'];
export type ConfirmUnsubscribeResponse = InferResponseType<ConfirmUnsubscribeEndpoint, 200>;
export type ConfirmUnsubscribeRequest = InferRequestType<ConfirmUnsubscribeEndpoint>;

type ConfirmResubscribeEndpoint = ApiClientType['email']['email']['resubscribe']['$post'];
export type ConfirmResubscribeResponse = InferResponseType<ConfirmResubscribeEndpoint, 200>;
export type ConfirmResubscribeRequest = InferRequestType<ConfirmResubscribeEndpoint>;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get email preferences for the authenticated user
 * Protected endpoint - requires authentication
 */
export async function getEmailPreferencesService(data?: GetEmailPreferencesRequest, options?: ServiceOptions) {
  const client = createApiClient({ cookieHeader: options?.cookieHeader });
  return parseResponse(client.email.email.preferences.$get(data ?? {}));
}

/**
 * Update email preferences for the authenticated user
 * Protected endpoint - requires authentication
 */
export async function updateEmailPreferencesService(data: UpdateEmailPreferencesRequest) {
  const client = createApiClient();
  return parseResponse(client.email.email.preferences.$put(data));
}

/**
 * Validate an unsubscribe token from an email link
 * Public endpoint - no authentication required
 */
export async function validateUnsubscribeService(data: ValidateUnsubscribeRequest) {
  const client = createApiClient();
  return parseResponse(client.email.email.unsubscribe.$get(data));
}

/**
 * Confirm unsubscription from an email category
 * Public endpoint - no authentication required
 */
export async function confirmUnsubscribeService(data: ConfirmUnsubscribeRequest) {
  const client = createApiClient();
  return parseResponse(client.email.email.unsubscribe.$post(data));
}

/**
 * Confirm resubscription to an email category
 * Public endpoint - no authentication required
 */
export async function confirmResubscribeService(data: ConfirmResubscribeRequest) {
  const client = createApiClient();
  return parseResponse(client.email.email.resubscribe.$post(data));
}
