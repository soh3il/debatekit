/**
 * Project Memory Routes
 *
 * Endpoints for viewing and deleting project-scoped working memory.
 */

import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createMutationRouteResponses, createProtectedRouteResponses, IdParamSchema } from '@/core';

import {
  DeleteMemoryResponseSchema,
  ExtractMemoryRequestSchema,
  ExtractMemoryResponseSchema,
  ProjectMemoryResponseSchema,
  RestoreMemoryRequestSchema,
  RestoreMemoryResponseSchema,
} from './schema';

/**
 * Get the working memory for a project
 */
export const getProjectMemoryRoute = createRoute({
  description: 'Retrieve the AI-managed working memory for a project',
  method: 'get',
  path: '/projects/{id}/memory',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ProjectMemoryResponseSchema },
      },
      description: 'Project memory retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get project memory',
  tags: ['memories'],
});

/**
 * Delete the working memory for a project
 */
export const deleteProjectMemoryRoute = createRoute({
  description: 'Delete the AI-managed working memory for a project',
  method: 'delete',
  path: '/projects/{id}/memory',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: DeleteMemoryResponseSchema },
      },
      description: 'Project memory deleted successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Delete project memory',
  tags: ['memories'],
});

/**
 * Extract memory from a user message
 */
export const extractProjectMemoryRoute = createRoute({
  description: 'Analyze a user message and extract memorable content into project memory',
  method: 'post',
  path: '/projects/{id}/memory/extract',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ExtractMemoryRequestSchema,
        },
      },
    },
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ExtractMemoryResponseSchema },
      },
      description: 'Memory extraction completed',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Extract memory from message',
  tags: ['memories'],
});

/**
 * Restore (overwrite) the working memory for a project
 */
export const restoreProjectMemoryRoute = createRoute({
  description: 'Restore project memory to a specific content (for undo)',
  method: 'put',
  path: '/projects/{id}/memory',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RestoreMemoryRequestSchema,
        },
      },
    },
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: RestoreMemoryResponseSchema },
      },
      description: 'Project memory restored successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Restore project memory',
  tags: ['memories'],
});
