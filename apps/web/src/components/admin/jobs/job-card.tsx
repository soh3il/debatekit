import type { AutomatedJobStatus } from '@debatekit/shared/enums';
import { AutomatedJobStatuses } from '@debatekit/shared/enums';

import {
  AdminActionButton,
  AdminActionRow,
  AdminDeleteButton,
  AdminDetailsButton,
  AdminExternalLinkButton,
  AdminItemCard,
  AdminItemError,
  AdminJobStatusBadge,
  AdminViewThreadButton,
} from '@/components/admin';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useUpdateJobMutation } from '@/hooks/mutations';
import { useElapsedTime } from '@/hooks/utils';
import { formatDateET, formatDuration, formatElapsedSeconds } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui';
import { getProviderIcon } from '@/lib/utils';
import type { AutomatedJob } from '@/services/api';

// ---------------------------------------------------------------------------
// Status border helper
// ---------------------------------------------------------------------------

const JOB_STATUS_BORDER: Record<AutomatedJobStatus, string> = {
  [AutomatedJobStatuses.CANCELLED]: 'border-l-2 border-l-destructive/50 opacity-60',
  [AutomatedJobStatuses.COMPLETED]: 'border-l-2 border-l-chart-3',
  [AutomatedJobStatuses.FAILED]: 'border-l-2 border-l-destructive',
  [AutomatedJobStatuses.PENDING]: 'border-l-2 border-l-amber-500',
  [AutomatedJobStatuses.RUNNING]: 'border-l-2 border-l-primary',
};

// ---------------------------------------------------------------------------
// JobCard
// ---------------------------------------------------------------------------

export type JobCardProps = {
  job: AutomatedJob;
  onDelete: (job: AutomatedJob) => void;
  onViewDetails: (job: AutomatedJob) => void;
};

