/**
 * Job Orchestration Service
 *
 * Coordinates automated multi-round AI conversations.
 * Handles job lifecycle: start → continue → complete
 *
 * ARCHITECTURE: Uses direct DB inserts for thread creation to bypass
 * HTTP auth (session tokens may expire in background jobs).
 * Queue messages still carry the sessionToken for participant streaming.
 */

import { AutomatedJobStatuses, MessagePartTypes, MessageRoles, RoundOrchestrationMessageTypes, TweetPostingMessageTypes, WebAppEnvs } from '@debatekit/shared/enums';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { ulid } from 'ulid';

import type { DbAutomatedJobMetadata, getDbAsync } from '@/db';
import * as tables from '@/db';
import { log } from '@/lib/logger';
import { getAdminSetting } from '@/services/admin-settings.service';
import { generateTitleFromMessage, generateUniqueSlug, updateThreadTitleAndSlug } from '@/services/prompts';
import type { ApiEnv } from '@/types';
import type {
  CompleteAutomatedJobQueueMessage,
  ContinueAutomatedJobQueueMessage,
  GenerateTweetQueueMessage,
} from '@/types/queues';

import { analyzePromptForJob, analyzeRoundPrompt } from './prompt-analysis.service';
import { generateNextRoundPrompt } from './prompt-generation.service';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Max tweets generated per day to avoid spam */
const MAX_TWEETS_PER_DAY = 5;

/** Jobs with no activity for 2+ hours are considered stale */
const STALE_JOB_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * Start an automated job
 *
 * 1. Load job from database
 * 2. Select models using AI
 * 3. Create thread, participants, first message directly in DB
 * 4. Create pre-search record if web search enabled
 * 5. Update job with threadId and selectedModels
 * 6. Queue first round execution
 *
 * ARCHITECTURE: Uses direct DB inserts (bypasses HTTP auth) to avoid
 * 401 errors from expired session tokens in background jobs.
 * The sessionToken is still forwarded to the queue message for
 * participant streaming which needs it for the unified stream endpoint.
 */
