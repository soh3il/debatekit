/**
 * Email Sending Queue Consumer
 *
 * Processes email sending and campaign trigger messages.
 * Uses dynamic imports for lazy loading to prevent
 * "Script startup exceeded CPU limits" deployment errors.
 *
 * Message types:
 * - SEND_EMAIL: Render template -> check suppression -> call SES -> update send_log -> PostHog
 * - TRIGGER_CAMPAIGN: Query eligible users -> check preferences/suppression -> enqueue individual emails
 *
 * @see https://developers.cloudflare.com/queues/
 * @see src/types/queues.ts for message schemas
 */

import type { Message, MessageBatch } from '@cloudflare/workers-types';
import { EmailSendingMessageTypes } from '@debatekit/shared/enums';

import { log } from '@/lib/logger';
import { calculateExponentialBackoff } from '@/lib/utils/queue-utils';
import type {
  EmailSendingQueueMessage,
  SendEmailQueueMessage,
  TriggerCampaignQueueMessage,
} from '@/types/queues';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Max retry delay in seconds (cap for exponential backoff) */
const MAX_RETRY_DELAY_SECONDS = 300;

/** Base retry delay in seconds */
const BASE_RETRY_DELAY_SECONDS = 60;

/** Default max recipients for campaign triggers */
const DEFAULT_MAX_RECIPIENTS = 1000;

// ============================================================================
// MESSAGE PROCESSORS
// ============================================================================

/**
 * Send an individual email
 *
 * 1. Check suppression list for recipient
 * 2. Check user preferences (if userId provided)
 * 3. Render template with templateVars
 * 4. Call SES to send
 * 5. Update send_log with SES message ID
 * 6. Capture PostHog email_sent event
 */
async function handleSendEmail(
  message: SendEmailQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const {
    category,
    recipientEmail,
    sendLogId,
    subject,
    templateId,
    templateVars,
    userId,
  } = message;

  // Lazy-load DB and services
  const { getDbAsync } = await import('@/db');
  const { and, eq } = await import('drizzle-orm');
  const tables = await import('@/db/tables');
  const { emailService, initializeEmailService } = await import('@/lib/email/ses-service');
  const { emailTracking } = await import('@/lib/analytics/posthog-email');

  const db = await getDbAsync();

  // 1. Check suppression list
  const suppression = await db
    .select()
    .from(tables.emailSuppression)
    .where(eq(tables.emailSuppression.email, recipientEmail.toLowerCase()))
    .get();

  if (suppression) {
    // Check if suppression has expired (soft bounces have optional expiry)
    const isExpired = suppression.expiresAt && suppression.expiresAt < new Date();

    if (!isExpired) {
      // Email is suppressed — update send_log and return
      await db
        .update(tables.emailSendLog)
        .set({
          errorMessage: `Suppressed: ${suppression.reason}`,
          status: 'failed',
        })
        .where(eq(tables.emailSendLog.id, sendLogId));

      log.info(`[EmailSendingQueue] Email to ${recipientEmail} suppressed (${suppression.reason}), sendLog=${sendLogId}`);
      return;
    }
  }

  // 2. Check user preferences (if userId provided)
  if (userId) {
    const preference = await db
      .select()
      .from(tables.emailPreference)
      .where(
        and(
          eq(tables.emailPreference.userId, userId),
          eq(tables.emailPreference.category, category),
        ),
      )
      .get();

    // If user has explicitly unsubscribed from this category or globally
    if (preference && (!preference.subscribed || preference.globalUnsubscribe)) {
      await db
        .update(tables.emailSendLog)
        .set({
          errorMessage: preference.globalUnsubscribe
            ? 'User globally unsubscribed'
            : `User unsubscribed from ${category}`,
          status: 'failed',
        })
        .where(eq(tables.emailSendLog.id, sendLogId));

      log.info(`[EmailSendingQueue] User ${userId} unsubscribed from ${category}, sendLog=${sendLogId}`);
      return;
    }
  }

  // 3. Render template (ensure marketing templates are registered before first render)
  const { registerMarketingTemplates } = await import('@/services/email/register-marketing-templates');
  registerMarketingTemplates();
  const { getTemplateRenderer } = await import('@/services/email/email-template-registry');
  const renderer = getTemplateRenderer(templateId);
  const rendered = renderer({ ...templateVars, sendLogId });
  const html = rendered.html;

  // 4. Initialize SES and send
  initializeEmailService(env);

  const { getAppBaseUrl } = await import('@/lib/config/base-urls');
  const appBaseUrl = getAppBaseUrl();
  const listUnsubscribeUrl = `${appBaseUrl}/unsubscribe?email=${encodeURIComponent(recipientEmail)}&category=${encodeURIComponent(category)}`;

  const sesMessageId = await emailService.sendMarketingEmail({
    category,
    html,
    listUnsubscribeUrl,
    subject,
    to: recipientEmail,
  });

  await db
    .update(tables.emailSendLog)
    .set({
      sesMessageId,
      status: 'sent',
    })
    .where(eq(tables.emailSendLog.id, sendLogId));

  log.info(`[EmailSendingQueue] Email sent to ${recipientEmail}, ses=${sesMessageId}, sendLog=${sendLogId}`);

  // 6. Capture PostHog event
  if (userId) {
    await emailTracking.emailSent({
      category,
      recipientEmail,
      templateId,
      userId,
    });
  }
}

/**
 * Trigger a campaign by querying eligible users and enqueuing individual emails
 *
 * 1. Load campaign configuration by campaignType
 * 2. Query eligible user cohort from DB
 * 3. For each eligible user, enqueue a SEND_EMAIL message
 */
