/**
 * Credit Service
 *
 * Balance tracking, deductions, grants, transaction ledger.
 * Optimistic locking prevents concurrent update conflicts.
 */

import { MAX_OPTIMISTIC_LOCK_RETRIES } from '@debatekit/db/services';
import { CREDIT_CONFIG } from '@debatekit/shared';
import type { CreditAction, CreditGrantType, CreditTransactionType } from '@debatekit/shared/enums';
import {
  CreditActions,
  CreditActionSchema,
  CreditTransactionTypes,
  CreditTransactionTypeSchema,
  DatabaseOperations,
  ErrorContextTypes,
  getGrantTransactionType,
  MessageRoles,
  parsePlanType,
  PlanTypes,
  PlanTypeSchema,
  StripeSubscriptionStatuses,
  SubscriptionTiers,
} from '@debatekit/shared/enums';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import * as z from 'zod';

import { invalidateCreditBalanceCache } from '@/common/cache-utils';
import { createError } from '@/common/error-handling';
import type { ModelForPricing } from '@/common/schemas/model-pricing';
import type { ErrorContext } from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import { CreditCacheTags } from '@/db/cache/cache-tags';
import { DbTextPartSchema } from '@/db/schemas/chat-metadata';
import type { UserCreditBalance } from '@/db/validation';
import { creditTracking } from '@/lib/analytics';
import { log } from '@/lib/logger';
import { getModelById } from '@/services/models';

import {
  calculateWeightedCredits,
  getActionCreditCost,
  getModelPricingTierById,
  getPlanConfig,
} from './product-logic.service';

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Convert getModelById result to ModelForPricing type
 * HardcodedModel has all required fields but needs type adaptation
 * Single source of truth - use this instead of inline converters in handlers
 */
export function toModelForPricing(modelId: string): ModelForPricing | undefined {
  const model = getModelById(modelId);
  if (!model) {
    return undefined;
  }

  return {
    capabilities: model.capabilities,
    context_length: model.context_length,
    created: model.created ?? null,
    id: modelId,
    name: model.name,
    pricing: model.pricing,
    pricing_display: model.pricing_display ?? null,
    provider: model.provider,
  };
}

// ============================================================================
// OPTIMISTIC LOCKING CONFIGURATION
// ============================================================================

/**
 * Wraps a database operation with optimistic lock retry logic.
 * Prevents infinite recursion and provides proper error handling.
 *
 * @param operation - Async function that performs the DB update and returns result array
 * @param onRetry - Function to call on retry (for re-fetching fresh version)
 * @param context - Error context for logging
 * @param context.operation - Operation name for error messages
 * @param context.userId - User ID for error context
 * @param retryCount - Current retry count (internal)
 */
async function withOptimisticLockRetry<T>(
  operation: () => Promise<T[]>,
  onRetry: () => Promise<void>,
  context: { operation: string; userId: string },
  retryCount = 0,
): Promise<T> {
  if (retryCount >= MAX_OPTIMISTIC_LOCK_RETRIES) {
    const errorContext: ErrorContext = {
      errorType: ErrorContextTypes.DATABASE,
      operation: DatabaseOperations.UPDATE,
      table: 'user_credit_balance',
      userId: context.userId,
    };
    throw createError.conflict(
      `Credit operation failed after ${MAX_OPTIMISTIC_LOCK_RETRIES} retries due to concurrent updates. Please try again.`,
      errorContext,
    );
  }

  try {
    const result = await operation();

    if (result.length === 0) {
      // Optimistic lock failure - version mismatch, retry with fresh data
      await onRetry();
      return withOptimisticLockRetry(operation, onRetry, context, retryCount + 1);
    }

    const firstResult = result[0];
    if (firstResult === undefined) {
      throw createError.internal('Optimistic lock update returned no result', {
        errorType: ErrorContextTypes.DATABASE,
        operation: DatabaseOperations.UPDATE,
        table: 'user_credit_balance',
        userId: context.userId,
      });
    }
    return firstResult;
  } catch (error) {
    // Sanitize database errors - don't expose raw SQL to clients
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if this is a D1/Drizzle error (contains "Failed query" or SQL)
    if (
      errorMessage.includes('Failed query')
      || errorMessage.includes('UPDATE')
      || errorMessage.includes('INSERT')
      || errorMessage.includes('SELECT')
    ) {
      log.billing('error', `Database error in ${context.operation}`, {
        error: errorMessage,
        retryCount,
        userId: context.userId,
      });

      const errorContext: ErrorContext = {
        errorType: ErrorContextTypes.DATABASE,
        operation: DatabaseOperations.UPDATE,
        table: 'user_credit_balance',
        userId: context.userId,
      };
      throw createError.database(
        `Credit operation failed. Please try again later.`,
        errorContext,
      );
    }

    // Re-throw non-database errors as-is
    throw error;
  }
}

