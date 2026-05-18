import { z } from '@hono/zod-openapi';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// ============================================================================
// TREND PLATFORM (5-part enum pattern)
// ============================================================================

// 1. ARRAY CONSTANT
export const TREND_PLATFORM_VALUES = ['reddit', 'twitter', 'instagram'] as const;

// 2. ZOD SCHEMA
export const TrendPlatformSchema = z.enum(TREND_PLATFORM_VALUES);

// 3. TYPESCRIPT TYPE
export type TrendPlatform = z.infer<typeof TrendPlatformSchema>;

// 4. DEFAULT VALUE
export const _DEFAULT_TREND_PLATFORM: TrendPlatform = 'reddit';

// 5. CONSTANT OBJECT
export const TrendPlatforms = {
  INSTAGRAM: 'instagram' as const,
  REDDIT: 'reddit' as const,
  TWITTER: 'twitter' as const,
} as const;

/**
 * Discover trends request
 */
export const DiscoverTrendsRequestSchema = z.object({
  keyword: z.string().min(2).max(100).openapi({
    description: 'Keyword to search for trending topics (2-100 characters)',
    example: 'AI regulations',
  }),
  maxSuggestions: z.number().int().min(1).max(10).default(5).openapi({
    description: 'Maximum number of suggestions to return (1-10)',
    example: 5,
  }),
  platforms: z.array(TrendPlatformSchema).default([TrendPlatforms.REDDIT, TrendPlatforms.TWITTER]).openapi({
    description: 'Platforms to search for trends',
    example: ['reddit', 'twitter'],
  }),
}).openapi('DiscoverTrendsRequest');

export type DiscoverTrendsRequest = z.infer<typeof DiscoverTrendsRequestSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Single trend suggestion
 */
export const TrendSuggestionSchema = z.object({
  platform: TrendPlatformSchema.openapi({
    description: 'Source platform where trend was found',
    example: 'reddit',
  }),
  prompt: z.string().openapi({
    description: 'Generated discussion prompt',
    example: 'What are the implications of the new EU AI Act for startups?',
  }),
  reasoning: z.string().openapi({
    description: 'Why this topic is trending and the round count rationale',
    example: 'High engagement on r/startups with 500+ comments discussing compliance challenges',
  }),
  relevanceScore: z.number().min(0).max(100).openapi({
    description: 'Relevance score (0-100)',
    example: 85,
  }),
  suggestedRounds: z.number().int().min(1).max(5).openapi({
    description: 'Suggested number of discussion rounds (1-5)',
    example: 3,
  }),
  topic: z.string().openapi({
    description: 'Brief topic name',
    example: 'EU AI Act startup impact',
  }),
}).openapi('TrendSuggestion');

export type TrendSuggestion = z.infer<typeof TrendSuggestionSchema>;

/**
 * Search summary metadata
 */
export const SearchSummarySchema = z.object({
  keyword: z.string().openapi({
    description: 'Original search keyword',
    example: 'AI regulations',
  }),
  platformsSearched: z.array(z.string()).openapi({
    description: 'Platforms that were searched',
    example: ['reddit', 'twitter'],
  }),
  totalResultsAnalyzed: z.number().openapi({
    description: 'Total search results analyzed',
    example: 15,
  }),
}).openapi('SearchSummary');

export type SearchSummary = z.infer<typeof SearchSummarySchema>;

/**
 * Discover trends response
 */
export const DiscoverTrendsResponseSchema = z.object({
  searchSummary: SearchSummarySchema.openapi({
    description: 'Summary of the search operation',
  }),
  suggestions: z.array(TrendSuggestionSchema).openapi({
    description: 'List of trend suggestions',
  }),
}).openapi('DiscoverTrendsResponse');

export type DiscoverTrendsResponse = z.infer<typeof DiscoverTrendsResponseSchema>;
