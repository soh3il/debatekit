/**
 * Content Pipeline Service
 *
 * Main orchestrator that runs the full automated content pipeline:
 * trend discovery -> viral scoring -> job creation -> queue for execution.
 *
 * Flow:
 * 1. Create pipeline run record in DB with status 'pending'
 * 2. Update to 'discovering', call autoDiscoverTrends()
 * 3. Update to 'creating_jobs', for each top topic:
 *    a. Score viral potential via scoreTweetVirality()
 *    b. Only select topics with viral score >= 60
 *    c. Create automated job via direct DB insert
 *    d. Queue start-automated-job message to ROUND_ORCHESTRATION_QUEUE
 * 4. Update status to 'running', save job IDs and topic data
 * 5. Return pipeline run ID
 *
 * The pipeline does NOT wait for jobs to complete - that is handled by the existing cron.
 */

import type { ContentPipelineTriggerType } from '@debatekit/shared/enums';
import {
  AutomatedJobStatuses,
  ContentPipelineStatuses,
  ContentPipelineTriggerTypes,
  RoundOrchestrationMessageTypes,
} from '@debatekit/shared/enums';
import { and, eq, gte } from 'drizzle-orm';
import { ulid } from 'ulid';

import type { getDbAsync } from '@/db';
import * as tables from '@/db';
import type { DbPipelineDiscoveredTopic, DbPipelineSelectedTopic } from '@/db/schemas/pipeline-metadata';
import { log } from '@/lib/logger';
import { getPipelineConfig } from '@/services/admin-settings.service';
import type { ApiEnv } from '@/types';
import type { StartAutomatedJobQueueMessage } from '@/types/queues';

import { autoDiscoverTrends } from './auto-discover.service';
import { analyzePerformance, formatPerformanceForDiscovery, formatPerformanceForViralScoring } from './performance-analysis.service';
import { scoreTweetVirality } from './viral-scoring.service';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Max time for the discovery phase before giving up (5 minutes) */
const DISCOVERY_TIMEOUT_MS = 5 * 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

type PipelineOptions = {
  customTopics?: string[];
  maxTopics?: number;
};

// ============================================================================
// HELPERS
// ============================================================================

type Db = Awaited<ReturnType<typeof getDbAsync>>;

/**
 * Find an admin user for system-triggered pipeline runs.
 * All internal API calls authenticate via BETTER_AUTH_SECRET (buildInternalAuthHeaders),
 * so the pipeline works regardless of admin session state.
 */
async function findAdminUser(db: Db): Promise<{ sessionToken: string; userId: string } | null> {
  const adminUser = await db.query.user.findFirst({
    columns: { id: true },
    where: eq(tables.user.role, 'admin'),
  });

  if (!adminUser) {
    return null;
  }

  const activeSession = await db
    .select()
    .from(tables.session)
    .where(
      and(
        eq(tables.session.userId, adminUser.id),
        gte(tables.session.expiresAt, new Date()),
      ),
    )
    .get();

  return { sessionToken: activeSession?.token ?? `internal-${adminUser.id}`, userId: adminUser.id };
}

/**
 * Partial update fields for pipeline run (excludes id, createdAt, triggerType which are set-once)
 */
type PipelineRunUpdate = Partial<Pick<
  typeof tables.contentPipelineRun.$inferInsert,
  'completedAt' | 'createdJobIds' | 'createdTweetIds' | 'discoveredTopics' | 'errorMessage' | 'metadata' | 'selectedTopics' | 'startedAt' | 'viralScores'
>>;

/**
 * Update pipeline run status in DB
 */
