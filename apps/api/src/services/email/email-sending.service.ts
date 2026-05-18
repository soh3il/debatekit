/**
 * Email Sending Service
 *
 * Manages the email send pipeline: creates send_log entries,
 * enqueues to EMAIL_SENDING_QUEUE, and updates delivery status.
 */

import type { EmailCategory, EmailSendStatus, EmailTemplateId } from '@debatekit/shared/enums';
import { EmailSendingMessageTypes, EmailSendStatuses } from '@debatekit/shared/enums';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';

import type { AppDb } from '@/db';
import { emailSendLog } from '@/db/tables';
import { log } from '@/lib/logger';

import type { TemplateVars } from './email-template-registry';

// ============================================================================
// TYPES
// ============================================================================

type EnqueueEmailParams = {
  category: EmailCategory;
  recipientEmail: string;
  subject: string;
  templateId: EmailTemplateId;
  templateVars?: TemplateVars;
  userId?: string;
};

export type EnqueueEmailEnv = {
  EMAIL_SENDING_QUEUE: Queue;
};

// ============================================================================
// ENQUEUE
// ============================================================================

/**
 * Create a send_log entry with status 'queued' and enqueue to EMAIL_SENDING_QUEUE.
 *
 * @returns The send log ID for correlation
 */
export async function enqueueEmail(
  db: AppDb,
  env: EnqueueEmailEnv,
  params: EnqueueEmailParams,
): Promise<string> {
  const sendLogId = ulid();
  const now = new Date();

  // Create the send_log entry
  await db.insert(emailSendLog).values({
    category: params.category,
    createdAt: now,
    id: sendLogId,
    metadata: params.templateVars ?? null,
    recipientEmail: params.recipientEmail,
    status: EmailSendStatuses.QUEUED,
    subject: params.subject,
    templateId: params.templateId,
    updatedAt: now,
    userId: params.userId ?? null,
  });

  // Enqueue the message for async processing
  await env.EMAIL_SENDING_QUEUE.send({
    sendLogId,
    type: EmailSendingMessageTypes.SEND_EMAIL,
  });

  log.info('Email enqueued', {
    category: params.category,
    recipientEmail: params.recipientEmail,
    sendLogId,
    templateId: params.templateId,
  });

  return sendLogId;
}

// ============================================================================
// STATUS UPDATES
// ============================================================================

/**
 * Update send_log status after send attempt.
 */
export async function updateSendLogStatus(
  db: AppDb,
  sendLogId: string,
  status: EmailSendStatus,
  sesMessageId?: string,
  errorMessage?: string,
) {
  const now = new Date();

  await db
    .update(emailSendLog)
    .set({
      ...(errorMessage && { errorMessage }),
      ...(sesMessageId && { sesMessageId }),
      status,
      updatedAt: now,
    })
    .where(eq(emailSendLog.id, sendLogId));
}
