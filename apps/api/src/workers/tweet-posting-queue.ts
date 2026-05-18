/**
 * Tweet Posting Queue Consumer
 *
 * Cloudflare Queue consumer for tweet generation and posting.
 * Handles two message types:
 * - post-tweet: Posts a scheduled tweet to Twitter via API
 * - generate-tweet: Generates tweet content from a completed thread via AI
 *
 * Following established patterns from:
 * - src/workers/round-orchestration-queue.ts (queue consumer pattern)
 *
 * IMPORTANT: Uses dynamic imports to prevent heavy modules from being bundled
 * at worker startup. This prevents "Script startup exceeded CPU limits" deployment errors.
 *
 * @see https://developers.cloudflare.com/queues/
 * @see src/types/queues.ts for message schemas
 */

import type { Message, MessageBatch } from '@cloudflare/workers-types';
import { ScheduledTweetStatuses, TweetPostingMessageTypes, TweetSources, WebAppEnvs } from '@debatekit/shared/enums';

import { log } from '@/lib/logger';
import { calculateExponentialBackoff } from '@/lib/utils/queue-utils';
import type {
  GenerateTweetQueueMessage,
  PostTweetQueueMessage,
  TweetPostingQueueMessage,
} from '@/types/queues';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Max retry delay in seconds (cap for exponential backoff) */
const MAX_RETRY_DELAY_SECONDS = 300;

/** Base retry delay in seconds */
const BASE_RETRY_DELAY_SECONDS = 60;

/** Max post retries before marking tweet as permanently failed */
const MAX_POST_RETRIES = 5;

// ============================================================================
// MESSAGE PROCESSORS
// ============================================================================

/**
 * Post a scheduled tweet to Twitter
 *
 * 1. Load tweet from DB by tweetId
 * 2. Validate status is 'scheduled' or 'draft'
 * 3. Get Twitter config from env
 * 4. Call postTweet(config, tweet.content)
 * 5. Update tweet status to 'sent', set sentAt, store twitterPostId
 * 6. On failure: update status to 'failed', store error in metadata
 */
