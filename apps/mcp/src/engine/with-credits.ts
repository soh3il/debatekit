/**
 * Credit-Wrapped Debate Execution
 *
 * Wraps debate execution with credit enforcement:
 * 1. Estimate credits needed (per-model)
 * 2. Enforce user has sufficient balance
 * 3. Run the debate
 * 4. Build per-model usage entries and deduct actual credits
 */

import { calculateCreditsForModelId, getMultiplierForModelId } from '@debatekit/shared';
import { McpThinkingLevelSchema, PlanTypes } from '@debatekit/shared/enums';
import { z } from 'zod';

import {
  trackMcpCreditsDepleted,
  trackMcpCreditsInsufficient,
  trackMcpDebateCompleted,
  trackMcpEvaluationCompleted,
  trackMcpFreeRoundUsed,
  trackMcpToolInvoked,
} from '../lib/posthog';
import { RunDebateOutputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';
import { checkAbuse, recordActivity } from './abuse-detector';
import type { DebateCreditMetadata, ModelUsageEntry } from './credit-tracker';
import { checkFreeRoundUsed, deductCredits, enforceCredits, estimateDebateCredits, getUserBalance, getUserPlanType, markFreeRoundComplete } from './credit-tracker';
import type { DebateResult } from './debate-engine';
import { runEvaluation } from './evaluator';
import { logEventFireAndForget } from './logger';
import { THINKING_PRESETS } from './presets';
import { getAvgTokensByThinkingLevel, linkSessionToThread, saveSession } from './session-store';
import { createThreadFromDebate } from './thread-creator';
import { generateTitle } from './title-generator';
import { checkUsageLimits, incrementUsage } from './usage-limiter';

const _WithCreditsParamsSchema = z.object({
  apiKeyHash: z.string().optional(),
  context: z.string().optional(),
  ctx: z.custom<ExecutionContext>(),
  inputJson: z.string().optional(),
  integrationSource: z.string().optional(),
  ip: z.string().optional(),
  modelIds: z.array(z.string()),
  moderatorModelId: z.string(),
  participantCount: z.number(),
  prompt: z.string().optional(),
  thinkingLevel: McpThinkingLevelSchema,
  toolName: z.string().optional(),
});
type WithCreditsParams = z.infer<typeof _WithCreditsParamsSchema>;

const _WithCreditsResultSchema = z.object({
  result: RunDebateOutputSchema,
  sessionId: z.string().optional(),
  threadSlug: z.string().optional(),
});
type WithCreditsResult = z.infer<typeof _WithCreditsResultSchema>;

/**
 * Execute a debate with automatic credit enforcement and deduction.
 * All debate tools should use this instead of manually managing credits.
 */
export async function withCredits(
  env: Env,
  userId: string,
  params: WithCreditsParams,
  debateFn: () => Promise<DebateResult>,
): Promise<WithCreditsResult> {
  const preset = THINKING_PRESETS[params.thinkingLevel];

  // ── Usage limit enforcement ──────────────────────────────────────────
  const planType = await getUserPlanType(env, userId);

  const limitCheck = await checkUsageLimits(env, userId, planType);
  if (!limitCheck.allowed) {
    const retryMsg = limitCheck.retryAfterSeconds
      ? ` Try again in ${limitCheck.retryAfterSeconds} seconds.`
      : '';
    throw new Error(
      `MCP request limit reached (${limitCheck.status}). Tool calls are blocked until your rate limit window resets.${retryMsg} Free plan: 15/5h, 50/day, 200/week. Upgrade to Pro for 10x higher limits at https://debatekit.com/chat/pricing`,
    );
  }

  // ── Track tool invocation (fire-and-forget) ────────────────────────
  trackMcpToolInvoked(env, userId, {
    integration_source: params.integrationSource,
    model_count: params.modelIds.length,
    plan_type: planType,
    thinking_level: params.thinkingLevel,
    tool_name: params.toolName ?? 'unknown',
  });

  // ── Free round enforcement (one free debate for free users) ─────────
  if (planType === PlanTypes.FREE) {
    const roundUsed = await checkFreeRoundUsed(env, userId);
    if (roundUsed) {
      throw new Error(
        'Your free debate round has been used. MCP tool calls are now blocked on the free plan — this is a hard limit. Upgrade to Pro ($59/mo) for 500 daily requests, no cooldowns, and 2,000,000 monthly credits. Visit https://debatekit.com/chat/pricing to upgrade.',
      );
    }
  }

  // ── Abuse detection ──────────────────────────────────────────────────
  if (params.apiKeyHash) {
    const abuseCheck = await checkAbuse(env, userId, params.ip ?? '', {
      apiKeyHash: params.apiKeyHash,
      maxTokensForLevel: preset.participantMaxTokens,
      thinkingLevel: params.thinkingLevel,
    });
    if (abuseCheck.blocked) {
      throw new Error(abuseCheck.reason ?? 'Temporarily banned due to abuse detection. Try again later.');
    }
  }

  // ── Pre-flight credit check ──────────────────────────────────────────
  // Look up historical average for smarter estimation
  const historical = await getAvgTokensByThinkingLevel(env, userId, params.thinkingLevel).catch(() => null);

  const estimatedCredits = estimateDebateCredits(
    params.modelIds,
    params.moderatorModelId,
    preset.participantMaxTokens,
    preset.moderatorMaxTokens,
    historical?.avgCredits,
  );

  try {
    await enforceCredits(env, userId, estimatedCredits);
  } catch (err) {
    // Track credit failure events before re-throwing (fire-and-forget)
    const balance = await getUserBalance(env, userId).catch(() => null);
    const currentBalance = balance?.balance ?? 0;

    trackMcpCreditsInsufficient(env, userId, {
      current_balance: currentBalance,
      plan_type: planType,
      required_credits: estimatedCredits,
      subscription_tier: planType,
    });

    trackMcpCreditsDepleted(env, userId, {
      current_balance: currentBalance,
      plan_type: planType,
      threshold: estimatedCredits,
    });

    throw err;
  }

  // Execute debate
  const result = await debateFn();

  // Build per-model usage entries
  const modelUsage: ModelUsageEntry[] = [];

  for (const p of result.participants) {
    const multiplier = getMultiplierForModelId(p.model_id);
    const credits = calculateCreditsForModelId(p.token_usage.input + p.token_usage.output, p.model_id);
    modelUsage.push({
      creditMultiplier: multiplier,
      creditsUsed: credits,
      inputTokens: p.token_usage.input,
      modelId: p.model_id,
      outputTokens: p.token_usage.output,
    });
  }

  // Moderator
  const modMultiplier = getMultiplierForModelId(result.moderator.model_id);
  const modCredits = calculateCreditsForModelId(
    result.moderator.token_usage.input + result.moderator.token_usage.output,
    result.moderator.model_id,
  );
  modelUsage.push({
    creditMultiplier: modMultiplier,
    creditsUsed: modCredits,
    inputTokens: result.moderator.token_usage.input,
    modelId: result.moderator.model_id,
    outputTokens: result.moderator.token_usage.output,
  });

  const totalCredits = modelUsage.reduce((sum, e) => sum + e.creditsUsed, 0);
  const totalTokens = modelUsage.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0);

  const metadata: DebateCreditMetadata = {
    durationMs: result.metadata.duration_ms,
    modelUsage,
    participantCount: result.participants.length,
    thinkingLevel: params.thinkingLevel,
    totalCredits,
    totalTokens,
  };

  // Deduct credits (balance UPDATE is awaited, transaction recording is
  // fire-and-forget via ctx.waitUntil inside deductCredits).
  await deductCredits(env, params.ctx, userId, totalCredits, metadata);

  // ── Mark free round complete (zeroes remaining credits, records permanent flag) ─
  if (planType === PlanTypes.FREE) {
    await markFreeRoundComplete(env, userId);

    trackMcpFreeRoundUsed(env, userId, {
      model_count: result.participants.length,
      tool_name: params.toolName ?? 'unknown',
      total_credits: totalCredits,
    });
  }

  // ── PostHog credit tracking (fire-and-forget) ─────────────────────────
  trackMcpDebateCompleted(env, userId, {
    duration_ms: result.metadata.duration_ms,
    integration_source: params.integrationSource,
    model_count: result.participants.length,
    thinking_level: params.thinkingLevel,
    tool_name: params.toolName ?? 'unknown',
    total_credits: totalCredits,
  });

  // Check if balance is now low (<=20% of monthly) and track depleted
  const LOW_BALANCE_THRESHOLD_PERCENT = 0.2;
  const postBalance = await getUserBalance(env, userId).catch(() => null);
  if (
    postBalance
    && postBalance.monthlyCredits > 0
    && postBalance.balance > 0
    && postBalance.balance <= postBalance.monthlyCredits * LOW_BALANCE_THRESHOLD_PERCENT
  ) {
    trackMcpCreditsDepleted(env, userId, {
      current_balance: postBalance.balance,
      plan_type: postBalance.planType,
      threshold: Math.floor(postBalance.monthlyCredits * LOW_BALANCE_THRESHOLD_PERCENT),
    });
  }

  // ── Post-execution: increment usage + record activity (fire-and-forget) ─
  params.ctx.waitUntil(
    incrementUsage(env, userId).catch((err) => {
      console.error('[usage-limiter] Failed to increment usage:', err);
    }),
  );

  if (params.apiKeyHash) {
    params.ctx.waitUntil(
      recordActivity(env, userId, params.ip ?? '', {
        apiKeyHash: params.apiKeyHash,
        maxTokensForLevel: preset.participantMaxTokens,
        thinkingLevel: params.thinkingLevel,
        tokensUsed: totalTokens,
      }).catch((err) => {
        console.error('[abuse-detector] Failed to record activity:', err);
      }),
    );
  }

  // Log debate completion
  logEventFireAndForget(env, params.ctx, {
    data: {
      credits: String(totalCredits),
      duration_ms: String(result.metadata.duration_ms),
      model_count: String(result.participants.length),
      thinking_level: params.thinkingLevel,
    },
    event: 'debate_completed',
    level: 'info',
    userId,
  });

  // Persist session and create thread (both awaited for return value)
  let sessionId: string | undefined;
  let threadSlug: string | undefined;
  const toolName = params.toolName;
  const prompt = params.prompt;

  if (toolName && prompt) {
    try {
      sessionId = await saveSession(env, {
        durationMs: result.metadata.duration_ms,
        format: result.metadata.format,
        inputJson: params.inputJson ?? '{}',
        mode: result.metadata.mode,
        modelIds: params.modelIds,
        prompt,
        promptVersion: result.metadata.prompt_version ?? undefined,
        resultJson: JSON.stringify(result),
        thinkingLevel: params.thinkingLevel,
        toolName,
        totalCredits,
        userId,
      });

      // Generate AI title (non-blocking fallback to truncated prompt on failure)
      const title = await generateTitle(prompt, env);

      // Create thread from debate (awaited to get slug for response)
      const threadResult = await createThreadFromDebate({
        context: params.context,
        env,
        mode: result.metadata.mode,
        moderatorModelId: result.moderator.model_id,
        moderatorSummary: result.moderator.summary,
        participants: result.participants.map(p => ({
          model_id: p.model_id,
          model_name: p.model_name,
          response: p.response,
          role: p.role ?? undefined,
        })),
        prompt,
        sessionId,
        title,
        toolName,
        userId,
      });

      threadSlug = threadResult.threadSlug;

      // Link session -> thread (fire-and-forget)
      params.ctx.waitUntil(
        linkSessionToThread(env, userId, sessionId, threadResult.threadId).catch((err) => {
          console.error('[session-store] Failed to link thread:', err);
        }),
      );
    } catch (err) {
      console.error('[session-store] Failed to persist session or create thread:', err);
    }

    // Run evaluation (fire-and-forget)
    if (sessionId) {
      const sid = sessionId;
      params.ctx.waitUntil(
        (async () => {
          const evalResult = await runEvaluation(
            env,
            userId,
            sid,
            prompt,
            result.moderator.summary,
            result.participants.length,
          );

          if (evalResult) {
            trackMcpEvaluationCompleted(env, userId, {
              composite_score: evalResult.compositeScore,
              dimension_scores: Object.fromEntries(
                Object.entries(evalResult.dimensions).map(([k, v]) => [k, v.score]),
              ),
              participant_count: result.participants.length,
              session_id: sid,
              tool_name: toolName,
            });
          }
        })().catch((err) => {
          console.error('[evaluator] Failed to evaluate session:', err);
        }),
      );
    }
  }

  return { result, sessionId, threadSlug };
}
