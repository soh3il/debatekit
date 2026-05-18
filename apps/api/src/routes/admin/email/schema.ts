/**
 * Admin Email Schemas
 *
 * Schemas for admin email test/trigger endpoints.
 */

import { z } from '@hono/zod-openapi';
import { EmailCategorySchema, EmailTemplateIdSchema } from '@debatekit/shared/enums';

// ============================================================================
// Send Test Email
// ============================================================================

export const AdminSendTestEmailBodySchema = z.object({
  category: EmailCategorySchema.openapi({
    description: 'Email category',
    example: 'marketing',
  }),
  recipientEmail: z.string().email().openapi({
    description: 'Recipient email address',
    example: 'test@example.com',
  }),
  subject: z.string().min(1).max(200).optional().openapi({
    description: 'Override subject line (uses template default if omitted)',
    example: 'Test: Welcome to DebateKit',
  }),
  templateId: EmailTemplateIdSchema.openapi({
    description: 'Email template to send',
    example: 'onboarding-welcome',
  }),
  templateVars: z.record(z.string(), z.string()).optional().openapi({
    description: 'Optional template variables (userName, etc.)',
  }),
}).openapi('AdminSendTestEmailBody');

export type AdminSendTestEmailBody = z.infer<typeof AdminSendTestEmailBodySchema>;

export const AdminSendTestEmailPayloadSchema = z.object({
  sendLogId: z.string().openapi({
    description: 'Send log ID for tracking',
    example: '01HXYZ...',
  }),
  status: z.literal('queued').openapi({
    description: 'Email status (queued for async processing)',
  }),
}).openapi('AdminSendTestEmailPayload');

// ============================================================================
// Trigger Campaign
// ============================================================================

export const AdminTriggerCampaignBodySchema = z.object({
  campaignType: z.string().min(1).openapi({
    description: 'Campaign type (e.g., onboarding-welcome, retention-7d, newsletter-weekly)',
    example: 'onboarding-welcome',
  }),
  maxRecipients: z.number().int().min(1).max(100).optional().openapi({
    description: 'Max recipients to send to (default: 10, for safety)',
    example: 10,
  }),
}).openapi('AdminTriggerCampaignBody');

export type AdminTriggerCampaignBody = z.infer<typeof AdminTriggerCampaignBodySchema>;

export const AdminTriggerCampaignPayloadSchema = z.object({
  campaignType: z.string().openapi({
    description: 'Campaign type that was triggered',
  }),
  status: z.literal('triggered').openapi({
    description: 'Campaign was enqueued for processing',
  }),
}).openapi('AdminTriggerCampaignPayload');
