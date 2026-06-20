import type { ContentPipelineStatus } from '@debatekit/shared/enums';
import { AutomatedJobStatuses, ContentPipelineStatuses, ContentPipelineTriggerTypes, RoundOrchestrationMessageTypes } from '@debatekit/shared/enums';
import type { RouteHandler } from '@hono/zod-openapi';
import { and, desc, eq, inArray, isNotNull, like, lt } from 'drizzle-orm';
import { ulid } from 'ulid';

import { createError } from '@/common/error-handling';
import { createHandler, IdParamSchema, Responses } from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db/tables';
import { requireAdmin } from '@/lib/auth';
import { log } from '@/lib/logger';
import { generateTitleFromMessage, updateThreadTitleAndSlug } from '@/services/prompts/title-generator.service';
import type { ApiEnv } from '@/types';
import type { RunContentPipelineQueueMessage } from '@/types/queues';

import type {
  cancelPipelineRunRoute,
  fixDataRoute,
  getPipelineRunRoute,
  listPipelineRunsRoute,
  triggerPipelineRunRoute,
} from './route';
import { PipelineRunListQuerySchema, TriggerPipelineRequestSchema } from './schema';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Transform DB pipeline run to summary response format
 */
function transformPipelineRun(run: typeof tables.contentPipelineRun.$inferSelect) {
  return {
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    createdJobIds: run.createdJobIds ?? null,
    discoveredTopicsCount: run.discoveredTopics?.length ?? 0,
    errorMessage: run.errorMessage ?? null,
    id: run.id,
    selectedTopicsCount: run.selectedTopics?.length ?? 0,
    startedAt: run.startedAt?.toISOString() ?? null,
    status: run.status,
    triggerType: run.triggerType,
    updatedAt: run.updatedAt.toISOString(),
    viralScores: run.viralScores ?? null,
  };
}

/**
 * Transform DB pipeline run to detail response format (includes topics and metadata)
 */
function transformPipelineRunDetail(run: typeof tables.contentPipelineRun.$inferSelect) {
  return {
    ...transformPipelineRun(run),
    discoveredTopics: run.discoveredTopics ?? null,
    metadata: run.metadata ?? null,
    selectedTopics: run.selectedTopics ?? null,
  };
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * List pipeline runs (admin only)
 */
export const listPipelineRunsHandler: RouteHandler<typeof listPipelineRunsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'listPipelineRuns',
    validateQuery: PipelineRunListQuerySchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { cursor, limit = 20, status } = c.validated.query;
    const db = await getDbAsync();

    // Build where conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(tables.contentPipelineRun.status, status));
    }
    if (cursor) {
      conditions.push(lt(tables.contentPipelineRun.createdAt, new Date(cursor)));
    }

    const runs = await db
      .select()
      .from(tables.contentPipelineRun)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tables.contentPipelineRun.createdAt))
      .limit(limit + 1);

    const hasMore = runs.length > limit;
    const results = hasMore ? runs.slice(0, limit) : runs;

    const lastResult = results.at(-1);
    const nextCursor = hasMore && lastResult
      ? lastResult.createdAt.toISOString()
      : null;

    return Responses.ok(c, {
      hasMore,
      nextCursor,
      runs: results.map(transformPipelineRun),
      total: results.length,
    });
  },
);

/**
 * Trigger a manual pipeline run (admin only)
 *
 * Creates a pipeline run record in DB with status 'pending',
 * sends a queue message for async processing, and returns immediately.
 */
