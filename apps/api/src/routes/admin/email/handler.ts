/**
 * Admin Email Handlers
 *
 * Handlers for admin email test sends and campaign triggers.
 */

import { EmailSendingMessageTypes } from '@debatekit/shared/enums';
import type { RouteHandler } from '@hono/zod-openapi';

import { createHandler, Responses } from '@/core';
import { getDbAsync } from '@/db';
import { AdminUserSchema, requireAdmin } from '@/lib/auth/utils';
import { log } from '@/lib/logger';
import { enqueueEmail } from '@/services/email';
import type { ApiEnv } from '@/types';

import type { adminSendTestEmailRoute, adminTriggerCampaignRoute } from './route';
import { AdminSendTestEmailBodySchema, AdminTriggerCampaignBodySchema } from './schema';

/**
 * Send a test marketing email (admin only)
 *
 * Enqueues a single email directly, bypassing cohort/preference checks.
 * Useful for verifying templates, deliverability, and tracking.
 */
export const adminSendTestEmailHandler: RouteHandler<typeof adminSendTestEmailRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'adminSendTestEmail',
    validateBody: AdminSendTestEmailBodySchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(AdminUserSchema.parse(user));

    const { category, recipientEmail, subject, templateId, templateVars } = c.validated.body;

    const db = await getDbAsync();

    // Use the existing enqueueEmail service which creates send_log + enqueues
    const sendLogId = await enqueueEmail(db, c.env, {
      category,
      recipientEmail,
      subject: subject ?? `[Test] ${templateId}`,
      templateId,
      templateVars: {
        userName: 'Test User',
        ...templateVars,
      },
      userId: user.id,
    });

    log.info('Admin test email enqueued', {
      adminUserId: user.id,
      recipientEmail,
      sendLogId,
      templateId,
    });

    return Responses.ok(c, { sendLogId, status: 'queued' as const });
  },
);

/**
 * Trigger a campaign (admin only)
 *
 * Enqueues a TRIGGER_CAMPAIGN message which will query eligible users
 * and send individual emails to each.
 */
export const adminTriggerCampaignHandler: RouteHandler<typeof adminTriggerCampaignRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'adminTriggerCampaign',
    validateBody: AdminTriggerCampaignBodySchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(AdminUserSchema.parse(user));

    const { campaignType, maxRecipients } = c.validated.body;

    // Enqueue campaign trigger message
    await c.env.EMAIL_SENDING_QUEUE.send({
      campaignType,
      maxRecipients: maxRecipients ?? 10,
      type: EmailSendingMessageTypes.TRIGGER_CAMPAIGN,
    });

    log.info('Admin campaign triggered', {
      adminUserId: user.id,
      campaignType,
      maxRecipients: maxRecipients ?? 10,
    });

    return Responses.ok(c, { campaignType, status: 'triggered' as const });
  },
);
