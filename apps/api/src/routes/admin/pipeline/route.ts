import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createApiResponseSchema, createProtectedRouteResponses, IdParamSchema } from '@/core';

import {
  FixDataResponseSchema,
  PipelineRunDetailResponseSchema,
  PipelineRunListQuerySchema,
  PipelineRunListResponseSchema,
  TriggerPipelineRequestSchema,
  TriggerPipelineResponseSchema,
} from './schema';

/**
 * Admin: Cancel a pipeline run
 */
export const cancelPipelineRunRoute = createRoute({
  description: 'Cancel a pending or active pipeline run. Also cancels any pending/running jobs created by this run.',
  method: 'patch',
  path: '/admin/pipeline/runs/{id}/cancel',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(PipelineRunDetailResponseSchema),
        },
      },
      description: 'Pipeline run cancelled',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Cancel pipeline run (admin only)',
  tags: ['admin-pipeline'],
});

/**
 * Admin: List pipeline runs
 */
export const listPipelineRunsRoute = createRoute({
  description: 'List all content pipeline runs with optional status filter. Ordered by createdAt desc.',
  method: 'get',
  path: '/admin/pipeline/runs',
  request: {
    query: PipelineRunListQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(PipelineRunListResponseSchema),
        },
      },
      description: 'Pipeline runs retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'List pipeline runs (admin only)',
  tags: ['admin-pipeline'],
});

/**
 * Admin: Trigger a manual pipeline run
 */
export const triggerPipelineRunRoute = createRoute({
  description: 'Trigger a manual content pipeline run. Starts trend discovery, viral scoring, and job creation.',
  method: 'post',
  path: '/admin/pipeline/runs',
  request: {
    body: {
      content: {
        'application/json': {
          schema: TriggerPipelineRequestSchema,
        },
      },
      required: false,
    },
  },
  responses: {
    [HttpStatusCodes.CREATED]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(TriggerPipelineResponseSchema),
        },
      },
      description: 'Pipeline run triggered',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Trigger manual pipeline run (admin only)',
  tags: ['admin-pipeline'],
});

/**
 * Admin: Fix production data (titles + tweet URLs)
 */
export const fixDataRoute = createRoute({
  description: 'Fix existing production data: generate AI titles for threads with "New Chat" title linked to automated jobs, and fix tweet URLs using wrong /listen/ path. Idempotent - safe to run multiple times.',
  method: 'patch',
  path: '/admin/pipeline/fix-data',
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(FixDataResponseSchema),
        },
      },
      description: 'Data fix completed',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Fix production data (admin only)',
  tags: ['admin-pipeline'],
});

/**
 * Admin: Get pipeline run details
 */
export const getPipelineRunRoute = createRoute({
  description: 'Get detailed information about a specific pipeline run, including discovered and selected topics.',
  method: 'get',
  path: '/admin/pipeline/runs/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(PipelineRunDetailResponseSchema),
        },
      },
      description: 'Pipeline run details retrieved',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get pipeline run details (admin only)',
  tags: ['admin-pipeline'],
});
