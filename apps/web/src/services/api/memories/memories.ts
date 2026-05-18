/**
 * Memory Service - Project Memory API
 *
 * Type-safe RPC service for unified project memory operations.
 * All types automatically inferred from backend Hono routes via InferResponseType.
 */

import type { InferRequestType, InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';

import type { ApiClientType } from '@/lib/api/client';
import { createApiClient } from '@/lib/api/client';
import type { ServiceOptions } from '@/services/api/types';

// ============================================================================
// Type Inference - Project Memory
// ============================================================================

type GetProjectMemoryEndpoint = ApiClientType['memory']['projects'][':id']['memory']['$get'];
export type GetProjectMemoryResponse = InferResponseType<GetProjectMemoryEndpoint, 200>;
export type GetProjectMemoryRequest = InferRequestType<GetProjectMemoryEndpoint>;

type DeleteProjectMemoryEndpoint = ApiClientType['memory']['projects'][':id']['memory']['$delete'];
export type DeleteProjectMemoryResponse = InferResponseType<DeleteProjectMemoryEndpoint, 200>;
export type DeleteProjectMemoryRequest = InferRequestType<DeleteProjectMemoryEndpoint>;

type ExtractProjectMemoryEndpoint = ApiClientType['memory']['projects'][':id']['memory']['extract']['$post'];
export type ExtractProjectMemoryResponse = InferResponseType<ExtractProjectMemoryEndpoint, 200>;
export type ExtractProjectMemoryRequest = InferRequestType<ExtractProjectMemoryEndpoint>;

type RestoreProjectMemoryEndpoint = ApiClientType['memory']['projects'][':id']['memory']['$put'];
export type RestoreProjectMemoryResponse = InferResponseType<RestoreProjectMemoryEndpoint, 200>;
export type RestoreProjectMemoryRequest = InferRequestType<RestoreProjectMemoryEndpoint>;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get the working memory for a project
 * Protected endpoint - requires authentication (ownership check)
 */
export async function getProjectMemoryService(data: GetProjectMemoryRequest, options?: ServiceOptions) {
  const client = createApiClient({ cookieHeader: options?.cookieHeader });
  return parseResponse(client.memory.projects[':id'].memory.$get(data));
}

/**
 * Delete the working memory for a project
 * Protected endpoint - requires authentication (ownership check)
 */
export async function deleteProjectMemoryService(data: DeleteProjectMemoryRequest) {
  const client = createApiClient();
  return parseResponse(client.memory.projects[':id'].memory.$delete(data));
}

/**
 * Extract memorable content from a user message
 * Fire-and-forget in background -- does not block streaming
 */
export async function extractProjectMemoryService(data: ExtractProjectMemoryRequest) {
  const client = createApiClient();
  return parseResponse(client.memory.projects[':id'].memory.extract.$post(data));
}

/**
 * Restore project memory to specific content (for undo)
 */
export async function restoreProjectMemoryService(data: RestoreProjectMemoryRequest) {
  const client = createApiClient();
  return parseResponse(client.memory.projects[':id'].memory.$put(data));
}
