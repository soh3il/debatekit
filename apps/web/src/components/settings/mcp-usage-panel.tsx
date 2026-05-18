/**
 * MCP Usage Panel
 *
 * Content-only panel showing depleting capacity bars with display values,
 * local timezone reset times, and live countdowns.
 * Rendered inside an AccordionSection by the parent page.
 */

import type { McpOverallStatus } from '@debatekit/shared';
import { MCP_USAGE_LIMITS, McpOverallStatuses, SIGNUP_BONUS_CREDITS } from '@debatekit/shared';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useMcpDashboard } from '@/hooks/queries/use-mcp-dashboard';
import { AnalyticsEvents, useAnalytics } from '@/lib/analytics';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';
import { formatCompactNumber, formatCountdown, secondsUntil } from '@/lib/utils/mcp-formatting';

// ============================================================================
// Status styling
// ============================================================================

export const STATUS_DOT_CLASSES: Record<McpOverallStatus, string> = {
  [McpOverallStatuses.COOLDOWN]: 'bg-red-500',
  [McpOverallStatuses.CRITICAL]: 'bg-red-500',
  [McpOverallStatuses.EXCEEDED]: 'bg-red-500',
  [McpOverallStatuses.OK]: 'bg-emerald-500',
  [McpOverallStatuses.WARNING]: 'bg-amber-500',
};

function getBarClasses(percentRemaining: number) {
  if (percentRemaining < 10) {
    return 'bg-red-500 animate-pulse';
  }
  if (percentRemaining < 25) {
    return 'bg-red-500';
  }
  if (percentRemaining <= 50) {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
}

// ============================================================================
// Sub-components
// ============================================================================

type CapacityBarProps = {
  label: string;
  percentRemaining: number;
  remaining: number;
  displayLimit: number;
  resetLocal: string;
  resetCountdown: string;
};

function CapacityBar({
  displayLimit,
  label,
  percentRemaining,
  remaining,
  resetCountdown,
  resetLocal,
}: CapacityBarProps) {
  const t = useTranslations('settings.apiKeys.mcp');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t('panel.capacityRemaining', {
            limit: String(displayLimit),
            remaining: String(remaining),
          })}
        </span>
      </div>
      <Progress
        value={percentRemaining}
        className={cn('transition-all duration-500 h-1.5')}
        indicatorClassName={cn('transition-all duration-500', getBarClasses(percentRemaining))}
      />
      <div className="text-xs text-muted-foreground/70">
        {t('panel.resetsAt', { countdown: resetCountdown, time: resetLocal })}
      </div>
    </div>
  );
}

type CooldownTimerProps = {
  endsAt: string;
  onComplete?: () => void;
};

