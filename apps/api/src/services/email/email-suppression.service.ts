/**
 * Email Suppression Service
 *
 * Manages the global email suppression list for bounces, complaints,
 * and manual blocks. Prevents sending to problematic addresses.
 */

import type { EmailSuppressionReason } from '@debatekit/shared/enums';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { ulid } from 'ulid';

import type { AppDb } from '@/db';
import { emailSuppression } from '@/db/tables';
import { log } from '@/lib/logger';

/**
 * Check if email is in suppression list (respects expiry).
 * Returns true if the email should NOT be sent to.
 */
export async function isEmailSuppressed(db: AppDb, email: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(emailSuppression)
    .where(eq(emailSuppression.email, email.toLowerCase()))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return false;
  }

  // If expiry is set and has passed, the suppression is no longer active
  if (row.expiresAt && row.expiresAt < new Date()) {
    return false;
  }

  return true;
}

/**
 * Add email to suppression list.
 *
 * @param db - Database instance
 * @param email - Email address to suppress
 * @param reason - Why the email was suppressed
 * @param source - Where the suppression came from (e.g. 'ses-webhook', 'manual', 'user-request')
 * @param expiresAt - Optional expiry for soft bounces
 */
export async function addToSuppressionList(
  db: AppDb,
  email: string,
  reason: EmailSuppressionReason,
  source: string,
  expiresAt?: Date,
) {
  const now = new Date();
  const normalizedEmail = email.toLowerCase();

  await db
    .insert(emailSuppression)
    .values({
      createdAt: now,
      email: normalizedEmail,
      expiresAt: expiresAt ?? null,
      id: ulid(),
      reason,
      source,
      suppressedAt: now,
    })
    .onConflictDoNothing();

  log.info('Added email to suppression list', {
    email: normalizedEmail,
    expiresAt: expiresAt?.toISOString() ?? null,
    reason,
    source,
  });
}

/**
 * Remove email from suppression list.
 */
export async function removeFromSuppressionList(db: AppDb, email: string) {
  const normalizedEmail = email.toLowerCase();

  await db
    .delete(emailSuppression)
    .where(eq(emailSuppression.email, normalizedEmail));

  log.info('Removed email from suppression list', { email: normalizedEmail });
}

/**
 * Remove expired soft bounce entries from suppression list.
 * Should be run periodically via cron.
 */
export async function cleanExpiredSuppressions(db: AppDb) {
  const now = new Date();

  const result = await db
    .delete(emailSuppression)
    .where(
      and(
        lt(emailSuppression.expiresAt, now),
        // Only delete rows that actually have an expiry (soft bounces)
        // Hard bounces and complaints have no expiry and should never be auto-cleaned
        isNotNull(emailSuppression.expiresAt),
      ),
    )
    .returning();

  if (result.length > 0) {
    log.info('Cleaned expired suppressions', { count: result.length });
  }
}
