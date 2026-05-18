/**
 * Credit Service
 *
 * Drizzle ORM replacement for raw D1 SQL in apps/mcp/src/engine/credit-tracker.ts.
 * Core credit operations shared by both API and MCP: balance lookup, enforcement,
 * optimistic-lock deduction, and transaction recording.
 */

import type { PlanType } from '@debatekit/shared/enums';
import { CreditActions, CreditActionSchema, CreditTransactionTypes, CreditTransactionTypeSchema, PlanTypes } from '@debatekit/shared/enums';
import { and, eq, sql } from 'drizzle-orm';
import * as z from 'zod';

import type { DbInstance } from '../factory';
import { creditTransaction, userCreditBalance } from '../tables/credits';

// ============================================================================
// Schemas & Types
// ============================================================================

export type CreditBalanceRow = typeof userCreditBalance.$inferSelect;

const _RecordCreditTransactionParamsSchema = z.object({
  action: CreditActionSchema.optional(),
  amount: z.number(),
  balanceAfter: z.number(),
  creditsUsed: z.number().optional(),
  description: z.string().optional(),
  inputTokens: z.number().optional(),
  modelId: z.string().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  type: CreditTransactionTypeSchema,
  userId: z.string(),
});

export type RecordCreditTransactionParams = z.infer<typeof _RecordCreditTransactionParamsSchema>;

// ============================================================================
// Optimistic Lock Configuration
// ============================================================================

/**
 * Maximum retry attempts for optimistic-lock credit deductions.
 * Shared by API (`withOptimisticLockRetry`) and MCP (`deductCredits`).
 */
export const MAX_OPTIMISTIC_LOCK_RETRIES = 5;

// ============================================================================
// getUserBalance
// ============================================================================

/**
 * Fetch a user's credit balance row.
 * Returns null when no record exists for the given userId.
 */
export async function getUserBalance(
  db: DbInstance,
  userId: string,
): Promise<CreditBalanceRow | null> {
  const rows = await db
    .select()
    .from(userCreditBalance)
    .where(eq(userCreditBalance.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

// ============================================================================
// getUserPlanType
// ============================================================================

/**
 * Get the user's plan type, defaulting to 'free' when no balance record exists.
 */
export async function getUserPlanType(
  db: DbInstance,
  userId: string,
): Promise<PlanType> {
  const balance = await getUserBalance(db, userId);

  if (!balance) {
    return PlanTypes.FREE;
  }

  return balance.planType;
}

// ============================================================================
// enforceCredits
// ============================================================================

/**
 * Pre-flight credit check. Throws if the user has insufficient credits.
 * Error message includes a plan-specific upgrade hint.
 */
export async function enforceCredits(
  db: DbInstance,
  userId: string,
  estimatedCredits: number,
): Promise<void> {
  const balance = await getUserBalance(db, userId);

  if (!balance) {
    throw new Error('No credit record found. Please ensure your account is set up.');
  }

  if (balance.balance < estimatedCredits) {
    const upgradeHint = balance.planType === PlanTypes.FREE
      ? 'Subscribe to Pro or purchase additional credits to continue.'
      : 'Purchase additional credits to continue.';
    throw new Error(
      `Insufficient credits. Required: ~${estimatedCredits}, Available: ${balance.balance}. ${upgradeHint}`,
    );
  }
}

// ============================================================================
// Free Round Enforcement (MCP + Web cross-channel)
// ============================================================================

/**
 * Check if a free user has already used their one free debate round.
 * Looks for a FREE_ROUND_COMPLETE transaction in the ledger.
 */
export async function checkFreeRoundUsed(
  db: DbInstance,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: creditTransaction.id })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.action, CreditActions.FREE_ROUND_COMPLETE),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Mark a free user's round as complete: record FREE_ROUND_COMPLETE transaction
 * and zero out any remaining credit balance. Idempotent — no-ops if already marked.
 */
export async function markFreeRoundComplete(
  db: DbInstance,
  userId: string,
): Promise<void> {
  const balance = await getUserBalance(db, userId);
  if (!balance || balance.planType !== PlanTypes.FREE) {
    return;
  }

  // Idempotent: skip if already marked
  const alreadyMarked = await checkFreeRoundUsed(db, userId);
  if (alreadyMarked) {
    return;
  }

  const previousBalance = balance.balance;

  // Zero out remaining credits
  if (previousBalance > 0) {
    await db
      .update(userCreditBalance)
      .set({ balance: 0, updatedAt: new Date() })
      .where(eq(userCreditBalance.userId, userId));
  }

  // Record FREE_ROUND_COMPLETE transaction (permanent flag — always recorded
  // even if balance was already 0 from deductions, so cross-channel checks find it)
  await recordCreditTransaction(db, {
    action: CreditActions.FREE_ROUND_COMPLETE,
    amount: previousBalance > 0 ? -previousBalance : 0,
    balanceAfter: 0,
    description: 'Free debate round completed - credits exhausted',
    type: CreditTransactionTypes.DEDUCTION,
    userId,
  });
}

// ============================================================================
// deductWithOptimisticLock
// ============================================================================

/**
 * Atomically deduct credits using optimistic locking on the version column.
 * Returns true if the update succeeded (version matched), false on conflict.
 *
 * Uses `.returning()` to determine success: if the WHERE clause matched
 * (userId AND version), the row is returned; otherwise the array is empty.
 */
export async function deductWithOptimisticLock(
  db: DbInstance,
  userId: string,
  amount: number,
  currentVersion: number,
): Promise<boolean> {
  const rows = await db
    .update(userCreditBalance)
    .set({
      balance: sql`${userCreditBalance.balance} - ${amount}`,
      updatedAt: new Date(),
      version: sql`${userCreditBalance.version} + 1`,
    })
    .where(
      and(
        eq(userCreditBalance.userId, userId),
        eq(userCreditBalance.version, currentVersion),
      ),
    )
    .returning({ id: userCreditBalance.id });

  return rows.length > 0;
}

// ============================================================================
// recordCreditTransaction
// ============================================================================

/**
 * Insert a credit transaction ledger entry.
 */
export async function recordCreditTransaction(
  db: DbInstance,
  params: RecordCreditTransactionParams,
) {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(creditTransaction).values({
    action: params.action,
    amount: params.amount,
    balanceAfter: params.balanceAfter,
    createdAt: now,
    creditsUsed: params.creditsUsed,
    description: params.description,
    id,
    inputTokens: params.inputTokens,
    modelId: params.modelId,
    outputTokens: params.outputTokens,
    totalTokens: params.totalTokens,
    type: params.type,
    userId: params.userId,
  });

  return id;
}
