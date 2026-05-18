/**
 * Tweet Cron Service
 *
 * Processes scheduled tweets whose scheduledAt time has passed.
 * Called by a cron trigger to auto-post due tweets via the tweet posting queue.
 *
 * Also retries recently-failed tweets and cancels stale ones.
 */

import { ScheduledTweetStatuses, TweetPostingMessageTypes, WebAppEnvs } from '@debatekit/shared/enums';
import { and, eq, gt, lte } from 'drizzle-orm';

import type { getDbAsync } from '@/db';
import * as tables from '@/db';
import { DbScheduledTweetMetadataSchema } from '@/db/schemas/tweet-metadata';
import { log } from '@/lib/logger';

type Db = Awaited<ReturnType<typeof getDbAsync>>;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Max retries before a tweet is permanently failed (matches queue worker) */
const MAX_POST_RETRIES = 5;

/** Hours after scheduledAt before a tweet is considered stale and auto-cancelled */
const STALE_TWEET_WINDOW_HOURS = 24;

// ============================================================================
// PROCESS DUE SCHEDULED TWEETS
// ============================================================================

/**
 * Find scheduled tweets that are due and queue them for posting.
 *
 * Queries tweets where status='scheduled' AND scheduledAt <= now,
 * then sends a POST_TWEET message to the queue for each one.
 * Skips tweets that exceed the retry limit or staleness window.
 *
 * @returns Count of tweets queued for posting
 */
export async function processScheduledTweets(
  db: Db,
  env: CloudflareEnv,
): Promise<number> {
  // SAFETY: Only process scheduled tweets in production
  if (env.WEBAPP_ENV !== WebAppEnvs.PROD) {
    log.warn(`[TweetCron] Blocked scheduled tweet processing in ${env.WEBAPP_ENV} environment`);
    return 0;
  }

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_TWEET_WINDOW_HOURS * 60 * 60 * 1000);

  const dueTweets = await db
    .select()
    .from(tables.scheduledTweet)
    .where(
      and(
        eq(tables.scheduledTweet.status, ScheduledTweetStatuses.SCHEDULED),
        lte(tables.scheduledTweet.scheduledAt, now),
      ),
    )
    .all();

  if (dueTweets.length === 0) {
    log.info('[TweetCron] No scheduled tweets due for posting');
    return 0;
  }

  /** Skip tweets queued within this window to prevent duplicate queue messages */
  const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  let queuedCount = 0;

  for (const tweet of dueTweets) {
    const metadata = DbScheduledTweetMetadataSchema.parse(tweet.metadata ?? {});

    // Mark stale tweets (past the posting window) as cancelled
    if (tweet.scheduledAt && tweet.scheduledAt < staleThreshold) {
      await db
        .update(tables.scheduledTweet)
        .set({
          metadata: { ...metadata, errorMessage: `Auto-cancelled: exceeded ${STALE_TWEET_WINDOW_HOURS}h posting window` },
          status: ScheduledTweetStatuses.CANCELLED,
        })
        .where(eq(tables.scheduledTweet.id, tweet.id));
      log.warn(`[TweetCron] Cancelled stale tweet ${tweet.id} (scheduled ${tweet.scheduledAt?.toISOString()})`);
      continue;
    }

    // Skip tweets that exhausted retries (mark them failed)
    if ((metadata.retryCount ?? 0) >= MAX_POST_RETRIES) {
      await db
        .update(tables.scheduledTweet)
        .set({
          metadata: { ...metadata, errorMessage: `Permanently failed after ${metadata.retryCount} retries` },
          status: ScheduledTweetStatuses.FAILED,
        })
        .where(eq(tables.scheduledTweet.id, tweet.id));
      log.error(`[TweetCron] Tweet ${tweet.id} exceeded max retries (${metadata.retryCount}), marked failed`);
      continue;
    }

    // Dedup guard: skip tweets already queued within the last 10 minutes
    if (metadata.lastQueuedAt) {
      const lastQueued = new Date(metadata.lastQueuedAt).getTime();
      if (now.getTime() - lastQueued < DEDUP_WINDOW_MS) {
        log.info(`[TweetCron] Skipping tweet ${tweet.id} (queued ${Math.round((now.getTime() - lastQueued) / 1000)}s ago)`);
        continue;
      }
    }

    // Mark the tweet as queued (dedup) before sending to prevent duplicate messages
    await db
      .update(tables.scheduledTweet)
      .set({
        metadata: { ...metadata, lastQueuedAt: now.toISOString() },
      })
      .where(eq(tables.scheduledTweet.id, tweet.id));

    await env.TWEET_POSTING_QUEUE.send({
      messageId: `cron-post-${tweet.id}`,
      queuedAt: now.toISOString(),
      tweetId: tweet.id,
      type: TweetPostingMessageTypes.POST_TWEET,
    });
    queuedCount++;
  }

  log.info(`[TweetCron] Queued ${queuedCount} scheduled tweets for posting (${dueTweets.length - queuedCount} skipped)`);

  return queuedCount;
}

// ============================================================================
// RETRY FAILED TWEETS
// ============================================================================

/**
 * Re-queue recently-failed tweets that still have retries remaining.
 *
 * Picks up tweets that ended up in 'failed' state (e.g., from queue DLQ,
 * worker crashes, or transient errors) and resets them to 'scheduled'
 * so the next cron cycle or queue retry can process them.
 *
 * Only retries tweets within the staleness window and under the retry cap.
 *
 * @returns Count of tweets reset for retry
 */
export async function retryFailedTweets(
  db: Db,
  env: CloudflareEnv,
): Promise<number> {
  // SAFETY: Only retry tweets in production
  if (env.WEBAPP_ENV !== WebAppEnvs.PROD) {
    return 0;
  }

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_TWEET_WINDOW_HOURS * 60 * 60 * 1000);

  // Find recently-failed tweets within the posting window
  const failedTweets = await db
    .select()
    .from(tables.scheduledTweet)
    .where(
      and(
        eq(tables.scheduledTweet.status, ScheduledTweetStatuses.FAILED),
        gt(tables.scheduledTweet.scheduledAt, staleThreshold),
        lte(tables.scheduledTweet.scheduledAt, now),
      ),
    )
    .all();

  if (failedTweets.length === 0) {
    return 0;
  }

  let retriedCount = 0;

  for (const tweet of failedTweets) {
    const metadata = DbScheduledTweetMetadataSchema.parse(tweet.metadata ?? {});

    // Only retry if under the retry cap
    if ((metadata.retryCount ?? 0) >= MAX_POST_RETRIES) {
      continue;
    }

    // Skip non-retryable errors (character limit, validation) — content won't change on retry
    const errorMsg = metadata.errorMessage ?? '';
    if (errorMsg.includes('exceeds') && errorMsg.includes('characters')) {
      continue;
    }

    // Reset to 'scheduled' so processScheduledTweets picks it up next cycle
    await db
      .update(tables.scheduledTweet)
      .set({ status: ScheduledTweetStatuses.SCHEDULED })
      .where(eq(tables.scheduledTweet.id, tweet.id));

    retriedCount++;
  }

  if (retriedCount > 0) {
    log.info(`[TweetCron] Reset ${retriedCount} failed tweets for retry`);
  }

  return retriedCount;
}
