/**
 * Round Orchestration Queue Consumer
 *
 * Cloudflare Queue consumer for guaranteed participant/moderator triggering.
 * Replaces waitUntil(fetch) pattern with queue-based orchestration for reliability.
 *
 * Key benefits:
 * - Guaranteed delivery: Queue retries on worker timeout
 * - Decoupled execution: Streams complete regardless of original request lifecycle
 * - Retry semantics: Exponential backoff for transient failures
 *
 * Following established patterns from:
 * - src/workers/title-generation-queue.ts (queue consumer pattern)
 * - src/api/routes/chat/handlers/streaming.handler.ts (trigger pattern)
 *
 * @see https://developers.cloudflare.com/queues/
 * @see src/api/types/queues.ts for message schemas
 */

/**
 * IMPORTANT: Uses dynamic imports to prevent heavy schema files from being bundled
 * at worker startup. The chat schema (1861+ lines) is only loaded when needed.
 * This prevents "Script startup exceeded CPU limits" deployment errors.
 */

import type { Message, MessageBatch } from '@cloudflare/workers-types';
import { z } from '@hono/zod-openapi';
import { MessagePartTypes, RoundOrchestrationMessageTypes, UIMessageRoles } from '@debatekit/shared/enums';

import { log } from '@/lib/logger';
import { buildInternalAuthHeaders, drainStream, getBaseUrl } from '@/lib/utils/internal-api';
import { calculateExponentialBackoff } from '@/lib/utils/queue-utils';
import type {
  CheckRoundCompletionQueueMessage,
  CompleteAutomatedJobQueueMessage,
  ContinueAutomatedJobQueueMessage,
  RoundOrchestrationQueueMessage,
  RunContentPipelineQueueMessage,
  StartAutomatedJobQueueMessage,
  TriggerModeratorQueueMessage,
  TriggerParticipantQueueMessage,
  TriggerPreSearchQueueMessage,
} from '@/types/queues';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Max retry delay in seconds (cap for exponential backoff) */
const MAX_RETRY_DELAY_SECONDS = 300;

/** Base retry delay in seconds */
const BASE_RETRY_DELAY_SECONDS = 60;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * JSON-safe value schema for API response envelope data.
 *
 * Constrains values to JSON primitives instead of z.unknown().
 * The actual data is validated by RoundStatusSchema.safeParse() after
 * envelope validation. RoundStatusSchema is lazy-loaded to avoid
 * bundling the 1861+ line chat schema at worker startup.
 *
 * RoundStatus contains: string, number, boolean, null, string[]
 */
const JsonPrimitiveValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
]);

/**
 * Schema for wrapped API response structure.
 * Internal API calls return { data: T, success: true } on success.
 * We only validate the data field exists - actual data validation
 * is done by RoundStatusSchema.safeParse(json.data).
 */
const WrappedApiResponseSchema = z.object({
  data: z.record(z.string(), JsonPrimitiveValueSchema),
  success: z.literal(true).optional(),
}).strict();

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Trigger a unified round stream and drain to completion
 *
 * Calls POST /api/v1/chat/threads/{threadId}/rounds/{roundNumber}/unified-stream
 * which executes ALL phases inline: presearch -> participants -> moderator.
 *
 * After draining, checks if this thread belongs to an automated job
 * and queues continuation to the next round if needed.
 *
 * Handles 400 ROUND_MISMATCH gracefully (round already complete).
 */
