import type { ContentPipelineStatus } from '@debatekit/shared/enums';
import { ACTIVE_CONTENT_PIPELINE_STATUSES, ContentPipelineStatuses } from '@debatekit/shared/enums';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import {
  AdminContentList,
  AdminEmptyState,
  AdminSectionCard,
} from '@/components/admin';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { useCancelPipelineRunMutation } from '@/hooks/mutations';
import { useAdminPipelineRunsInfiniteQuery, useAdminSettingsQuery } from '@/hooks/queries';
import { useAdminInfiniteScroll } from '@/hooks/utils/use-admin-infinite-scroll';
import { useTranslations } from '@/lib/i18n';
import type { PipelineRun } from '@/services/api/admin/pipeline';

import { PipelineReviewDialog } from './pipeline-review-dialog';
import { PipelineRunCard } from './pipeline-run-card';
import { PipelineRunDetailDialog } from './pipeline-run-detail-dialog';

// ---------------------------------------------------------------------------
// Constants – Pipeline Filter (5-part enum, UI-specific)
// ---------------------------------------------------------------------------

const PIPELINE_FILTER_VALUES = ['active', 'all', 'cancelled', 'completed', 'failed'] as const;
const PipelineFilterSchema = z.enum(PIPELINE_FILTER_VALUES);
type PipelineFilter = z.infer<typeof PipelineFilterSchema>;
const PipelineFilters = { ACTIVE: 'active', ALL: 'all', CANCELLED: 'cancelled', COMPLETED: 'completed', FAILED: 'failed' } as const;
const DEFAULT_PIPELINE_FILTER: PipelineFilter = PipelineFilters.ALL;

const PIPELINE_FILTER_STATUSES: Record<PipelineFilter, Set<ContentPipelineStatus> | null> = {
  active: ACTIVE_CONTENT_PIPELINE_STATUSES,
  all: null,
  cancelled: new Set([ContentPipelineStatuses.CANCELLED]),
  completed: new Set([ContentPipelineStatuses.COMPLETED]),
  failed: new Set([ContentPipelineStatuses.FAILED]),
};

// ---------------------------------------------------------------------------
// PipelineRunsContent
// ---------------------------------------------------------------------------

export function PipelineRunsContent() {
  const t = useTranslations();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
  } = useAdminPipelineRunsInfiniteQuery();
  const cancelMutation = useCancelPipelineRunMutation();
  const { data: settingsData } = useAdminSettingsQuery();
  const settings = settingsData && 'success' in settingsData && settingsData.success ? settingsData.data : null;
  const qualityThreshold = settings?.viralScoreThreshold ?? 60;
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>(DEFAULT_PIPELINE_FILTER);
  const [detailRun, setDetailRun] = useState<PipelineRun | null>(null);
  const [reviewRun, setReviewRun] = useState<PipelineRun | null>(null);
  const { scrollRef } = useAdminInfiniteScroll({ fetchNextPage, hasNextPage, isFetchingNextPage });

  const allRuns = useMemo(
    () => data?.pages.flatMap(page => page.data.runs) ?? [],
    [data],
  );

  // Compute counts per filter bucket
  const filterCounts = useMemo(() => {
    let active = 0;
    let cancelled = 0;
    let completed = 0;
    let failed = 0;

    for (const run of allRuns) {
      if (ACTIVE_CONTENT_PIPELINE_STATUSES.has(run.status)) {
        active++;
      } else if (run.status === ContentPipelineStatuses.COMPLETED) {
        completed++;
      } else if (run.status === ContentPipelineStatuses.FAILED) {
        failed++;
      } else if (run.status === ContentPipelineStatuses.CANCELLED) {
        cancelled++;
      }
    }

    return {
      active,
      all: allRuns.length,
      cancelled,
      completed,
      failed,
    };
  }, [allRuns]);

  const runs = useMemo(() => {
    const allowedStatuses = PIPELINE_FILTER_STATUSES[pipelineFilter];
    if (!allowedStatuses) {
      return allRuns;
    }
    return allRuns.filter(run => allowedStatuses.has(run.status));
  }, [allRuns, pipelineFilter]);

  const handleCancel = (id: string) => {
    cancelMutation.mutate(id);
  };

  const pipelineFilterTabs = useMemo(() => [
    { count: filterCounts.all, label: t('admin.pipeline.filter.all'), value: 'all' },
    { count: filterCounts.active, label: t('admin.pipeline.filter.active'), value: 'active' },
    { count: filterCounts.completed, label: t('admin.pipeline.filter.completed'), value: 'completed' },
    { count: filterCounts.failed, label: t('admin.pipeline.filter.failed'), value: 'failed' },
    { count: filterCounts.cancelled, label: t('admin.pipeline.filter.cancelled'), value: 'cancelled' },
  ], [filterCounts, t]);

  return (
    <>
      <AdminContentList
        allItemCount={allRuns.length}
        filteredItemCount={runs.length}
        isPending={isPending}
        isError={isError}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        scrollRef={scrollRef}
        scrollClassName="h-[340px]"
        errorMessage={t('admin.pipeline.loadError')}
        noResultsMessage={t('admin.pipeline.noFilterResults')}
        endOfListText={t('admin.pipeline.endOfList')}
        filterTabs={pipelineFilterTabs}
        filterValue={pipelineFilter}
        onFilterChange={(v) => {
          const parsed = PipelineFilterSchema.safeParse(v);
          if (parsed.success) {
            setPipelineFilter(parsed.data);
          }
        }}
        emptyState={(
          <AdminEmptyState
            className="min-h-[120px] border-0"
            description={t('admin.pipeline.noRunsEmptyDescription')}
            icon={<Icons.zap />}
            title={t('admin.pipeline.noRunsEmpty')}
          />
        )}
      >
        {runs.map(run => (
          <PipelineRunCard
            key={run.id}
            onCancel={handleCancel}
            onDetails={setDetailRun}
            onReview={setReviewRun}
            qualityThreshold={qualityThreshold}
            run={run}
          />
        ))}
      </AdminContentList>

      <PipelineRunDetailDialog
        run={detailRun}
        open={!!detailRun}
        onOpenChange={open => !open && setDetailRun(null)}
      />

      <PipelineReviewDialog
        run={reviewRun}
        open={!!reviewRun}
        onOpenChange={open => !open && setReviewRun(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// PipelineRunsSection
// ---------------------------------------------------------------------------

export function PipelineRunsSection() {
  const t = useTranslations();

  return (
    <AdminSectionCard
      description={t('admin.pipeline.description')}
      icon={<Icons.zap className="size-4" />}
      title={t('admin.pipeline.title')}
      titleExtra={<Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">{t('admin.pipeline.stepBadge', { step: 1 })}</Badge>}
    >
      <PipelineRunsContent />
    </AdminSectionCard>
  );
}