async function handlePostTweet(
  message: PostTweetQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  // SAFETY: Only post tweets in production — never from local/preview
  if (env.WEBAPP_ENV !== WebAppEnvs.PROD) {
    log.warn(`[TweetPostingQueue] Blocked tweet posting in ${env.WEBAPP_ENV} environment`);
    return;
  }

  const { tweetId } = message;

  // Lazy-load DB and services
  const { getDbAsync } = await import('@/db');
  const { eq } = await import('drizzle-orm');
  const tables = await import('@/db/tables');
  const { getTwitterConfig, postTweet } = await import('@/services/tweets');

  const db = await getDbAsync();

  // 1. Load tweet from DB
  const tweet = await db
    .select()
    .from(tables.scheduledTweet)
    .where(eq(tables.scheduledTweet.id, tweetId))
    .get();

  if (!tweet) {
    log.warn(`[TweetPostingQueue] Tweet ${tweetId} not found, skipping`);
    return;
  }

  // 2. Validate status
  if (tweet.status !== ScheduledTweetStatuses.SCHEDULED && tweet.status !== ScheduledTweetStatuses.DRAFT) {
    log.info(`[TweetPostingQueue] Tweet ${tweetId} status is '${tweet.status}', skipping`);
    return;
  }

  try {
    // 3. Get Twitter config from env
    const config = getTwitterConfig(env);

    // 4. Post to Twitter
    const result = await postTweet(config, tweet.content);

    // 6. Update tweet status to 'sent'
    await db
      .update(tables.scheduledTweet)
      .set({
        sentAt: new Date(),
        status: ScheduledTweetStatuses.SENT,
        twitterPostId: result.tweetId,
      })
      .where(eq(tables.scheduledTweet.id, tweetId));

    log.info(`[TweetPostingQueue] Tweet ${tweetId} posted successfully (twitter: ${result.tweetId})`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    const { DbScheduledTweetMetadataSchema } = await import('@/db/schemas/tweet-metadata');
    const { AppError } = await import('@/common/error-handling');
    const currentMetadata = DbScheduledTweetMetadataSchema.parse(tweet.metadata ?? {});
    const newRetryCount = (currentMetadata.retryCount ?? 0) + 1;

    // Non-retryable errors: client errors (4xx) like character limit violations,
    // validation failures, content policy rejections. These won't fix themselves on retry.
    const isNonRetryable = error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500;

    if (isNonRetryable) {
      await db
        .update(tables.scheduledTweet)
        .set({
          metadata: {
            ...currentMetadata,
            errorMessage: errMsg.slice(0, 500),
            retryCount: newRetryCount,
          },
          status: ScheduledTweetStatuses.FAILED,
        })
        .where(eq(tables.scheduledTweet.id, tweetId));

      log.error(`[TweetPostingQueue] Tweet ${tweetId} permanently failed (non-retryable): ${errMsg}`);
      return;
    }

    // Retryable errors: server errors, network issues, rate limits
    const isExhausted = newRetryCount >= MAX_POST_RETRIES;

    await db
      .update(tables.scheduledTweet)
      .set({
        metadata: {
          ...currentMetadata,
          errorMessage: errMsg.slice(0, 500),
          retryCount: newRetryCount,
        },
        status: isExhausted ? ScheduledTweetStatuses.FAILED : ScheduledTweetStatuses.SCHEDULED,
      })
      .where(eq(tables.scheduledTweet.id, tweetId));

    if (isExhausted) {
      log.error(`[TweetPostingQueue] Tweet ${tweetId} permanently failed after ${newRetryCount} retries: ${errMsg}`);
      return;
    }

    log.warn(`[TweetPostingQueue] Tweet ${tweetId} retry ${newRetryCount}/${MAX_POST_RETRIES}: ${errMsg}`);

    // Re-throw to trigger queue retry (tweet stays 'scheduled' so retry will process it)
    throw error;
  }
}

/**
 * Generate a tweet from a completed automated job's thread
 *
 * 1. Load job and thread from DB
 * 2. Get thread slug
 * 3. Call craftTweetFromThread(threadId, threadSlug, db, env)
 * 4. Calculate next rush hour slot
 * 5. Insert new scheduled_tweet record with status='scheduled'
 */
async function handleGenerateTweet(
  message: GenerateTweetQueueMessage,
  env: CloudflareEnv,
): Promise<void> {
  // SAFETY: Only generate tweets in production — never from local/preview
  if (env.WEBAPP_ENV !== WebAppEnvs.PROD) {
    log.warn(`[TweetPostingQueue] Blocked tweet generation in ${env.WEBAPP_ENV} environment`);
    return;
  }

  const { jobId, threadId, userId } = message;

  // Lazy-load DB and services
  const { getDbAsync } = await import('@/db');
  const { eq } = await import('drizzle-orm');
  const tables = await import('@/db/tables');
  const { craftTweetFromThread, getNextRushHourSlot } = await import('@/services/tweets');

  const db = await getDbAsync();

  // 1. Load job and thread from DB
  const job = await db
    .select()
    .from(tables.automatedJob)
    .where(eq(tables.automatedJob.id, jobId))
    .get();

  if (!job) {
    log.warn(`[TweetPostingQueue] Job ${jobId} not found, skipping`);
    return;
  }

  const thread = await db
    .select()
    .from(tables.chatThread)
    .where(eq(tables.chatThread.id, threadId))
    .get();

  if (!thread) {
    log.warn(`[TweetPostingQueue] Thread ${threadId} not found, skipping`);
    return;
  }

  // 2. Get thread slug
  const threadSlug = thread.slug;

  // 3. Generate tweet content via AI
  const { style: tweetStyle, text: tweetContent } = await craftTweetFromThread(threadId, threadSlug, db, env);

  // 4. Calculate next rush hour slot
  const scheduledAt = getNextRushHourSlot();

  // 6. Insert new scheduled_tweet record
  const { ulid } = await import('ulid');
  const tweetId = ulid();

  await db
    .insert(tables.scheduledTweet)
    .values({
      content: tweetContent,
      id: tweetId,
      jobId,
      metadata: { tweetStyle },
      scheduledAt,
      source: TweetSources.AUTOMATED_JOB,
      status: ScheduledTweetStatuses.SCHEDULED,
      threadId,
      userId,
    });

  log.info(`[TweetPostingQueue] Generated tweet ${tweetId} for job ${jobId}, scheduled at ${scheduledAt.toISOString()}`);
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
  msg: Message<TweetPostingQueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  try {
    const { body } = msg;
    const messageType = body.type;

    // Lazy-load schemas to avoid startup CPU limit
    const {
      GenerateTweetQueueMessageSchema,
      PostTweetQueueMessageSchema,
    } = await import('@/types/queues');

    // Validate and narrow types using Zod schemas
    if (messageType === TweetPostingMessageTypes.POST_TWEET) {
      const parsed = PostTweetQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await handlePostTweet(parsed.data, env);
      } else {
        throw new Error(`Invalid post-tweet message: ${parsed.error.message}`);
      }
    } else if (messageType === TweetPostingMessageTypes.GENERATE_TWEET) {
      const parsed = GenerateTweetQueueMessageSchema.safeParse(body);
      if (parsed.success) {
        await handleGenerateTweet(parsed.data, env);
      } else {
        throw new Error(`Invalid generate-tweet message: ${parsed.error.message}`);
      }
    } else {
      throw new Error(`Unhandled message type: ${messageType}`);
    }

    msg.ack();
  } catch (error) {
    const messageType = msg.body.type;
    const identifier = 'tweetId' in msg.body ? msg.body.tweetId : ('jobId' in msg.body ? msg.body.jobId : 'unknown');

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
 * Processes batches of tweet posting messages.
 * Called by Cloudflare when messages are available in the queue.
 *
 * Note: batch_size is set to 1 in wrangler.jsonc to ensure
 * sequential processing and avoid rate limits.
 */
export async function handleTweetPostingQueue(
  batch: MessageBatch<TweetPostingQueueMessage>,
  env: CloudflareEnv,
): Promise<void> {
  for (const msg of batch.messages) {
    await processQueueMessage(msg, env);
  }
}