const _CreditBalanceInfoSchema = z.object({
  available: z.number(),
  balance: z.number(),
  monthlyCredits: z.number(),
  nextRefillAt: z.date().nullable(),
  planType: PlanTypeSchema,
}).strict();

export type CreditBalanceInfo = z.infer<typeof _CreditBalanceInfoSchema>;

const _TokenUsageSchema = z.object({
  action: CreditActionSchema,
  inputTokens: z.number(),
  messageId: z.string().optional(),
  modelId: z.string(),
  outputTokens: z.number(),
  threadId: z.string().optional(),
}).strict();

export type TokenUsage = z.infer<typeof _TokenUsageSchema>;

const _EnforceCreditsOptionsSchema = z.object({
  skipRoundCheck: z.boolean().optional(),
}).strict();

export type EnforceCreditsOptions = z.infer<typeof _EnforceCreditsOptionsSchema>;

export async function ensureUserCreditRecord(userId: string): Promise<UserCreditBalance> {
  const db = await getDbAsync();

  // NO CACHE: Credit balances must always be fresh to prevent optimistic lock failures
  const existingResults = await db
    .select()
    .from(tables.userCreditBalance)
    .where(eq(tables.userCreditBalance.userId, userId))
    .limit(1);

  if (existingResults[0]) {
    return existingResults[0];
  }

  const now = new Date();
  const signupCredits = CREDIT_CONFIG.SIGNUP_CREDITS;
  let wasInserted = false;

  try {
    const insertResult = await db
      .insert(tables.userCreditBalance)
      .values({
        balance: signupCredits,
        createdAt: now,
        id: ulid(),
        monthlyCredits: 0,
        planType: PlanTypes.FREE,
        updatedAt: now,
        userId,
      })
      .onConflictDoNothing({ target: tables.userCreditBalance.userId })
      .returning();

    wasInserted = insertResult.length > 0;

    if (wasInserted) {
      await invalidateCreditBalanceCache(db, userId);
    }
  } catch {
    // Insert failed (likely race condition) - will fetch existing record below
  }
  const finalResults = await db
    .select()
    .from(tables.userCreditBalance)
    .where(eq(tables.userCreditBalance.userId, userId))
    .limit(1);

  const record = finalResults[0];

  if (!record) {
    const context: ErrorContext = {
      errorType: ErrorContextTypes.DATABASE,
      operation: DatabaseOperations.INSERT,
      table: 'user_credit_balance',
      userId,
    };
    throw createError.internal('Failed to create credit record', context);
  }

  if (wasInserted && signupCredits > 0) {
    try {
      await recordTransaction({
        action: CreditActions.SIGNUP_BONUS,
        amount: signupCredits,
        balanceAfter: signupCredits,
        description: 'Signup bonus credits - one free round',
        type: CreditTransactionTypes.CREDIT_GRANT,
        userId,
      });
    } catch {
      // Transaction recording failed - non-critical
    }
  }

  return record;
}

export async function getUserCreditBalance(userId: string): Promise<CreditBalanceInfo> {
  const record = await ensureUserCreditRecord(userId);

  return {
    available: record.balance,
    balance: record.balance,
    monthlyCredits: record.monthlyCredits,
    nextRefillAt: record.nextRefillAt,
    planType: parsePlanType(record.planType),
  };
}

