/**
 * Admin Pipeline Service
 *
 * 100% type-safe RPC service for admin content pipeline operations.
 * Types fully inferred from backend via Hono RPC - no hardcoded types.
 */

import type { InferRequestType, InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';

import type { ApiClientType } from '@/lib/api/client';
import { createApiClient } from '@/lib/api/client';
import type { ServiceOptions } from '@/services/api/types';

// ============================================================================
// Type Inference - Endpoint definitions
// ============================================================================

type ListPipelineRunsEndpoint = ApiClientType['admin']['admin']['pipeline']['runs']['$get'];
type TriggerPipelineRunEndpoint = ApiClientType['admin']['admin']['pipeline']['runs']['$post'];
type GetPipelineRunEndpoint = ApiClientType['admin']['admin']['pipeline']['runs'][':id']['$get'];
type CancelPipelineRunEndpoint = ApiClientType['admin']['admin']['pipeline']['runs'][':id']['cancel']['$patch'];
type SubmitPipelineReviewEndpoint = ApiClientType['admin']['admin']['pipeline']['runs'][':runId']['review']['$post'];

// ============================================================================
// Type Exports - Request/Response types inferred from backend
// ============================================================================

// List pipeline runs
export type ListPipelineRunsParams = InferRequestType<ListPipelineRunsEndpoint>;
export type ListPipelineRunsResponse = InferResponseType<ListPipelineRunsEndpoint, 200>;
type ListSuccessResponse = Extract<ListPipelineRunsResponse, { success: true }>;
export type ListPipelineRunsData = ListSuccessResponse['data'];
export type PipelineRun = ListPipelineRunsData['runs'][number];

// Trigger pipeline run
export type TriggerPipelineRunRequest = InferRequestType<TriggerPipelineRunEndpoint>['json'];
export type TriggerPipelineRunResponse = InferResponseType<TriggerPipelineRunEndpoint, 201>;

// Get pipeline run detail
export type GetPipelineRunParams = InferRequestType<GetPipelineRunEndpoint>;
export type GetPipelineRunResponse = InferResponseType<GetPipelineRunEndpoint, 200>;

// Cancel pipeline run
export type CancelPipelineRunParams = InferRequestType<CancelPipelineRunEndpoint>;
export type CancelPipelineRunResponse = InferResponseType<CancelPipelineRunEndpoint, 200>;

// Submit pipeline review
export type SubmitPipelineReviewRequest = InferRequestType<SubmitPipelineReviewEndpoint>['json'];
export type SubmitPipelineReviewResponse = InferResponseType<SubmitPipelineReviewEndpoint, 200>;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * List pipeline runs (admin only)
 */
export async function listPipelineRunsService(
  params?: { query?: ListPipelineRunsParams['query'] },
  options?: ServiceOptions,
) {
  const client = createApiClient({ cookieHeader: options?.cookieHeader });
  const requestParams = { query: params?.query ?? {} };
  return parseResponse(client.admin.admin.pipeline.runs.$get(requestParams));
}

/**
 * Trigger a manual pipeline run (admin only)
 */
export async function triggerPipelineRunService(params?: TriggerPipelineRunRequest) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.pipeline.runs.$post({ json: params ?? {} }));
}

/**
 * Get pipeline run details by ID (admin only)
 */
export async function getPipelineRunService(id: string) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.pipeline.runs[':id'].$get({ param: { id } }));
}

/**
 * Cancel a pipeline run (admin only)
 */
export async function cancelPipelineRunService(id: string) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.pipeline.runs[':id'].cancel.$patch({ param: { id } }));
}

/**
 * Submit reviewed topics for a pipeline run awaiting review (admin only)
 */
export async function submitPipelineReviewService(runId: string, topics: SubmitPipelineReviewRequest['topics']) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.pipeline.runs[':runId'].review.$post({
    json: { topics },
    param: { runId },
  }));
}
