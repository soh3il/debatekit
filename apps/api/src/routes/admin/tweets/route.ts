import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createApiResponseSchema, createProtectedRouteResponses, IdParamSchema } from '@/core';

import {
  CreateTweetRequestSchema,
  DeleteTweetResponseSchema,
  SendTweetResponseSchema,
  TweetListQuerySchema,
  TweetListResponseSchema,
  TweetResponseSchema,
  UpdateTweetRequestSchema,
} from './schema';

/**
 * Admin: List scheduled tweets
 */
export const listTweetsRoute = createRoute({
  description: 'List all scheduled tweets with optional status filter. Ordered by createdAt desc.',
  method: 'get',
  path: '/admin/tweets',
  request: {
    query: TweetListQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(TweetListResponseSchema),
        },
      },
      description: 'Tweets retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'List scheduled tweets (admin only)',
  tags: ['admin-tweets'],
});

/**
 * Admin: Create scheduled tweet
 */
export const createTweetRoute = createRoute({
  description: 'Create a new scheduled tweet. If scheduledAt is provided, status is set to scheduled; otherwise draft.',
  method: 'post',
  path: '/admin/tweets',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTweetRequestSchema,
        },
      },
    },
  },
  responses: {
    [HttpStatusCodes.CREATED]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(TweetResponseSchema),
        },
      },
      description: 'Tweet created',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Create scheduled tweet (admin only)',
  tags: ['admin-tweets'],
});

/**
 * Admin: Update scheduled tweet
 */
export const updateTweetRoute = createRoute({
  description: 'Update a draft or scheduled tweet. Cannot update sent or failed tweets.',
  method: 'patch',
  path: '/admin/tweets/{id}',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateTweetRequestSchema,
        },
      },
    },
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(TweetResponseSchema),
        },
      },
      description: 'Tweet updated',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Update scheduled tweet (admin only)',
  tags: ['admin-tweets'],
});

/**
 * Admin: Send tweet immediately
 */
export const sendTweetRoute = createRoute({
  description: 'Queue a draft or scheduled tweet for immediate posting via the tweet posting queue.',
  method: 'post',
  path: '/admin/tweets/{id}/send',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(SendTweetResponseSchema),
        },
      },
      description: 'Tweet queued for sending',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Send tweet immediately (admin only)',
  tags: ['admin-tweets'],
});

/**
 * Admin: Delete scheduled tweet
 */
export const deleteTweetRoute = createRoute({
  description: 'Delete a draft or scheduled tweet. Cannot delete sent or failed tweets.',
  method: 'delete',
  path: '/admin/tweets/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(DeleteTweetResponseSchema),
        },
      },
      description: 'Tweet deleted',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Delete scheduled tweet (admin only)',
  tags: ['admin-tweets'],
});