export async function canAffordCredits(userId: string, requiredCredits: number): Promise<boolean> {
  const balance = await getUserCreditBalance(userId);
  return balance.available >= requiredCredits;
}

export async function enforceCredits(
  userId: string,
  requiredCredits: number,
  options?: EnforceCreditsOptions,
): Promise<void> {
  let balance = await getUserCreditBalance(userId);

  // FREE users: unlimited usage on their first thread until round 0 completes
  if (balance.planType === PlanTypes.FREE) {
    const hasCompletedRound = await checkFreeUserHasCompletedRound(userId);
    if (!hasCompletedRound) {
      // First thread, round 0 not complete - allow unlimited resumptions
      return;
    }
    // Round 0 completed - block unless skipRoundCheck (for final operations like moderator)
    if (!options?.skipRoundCheck) {
      const context: ErrorContext = {
        errorType: ErrorContextTypes.RESOURCE,
        resource: 'credits',
        userId,
      };
      throw createError.badRequest(
        'Your free conversation round has been used. Subscribe to Pro to continue chatting.',
        context,
      );
    }
  }

  if (balance.available < requiredCredits) {
    const hasActiveSubscription = await checkHasActiveSubscription(userId);

    if (hasActiveSubscription && balance.planType !== PlanTypes.PAID) {
      await provisionPaidUserCredits(userId);
      balance = await getUserCreditBalance(userId);

      if (balance.available >= requiredCredits) {
        return;
      }
    }

    // Track credits_depleted + credits_insufficient_error for analytics
    // Fire-and-forget - don't block the error response on analytics
    creditTracking.depleted({
      current_balance: balance.available,
      plan_type: balance.planType,
      threshold: requiredCredits,
    }, { userId }).catch(() => {
      // Ignore tracking errors - non-critical
    });

    creditTracking.creditsInsufficientError({
      current_balance: balance.available,
      plan_type: balance.planType,
      required_credits: requiredCredits,
      subscription_tier: balance.planType,
    }, { userId }).catch(() => {
      // Ignore tracking errors - non-critical
    });

    const context: ErrorContext = {
      errorType: ErrorContextTypes.RESOURCE,
      resource: 'credits',
      userId,
    };

    throw createError.badRequest(
      `Insufficient credits. Required: ${requiredCredits}, Available: ${balance.available}. `
      + `${balance.planType === PlanTypes.FREE ? 'Subscribe to Pro or ' : ''}Purchase additional credits to continue.`,
      context,
    );
  }
}
async function checkHasActiveSubscription(userId: string): Promise<boolean> {
  const db = await getDbAsync();

  // NO CACHE: Subscription status must always be fresh
  const results = await db
    .select()
    .from(tables.stripeCustomer)
    .innerJoin(
      tables.stripeSubscription,
      and(
        eq(tables.stripeSubscription.customerId, tables.stripeCustomer.id),
        eq(tables.stripeSubscription.status, StripeSubscriptionStatuses.ACTIVE),
      ),
    )
    .where(eq(tables.stripeCustomer.userId, userId))
    .limit(1);

  return results.length > 0;
}

export async function checkFreeUserHasCreatedThread(userId: string): Promise<boolean> {
  const db = await getDbAsync();

  // Check BOTH live threads AND transaction history.
  // Transaction history is the authoritative source — survives thread deletion.
  // This prevents abuse: delete thread → recreate → get another free round.
  const [existingThread, threadCreationTx] = await Promise.all([
    db
      .select()
      .from(tables.chatThread)
      .where(eq(tables.chatThread.userId, userId))
      .limit(1),
    db
      .select()
      .from(tables.creditTransaction)
      .where(
        and(
          eq(tables.creditTransaction.userId, userId),
          eq(tables.creditTransaction.action, CreditActions.THREAD_CREATION),
        ),
      )
      .limit(1),
  ]);

  return existingThread.length > 0 || threadCreationTx.length > 0;
}

