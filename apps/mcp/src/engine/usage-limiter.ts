/**
 * MCP Usage Limiter
 *
 * Enforces per-plan request limits using KV counters across three time windows:
 *   - 5-hour windows (0-5, 5-10, 10-15, 15-20, 20-24 UTC)
 *   - Daily (UTC midnight to midnight)
 *   - Weekly (Monday 00:00 UTC to Sunday 23:59 UTC)
 *
 * KV TTLs: 5h = 6h TTL, daily = 25h TTL, weekly = 8d TTL
 */

import type { PlanType } from '@debatekit/shared';
import {
  DEFAULT_MCP_LIMIT_STATUS,
  MCP_USAGE_LIMITS,
  McpLimitStatuses,
  McpLimitStatusSchema,
} from '@debatekit/shared';
import { z } from 'zod';

import { trackMcpCooldownStarted, trackMcpUsageLimitExceeded } from '../lib/posthog';
import type { Env } from '../types';

// ============================================================================
// Constants
// ============================================================================

/** KV TTLs (seconds) — generous buffer over window duration */
const KV_TTL_5H = 6 * 60 * 60; // 6 hours
const KV_TTL_DAILY = 25 * 60 * 60; // 25 hours
const KV_TTL_WEEKLY = 8 * 24 * 60 * 60; // 8 days

/** Warning threshold — warn when usage exceeds 80% of limit */
const WARNING_THRESHOLD = 0.8;

// ============================================================================
// Window ID Calculations
// ============================================================================

function getFiveHourWindowId(now: Date): string {
  const hour = now.getUTCHours();
  const windowStart = Math.floor(hour / 5) * 5;
  const dateStr = formatDateUTC(now);
  return `${dateStr}:${windowStart}`;
}

function getFiveHourWindowResetMs(now: Date): number {
  const hour = now.getUTCHours();
  const windowStart = Math.floor(hour / 5) * 5;
  const nextWindowStart = windowStart + 5;

  const resetDate = new Date(now);
  resetDate.setUTCHours(nextWindowStart, 0, 0, 0);

  // If next window crosses midnight, set to next day 00:00
  if (nextWindowStart >= 24) {
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
    resetDate.setUTCHours(0, 0, 0, 0);
  }

  return resetDate.getTime();
}

function getDayId(now: Date): string {
  return formatDateUTC(now);
}

function getDayResetMs(now: Date): number {
  const resetDate = new Date(now);
  resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  resetDate.setUTCHours(0, 0, 0, 0);
  return resetDate.getTime();
}

function getWeekId(now: Date): string {
  // Monday-based weeks: get the Monday of the current week
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1, Sunday = 0 -> -6
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return formatDateUTC(monday);
}

function getWeekResetMs(now: Date): number {
  const day = now.getUTCDay();
  // Days until next Monday
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  return nextMonday.getTime();
}

function formatDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ============================================================================
// KV Key Builders
// ============================================================================

function kvKey5h(userId: string, windowId: string): string {
  return `mcp:usage:5h:${userId}:${windowId}`;
}

function kvKeyDay(userId: string, dateStr: string): string {
  return `mcp:usage:day:${userId}:${dateStr}`;
}

function kvKeyWeek(userId: string, weekId: string): string {
  return `mcp:usage:week:${userId}:${weekId}`;
}

function kvKeyCooldown(userId: string): string {
  return `mcp:cooldown:${userId}`;
}

// ============================================================================
// KV Helpers
// ============================================================================

async function getCounter(kv: KVNamespace, key: string): Promise<number> {
  const raw = await kv.get(key);
  return raw ? Number.parseInt(raw, 10) : 0;
}

async function incrementCounter(kv: KVNamespace, key: string, ttl: number): Promise<number> {
  const current = await getCounter(kv, key);
  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: ttl });
  return next;
}

// ============================================================================
// Zod Schemas for Response Types
// ============================================================================

const McpWindowUsageSchema = z.object({
  count: z.number(),
  limit: z.number(),
  resetAt: z.number(),
});
type McpWindowUsage = z.infer<typeof McpWindowUsageSchema>;

