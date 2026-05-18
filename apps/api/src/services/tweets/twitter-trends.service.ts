/**
 * Twitter Trends Service - Trend discovery and tweet search via Twitter API
 *
 * Provides supplementary trend discovery through Twitter's native APIs:
 * - Trending topics (v1 trendsByPlace, Free tier)
 * - Recent tweet search (v2 search, Basic tier)
 * - Engagement pattern analysis from top tweets
 *
 * All functions gracefully degrade on 403/429 errors, returning empty results
 * instead of throwing, so they never break the auto-discover pipeline.
 *
 * @see https://developer.twitter.com/en/docs/twitter-api
 */

import { log } from '@/lib/logger';
import type { ApiEnv } from '@/types';

import { createTwitterClient, getTwitterConfig } from './twitter-api.service';

// ============================================================================
// TYPES
// ============================================================================

type TrendingTopic = {
  name: string;
  tweetVolume: number | null;
};

type TweetSearchResult = {
  id: string;
  publicMetrics: {
    likeCount: number;
    replyCount: number;
    retweetCount: number;
  } | null;
  text: string;
};

type EngagementPatterns = {
  avgLikes: number;
  avgRetweets: number;
  topFormats: string[];
};

// ============================================================================
// CONSTANTS
// ============================================================================

/** Worldwide WOEID for Twitter trending topics */
const WORLDWIDE_WOEID = 1;

/** Max tweets to analyze for engagement patterns */
const MAX_SEARCH_RESULTS = 20;

/** HTTP status codes that indicate access/rate issues (non-fatal) */
const GRACEFUL_STATUS_CODES = [403, 429];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if an error is a Twitter API rate limit or access restriction.
 * These are expected and should not break the pipeline.
 */
function isGracefulTwitterError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      GRACEFUL_STATUS_CODES.some(code => msg.includes(String(code)))
      || msg.includes('forbidden')
      || msg.includes('rate limit')
      || msg.includes('too many requests')
    );
  }
  return false;
}

/**
 * Detect common tweet formats for engagement pattern analysis.
 */
function detectTweetFormats(tweets: TweetSearchResult[]): string[] {
  const formatCounts = new Map<string, number>();

  for (const tweet of tweets) {
    const text = tweet.text;

    if (text.includes('?')) {
      formatCounts.set('question', (formatCounts.get('question') ?? 0) + 1);
    }
    if (/\d+\./.test(text) || text.includes('\n-') || text.includes('\n1')) {
      formatCounts.set('list/thread', (formatCounts.get('list/thread') ?? 0) + 1);
    }
    if (text.length < 100) {
      formatCounts.set('short-form', (formatCounts.get('short-form') ?? 0) + 1);
    }
    if (/https?:\/\//.test(text)) {
      formatCounts.set('link-share', (formatCounts.get('link-share') ?? 0) + 1);
    }
    if (text.startsWith('"') || text.includes(' -- ') || text.includes(' - ')) {
      formatCounts.set('quote/opinion', (formatCounts.get('quote/opinion') ?? 0) + 1);
    }
  }

  return [...formatCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([format]) => format);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fetch worldwide trending topics from Twitter.
 *
 * Uses v1 trendsByPlace API (available on Free tier).
 * Returns empty array on 403/429 instead of throwing.
 *
 * @param env - Cloudflare environment bindings
 * @returns Array of trending topics with optional tweet volumes
 */
export async function getTrendingTopics(
  env: ApiEnv['Bindings'],
): Promise<TrendingTopic[]> {
  try {
    const config = getTwitterConfig(env);
    const client = createTwitterClient(config);
    const trends = await client.v1.trendsByPlace(WORLDWIDE_WOEID);

    if (!trends.length || !trends[0]?.trends) {
      log.warn('[TwitterTrends] No trends returned from trendsByPlace');
      return [];
    }

    return trends[0].trends.map(trend => ({
      name: trend.name,
      tweetVolume: trend.tweet_volume ?? null,
    }));
  } catch (error) {
    if (isGracefulTwitterError(error)) {
      log.warn('[TwitterTrends] getTrendingTopics access restricted (403/429), returning empty');
      return [];
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`[TwitterTrends] getTrendingTopics failed: ${errMsg}`);
    return [];
  }
}

/**
 * Search recent tweets matching a query with engagement metrics.
 *
 * Uses v2 search API (requires Basic tier).
 * Returns empty array on 403/429 instead of throwing.
 *
 * @param query - Search query string
 * @param env - Cloudflare environment bindings
 * @returns Array of tweet objects with engagement metrics
 */
export async function searchRecentTweets(
  query: string,
  env: ApiEnv['Bindings'],
): Promise<TweetSearchResult[]> {
  try {
    const config = getTwitterConfig(env);
    const client = createTwitterClient(config);

    const result = await client.v2.search(query, {
      'max_results': MAX_SEARCH_RESULTS,
      'tweet.fields': ['public_metrics'],
    });

    if (!result.data?.data) {
      return [];
    }

    return result.data.data.map(tweet => ({
      id: tweet.id,
      publicMetrics: tweet.public_metrics
        ? {
            likeCount: tweet.public_metrics.like_count,
            replyCount: tweet.public_metrics.reply_count,
            retweetCount: tweet.public_metrics.retweet_count,
          }
        : null,
      text: tweet.text,
    }));
  } catch (error) {
    if (isGracefulTwitterError(error)) {
      log.warn(`[TwitterTrends] searchRecentTweets access restricted (403/429) for query "${query}"`);
      return [];
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`[TwitterTrends] searchRecentTweets failed for query "${query}": ${errMsg}`);
    return [];
  }
}

/**
 * Analyze top tweet engagement patterns for a query.
 *
 * Calls searchRecentTweets and extracts average engagement metrics
 * and common tweet formats. Returns null on failure.
 *
 * @param query - Search query string
 * @param env - Cloudflare environment bindings
 * @returns Engagement patterns or null if analysis fails
 */
export async function analyzeTopTweetPatterns(
  query: string,
  env: ApiEnv['Bindings'],
): Promise<EngagementPatterns | null> {
  const tweets = await searchRecentTweets(query, env);

  if (tweets.length === 0) {
    return null;
  }

  const withMetrics = tweets.filter(t => t.publicMetrics !== null);

  if (withMetrics.length === 0) {
    return {
      avgLikes: 0,
      avgRetweets: 0,
      topFormats: detectTweetFormats(tweets),
    };
  }

  const totalLikes = withMetrics.reduce(
    (sum, t) => sum + (t.publicMetrics?.likeCount ?? 0),
    0,
  );
  const totalRetweets = withMetrics.reduce(
    (sum, t) => sum + (t.publicMetrics?.retweetCount ?? 0),
    0,
  );

  return {
    avgLikes: Math.round(totalLikes / withMetrics.length),
    avgRetweets: Math.round(totalRetweets / withMetrics.length),
    topFormats: detectTweetFormats(tweets),
  };
}

export type { EngagementPatterns, TrendingTopic, TweetSearchResult };