export async function isFreeUserWithPendingRound(
  userId: string,
  userTier: string,
): Promise<boolean> {
  if (userTier !== SubscriptionTiers.FREE) {
    return false;
  }
  const hasCompletedRound = await checkFreeUserHasCompletedRound(userId);
  return !hasCompletedRound;
}

export async function checkFreeUserHasCompletedRound(userId: string): Promise<boolean> {
  const db = await getDbAsync();

  // ✅ PERF: Check if already recorded - CACHED because once true, always true
  // Cache tag allows invalidation if ever needed (e.g., admin reset)
  const hasTransactionResults = await db
    .select()
    .from(tables.creditTransaction)
    .where(
      and(
        eq(tables.creditTransaction.userId, userId),
        eq(tables.creditTransaction.action, CreditActions.FREE_ROUND_COMPLETE),
      ),
    )
    .limit(1)
    .$withCache({
      config: { ex: 3600 }, // 1 hour - this is a permanent flag
      tag: CreditCacheTags.freeRoundComplete(userId),
    });

  if (hasTransactionResults.length > 0) {
    return true;
  }

  // Get thread (free users can only have one) - also cached
  const threadResults = await db
    .select()
    .from(tables.chatThread)
    .where(eq(tables.chatThread.userId, userId))
    .limit(1)
    .$withCache({
      config: { ex: 60 },
      tag: CreditCacheTags.userThread(userId),
    });

  const thread = threadResults[0];
  if (!thread) {
    return false;
  }

  // Get enabled participants and ALL assistant messages for the thread
  // Check any round for completeness (not just round 0) to handle
  // incomplete rounds where the stream died mid-round and user retried
  const [participantResults, allAssistantMessages] = await Promise.all([
    db
      .select()
      .from(tables.chatParticipant)
      .where(
        and(
          eq(tables.chatParticipant.threadId, thread.id),
          eq(tables.chatParticipant.isEnabled, true),
        ),
      ),
    db
      .select()
      .from(tables.chatMessage)
      .where(
        and(
          eq(tables.chatMessage.threadId, thread.id),
          eq(tables.chatMessage.role, 'assistant'),
        ),
      ),
  ]);

  const enabledCount = participantResults.length;
  if (enabledCount === 0) {
    return false;
  }

  // Group messages by round number
  const messagesByRound = new Map<number, typeof allAssistantMessages>();
  for (const msg of allAssistantMessages) {
    const round = msg.roundNumber;
    if (!messagesByRound.has(round)) {
      messagesByRound.set(round, []);
    }
    const roundMsgs = messagesByRound.get(round);
    if (roundMsgs) {
      roundMsgs.push(msg);
    }
  }

  // Check if ANY round is fully complete (all participants + moderator)
  for (const [roundNumber, roundMessages] of messagesByRound) {
    const respondedIds = new Set(
      roundMessages
        .map(m => m.participantId)
        .filter((id): id is string => id !== null),
    );

    if (respondedIds.size < enabledCount) {
      continue;
    }

    // Only check moderator for multi-participant threads
    if (enabledCount >= 2) {
      // Moderator messages have participantId=null, role=assistant for the given round.
      // Cannot use a hardcoded ID format — message IDs are ULIDs.
      const moderatorMessage = await db.query.chatMessage.findFirst({
        columns: { parts: true },
        where: and(
          eq(tables.chatMessage.threadId, thread.id),
          eq(tables.chatMessage.roundNumber, roundNumber),
          eq(tables.chatMessage.role, MessageRoles.ASSISTANT),
          isNull(tables.chatMessage.participantId),
        ),
      });

      if (!moderatorMessage) {
        continue;
      }

      const hasModeContent = Array.isArray(moderatorMessage.parts)
        && moderatorMessage.parts.length > 0
        && moderatorMessage.parts.some((part) => {
          const parseResult = DbTextPartSchema.safeParse(part);
          return parseResult.success && parseResult.data.text.trim().length > 0;
        });

      if (!hasModeContent) {
        continue;
      }
    }

    // This round is complete
    return true;
  }

  return false;
}