export const triggerPipelineRunHandler: RouteHandler<typeof triggerPipelineRunRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'triggerPipelineRun',
    validateBody: TriggerPipelineRequestSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { customTopics, maxTopics } = c.validated.body;
    const db = await getDbAsync();
    const runId = ulid();
    const now = new Date();

    // 1. Create pipeline run record in DB
    await db.insert(tables.contentPipelineRun).values({
      createdAt: now,
      id: runId,
      status: ContentPipelineStatuses.PENDING,
      triggerType: ContentPipelineTriggerTypes.MANUAL,
      updatedAt: now,
    });

    // 2. Queue the pipeline for async processing
    try {
      const message: RunContentPipelineQueueMessage = {
        ...(customTopics && customTopics.length > 0 ? { customTopics } : {}),
        ...(maxTopics !== undefined ? { maxTopics } : {}),
        messageId: `pipeline-${runId}`,
        queuedAt: now.toISOString(),
        runId,
        triggerType: ContentPipelineTriggerTypes.MANUAL,
        type: RoundOrchestrationMessageTypes.RUN_CONTENT_PIPELINE,
      };

      await c.env.ROUND_ORCHESTRATION_QUEUE.send(message);
    } catch (err) {
      log.error('[triggerPipelineRun] Failed to queue pipeline run', {
        error: err instanceof Error ? err.message : String(err),
        runId,
      });

      // Mark as failed if queue send fails
      await db
        .update(tables.contentPipelineRun)
        .set({
          errorMessage: 'Failed to queue pipeline for processing',
          status: ContentPipelineStatuses.FAILED,
          updatedAt: new Date(),
        })
        .where(eq(tables.contentPipelineRun.id, runId));

      throw createError.internal('Failed to queue content pipeline', {
        errorType: 'queue',
        operation: 'send',
        queueName: 'ROUND_ORCHESTRATION_QUEUE',
      });
    }

    return Responses.created(c, {
      runId,
      status: ContentPipelineStatuses.PENDING,
    });
  },
);

/**
 * Get pipeline run details (admin only)
 */
export const getPipelineRunHandler: RouteHandler<typeof getPipelineRunRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getPipelineRun',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { id } = c.validated.params;
    const db = await getDbAsync();

    const run = await db.query.contentPipelineRun.findFirst({
      where: eq(tables.contentPipelineRun.id, id),
    });

    if (!run) {
      throw createError.notFound('Pipeline run not found', {
        errorType: 'resource',
        resource: 'contentPipelineRun',
        resourceId: id,
      });
    }

    return Responses.ok(c, transformPipelineRunDetail(run));
  },
);

// ============================================================================
// CANCEL PIPELINE RUN
// ============================================================================

/** Pipeline statuses that can be cancelled */
const CANCELLABLE_PIPELINE_STATUS_SET = new Set<ContentPipelineStatus>([
  ContentPipelineStatuses.PENDING,
  ContentPipelineStatuses.DISCOVERING,
  ContentPipelineStatuses.AWAITING_REVIEW,
  ContentPipelineStatuses.CREATING_JOBS,
  ContentPipelineStatuses.RUNNING,
]);

/**
 * Cancel a pipeline run (admin only)
 *
 * Only pending/active runs can be cancelled.
 * Also cancels any pending/running jobs created by this run.
 */
export const cancelPipelineRunHandler: RouteHandler<typeof cancelPipelineRunRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'cancelPipelineRun',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { id } = c.validated.params;
    const db = await getDbAsync();

    const run = await db.query.contentPipelineRun.findFirst({
      where: eq(tables.contentPipelineRun.id, id),
    });

    if (!run) {
      throw createError.notFound('Pipeline run not found', {
        errorType: 'resource',
        resource: 'contentPipelineRun',
        resourceId: id,
      });
    }

    const isCancellable = CANCELLABLE_PIPELINE_STATUS_SET.has(run.status);
    if (!isCancellable) {
      throw createError.badRequest(`Cannot cancel pipeline run with status '${run.status}'`, {
        errorType: 'validation',
      });
    }

    const now = new Date();

    // Cancel the pipeline run
    await db
      .update(tables.contentPipelineRun)
      .set({
        completedAt: now,
        status: ContentPipelineStatuses.CANCELLED,
        updatedAt: now,
      })
      .where(eq(tables.contentPipelineRun.id, id));

    // Cancel any pending/running jobs created by this pipeline run
    let cancelledJobCount = 0;
    if (run.createdJobIds && run.createdJobIds.length > 0) {
      const result = await db
        .update(tables.automatedJob)
        .set({
          status: AutomatedJobStatuses.CANCELLED,
          updatedAt: now,
        })
        .where(
          and(
            inArray(tables.automatedJob.id, run.createdJobIds),
            inArray(tables.automatedJob.status, ['pending', 'running']),
          ),
        )
        .returning();

      cancelledJobCount = result.length;
    }

    log.info(`[cancelPipelineRun] Cancelled pipeline run ${id} and ${cancelledJobCount} associated jobs`);

    // Reload and return
    const updatedRun = await db.query.contentPipelineRun.findFirst({
      where: eq(tables.contentPipelineRun.id, id),
    });

    if (!updatedRun) {
      throw createError.internal('Failed to reload pipeline run', {
        errorType: 'database',
        operation: 'select',
        table: 'contentPipelineRun',
      });
    }

    return Responses.ok(c, transformPipelineRunDetail(updatedRun));
  },
);