export function JobCard({
  job,
  onDelete,
  onViewDetails,
}: JobCardProps) {
  const t = useTranslations();
  const updateMutation = useUpdateJobMutation();

  const handleRetry = () => {
    updateMutation.mutate({
      json: { status: AutomatedJobStatuses.RUNNING },
      param: { id: job.id },
    });
  };

  const handleTogglePublic = () => {
    updateMutation.mutate({
      json: { isPublic: true },
      param: { id: job.id },
    });
  };

  const isRunning = job.status === AutomatedJobStatuses.RUNNING;
  const { elapsedSeconds } = useElapsedTime(isRunning, { startedAt: job.createdAt });
  const elapsed = isRunning && elapsedSeconds > 0 ? formatElapsedSeconds(elapsedSeconds) : '';

  const canRetry = job.status === AutomatedJobStatuses.FAILED;
  const errorMessage = job.metadata?.errorMessage;
  const statusBorderClass = JOB_STATUS_BORDER[job.status];
  const progressPercent = job.totalRounds > 0 ? Math.round((job.currentRound / job.totalRounds) * 100) : 0;

  return (
    <AdminItemCard className={statusBorderClass}>
      {/* Header: Prompt + Status */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-2">{job.initialPrompt}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            <span>{formatDateET(job.createdAt)}</span>
            {(!job.selectedModels || job.selectedModels.length === 0) && (
              <>
                <span>&middot;</span>
                <span>{t('admin.jobs.modelsCount', { count: 0 })}</span>
              </>
            )}
            {job.autoPublish && (
              <>
                <span>&middot;</span>
                <span className="flex items-center gap-1">
                  <Icons.globe className="size-3" />
                  {t('admin.jobs.autoPublish')}
                </span>
              </>
            )}
          </div>
        </div>
        <AdminJobStatusBadge status={job.status} />
      </div>

      {/* Model avatars */}
      {job.selectedModels && job.selectedModels.length > 0 && (
        <div className="flex items-center" title={job.selectedModels.join(', ')}>
          {job.selectedModels.slice(0, 5).map((model, index) => {
            const provider = model.includes('/') ? (model.split('/')[0] || 'unknown') : 'unknown';
            return (
              <div
                key={model}
                className="relative"
                style={{ marginLeft: index === 0 ? 0 : -6, zIndex: index + 1 }}
              >
                <Avatar className="size-6 border-2 border-card bg-card">
                  <AvatarImage
                    src={getProviderIcon(provider)}
                    alt={model}
                    className="object-contain p-0.5"
                  />
                  <AvatarFallback className="text-[8px] bg-card font-semibold">
                    {(model.split('/')[1] ?? model).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            );
          })}
          {job.selectedModels.length > 5 && (
            <div
              className="relative flex items-center justify-center size-6 rounded-full bg-card border-2 border-card text-[10px] font-medium text-muted-foreground"
              style={{ marginLeft: -6, zIndex: 6 }}
            >
              +
              {job.selectedModels.length - 5}
            </div>
          )}
        </div>
      )}

      {/* Completion summary for completed jobs */}
      {job.status === AutomatedJobStatuses.COMPLETED && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1.5">
            <Icons.check className="size-3 text-chart-3" />
            {t('admin.jobs.roundsCompleted', { count: job.totalRounds })}
          </span>
          <span className="flex items-center gap-1">
            <Icons.clock className="size-3" />
            {formatDuration(job.createdAt, job.updatedAt)}
          </span>
          {job.autoPublish && (
            <span className="flex items-center gap-1">
              <Icons.globe className="size-3" />
              {t('admin.jobs.autoPublished')}
            </span>
          )}
        </div>
      )}

      {/* Progress for running jobs */}
      {job.status === AutomatedJobStatuses.RUNNING && (
        <div className="space-y-2">
          {/* Round step dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: job.totalRounds }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'size-2 rounded-full transition-colors',
                  i < job.currentRound
                    ? 'bg-chart-3'
                    : i === job.currentRound
                      ? 'bg-primary animate-pulse'
                      : 'bg-muted-foreground/20',
                )}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">
              {job.currentRound + 1}
              /
              {job.totalRounds}
            </span>
          </div>
          {/* Progress bar */}
          <Progress value={progressPercent} className="h-1" />
          {/* Status line */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icons.loader className="size-3 animate-spin" />
              {t('admin.jobs.generatingRound', { number: job.currentRound + 1 })}
            </span>
            {elapsed && (
              <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 flex items-center gap-1">
                <Icons.clock className="size-2.5" />
                {elapsed}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error message for failed jobs */}
      {job.status === AutomatedJobStatuses.FAILED && errorMessage && (
        <AdminItemError message={errorMessage} />
      )}

      {/* Actions */}
      <AdminActionRow>
        {canRetry && (
          <AdminActionButton
            disabled={updateMutation.isPending}
            icon={updateMutation.isPending
              ? <Icons.loader className="size-3.5 animate-spin" />
              : <Icons.refreshCw className="size-3.5" />}
            label={t('admin.jobs.retry')}
            onClick={handleRetry}
          />
        )}

        {job.threadSlug && job.status === AutomatedJobStatuses.COMPLETED && (
          <AdminViewThreadButton href={`/chat/${job.threadSlug}`} label={t('admin.jobs.viewThread')} />
        )}

        <AdminDetailsButton label={t('admin.jobs.details')} onClick={() => onViewDetails(job)} />

        {job.status === AutomatedJobStatuses.COMPLETED && job.threadId && !job.isPublic && (
          <AdminActionButton
            disabled={updateMutation.isPending}
            icon={<Icons.globe className="size-3.5" />}
            label={t('admin.jobs.publish')}
            onClick={handleTogglePublic}
          />
        )}

        {job.status === AutomatedJobStatuses.COMPLETED && job.threadSlug && job.isPublic && (
          <AdminExternalLinkButton
            href={`/public/chat/${job.threadSlug}`}
            label={t('accessibility.openPublicThread')}
          />
        )}

        <AdminDeleteButton label={t('actions.delete')} onClick={() => onDelete(job)} />
      </AdminActionRow>
    </AdminItemCard>
  );
}
