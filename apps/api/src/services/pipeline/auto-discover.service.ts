/**
 * Auto-Discover Service
 *
 * Automatically discovers trending topics WITHOUT requiring a manual keyword.
 * Uses AI to generate search keywords, then calls the existing trend discovery
 * service to find topics across multiple platforms.
 *
 * Flow:
 * 1. AI generates 3-5 trending search keywords based on current landscape
 * 2. For each keyword, calls discoverTrends() across all platforms
 * 3. Deduplicates and ranks all discovered topics by relevanceScore
 * 4. Returns top N topics
 */

import { ModelIds } from '@debatekit/shared/enums';
import { generateObject } from 'ai';
import { z } from 'zod';

import { getDbAsync } from '@/db';
import { createTracedModel } from '@/lib/analytics/posthog-ai-wrapper';
import { log } from '@/lib/logger';
import type { TrendSuggestion } from '@/routes/admin/jobs/trends/schema';
import { TrendSuggestionSchema } from '@/routes/admin/jobs/trends/schema';
import { resolveSkillTokens } from '@/services/admin/skill-registry';
import { getAdminSetting } from '@/services/admin-settings.service';
import { discoverTrends } from '@/services/jobs';
import { initializeOpenRouter, openRouterService } from '@/services/models';
import { getTrendingTopics } from '@/services/tweets';
import type { ApiEnv } from '@/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_PLATFORMS = ['reddit', 'twitter', 'instagram'] as const;
const DEFAULT_MAX_TOPICS = 5;
const KEYWORD_GENERATION_MODEL = ModelIds.GOOGLE_GEMINI_2_5_FLASH;
const MAX_SUGGESTIONS_PER_KEYWORD = 5;

// ============================================================================
// SCHEMAS
// ============================================================================

const KeywordGenerationSchema = z.object({
  keywords: z.array(z.string().min(2).max(50)).min(3).max(5),
}).strict();

// ============================================================================
// RESULT TYPES
// ============================================================================

const _AutoDiscoveryResultSchema = z.object({
  keywordsUsed: z.array(z.string()),
  platformsSearched: z.array(z.string()),
  topics: z.array(z.object({
    platform: z.string(),
    prompt: z.string(),
    reasoning: z.string(),
    relevanceScore: z.number(),
    suggestedRounds: z.number(),
    topic: z.string(),
  })),
  totalResultsAnalyzed: z.number(),
});

export type AutoDiscoveryResult = z.infer<typeof _AutoDiscoveryResultSchema>;

/**
 * TrendSuggestion with keyword origin for traceability after deduplication.
 */
const _TrendSuggestionWithKeywordSchema = TrendSuggestionSchema.extend({
  keyword: z.string(),
});
type TrendSuggestionWithKeyword = z.infer<typeof _TrendSuggestionWithKeywordSchema>;

// ============================================================================
// KEYWORD GENERATION
// ============================================================================

