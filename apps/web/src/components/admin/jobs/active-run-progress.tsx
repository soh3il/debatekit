import type { ContentPipelineStatus } from '@debatekit/shared/enums';
import { ACTIVE_CONTENT_PIPELINE_STATUSES, ContentPipelineStatuses } from '@debatekit/shared/enums';

import { Icons } from '@/components/icons';
import { useElapsedTime } from '@/hooks/utils';
import { formatElapsedSeconds } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui';
import type { PipelineRun } from '@/services/api/admin/pipeline';

// ---------------------------------------------------------------------------
// Pipeline stage progress (for active runs)
// ---------------------------------------------------------------------------

const PIPELINE_STAGE_KEYS = [
  ContentPipelineStatuses.PENDING,
  ContentPipelineStatuses.DISCOVERING,
  ContentPipelineStatuses.CREATING_JOBS,
  ContentPipelineStatuses.RUNNING,
] as const;

function getStageIndex(status: ContentPipelineStatus) {
  const idx = PIPELINE_STAGE_KEYS.indexOf(status as typeof PIPELINE_STAGE_KEYS[number]);
  return idx >= 0 ? idx : 0;
}

function getStageMessage(status: ContentPipelineStatus, run: PipelineRun, t: (key: string, values?: Record<string, string | number>) => string) {
  switch (status) {
    case ContentPipelineStatuses.PENDING:
      return t('admin.pipeline.stages.preparing');
    case ContentPipelineStatuses.DISCOVERING:
      return t('admin.pipeline.stages.scanningTopics');
    case ContentPipelineStatuses.CREATING_JOBS:
      if (run.discoveredTopicsCount > 0) {
        return t('admin.pipeline.stages.foundTopicsScoring', { count: run.discoveredTopicsCount });
      }
      return t('admin.pipeline.stages.scoringTopics');
    case ContentPipelineStatuses.RUNNING: {
      const jobCount = run.createdJobIds?.length ?? 0;
      if (jobCount > 0) {
        return t('admin.pipeline.stages.debatesCreatedGenerating', { count: jobCount });
      }
      return t('admin.pipeline.stages.debatesQueuedWaiting');
    }
    case ContentPipelineStatuses.PUBLISHING:
    case ContentPipelineStatuses.TWEETING:
      return t('admin.pipeline.stages.publishing');
    default:
      return '';
  }
}

export function ActiveRunProgress({ run }: { run: PipelineRun }) {
  const t = useTranslations();
  const currentIdx = getStageIndex(run.status);
  const message = getStageMessage(run.status, run, t);
  const isActive = ACTIVE_CONTENT_PIPELINE_STATUSES.has(run.status);
  const { elapsedSeconds } = useElapsedTime(isActive, { startedAt: run.startedAt ?? run.createdAt });
  const elapsed = elapsedSeconds > 0 ? formatElapsedSeconds(elapsedSeconds) : '';

  const stageLabels: Record<string, string> = {
    [ContentPipelineStatuses.CREATING_JOBS]: t('admin.pipeline.stages.scoring'),
    [ContentPipelineStatuses.DISCOVERING]: t('admin.pipeline.stages.scanning'),
    [ContentPipelineStatuses.PENDING]: t('admin.pipeline.stages.queued'),
    [ContentPipelineStatuses.RUNNING]: t('admin.pipeline.stages.running'),
  };

  return (
    <div className="space-y-2.5">
      {/* Stage dots */}
      <div className="flex items-center gap-1">
        {PIPELINE_STAGE_KEYS.map((stageKey, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={stageKey} className="flex items-center gap-1">
              {i > 0 && (
                <div className={cn(
                  'h-px w-4 transition-colors',
                  isDone ? 'bg-primary' : 'bg-white/10',
                )}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  'size-2 rounded-full transition-colors shrink-0',
                  isDone && 'bg-primary',
                  isCurrent && 'bg-primary animate-pulse',
                  !isDone && !isCurrent && 'bg-white/10',
                )}
                />
                <span className={cn(
                  'text-[10px] transition-colors',
                  isCurrent ? 'text-primary font-medium' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/40',
                )}
                >
                  {stageLabels[stageKey]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status message + elapsed time */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{message}</p>
        {elapsed && (
          <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 flex items-center gap-1">
            <Icons.clock className="size-2.5" />
            {elapsed}
          </span>
        )}
      </div>
    </div>
  );
}
