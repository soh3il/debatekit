/**
 * Email Tracking Service
 *
 * Tracks email engagement events (opens, clicks, bounces, complaints, deliveries).
 * Updates send_log and optionally captures PostHog analytics events.
 */

import { EmailSendStatuses } from '@debatekit/shared/enums';
import { eq } from 'drizzle-orm';
import type { PostHog } from 'posthog-node';

import type { AppDb } from '@/db';
import { emailSendLog } from '@/db/tables';
import { log } from '@/lib/logger';

// ============================================================================
// ENGAGEMENT TRACKING
// ============================================================================

/**
 * Track email open: update send_log opened_at + capture PostHog event.
 */
export async function trackEmailOpen(
  db: AppDb,
  sendLogId: string,
  posthogClient?: PostHog | null,
) {
  const now = new Date();

  await db
    .update(emailSendLog)
    .set({ openedAt: now, updatedAt: now })
    .where(eq(emailSendLog.id, sendLogId));

  if (posthogClient) {
    const rows = await db
      .select()
      .from(emailSendLog)
      .where(eq(emailSendLog.id, sendLogId))
      .limit(1);

    const row = rows[0];
    if (row?.userId) {
      posthogClient.capture({
        distinctId: row.userId,
        event: 'email_opened',
        properties: {
          category: row.category,
          sendLogId,
          templateId: row.templateId,
        },
      });
    }
  }

  log.info('Email open tracked', { sendLogId });
}

/**
 * Track email click: update send_log clicked_at + capture PostHog event.
 */
export async function trackEmailClick(
  db: AppDb,
  sendLogId: string,
  posthogClient?: PostHog | null,
) {
  const now = new Date();

  await db
    .update(emailSendLog)
    .set({ clickedAt: now, updatedAt: now })
    .where(eq(emailSendLog.id, sendLogId));

  if (posthogClient) {
    const rows = await db
      .select()
      .from(emailSendLog)
      .where(eq(emailSendLog.id, sendLogId))
      .limit(1);

    const row = rows[0];
    if (row?.userId) {
      posthogClient.capture({
        distinctId: row.userId,
        event: 'email_clicked',
        properties: {
          category: row.category,
          sendLogId,
          templateId: row.templateId,
        },
      });
    }
  }

  log.info('Email click tracked', { sendLogId });
}

/**
 * Track email bounce via SES message ID.
 */
export async function trackEmailBounce(
  db: AppDb,
  sesMessageId: string,
  bounceType: string,
  posthogClient?: PostHog | null,
) {
  const now = new Date();

  const rows = await db
    .select()
    .from(emailSendLog)
    .where(eq(emailSendLog.sesMessageId, sesMessageId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    log.warn('Bounce received for unknown SES message ID', { bounceType, sesMessageId });
    return;
  }

  await db
    .update(emailSendLog)
    .set({
      bouncedAt: now,
      status: EmailSendStatuses.BOUNCED,
      updatedAt: now,
    })
    .where(eq(emailSendLog.id, row.id));

  if (posthogClient && row.userId) {
    posthogClient.capture({
      distinctId: row.userId,
      event: 'email_bounced',
      properties: {
        bounceType,
        category: row.category,
        sendLogId: row.id,
        templateId: row.templateId,
      },
    });
  }

  log.info('Email bounce tracked', { bounceType, sendLogId: row.id, sesMessageId });
}

/**
 * Track email complaint via SES message ID.
 */
export async function trackEmailComplaint(
  db: AppDb,
  sesMessageId: string,
  posthogClient?: PostHog | null,
) {
  const now = new Date();

  const rows = await db
    .select()
    .from(emailSendLog)
    .where(eq(emailSendLog.sesMessageId, sesMessageId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    log.warn('Complaint received for unknown SES message ID', { sesMessageId });
    return;
  }

  await db
    .update(emailSendLog)
    .set({
      complainedAt: now,
      status: EmailSendStatuses.COMPLAINED,
      updatedAt: now,
    })
    .where(eq(emailSendLog.id, row.id));

  if (posthogClient && row.userId) {
    posthogClient.capture({
      distinctId: row.userId,
      event: 'email_complained',
      properties: {
        category: row.category,
        sendLogId: row.id,
        templateId: row.templateId,
      },
    });
  }

  log.info('Email complaint tracked', { sendLogId: row.id, sesMessageId });
}

/**
 * Track email delivery via SES message ID.
 */
export async function trackEmailDelivery(
  db: AppDb,
  sesMessageId: string,
  posthogClient?: PostHog | null,
) {
  const now = new Date();

  const rows = await db
    .select()
    .from(emailSendLog)
    .where(eq(emailSendLog.sesMessageId, sesMessageId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    log.warn('Delivery received for unknown SES message ID', { sesMessageId });
    return;
  }

  await db
    .update(emailSendLog)
    .set({
      status: EmailSendStatuses.DELIVERED,
      updatedAt: now,
    })
    .where(eq(emailSendLog.id, row.id));

  if (posthogClient && row.userId) {
    posthogClient.capture({
      distinctId: row.userId,
      event: 'email_delivered',
      properties: {
        category: row.category,
        sendLogId: row.id,
        templateId: row.templateId,
      },
    });
  }
}