const McpUsageStatusSchema = z.object({
  daily: McpWindowUsageSchema,
  fiveHour: McpWindowUsageSchema,
  status: McpLimitStatusSchema,
  weekly: McpWindowUsageSchema,
});
type McpUsageStatus = z.infer<typeof McpUsageStatusSchema>;

const _McpUsageLimitCheckSchema = z.object({
  allowed: z.boolean(),
  cooldownEndsAt: z.number().nullable(),
  retryAfterSeconds: z.number().nullable(),
  status: McpLimitStatusSchema,
  usage: McpUsageStatusSchema.omit({ status: true }),
});
type McpUsageLimitCheck = z.infer<typeof _McpUsageLimitCheckSchema>;

// ============================================================================
// Check Usage Limits
// ============================================================================

/**
 * Check whether the user is within MCP usage limits.
 * Returns a structured result with status, usage counters, and retry info.
 */
export async function checkUsageLimits(
  env: Env,
  userId: string,
  planType: PlanType,
): Promise<McpUsageLimitCheck> {
  const now = new Date();
  const limits = MCP_USAGE_LIMITS[planType];

  // Check cooldown first
  const cooldownRaw = await env.KV.get(kvKeyCooldown(userId));
  if (cooldownRaw) {
    const cooldownEndsAt = Number.parseInt(cooldownRaw, 10);
    if (cooldownEndsAt > now.getTime()) {
      const retryAfterSeconds = Math.ceil((cooldownEndsAt - now.getTime()) / 1000);
      const usage = await gatherUsage(env, userId, limits, now);
      return {
        allowed: false,
        cooldownEndsAt,
        retryAfterSeconds,
        status: McpLimitStatuses.COOLDOWN,
        usage,
      };
    }
    // Cooldown expired, clean up
    env.KV.delete(kvKeyCooldown(userId)).catch(() => {});
  }

  const usage = await gatherUsage(env, userId, limits, now);

  // Check hard limits (exceeded)
  if (
    usage.fiveHour.count >= limits.requestsPerFiveHours
    || usage.daily.count >= limits.requestsPerDay
    || usage.weekly.count >= limits.requestsPerWeek
  ) {
    // Apply cooldown for free users hitting 5h limit
    let cooldownEndsAt: number | null = null;
    if (usage.fiveHour.count >= limits.requestsPerFiveHours && limits.cooldownMinutes > 0) {
      cooldownEndsAt = now.getTime() + limits.cooldownMinutes * 60 * 1000;
      await env.KV.put(
        kvKeyCooldown(userId),
        String(cooldownEndsAt),
        { expirationTtl: limits.cooldownMinutes * 60 },
      );

      trackMcpCooldownStarted(env, userId, {
        cooldown_minutes: limits.cooldownMinutes,
        plan_type: planType,
        trigger_window: 'fiveHour',
      });
    }

    const retryAfterSeconds = cooldownEndsAt
      ? Math.ceil((cooldownEndsAt - now.getTime()) / 1000)
      : null;

    // Track which window was exceeded (fire-and-forget)
    const exceededWindow: 'fiveHour' | 'daily' | 'weekly'
      = usage.fiveHour.count >= limits.requestsPerFiveHours
        ? 'fiveHour'
        : usage.daily.count >= limits.requestsPerDay
          ? 'daily'
          : 'weekly';

    const exceededUsage = usage[exceededWindow];
    trackMcpUsageLimitExceeded(env, userId, {
      current_count: exceededUsage.count,
      limit: exceededUsage.limit,
      plan_type: planType,
      retry_after_seconds: retryAfterSeconds,
      window_exceeded: exceededWindow,
    });

    return {
      allowed: false,
      cooldownEndsAt,
      retryAfterSeconds,
      status: McpLimitStatuses.EXCEEDED,
      usage,
    };
  }

  // Check warning thresholds
  const fiveHourRatio = usage.fiveHour.count / limits.requestsPerFiveHours;
  const dailyRatio = usage.daily.count / limits.requestsPerDay;
  const weeklyRatio = usage.weekly.count / limits.requestsPerWeek;

  if (fiveHourRatio >= WARNING_THRESHOLD || dailyRatio >= WARNING_THRESHOLD || weeklyRatio >= WARNING_THRESHOLD) {
    return {
      allowed: true,
      cooldownEndsAt: null,
      retryAfterSeconds: null,
      status: McpLimitStatuses.WARNING,
      usage,
    };
  }

  return {
    allowed: true,
    cooldownEndsAt: null,
    retryAfterSeconds: null,
    status: DEFAULT_MCP_LIMIT_STATUS,
    usage,
  };
}

