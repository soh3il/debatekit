/**
 * Performance Analysis Service
 *
 * Analyzes past tweet engagement data to identify what topics, styles,
 * and hooks performed best. Generates structured "performance briefs"
 * that can be injected into the content pipeline to ensure future
 * content doubles down on what works.
 *
 * Used by: auto-discover (topic discovery), tweet-craft (generation),
 * viral-scoring (calibration).
 */

import { and, eq, gte, isNotNull } from 'drizzle-orm';

import type { getDbAsync } from '@/db';
import * as tables from '@/db';
import { DbScheduledTweetMetadataSchema } from '@/db/schemas/tweet-metadata';
import { log } from '@/lib/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/** 60-day lookback window for performance analysis */
const LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;

/** Minimum sent tweets with engagement data to produce meaningful insights */
const MIN_TWEETS_FOR_INSIGHTS = 5;

/** Max top tweet examples to include */
const MAX_TOP_EXAMPLES = 5;

/** Hook pattern length (first ~50 chars of tweet content) */
const HOOK_LENGTH = 50;

/** Top performers = top 25th percentile */
const TOP_PERCENTILE = 0.25;

/** Truncated content length for examples */
const EXAMPLE_CONTENT_LENGTH = 200;

// ============================================================================
// TYPES
// ============================================================================

type Db = Awaited<ReturnType<typeof getDbAsync>>;

