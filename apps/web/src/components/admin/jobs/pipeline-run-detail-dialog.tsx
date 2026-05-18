import { AdminPipelineStatusBadge } from '@/components/admin';
import { Icons } from '@/components/icons';
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
import { Progress } from '@/components/ui/progress';
import { useAdminPipelineRunDetailQuery } from '@/hooks/queries';
import { formatDateTimeET, formatDuration, formatMs } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import type { PipelineRun } from '@/services/api/admin/pipeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PipelineRunDetailDialogProps = {
  run: PipelineRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIRAL_DIMENSION_KEYS = [
  'hookStrength',
  'emotionalTrigger',
  'curiosityGap',
  'relevanceTimeliness',
  'engagementPotential',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineRunDetailDialog({ onOpenChange, open, run }: PipelineRunDetailDialogProps) {
  const t = useTranslations();
  const { data, isPending } = useAdminPipelineRunDetailQuery(open && run ? run.id : null);

  if (!run) {
    return null;
  }

  // Extract detail from query response — use type narrowing instead of `as` cast
  const detail = data && 'success' in data && data.success ? data.data : null;

  const discoveredTopics = detail?.discoveredTopics ?? [];
  const selectedTopics = detail?.selectedTopics ?? [];

  const selectedTopicNames = new Set(selectedTopics.map(st => st.topic));
  const rejectedTopics = discoveredTopics.filter(dt => !selectedTopicNames.has(dt.topic));

  // Discovery metadata lives inside detail.metadata
  const meta = detail?.metadata;
  const hasDiscoveryMeta = meta?.keywordsUsed || meta?.platformsSearched || meta?.totalResultsAnalyzed !== undefined || meta?.discoveryDurationMs !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AdminPipelineStatusBadge status={run.status} />
            {t('admin.pipeline.runDetails')}
          </DialogTitle>
        </DialogHeader>

        {isPending && (
          <div className="flex items-center justify-center py-8">
            <Icons.loader className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isPending && detail && (
          <div className="space-y-5">
            {/* Discovery Summary */}
            {hasDiscoveryMeta && (
              <div className="space-y-2">
                <Label>{t('admin.pipeline.discoverySummary')}</Label>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {meta?.keywordsUsed && meta.keywordsUsed.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">{t('admin.pipeline.keywords')}</span>
                      <p className="text-xs mt-0.5">{meta.keywordsUsed.join(', ')}</p>
                    </div>
                  )}
                  {meta?.platformsSearched && meta.platformsSearched.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">{t('admin.pipeline.platforms')}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {meta.platformsSearched.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {meta?.totalResultsAnalyzed !== undefined && (
                    <div>
                      <span className="text-muted-foreground text-xs">{t('admin.pipeline.resultsAnalyzed')}</span>
                      <p className="text-xs mt-0.5">{meta.totalResultsAnalyzed}</p>
                    </div>
                  )}
                  {meta?.discoveryDurationMs !== undefined && (
                    <div>
                      <span className="text-muted-foreground text-xs">{t('admin.pipeline.discoveryDuration')}</span>
                      <p className="text-xs mt-0.5">{formatMs(meta.discoveryDurationMs)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Discovered Topics */}
            {discoveredTopics.length > 0 && (
              <div className="space-y-1.5">
                <Label>
                  {t('admin.pipeline.discoveredTopicsLabel', { count: discoveredTopics.length })}
                </Label>
                <div className="space-y-1.5">
                  {discoveredTopics.map(topic => (
                    <div key={topic.topic} className="p-2 bg-muted/30 rounded-lg border border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{topic.topic}</span>
                        {topic.platform && (
                          <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                            {topic.platform}
                          </Badge>
                        )}
                        {topic.relevanceScore !== undefined && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {t('admin.pipeline.relevance')}
                            :
                            {' '}
                            {topic.relevanceScore}
                          </span>
                        )}
                      </div>
                      {topic.reasoning && (
                        <p className="text-xs text-muted-foreground mt-1">{topic.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Topics */}
            {selectedTopics.length > 0 && (
              <div className="space-y-1.5">
                <Label>
                  {t('admin.pipeline.selectedTopicsLabel', { count: selectedTopics.length })}
                </Label>
                <div className="space-y-2">
                  {selectedTopics.map(topic => (
                    <div key={topic.topic} className="p-2.5 bg-emerald-500/[0.04] rounded-lg border border-emerald-500/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{topic.topic}</span>
                        {topic.platform && (
                          <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                            {topic.platform}
                          </Badge>
                        )}
                        {topic.relevanceScore !== undefined && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {t('admin.pipeline.relevance')}
                            :
                            {' '}
                            {topic.relevanceScore}
                          </span>
                        )}
                      </div>
                      {topic.reasoning && (
                        <p className="text-xs text-muted-foreground">{topic.reasoning}</p>
                      )}

                      {/* Viral score breakdown */}
                      {(topic.viralScore !== undefined || topic.viralBreakdown) && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center gap-2">
                            <Icons.trendingUp className="size-3 text-emerald-400" />
                            <span className="text-xs font-medium">
                              {t('admin.pipeline.viralScore')}
                              :
                              {' '}
                              {topic.viralScore ?? 'N/A'}
                            </span>
                          </div>
                          {topic.viralBreakdown && (
                            <div className="grid grid-cols-1 gap-1">
                              {VIRAL_DIMENSION_KEYS.map((key) => {
                                const val = topic.viralBreakdown?.[key];
                                if (val === undefined) {
                                  return null;
                                }
                                return (
                                  <div key={key} className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground w-24 shrink-0">
                                      {t(`admin.pipeline.viralDimensions.${key}`)}
                                    </span>
                                    <Progress
                                      value={Math.min((val / 20) * 100, 100)}
                                      className="flex-1 h-1.5 bg-white/5"
                                      indicatorClassName="bg-emerald-500/60"
                                    />
                                    <span className="text-[10px] text-muted-foreground w-6 text-right tabular-nums">{val}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Viral suggestions */}
                      {topic.viralSuggestions && topic.viralSuggestions.length > 0 && (
                        <div className="pt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {t('admin.pipeline.improvementSuggestions')}
                            :
                          </span>
                          <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                            {topic.viralSuggestions.map((suggestion: string) => (
                              <li key={suggestion} className="text-[11px] text-muted-foreground">{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejected Topics */}
            {rejectedTopics.length > 0 && (
              <div className="space-y-1.5">
                <Label>
                  {t('admin.pipeline.rejectedTopicsLabel', { count: rejectedTopics.length })}
                </Label>
                <div className="space-y-1">
                  {rejectedTopics.map(topic => (
                    <div key={topic.topic} className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-white/[0.04] opacity-70">
                      <span className="text-sm">{topic.topic}</span>
                      <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 bg-amber-500/10 text-amber-400">
                        {t('admin.pipeline.belowThreshold')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">{t('admin.jobs.createdLabel')}</span>
                <p className="text-xs mt-0.5">{formatDateTimeET(run.createdAt)}</p>
              </div>
              {run.startedAt && run.completedAt && (
                <div>
                  <span className="text-muted-foreground text-xs">{t('admin.pipeline.durationLabel')}</span>
                  <p className="text-xs mt-0.5">{formatDuration(run.startedAt, run.completedAt)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!isPending && !detail && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('admin.pipeline.noDetailData')}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
