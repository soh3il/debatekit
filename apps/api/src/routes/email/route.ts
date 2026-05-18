/**
 * Email Routes
 *
 * OpenAPI route definitions for email preferences, unsubscribe flows,
 * and tracking pixels (open/click).
 */

import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import {
  createProtectedRouteResponses,
  createPublicRouteResponses,
} from '@/core';

import {
  GetPreferencesResponseSchema,
  ResubscribeConfirmResponseSchema,
  ResubscribeRequestSchema,
  SendLogIdParamSchema,
  UnsubscribeConfirmResponseSchema,
  UnsubscribeQuerySchema,
  UnsubscribeRequestSchema,
  UnsubscribeValidationResponseSchema,
  UpdatePreferencesRequestSchema,
  UpdatePreferencesResponseSchema,
} from './schema';

// ============================================================================
// Authenticated Preference Routes
// ============================================================================

/**
 * Get email preferences for the authenticated user
 */
export const getPreferencesRoute = createRoute({
  description: 'Get all email category preferences for the authenticated user',
  method: 'get',
  path: '/email/preferences',
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: GetPreferencesResponseSchema },
      },
      description: 'Email preferences retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get email preferences',
  tags: ['email'],
});

/**
 * Update email preferences for the authenticated user
 */
export const updatePreferencesRoute = createRoute({
  description: 'Update email category subscription preferences',
  method: 'put',
  path: '/email/preferences',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdatePreferencesRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: UpdatePreferencesResponseSchema },
      },
      description: 'Email preferences updated successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Update email preferences',
  tags: ['email'],
});

// ============================================================================
// Public Unsubscribe / Resubscribe Routes
// ============================================================================

/**
 * Validate unsubscribe token (GET - landing page)
 */
export const validateUnsubscribeRoute = createRoute({
  description: 'Validate an HMAC unsubscribe token from an email link',
  method: 'get',
  path: '/email/unsubscribe',
  request: {
    query: UnsubscribeQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: UnsubscribeValidationResponseSchema },
      },
      description: 'Token validation result',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Validate unsubscribe token',
  tags: ['email'],
});

/**
 * Confirm unsubscribe (POST - form submission)
 */
export const confirmUnsubscribeRoute = createRoute({
  description: 'Confirm unsubscription from an email category',
  method: 'post',
  path: '/email/unsubscribe',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UnsubscribeRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: UnsubscribeConfirmResponseSchema },
      },
      description: 'Unsubscribe confirmed',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Confirm unsubscribe',
  tags: ['email'],
});

/**
 * Confirm resubscribe (POST - form submission)
 */
export const confirmResubscribeRoute = createRoute({
  description: 'Confirm resubscription to an email category',
  method: 'post',
  path: '/email/resubscribe',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ResubscribeRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ResubscribeConfirmResponseSchema },
      },
      description: 'Resubscribe confirmed',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Confirm resubscribe',
  tags: ['email'],
});

// ============================================================================
// Tracking Pixel Routes
// ============================================================================

/**
 * Track email open via 1x1 transparent GIF
 */
export const trackOpenRoute = createRoute({
  description: 'Track email open event and return a 1x1 transparent GIF',
  method: 'get',
  path: '/email/track/open/{logId}',
  request: {
    params: SendLogIdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: '1x1 transparent GIF pixel',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Track email open',
  tags: ['email'],
});

/**
 * Track email click via 302 redirect
 */
export const trackClickRoute = createRoute({
  description: 'Track email click event and redirect to destination URL',
  method: 'get',
  path: '/email/track/click/{logId}',
  request: {
    params: SendLogIdParamSchema,
  },
  responses: {
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: '302 redirect to destination URL',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Track email click',
  tags: ['email'],
});
