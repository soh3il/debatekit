import { AdminItemError, AdminJobStatusBadge, AdminModelBadge } from '@/components/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatDateTimeET } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { getJobCompletedAt, getJobErrorMessage, getJobStartedAt } from '@/lib/utils/job-metadata';
import type { AutomatedJob } from '@/services/api';

type JobDetailDialogProps = {
  job: AutomatedJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function JobDetailDialog({ job, onOpenChange, open }: JobDetailDialogProps) {
  const t = useTranslations();

  if (!job) {
    return null;
  }

  const errorMessage = getJobErrorMessage(job);
  const startedAt = getJobStartedAt(job);
  const completedAt = getJobCompletedAt(job);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AdminJobStatusBadge status={job.status} />
            {t('admin.jobs.details')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt */}
          <div className="space-y-1.5">
            <Label>{t('admin.jobs.prompt')}</Label>
            <div className="p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
              {job.initialPrompt}
            </div>
          </div>

          {/* Rounds */}
          <div className="flex items-center gap-4">
            <Label className="shrink-0">{t('admin.jobs.rounds')}</Label>
            <span className="text-sm">
              {job.currentRound + 1}
              {' '}
              /
              {job.totalRounds}
            </span>
          </div>

          {/* Models */}
          {job.selectedModels && job.selectedModels.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('admin.jobs.models')}</Label>
              <div className="flex flex-wrap gap-1">
                {job.selectedModels.map((model: string) => (
                  <AdminModelBadge key={model} modelId={model} />
                ))}
              </div>
            </div>
          )}

          {/* Prompt Reasoning */}
          {job.metadata?.promptReasoning && (
            <div className="space-y-1.5">
              <Label>{t('admin.jobs.aiReasoning')}</Label>
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground whitespace-pre-wrap">
                {job.metadata.promptReasoning}
              </div>
            </div>
          )}

          {/* Round Details */}
          {job.metadata?.roundPrompts && job.metadata.roundPrompts.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('admin.jobs.roundDetails')}</Label>
              <div className="space-y-2">
                {job.metadata.roundPrompts.map((prompt, i) => {
                  const config = job.metadata?.roundConfigs?.[i];
                  return (
                    <div key={`round-${String(i)}`} className="p-2.5 bg-muted/30 rounded-lg border border-white/[0.06] space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {t('admin.jobs.roundLabel', { number: i + 1 })}
                        </span>
                        {config && (
                          <>
                            <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                              {config.mode}
                            </Badge>
                            {config.enableWebSearch && (
                              <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-chart-4/80 border-chart-4/20">
                                {t('admin.jobs.webSearch')}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">{prompt}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('admin.jobs.createdLabel')}</span>
              <p>{formatDateTimeET(job.createdAt)}</p>
            </div>
            {startedAt && (
              <div>
                <span className="text-muted-foreground">{t('admin.jobs.startedAt')}</span>
                <p>{formatDateTimeET(startedAt)}</p>
              </div>
            )}
            {completedAt && (
              <div>
                <span className="text-muted-foreground">{t('admin.jobs.completedAt')}</span>
                <p>{formatDateTimeET(completedAt)}</p>
              </div>
            )}
          </div>

          {/* Error message */}
          {job.status === 'failed' && errorMessage && (
            <AdminItemError message={errorMessage} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