export async function zeroOutFreeUserCredits(userId: string): Promise<void> {
  const db = await getDbAsync();

  const record = await ensureUserCreditRecord(userId);

  if (record.planType !== PlanTypes.FREE) {
    return;
  }

  const previousBalance = record.balance;

  await db
    .update(tables.userCreditBalance)
    .set({
      balance: 0,
      updatedAt: new Date(),
    })
    .where(eq(tables.userCreditBalance.userId, userId));

  if (previousBalance > 0) {
    // recordTransaction() now includes cache invalidation
    await recordTransaction({
      action: CreditActions.FREE_ROUND_COMPLETE,
      amount: -previousBalance,
      balanceAfter: 0,
      description: 'Free round completed - credits exhausted',
      type: CreditTransactionTypes.DEDUCTION,
      userId,
    });
  } else {
    // Balance was already 0, but still invalidate cache for consistency
    await invalidateCreditBalanceCache(db, userId);
  }
}

async function provisionPaidUserCredits(userId: string): Promise<void> {
  const db = await getDbAsync();
  const planConfig = getPlanConfig();
  const now = new Date();
  const nextRefill = new Date(now);
  nextRefill.setMonth(nextRefill.getMonth() + 1);

  await db
    .update(tables.userCreditBalance)
    .set({
      balance: planConfig.monthlyCredits,
      lastRefillAt: now,
      monthlyCredits: planConfig.monthlyCredits,
      nextRefillAt: nextRefill,
      planType: PlanTypes.PAID,
      updatedAt: now,
    })
    .where(eq(tables.userCreditBalance.userId, userId));

  await recordTransaction({
    action: CreditActions.MONTHLY_RENEWAL,
    amount: planConfig.monthlyCredits,
    balanceAfter: planConfig.monthlyCredits,
    description: 'Credits provisioned (subscription sync recovery)',
    type: CreditTransactionTypes.MONTHLY_REFILL,
    userId,
  });
}

export async function finalizeCredits(
  userId: string,
  streamId: string,
  actualUsage: TokenUsage,
): Promise<void> {
  const db = await getDbAsync();

  // Mutable ref to track current record for retries
  let currentRecord = await ensureUserCreditRecord(userId);

  // Calculate weighted credits based on model pricing tier
  const weightedCredits = calculateWeightedCredits(
    actualUsage.inputTokens,
    actualUsage.outputTokens,
    actualUsage.modelId,
    toModelForPricing,
  );

  // Skip DB operation only if truly 0 credits (valid scenario for 0 token usage)
  if (weightedCredits === 0) {
    return;
  }

  // Get pricing tier and model info for transaction logging
  const pricingTier = getModelPricingTierById(actualUsage.modelId, toModelForPricing);
  const totalTokens = actualUsage.inputTokens + actualUsage.outputTokens;
  const model = toModelForPricing(actualUsage.modelId);
  const inputPricingMicro = model ? Math.round(Number.parseFloat(model.pricing.prompt) * 1_000_000 * 1_000_000) : undefined;
  const outputPricingMicro = model ? Math.round(Number.parseFloat(model.pricing.completion) * 1_000_000 * 1_000_000) : undefined;

  const updatedRecord = await withOptimisticLockRetry(
    () =>
      db
        .update(tables.userCreditBalance)
        .set({
          balance: sql`${tables.userCreditBalance.balance} - ${weightedCredits}`,
          updatedAt: new Date(),
          version: sql`${tables.userCreditBalance.version} + 1`,
        })
        .where(
          and(
            eq(tables.userCreditBalance.userId, userId),
            eq(tables.userCreditBalance.version, currentRecord.version),
          ),
        )
        .returning(),
    async () => {
      // Re-fetch fresh record on retry
      currentRecord = await ensureUserCreditRecord(userId);
    },
    { operation: 'finalizeCredits', userId },
  );

  await recordTransaction({
    action: actualUsage.action,
    amount: -weightedCredits,
    balanceAfter: updatedRecord.balance,
    creditsUsed: weightedCredits,
    description: `AI response (${pricingTier}): ${totalTokens} tokens = ${weightedCredits} credits`,
    inputTokens: actualUsage.inputTokens,
    messageId: actualUsage.messageId,
    modelId: actualUsage.modelId,
    modelPricingInputPerMillion: inputPricingMicro,
    modelPricingOutputPerMillion: outputPricingMicro,
    outputTokens: actualUsage.outputTokens,
    streamId,
    threadId: actualUsage.threadId,
    totalTokens,
    type: CreditTransactionTypes.DEDUCTION,
    userId,
  });

  // Track low balance warning when credits drop below 20% of monthly allocation
  // Only for paid users with meaningful monthly credits
  const LOW_BALANCE_THRESHOLD_PERCENT = 0.2;
  if (
    updatedRecord.planType === PlanTypes.PAID
    && updatedRecord.monthlyCredits > 0
    && updatedRecord.balance > 0
    && updatedRecord.balance <= updatedRecord.monthlyCredits * LOW_BALANCE_THRESHOLD_PERCENT
  ) {
    const threshold = Math.floor(updatedRecord.monthlyCredits * LOW_BALANCE_THRESHOLD_PERCENT);
    creditTracking.balanceLow({
      current_balance: updatedRecord.balance,
      plan_type: updatedRecord.planType,
      threshold,
    }, { userId }).catch(() => {
      // Ignore tracking errors - non-critical
    });
  }
}

