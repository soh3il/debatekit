import type { ContentPipelineStatus } from '@debatekit/shared/enums';
import { ACTIVE_CONTENT_PIPELINE_STATUSES, ContentPipelineStatuses, ContentPipelineTriggerTypes } from '@debatekit/shared/enums';

import {
  AdminActionRow,
  AdminCancelButton,
  AdminDetailsButton,
  AdminItemCard,
  AdminItemError,
  AdminPipelineStatusBadge,
} from '@/components/admin';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTimeET, formatDuration } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui';
import type { PipelineRun } from '@/services/api/admin/pipeline';

import { ActiveRunProgress } from './active-run-progress';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBorderClasses(status: ContentPipelineStatus) {
  if (ACTIVE_CONTENT_PIPELINE_STATUSES.has(status)) {
    return 'border-l-2 border-l-primary';
  }

  if (status === ContentPipelineStatuses.FAILED) {
    return 'border-l-2 border-l-destructive';
  }

  if (status === ContentPipelineStatuses.COMPLETED) {
    return 'border-l-2 border-l-chart-3';
  }

  if (status === ContentPipelineStatuses.AWAITING_REVIEW) {
    return 'border-l-2 border-l-amber-500';
  }

  if (status === ContentPipelineStatuses.CANCELLED) {
    return 'border-l-2 border-l-destructive/50 opacity-60';
  }

  return '';
}

// ---------------------------------------------------------------------------
// PipelineRunCard
// ---------------------------------------------------------------------------

type PipelineRunCardProps = {
  onCancel: (id: string) => void;
  onDetails: (run: PipelineRun) => void;
  onReview?: (run: PipelineRun) => void;
  qualityThreshold?: number;
  run: PipelineRun;
};

export function PipelineRunCard({ onCancel, onDetails, onReview, qualityThreshold = 60, run }: PipelineRunCardProps) {
  const t = useTranslations();
  const isActive = ACTIVE_CONTENT_PIPELINE_STATUSES.has(run.status);
  const isFailed = run.status === ContentPipelineStatuses.FAILED;

  const viralScoreEntries = run.viralScores
    ? Object.entries(run.viralScores)
    : [];

  const rejectedCount = viralScoreEntries.filter(([, score]) => {
    const numScore = typeof score === 'number' ? score : Number(score);
    return numScore < qualityThreshold;
  }).length;

  return (
    <AdminItemCard className={getStatusBorderClasses(run.status)}>
      {/* Header: content left, status badge right */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-2">
            {run.discoveredTopicsCount > 0
              ? t('admin.pipeline.discovered', { count: run.discoveredTopicsCount })
              : t('admin.pipeline.pendingDiscovery')}
          </p>
          {/* Meta row: trigger icon, date */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {run.triggerType === ContentPipelineTriggerTypes.MANUAL
                ? <Icons.user className="size-3 text-muted-foreground/60" />
                : <Icons.zap className="size-3 text-muted-foreground/60" />}
            </span>
            <span>{formatDateTimeET(run.createdAt)}</span>
            {run.selectedTopicsCount > 0 && (
              <>
                <span>&middot;</span>
                <span>{t('admin.pipeline.selected', { count: run.selectedTopicsCount })}</span>
              </>
            )}
            {run.startedAt && run.completedAt && (
              <>
                <span>&middot;</span>
                <span className="flex items-center gap-1">
                  <Icons.clock className="size-3" />
                  {formatDuration(run.startedAt, run.completedAt)}
                </span>
              </>
            )}
            {run.createdJobIds && run.createdJobIds.length > 0 && (
              <>
                <span>&middot;</span>
                <span>{t('admin.pipeline.jobsCount', { count: run.createdJobIds.length })}</span>
              </>
            )}
          </div>
        </div>
        <AdminPipelineStatusBadge status={run.status} />
      </div>

      {/* Active run: stage progress indicator */}
      {isActive && <ActiveRunProgress run={run} />}

      {/* Awaiting review: show review prompt */}
      {run.status === ContentPipelineStatuses.AWAITING_REVIEW && (
        <div className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs bg-amber-500/[0.08] border border-amber-500/15 text-amber-400">
          <Icons.search className="size-3.5 shrink-0" />
          <span className="flex-1">{t('admin.pipeline.awaitingReviewHint')}</span>
          <Button
            type="button"
            variant="glass"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={() => onReview?.(run)}
          >
            {t('admin.pipeline.reviewTopics')}
          </Button>
        </div>
      )}

      {/* Completed run summary */}
      {run.status === ContentPipelineStatuses.COMPLETED && (
        <div className={cn(
          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs',
          run.discoveredTopicsCount > 0
            ? 'bg-chart-3/[0.06] border border-chart-3/10 text-chart-3/80'
            : 'bg-muted/30 border border-white/[0.06] text-muted-foreground',
        )}
        >
          {run.discoveredTopicsCount > 0
            ? <Icons.trendingUp className="size-3 shrink-0" />
            : <Icons.search className="size-3 shrink-0" />}
          <span>
            {run.discoveredTopicsCount === 0
              ? t('admin.pipeline.noTopicsFound')
              : (
                  <>
                    {t('admin.pipeline.topicsFound', { count: run.discoveredTopicsCount })}
                    {run.selectedTopicsCount > 0 && ` \u2192 ${t('admin.pipeline.passedQualityThreshold', { count: run.selectedTopicsCount })}`}
                    {run.selectedTopicsCount === 0 && run.discoveredTopicsCount > 0 && ` \u2014 ${t('admin.pipeline.noneMetThreshold')}`}
                    {run.createdJobIds && run.createdJobIds.length > 0 && ` \u2192 ${t('admin.pipeline.debatesCreated', { count: run.createdJobIds.length })}`}
                  </>
                )}
          </span>
        </div>
      )}

      {/* Viral scores chips */}
      {viralScoreEntries.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {viralScoreEntries.map(([topic, score]) => {
              const numScore = typeof score === 'number' ? score : Number(score);
              const passed = numScore >= qualityThreshold;
              return (
                <Badge
                  key={topic}
                  variant="secondary"
                  className={cn(
                    'text-[10px] font-normal px-1.5 py-0',
                    passed
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                  )}
                >
                  {passed ? '\u2713' : '\u2717'}
                  {' '}
                  {topic}
                  <span className="ml-1 font-semibold">{score}</span>
                </Badge>
              );
            })}
          </div>
          {rejectedCount > 0 && (
            <p className="text-[10px] text-muted-foreground/60">
              {t('admin.pipeline.scoredBelowThreshold', { count: rejectedCount, threshold: qualityThreshold })}
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {isFailed && run.errorMessage && (
        <AdminItemError message={run.errorMessage} />
      )}

      {/* Actions */}
      <AdminActionRow>
        <AdminDetailsButton onClick={() => onDetails(run)} />
        {isActive && (
          <AdminCancelButton onClick={() => onCancel(run.id)} />
        )}
      </AdminActionRow>
    </AdminItemCard>
  );
}