async function handleTriggerCampaign(
  message: TriggerCampaignQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const {
    campaignType,
    cohortQuery,
    maxRecipients,
  } = message;

  const limit = maxRecipients ?? DEFAULT_MAX_RECIPIENTS;

  // Lazy-load DB and services
  const { getDbAsync } = await import('@/db');
  const { and, gt, inArray, isNull, or } = await import('drizzle-orm');
  const tables = await import('@/db/tables');
  const { ulid } = await import('ulid');

  const db = await getDbAsync();

  // Query eligible users based on campaignType
  const { getCampaignCohort, getCampaignConfig } = await import('@/services/email/email-campaign.service');
  const config = getCampaignConfig(campaignType);

  if (!config) {
    log.warn(`[EmailSendingQueue] Unknown campaign type: ${campaignType}, skipping`);
    return;
  }

  const eligibleUsers = await getCampaignCohort(db, campaignType, cohortQuery, limit);

  if (eligibleUsers.length === 0) {
    log.info(`[EmailSendingQueue] No eligible users for campaign ${campaignType}`);
    return;
  }

  // Filter out suppressed emails
  const recipientEmails = eligibleUsers.map(u => u.email.toLowerCase());
  const suppressions = await db
    .select()
    .from(tables.emailSuppression)
    .where(
      and(
        inArray(tables.emailSuppression.email, recipientEmails),
        or(
          isNull(tables.emailSuppression.expiresAt),
          gt(tables.emailSuppression.expiresAt, new Date()),
        ),
      ),
    )
    .all();

  const suppressedSet = new Set(suppressions.map(s => s.email.toLowerCase()));
  const unsuppressedUsers = eligibleUsers.filter(u => !suppressedSet.has(u.email.toLowerCase()));

  log.info(
    `[EmailSendingQueue] Campaign ${campaignType}: ${unsuppressedUsers.length} recipients (${suppressedSet.size} suppressed)`,
  );

  // Enqueue individual SEND_EMAIL messages
  const queue = env.EMAIL_SENDING_QUEUE;

  for (const user of unsuppressedUsers) {
    const sendLogId = ulid();
    const now = new Date();

    // Create send_log record
    await db
      .insert(tables.emailSendLog)
      .values({
        category: config.category,
        createdAt: now,
        id: sendLogId,
        recipientEmail: user.email,
        status: 'queued',
        subject: config.subject,
        templateId: config.templateId,
        updatedAt: now,
        userId: user.id,
      });

    // Enqueue the individual email
    await queue.send({
      category: config.category,
      messageId: ulid(),
      queuedAt: now.toISOString(),
      recipientEmail: user.email,
      sendLogId,
      subject: config.subject,
      templateId: config.templateId,
      templateVars: {
        userName: user.name ?? '',
        ...config.defaultVars,
      },
      type: EmailSendingMessageTypes.SEND_EMAIL,
      userId: user.id,
    });
  }

  log.info(`[EmailSendingQueue] Campaign ${campaignType}: enqueued ${unsuppressedUsers.length} emails`);
}

// ============================================================================
// QUEUE CONSUMER HANDLER
// ============================================================================

/**
 * Process a single queue message with error handling and retry logic
 *
 * IMPORTANT: Uses dynamic imports for Zod schemas to avoid loading
 * heavy schema files at worker startup.
 */
async function processQueueMessage(
  msg: Message<EmailSendingQueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  try {
    const { body } = msg;
    const messageType = body.type;

    // Lazy-load schemas to avoid startup CPU limit
    const {
      SendEmailQueueMessageSchema,
      TriggerCampaignQueueMessageSchema,
    } = await import('@/types/queues');

    // Validate and narrow types using Zod schemas
    if (messageType === EmailSendingMessageTypes.SEND_EMAIL) {
      const parsed = SendEmailQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await handleSendEmail(parsed.data, env);
      } else {
        throw new Error(`Invalid SEND_EMAIL message: ${parsed.error.message}`);
      }
    } else if (messageType === EmailSendingMessageTypes.TRIGGER_CAMPAIGN) {
      const parsed = TriggerCampaignQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await handleTriggerCampaign(parsed.data, env);
      } else {
        throw new Error(`Invalid TRIGGER_CAMPAIGN message: ${parsed.error.message}`);
      }
    } else {
      throw new Error(`Unhandled message type: ${messageType}`);
    }

    msg.ack();
  } catch (error) {
    const messageType = msg.body.type;
    const identifier = 'sendLogId' in msg.body
      ? msg.body.sendLogId
      : ('campaignType' in msg.body ? msg.body.campaignType : 'unknown');

    log.queue('error', `Failed ${messageType} for ${identifier}`, {
      error: error instanceof Error ? error.message : String(error),
      identifier,
      messageType,
    });

    // Exponential backoff using shared utility
    const retryDelaySeconds = calculateExponentialBackoff(
      msg.attempts,
      BASE_RETRY_DELAY_SECONDS,
      MAX_RETRY_DELAY_SECONDS,
    );

    msg.retry({ delaySeconds: retryDelaySeconds });
  }
}

/**
 * Queue Consumer Handler
 *
 * Processes batches of email sending messages.
 * Called by Cloudflare when messages are available in the queue.
 */
export async function handleEmailSendingQueue(
  batch: MessageBatch<EmailSendingQueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  for (const msg of batch.messages) {
    await processQueueMessage(msg, env);
  }
}