export async function grantCredits(
  userId: string,
  amount: number,
  type: CreditGrantType,
  description?: string,
): Promise<void> {
  const db = await getDbAsync();

  // Mutable ref to track current record for retries
  let currentRecord = await ensureUserCreditRecord(userId);

  const updatedRecord = await withOptimisticLockRetry(
    () =>
      db
        .update(tables.userCreditBalance)
        .set({
          balance: sql`${tables.userCreditBalance.balance} + ${amount}`,
          updatedAt: new Date(),
          version: sql`${tables.userCreditBalance.version} + 1`,
        })
        .where(
          and(
            eq(tables.userCreditBalance.userId, userId),
            eq(tables.userCreditBalance.version, currentRecord.version),
          ),
        )
        .returning(),
    async () => {
      // Re-fetch fresh record on retry
      currentRecord = await ensureUserCreditRecord(userId);
    },
    { operation: 'grantCredits', userId },
  );

  const actionMap: Record<CreditGrantType, CreditAction> = {
    credit_grant: CreditActions.SIGNUP_BONUS,
    monthly_refill: CreditActions.MONTHLY_RENEWAL,
    purchase: CreditActions.CREDIT_PURCHASE,
  };

  await recordTransaction({
    action: actionMap[type],
    amount,
    balanceAfter: updatedRecord.balance,
    description: description || `Granted ${amount} credits`,
    type: getGrantTransactionType(type),
    userId,
  });
}

const ACTION_COST_TO_CREDIT_ACTION_MAP: Record<keyof typeof CREDIT_CONFIG.ACTION_COSTS, CreditAction> = {
  analysisGeneration: CreditActions.ANALYSIS_GENERATION,
  autoModeAnalysis: CreditActions.ANALYSIS_GENERATION,
  customRoleCreation: CreditActions.THREAD_CREATION,
  fileReading: CreditActions.FILE_READING,
  // Project feature billing
  memoryExtraction: CreditActions.MEMORY_EXTRACTION,
  podcastGeneration: CreditActions.PODCAST_GENERATION,
  projectFileLink: CreditActions.PROJECT_FILE_LINK,
  projectStoragePer10MB: CreditActions.PROJECT_STORAGE,
  ragQuery: CreditActions.RAG_QUERY,
  threadCreation: CreditActions.THREAD_CREATION,
  webSearchQuery: CreditActions.WEB_SEARCH,
} as const;