// ============================================================================
// FIX PRODUCTION DATA
// ============================================================================

/**
 * Fix production data (admin only)
 *
 * 1. Find threads with title = 'New Chat' linked to automated jobs
 * 2. Generate AI titles from job's initialPrompt
 * 3. Fix tweet URLs containing /listen/ to /public/chat/
 *
 * Idempotent: threads already titled skip; tweets without /listen/ unaffected.
 */
export const fixDataHandler: RouteHandler<typeof fixDataRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'fixData',
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const db = await getDbAsync();

    // ========================================================================
    // PART 1: Fix thread titles
    // ========================================================================

    // Find all automated jobs that have a threadId linked to a thread with title = 'New Chat'
    const jobsWithNewChatThreads = await db
      .select()
      .from(tables.automatedJob)
      .innerJoin(tables.chatThread, eq(tables.automatedJob.threadId, tables.chatThread.id))
      .where(
        and(
          eq(tables.chatThread.title, 'New Chat'),
          eq(tables.chatThread.isAiGeneratedTitle, false),
          isNotNull(tables.automatedJob.threadId),
        ),
      );

    const titleResults: Array<{ generatedTitle: string; slug: string; threadId: string }> = [];
    let titleSucceeded = 0;
    let titleFailed = 0;
    let titleSkipped = 0;

    for (const row of jobsWithNewChatThreads) {
      const threadId = row.automated_job.threadId;
      const initialPrompt = row.automated_job.initialPrompt;

      if (!threadId || !initialPrompt) {
        titleSkipped++;
        continue;
      }

      try {
        const generatedTitle = await generateTitleFromMessage(initialPrompt, c.env);
        const { slug, title } = await updateThreadTitleAndSlug(threadId, generatedTitle);

        titleResults.push({
          generatedTitle: title,
          slug,
          threadId,
        });
        titleSucceeded++;

        log.info(`[fixData] Generated title for thread ${threadId}: "${title}"`);
      } catch (error) {
        titleFailed++;
        log.error('[fixData] Failed to generate title for thread', {
          error: error instanceof Error ? error.message : String(error),
          threadId,
        });
      }
    }

    // ========================================================================
    // PART 2: Fix tweet URLs containing /listen/
    // ========================================================================

    const tweetsWithListenUrl = await db
      .select()
      .from(tables.scheduledTweet)
      .where(like(tables.scheduledTweet.content, '%/listen/%'));

    const tweetResults: Array<{ newContent: string; tweetId: string }> = [];

    if (tweetsWithListenUrl.length > 0) {
      for (const tweet of tweetsWithListenUrl) {
        const newContent = tweet.content.replace(/\/listen\//g, '/public/chat/');

        await db
          .update(tables.scheduledTweet)
          .set({
            content: newContent,
            updatedAt: new Date(),
          })
          .where(eq(tables.scheduledTweet.id, tweet.id));

        tweetResults.push({
          newContent,
          tweetId: tweet.id,
        });
      }
    }

    log.info('[fixData] Data fix complete', {
      titleFixesFailed: titleFailed,
      titleFixesSkipped: titleSkipped,
      titleFixesSucceeded: titleSucceeded,
      titleFixesTotal: jobsWithNewChatThreads.length,
      tweetUrlFixesTotal: tweetsWithListenUrl.length,
      tweetUrlFixesUpdated: tweetResults.length,
    });

    return Responses.ok(c, {
      titleFixes: {
        failed: titleFailed,
        results: titleResults,
        skipped: titleSkipped,
        succeeded: titleSucceeded,
        total: jobsWithNewChatThreads.length,
      },
      tweetUrlFixes: {
        results: tweetResults,
        total: tweetsWithListenUrl.length,
        updated: tweetResults.length,
      },
    });
  },
);
