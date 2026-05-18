import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createApiResponseSchema, createProtectedRouteResponses } from '@/core';

import { PipelineReviewBodySchema, PipelineReviewParamsSchema, PipelineReviewResponseSchema } from './schema';

/**
 * Admin: Submit reviewed topics for a pipeline run awaiting review
 */
export const submitPipelineReviewRoute = createRoute({
  description: 'Submit reviewed/customized topics for a pipeline run that is awaiting admin review. Creates automated jobs for the approved topics.',
  method: 'post',
  path: '/admin/pipeline/runs/{runId}/review',
  request: {
    body: {
      content: {
        'application/json': {
          schema: PipelineReviewBodySchema,
        },
      },
      required: true,
    },
    params: PipelineReviewParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(PipelineReviewResponseSchema),
        },
      },
      description: 'Review submitted, jobs created',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Submit pipeline review (admin only)',
  tags: ['admin-pipeline'],
});
