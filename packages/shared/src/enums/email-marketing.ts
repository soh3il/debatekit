/**
 * Email Marketing Enums
 *
 * Enums for email marketing campaigns, send tracking, suppression, and templates.
 */

import { z } from '@hono/zod-openapi';

// ============================================================================
// EMAIL CATEGORY
// ============================================================================

export const EMAIL_CATEGORIES = ['marketing', 'newsletter', 'product_updates', 'tips', 'activity'] as const;

export const DEFAULT_EMAIL_CATEGORY: EmailCategory = 'marketing';

export const EmailCategorySchema = z.enum(EMAIL_CATEGORIES).openapi({
  description: 'Email marketing category',
  example: 'marketing',
});

export type EmailCategory = z.infer<typeof EmailCategorySchema>;

export const EmailCategories = {
  ACTIVITY: 'activity' as const,
  MARKETING: 'marketing' as const,
  NEWSLETTER: 'newsletter' as const,
  PRODUCT_UPDATES: 'product_updates' as const,
  TIPS: 'tips' as const,
} as const;

// ============================================================================
// EMAIL SEND STATUS
// ============================================================================

export const EMAIL_SEND_STATUSES = ['queued', 'sent', 'delivered', 'bounced', 'complained', 'failed'] as const;

export const DEFAULT_EMAIL_SEND_STATUS: EmailSendStatus = 'queued';

export const EmailSendStatusSchema = z.enum(EMAIL_SEND_STATUSES).openapi({
  description: 'Email send delivery status',
  example: 'queued',
});

export type EmailSendStatus = z.infer<typeof EmailSendStatusSchema>;

export const EmailSendStatuses = {
  BOUNCED: 'bounced' as const,
  COMPLAINED: 'complained' as const,
  DELIVERED: 'delivered' as const,
  FAILED: 'failed' as const,
  QUEUED: 'queued' as const,
  SENT: 'sent' as const,
} as const;

// ============================================================================
// EMAIL SUPPRESSION REASON
// ============================================================================

export const EMAIL_SUPPRESSION_REASONS = ['hard_bounce', 'soft_bounce', 'complaint', 'manual'] as const;

export const DEFAULT_EMAIL_SUPPRESSION_REASON: EmailSuppressionReason = 'manual';

export const EmailSuppressionReasonSchema = z.enum(EMAIL_SUPPRESSION_REASONS).openapi({
  description: 'Reason for email suppression',
  example: 'manual',
});

export type EmailSuppressionReason = z.infer<typeof EmailSuppressionReasonSchema>;

export const EmailSuppressionReasons = {
  COMPLAINT: 'complaint' as const,
  HARD_BOUNCE: 'hard_bounce' as const,
  MANUAL: 'manual' as const,
  SOFT_BOUNCE: 'soft_bounce' as const,
} as const;

// ============================================================================
// EMAIL TEMPLATE ID
// ============================================================================

export const EMAIL_TEMPLATE_IDS = [
  'onboarding-welcome',
  'onboarding-first-thread',
  'onboarding-power-tips',
  'onboarding-invite',
  'onboarding-pro-teaser',
  'onboarding-credits-reminder',
  'retention-7d',
  'retention-14d',
  'retention-30d',
  'retention-winback',
  'conversion-credits-low',
  'conversion-credits-depleted',
  'conversion-feature-limit',
  'conversion-social-proof',
  'pro-welcome',
  'pro-features-tour',
  'pro-tips',
  'newsletter-weekly-digest',
  'churn-sorry',
  'churn-what-you-lose',
  'churn-winback-offer',
] as const;

export const DEFAULT_EMAIL_TEMPLATE_ID: EmailTemplateId = 'onboarding-welcome';

export const EmailTemplateIdSchema = z.enum(EMAIL_TEMPLATE_IDS).openapi({
  description: 'Email template identifier',
  example: 'onboarding-welcome',
});

export type EmailTemplateId = z.infer<typeof EmailTemplateIdSchema>;

export const EmailTemplateIds = {
  CHURN_SORRY: 'churn-sorry' as const,
  CHURN_WHAT_YOU_LOSE: 'churn-what-you-lose' as const,
  CHURN_WINBACK_OFFER: 'churn-winback-offer' as const,
  CONVERSION_CREDITS_DEPLETED: 'conversion-credits-depleted' as const,
  CONVERSION_CREDITS_LOW: 'conversion-credits-low' as const,
  CONVERSION_FEATURE_LIMIT: 'conversion-feature-limit' as const,
  CONVERSION_SOCIAL_PROOF: 'conversion-social-proof' as const,
  NEWSLETTER_WEEKLY_DIGEST: 'newsletter-weekly-digest' as const,
  ONBOARDING_CREDITS_REMINDER: 'onboarding-credits-reminder' as const,
  ONBOARDING_FIRST_THREAD: 'onboarding-first-thread' as const,
  ONBOARDING_INVITE: 'onboarding-invite' as const,
  ONBOARDING_POWER_TIPS: 'onboarding-power-tips' as const,
  ONBOARDING_PRO_TEASER: 'onboarding-pro-teaser' as const,
  ONBOARDING_WELCOME: 'onboarding-welcome' as const,
  PRO_FEATURES_TOUR: 'pro-features-tour' as const,
  PRO_TIPS: 'pro-tips' as const,
  PRO_WELCOME: 'pro-welcome' as const,
  RETENTION_14D: 'retention-14d' as const,
  RETENTION_30D: 'retention-30d' as const,
  RETENTION_7D: 'retention-7d' as const,
  RETENTION_WINBACK: 'retention-winback' as const,
} as const;

// ============================================================================
// EMAIL SENDING MESSAGE TYPE
// ============================================================================

export const EMAIL_SENDING_MESSAGE_TYPES = ['SEND_EMAIL', 'TRIGGER_CAMPAIGN'] as const;

export const DEFAULT_EMAIL_SENDING_MESSAGE_TYPE: EmailSendingMessageType = 'SEND_EMAIL';

export const EmailSendingMessageTypeSchema = z.enum(EMAIL_SENDING_MESSAGE_TYPES).openapi({
  description: 'Email sending queue message type',
  example: 'SEND_EMAIL',
});

export type EmailSendingMessageType = z.infer<typeof EmailSendingMessageTypeSchema>;

export const EmailSendingMessageTypes = {
  SEND_EMAIL: 'SEND_EMAIL' as const,
  TRIGGER_CAMPAIGN: 'TRIGGER_CAMPAIGN' as const,
} as const;
