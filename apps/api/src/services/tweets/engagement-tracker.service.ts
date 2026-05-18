/**
 * Tweet Engagement Tracker
 *
 * Fetches engagement metrics (likes, retweets, replies, impressions)
 * from Twitter API for recently posted tweets. Stores metrics in
 * scheduledTweet.metadata for performance analysis.
 *
 * Used by the tweet-craft service to select high-performing styles.
 */

import { and, eq, gte, isNotNull } from 'drizzle-orm';

import type { getDbAsync } from '@/db';
import * as tables from '@/db';
import type { DbScheduledTweetMetadata } from '@/db/schemas/tweet-metadata';
import { DbScheduledTweetMetadataSchema } from '@/db/schemas/tweet-metadata';
import { log } from '@/lib/logger';
import type { ApiEnv } from '@/types';

import { createTwitterClient, getTwitterConfig } from './twitter-api.service';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Only fetch engagement for tweets posted in the last 7 days */
const ENGAGEMENT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Max tweets to check per run to avoid rate limits */
const MAX_TWEETS_PER_RUN = 20;

/** 30-day lookback for style performance analysis */
const STYLE_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

type Db = Awaited<ReturnType<typeof getDbAsync>>;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Collect engagement metrics for recently posted tweets.
 * Updates scheduledTweet.metadata with latest engagement data.
 */
export async function collectTweetEngagement(
  db: Db,
  env: ApiEnv['Bindings'],
) {
  const lookbackDate = new Date(Date.now() - ENGAGEMENT_LOOKBACK_MS);

  // Find tweets that were sent to Twitter in the last 7 days
  const recentTweets = await db
    .select()
    .from(tables.scheduledTweet)
    .where(
      and(
        eq(tables.scheduledTweet.status, 'sent'),
        isNotNull(tables.scheduledTweet.twitterPostId),
        gte(tables.scheduledTweet.sentAt, lookbackDate),
      ),
    )
    .limit(MAX_TWEETS_PER_RUN)
    .all();

  if (recentTweets.length === 0) {
    log.info('[EngagementTracker] No recent tweets to check');
    return;
  }

  log.info(`[EngagementTracker] Checking engagement for ${recentTweets.length} tweet(s)`);

  const config = getTwitterConfig(env);
  const client = createTwitterClient(config);

  let updated = 0;

  for (const tweet of recentTweets) {
    if (!tweet.twitterPostId) {
      continue;
    }

    try {
      const result = await client.v2.singleTweet(tweet.twitterPostId, {
        'tweet.fields': ['public_metrics'],
      });

      const metrics = result.data.public_metrics;
      if (!metrics) {
        continue;
      }

      const impressions = metrics.impression_count ?? 0;
      const totalEngagement = (metrics.like_count ?? 0) + (metrics.retweet_count ?? 0) + (metrics.reply_count ?? 0);

      const engagementMetrics: NonNullable<DbScheduledTweetMetadata['engagementMetrics']> = {
        collectedAt: new Date().toISOString(),
        engagementRate: impressions > 0 ? Math.round((totalEngagement / impressions) * 10000) / 100 : 0,
        impressions,
        likes: metrics.like_count ?? 0,
        replies: metrics.reply_count ?? 0,
        retweets: metrics.retweet_count ?? 0,
      };

      // Merge with existing metadata, preserving other fields
      const parsed = DbScheduledTweetMetadataSchema.safeParse(tweet.metadata ?? {});
      const existingMetadata: DbScheduledTweetMetadata = parsed.success ? parsed.data : {};
      const updatedMetadata: DbScheduledTweetMetadata = {
        ...existingMetadata,
        engagementMetrics,
      };

      await db
        .update(tables.scheduledTweet)
        .set({
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(tables.scheduledTweet.id, tweet.id));

      updated++;

      log.info(`[EngagementTracker] Tweet ${tweet.id}: ${engagementMetrics.likes} likes, ${engagementMetrics.retweets} RTs, ${engagementMetrics.replies} replies (${engagementMetrics.engagementRate}% rate)`);
    } catch (err) {
      log.error(`[EngagementTracker] Failed to fetch metrics for tweet ${tweet.twitterPostId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log.info(`[EngagementTracker] Updated engagement for ${updated}/${recentTweets.length} tweets`);
}

/**
 * Get the top-performing tweet styles from recent engagement data.
 * Returns a ranked list of styles with their average engagement rates.
 */
export async function getTopPerformingStyles(
  db: Db,
): Promise<Array<{ avgEngagementRate: number; count: number; style: string }>> {
  const lookbackDate = new Date(Date.now() - STYLE_LOOKBACK_MS);

  const recentTweets = await db
    .select()
    .from(tables.scheduledTweet)
    .where(
      and(
        eq(tables.scheduledTweet.status, 'sent'),
        isNotNull(tables.scheduledTweet.twitterPostId),
        gte(tables.scheduledTweet.sentAt, lookbackDate),
      ),
    )
    .all();

  // Aggregate engagement by style
  const styleStats = new Map<string, { count: number; totalRate: number }>();

  for (const tweet of recentTweets) {
    const metadataParsed = DbScheduledTweetMetadataSchema.safeParse(tweet.metadata);
    if (!metadataParsed.success) {
      continue;
    }
    const metadata = metadataParsed.data;
    if (!metadata.engagementMetrics || !metadata.tweetStyle) {
      continue;
    }

    const style = metadata.tweetStyle;
    const engagementRate = metadata.engagementMetrics.engagementRate ?? 0;

    const current = styleStats.get(style) ?? { count: 0, totalRate: 0 };
    current.totalRate += engagementRate;
    current.count += 1;
    styleStats.set(style, current);
  }

  // Convert to sorted array
  return Array.from(styleStats.entries())
    .map(([style, stats]) => ({
      avgEngagementRate: Math.round((stats.totalRate / stats.count) * 100) / 100,
      count: stats.count,
      style,
    }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
}
