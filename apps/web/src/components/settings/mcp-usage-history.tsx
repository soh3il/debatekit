/**
 * MCP Usage History Component
 *
 * Displays rich session cards for recent MCP tool usage
 * with infinite scroll pagination.
 */

import type { ChatMode, MCPToolMethod } from '@debatekit/shared';
import { AvatarSizes, ChatModes } from '@debatekit/shared';
import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { AvatarGroup } from '@/components/chat/avatar-group';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMcpHistoryInfiniteQuery } from '@/hooks/queries/mcp';
import { useModelLookup } from '@/hooks/utils/use-model-lookup';
import { AnalyticsEvents, useAnalytics } from '@/lib/analytics';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';
import { formatCompactNumber } from '@/lib/utils/mcp-formatting';

// ============================================================================
// Constants
// ============================================================================

const TOOL_ICONS: Partial<Record<MCPToolMethod, LucideIcon>> = {
  architect: Icons.layers,
  assess_tradeoffs: Icons.scale,
  consult: Icons.messageSquare,
  debug: Icons.wrench,
  plan_implementation: Icons.sparkles,
  review_code: Icons.fileSearch,
};

const MODE_CLASSES: Record<ChatMode, string> = {
  [ChatModes.ANALYZING]: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  [ChatModes.BRAINSTORMING]: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  [ChatModes.DEBATING]: 'bg-red-500/15 text-red-400 border-red-500/30',
  [ChatModes.SOLVING]: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const PROMPT_MAX_LENGTH = 100;

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(date: Date | string) {
  const now = Date.now();
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${Number.parseFloat(seconds.toFixed(1))}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
}

function truncatePrompt(prompt: string) {
  if (prompt.length <= PROMPT_MAX_LENGTH) {
    return prompt;
  }
  return `${prompt.slice(0, PROMPT_MAX_LENGTH)}...`;
}

// ============================================================================
// Session Card
// ============================================================================

type SessionItem = {
  createdAt: Date | string;
  durationMs: number;
  format: string;
  id: string;
  mode: ChatMode;
  modelIds: string[];
  prompt: string;
  thinkingLevel: string;
  threadSlug: string | null;
  toolName: MCPToolMethod;
  totalCredits: number;
};

type SessionCardProps = {
  item: SessionItem;
  allModels: ReturnType<typeof useModelLookup>['allModels'];
};

function SessionCard({ allModels, item }: SessionCardProps) {
  const t = useTranslations('settings.apiKeys.mcp');
  const ToolIcon = TOOL_ICONS[item.toolName] ?? Icons.zap;
  const modeClass = MODE_CLASSES[item.mode] ?? 'bg-muted/50 text-muted-foreground border-transparent';
  const toolLabel = t(`history.tools.${item.toolName}` as 'history.title') || item.toolName;
  const modeLabel = t(`history.modes.${item.mode}` as 'history.title') || item.mode;
  const thinkingLabel = t(`history.thinking.${item.thinkingLevel}` as 'history.title') || item.thinkingLevel;

  const participants = item.modelIds.map((id, i) => ({
    id: `${item.id}-${i}`,
    modelId: id,
    priority: i,
    role: null,
  }));

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2">
      {/* Header row: tool + mode + thinking + duration + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ToolIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
          <span className="text-xs font-medium text-foreground/90 truncate">
            {toolLabel}
          </span>
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0 h-4 shrink-0', modeClass)}
          >
            {modeLabel}
          </Badge>
          <span className="text-[10px] text-muted-foreground/50 shrink-0">
            {thinkingLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground/50">
          <span>{formatDuration(item.durationMs)}</span>
          <span>·</span>
          <span>{formatTimeAgo(item.createdAt)}</span>
        </div>
      </div>

      {/* Prompt summary */}
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-2">
        &ldquo;
        {truncatePrompt(item.prompt)}
        &rdquo;
      </p>

      {/* Footer: avatars + credits + thread link */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {participants.length > 0 && (
            <AvatarGroup
              participants={participants}
              allModels={allModels}
              size={AvatarSizes.SM}
              maxVisible={4}
              showOverflow
              showCount={false}
            />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5">
            <Icons.coins className="size-2.5" />
            {formatCompactNumber(item.totalCredits)}
          </span>
          {item.threadSlug && (
            <Link
              to="/chat/$slug"
              params={{ slug: item.threadSlug }}
              className="text-[10px] text-primary/70 hover:text-primary transition-colors flex items-center gap-0.5"
            >
              {t('history.viewThread')}
              <Icons.externalLink className="size-2.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function SessionCardSkeleton() {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-3.5 rounded bg-white/5" />
          <div className="h-3 w-16 rounded bg-white/5" />
          <div className="h-4 w-14 rounded-full bg-white/5" />
        </div>
        <div className="h-2.5 w-20 rounded bg-white/5" />
      </div>
      <div className="h-3 w-3/4 rounded bg-white/5" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[-4px]">
          {[1, 2, 3].map(i => (
            <div key={i} className="size-5 rounded-full bg-white/5" />
          ))}
        </div>
        <div className="h-2.5 w-16 rounded bg-white/5" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function McpUsageHistory() {
  const t = useTranslations('settings.apiKeys.mcp');
  const { track } = useAnalytics();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useMcpHistoryInfiniteQuery();
  const { allModels } = useModelLookup();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const allItems = useMemo(
    () => data?.pages.flatMap(page => page.data.items) ?? [],
    [data],
  );

  useEffect(() => {
    if (allItems.length > 0 && !viewedRef.current) {
      track(AnalyticsEvents.MCP_HISTORY_VIEWED, { total_sessions: allItems.length });
      viewedRef.current = true;
    }
  }, [allItems.length, track]);

  if (isPending) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <SessionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <Icons.alertCircle className="size-4" />
        <AlertTitle>{t('history.errorTitle')}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{t('history.errorDescription')}</span>
          <Button
            variant="outline"
            size="sm"
            className="w-fit text-xs"
            onClick={() => refetch()}
          >
            <Icons.refreshCw className="mr-1.5 size-3" />
            {t('history.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      {allItems.length === 0
        ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 border border-dashed border-white/[0.06] rounded-lg">
              <Icons.zap className="size-6 mb-2" />
              <span className="text-xs">{t('history.empty')}</span>
            </div>
          )
        : (
            <div className="space-y-2">
              {allItems.map(item => (
                <SessionCard
                  key={item.id}
                  item={item}
                  allModels={allModels}
                />
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-1" />

              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Icons.loader className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!hasNextPage && allItems.length > 5 && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  {t('history.endOfList')}
                </p>
              )}
            </div>
          )}
    </div>
  );
}
