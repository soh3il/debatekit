/**
 * Trend Discovery Service
 *
 * Searches social media platforms for trending topics and uses AI to extract
 * discussion prompts with suggested round counts for automated jobs.
 */

import { ModelIds } from '@debatekit/shared/enums';
import { generateObject } from 'ai';
import { z } from 'zod';

import { getDbAsync } from '@/db';
import { createTracedModel } from '@/lib/analytics/posthog-ai-wrapper';
import type { TrendSuggestion } from '@/routes/admin/jobs/trends/schema';
import type { WebSearchParameters } from '@/routes/chat/schema';
import { resolveSkillTokens } from '@/services/admin/skill-registry';
import { getAdminSetting } from '@/services/admin-settings.service';
import { performWebSearch } from '@/services/search/web-search.service';
import type { ApiEnv } from '@/types';

import { initializeOpenRouter, openRouterService } from '../models';

// 5-part enum pattern for Platform
const PLATFORMS = ['reddit', 'twitter', 'instagram'] as const;
const PlatformSchema = z.enum(PLATFORMS);
type Platform = z.infer<typeof PlatformSchema>;
const Platforms = {
  INSTAGRAM: 'instagram',
  REDDIT: 'reddit',
  TWITTER: 'twitter',
} as const;

type TrendDiscoveryResult = {
  suggestions: TrendSuggestion[];
  searchSummary: {
    totalResultsAnalyzed: number;
    platformsSearched: string[];
    keyword: string;
  };
};

const PLATFORM_SEARCH_CONFIGS: Record<Platform, { query: (keyword: string) => string; domain: string }> = {
  [Platforms.INSTAGRAM]: {
    domain: 'instagram.com',
    query: (keyword: string) => `site:instagram.com ${keyword} viral`,
  },
  [Platforms.REDDIT]: {
    domain: 'reddit.com',
    query: (keyword: string) => `site:reddit.com ${keyword} discussion`,
  },
  [Platforms.TWITTER]: {
    domain: 'twitter.com',
    query: (keyword: string) => `(site:twitter.com OR site:x.com) ${keyword} trending`,
  },
};

const TrendExtractionSchema = z.object({
  suggestions: z.array(z.object({
    platform: PlatformSchema.describe('Source platform'),
    prompt: z.string().describe('Engaging discussion prompt (50-200 characters)'),
    reasoning: z.string().describe('Why trending and rounds rationale'),
    relevanceScore: z.number().min(0).max(100).describe('Relevance/trending score'),
    suggestedRounds: z.number().min(1).max(5).describe('Suggested discussion rounds'),
    topic: z.string().describe('Brief topic name (3-8 words)'),
  }).strict()),
}).strict();

function formatSearchResults(
  results: { platform: Platform; title: string; snippet: string; url: string }[],
): string {
  return results
    .map((r, i) => `[${i + 1}] [${r.platform}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
    .join('\n\n');
}

/**
 * Discover trending topics from social media platforms
 */
export async function discoverTrends(
  keyword: string,
  platforms: Platform[],
  maxSuggestions: number,
  env: ApiEnv['Bindings'],
  systemPrompt?: string,
): Promise<TrendDiscoveryResult> {
  // Search each platform in parallel
  const searchPromises = platforms.map(async (platform) => {
    const config = PLATFORM_SEARCH_CONFIGS[platform];
    try {
      const searchParams: WebSearchParameters = {
        autoParameters: false,
        chunksPerSource: 1,
        includeAnswer: false,
        includeFavicon: false,
        includeImageDescriptions: false,
        includeImages: false,
        includeRawContent: false,
        maxResults: 3,
        query: config.query(keyword),
        searchDepth: 'basic',
      };

      const result = await performWebSearch(
        searchParams,
        env,
      );

      return result.results.map(r => ({
        platform,
        snippet: r.content || r.excerpt || '',
        title: r.title,
        url: r.url,
      }));
    } catch {
      return [];
    }
  });

  const searchResults = await Promise.all(searchPromises);
  const allResults = searchResults.flat();

  if (allResults.length === 0) {
    return {
      searchSummary: {
        keyword,
        platformsSearched: platforms,
        totalResultsAnalyzed: 0,
      },
      suggestions: [],
    };
  }

  // Format results for AI extraction
  const formattedResults = formatSearchResults(allResults);

  // Use AI to extract trends
  const modelId = ModelIds.GOOGLE_GEMINI_2_5_FLASH;

  const db = await getDbAsync();
  const dbExtractionPrompt = await getAdminSetting(db, 'trendExtractionPrompt');
  const resolvedPrompt = await resolveSkillTokens(dbExtractionPrompt, db);
  const inputPrompt = resolvedPrompt
    .replace('{{keyword}}', keyword)
    .replace('{{results}}', formattedResults);

  try {
    initializeOpenRouter(env);
    const client = await openRouterService.getClient();

    const result = await generateObject({
      model: createTracedModel(client.chat(modelId), { distinctId: 'system', operation: 'trend-discovery' }),
      prompt: inputPrompt,
      schema: TrendExtractionSchema,
      system: systemPrompt?.trim()
        ? `${systemPrompt.trim()}\n\nYou are a trend analyst. Extract trending topics from social media search results and generate discussion prompts for AI debatekit debates. Be concise and focus on genuinely trending topics.`
        : `You are a trend analyst. Extract trending topics from social media search results and generate discussion prompts for AI debatekit debates. Be concise and focus on genuinely trending topics.`,
      temperature: 0.7,
    });

    // Limit to maxSuggestions and ensure proper typing
    const suggestions: TrendSuggestion[] = result.object.suggestions
      .slice(0, maxSuggestions)
      .map(s => ({
        platform: s.platform,
        prompt: s.prompt,
        reasoning: s.reasoning,
        relevanceScore: Math.round(s.relevanceScore),
        suggestedRounds: Math.min(5, Math.max(1, Math.round(s.suggestedRounds))),
        topic: s.topic,
      }));

    return {
      searchSummary: {
        keyword,
        platformsSearched: platforms,
        totalResultsAnalyzed: allResults.length,
      },
      suggestions,
    };
  } catch {
    // Return empty suggestions on AI failure
    return {
      searchSummary: {
        keyword,
        platformsSearched: platforms,
        totalResultsAnalyzed: allResults.length,
      },
      suggestions: [],
    };
  }
}
