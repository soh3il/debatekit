/**
 * Podcast Generation Queue Consumer
 *
 * Cloudflare Queue consumer for async podcast generation after round completion.
 * Uses existing triggerPodcastGeneration service — no duplicate logic.
 *
 * IMPORTANT: Uses dynamic imports to prevent AI SDK / ElevenLabs from being bundled
 * at worker startup. Lazy-loaded when processing messages.
 *
 * @see src/services/podcast/trigger.service.ts
 * @see https://developers.cloudflare.com/queues/
 */

import type { Message, MessageBatch } from '@cloudflare/workers-types';

import { log } from '@/lib/logger';
import { calculateExponentialBackoff } from '@/lib/utils/queue-utils';
import { ElevenLabsApiError } from '@/services/podcast/elevenlabs.service';
import type { PodcastGenerationQueueMessage } from '@/types/queues';

// IMPORTANT: No static imports of podcast services here!
// Use dynamic imports in processMessage() to lazy-load heavy deps

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Max retry delay in seconds (cap for exponential backoff) */
const MAX_RETRY_DELAY_SECONDS = 600;

/** Base retry delay in seconds */
const BASE_RETRY_DELAY_SECONDS = 120;

// ============================================================================
// MESSAGE PROCESSOR
// ============================================================================

/**
 * Process a single podcast generation message.
 * Uses dynamic import() to lazy-load podcast service.
 */
async function processMessage(
  message: PodcastGenerationQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  const { roundNumber, threadId, userId } = message;

  // Defense-in-depth: verify user is still an admin before processing
  const { getDbAsync, user } = await import('@/db');
  const { eq } = await import('drizzle-orm');
  const { UserRoles } = await import('@debatekit/shared/enums');

  const db = await getDbAsync();
  const dbUser = await db.query.user.findFirst({
    columns: { role: true },
    where: eq(user.id, userId),
  });

  if (dbUser?.role !== UserRoles.ADMIN) {
    log.info('[PODCAST_QUEUE] Skipping non-admin user', { roundNumber, threadId, userId });
    return;
  }

  // Dynamic import to lazy-load heavy deps (ElevenLabs, AI SDK, etc.)
  const { triggerPodcastGeneration } = await import('@/services/podcast');

  await triggerPodcastGeneration({
    elevenLabsApiKey: env.ELEVENLABS_API_KEY,
    env,
    r2Bucket: env.UPLOADS_R2_BUCKET,
    roundNumber,
    threadId,
    userId,
  });
}

// ============================================================================
// QUEUE CONSUMER HANDLER
// ============================================================================

/**
 * Queue Consumer Handler
 *
 * Processes batches of podcast generation messages.
 * Called by Cloudflare when messages are available in the queue.
 */
export async function handlePodcastGenerationQueue(
  batch: MessageBatch<PodcastGenerationQueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  for (const msg of batch.messages) {
    await processQueueMessage(msg, env);
  }
}

/**
 * Process a single queue message with error handling
 */
async function processQueueMessage(
  msg: Message<PodcastGenerationQueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  try {
    await processMessage(msg.body, env);
    msg.ack();
  } catch (error) {
    const isNonRetryable = error instanceof ElevenLabsApiError && !error.retryable;

    log.queue('error', `[PODCAST_QUEUE] Failed thread ${msg.body.threadId} round ${msg.body.roundNumber}`, {
      error: error instanceof Error ? error.message : String(error),
      retryable: !isNonRetryable,
      roundNumber: msg.body.roundNumber,
      statusCode: error instanceof ElevenLabsApiError ? error.statusCode : undefined,
      threadId: msg.body.threadId,
    });

    if (isNonRetryable) {
      // Non-retryable errors (401, 403, 422) — ack to stop retries
      msg.ack();
      return;
    }

    // Exponential backoff using shared utility
    const retryDelaySeconds = calculateExponentialBackoff(
      msg.attempts,
      BASE_RETRY_DELAY_SECONDS,
      MAX_RETRY_DELAY_SECONDS,
    );
    msg.retry({ delaySeconds: retryDelaySeconds });
  }
}
