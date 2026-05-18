import type { RouteHandler } from '@hono/zod-openapi';
import { AutomatedJobStatuses, ContentPipelineStatuses, RoundOrchestrationMessageTypes } from '@debatekit/shared/enums';
import { eq, gte } from 'drizzle-orm';
import { ulid } from 'ulid';

import { createError } from '@/common/error-handling';
import { createHandler, Responses } from '@/core';
import { getDbAsync } from '@/db';
import type { DbPipelineSelectedTopic } from '@/db/schemas/pipeline-metadata';
import * as tables from '@/db/tables';
import { requireAdmin } from '@/lib/auth';
import { log } from '@/lib/logger';
import { getPipelineConfig } from '@/services/admin-settings.service';
import { scoreTweetVirality } from '@/services/pipeline/viral-scoring.service';
import type { ApiEnv } from '@/types';
import type { StartAutomatedJobQueueMessage } from '@/types/queues';

import type { submitPipelineReviewRoute } from './route';
import { PipelineReviewBodySchema, PipelineReviewParamsSchema } from './schema';

// ============================================================================
// HANDLER
// ============================================================================

/**
 * Submit reviewed topics for a pipeline run awaiting review (admin only)
 *
 * Validates the run is in awaiting_review status, scores topics,
 * creates automated jobs, and queues them for execution.
 */
export const submitPipelineReviewHandler: RouteHandler<typeof submitPipelineReviewRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'submitPipelineReview',
    validateBody: PipelineReviewBodySchema,
    validateParams: PipelineReviewParamsSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { runId } = c.validated.params;
    const { topics } = c.validated.body;
    const db = await getDbAsync();

    // 1. Verify pipeline run exists and is awaiting review
    const run = await db.query.contentPipelineRun.findFirst({
      where: eq(tables.contentPipelineRun.id, runId),
    });

    if (!run) {
      throw createError.notFound('Pipeline run not found', {
        errorType: 'resource',
        resource: 'contentPipelineRun',
        resourceId: runId,
      });
    }

    if (run.status !== ContentPipelineStatuses.AWAITING_REVIEW) {
      throw createError.badRequest(`Pipeline run is not awaiting review (status: ${run.status})`, {
        errorType: 'validation',
      });
    }

    // 2. Find admin session for queuing jobs
    const activeSession = await db
      .select()
      .from(tables.session)
      .where(eq(tables.session.userId, user.id))
      .get();

    if (!activeSession) {
      throw createError.internal('No active session found for admin user', {
        errorType: 'authentication',
      });
    }

    // 3. Update status to creating_jobs
    await db
      .update(tables.contentPipelineRun)
      .set({ status: ContentPipelineStatuses.CREATING_JOBS, updatedAt: new Date() })
      .where(eq(tables.contentPipelineRun.id, runId));

    const config = await getPipelineConfig(db);

    // 4. Check daily job limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayJobs = await db
      .select()
      .from(tables.automatedJob)
      .where(gte(tables.automatedJob.createdAt, todayStart))
      .all();

    const todayJobCount = todayJobs.length;
    const createdJobIds: string[] = [];
    const selectedTopics: DbPipelineSelectedTopic[] = [];
    const viralScores: Record<string, number> = {};

    // 5. Score and create jobs for reviewed topics
    for (const topic of topics) {
      if (createdJobIds.length + todayJobCount >= config.dailyJobLimit) {
        log.info('[Pipeline Review] Daily job limit reached, stopping');
        break;
      }

      // Score viral potential
      const scoreResult = await scoreTweetVirality(
        topic.prompt,
        `Topic: ${topic.topic}\nPlatform: ${topic.platform}\nReasoning: ${topic.reasoning}`,
        c.env,
      );

      viralScores[topic.topic] = scoreResult.score;

      // For reviewed topics, skip the threshold check -- admin explicitly approved them
      const jobId = ulid();
      const jobNow = new Date();

      await db.insert(tables.automatedJob).values({
        autoPublish: true,
        createdAt: jobNow,
        currentRound: 0,
        id: jobId,
        initialPrompt: topic.prompt,
        status: AutomatedJobStatuses.PENDING,
        totalRounds: topic.suggestedRounds,
        updatedAt: jobNow,
        userId: user.id,
      });

      createdJobIds.push(jobId);

      selectedTopics.push({
        jobId,
        keyword: 'reviewed',
        platform: topic.platform,
        prompt: topic.prompt,
        reasoning: topic.reasoning,
        relevanceScore: topic.relevanceScore,
        suggestedRounds: topic.suggestedRounds,
        topic: topic.topic,
        viralBreakdown: scoreResult.breakdown,
        viralScore: scoreResult.score,
        viralSuggestions: scoreResult.suggestions,
      });

      // Queue job start
      try {
        const message: StartAutomatedJobQueueMessage = {
          jobId,
          messageId: `pipeline-review-start-${jobId}`,
          queuedAt: new Date().toISOString(),
          sessionToken: activeSession.token,
          type: RoundOrchestrationMessageTypes.START_AUTOMATED_JOB,
          userId: user.id,
        };

        await c.env.ROUND_ORCHESTRATION_QUEUE.send(message);
        log.info(`[Pipeline Review] Queued job ${jobId} for topic "${topic.topic}"`);
      } catch (queueErr) {
        const errMsg = queueErr instanceof Error ? queueErr.message : String(queueErr);
        log.error(`[Pipeline Review] Failed to queue job ${jobId}: ${errMsg}`);

        await db
          .update(tables.automatedJob)
          .set({
            metadata: { errorMessage: `Pipeline queue failed: ${errMsg}` },
            status: AutomatedJobStatuses.FAILED,
          })
          .where(eq(tables.automatedJob.id, jobId));
      }
    }

    // 6. Update pipeline run status
    const pipelineStatus = createdJobIds.length === 0
      ? ContentPipelineStatuses.COMPLETED
      : ContentPipelineStatuses.RUNNING;

    await db
      .update(tables.contentPipelineRun)
      .set({
        ...(createdJobIds.length === 0 ? { completedAt: new Date() } : {}),
        createdJobIds,
        selectedTopics,
        status: pipelineStatus,
        updatedAt: new Date(),
        viralScores,
      })
      .where(eq(tables.contentPipelineRun.id, runId));

    log.info(`[Pipeline Review] Run ${runId}: ${createdJobIds.length} jobs created from ${topics.length} reviewed topics`);

    return Responses.ok(c, { createdJobIds });
  },
);
