import { ACTIVE_CONTENT_PIPELINE_STATUSES, AutomatedJobStatuses, ScheduledTweetStatuses } from '@debatekit/shared/enums';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  AdminContentList,
  AdminEmptyState,
  AdminSectionCard,
} from '@/components/admin';
import { FlowConnector, StepBadge } from '@/components/admin/admin-flow';
import { JobCard } from '@/components/admin/jobs/job-card';
import { JobCreateDialog } from '@/components/admin/jobs/job-create-dialog';
import { JobDeleteDialog } from '@/components/admin/jobs/job-delete-dialog';
import { JobDetailDialog } from '@/components/admin/jobs/job-detail-dialog';
import type { StatusFilter } from '@/components/admin/jobs/jobs.constants';
import { DEFAULT_STATUS_FILTER, getNextRunTime, StatusFilterSchema } from '@/components/admin/jobs/jobs.constants';
import { PipelineRunDialog } from '@/components/admin/jobs/pipeline-run-dialog';
import { PipelineRunsContent } from '@/components/admin/jobs/pipeline-runs-section';
import { StatusStrip } from '@/components/admin/jobs/status-strip';
import { TrendDiscoveryDialog } from '@/components/admin/jobs/trend-discovery-dialog';
import { SocialChannelsContent } from '@/components/admin/jobs/tweets-section';
import { Form } from '@/components/forms';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useCancelPipelineRunMutation, useUpdateAdminSettingsMutation } from '@/hooks/mutations';
import { useAdminJobsInfiniteQuery, useAdminPipelineRunsInfiniteQuery, useAdminSettingsQuery, useAdminTweetsInfiniteQuery } from '@/hooks/queries';
import { useAdminInfiniteScroll } from '@/hooks/utils/use-admin-infinite-scroll';
import { formatRelativeTime } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';
import type { AutomatedJob } from '@/services/api';
import type { PipelineRun } from '@/services/api/admin/pipeline';
import type { AdminSettingsFormValues } from '@/services/api/admin/settings';
import { ADMIN_SETTINGS_DEFAULTS, AdminSettingsFormSchema } from '@/services/api/admin/settings';