export type PerformanceInsights = {
  /** Average engagement rate across all analyzed tweets */
  avgEngagementRate: number;
  /** When the analysis was performed */
  analyzedAt: string;
  /** Whether enough data exists for meaningful insights */
  hasEnoughData: boolean;
  /** Total tweets analyzed */
  totalAnalyzed: number;
  /** Hook patterns from top performers (first ~50 chars of each top tweet) */
  topHookPatterns: string[];
  /** Top performing styles ranked by avg engagement */
  topStyles: Array<{
    avgEngagementRate: number;
    count: number;
    style: string;
  }>;
  /** Topic themes that performed well */
  topTopicThemes: string[];
  /** Top performing tweet content examples (up to 5, truncated to 200 chars) */
  topTweetExamples: Array<{
    content: string;
    engagementRate: number;
    impressions: number;
    style: string;
    topic: string;
  }>;
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract recurring topic themes from thread titles and job prompts.
 * Simple keyword extraction - splits on common separators, filters noise.
 */
function extractTopicThemes(texts: string[]) {
  const stopWords = new Set([
    'a',
    'about',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'can',
    'create',
    'do',
    'for',
    'from',
    'generate',
    'get',
    'has',
    'have',
    'how',
    'i',
    'in',
    'is',
    'it',
    'its',
    'me',
    'my',
    'new',
    'not',
    'of',
    'on',
    'or',
    'our',
    'so',
    'that',
    'the',
    'this',
    'to',
    'tweet',
    'was',
    'we',
    'what',
    'when',
    'which',
    'will',
    'with',
    'write',
    'you',
    'your',
  ]);

  const wordCounts = new Map<string, number>();

  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    // Deduplicate within same text
    const unique = new Set(words);
    for (const word of unique) {
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }
  }

  // Return words appearing in at least 2 texts, sorted by frequency
  return Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze recent tweet performance and extract actionable insights.
 *
 * Queries sent tweets from the last 60 days, LEFT JOINs with
 * automatedJob (for original prompt) and chatThread (for thread title),
 * then identifies top performers and extracts patterns.
 */
export async function analyzePerformance(db: Db, options?: { lookbackMs?: number }) {
  const lookbackMs = options?.lookbackMs ?? LOOKBACK_MS;
  const lookbackDate = new Date(Date.now() - lookbackMs);

  // Query sent tweets with engagement data, join job + thread for context
  const rows = await db
    .select()
    .from(tables.scheduledTweet)
    .leftJoin(tables.automatedJob, eq(tables.scheduledTweet.jobId, tables.automatedJob.id))
    .leftJoin(tables.chatThread, eq(tables.scheduledTweet.threadId, tables.chatThread.id))
    .where(
      and(
        eq(tables.scheduledTweet.status, 'sent'),
        isNotNull(tables.scheduledTweet.twitterPostId),
        gte(tables.scheduledTweet.sentAt, lookbackDate),
      ),
    )
    .all();

  // Parse metadata and filter to tweets with engagement data
  const tweetsWithEngagement = rows
    .map((row) => {
      const tweet = row.scheduled_tweet;
      const parsed = DbScheduledTweetMetadataSchema.safeParse(tweet.metadata ?? {});
      if (!parsed.success) {
        return null;
      }
      const meta = parsed.data;
      if (!meta.engagementMetrics?.engagementRate && meta.engagementMetrics?.engagementRate !== 0) {
        return null;
      }

      return {
        content: tweet.content,
        engagementRate: meta.engagementMetrics.engagementRate ?? 0,
        impressions: meta.engagementMetrics.impressions ?? 0,
        jobPrompt: row.automated_job?.initialPrompt ?? null,
        style: meta.tweetStyle ?? 'unknown',
        threadTitle: row.chat_thread?.title ?? null,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const hasEnoughData = tweetsWithEngagement.length >= MIN_TWEETS_FOR_INSIGHTS;
  const totalAnalyzed = tweetsWithEngagement.length;

  if (!hasEnoughData) {
    log.info(`[PerformanceAnalysis] Not enough data: ${totalAnalyzed} tweets (need ${MIN_TWEETS_FOR_INSIGHTS})`);

    const emptyInsights: PerformanceInsights = {
      analyzedAt: new Date().toISOString(),
      avgEngagementRate: 0,
      hasEnoughData: false,
      topHookPatterns: [],
      topStyles: [],
      topTopicThemes: [],
      topTweetExamples: [],
      totalAnalyzed,
    };
    return emptyInsights;
  }

  // Sort by engagement rate descending
  tweetsWithEngagement.sort((a, b) => b.engagementRate - a.engagementRate);

  // Calculate average engagement rate
  const totalEngagement = tweetsWithEngagement.reduce((sum, t) => sum + t.engagementRate, 0);
  const avgEngagementRate = Math.round((totalEngagement / totalAnalyzed) * 100) / 100;

  // Identify top performers (top 25th percentile)
  const topCount = Math.max(1, Math.ceil(totalAnalyzed * TOP_PERCENTILE));
  const topPerformers = tweetsWithEngagement.slice(0, topCount);

  // Extract top styles across ALL analyzed tweets
  const styleStats = new Map<string, { count: number; totalRate: number }>();
  for (const tweet of tweetsWithEngagement) {
    if (tweet.style === 'unknown') {
      continue;
    }
    const current = styleStats.get(tweet.style) ?? { count: 0, totalRate: 0 };
    current.totalRate += tweet.engagementRate;
    current.count += 1;
    styleStats.set(tweet.style, current);
  }

  const topStyles = Array.from(styleStats.entries())
    .map(([style, stats]) => ({
      avgEngagementRate: Math.round((stats.totalRate / stats.count) * 100) / 100,
      count: stats.count,
      style,
    }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

  // Extract topic themes from top performers (thread titles + job prompts)
  const topTexts = topPerformers
    .flatMap(t => [t.threadTitle, t.jobPrompt])
    .filter((t): t is string => !!t);
  const topTopicThemes = extractTopicThemes(topTexts);

  // Extract hook patterns from top performers
  const topHookPatterns = topPerformers
    .map(t => t.content.slice(0, HOOK_LENGTH).trim())
    .filter((hook, idx, arr) => arr.indexOf(hook) === idx) // deduplicate
    .slice(0, MAX_TOP_EXAMPLES);

  // Build top tweet examples
  const topTweetExamples = topPerformers
    .slice(0, MAX_TOP_EXAMPLES)
    .map(t => ({
      content: t.content.length > EXAMPLE_CONTENT_LENGTH
        ? `${t.content.slice(0, EXAMPLE_CONTENT_LENGTH)}...`
        : t.content,
      engagementRate: t.engagementRate,
      impressions: t.impressions,
      style: t.style,
      topic: t.threadTitle ?? t.jobPrompt?.slice(0, 80) ?? 'unknown',
    }));

  log.info(`[PerformanceAnalysis] Analyzed ${totalAnalyzed} tweets, avg engagement ${avgEngagementRate}%, ${topStyles.length} styles, ${topTopicThemes.length} themes`);

  const insights: PerformanceInsights = {
    analyzedAt: new Date().toISOString(),
    avgEngagementRate,
    hasEnoughData,
    topHookPatterns,
    topStyles,
    topTopicThemes,
    topTweetExamples,
    totalAnalyzed,
  };
  return insights;
}

/**
 * Format performance insights for injection into the topic discovery prompt.
 * Highlights which topics and styles to double down on.
 */
export function formatPerformanceForDiscovery(insights: PerformanceInsights) {
  if (!insights.hasEnoughData) {
    return '';
  }

  const lines = [
    '=== PAST PERFORMANCE INSIGHTS ===',
    `Based on analysis of ${insights.totalAnalyzed} tweets over the last 60 days:`,
    '',
  ];

  if (insights.topTopicThemes.length > 0) {
    lines.push('TOP PERFORMING TOPICS (double down on these themes):');
    for (const theme of insights.topTopicThemes) {
      lines.push(`- ${theme}`);
    }
    lines.push('');
  }

  if (insights.topStyles.length > 0) {
    lines.push('TOP PERFORMING STYLES:');
    for (const s of insights.topStyles.slice(0, 5)) {
      lines.push(`- ${s.style}: ${s.avgEngagementRate}% avg engagement (${s.count} tweets)`);
    }
    lines.push('');
  }

  lines.push(
    'When selecting new topics, prioritize themes similar to past winners while also exploring new trending angles. The best results come from combining proven topic categories with fresh, timely angles.',
  );

  return lines.join('\n');
}

/**
 * Format performance insights for injection into the tweet generation prompt.
 * Shows specific hooks, styles, and examples that worked.
 */
export function formatPerformanceForTweetCraft(insights: PerformanceInsights) {
  if (!insights.hasEnoughData) {
    return '';
  }

  const lines = [
    '=== WHAT\'S WORKING (from recent engagement data) ===',
    'Your top-performing tweets used these patterns — DOUBLE DOWN on them:',
    '',
  ];

  if (insights.topHookPatterns.length > 0) {
    lines.push('TOP HOOKS THAT WORKED:');
    for (const hook of insights.topHookPatterns) {
      lines.push(`- "${hook}"`);
    }
    lines.push('');
  }

  if (insights.topStyles.length > 0) {
    lines.push('TOP STYLES BY ENGAGEMENT:');
    for (const s of insights.topStyles.slice(0, 5)) {
      lines.push(`- ${s.style}: ${s.avgEngagementRate}% avg engagement`);
    }
    lines.push('');
  }

  if (insights.topTweetExamples.length > 0) {
    lines.push('EXAMPLE HIGH-PERFORMERS:');
    for (const [i, ex] of insights.topTweetExamples.entries()) {
      const impressionsK = ex.impressions >= 1000
        ? `${Math.round(ex.impressions / 100) / 10}K`
        : String(ex.impressions);
      lines.push(`${i + 1}. ${ex.content} (${ex.engagementRate}% engagement, ${impressionsK} impressions)`);
    }
    lines.push('');
  }

  lines.push('Study these patterns and apply what made them work to the new tweet.');

  return lines.join('\n');
}

/**
 * Format performance insights for injection into the viral scoring prompt.
 * Provides historical baseline for calibrating scores.
 */
export function formatPerformanceForViralScoring(insights: PerformanceInsights) {
  if (!insights.hasEnoughData) {
    return '';
  }

  const lines = [
    '=== HISTORICAL ENGAGEMENT DATA ===',
    `Recent tweet performance (last 60 days, ${insights.totalAnalyzed} tweets):`,
    `- Average engagement rate: ${insights.avgEngagementRate}%`,
  ];

  if (insights.topStyles.length > 0) {
    const stylesStr = insights.topStyles
      .slice(0, 5)
      .map(s => `${s.style} (${s.avgEngagementRate}%)`)
      .join(', ');
    lines.push(`- Top styles: ${stylesStr}`);
  }

  if (insights.topTopicThemes.length > 0) {
    lines.push(`- Topics that performed well: ${insights.topTopicThemes.join(', ')}`);
  }

  lines.push('');
  lines.push('Use this data to calibrate your viral scoring. Topics similar to past high-performers should receive a boost in engagementPotential scoring.');

  return lines.join('\n');
}
