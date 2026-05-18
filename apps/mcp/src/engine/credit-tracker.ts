/**
 * Credit Tracker for MCP Debate Rounds
 *
 * Thin wrapper over @debatekit/db shared credit service.
 * Keeps MCP-specific logic (estimation, retry loop) while delegating
 * core DB operations to the shared Drizzle-based credit service.
 */

import { createDb } from '@debatekit/db/factory';
import {
  checkFreeRoundUsed as _checkFreeRoundUsed,
  deductWithOptimisticLock,
  enforceCredits as _enforceCredits,
  getUserBalance as _getUserBalance,
  getUserPlanType as _getUserPlanType,
  markFreeRoundComplete as _markFreeRoundComplete,
  MAX_OPTIMISTIC_LOCK_RETRIES,
  recordCreditTransaction,
} from '@debatekit/db/services';
import { calculateCreditsForModelId } from '@debatekit/shared';
import { CreditActions, CreditTransactionTypes, McpThinkingLevelSchema } from '@debatekit/shared/enums';
import { z } from 'zod';

import type { Env } from '../types';

// ============================================================================
// Schemas & Types
// ============================================================================

const ModelUsageEntrySchema = z.object({
  creditMultiplier: z.number(),
  creditsUsed: z.number(),
  inputTokens: z.number(),
  modelId: z.string(),
  outputTokens: z.number(),
});
export type ModelUsageEntry = z.infer<typeof ModelUsageEntrySchema>;

const _DebateCreditMetadataSchema = z.object({
  durationMs: z.number(),
  modelUsage: z.array(ModelUsageEntrySchema),
  participantCount: z.number(),
  thinkingLevel: McpThinkingLevelSchema,
  totalCredits: z.number(),
  totalTokens: z.number(),
});
export type DebateCreditMetadata = z.infer<typeof _DebateCreditMetadataSchema>;

// ============================================================================
// Balance Lookup
// ============================================================================

export async function getUserBalance(env: Env, userId: string) {
  return _getUserBalance(createDb(env.DB), userId);
}

// ============================================================================
// Plan Type Lookup
// ============================================================================

export async function getUserPlanType(env: Env, userId: string) {
  return _getUserPlanType(createDb(env.DB), userId);
}

// ============================================================================
// Pre-flight Credit Estimation (pure calculation, no DB)
// ============================================================================

export function estimateDebateCredits(
  modelIds: string[],
  moderatorModelId: string,
  maxOutputTokensPerParticipant: number,
  moderatorMaxTokens: number,
  historicalAvgCredits?: number,
) {
  const rawEstimate = computeRawEstimate(modelIds, moderatorModelId, maxOutputTokensPerParticipant, moderatorMaxTokens);

  // If we have historical data, use weighted average (70% historical, 30% estimate)
  if (historicalAvgCredits && historicalAvgCredits > 0) {
    return Math.ceil(historicalAvgCredits * 0.7 + rawEstimate * 0.3);
  }

  return rawEstimate;
}

function computeRawEstimate(
  modelIds: string[],
  moderatorModelId: string,
  maxOutputTokensPerParticipant: number,
  moderatorMaxTokens: number,
) {
  const estimatedInputPerParticipant = 500;
  let totalCredits = 0;

  for (const modelId of modelIds) {
    const tokens = estimatedInputPerParticipant + maxOutputTokensPerParticipant;
    totalCredits += calculateCreditsForModelId(tokens, modelId);
  }

  const moderatorTokens = 1000 + moderatorMaxTokens;
  totalCredits += calculateCreditsForModelId(moderatorTokens, moderatorModelId);

  return totalCredits;
}

// ============================================================================
// Free Round Enforcement
// ============================================================================

export async function checkFreeRoundUsed(env: Env, userId: string) {
  return _checkFreeRoundUsed(createDb(env.DB), userId);
}

export async function markFreeRoundComplete(env: Env, userId: string) {
  return _markFreeRoundComplete(createDb(env.DB), userId);
}

// ============================================================================
// Credit Enforcement
// ============================================================================

export async function enforceCredits(env: Env, userId: string, estimatedCredits: number) {
  return _enforceCredits(createDb(env.DB), userId, estimatedCredits);
}

// ============================================================================
// Credit Deduction (with optimistic locking + retry)
// ============================================================================

/**
 * Deduct credits from a user's balance with optimistic locking.
 *
 * The balance UPDATE is always awaited (atomic). Transaction ledger recording
 * is fire-and-forget via `ctx.waitUntil()` so the response is not blocked but
 * the Worker stays alive until the INSERTs complete.
 */
export async function deductCredits(
  env: Env,
  ctx: ExecutionContext,
  userId: string,
  actualCredits: number,
  metadata: DebateCreditMetadata,
) {
  if (actualCredits <= 0) {
    return;
  }

  const db = createDb(env.DB);

  for (let attempt = 0; attempt < MAX_OPTIMISTIC_LOCK_RETRIES; attempt++) {
    const balance = await _getUserBalance(db, userId);
    if (!balance) {
      return;
    }

    // Never let balance go below 0
    const deduction = Math.min(actualCredits, balance.balance);
    if (deduction <= 0) {
      return;
    }

    const succeeded = await deductWithOptimisticLock(db, userId, deduction, balance.version);

    if (succeeded) {
      // Invalidate credit cache so main API sees updated balance
      env.KV.delete(`credit:balance:${userId}`).catch(e => console.error('KV cache invalidation failed:', e));

      // Fire-and-forget: ledger recording runs in background via waitUntil.
      ctx.waitUntil(
        recordTransactions(env, userId, balance.balance - deduction, metadata)
          .catch((err) => {
            console.error(`[credit-transaction] Background recording failed for user ${userId}:`, err);
          }),
      );

      return;
    }

    // Version mismatch -- retry after brief backoff
    if (attempt < MAX_OPTIMISTIC_LOCK_RETRIES - 1) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50 * (attempt + 1));
      });
    }
  }
}

// ============================================================================
// Transaction Recording (per-model breakdown)
// ============================================================================

async function recordTransactions(
  env: Env,
  userId: string,
  balanceAfter: number,
  metadata: DebateCreditMetadata,
) {
  const db = createDb(env.DB);

  for (const entry of metadata.modelUsage) {
    const totalTokens = entry.inputTokens + entry.outputTokens;
    const description = `MCP ${metadata.thinkingLevel} debate: ${entry.modelId} (${totalTokens} tokens x ${entry.creditMultiplier}x = ${entry.creditsUsed} credits)`;

    try {
      await recordCreditTransaction(db, {
        action: CreditActions.MCP_DEBATE,
        amount: -entry.creditsUsed,
        balanceAfter,
        creditsUsed: entry.creditsUsed,
        description,
        inputTokens: entry.inputTokens,
        modelId: entry.modelId,
        outputTokens: entry.outputTokens,
        totalTokens,
        type: CreditTransactionTypes.DEDUCTION,
        userId,
      });
    } catch (err) {
      // Log transaction recording failure. Credits were already deducted
      // from the balance but this ledger entry is missing.
      console.error(`[credit-transaction] Failed to record transaction for user ${userId}, model ${entry.modelId}, ${entry.creditsUsed} credits:`, err);
    }
  }
}