export function AdminJobsScreen() {
  const t = useTranslations();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trendDialogOpen, setTrendDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<AutomatedJob | null>(null);
  const [detailJob, setDetailJob] = useState<AutomatedJob | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATUS_FILTER);
  const [runDialogMode, setRunDialogMode] = useState<'continuous' | 'once' | null>(null);
  const [createPostOpen, setCreatePostOpen] = useState(false);

  // Data queries
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
  } = useAdminJobsInfiniteQuery();

  const tweetsQuery = useAdminTweetsInfiniteQuery();
  const { data: settingsData, isLoading: settingsLoading } = useAdminSettingsQuery();
  const pipelineRunsQuery = useAdminPipelineRunsInfiniteQuery();
  const cancelMutation = useCancelPipelineRunMutation();
  const updateSettingsMutation = useUpdateAdminSettingsMutation();

  const { scrollRef } = useAdminInfiniteScroll({ fetchNextPage, hasNextPage, isFetchingNextPage });

  const allJobs = useMemo(() => data?.pages.flatMap(page => page.data.jobs) ?? [], [data]);

  const jobs = statusFilter === 'all'
    ? allJobs
    : allJobs.filter(job => job.status === statusFilter);

  // Settings
  const settings = settingsData && 'success' in settingsData && settingsData.success ? settingsData.data : null;
  const pipelineEnabled = settings?.pipelineEnabled ?? false;

  const settingsValues = settings
    ? {
        autoTweetEnabled: settings.autoTweetEnabled,
        dailyJobLimit: settings.dailyJobLimit,
        dailyTweetLimit: settings.dailyTweetLimit,
        defaultRoundCount: settings.defaultRoundCount,
        keywordGenerationPrompt: settings.keywordGenerationPrompt ?? '',
        modelSelectionPrompt: settings.modelSelectionPrompt ?? '',
        participantBehaviorPrompt: settings.participantBehaviorPrompt ?? '',
        pipelineEnabled: settings.pipelineEnabled,
        roundPromptGeneration: settings.roundPromptGeneration ?? '',
        systemPrompt: settings.systemPrompt,
        topicGuidance: settings.topicGuidance,
        trendExtractionPrompt: settings.trendExtractionPrompt ?? '',
        tweetSkillsPrompt: settings.tweetSkillsPrompt ?? '',
        tweetSystemPrompt: settings.tweetSystemPrompt ?? '',
        viralScoreThreshold: settings.viralScoreThreshold,
        viralScoringPrompt: settings.viralScoringPrompt ?? '',
      }
    : undefined;

  const form = useForm<AdminSettingsFormValues>({
    defaultValues: settingsValues ?? ADMIN_SETTINGS_DEFAULTS,
    resolver: zodResolver(AdminSettingsFormSchema),
    values: settingsValues,
  });

  // Pipeline runs
  const allRuns = useMemo(
    () => pipelineRunsQuery.data?.pages.flatMap(page => page.data.runs) ?? [],
    [pipelineRunsQuery.data],
  );

  const activeRuns = useMemo(
    () => allRuns.filter((run: PipelineRun) => ACTIVE_CONTENT_PIPELINE_STATUSES.has(run.status)),
    [allRuns],
  );

  const lastCompletedRun = useMemo(
    () => allRuns.find((run: PipelineRun) => run.completedAt),
    [allRuns],
  );

  const hasActiveRuns = activeRuns.length > 0;

  // Stats (job counts + sent tweet count)
  const allTweets = useMemo(
    () => tweetsQuery.data?.pages.flatMap(page => page.data.tweets) ?? [],
    [tweetsQuery.data],
  );
  const stats = useMemo(() => {
    let running = 0;
    let completed = 0;
    let failed = 0;
    let pending = 0;
    for (const j of allJobs) {
      if (j.status === AutomatedJobStatuses.RUNNING) {
        running++;
      } else if (j.status === AutomatedJobStatuses.COMPLETED) {
        completed++;
      } else if (j.status === AutomatedJobStatuses.FAILED) {
        failed++;
      } else if (j.status === AutomatedJobStatuses.PENDING) {
        pending++;
      }
    }
    const sent = allTweets.filter(tw => tw.status === ScheduledTweetStatuses.SENT).length;
    return { completed, failed, pending, running, sent };
  }, [allJobs, allTweets]);

  // Schedule text
  const scheduleText = useMemo(() => {
    const isRunning = hasActiveRuns || stats.running > 0;
    if (isRunning) {
      const activeRun = activeRuns[0];
      return `${t('admin.jobs.runningNow')}${activeRun?.startedAt ? ` · ${t('admin.jobs.startedAgo', { time: formatRelativeTime(activeRun.startedAt) })}` : ''}`;
    }
    if (pipelineEnabled) {
      const nextRun = lastCompletedRun?.completedAt ? getNextRunTime(lastCompletedRun.completedAt) : null;
      return `${t('admin.jobs.autoRunEnabled')}${nextRun ? ` · ${t('admin.jobs.nextRun', { time: nextRun })}` : ''}`;
    }
    return t('admin.jobs.autoRunOff');
  }, [hasActiveRuns, stats.running, activeRuns, pipelineEnabled, lastCompletedRun, t]);

  // Stage detail strings
  const discoverDetail = useMemo(() => {
    if (hasActiveRuns) {
      return t('admin.jobs.stageDetail.running');
    }
    if (lastCompletedRun) {
      return t('admin.jobs.stageDetail.lastRun', { time: formatRelativeTime(lastCompletedRun.completedAt ?? lastCompletedRun.createdAt) });
    }
    return t('admin.jobs.stageDetail.noRunsYet');
  }, [hasActiveRuns, lastCompletedRun, t]);

  const generateActive = stats.running + stats.pending > 0;
  const generateDetail = useMemo(() => {
    const active = stats.running + stats.pending;
    if (active > 0) {
      return t('admin.jobs.stageDetail.activeRunning', { count: active });
    }
    if (stats.failed > 0 && stats.completed > 0) {
      return t('admin.jobs.stageDetail.doneAndFailed', { done: stats.completed, failed: stats.failed });
    }
    if (stats.failed > 0) {
      return t('admin.jobs.stageDetail.failedCount', { count: stats.failed });
    }
    if (stats.completed > 0) {
      return t('admin.jobs.stageDetail.completedCount', { count: stats.completed });
    }
    return t('admin.jobs.stageDetail.noDebates');
  }, [stats, t]);

  // Publish stage -- active when tweets are scheduled (in-flight)
  const scheduledTweetCount = useMemo(
    () => allTweets.filter(tw => tw.status === ScheduledTweetStatuses.SCHEDULED).length,
    [allTweets],
  );
  const publishActive = scheduledTweetCount > 0;
  const publishDetail = useMemo(() => {
    if (scheduledTweetCount > 0) {
      return t('admin.jobs.stageDetail.scheduledCount', { count: scheduledTweetCount });
    }
    if (stats.sent > 0) {
      return t('admin.jobs.stageDetail.postedCount', { count: stats.sent });
    }
    return t('admin.jobs.stageDetail.noPosts');
  }, [scheduledTweetCount, stats.sent, t]);

  const handleStop = async () => {
    try {
      await updateSettingsMutation.mutateAsync(
        { json: { continuous: false, pipelineEnabled: false } },
      );
      await Promise.all(
        activeRuns.map(run => cancelMutation.mutateAsync(run.id)),
      );
      toastManager.success(t('admin.jobs.automationStopped'));
    } catch {
      toastManager.error(t('admin.jobs.automationStopError'));
    }
  };

  const isStopping = cancelMutation.isPending || updateSettingsMutation.isPending;

  // Settings save
  const handleSaveSettings = useCallback((values: AdminSettingsFormValues) => {
    updateSettingsMutation.mutate(
      { json: values },
      {
        onError: () => toastManager.error(t('admin.settings.settingsError')),
        onSuccess: () => toastManager.success(t('admin.settings.settingsUpdated')),
      },
    );
  }, [updateSettingsMutation, t]);

  const handleDeleteClick = (job: AutomatedJob) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = (job: AutomatedJob) => {
    setDetailJob(job);
  };

  const jobFilterTabs = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: allJobs.length, cancelled: 0, completed: 0, failed: 0, pending: 0, running: 0 };
    for (const j of allJobs) {
      const parsed = StatusFilterSchema.safeParse(j.status);
      if (parsed.success) {
        counts[parsed.data]++;
      }
    }
    return [
      { count: counts.all, label: t('admin.jobs.filter.all'), value: 'all' },
      { count: counts.pending, label: t('admin.jobs.filter.pending'), value: 'pending' },
      { count: counts.running, label: t('admin.jobs.filter.running'), value: 'running' },
      { count: counts.completed, label: t('admin.jobs.filter.completed'), value: 'completed' },
      { count: counts.failed, label: t('admin.jobs.filter.failed'), value: 'failed' },
    ];
  }, [allJobs, t]);

  const isDirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSaveSettings)}
        className="mx-auto w-full max-w-5xl flex flex-1 flex-col gap-5 p-4 lg:p-8"
      >
        {/* -- Status Strip -- */}
        <StatusStrip
          discoverDetail={discoverDetail}
          generateActive={generateActive}
          generateDetail={generateDetail}
          hasActiveRuns={hasActiveRuns}
          isDirty={isDirty}
          isSaving={updateSettingsMutation.isPending}
          isStopping={isStopping}
          onRunNow={() => setRunDialogMode('once')}
          onStop={handleStop}
          pipelineEnabled={pipelineEnabled}
          publishActive={publishActive}
          publishDetail={publishDetail}
          scheduleText={scheduleText}
          settings={!!settings}
          settingsLoading={settingsLoading}
        />

        <FlowConnector />

        {/* ===== STEP 1: DISCOVER ===== */}
        <AdminSectionCard
          icon={<Icons.search className="size-4" />}
          title={t('admin.jobs.discoverTopics')}
          description={t('admin.jobs.discoverTopicsDescription')}
          titleExtra={<StepBadge step={1} />}
          actions={(
            <Button size="sm" variant="glass" onClick={() => setTrendDialogOpen(true)} startIcon={<Icons.search />}>
              {t('admin.jobs.trends.title')}
            </Button>
          )}
        >
          <PipelineRunsContent />
        </AdminSectionCard>

        <FlowConnector />

        {/* ===== STEP 2: GENERATE ===== */}
        <AdminSectionCard
          icon={<Icons.sparkles className="size-4" />}
          title={t('admin.jobs.title')}
          description={t('admin.jobs.generateDescription')}
          titleExtra={<StepBadge step={2} />}
          actions={(
            <Button size="sm" variant="glass" onClick={() => setCreateDialogOpen(true)} startIcon={<Icons.plus />}>
              {t('admin.jobs.create')}
            </Button>
          )}
        >
          <AdminContentList
            allItemCount={allJobs.length}
            filteredItemCount={jobs.length}
            isPending={isLoading}
            isError={isError}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            scrollRef={scrollRef}
            scrollClassName="h-[420px]"
            errorMessage={t('admin.jobs.loadError')}
            noResultsMessage={t('admin.jobs.noFilterResults')}
            endOfListText={t('admin.jobs.endOfList')}
            filterTabs={jobFilterTabs}
            filterValue={statusFilter}
            onFilterChange={(v) => {
              const parsed = StatusFilterSchema.safeParse(v);
              if (parsed.success) {
                setStatusFilter(parsed.data);
              }
            }}
            emptyState={(
              <AdminEmptyState
                className="min-h-[140px]"
                actionIcon={<Icons.plus />}
                actionLabel={t('admin.jobs.create')}
                description={t('admin.jobs.noDebatesEmptyDescription')}
                icon={<Icons.sparkles />}
                onAction={() => setCreateDialogOpen(true)}
                title={t('admin.jobs.noDebatesEmpty')}
              />
            )}
          >
            {jobs.map((job: AutomatedJob) => (
              <JobCard
                key={job.id}
                job={job}
                onDelete={handleDeleteClick}
                onViewDetails={handleViewDetails}
              />
            ))}
          </AdminContentList>
        </AdminSectionCard>

        <FlowConnector />

        {/* ===== STEP 3: PUBLISH ===== */}
        <AdminSectionCard
          icon={<Icons.share className="size-4" />}
          title={t('admin.jobs.publishToSocial')}
          description={t('admin.jobs.publishDescription')}
          titleExtra={<StepBadge step={3} />}
          actions={(
            <Button size="sm" variant="glass" onClick={() => setCreatePostOpen(true)} startIcon={<Icons.plus />}>
              {t('admin.tweets.newPost')}
            </Button>
          )}
        >
          <SocialChannelsContent createDialogOpen={createPostOpen} setCreateDialogOpen={setCreatePostOpen} />
        </AdminSectionCard>

        {/* Dialogs */}
        <JobCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
        <JobDeleteDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} job={jobToDelete} />
        <TrendDiscoveryDialog open={trendDialogOpen} onOpenChange={setTrendDialogOpen} />
        <JobDetailDialog job={detailJob} open={!!detailJob} onOpenChange={open => !open && setDetailJob(null)} />
        <PipelineRunDialog
          open={runDialogMode !== null}
          onOpenChange={(open) => {
            if (!open) {
              setRunDialogMode(null);
            }
          }}
          enableAutomation={runDialogMode === 'continuous'}
        />
      </form>
    </Form>
  );
}