export async function startAutomatedJob(
  jobId: string,
  sessionToken: string,
  db: Awaited<ReturnType<typeof getDbAsync>>,
  env: ApiEnv['Bindings'],
  queue: Queue,
): Promise<void> {
  const job = await db.query.automatedJob.findFirst({
    where: eq(tables.automatedJob.id, jobId),
  });

  if (!job) {
    return;
  }

  if (job.status !== AutomatedJobStatuses.PENDING) {
    return;
  }

  try {
    await db
      .update(tables.automatedJob)
      .set({
        metadata: {
          ...job.metadata,
          startedAt: new Date().toISOString(),
        },
        status: AutomatedJobStatuses.RUNNING,
        updatedAt: new Date(),
      })
      .where(eq(tables.automatedJob.id, jobId));

    // 1. Analyze prompt for mode, models, web search settings
    const analysis = await analyzePromptForJob(job.initialPrompt, env);

    // 2. Create thread directly in DB (bypasses HTTP auth)
    const threadId = ulid();
    const now = new Date();
    const slug = await generateUniqueSlug(job.initialPrompt);

    await db.insert(tables.chatThread).values({
      createdAt: now,
      enableWebSearch: analysis.enableWebSearch,
      id: threadId,
      lastMessageAt: now,
      mode: analysis.mode,
      slug,
      status: 'active',
      title: 'New Chat',
      updatedAt: now,
      userId: job.userId,
      version: 1,
    });

    // 2b. Generate AI title for the thread (non-blocking, best-effort)
    try {
      const aiTitle = await generateTitleFromMessage(job.initialPrompt, env);
      await updateThreadTitleAndSlug(threadId, aiTitle);
    } catch (titleError) {
      // Title generation failure is non-critical, fall back to truncated prompt
      const fallbackTitle = job.initialPrompt.trim().split(/\s+/).slice(0, 5).join(' ') || 'New Chat';
      try {
        await db
          .update(tables.chatThread)
          .set({
            title: fallbackTitle.length > 50 ? fallbackTitle.substring(0, 50).trim() : fallbackTitle,
            updatedAt: new Date(),
          })
          .where(eq(tables.chatThread.id, threadId));
      } catch {
        // Fallback update also failed, thread keeps default "New Chat" title
      }
      log.error(`[JobOrchestration] Title generation failed for job ${jobId}: ${titleError instanceof Error ? titleError.message : String(titleError)}`);
    }

    // 3. Create participants
    for (let i = 0; i < analysis.participants.length; i++) {
      const participant = analysis.participants[i];
      if (!participant) {
        continue;
      }

      await db.insert(tables.chatParticipant).values({
        createdAt: now,
        id: ulid(),
        isEnabled: true,
        modelId: participant.modelId,
        priority: i,
        role: participant.role ?? null,
        settings: null,
        threadId,
        updatedAt: now,
      });
    }

    // 4. Create first user message
    const messageId = ulid();
    await db.insert(tables.chatMessage).values({
      createdAt: now,
      id: messageId,
      metadata: {
        role: MessageRoles.USER,
        roundNumber: 0,
      },
      parts: [{ text: job.initialPrompt, type: MessagePartTypes.TEXT }],
      role: MessageRoles.USER,
      roundNumber: 0,
      threadId,
    });

    // 5. Create pre-search record if web search is enabled
    if (analysis.enableWebSearch) {
      await db.insert(tables.chatPreSearch).values({
        createdAt: now,
        id: ulid(),
        roundNumber: 0,
        status: 'pending',
        threadId,
        userQuery: job.initialPrompt,
      });
    }

    // 6. Update job with thread info
    const updatedMetadata: DbAutomatedJobMetadata = {
      ...job.metadata,
      promptReasoning: analysis.reasoning,
      roundConfigs: [{
        enableWebSearch: analysis.enableWebSearch,
        mode: analysis.mode,
        round: 0,
      }],
      roundPrompts: [job.initialPrompt],
      startedAt: new Date().toISOString(),
    };

    await db
      .update(tables.automatedJob)
      .set({
        currentRound: 0,
        metadata: updatedMetadata,
        selectedModels: analysis.modelIds,
        threadId,
        updatedAt: new Date(),
      })
      .where(eq(tables.automatedJob.id, jobId));

    // 7. Queue first round execution
    await queue.send({
      messageId: `trigger-${threadId}-r0-p0`,
      participantIndex: 0,
      queuedAt: new Date().toISOString(),
      roundNumber: 0,
      sessionToken,
      threadId,
      type: RoundOrchestrationMessageTypes.TRIGGER_PARTICIPANT,
      userId: job.userId,
    });
  } catch (error) {
    await db
      .update(tables.automatedJob)
      .set({
        metadata: {
          ...job.metadata,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
        status: AutomatedJobStatuses.FAILED,
      })
      .where(eq(tables.automatedJob.id, jobId));
  }
}

/**
 * Continue an automated job to the next round
 *
 * 1. Generate next prompt using AI
 * 2. Create user message with new prompt
 * 3. Update job currentRound
 * 4. Queue next round execution
 */
export async function continueAutomatedJob(
  jobId: string,
  threadId: string,
  currentRound: number,
  sessionToken: string,
  db: Awaited<ReturnType<typeof getDbAsync>>,
  env: ApiEnv['Bindings'],
  queue: Queue,
): Promise<void> {
  const job = await db.query.automatedJob.findFirst({
    where: eq(tables.automatedJob.id, jobId),
  });

  if (job?.status !== AutomatedJobStatuses.RUNNING) {
    return;
  }

  // Idempotency guard: if job already advanced past this round, skip.
  // Protects against duplicate CONTINUE_AUTOMATED_JOB messages from
  // multiple callers (onComplete callback + queue consumer fallback).
  if (job.currentRound !== currentRound) {
    log.info(`[JobOrchestration] Skipping duplicate continue for job ${jobId} (job round ${job.currentRound}, message round ${currentRound})`);
    return;
  }

  const nextRound = currentRound + 1;

  if (nextRound >= job.totalRounds) {
    await queue.send({
      autoPublish: job.autoPublish,
      jobId,
      messageId: `complete-${jobId}`,
      queuedAt: new Date().toISOString(),
      threadId,
      type: RoundOrchestrationMessageTypes.COMPLETE_AUTOMATED_JOB,
    } satisfies CompleteAutomatedJobQueueMessage);
    return;
  }

  try {
    const adminSystemPrompt = await getAdminSetting(db, 'systemPrompt');

    const nextPrompt = await generateNextRoundPrompt(
      threadId,
      currentRound,
      job.initialPrompt,
      db,
      env,
      adminSystemPrompt || undefined,
    );

    const roundConfig = await analyzeRoundPrompt(nextPrompt, env);

    await db
      .update(tables.chatThread)
      .set({
        enableWebSearch: roundConfig.enableWebSearch,
        mode: roundConfig.mode,
        updatedAt: new Date(),
      })
      .where(eq(tables.chatThread.id, threadId));

    const now = new Date();
    const messageId = ulid();

    await db.insert(tables.chatMessage).values({
      createdAt: now,
      id: messageId,
      metadata: {
        role: MessageRoles.USER,
        roundNumber: nextRound,
      },
      parts: [{ text: nextPrompt, type: MessagePartTypes.TEXT }],
      role: MessageRoles.USER,
      roundNumber: nextRound,
      threadId,
    });

    await db
      .update(tables.chatThread)
      .set({ lastMessageAt: now, updatedAt: now })
      .where(eq(tables.chatThread.id, threadId));

    const roundPrompts = [...(job.metadata?.roundPrompts || []), nextPrompt];
    const roundConfigs = [...(job.metadata?.roundConfigs || []), {
      enableWebSearch: roundConfig.enableWebSearch,
      mode: roundConfig.mode,
      round: nextRound,
    }];

    await db
      .update(tables.automatedJob)
      .set({
        currentRound: nextRound,
        metadata: {
          ...job.metadata,
          roundConfigs,
          roundPrompts,
        },
        updatedAt: new Date(),
      })
      .where(eq(tables.automatedJob.id, jobId));

    await queue.send({
      messageId: `trigger-${threadId}-r${nextRound}-p0`,
      participantIndex: 0,
      queuedAt: new Date().toISOString(),
      roundNumber: nextRound,
      sessionToken,
      threadId,
      type: RoundOrchestrationMessageTypes.TRIGGER_PARTICIPANT,
      userId: job.userId,
    });
  } catch (error) {
    await db
      .update(tables.automatedJob)
      .set({
        metadata: {
          ...job.metadata,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
        status: AutomatedJobStatuses.FAILED,
      })
      .where(eq(tables.automatedJob.id, jobId));
  }
}

/**
 * Complete an automated job
 *
 * 1. Mark job as completed
 * 2. Optionally publish thread if autoPublish is true
 * 3. Queue tweet generation if daily limit not exceeded
 */
export async function completeAutomatedJob(
  jobId: string,
  threadId: string,
  autoPublish: boolean,
  db: Awaited<ReturnType<typeof getDbAsync>>,
  env: ApiEnv['Bindings'],
): Promise<void> {
  const job = await db.query.automatedJob.findFirst({
    where: eq(tables.automatedJob.id, jobId),
  });

  if (!job) {
    return;
  }

  try {
    await db
      .update(tables.automatedJob)
      .set({
        metadata: {
          ...job.metadata,
          completedAt: new Date().toISOString(),
        },
        status: AutomatedJobStatuses.COMPLETED,
      })
      .where(eq(tables.automatedJob.id, jobId));

    if (autoPublish) {
      await db
        .update(tables.chatThread)
        .set({ isPublic: true, updatedAt: new Date() })
        .where(eq(tables.chatThread.id, threadId));
    }

    // Queue tweet generation if daily limit not exceeded
    // SAFETY: Only queue tweet generation in production
    if (env.WEBAPP_ENV !== WebAppEnvs.PROD) {
      log.info(`[JobOrchestration] Skipping tweet generation in ${env.WEBAPP_ENV} environment for job ${jobId}`);
      return;
    }

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayTweets = await db
        .select()
        .from(tables.scheduledTweet)
        .where(gte(tables.scheduledTweet.createdAt, todayStart))
        .all();

      if (todayTweets.length >= MAX_TWEETS_PER_DAY) {
        log.info(
          `[JobOrchestration] Daily tweet limit reached (${todayTweets.length}/${MAX_TWEETS_PER_DAY}), skipping tweet generation for job ${jobId}`,
        );
        return;
      }

      await env.TWEET_POSTING_QUEUE.send({
        jobId,
        messageId: `generate-tweet-${jobId}`,
        queuedAt: new Date().toISOString(),
        threadId,
        type: TweetPostingMessageTypes.GENERATE_TWEET,
        userId: job.userId,
      } satisfies GenerateTweetQueueMessage);

      log.info(`[JobOrchestration] Queued tweet generation for completed job ${jobId}`);
    } catch (tweetErr) {
      // Tweet generation failure is non-critical - job is already completed
      log.error(
        `[JobOrchestration] Failed to queue tweet generation for job ${jobId}: ${tweetErr instanceof Error ? tweetErr.message : String(tweetErr)}`,
      );
    }
  } catch {
    // Error during completion - job state already reflects failure in metadata
  }
}

/**
 * Check if a thread belongs to an automated job and if it needs continuation
 *
 * Called from two paths (belt-and-suspenders for reliability):
 * 1. PRIMARY: Unified stream handler's onComplete callback (same worker that completed stream)
 * 2. FALLBACK: Queue consumer after draining the SSE stream
 *
 * IDEMPOTENCY: Guards against duplicate calls by checking job.currentRound matches
 * the completed roundNumber. If the job has already advanced past this round,
 * continuation was already queued by a previous call.
 */
export async function checkJobContinuation(
  threadId: string,
  roundNumber: number,
  sessionToken: string,
  db: Awaited<ReturnType<typeof getDbAsync>>,
  queue: Queue,
): Promise<boolean> {
  const job = await db.query.automatedJob.findFirst({
    where: eq(tables.automatedJob.threadId, threadId),
  });

  if (job?.status !== AutomatedJobStatuses.RUNNING) {
    return false;
  }

  // Idempotency guard: only queue continuation if job is still on the completed round.
  // If job.currentRound > roundNumber, continuation was already queued by a previous call.
  if (job.currentRound !== roundNumber) {
    log.info(`[JobContinuation] Skipping duplicate for job ${job.id} (job round ${job.currentRound}, completed round ${roundNumber})`);
    return false;
  }

  await queue.send({
    currentRound: roundNumber,
    jobId: job.id,
    messageId: `continue-${job.id}-r${roundNumber}`,
    queuedAt: new Date().toISOString(),
    sessionToken,
    threadId,
    type: RoundOrchestrationMessageTypes.CONTINUE_AUTOMATED_JOB,
    userId: job.userId,
  } satisfies ContinueAutomatedJobQueueMessage);

  log.info(`[JobContinuation] Queued continuation for job ${job.id} from round ${roundNumber}`);

  return true;
}

/**
 * Mark stale jobs as failed
 *
 * Finds PENDING or RUNNING jobs with no activity for STALE_JOB_THRESHOLD_MS (2 hours)
 * and marks them as FAILED. Called by scheduled cron to prevent zombie jobs.
 */
export async function markStaleJobsAsFailed(
  db: Awaited<ReturnType<typeof getDbAsync>>,
): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);

  // Find stale PENDING or RUNNING jobs
  const staleJobs = await db
    .select()
    .from(tables.automatedJob)
    .where(
      and(
        inArray(tables.automatedJob.status, [
          AutomatedJobStatuses.PENDING,
          AutomatedJobStatuses.RUNNING,
        ]),
        lt(tables.automatedJob.updatedAt, staleThreshold),
      ),
    )
    .all();

  if (staleJobs.length === 0) {
    return 0;
  }

  const now = new Date();

  // Mark each stale job as failed, preserving existing metadata
  for (const staleJob of staleJobs) {
    await db
      .update(tables.automatedJob)
      .set({
        metadata: {
          ...staleJob.metadata,
          errorMessage: `Job stale: no activity for ${STALE_JOB_THRESHOLD_MS / 1000 / 60} minutes`,
        },
        status: AutomatedJobStatuses.FAILED,
        updatedAt: now,
      })
      .where(eq(tables.automatedJob.id, staleJob.id));
  }

  log.info(`[JobOrchestration] Marked ${staleJobs.length} stale jobs as failed`);

  return staleJobs.length;
}
