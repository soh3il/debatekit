/**
 * PostHog Email Marketing Tracking
 *
 * Email event capture for marketing automation.
 * Uses $set/$set_once for person properties.
 */

import * as z from 'zod';

import { log } from '@/lib/logger';

import { getPostHogClient } from './posthog-server';

const EMAIL_EVENT_TYPE_VALUES = [
  'email_sent',
  'email_delivered',
  'email_opened',
  'email_clicked',
  'email_bounced',
  'email_complained',
  'email_unsubscribed',
  'email_resubscribed',
] as const;
const _EmailEventTypeSchema = z.enum(EMAIL_EVENT_TYPE_VALUES);
type EmailEventType = z.infer<typeof _EmailEventTypeSchema>;

const PostHogPersonPropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

const PostHogPersonPropertiesSchema = z.record(z.string(), PostHogPersonPropertyValueSchema);

const _EmailEventPropertiesSchema = z.object({
  $set: PostHogPersonPropertiesSchema.optional(),
  $set_once: PostHogPersonPropertiesSchema.optional(),
  bounce_type: z.string().optional(),
  clicked_url: z.string().optional(),
  email_category: z.string().optional(),
  recipient_email: z.string().optional(),
  template_id: z.string().optional(),
});

type EmailEventProperties = z.infer<typeof _EmailEventPropertiesSchema>;

/** @internal */
async function captureEmailEvent(
  eventType: EmailEventType,
  properties: EmailEventProperties,
  userId: string,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  posthog.capture({
    distinctId: userId,
    event: eventType,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
    },
  });

  await posthog.flush();

  log.debug(`[PostHog Email] Captured and flushed ${eventType} for ${userId}`);
}

export const emailTracking = {
  emailBounced: async (props: {
    userId?: string;
    recipientEmail: string;
    bounceType: string;
  }) => {
    await captureEmailEvent('email_bounced', {
      $set: {
        email_bounced: true,
      },
      bounce_type: props.bounceType,
      recipient_email: props.recipientEmail,
    }, props.userId ?? 'anonymous');
  },

  emailClicked: async (props: {
    userId?: string;
    templateId: string;
    category: string;
    clickedUrl: string;
  }) => {
    await captureEmailEvent('email_clicked', {
      $set: {
        last_email_clicked_at: new Date().toISOString(),
      },
      clicked_url: props.clickedUrl,
      email_category: props.category,
      template_id: props.templateId,
    }, props.userId ?? 'anonymous');
  },

  emailComplained: async (props: {
    userId?: string;
    recipientEmail: string;
  }) => {
    await captureEmailEvent('email_complained', {
      $set: {
        email_complained: true,
      },
      recipient_email: props.recipientEmail,
    }, props.userId ?? 'anonymous');
  },

  emailDelivered: async (props: {
    userId?: string;
    templateId: string;
    category: string;
  }) => {
    await captureEmailEvent('email_delivered', {
      email_category: props.category,
      template_id: props.templateId,
    }, props.userId ?? 'anonymous');
  },

  emailOpened: async (props: {
    userId?: string;
    templateId: string;
    category: string;
  }) => {
    await captureEmailEvent('email_opened', {
      $set: {
        last_email_opened_at: new Date().toISOString(),
      },
      email_category: props.category,
      template_id: props.templateId,
    }, props.userId ?? 'anonymous');
  },

  emailResubscribed: async (props: {
    userId: string;
    category: string;
  }) => {
    await captureEmailEvent('email_resubscribed', {
      $set: {
        email_unsubscribed: false,
      },
      email_category: props.category,
    }, props.userId);
  },

  emailSent: async (props: {
    userId: string;
    templateId: string;
    category: string;
    recipientEmail: string;
  }) => {
    await captureEmailEvent('email_sent', {
      $set: {
        last_email_sent_at: new Date().toISOString(),
      },
      $set_once: {
        first_email_sent_at: new Date().toISOString(),
      },
      email_category: props.category,
      recipient_email: props.recipientEmail,
      template_id: props.templateId,
    }, props.userId);
  },

  emailUnsubscribed: async (props: {
    userId: string;
    category: string;
  }) => {
    await captureEmailEvent('email_unsubscribed', {
      $set: {
        email_unsubscribed: true,
        last_email_unsubscribed_at: new Date().toISOString(),
      },
      email_category: props.category,
    }, props.userId);
  },
};