// ============================================================================
// Increment Usage
// ============================================================================

/**
 * Increment all usage counters after a successful execution.
 * Fire-and-forget safe — errors are silently caught.
 */
export async function incrementUsage(env: Env, userId: string): Promise<void> {
  const now = new Date();
  const fiveHourWindow = getFiveHourWindowId(now);
  const dayId = getDayId(now);
  const weekId = getWeekId(now);

  await Promise.all([
    incrementCounter(env.KV, kvKey5h(userId, fiveHourWindow), KV_TTL_5H),
    incrementCounter(env.KV, kvKeyDay(userId, dayId), KV_TTL_DAILY),
    incrementCounter(env.KV, kvKeyWeek(userId, weekId), KV_TTL_WEEKLY),
  ]);
}

// ============================================================================
// Get Usage Status
// ============================================================================

/**
 * Return current usage counters, limits, and reset timestamps for the user.
 * Does not modify any counters.
 */
export async function getUsageStatus(
  env: Env,
  userId: string,
  planType: PlanType,
): Promise<McpUsageStatus> {
  const now = new Date();
  const limits = MCP_USAGE_LIMITS[planType];
  const usage = await gatherUsage(env, userId, limits, now);

  // Derive overall status
  const fiveHourRatio = usage.fiveHour.count / limits.requestsPerFiveHours;
  const dailyRatio = usage.daily.count / limits.requestsPerDay;
  const weeklyRatio = usage.weekly.count / limits.requestsPerWeek;

  // Check cooldown
  const cooldownRaw = await env.KV.get(kvKeyCooldown(userId));
  if (cooldownRaw) {
    const cooldownEndsAt = Number.parseInt(cooldownRaw, 10);
    if (cooldownEndsAt > now.getTime()) {
      return { ...usage, status: McpLimitStatuses.COOLDOWN };
    }
  }

  if (fiveHourRatio >= 1 || dailyRatio >= 1 || weeklyRatio >= 1) {
    return { ...usage, status: McpLimitStatuses.EXCEEDED };
  }

  if (fiveHourRatio >= WARNING_THRESHOLD || dailyRatio >= WARNING_THRESHOLD || weeklyRatio >= WARNING_THRESHOLD) {
    return { ...usage, status: McpLimitStatuses.WARNING };
  }

  return { ...usage, status: DEFAULT_MCP_LIMIT_STATUS };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Internal type matching MCP_USAGE_LIMITS plan entries */
type McpPlanLimits = {
  cooldownMinutes: number;
  requestsPerDay: number;
  requestsPerFiveHours: number;
  requestsPerWeek: number;
};

/** Internal type for gathered usage windows */
type UsageWindows = {
  daily: McpWindowUsage;
  fiveHour: McpWindowUsage;
  weekly: McpWindowUsage;
};

async function gatherUsage(
  env: Env,
  userId: string,
  limits: McpPlanLimits,
  now: Date,
): Promise<UsageWindows> {
  const fiveHourWindow = getFiveHourWindowId(now);
  const dayId = getDayId(now);
  const weekId = getWeekId(now);

  const [fiveHourCount, dailyCount, weeklyCount] = await Promise.all([
    getCounter(env.KV, kvKey5h(userId, fiveHourWindow)),
    getCounter(env.KV, kvKeyDay(userId, dayId)),
    getCounter(env.KV, kvKeyWeek(userId, weekId)),
  ]);

  return {
    daily: {
      count: dailyCount,
      limit: limits.requestsPerDay,
      resetAt: getDayResetMs(now),
    },
    fiveHour: {
      count: fiveHourCount,
      limit: limits.requestsPerFiveHours,
      resetAt: getFiveHourWindowResetMs(now),
    },
    weekly: {
      count: weeklyCount,
      limit: limits.requestsPerWeek,
      resetAt: getWeekResetMs(now),
    },
  };
}
