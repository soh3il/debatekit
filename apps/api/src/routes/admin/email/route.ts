/**
 * Admin Email Routes
 *
 * Admin-only endpoints for testing email sends and triggering campaigns.
 */

import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createApiResponseSchema, createProtectedRouteResponses } from '@/core';

import {
  AdminSendTestEmailBodySchema,
  AdminSendTestEmailPayloadSchema,
  AdminTriggerCampaignBodySchema,
  AdminTriggerCampaignPayloadSchema,
} from './schema';

/**
 * Admin: Send a test marketing email
 * Enqueues a single email to the specified recipient via the email queue.
 */
export const adminSendTestEmailRoute = createRoute({
  description: 'Send a test marketing email to a specific address. Bypasses cohort/preference checks. Admin only.',
  method: 'post',
  path: '/admin/email/send-test',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AdminSendTestEmailBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(AdminSendTestEmailPayloadSchema),
        },
      },
      description: 'Test email enqueued successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Send test marketing email (admin only)',
  tags: ['admin'],
});

/**
 * Admin: Trigger a campaign
 * Enqueues a TRIGGER_CAMPAIGN message to the email queue.
 */
export const adminTriggerCampaignRoute = createRoute({
  description: 'Trigger a marketing email campaign. Queries eligible users and enqueues emails. Admin only.',
  method: 'post',
  path: '/admin/email/trigger-campaign',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AdminTriggerCampaignBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(AdminTriggerCampaignPayloadSchema),
        },
      },
      description: 'Campaign triggered successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Trigger email campaign (admin only)',
  tags: ['admin'],
});