async function generateTrendingKeywords(
  env: ApiEnv['Bindings'],
  topicGuidance?: string,
): Promise<string[]> {
  initializeOpenRouter(env);
  const client = await openRouterService.getClient();

  const db = await getDbAsync();
  const dbPrompt = await getAdminSetting(db, 'keywordGenerationPrompt');
  const basePrompt = await resolveSkillTokens(dbPrompt, db);

  const systemPrompt = topicGuidance?.trim()
    ? `${basePrompt}\n\nAdditional topic guidance from admin:\n${topicGuidance.trim()}`
    : basePrompt;

  const result = await generateObject({
    model: createTracedModel(client.chat(KEYWORD_GENERATION_MODEL), {
      distinctId: 'system',
      operation: 'auto-discover-keywords',
    }),
    prompt: 'Generate 3-5 trending search keywords for discovering the hottest tech topics being discussed right now.',
    schema: KeywordGenerationSchema,
    system: systemPrompt,
    temperature: 0.9,
  });

  return result.object.keywords;
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Deduplicate topics by normalizing topic names and keeping the highest-scored version.
 * Adds keyword origin to each topic for traceability.
 */
function deduplicateTopics(
  topicsByKeyword: { keyword: string; topics: TrendSuggestion[] }[],
): (TrendSuggestionWithKeyword)[] {
  const seen = new Map<string, TrendSuggestionWithKeyword>();

  for (const { keyword, topics } of topicsByKeyword) {
    for (const topic of topics) {
      const normalizedKey = topic.topic.toLowerCase().trim().replace(/\s+/g, ' ');
      const existing = seen.get(normalizedKey);

      if (!existing || topic.relevanceScore > existing.relevanceScore) {
        seen.set(normalizedKey, { ...topic, keyword });
      }
    }
  }

  return [...seen.values()];
}

// ============================================================================
// TWITTER API TREND DISCOVERY
// ============================================================================

/** Minimum tweet volume to consider a Twitter trend relevant */
const MIN_TWEET_VOLUME = 1000;

/** Default relevance score for Twitter API trends (mid-range, refined by volume) */
const BASE_TWITTER_TREND_SCORE = 60;

/**
 * Discover supplementary trend topics directly from the Twitter API.
 *
 * Fetches worldwide trending topics and converts them to TrendSuggestion format.
 * Gracefully returns empty array on 403/429 (never breaks the pipeline).
 */
export async function discoverFromTwitterAPI(
  env: ApiEnv['Bindings'],
): Promise<TrendSuggestion[]> {
  try {
    const trends = await getTrendingTopics(env);

    if (trends.length === 0) {
      log.info('[AutoDiscover] Twitter API returned no trends (likely 403/429)');
      return [];
    }

    // Filter to trends with meaningful volume, then convert to TrendSuggestion
    const relevant = trends
      .filter(t => t.tweetVolume !== null && t.tweetVolume >= MIN_TWEET_VOLUME)
      .slice(0, MAX_SUGGESTIONS_PER_KEYWORD);

    log.info(`[AutoDiscover] Twitter API found ${relevant.length} high-volume trends`);

    return relevant.map((trend) => {
      // Scale score by tweet volume (1k -> 60, 100k+ -> 90)
      const volumeBoost = Math.min(
        30,
        Math.round(Math.log10(trend.tweetVolume ?? MIN_TWEET_VOLUME) * 10) - 20,
      );
      const score = Math.min(100, BASE_TWITTER_TREND_SCORE + volumeBoost);

      return {
        platform: 'twitter' as const,
        prompt: `What's your take on "${trend.name}"? Why is this trending and what does it mean?`,
        reasoning: `Trending worldwide on Twitter/X with ${trend.tweetVolume?.toLocaleString() ?? 'unknown'} tweets`,
        relevanceScore: score,
        suggestedRounds: 2,
        topic: trend.name,
      };
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.warn(`[AutoDiscover] Twitter API discovery failed (non-fatal): ${errMsg}`);
    return [];
  }
}

// ============================================================================
// TOPIC SIMILARITY
// ============================================================================

/**
 * Check if two topic names are similar enough to be considered duplicates.
 * Normalizes and compares lowercase tokens for overlap.
 */
function areTopicsSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');

  const tokensA = new Set(normalize(a).split(' '));
  const tokensB = new Set(normalize(b).split(' '));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap++;
    }
  }

  const minSize = Math.min(tokensA.size, tokensB.size);
  return overlap / minSize >= 0.6;
}

/**
 * Merge Twitter API trends into existing topics, deduplicating by topic name similarity.
 * Keeps the higher-scored version when duplicates are found.
 */