async function updatePipelineStatus(
  db: Db,
  runId: string,
  status: typeof ContentPipelineStatuses[keyof typeof ContentPipelineStatuses],
  extra?: PipelineRunUpdate,
) {
  await db
    .update(tables.contentPipelineRun)
    .set({
      ...extra,
      status,
      updatedAt: new Date(),
    })
    .where(eq(tables.contentPipelineRun.id, runId));
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Run the full content pipeline: discover -> score -> create jobs -> queue
 *
 * @param db - Database instance
 * @param env - Cloudflare Workers environment bindings
 * @param triggerType - How the pipeline was triggered ('cron' or 'manual')
 * @param existingRunId - Optional pre-created pipeline run ID (used by queue consumer)
 * @param options - Optional customization (maxTopics, customTopics)
 * @returns Pipeline run ID
 */
export async function runContentPipeline(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  env: ApiEnv['Bindings'],
  triggerType: ContentPipelineTriggerType,
  existingRunId?: string,
  options?: PipelineOptions,
): Promise<string> {
  const runId = existingRunId ?? ulid();
  const now = new Date();

  log.info(`[Pipeline] Starting content pipeline run ${runId} (trigger: ${triggerType})`);

  // 1. Create pipeline run record (skip if pre-created by caller)
  if (!existingRunId) {
    await db.insert(tables.contentPipelineRun).values({
      createdAt: now,
      id: runId,
      startedAt: now,
      status: ContentPipelineStatuses.PENDING,
      triggerType,
      updatedAt: now,
    });
  } else {
    // Update the pre-created record with startedAt
    await updatePipelineStatus(db, runId, ContentPipelineStatuses.PENDING, {
      startedAt: now,
    });
  }

  try {
    // Find admin user for queuing jobs (internal auth used for all API calls)
    const adminUser = await findAdminUser(db);
    if (!adminUser) {
      throw new Error('No admin user found. Pipeline requires an admin user.');
    }

    // Fetch admin settings (replaces hardcoded constants)
    const config = await getPipelineConfig(db);

    // 1.5. Analyze past performance to inform discovery and scoring
    const performanceInsights = await analyzePerformance(db);
    const performanceDiscoveryContext = formatPerformanceForDiscovery(performanceInsights);
    const performanceViralContext = formatPerformanceForViralScoring(performanceInsights);

    // Build performance metadata to include in all pipeline run metadata updates
    const performanceMetadata = performanceInsights.hasEnoughData
      ? {
          performanceAvgEngagement: performanceInsights.avgEngagementRate,
          performanceTopStyles: performanceInsights.topStyles.slice(0, 5).map(s => s.style),
          performanceTopThemes: performanceInsights.topTopicThemes,
          performanceTweetsAnalyzed: performanceInsights.totalAnalyzed,
        }
      : {};

    if (performanceInsights.hasEnoughData) {
      log.info(`[Pipeline] Performance analysis: ${performanceInsights.totalAnalyzed} tweets, ${performanceInsights.avgEngagementRate}% avg engagement, ${performanceInsights.topTopicThemes.length} top themes`);
    } else {
      log.info('[Pipeline] Performance analysis: not enough historical data yet');
    }

    // 2. Discovery phase
    await updatePipelineStatus(db, runId, ContentPipelineStatuses.DISCOVERING);

    const discoveryStart = Date.now();
    const customTopics = options?.customTopics;
    const hasCustomTopics = customTopics && customTopics.length > 0;

    // If customTopics provided, skip auto-discovery and create topics directly
    type DiscoveryResultShape = Awaited<ReturnType<typeof autoDiscoverTrends>>;
    let discoveryResult: DiscoveryResultShape;

    if (hasCustomTopics) {
      log.info(`[Pipeline] Using ${customTopics.length} custom topic(s), skipping auto-discovery`);
      discoveryResult = {
        keywordsUsed: ['custom'],
        platformsSearched: ['custom'],
        topics: customTopics.map(topic => ({
          platform: 'custom',
          prompt: `Discuss and analyze: ${topic}`,
          reasoning: 'Custom topic provided by admin',
          relevanceScore: 100,
          suggestedRounds: config.defaultRoundCount,
          topic,
        })),
        totalResultsAnalyzed: customTopics.length,
      };
    } else {
      // Combine admin topic guidance with performance insights
      const enrichedTopicGuidance = [config.topicGuidance, performanceDiscoveryContext]
        .filter(Boolean)
        .join('\n\n');

      // Race discovery against a timeout to prevent hanging on external API calls
      discoveryResult = await Promise.race([
        autoDiscoverTrends(env, options?.maxTopics, { systemPrompt: config.systemPrompt, topicGuidance: enrichedTopicGuidance || undefined }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error(`Discovery timed out after ${DISCOVERY_TIMEOUT_MS / 1000}s`)), DISCOVERY_TIMEOUT_MS);
        }),
      ]);
    }

    const discoveryDurationMs = Date.now() - discoveryStart;

    log.info(
      `[Pipeline] Discovery complete: ${discoveryResult.topics.length} topics found in ${discoveryDurationMs}ms`,
    );

    if (discoveryResult.topics.length === 0) {
      await updatePipelineStatus(db, runId, ContentPipelineStatuses.COMPLETED, {
        completedAt: new Date(),
        metadata: {
          ...performanceMetadata,
          discoveryDurationMs,
          keywordsUsed: discoveryResult.keywordsUsed,
          platformsSearched: discoveryResult.platformsSearched,
          totalResultsAnalyzed: discoveryResult.totalResultsAnalyzed,
        },
      });
      log.info(`[Pipeline] Run ${runId} completed with no topics discovered`);
      return runId;
    }

    // Store discovered topics
    const discoveredTopics: DbPipelineDiscoveredTopic[] = discoveryResult.topics.map(t => ({
      keyword: discoveryResult.keywordsUsed[0] ?? 'auto',
      platform: t.platform,
      prompt: t.prompt,
      reasoning: t.reasoning,
      relevanceScore: t.relevanceScore,
      suggestedRounds: t.suggestedRounds,
      topic: t.topic,
    }));

    // For manual runs without custom topics, pause for admin review
    if (triggerType === ContentPipelineTriggerTypes.MANUAL && !hasCustomTopics && discoveryResult.topics.length > 0) {
      await updatePipelineStatus(db, runId, ContentPipelineStatuses.AWAITING_REVIEW, {
        discoveredTopics,
        metadata: {
          ...performanceMetadata,
          discoveryDurationMs,
          keywordsUsed: discoveryResult.keywordsUsed,
          platformsSearched: discoveryResult.platformsSearched,
          totalResultsAnalyzed: discoveryResult.totalResultsAnalyzed,
        },
      });

      log.info(`[Pipeline] Run ${runId}: ${discoveryResult.topics.length} topics found, awaiting admin review`);
      return runId;
    }

    await updatePipelineStatus(db, runId, ContentPipelineStatuses.CREATING_JOBS, {
      discoveredTopics,
      metadata: {
        discoveryDurationMs,
        keywordsUsed: discoveryResult.keywordsUsed,
        platformsSearched: discoveryResult.platformsSearched,
        totalResultsAnalyzed: discoveryResult.totalResultsAnalyzed,
      },
    });

    // 3. Score and create jobs (with daily limit enforcement)
    const jobCreationStart = Date.now();
    const selectedTopics: DbPipelineSelectedTopic[] = [];
    const createdJobIds: string[] = [];
    const viralScores: Record<string, number> = {};

    // Check how many jobs were already created today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayJobs = await db
      .select()
      .from(tables.automatedJob)
      .where(gte(tables.automatedJob.createdAt, todayStart))
      .all();

    const todayJobCount = todayJobs.length;

    if (todayJobCount >= config.dailyJobLimit) {
      log.info(
        `[Pipeline] Daily job limit already reached (${todayJobCount}/${config.dailyJobLimit}), skipping job creation`,
      );

      await updatePipelineStatus(db, runId, ContentPipelineStatuses.COMPLETED, {
        completedAt: new Date(),
        discoveredTopics,
        metadata: {
          ...performanceMetadata,
          discoveryDurationMs,
          keywordsUsed: discoveryResult.keywordsUsed,
          platformsSearched: discoveryResult.platformsSearched,
          totalResultsAnalyzed: discoveryResult.totalResultsAnalyzed,
        },
      });

      return runId;
    }

    for (const topic of discoveryResult.topics) {
      // Check if we've hit the daily limit (including jobs created in this run)
      if (createdJobIds.length + todayJobCount >= config.dailyJobLimit) {
        log.info(
          `[Pipeline] Daily job limit reached (${createdJobIds.length + todayJobCount}/${config.dailyJobLimit}), stopping job creation`,
        );
        break;
      }

      // 3a. Score viral potential (with performance context for calibration)
      const viralContext = [
        `Topic: ${topic.topic}\nPlatform: ${topic.platform}\nReasoning: ${topic.reasoning}`,
        performanceViralContext,
      ].filter(Boolean).join('\n\n');

      const scoreResult = await scoreTweetVirality(
        topic.prompt,
        viralContext,
        env,
      );

      viralScores[topic.topic] = scoreResult.score;

      // 3b. Only select topics with viral score >= threshold
      if (scoreResult.score < config.viralScoreThreshold) {
        log.info(
          `[Pipeline] Skipping topic "${topic.topic}" (viral score: ${scoreResult.score} < ${config.viralScoreThreshold})`,
        );
        continue;
      }

      // 3c. Create automated job via direct DB insert
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
        userId: adminUser.userId,
      });

      createdJobIds.push(jobId);

      selectedTopics.push({
        jobId,
        keyword: discoveryResult.keywordsUsed[0] ?? 'auto',
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

      // 3d. Queue start-automated-job message
      try {
        const message: StartAutomatedJobQueueMessage = {
          jobId,
          messageId: `pipeline-start-${jobId}`,
          queuedAt: new Date().toISOString(),
          sessionToken: adminUser.sessionToken,
          type: RoundOrchestrationMessageTypes.START_AUTOMATED_JOB,
          userId: adminUser.userId,
        };

        await env.ROUND_ORCHESTRATION_QUEUE.send(message);
        log.info(`[Pipeline] Queued job ${jobId} for topic "${topic.topic}" (viral: ${scoreResult.score})`);
      } catch (queueErr) {
        const errMsg = queueErr instanceof Error ? queueErr.message : String(queueErr);
        log.error(`[Pipeline] Failed to queue job ${jobId}: ${errMsg}`);

        // Mark job as failed if queue send fails
        await db
          .update(tables.automatedJob)
          .set({
            metadata: { errorMessage: `Pipeline queue failed: ${errMsg}` },
            status: AutomatedJobStatuses.FAILED,
          })
          .where(eq(tables.automatedJob.id, jobId));
      }
    }

    const jobCreationDurationMs = Date.now() - jobCreationStart;

    // 4. Update pipeline status: COMPLETED immediately if no jobs created, otherwise RUNNING
    const pipelineStatus = createdJobIds.length === 0
      ? ContentPipelineStatuses.COMPLETED
      : ContentPipelineStatuses.RUNNING;

    await updatePipelineStatus(db, runId, pipelineStatus, {
      ...(createdJobIds.length === 0 ? { completedAt: new Date() } : {}),
      createdJobIds,
      metadata: {
        ...performanceMetadata,
        discoveryDurationMs,
        jobCreationDurationMs,
        keywordsUsed: discoveryResult.keywordsUsed,
        platformsSearched: discoveryResult.platformsSearched,
        totalResultsAnalyzed: discoveryResult.totalResultsAnalyzed,
      },
      selectedTopics,
      viralScores,
    });

    log.info(
      `[Pipeline] Run ${runId}: ${createdJobIds.length} jobs created from ${discoveryResult.topics.length} topics${createdJobIds.length === 0 ? ' (completed — no topics met quality threshold)' : ''}`,
    );

    return runId;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`[Pipeline] Run ${runId} failed: ${errMsg}`);

    await updatePipelineStatus(db, runId, ContentPipelineStatuses.FAILED, {
      errorMessage: errMsg,
    });

    return runId;
  }
}
