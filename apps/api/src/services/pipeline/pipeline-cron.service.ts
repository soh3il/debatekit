/**
 * Pipeline Cron Service
 *
 * Detects stale pipeline runs stuck in active states and transitions them
 * to completed or failed based on their associated job statuses.
 *
 * This closes the gap where a pipeline creates jobs and moves to 'running',
 * but nothing ever transitions it to 'completed' once all jobs finish.
 */

import {
  ACTIVE_CONTENT_PIPELINE_STATUSES,
  AutomatedJobStatuses,
  ContentPipelineStatuses,
  ContentPipelineTriggerTypes,
  RoundOrchestrationMessageTypes,
} from '@debatekit/shared/enums';
import { and, eq, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';

import type { getDbAsync } from '@/db';
import * as tables from '@/db';
import { log } from '@/lib/logger';
import { ADMIN_SETTING_DEFAULTS, AdminSettingKeys } from '@/routes/admin/settings/schema';
import type { RunContentPipelineQueueMessage } from '@/types/queues';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Pipeline stuck in an active state longer than this is considered timed out */
const STALE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Pre-running phases (discovering/creating_jobs) get a shorter timeout */
const PRE_RUNNING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/** Statuses that represent pre-running phases (no jobs created yet) */
const PRE_RUNNING_STATUSES: string[] = [
  ContentPipelineStatuses.DISCOVERING,
  ContentPipelineStatuses.CREATING_JOBS,
];

/** Active pipeline statuses that should be checked for staleness */
const ACTIVE_PIPELINE_STATUSES = [
  ContentPipelineStatuses.DISCOVERING,
  ContentPipelineStatuses.CREATING_JOBS,
  ContentPipelineStatuses.RUNNING,
  ContentPipelineStatuses.PUBLISHING,
  ContentPipelineStatuses.TWEETING,
] as const;

// ============================================================================
// TYPES
// ============================================================================

type Db = Awaited<ReturnType<typeof getDbAsync>>;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check for stale pipeline runs and transition them based on job statuses.
 *
 * Rules:
 * 1. ALL jobs completed -> pipeline completed
 * 2. ANY job failed AND NO jobs running/pending -> pipeline failed
 * 3. Pipeline active > 4 hours with no running/pending jobs -> pipeline failed (timeout)
 *
 * @returns Count of pipelines transitioned
 */
export async function checkStalePipelineRuns(db: Db, env?: CloudflareEnv) {
  const activePipelines = await db
    .select()
    .from(tables.contentPipelineRun)
    .where(inArray(tables.contentPipelineRun.status, [...ACTIVE_PIPELINE_STATUSES]))
    .all();

  if (activePipelines.length === 0) {
    log.info('[PipelineCron] No active pipeline runs found');
    return 0;
  }

  log.info(`[PipelineCron] Found ${activePipelines.length} active pipeline run(s) to check`);

  let transitioned = 0;

  for (const pipeline of activePipelines) {
    const jobIds = pipeline.createdJobIds ?? [];
    const isPreRunning = PRE_RUNNING_STATUSES.includes(pipeline.status);

    // Pre-running phases (discovering/creating_jobs) with 10-min timeout
    if (isPreRunning) {
      const updatedAt = pipeline.updatedAt?.getTime() ?? pipeline.createdAt.getTime();
      const elapsed = Date.now() - updatedAt;

      if (elapsed > PRE_RUNNING_TIMEOUT_MS) {
        const mins = Math.round(elapsed / (60 * 1000));
        log.info(
          `[PipelineCron] Pipeline ${pipeline.id}: stuck in ${pipeline.status} for ${mins}m, marking failed`,
        );
        await transitionPipeline(
          db,
          pipeline.id,
          ContentPipelineStatuses.FAILED,
          `Pipeline timed out in ${pipeline.status} phase after ${mins}m`,
        );
        transitioned++;
      }
      continue;
    }

    // Pipeline with no jobs that is still active - mark completed
    if (jobIds.length === 0) {
      await transitionPipeline(db, pipeline.id, ContentPipelineStatuses.COMPLETED);
      transitioned++;

      // Re-trigger pipeline if continuous mode is enabled
      if (env) {
        await maybeTriggerContinuousPipeline(db, env);
      }

      continue;
    }

    // Load all associated jobs
    const jobs = await db
      .select()
      .from(tables.automatedJob)
      .where(inArray(tables.automatedJob.id, jobIds))
      .all();

    const allCompleted = jobs.length > 0 && jobs.every(
      j => j.status === AutomatedJobStatuses.COMPLETED,
    );
    const hasRunningOrPending = jobs.some(
      j => j.status === AutomatedJobStatuses.RUNNING || j.status === AutomatedJobStatuses.PENDING,
    );
    const hasFailed = jobs.some(j => j.status === AutomatedJobStatuses.FAILED);

    // Rule 1: All jobs completed
    if (allCompleted) {
      log.info(`[PipelineCron] Pipeline ${pipeline.id}: all ${jobs.length} jobs completed`);
      await transitionPipeline(db, pipeline.id, ContentPipelineStatuses.COMPLETED);
      transitioned++;

      // Re-trigger pipeline if continuous mode is enabled
      if (env) {
        await maybeTriggerContinuousPipeline(db, env);
      }

      continue;
    }

    // Rule 2: Any failed + no active jobs
    if (hasFailed && !hasRunningOrPending) {
      const failedCount = jobs.filter(j => j.status === AutomatedJobStatuses.FAILED).length;
      log.info(
        `[PipelineCron] Pipeline ${pipeline.id}: ${failedCount} job(s) failed, no active jobs remaining`,
      );
      await transitionPipeline(
        db,
        pipeline.id,
        ContentPipelineStatuses.FAILED,
        `${failedCount} of ${jobs.length} job(s) failed`,
      );
      transitioned++;
      continue;
    }

    // Rule 3: Timeout - active > 4 hours with no running/pending jobs
    const startedAt = pipeline.startedAt?.getTime() ?? 0;
    const elapsed = Date.now() - startedAt;

    if (elapsed > STALE_TIMEOUT_MS && !hasRunningOrPending) {
      const hours = Math.round(elapsed / (60 * 60 * 1000) * 10) / 10;
      log.info(
        `[PipelineCron] Pipeline ${pipeline.id}: timed out after ${hours}h with no active jobs`,
      );
      await transitionPipeline(
        db,
        pipeline.id,
        ContentPipelineStatuses.FAILED,
        `Pipeline timed out after ${hours}h with no active jobs`,
      );
      transitioned++;
      continue;
    }
  }

  log.info(`[PipelineCron] Transitioned ${transitioned} pipeline run(s)`);
  return transitioned;
}

/**
 * Auto-trigger a new pipeline run if pipelineEnabled is true and no runs are active.
 *
 * Called every 5 minutes by the cron handler. This makes the Start/Stop toggle
 * the single control for pipeline automation: when enabled, the cron ensures
 * a run is always in-flight.
 */
export async function checkAndAutoTriggerPipeline(db: Db, env: CloudflareEnv) {
  // Gate 1: pipelineEnabled must be true
  const enabledSetting = await db
    .select()
    .from(tables.adminSettings)
    .where(eq(tables.adminSettings.key, AdminSettingKeys.PIPELINE_ENABLED))
    .get();

  const isEnabled = (enabledSetting?.value ?? ADMIN_SETTING_DEFAULTS.pipelineEnabled) === 'true';

  if (!isEnabled) {
    log.info('[PipelineCron] Pipeline disabled, skipping auto-trigger');
    return;
  }

  // Gate 2: no active pipeline runs (any status in the active set)
  const activeRuns = await db
    .select()
    .from(tables.contentPipelineRun)
    .where(inArray(tables.contentPipelineRun.status, [...ACTIVE_CONTENT_PIPELINE_STATUSES]))
    .limit(1)
    .all();

  if (activeRuns.length > 0) {
    log.info('[PipelineCron] Pipeline already active, skipping auto-trigger');
    return;
  }

  // Create a new pipeline run and queue it
  const runId = ulid();
  const now = new Date();

  await db.insert(tables.contentPipelineRun).values({
    createdAt: now,
    id: runId,
    status: ContentPipelineStatuses.PENDING,
    triggerType: ContentPipelineTriggerTypes.CRON,
    updatedAt: now,
  });

  const message: RunContentPipelineQueueMessage = {
    messageId: `pipeline-auto-${runId}`,
    queuedAt: now.toISOString(),
    runId,
    triggerType: ContentPipelineTriggerTypes.CRON,
    type: RoundOrchestrationMessageTypes.RUN_CONTENT_PIPELINE,
  };

  await env.ROUND_ORCHESTRATION_QUEUE.send(message);

  log.info(`[PipelineCron] Cron auto-triggered new pipeline run ${runId}`);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if continuous mode is enabled and queue a new pipeline run if so.
 */
async function maybeTriggerContinuousPipeline(db: Db, env: CloudflareEnv) {
  try {
    const continuousSetting = await db
      .select()
      .from(tables.adminSettings)
      .where(eq(tables.adminSettings.key, AdminSettingKeys.CONTINUOUS))
      .get();

    const isContinuous = (continuousSetting?.value ?? ADMIN_SETTING_DEFAULTS.continuous) === 'true';

    if (!isContinuous) {
      return;
    }

    const runId = ulid();
    const now = new Date();

    // Create pipeline run record
    await db.insert(tables.contentPipelineRun).values({
      createdAt: now,
      id: runId,
      status: ContentPipelineStatuses.PENDING,
      triggerType: ContentPipelineTriggerTypes.CRON,
      updatedAt: now,
    });

    // Queue the new pipeline run
    const message: RunContentPipelineQueueMessage = {
      messageId: `pipeline-continuous-${runId}`,
      queuedAt: now.toISOString(),
      runId,
      triggerType: ContentPipelineTriggerTypes.CRON,
      type: RoundOrchestrationMessageTypes.RUN_CONTENT_PIPELINE,
    };

    await env.ROUND_ORCHESTRATION_QUEUE.send(message);

    log.info(`[PipelineCron] Continuous mode: queued new pipeline run ${runId}`);
  } catch (err) {
    log.error('[PipelineCron] Failed to trigger continuous pipeline run', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function transitionPipeline(
  db: Db,
  runId: string,
  status: typeof ContentPipelineStatuses.COMPLETED | typeof ContentPipelineStatuses.FAILED,
  errorMessage?: string,
) {
  await db
    .update(tables.contentPipelineRun)
    .set({
      completedAt: new Date(),
      ...(errorMessage ? { errorMessage } : {}),
      status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tables.contentPipelineRun.id, runId),
        inArray(tables.contentPipelineRun.status, [...ACTIVE_PIPELINE_STATUSES]),
      ),
    );
}