export async function deductCreditsForAction(
  userId: string,
  action: keyof typeof CREDIT_CONFIG.ACTION_COSTS,
  context?: { threadId?: string; description?: string },
): Promise<void> {
  const credits = getActionCreditCost(action);

  await enforceCredits(userId, credits);

  const db = await getDbAsync();

  // Mutable ref to track current record for retries
  let currentRecord = await ensureUserCreditRecord(userId);

  const updatedRecord = await withOptimisticLockRetry(
    () =>
      db
        .update(tables.userCreditBalance)
        .set({
          balance: sql`${tables.userCreditBalance.balance} - ${credits}`,
          updatedAt: new Date(),
          version: sql`${tables.userCreditBalance.version} + 1`,
        })
        .where(
          and(
            eq(tables.userCreditBalance.userId, userId),
            eq(tables.userCreditBalance.version, currentRecord.version),
          ),
        )
        .returning(),
    async () => {
      // Re-fetch fresh record on retry
      currentRecord = await ensureUserCreditRecord(userId);
    },
    { operation: 'deductCreditsForAction', userId },
  );

  await recordTransaction({
    action: ACTION_COST_TO_CREDIT_ACTION_MAP[action],
    amount: -credits,
    balanceAfter: updatedRecord.balance,
    creditsUsed: credits,
    description: context?.description || `${String(action)}: ${credits} credits`,
    threadId: context?.threadId,
    type: CreditTransactionTypes.DEDUCTION,
    userId,
  });
}

export async function processMonthlyRefill(userId: string): Promise<void> {
  const db = await getDbAsync();

  // Mutable ref to track current record for retries
  let currentRecord = await ensureUserCreditRecord(userId);

  if (currentRecord.planType !== PlanTypes.PAID) {
    return;
  }

  const now = new Date();
  if (currentRecord.nextRefillAt && currentRecord.nextRefillAt > now) {
    return;
  }

  const planConfig = getPlanConfig();
  const nextRefill = new Date(now);
  nextRefill.setMonth(nextRefill.getMonth() + 1);

  const updatedRecord = await withOptimisticLockRetry(
    () =>
      db
        .update(tables.userCreditBalance)
        .set({
          balance: sql`${tables.userCreditBalance.balance} + ${planConfig.monthlyCredits}`,
          lastRefillAt: now,
          nextRefillAt: nextRefill,
          updatedAt: now,
          version: sql`${tables.userCreditBalance.version} + 1`,
        })
        .where(
          and(
            eq(tables.userCreditBalance.userId, userId),
            eq(tables.userCreditBalance.version, currentRecord.version),
          ),
        )
        .returning(),
    async () => {
      // Re-fetch fresh record on retry
      currentRecord = await ensureUserCreditRecord(userId);
    },
    { operation: 'processMonthlyRefill', userId },
  );

  await recordTransaction({
    action: CreditActions.MONTHLY_RENEWAL,
    amount: planConfig.monthlyCredits,
    balanceAfter: updatedRecord.balance,
    description: `Monthly refill: ${planConfig.monthlyCredits} credits`,
    type: CreditTransactionTypes.MONTHLY_REFILL,
    userId,
  });

  // Track credits_refilled for analytics
  // Fire-and-forget - don't block on analytics
  creditTracking.creditsRefilled({
    credits_refilled: planConfig.monthlyCredits,
    current_balance: updatedRecord.balance,
    plan_type: PlanTypes.PAID,
  }, { userId }).catch(() => {
    // Ignore tracking errors - non-critical
  });
}

