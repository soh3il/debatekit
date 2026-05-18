/**
 * PostHog Event Tracking for MCP Tools
 *
 * Fire-and-forget analytics for MCP tool execution.
 * Disabled in local environment; enabled in preview/prod.
 */

import { PostHog } from 'posthog-node';
import { z } from 'zod';

import type { Env } from '../types';

// ============================================================================
// Client Singleton
// ============================================================================

let posthogClient: PostHog | null = null;

function getPostHogClient(env: Env): PostHog | null {
  if (env.WEBAPP_ENV === 'local' || !env.POSTHOG_API_KEY || !env.POSTHOG_HOST) {
    return null;
  }

  if (posthogClient) {
    return posthogClient;
  }

  posthogClient = new PostHog(env.POSTHOG_API_KEY, {
    flushAt: 1,
    flushInterval: 0,
    host: env.POSTHOG_HOST,
  });

  return posthogClient;
}

// ============================================================================
// Evaluation Event
// ============================================================================

const _McpEvaluationCompletedPropertiesSchema = z.object({
  composite_score: z.number(),
  dimension_scores: z.record(z.string(), z.number()),
  participant_count: z.number().int(),
  session_id: z.string(),
  tool_name: z.string(),
});
type McpEvaluationCompletedProperties = z.infer<typeof _McpEvaluationCompletedPropertiesSchema>;

export async function trackMcpEvaluationCompleted(
  env: Env,
  userId: string,
  properties: McpEvaluationCompletedProperties,
): Promise<void> {
  const posthog = getPostHogClient(env);
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: userId,
      event: 'mcp_evaluation_completed',
      properties,
    });

    await posthog.flush();
  } catch {
    // Fire-and-forget: silently fail
  }
}

// ============================================================================
// Credit Events (mirrors API's posthog-revenue.ts creditTracking)
// ============================================================================

const _McpCreditsInsufficientPropertiesSchema = z.object({
  current_balance: z.number(),
  plan_type: z.string(),
  required_credits: z.number(),
  subscription_tier: z.string().optional(),
});
type McpCreditsInsufficientProperties = z.infer<typeof _McpCreditsInsufficientPropertiesSchema>;

/**
 * Track when a user lacks sufficient credits to start a debate.
 * Mirrors API's `credits_insufficient_error` event.
 */
export async function trackMcpCreditsInsufficient(
  env: Env,
  userId: string,
  properties: McpCreditsInsufficientProperties,
): Promise<void> {
  const posthog = getPostHogClient(env);
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: userId,
      event: 'credits_insufficient_error',
      properties: {
        ...properties,
        $set: {
          credit_balance: properties.current_balance,
          last_credit_event: 'credits_insufficient_error',
          last_credit_event_date: new Date().toISOString(),
          plan_type: properties.plan_type,
        },
        source: 'mcp',
      },
    });

    await posthog.flush();
  } catch {
    // Fire-and-forget: silently fail
  }
}

const _McpCreditsDepletedPropertiesSchema = z.object({
  current_balance: z.number(),
  plan_type: z.string(),
  threshold: z.number().optional(),
});
type McpCreditsDepletedProperties = z.infer<typeof _McpCreditsDepletedPropertiesSchema>;

/**
 * Track when a user's balance is depleted (hit zero or near-zero).
 * Mirrors API's `credits_depleted` event.
 */
export async function trackMcpCreditsDepleted(
  env: Env,
  userId: string,
  properties: McpCreditsDepletedProperties,
): Promise<void> {
  const posthog = getPostHogClient(env);
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: userId,
      event: 'credits_depleted',
      properties: {
        ...properties,
        $set: {
          credit_balance: properties.current_balance,
          last_credit_event: 'credits_depleted',
          last_credit_event_date: new Date().toISOString(),
          plan_type: properties.plan_type,
        },
        source: 'mcp',
      },
    });

    await posthog.flush();
  } catch {
    // Fire-and-forget: silently fail
  }
}

const _McpDebateCompletedPropertiesSchema = z.object({
  duration_ms: z.number(),
  integration_source: z.string().optional(),
  model_count: z.number().int(),
  thinking_level: z.string(),
  tool_name: z.string(),
  total_credits: z.number(),
});
type McpDebateCompletedProperties = z.infer<typeof _McpDebateCompletedPropertiesSchema>;

/**
 * Track successful debate completion with credit usage.
 * Enriches MCP-side analytics beyond the existing logEventFireAndForget.
 */
