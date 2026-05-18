/**
 * MCP Dashboard Composing Hook
 *
 * Merges useMcpCreditsQuery + useMcpUsageQuery into a single derived state
 * with depleting capacity bars, 2x multiplied display values, and live countdowns.
 */

import type { McpLimitStatus, McpOverallStatus } from '@debatekit/shared';
import { McpLimitStatuses, McpOverallStatuses } from '@debatekit/shared';
import { useEffect, useMemo, useState } from 'react';

import { useMcpCreditsQuery, useMcpUsageQuery } from '@/hooks/queries/mcp';
import { formatCountdown, formatLocalResetTime, secondsUntil } from '@/lib/utils/mcp-formatting';

// ============================================================================
// Types
// ============================================================================

type WindowDerived = {
  displayLimit: number;
  displayUsed: number;
  limit: number;
  percentRemaining: number;
  remaining: number;
  resetAt: string;
  resetCountdown: string;
  resetLocal: string;
};

// ============================================================================
// Helpers
// ============================================================================

const STATUS_PRIORITY: Record<McpOverallStatus, number> = {
  [McpOverallStatuses.EXCEEDED]: 4,
  [McpOverallStatuses.COOLDOWN]: 3,
  [McpOverallStatuses.CRITICAL]: 2,
  [McpOverallStatuses.WARNING]: 1,
  [McpOverallStatuses.OK]: 0,
};

function deriveOverallStatus(
  usageStatus: McpLimitStatus,
  creditStatus: string,
): McpOverallStatus {
  const mapped: McpOverallStatus = usageStatus === McpLimitStatuses.COOLDOWN
    ? McpOverallStatuses.COOLDOWN
    : usageStatus === McpLimitStatuses.EXCEEDED
      ? McpOverallStatuses.EXCEEDED
      : usageStatus === McpLimitStatuses.WARNING
        ? McpOverallStatuses.WARNING
        : McpOverallStatuses.OK;

  const creditMapped: McpOverallStatus = creditStatus === 'critical'
    ? McpOverallStatuses.CRITICAL
    : creditStatus === 'warning'
      ? McpOverallStatuses.WARNING
      : McpOverallStatuses.OK;

  return STATUS_PRIORITY[mapped] >= STATUS_PRIORITY[creditMapped]
    ? mapped
    : creditMapped;
}

function deriveWindow(
  window: { count: number; limit: number; remaining: number; resetAt: string },
  _now: number,
): WindowDerived {
  const percentRemaining = window.limit > 0
    ? Math.max(0, Math.min(100, (window.remaining / window.limit) * 100))
    : 100;

  return {
    displayLimit: window.limit,
    displayUsed: window.count,
    limit: window.limit,
    percentRemaining,
    remaining: window.remaining,
    resetAt: window.resetAt,
    resetCountdown: formatCountdown(secondsUntil(window.resetAt)),
    resetLocal: formatLocalResetTime(window.resetAt),
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useMcpDashboard() {
  const credits = useMcpCreditsQuery();
  const usage = useMcpUsageQuery();

  // Tick every second for live countdowns
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const derived = useMemo(() => {
    const usageData = usage.data && 'success' in usage.data && usage.data.success
      ? usage.data.data
      : null;
    const creditsData = credits.data && 'success' in credits.data && credits.data.success
      ? credits.data.data
      : null;

    if (!usageData) {
      return null;
    }

    const fiveHour = deriveWindow(usageData.fiveHour, now);
    const weekly = deriveWindow(usageData.weekly, now);
    const daily = deriveWindow(usageData.daily, now);

    // Tightest window = lowest percentRemaining
    const windows = [
      { key: 'fiveHour' as const, window: fiveHour },
      { key: 'weekly' as const, window: weekly },
      { key: 'daily' as const, window: daily },
    ];
    const tightest = windows.reduce((a, b) =>
      b.window.percentRemaining < a.window.percentRemaining ? b : a,
    );

    const overallStatus = deriveOverallStatus(
      usageData.status,
      creditsData?.status ?? 'default',
    );

    const planLabel = creditsData
      ? creditsData.plan.type === 'free' ? 'Free' : 'Pro'
      : usageData.plan === 'free' ? 'Free' : 'Pro';

    return {
      cooldown: usageData.cooldown,
      credits: creditsData
        ? {
            available: creditsData.available,
            planLabel,
            showUpgradeCta: creditsData.status === 'warning' || creditsData.status === 'critical',
            status: creditsData.status,
          }
        : null,
      daily,
      fiveHour,
      overallStatus,
      planLabel,
      summaryReset: tightest.window.resetCountdown,
      summaryText: `${Math.round(tightest.window.percentRemaining)}`,
      tightestWindow: tightest.key,
      weekly,
    };
  }, [credits.data, usage.data, now]);

  return {
    data: derived,
    isError: credits.isError && usage.isError,
    isLoading: credits.isLoading || usage.isPending,
    refetch: () => {
      credits.refetch();
      usage.refetch();
    },
  };
}