export async function upgradeToPaidPlan(userId: string): Promise<void> {
  const db = await getDbAsync();

  // Mutable ref to track current record for retries
  let currentRecord = await ensureUserCreditRecord(userId);

  if (currentRecord.planType === PlanTypes.PAID) {
    return;
  }

  const planConfig = getPlanConfig();
  const now = new Date();
  const nextRefill = new Date(now);
  nextRefill.setMonth(nextRefill.getMonth() + 1);

  const updatedRecord = await withOptimisticLockRetry(
    () =>
      db
        .update(tables.userCreditBalance)
        .set({
          balance: planConfig.monthlyCredits,
          lastRefillAt: now,
          monthlyCredits: planConfig.monthlyCredits,
          nextRefillAt: nextRefill,
          planType: PlanTypes.PAID,
          updatedAt: now,
          version: sql`${tables.userCreditBalance.version} + 1`,
        })
        .where(
          and(
            eq(tables.userCreditBalance.userId, userId),
            eq(tables.userCreditBalance.version, currentRecord.version),
          ),
        )
        .returning(),
    async () => {
      // Re-fetch fresh record on retry
      currentRecord = await ensureUserCreditRecord(userId);
    },
    { operation: 'upgradeToPaidPlan', userId },
  );

  await recordTransaction({
    action: CreditActions.MONTHLY_RENEWAL,
    amount: planConfig.monthlyCredits,
    balanceAfter: updatedRecord.balance,
    description: `Upgraded to Pro plan: ${planConfig.monthlyCredits} credits`,
    type: CreditTransactionTypes.CREDIT_GRANT,
    userId,
  });

  // CRITICAL: Invalidate cached credit balance so subsequent requests see the new planType
  // Without this, thread creation checks may still see planType=FREE from stale cache
  await invalidateCreditBalanceCache(db, userId);
}

const _RecordTransactionSchema = z.object({
  action: CreditActionSchema.optional(),
  amount: z.number(),
  balanceAfter: z.number(),
  creditsUsed: z.number().optional(),
  description: z.string().optional(),
  inputTokens: z.number().optional(),
  messageId: z.string().optional(),
  modelId: z.string().optional(),
  modelPricingInputPerMillion: z.number().optional(),
  modelPricingOutputPerMillion: z.number().optional(),
  outputTokens: z.number().optional(),
  streamId: z.string().optional(),
  threadId: z.string().optional(),
  totalTokens: z.number().optional(),
  type: CreditTransactionTypeSchema,
  userId: z.string(),
}).strict();

export type RecordTransactionParams = z.infer<typeof _RecordTransactionSchema>;

async function recordTransaction(record: RecordTransactionParams): Promise<void> {
  const db = await getDbAsync();

  await db.insert(tables.creditTransaction).values({
    action: record.action,
    amount: record.amount,
    balanceAfter: record.balanceAfter,
    createdAt: new Date(),
    creditsUsed: record.creditsUsed,
    description: record.description,
    id: ulid(),
    inputTokens: record.inputTokens,
    messageId: record.messageId,
    modelId: record.modelId,
    modelPricingInputPerMillion: record.modelPricingInputPerMillion,
    modelPricingOutputPerMillion: record.modelPricingOutputPerMillion,
    outputTokens: record.outputTokens,
    streamId: record.streamId,
    threadId: record.threadId,
    totalTokens: record.totalTokens,
    type: record.type,
    userId: record.userId,
  });

  // Invalidate credit balance cache after every credit mutation
  // Prevents stale balance reads that could cause double-spending
  await invalidateCreditBalanceCache(db, record.userId);
}

export type CreditTransactionSelect = typeof tables.creditTransaction.$inferSelect;

export async function getUserTransactionHistory(
  userId: string,
  options: { limit?: number; offset?: number; type?: CreditTransactionType } = {},
): Promise<{ transactions: CreditTransactionSelect[]; total: number }> {
  const db = await getDbAsync();
  const { limit = 50, offset = 0, type } = options;

  const whereClause = type
    ? and(
        eq(tables.creditTransaction.userId, userId),
        eq(tables.creditTransaction.type, type),
      )
    : eq(tables.creditTransaction.userId, userId);

  // Parallelize transactions fetch and count
  const [transactions, countResult] = await Promise.all([
    db
      .select()
      .from(tables.creditTransaction)
      .where(whereClause)
      .orderBy(desc(tables.creditTransaction.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select()
      .from(tables.creditTransaction)
      .where(whereClause),
  ]);

  return {
    total: countResult.length,
    transactions,
  };
}