function mergeTwitterTrends(
  existingTopics: (TrendSuggestionWithKeyword)[],
  twitterTopics: TrendSuggestion[],
): (TrendSuggestionWithKeyword)[] {
  const merged = [...existingTopics];

  for (const twitterTopic of twitterTopics) {
    const duplicate = merged.find(existing =>
      areTopicsSimilar(existing.topic, twitterTopic.topic),
    );

    if (duplicate) {
      // Keep existing if higher scored, otherwise replace
      if (twitterTopic.relevanceScore > duplicate.relevanceScore) {
        const idx = merged.indexOf(duplicate);
        merged[idx] = { ...twitterTopic, keyword: 'twitter-api' };
      }
    } else {
      merged.push({ ...twitterTopic, keyword: 'twitter-api' });
    }
  }

  return merged;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Auto-discover trending topics without requiring a manual keyword.
 *
 * 1. Uses AI to generate 3-5 trending search keywords
 * 2. For each keyword, calls discoverTrends() with all 3 platforms
 * 3. Fetches supplementary trends from Twitter API (graceful on 403/429)
 * 4. Merges and deduplicates all discovered topics by name similarity
 * 5. Ranks by relevanceScore and returns top N topics
 */
export async function autoDiscoverTrends(
  env: ApiEnv['Bindings'],
  maxTopics = DEFAULT_MAX_TOPICS,
  options?: { systemPrompt?: string; topicGuidance?: string },
): Promise<AutoDiscoveryResult> {
  log.info('[AutoDiscover] Starting auto-discovery pipeline');

  // 1. Generate trending keywords via AI
  let keywords: string[];
  try {
    keywords = await generateTrendingKeywords(env, options?.topicGuidance);
    log.info(`[AutoDiscover] Generated ${keywords.length} keywords: ${keywords.join(', ')}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`[AutoDiscover] Keyword generation failed: ${errMsg}`);
    return {
      keywordsUsed: [],
      platformsSearched: [],
      topics: [],
      totalResultsAnalyzed: 0,
    };
  }

  // 2. Discover trends for each keyword in parallel + fetch Twitter API trends
  const platformsList = [...ALL_PLATFORMS];
  const [discoveryResults, twitterApiTopics] = await Promise.all([
    // Web search discovery across all platforms
    Promise.all(
      keywords.map(async (keyword) => {
        try {
          const result = await discoverTrends(
            keyword,
            platformsList,
            MAX_SUGGESTIONS_PER_KEYWORD,
            env,
            options?.systemPrompt,
          );
          return {
            keyword,
            searchSummary: result.searchSummary,
            topics: result.suggestions,
          };
        } catch {
          log.warn(`[AutoDiscover] Discovery failed for keyword "${keyword}"`);
          return {
            keyword,
            searchSummary: { keyword, platformsSearched: platformsList, totalResultsAnalyzed: 0 },
            topics: [],
          };
        }
      }),
    ),
    // Supplementary: Twitter API native trends (graceful on 403/429)
    discoverFromTwitterAPI(env),
  ]);

  // 3. Aggregate search metadata
  const allPlatforms = new Set<string>();
  let totalResultsAnalyzed = 0;

  for (const result of discoveryResults) {
    for (const platform of result.searchSummary.platformsSearched) {
      allPlatforms.add(platform);
    }
    totalResultsAnalyzed += result.searchSummary.totalResultsAnalyzed;
  }

  if (twitterApiTopics.length > 0) {
    allPlatforms.add('twitter-api');
    totalResultsAnalyzed += twitterApiTopics.length;
  }

  // 4. Deduplicate web search topics
  const topicsByKeyword = discoveryResults.map(r => ({
    keyword: r.keyword,
    topics: r.topics,
  }));

  const deduped = deduplicateTopics(topicsByKeyword);

  // 5. Merge Twitter API trends (dedup by topic name similarity)
  const merged = mergeTwitterTrends(deduped, twitterApiTopics);

  // Sort by relevanceScore descending
  merged.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Take top N
  const topTopics = merged.slice(0, maxTopics);

  log.info(
    `[AutoDiscover] Discovery complete: ${merged.length} unique topics (${twitterApiTopics.length} from Twitter API), returning top ${topTopics.length}`,
  );

  return {
    keywordsUsed: keywords,
    platformsSearched: [...allPlatforms],
    topics: topTopics.map(t => ({
      platform: t.platform,
      prompt: t.prompt,
      reasoning: t.reasoning,
      relevanceScore: t.relevanceScore,
      suggestedRounds: t.suggestedRounds,
      topic: t.topic,
    })),
    totalResultsAnalyzed,
  };
}