function CooldownTimer({ endsAt, onComplete }: CooldownTimerProps) {
  const t = useTranslations('settings.apiKeys.mcp');
  const [remaining, setRemaining] = useState(() => secondsUntil(endsAt));

  useEffect(() => {
    if (secondsUntil(endsAt) <= 0) {
      onComplete?.();
      return;
    }

    const interval = setInterval(() => {
      const next = secondsUntil(endsAt);
      setRemaining(next);
      if (next <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt, onComplete]);

  if (remaining <= 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
      <div className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-red-500" />
      </div>
      <span className="text-xs font-medium text-red-400">
        {t('usage.cooldownTimer', { time: formatCountdown(remaining) })}
      </span>
    </div>
  );
}

// ============================================================================
// Plan Info Banner
// ============================================================================

function FreePlanBanner() {
  const t = useTranslations('settings.apiKeys.mcp');
  const { track } = useAnalytics();
  const freeLimits = MCP_USAGE_LIMITS.free;
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!viewedRef.current) {
      track(AnalyticsEvents.MCP_PLAN_BANNER_VIEWED, { plan: 'free' });
      viewedRef.current = true;
    }
  }, [track]);

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <Icons.info className="size-4 text-amber-400 shrink-0" />
        <span className="text-sm font-medium text-amber-300">
          {t('panel.freePlanBannerTitle')}
        </span>
      </div>
      <div className="space-y-1.5 pl-6">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('panel.freePlanBannerBody', { credits: String(SIGNUP_BONUS_CREDITS) })}
        </p>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {t('panel.freePlanBannerRateLimits', {
            daily: String(freeLimits.requestsPerDay),
            fiveHour: String(freeLimits.requestsPerFiveHours),
            weekly: String(freeLimits.requestsPerWeek),
          })}
        </p>
        <p className="text-xs text-emerald-400/90 font-medium leading-relaxed">
          {t('panel.freePlanBannerUpgrade')}
        </p>
      </div>
      <div className="pl-6">
        <Button variant="upgrade" size="sm" asChild>
          <Link
            to="/chat/pricing"
            onClick={() => track(AnalyticsEvents.MCP_UPGRADE_CTA_CLICKED, { plan: 'free', source: 'plan_banner' })}
          >
            <Icons.zap className="size-3 mr-1" />
            {t('panel.freePlanBannerCta')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ProPlanBanner() {
  const t = useTranslations('settings.apiKeys.mcp');
  const { track } = useAnalytics();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!viewedRef.current) {
      track(AnalyticsEvents.MCP_PLAN_BANNER_VIEWED, { plan: 'pro' });
      viewedRef.current = true;
    }
  }, [track]);

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icons.check className="size-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-medium text-emerald-300">
          {t('panel.proPlanBannerTitle')}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-6">
        {t('panel.proPlanBannerBody')}
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function McpUsagePanel() {
  const t = useTranslations('settings.apiKeys.mcp');
  const { track } = useAnalytics();
  const { data, isError, isLoading, refetch } = useMcpDashboard();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (data && !viewedRef.current) {
      track(AnalyticsEvents.MCP_USAGE_PANEL_VIEWED, {
        overall_status: data.overallStatus,
        plan: data.planLabel,
        tightest_window: data.tightestWindow,
      });
      viewedRef.current = true;
    }
  }, [data, track]);

  if (isLoading) {
    return <McpUsagePanelSkeleton />;
  }

  if (isError || !data) {
    return <McpUsagePanelError onRetry={refetch} />;
  }

  const { cooldown, credits, daily, fiveHour, weekly } = data;

  const isExceeded = fiveHour.remaining <= 0 || daily.remaining <= 0 || weekly.remaining <= 0;
  const isFree = credits?.planLabel === 'Free';

  return (
    <div className="space-y-4">
      {isFree ? <FreePlanBanner /> : <ProPlanBanner />}

      {isExceeded && (
        <ExceededBanner isFree={isFree} />
      )}

      {cooldown.active && cooldown.endsAt && (
        <CooldownTimer endsAt={cooldown.endsAt} onComplete={refetch} />
      )}

      <CapacityBar
        label={t('panel.sessionWindow')}
        percentRemaining={fiveHour.percentRemaining}
        remaining={fiveHour.remaining}
        displayLimit={fiveHour.displayLimit}
        resetLocal={fiveHour.resetLocal}
        resetCountdown={fiveHour.resetCountdown}
      />

      <CapacityBar
        label={t('panel.weeklyLimit')}
        percentRemaining={weekly.percentRemaining}
        remaining={weekly.remaining}
        displayLimit={weekly.displayLimit}
        resetLocal={weekly.resetLocal}
        resetCountdown={weekly.resetCountdown}
      />

      <CapacityBar
        label={t('panel.dailyLimit')}
        percentRemaining={daily.percentRemaining}
        remaining={daily.remaining}
        displayLimit={daily.displayLimit}
        resetLocal={daily.resetLocal}
        resetCountdown={daily.resetCountdown}
      />

      {credits && (
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Icons.coins className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground">
              {t('panel.creditsRemaining', { count: formatCompactNumber(credits.available) })}
            </span>
          </div>
          {credits.showUpgradeCta && (
            <Button variant="upgrade" size="sm" className="shrink-0" asChild>
              <Link
                to="/chat/pricing"
                onClick={() => track(AnalyticsEvents.MCP_UPGRADE_CTA_CLICKED, { plan: 'free', source: 'usage_panel' })}
              >
                <Icons.zap className="size-3 mr-1" />
                {t('credits.upgrade')}
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Exceeded Banner
// ============================================================================

function ExceededBanner({ isFree }: { isFree: boolean }) {
  const t = useTranslations('settings.apiKeys.mcp');
  const { track } = useAnalytics();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      track(AnalyticsEvents.MCP_LIMIT_EXCEEDED_SHOWN, { plan: isFree ? 'free' : 'pro' });
      trackedRef.current = true;
    }
  }, [isFree, track]);

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icons.alertTriangle className="size-4 text-red-400 shrink-0" />
        <span className="text-sm font-medium text-red-400">
          {isFree ? t('panel.exceededBannerFree') : t('panel.exceededBanner')}
        </span>
      </div>
      {isFree && (
        <p className="text-xs text-red-400/70 pl-6">
          {t('panel.hardLimitNotice')}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function McpUsagePanelSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function McpUsagePanelError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('settings.apiKeys.mcp');

  return (
    <Alert variant="destructive">
      <Icons.alertTriangle className="size-4" />
      <AlertTitle>{t('panel.errorTitle')}</AlertTitle>
      <AlertDescription className="flex items-center gap-2">
        <span>{t('panel.errorDescription')}</span>
        <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={onRetry}>
          <Icons.refreshCw className="size-3 mr-1" />
          {t('panel.retry')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
