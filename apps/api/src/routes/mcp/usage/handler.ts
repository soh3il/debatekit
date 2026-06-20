import { MCP_USAGE_LIMITS } from '@debatekit/shared';
import type { McpLimitStatus } from '@debatekit/shared/enums';
import { McpLimitStatuses, PlanTypes } from '@debatekit/shared/enums';
import type { RouteHandler } from '@hono/zod-openapi';

import { createHandler, Responses } from '@/core';
import { getUserCreditBalance } from '@/services/billing';
import type { ApiEnv } from '@/types';

import type { getMcpUsageRoute } from './route';

// ============================================================================
// KV Key Builders (must match apps/mcp/src/engine/usage-limiter.ts exactly)
// ============================================================================

function formatDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

  if (nextWindowStart >= 24) {
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
    resetDate.setUTCHours(0, 0, 0, 0);
  }

  return resetDate.getTime();
}

function getDayResetMs(now: Date): number {
  const resetDate = new Date(now);
  resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  resetDate.setUTCHours(0, 0, 0, 0);
  return resetDate.getTime();
}

function getWeekId(now: Date): string {
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return formatDateUTC(monday);
}

function getWeekResetMs(now: Date): number {
  const day = now.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  return nextMonday.getTime();
}

async function getCounter(kv: KVNamespace, key: string): Promise<number> {
  const raw = await kv.get(key);
  return raw ? Number.parseInt(raw, 10) : 0;
}

// ============================================================================
// Warning Threshold
// ============================================================================

const WARNING_THRESHOLD = 0.8;

// ============================================================================
// Handler
// ============================================================================

export const getMcpUsageHandler: RouteHandler<
  typeof getMcpUsageRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session',
    operationName: 'getMcpUsage',
  },
  async (c) => {
    const { user } = c.auth();
    const now = new Date();

    // Determine plan type
    const creditBalance = await getUserCreditBalance(user.id);
    const planType = creditBalance.planType === PlanTypes.PAID ? PlanTypes.PAID : PlanTypes.FREE;
    const limits = MCP_USAGE_LIMITS[planType];

    // Read KV counters
    const kv = c.env.KV;
    const userId = user.id;
    const fiveHourWindow = getFiveHourWindowId(now);
    const dayId = formatDateUTC(now);
    const weekId = getWeekId(now);

    const [fiveHourCount, dailyCount, weeklyCount, cooldownRaw] = await Promise.all([
      getCounter(kv, `mcp:usage:5h:${userId}:${fiveHourWindow}`),
      getCounter(kv, `mcp:usage:day:${userId}:${dayId}`),
      getCounter(kv, `mcp:usage:week:${userId}:${weekId}`),
      kv.get(`mcp:cooldown:${userId}`),
    ]);

    // Compute cooldown
    let cooldownActive = false;
    let cooldownEndsAt: string | null = null;
    let cooldownRemainingSeconds: number | null = null;

    if (cooldownRaw) {
      const cooldownMs = Number.parseInt(cooldownRaw, 10);
      if (cooldownMs > now.getTime()) {
        cooldownActive = true;
        cooldownEndsAt = new Date(cooldownMs).toISOString();
        cooldownRemainingSeconds = Math.ceil((cooldownMs - now.getTime()) / 1000);
      }
    }

    // Derive status
    const fiveHourRatio = fiveHourCount / limits.requestsPerFiveHours;
    const dailyRatio = dailyCount / limits.requestsPerDay;
    const weeklyRatio = weeklyCount / limits.requestsPerWeek;

    let status: McpLimitStatus = McpLimitStatuses.OK;
    if (cooldownActive) {
      status = McpLimitStatuses.COOLDOWN;
    } else if (fiveHourRatio >= 1 || dailyRatio >= 1 || weeklyRatio >= 1) {
      status = McpLimitStatuses.EXCEEDED;
    } else if (fiveHourRatio >= WARNING_THRESHOLD || dailyRatio >= WARNING_THRESHOLD || weeklyRatio >= WARNING_THRESHOLD) {
      status = McpLimitStatuses.WARNING;
    }

    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');

    return Responses.ok(c, {
      cooldown: {
        active: cooldownActive,
        endsAt: cooldownEndsAt,
        remainingSeconds: cooldownRemainingSeconds,
      },
      daily: {
        count: dailyCount,
        limit: limits.requestsPerDay,
        remaining: Math.max(0, limits.requestsPerDay - dailyCount),
        resetAt: new Date(getDayResetMs(now)).toISOString(),
      },
      fiveHour: {
        count: fiveHourCount,
        limit: limits.requestsPerFiveHours,
        remaining: Math.max(0, limits.requestsPerFiveHours - fiveHourCount),
        resetAt: new Date(getFiveHourWindowResetMs(now)).toISOString(),
      },
      plan: planType,
      status,
      weekly: {
        count: weeklyCount,
        limit: limits.requestsPerWeek,
        remaining: Math.max(0, limits.requestsPerWeek - weeklyCount),
        resetAt: new Date(getWeekResetMs(now)).toISOString(),
      },
    });
  },
);