export async function trackMcpDebateCompleted(
  env: Env,
  userId: string,
  properties: McpDebateCompletedProperties,
): Promise<void> {
  const posthog = getPostHogClient(env);
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: userId,
      event: 'mcp_debate_completed',
      properties: {
        ...properties,
        source: 'mcp',
      },
    });

    await posthog.flush();
  } catch {
    // Fire-and-forget: silently fail
  }
}

// ============================================================================
// Usage Limit Exceeded
// ============================================================================

const USAGE_LIMIT_WINDOW_VALUES = ['fiveHour', 'daily', 'weekly'] as const;

const _McpUsageLimitExceededPropertiesSchema = z.object({
  current_count: z.number(),
  limit: z.number(),
  plan_type: z.string(),
  retry_after_seconds: z.number().nullable(),
  window_exceeded: z.enum(USAGE_LIMIT_WINDOW_VALUES),
});
type McpUsageLimitExceededProperties = z.infer<typeof _McpUsageLimitExceededPropertiesSchema>;

/**
 * Track when a user exceeds an MCP usage limit window.
 */
export async function trackMcpUsageLimitExceeded(
  env: Env,
  userId: string,
  properties: McpUsageLimitExceededProperties,
): Promise<void> {
  const posthog = getPostHogClient(env);
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: userId,
      event: 'mcp_usage_limit_exceeded',
      properties: {
        ...properties,
        source: 'mcp',
      },
    });

    await posthog.flush();
  } catch {
    // Fire-and-forget: silently fail
  }
}

// ============================================================================
// Cooldown Started
// ============================================================================

const _McpCooldownStartedPropertiesSchema = z.object({
  cooldown_minutes: z.number(),
  plan_type: z.string(),
  trigger_window: z.literal('fiveHour'),
});
type McpCooldownStartedProperties = z.infer<typeof _McpCooldownStartedPropertiesSchema>;

/**
 * Track when a cooldown period is applied to a user.
 */
export async function trackMcpCooldownStarted(
  env: Env,
  userId: string,
  properties: McpCooldownStartedProperties,
): Promise<void> {
  const posthog = getPostHogClient(env);
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: userId,
      event: 'mcp_cooldown_started',
      properties: {
        ...properties,
        source: 'mcp',
      },
    });

    await posthog.flush();
  } catch {
    // Fire-and-forget: silently fail
  }
}

// ============================================================================
// Free Round Used
// ============================================================================

const _McpFreeRoundUsedPropertiesSchema = z.object({
  model_count: z.number().int(),
  tool_name: z.string(),
  total_credits: z.number(),
});
type McpFreeRoundUsedProperties = z.infer<typeof _McpFreeRoundUsedPropertiesSchema>;

/**
 * Track when a free-tier user completes their one free debate round.
 */
export async function trackMcpFreeRoundUsed(
  env: Env,
  userId: string,
  properties: McpFreeRoundUsedProperties,
): Promise<void> {
  const posthog = getPostHogClient(env);
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: userId,
      event: 'mcp_free_round_used',
      properties: {
        ...properties,
        $set: {
          mcp_free_round_used: true,
          mcp_free_round_used_at: new Date().toISOString(),
        },
        source: 'mcp',
      },
    });

    await posthog.flush();
  } catch {
    // Fire-and-forget: silently fail
  }
}

// ============================================================================
// Tool Invoked (pre-execution)
// ============================================================================

const _McpToolInvokedPropertiesSchema = z.object({
  integration_source: z.string().optional(),
  model_count: z.number().int(),
  plan_type: z.string(),
  thinking_level: z.string(),
  tool_name: z.string(),
});
type McpToolInvokedProperties = z.infer<typeof _McpToolInvokedPropertiesSchema>;

/**
 * Track when an MCP tool is invoked (before debate execution begins).
 * Sets person properties for MCP activity tracking.
 */
export async function trackMcpToolInvoked(
  env: Env,
  userId: string,
  properties: McpToolInvokedProperties,
): Promise<void> {
  const posthog = getPostHogClient(env);
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: userId,
      event: 'mcp_tool_invoked',
      properties: {
        ...properties,
        $set: {
          mcp_enabled: true,
          mcp_last_active_at: new Date().toISOString(),
          mcp_plan_type: properties.plan_type,
        },
        $set_once: {
          mcp_first_debate_at: new Date().toISOString(),
        },
        source: 'mcp',
      },
    });

    await posthog.flush();
  } catch {
    // Fire-and-forget: silently fail
  }
}
