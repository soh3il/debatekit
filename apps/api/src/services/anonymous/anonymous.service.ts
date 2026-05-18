/**
 * Anonymous User Service
 *
 * Handles merging anonymous user data into authenticated accounts.
 * Called from Better Auth's onLinkAccount hook when anonymous users sign up.
 */

import { and, eq, sql } from 'drizzle-orm';

import { executeBatch } from '@/common/batch-operations';
import { invalidateAllUserCaches } from '@/common/cache-utils';
import { createError } from '@/common/error-handling';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import { log } from '@/lib/logger';

/**
 * Merge anonymous user data into an authenticated user account.
 * Transfers all FK-linked data, merges credit balance, then deletes anonymous records.
 *
 * Note: Better Auth's anonymous plugin auto-deletes the anonymous user AFTER
 * onLinkAccount runs, so we only need to transfer data, not delete the user.
 * However, we still delete credit balance records to prevent conflicts.
 */
export async function mergeAnonymousToAuthenticated(anonymousUserId: string, authenticatedUserId: string) {
  if (anonymousUserId === authenticatedUserId) {
    throw createError.validation('Cannot merge user into themselves');
  }

  const db = await getDbAsync();

  const anonUser = await db
    .select()
    .from(tables.user)
    .where(and(eq(tables.user.id, anonymousUserId), eq(tables.user.isAnonymous, true)))
    .get();

  if (!anonUser) {
    // Already deleted by a previous merge or Better Auth cleanup — idempotent no-op
    log.info('[ANONYMOUS] Merge skipped — anonymous user already deleted', { anonymousUserId, authenticatedUserId });
    return { merged: false, threadsTransferred: 0 };
  }

  const anonymousThreads = await db
    .select()
    .from(tables.chatThread)
    .where(eq(tables.chatThread.userId, anonymousUserId))
    .all();
  const threadsTransferred = anonymousThreads.length;

  // Transfer FK-linked data atomically
  await executeBatch(db, [
    db.update(tables.chatThread)
      .set({ userId: authenticatedUserId })
      .where(eq(tables.chatThread.userId, anonymousUserId)),
    db.update(tables.creditTransaction)
      .set({ userId: authenticatedUserId })
      .where(eq(tables.creditTransaction.userId, anonymousUserId)),
    db.update(tables.upload)
      .set({ userId: authenticatedUserId })
      .where(eq(tables.upload.userId, anonymousUserId)),
    db.update(tables.chatCustomRole)
      .set({ userId: authenticatedUserId })
      .where(eq(tables.chatCustomRole.userId, anonymousUserId)),
    db.update(tables.chatUserPreset)
      .set({ userId: authenticatedUserId })
      .where(eq(tables.chatUserPreset.userId, anonymousUserId)),
    db.update(tables.roundExecution)
      .set({ userId: authenticatedUserId })
      .where(eq(tables.roundExecution.userId, anonymousUserId)),
    db.update(tables.chatProject)
      .set({ userId: authenticatedUserId })
      .where(eq(tables.chatProject.userId, anonymousUserId)),
  ]);

  // Merge credit balances and explicitly delete anonymous balance record
  // (don't rely on Better Auth's post-hook CASCADE timing to avoid double-count)
  await executeBatch(db, [
    db.update(tables.userCreditBalance)
      .set({
        balance: sql`${tables.userCreditBalance.balance} + COALESCE((SELECT balance FROM user_credit_balance WHERE user_id = ${anonymousUserId}), 0)`,
      })
      .where(eq(tables.userCreditBalance.userId, authenticatedUserId)),
    db.delete(tables.userCreditBalance)
      .where(eq(tables.userCreditBalance.userId, anonymousUserId)),
  ]);

  await invalidateAllUserCaches(db, authenticatedUserId);

  log.info('[ANONYMOUS] Merged anonymous to authenticated', {
    anonymousUserId,
    authenticatedUserId,
    threadsTransferred,
  });

  return {
    merged: true,
    threadsTransferred,
  };
}