async function triggerUnifiedRoundStream(
  threadId: string,
  roundNumber: number,
  userId: string,
  sessionToken: string,
  env: CloudflareEnv,
): Promise<void> {
  const baseUrl = getBaseUrl(env);

  const requestBody = {
    attachmentIds: [],
    message: {
      parts: [{ text: '', type: MessagePartTypes.TEXT }],
      role: UIMessageRoles.USER,
    },
  };

  const response = await fetch(
    `${baseUrl}/api/v1/chat/threads/${threadId}/rounds/${roundNumber}/unified-stream`,
    {
      body: JSON.stringify(requestBody),
      headers: buildInternalAuthHeaders(userId, env),
      method: 'POST',
    },
  );

  // Handle ROUND_MISMATCH: round already complete, not an error
  if (response.status === 400) {
    const errorBody = await response.json().catch(() => null);
    if (errorBody && typeof errorBody === 'object' && 'error' in errorBody && errorBody.error === 'ROUND_MISMATCH') {
      return;
    }
    const errorText = JSON.stringify(errorBody);
    throw new Error(`Unified stream returned 400: ${errorText}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to trigger unified stream: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // Drain the stream - unified stream runs ALL phases (presearch + participants + moderator)
  try {
    await drainStream(response);
  } catch (drainErr) {
    log.queue('warn', `Stream drain error for ${threadId} r${roundNumber} (non-fatal)`, {
      error: drainErr instanceof Error ? drainErr.message : String(drainErr),
      roundNumber,
      threadId,
    });
  }

  // Check if this thread belongs to an automated job and queue continuation.
  // NOTE: This is a FALLBACK path. The primary job continuation check now runs
  // inside the unified stream handler's onComplete callback (same worker that
  // completed the stream). This fallback catches edge cases where onComplete
  // didn't fire (e.g., stream error before completion).
  try {
    const { checkJobContinuation } = await import('@/services/jobs');
    const { getDbAsync } = await import('@/db');
    const db = await getDbAsync();

    await checkJobContinuation(threadId, roundNumber, sessionToken, db, env.ROUND_ORCHESTRATION_QUEUE);
  } catch (err) {
    log.queue('error', `[JobContinuation] Fallback check failed for ${threadId} r${roundNumber}`, {
      error: err instanceof Error ? err.message : String(err),
      roundNumber,
      threadId,
    });
  }
}

// ============================================================================
// MESSAGE PROCESSORS
// ============================================================================

/**
 * Check if participant should still be triggered
 * Returns true if participant should be triggered, false if round is already complete
 *
 * IMPORTANT: This check is intentionally minimal - we only skip if ALL participants
 * are done (completed + failed >= total). We do NOT check:
 * - nextParticipantIndex (excludes "triggered" participants, breaking direct triggers)
 * - Individual participant status (status endpoint doesn't return per-participant map)
 *
 * The streaming endpoint has its own idempotency protection via ACTIVE status in KV,
 * which prevents the same participant from streaming twice.
 */
async function shouldTriggerParticipant(
  threadId: string,
  roundNumber: number,
  _participantIndex: number,
  userId: string,
  env: CloudflareEnv,
): Promise<boolean> {
  const baseUrl = getBaseUrl(env);

  try {
    const stateResponse = await fetch(
      `${baseUrl}/api/v1/chat/threads/${threadId}/rounds/${roundNumber}/status`,
      {
        headers: buildInternalAuthHeaders(userId, env),
        method: 'GET',
      },
    );

    if (!stateResponse.ok) {
      // If status check fails, proceed with trigger (fail-open for reliability)
      // The streaming endpoint has its own duplicate protection
      return true;
    }

    // Lazy-load schema to avoid startup CPU limit
    const { RoundStatusSchema } = await import('@/routes/chat/schema');

    // Parse wrapped API response: { data: RoundStatus, success: true }
    const wrapperResult = WrappedApiResponseSchema.safeParse(await stateResponse.json());
    if (!wrapperResult.success) {
      // Invalid response structure - proceed with trigger
      return true;
    }

    const parseResult = RoundStatusSchema.safeParse(wrapperResult.data.data);
    if (!parseResult.success) {
      // Invalid response - proceed with trigger
      return true;
    }

    const roundState = parseResult.data;

    // ✅ IDEMPOTENCY: Only skip if ALL participants are done
    // This is a minimal check - let the streaming endpoint handle per-participant idempotency
    const allParticipantsDone = (roundState.completedParticipants + roundState.failedParticipants) >= roundState.totalParticipants;
    if (allParticipantsDone) {
      return false;
    }

    return true;
  } catch {
    // On error, proceed with trigger - streaming endpoint will handle duplicates
    return true;
  }
}

/**
 * Trigger a participant stream via unified round stream
 */
async function triggerParticipantStream(
  message: TriggerParticipantQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { participantIndex, roundNumber, sessionToken, threadId, userId } = message;

  // ✅ IDEMPOTENCY GUARD: Check if participant should still be triggered
  const shouldTrigger = await shouldTriggerParticipant(
    threadId,
    roundNumber,
    participantIndex,
    userId,
    env,
  );

  if (!shouldTrigger) {
    // Round already complete (e.g., from a previous attempt that timed out).
    // Still check for job continuation - the previous attempt may have completed
    // the round but failed to queue the continuation message.
    try {
      const { checkJobContinuation } = await import('@/services/jobs');
      const { getDbAsync } = await import('@/db');
      const db = await getDbAsync();

      await checkJobContinuation(threadId, roundNumber, sessionToken, db, env.ROUND_ORCHESTRATION_QUEUE);
    } catch (err) {
      log.queue('error', `[JobContinuation] Recovery check failed for ${threadId} r${roundNumber}`, {
        error: err instanceof Error ? err.message : String(err),
        roundNumber,
        threadId,
      });
    }
    return;
  }

  // Unified stream handles ALL phases (presearch + participants + moderator)
  // and checks job continuation after completion
  await triggerUnifiedRoundStream(threadId, roundNumber, userId, sessionToken, env);
}

/**
 * Trigger a moderator stream via unified round stream (recovery path)
 *
 * Called from checkRoundCompletion when participants are done but moderator hasn't run.
 * The unified stream handles ROUND_MISMATCH gracefully if the round is already complete.
 */
async function triggerModeratorStream(
  message: TriggerModeratorQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { roundNumber, sessionToken, threadId, userId } = message;

  // Unified stream handles ALL phases - if round is already partially complete,
  // it may return ROUND_MISMATCH which triggerUnifiedRoundStream handles gracefully
  await triggerUnifiedRoundStream(threadId, roundNumber, userId, sessionToken, env);
}

/**
 * Trigger pre-search via unified round stream
 *
 * Pre-search is handled internally by the unified stream when enableWebSearch
 * is true on the thread. The unified stream runs all phases inline.
 */
async function triggerPreSearch(
  message: TriggerPreSearchQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { roundNumber, sessionToken, threadId, userId } = message;

  // Pre-search is handled internally by the unified stream when enableWebSearch is true on the thread
  await triggerUnifiedRoundStream(threadId, roundNumber, userId, sessionToken, env);
}

// ============================================================================
// AUTOMATED JOB PROCESSORS
// ============================================================================

/**
 * Start an automated job - create thread, select models, queue first round
 */
async function handleStartAutomatedJob(
  message: StartAutomatedJobQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { jobId, sessionToken } = message;

  // Lazy-load job orchestration service and DB
  const { startAutomatedJob } = await import('@/services/jobs');
  const { getDbAsync } = await import('@/db');

  const db = await getDbAsync();
  await startAutomatedJob(jobId, sessionToken, db, env, env.ROUND_ORCHESTRATION_QUEUE);
}

/**
 * Continue an automated job to the next round
 */
async function handleContinueAutomatedJob(
  message: ContinueAutomatedJobQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { currentRound, jobId, sessionToken, threadId } = message;

  // Lazy-load job orchestration service and DB
  const { continueAutomatedJob } = await import('@/services/jobs');
  const { getDbAsync } = await import('@/db');

  const db = await getDbAsync();
  await continueAutomatedJob(jobId, threadId, currentRound, sessionToken, db, env, env.ROUND_ORCHESTRATION_QUEUE);
}

/**
 * Complete an automated job - mark done, optionally publish, queue tweet generation
 */
async function handleCompleteAutomatedJob(
  message: CompleteAutomatedJobQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { autoPublish, jobId, threadId } = message;

  // Lazy-load job orchestration service and DB
  const { completeAutomatedJob } = await import('@/services/jobs');
  const { getDbAsync } = await import('@/db');

  const db = await getDbAsync();
  await completeAutomatedJob(jobId, threadId, autoPublish, db, env);
}

/**
 * Check round completion and trigger next step if needed
 *
 * This handler:
 * 1. Validates recovery attempts to prevent infinite loops
 * 2. Gets current round state from internal API
 * 3. Determines what needs to happen next
 * 4. Queues appropriate trigger message
 *
 * IMPORTANT: Uses dynamic import for RoundStatusSchema to avoid
 * loading 1861+ line schema file at worker startup.
 */
async function checkRoundCompletion(
  message: CheckRoundCompletionQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { roundNumber, sessionToken, threadId, userId } = message;
  const baseUrl = getBaseUrl(env);

  // Get round state via internal API (this validates recovery attempts server-side)
  const stateResponse = await fetch(
    `${baseUrl}/api/v1/chat/threads/${threadId}/rounds/${roundNumber}/status`,
    {
      headers: buildInternalAuthHeaders(userId, env),
      method: 'GET',
    },
  );

  // Debug: log response details
  const contentType = stateResponse.headers.get('content-type') || 'unknown';
  const statusCode = stateResponse.status;

  if (!stateResponse.ok) {
    // 404 means round doesn't exist or is complete - not an error
    if (stateResponse.status === 404) {
      return;
    }
    throw new Error(`Failed to get round status: ${stateResponse.status} ${stateResponse.statusText}`);
  }

  // Lazy-load schema to avoid startup CPU limit
  const { RoundStatusSchema } = await import('@/routes/chat/schema');

  // Parse wrapped API response: { data: RoundStatus, success: true }
  const jsonBody = await stateResponse.json();
  const wrapperResult = WrappedApiResponseSchema.safeParse(jsonBody);
  if (!wrapperResult.success) {
    // Debug: show what we received when wrapper validation fails
    const received = JSON.stringify(jsonBody).slice(0, 500);
    throw new Error(`Invalid round status response wrapper. Status=${statusCode} ContentType=${contentType} Received=${received}. Errors: ${wrapperResult.error.message}`);
  }

  // Validate response with Zod schema - single source of truth
  const parseResult = RoundStatusSchema.safeParse(wrapperResult.data.data);
  if (!parseResult.success) {
    // Debug: Log what we actually received to diagnose the issue
    const received = JSON.stringify(jsonBody).slice(0, 500);
    const dataKeys = Object.keys(wrapperResult.data.data).join(',');
    throw new Error(`Invalid round status. Keys=[${dataKeys}] Received: ${received}. Errors: ${parseResult.error.message}`);
  }
  const roundState = parseResult.data;

  // Check if recovery is allowed
  if (!roundState.canRecover) {
    return;
  }

  // Determine next action based on round state
  if (roundState.needsPreSearch && roundState.userQuery) {
    // Pre-search needed - queue pre-search trigger
    await env.ROUND_ORCHESTRATION_QUEUE.send({
      attachmentIds: roundState.attachmentIds,
      messageId: `trigger-${threadId}-r${roundNumber}-presearch-${Date.now()}`,
      queuedAt: new Date().toISOString(),
      roundNumber,
      sessionToken,
      threadId,
      type: RoundOrchestrationMessageTypes.TRIGGER_PRE_SEARCH,
      userId: message.userId,
      userQuery: roundState.userQuery,
    } satisfies TriggerPreSearchQueueMessage);
  } else if (roundState.nextParticipantIndex !== null) {
    // Participant needed - queue participant trigger
    await env.ROUND_ORCHESTRATION_QUEUE.send({
      attachmentIds: roundState.attachmentIds,
      messageId: `trigger-${threadId}-r${roundNumber}-p${roundState.nextParticipantIndex}-${Date.now()}`,
      participantIndex: roundState.nextParticipantIndex,
      queuedAt: new Date().toISOString(),
      roundNumber,
      sessionToken,
      threadId,
      type: RoundOrchestrationMessageTypes.TRIGGER_PARTICIPANT,
      userId: message.userId,
    } satisfies TriggerParticipantQueueMessage);
  } else if (roundState.needsModerator) {
    // Moderator needed - queue moderator trigger
    await env.ROUND_ORCHESTRATION_QUEUE.send({
      messageId: `trigger-${threadId}-r${roundNumber}-moderator-${Date.now()}`,
      queuedAt: new Date().toISOString(),
      roundNumber,
      sessionToken,
      threadId,
      type: RoundOrchestrationMessageTypes.TRIGGER_MODERATOR,
      userId: message.userId,
    } satisfies TriggerModeratorQueueMessage);
  } else {
    // Round is complete or in unknown state
  }
}

// ============================================================================
// CONTENT PIPELINE PROCESSOR
// ============================================================================

/**
 * Run the content pipeline (trend discovery -> scoring -> job creation -> queue)
 *
 * Triggered by admin manual run or cron schedule.
 * The pipeline creates automated jobs and queues them for execution.
 */
async function handleRunContentPipeline(
  message: RunContentPipelineQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { customTopics, maxTopics, runId, triggerType } = message;

  // Lazy-load pipeline service and DB
  const { runContentPipeline } = await import('@/services/pipeline/content-pipeline.service');
  const { getDbAsync } = await import('@/db');

  const db = await getDbAsync();
  await runContentPipeline(db, env, triggerType, runId, { customTopics, maxTopics });
}

// ============================================================================
// QUEUE CONSUMER HANDLER
// ============================================================================

/**
 * Process a single queue message with error handling and retry logic
 *
 * IMPORTANT: Uses dynamic imports for Zod schemas to avoid loading
 * heavy schema files at worker startup.
 */
async function processQueueMessage(
  msg: Message<RoundOrchestrationQueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  try {
    const { body } = msg;
    const messageType = body.type;

    // Lazy-load schemas to avoid startup CPU limit
    const {
      CheckRoundCompletionQueueMessageSchema,
      CompleteAutomatedJobQueueMessageSchema,
      ContinueAutomatedJobQueueMessageSchema,
      RunContentPipelineQueueMessageSchema,
      StartAutomatedJobQueueMessageSchema,
      TriggerModeratorQueueMessageSchema,
      TriggerParticipantQueueMessageSchema,
      TriggerPreSearchQueueMessageSchema,
    } = await import('@/types/queues');

    // Validate and narrow types using Zod schemas for proper TypeScript inference
    if (messageType === 'trigger-participant') {
      const parsed = TriggerParticipantQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await triggerParticipantStream(parsed.data, env);
      } else {
        throw new Error(`Invalid trigger-participant message: ${parsed.error.message}`);
      }
    } else if (messageType === 'trigger-moderator') {
      const parsed = TriggerModeratorQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await triggerModeratorStream(parsed.data, env);
      } else {
        throw new Error(`Invalid trigger-moderator message: ${parsed.error.message}`);
      }
    } else if (messageType === 'check-round-completion') {
      const parsed = CheckRoundCompletionQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await checkRoundCompletion(parsed.data, env);
      } else {
        throw new Error(`Invalid check-round-completion message: ${parsed.error.message}`);
      }
    } else if (messageType === 'trigger-pre-search') {
      const parsed = TriggerPreSearchQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await triggerPreSearch(parsed.data, env);
      } else {
        throw new Error(`Invalid trigger-pre-search message: ${parsed.error.message}`);
      }
    } else if (messageType === 'start-automated-job') {
      const parsed = StartAutomatedJobQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await handleStartAutomatedJob(parsed.data, env);
      } else {
        throw new Error(`Invalid start-automated-job message: ${parsed.error.message}`);
      }
    } else if (messageType === 'continue-automated-job') {
      const parsed = ContinueAutomatedJobQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await handleContinueAutomatedJob(parsed.data, env);
      } else {
        throw new Error(`Invalid continue-automated-job message: ${parsed.error.message}`);
      }
    } else if (messageType === 'complete-automated-job') {
      const parsed = CompleteAutomatedJobQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await handleCompleteAutomatedJob(parsed.data, env);
      } else {
        throw new Error(`Invalid complete-automated-job message: ${parsed.error.message}`);
      }
    } else if (messageType === 'run-content-pipeline') {
      const parsed = RunContentPipelineQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await handleRunContentPipeline(parsed.data, env);
      } else {
        throw new Error(`Invalid run-content-pipeline message: ${parsed.error.message}`);
      }
    } else {
      throw new Error(`Unhandled message type: ${messageType}`);
    }

    msg.ack();
  } catch (error) {
    const messageType = msg.body.type;
    // threadId exists on most message types except start-automated-job which has jobId
    const identifier = 'threadId' in msg.body ? msg.body.threadId : ('jobId' in msg.body ? msg.body.jobId : 'unknown');

    log.queue('error', `Failed ${messageType} for ${identifier}`, {
      error: error instanceof Error ? error.message : String(error),
      identifier,
      messageType,
    });

    // Exponential backoff using shared utility
    const retryDelaySeconds = calculateExponentialBackoff(
      msg.attempts,
      BASE_RETRY_DELAY_SECONDS,
      MAX_RETRY_DELAY_SECONDS,
    );

    msg.retry({ delaySeconds: retryDelaySeconds });
  }
}

/**
 * Queue Consumer Handler
 *
 * Processes batches of round orchestration messages.
 * Called by Cloudflare when messages are available in the queue.
 *
 * Note: batch_size is set to 1 in wrangler.jsonc to ensure
 * sequential processing within a round.
 */
export async function handleRoundOrchestrationQueue(
  batch: MessageBatch<RoundOrchestrationQueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  for (const msg of batch.messages) {
    await processQueueMessage(msg, env);
  }
}
