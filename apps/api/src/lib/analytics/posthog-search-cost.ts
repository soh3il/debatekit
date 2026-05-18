/**
 * PostHog AI Search Cost Tracking
 *
 * Consolidated tracking for AI search (auto RAG) operations.
 * Tracks costs across all search components:
 * - Search query generation (AI call)
 * - Web search API calls (Serper)
 * - Content extraction (Jina Reader - free)
 * - RAG/vector search operations (Cloudflare Vectorize)
 *
 * Events:
 * - ai_search_started: Fired when search begins
 * - ai_search_completed: Fired on successful completion with costs
 * - ai_search_error: Fired on failure with error details
 *
 * @see https://posthog.com/docs/llm-analytics/traces
 */

import {
  BING_COST_PER_SEARCH,
  CLOUDFLARE_VECTORIZE_COST_PER_MILLION_DIMENSIONS,
  FIRECRAWL_COST_PER_PAGE,
  JINA_READER_COST_PER_EXTRACTION,
  SERPER_COST_PER_SEARCH,
  TAVILY_COST_PER_SEARCH,
} from '@debatekit/shared/constants';
import { ulid } from 'ulid';
import * as z from 'zod';

import { getPostHogClient } from './posthog-server';

// Re-export cost constants for convenience
export {
  BING_COST_PER_SEARCH,
  FIRECRAWL_COST_PER_PAGE,
  JINA_READER_COST_PER_EXTRACTION,
  SERPER_COST_PER_SEARCH,
  TAVILY_COST_PER_SEARCH,
};

/**
 * Default embedding dimensions for cost calculation
 * BGE Base EN v1.5 uses 768 dimensions
 */
const DEFAULT_EMBEDDING_DIMENSIONS = 768;

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

/**
 * Search provider identifier (5-Part Enum Pattern)
 */
export const SEARCH_PROVIDER_VALUES = ['serper', 'tavily', 'bing'] as const;
export const DEFAULT_SEARCH_PROVIDER: SearchProvider = 'serper';
export const SearchProviderSchema = z.enum(SEARCH_PROVIDER_VALUES);
export type SearchProvider = z.infer<typeof SearchProviderSchema>;
export const SearchProviders = {
  BING: 'bing',
  SERPER: 'serper',
  TAVILY: 'tavily',
} as const;

/**
 * Content extraction provider identifier (5-Part Enum Pattern)
 */
export const EXTRACTION_PROVIDER_VALUES = ['jina', 'firecrawl', 'none'] as const;
export const DEFAULT_EXTRACTION_PROVIDER: ExtractionProvider = 'jina';
export const ExtractionProviderSchema = z.enum(EXTRACTION_PROVIDER_VALUES);
export type ExtractionProvider = z.infer<typeof ExtractionProviderSchema>;
export const ExtractionProviders = {
  FIRECRAWL: 'firecrawl',
  JINA: 'jina',
  NONE: 'none',
} as const;

/**
 * AI search tracking context
 */
export const AISearchContextSchema = z.object({
  projectId: z.string().optional(),
  roundNumber: z.number().optional(),
  sessionId: z.string().optional(),
  threadId: z.string(),
  userId: z.string(),
  userTier: z.string().optional(),
});
export type AISearchContext = z.infer<typeof AISearchContextSchema>;

/**
 * Search operation cost breakdown
 */
export const SearchCostBreakdownSchema = z.object({
  contentExtractionCostUsd: z.number().default(0),
  queryGenerationCostUsd: z.number().default(0),
  ragVectorSearchCostUsd: z.number().default(0),
  totalCostUsd: z.number().default(0),
  webSearchCostUsd: z.number().default(0),
});
export type SearchCostBreakdown = z.infer<typeof SearchCostBreakdownSchema>;

/**
 * AI search started event properties
 */
export const AISearchStartedPropsSchema = z.object({
  expectedQueryCount: z.number().optional(),
  extractionProvider: ExtractionProviderSchema.optional(),
  hasRagContext: z.boolean().optional(),
  searchProvider: SearchProviderSchema.optional(),
  userQuery: z.string(),
});
export type AISearchStartedProps = z.infer<typeof AISearchStartedPropsSchema>;

/**
 * AI search completed event properties
 */
export const AISearchCompletedPropsSchema = z.object({
  cacheHitCount: z.number().optional(),
  costs: SearchCostBreakdownSchema,
  durationMs: z.number(),
  extractionProvider: ExtractionProviderSchema.optional(),
  queryCount: z.number(),
  resultCount: z.number(),
  searchProvider: SearchProviderSchema.optional(),
  userQuery: z.string(),
  vectorSearchCount: z.number().optional(),
});
export type AISearchCompletedProps = z.infer<typeof AISearchCompletedPropsSchema>;

/**
 * AI search error event properties
 */
export const AISearchErrorPropsSchema = z.object({
  durationMs: z.number(),
  errorCategory: z.string().optional(),
  errorMessage: z.string(),
  partialCosts: SearchCostBreakdownSchema.optional(),
  searchProvider: SearchProviderSchema.optional(),
  userQuery: z.string(),
});
export type AISearchErrorProps = z.infer<typeof AISearchErrorPropsSchema>;

/**
 * AI search tracking result
 */
export const AISearchTrackingResultSchema = z.object({
  spanId: z.string(),
  traceId: z.string(),
});
export type AISearchTrackingResult = z.infer<typeof AISearchTrackingResultSchema>;

// ============================================================================
// COST CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate web search cost based on provider and query count
 *
 * @param provider - Search provider (serper, tavily, etc.)
 * @param queryCount - Number of search queries executed
 * @returns Total cost in USD
 */
export function calculateWebSearchCost(
  provider: SearchProvider,
  queryCount: number,
): number {
  switch (provider) {
    case 'serper':
      return queryCount * SERPER_COST_PER_SEARCH;
    case 'tavily':
      return queryCount * TAVILY_COST_PER_SEARCH;
    case 'bing':
      return queryCount * BING_COST_PER_SEARCH;
    default:
      return 0;
  }
}

/**
 * Calculate content extraction cost based on provider and URL count
 *
 * @param provider - Extraction provider (jina, firecrawl, etc.)
 * @param urlCount - Number of URLs extracted
 * @returns Total cost in USD
 */
export function calculateExtractionCost(
  provider: ExtractionProvider,
  urlCount: number,
): number {
  switch (provider) {
    case 'jina':
      return urlCount * JINA_READER_COST_PER_EXTRACTION;
    case 'firecrawl':
      return urlCount * FIRECRAWL_COST_PER_PAGE;
    case 'none':
    default:
      return 0;
  }
}

/**
 * Calculate RAG vector search cost based on Cloudflare Vectorize pricing
 *
 * @param vectorCount - Number of vectors queried
 * @param dimensions - Vector dimensions (default: 768 for BGE Base EN)
 * @returns Total cost in USD
 */
export function calculateVectorSearchCost(
  vectorCount: number,
  dimensions: number = DEFAULT_EMBEDDING_DIMENSIONS,
): number {
  const totalDimensions = vectorCount * dimensions;
  return (totalDimensions / 1_000_000) * CLOUDFLARE_VECTORIZE_COST_PER_MILLION_DIMENSIONS;
}

/**
 * Calculate total search operation cost
 *
 * @param params - Cost calculation parameters
 * @param params.queryGenerationCostUsd - Cost of AI query generation
 * @param params.searchProvider - Web search provider used
 * @param params.searchQueryCount - Number of search queries executed
 * @param params.extractionProvider - Content extraction provider used
 * @param params.extractionUrlCount - Number of URLs extracted
 * @param params.vectorQueryCount - Number of vector search queries
 * @param params.vectorDimensions - Dimensions per vector (default: 768)
 * @returns Complete cost breakdown
 */
export function calculateTotalSearchCost(params: {
  queryGenerationCostUsd?: number;
  searchProvider?: SearchProvider;
  searchQueryCount?: number;
  extractionProvider?: ExtractionProvider;
  extractionUrlCount?: number;
  vectorQueryCount?: number;
  vectorDimensions?: number;
}): SearchCostBreakdown {
  const queryGenerationCostUsd = params.queryGenerationCostUsd ?? 0;

  const webSearchCostUsd = params.searchProvider && params.searchQueryCount
    ? calculateWebSearchCost(params.searchProvider, params.searchQueryCount)
    : 0;

  const contentExtractionCostUsd = params.extractionProvider && params.extractionUrlCount
    ? calculateExtractionCost(params.extractionProvider, params.extractionUrlCount)
    : 0;

  const ragVectorSearchCostUsd = params.vectorQueryCount
    ? calculateVectorSearchCost(params.vectorQueryCount, params.vectorDimensions)
    : 0;

  const totalCostUsd = queryGenerationCostUsd
    + webSearchCostUsd
    + contentExtractionCostUsd
    + ragVectorSearchCostUsd;

  return {
    contentExtractionCostUsd,
    queryGenerationCostUsd,
    ragVectorSearchCostUsd,
    totalCostUsd,
    webSearchCostUsd,
  };
}

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================

/**
 * Generate trace and span IDs for search tracking
 */
export function initializeSearchTracking(): AISearchTrackingResult {
  return {
    spanId: `span_${ulid()}`,
    traceId: `trace_${ulid()}`,
  };
}

/**
 * Track AI search started event
 *
 * Call this when a search operation begins to capture the start state.
 *
 * @param context - Search context (user, thread, project info)
 * @param props - Search started properties
 * @param trackingIds - Trace and span IDs from initializeSearchTracking
 */
export async function trackAISearchStarted(
  context: AISearchContext,
  props: AISearchStartedProps,
  trackingIds: AISearchTrackingResult,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId ?? context.userId,
      event: 'ai_search_started',
      properties: {
        $ai_span_id: trackingIds.spanId,
        $ai_span_name: 'ai_search',
        // Required trace properties
        $ai_trace_id: trackingIds.traceId,

        // Session linking
        ...(context.sessionId && { $session_id: context.sessionId }),

        expected_query_count: props.expectedQueryCount,
        extraction_provider: props.extractionProvider,
        has_rag_context: props.hasRagContext ?? false,
        project_id: context.projectId,
        round_number: context.roundNumber,

        search_provider: props.searchProvider,
        // Context
        thread_id: context.threadId,
        // Search parameters
        user_query: props.userQuery,
        user_tier: context.userTier ?? 'free',
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail - analytics should not break the application
  }
}

/**
 * Track AI search completed event
 *
 * Call this when a search operation completes successfully.
 * Includes full cost breakdown and metrics.
 *
 * @param context - Search context (user, thread, project info)
 * @param props - Search completed properties with costs
 * @param trackingIds - Trace and span IDs from initializeSearchTracking
 */
export async function trackAISearchCompleted(
  context: AISearchContext,
  props: AISearchCompletedProps,
  trackingIds: AISearchTrackingResult,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    const latencySeconds = props.durationMs / 1000;

    posthog.capture({
      distinctId: context.sessionId ?? context.userId,
      event: 'ai_search_completed',
      properties: {
        $ai_is_error: false,
        $ai_latency: latencySeconds,
        $ai_span_id: trackingIds.spanId,
        $ai_span_name: 'ai_search',
        // Required trace properties
        $ai_trace_id: trackingIds.traceId,

        // Session linking
        ...(context.sessionId && { $session_id: context.sessionId }),

        $ai_total_cost_usd: props.costs.totalCostUsd,
        cache_hit_count: props.cacheHitCount ?? 0,
        content_extraction_cost_usd: props.costs.contentExtractionCostUsd,
        // Total cost (PostHog Revenue Analytics compatible)
        cost_usd: props.costs.totalCostUsd,
        duration_ms: props.durationMs,
        extraction_provider: props.extractionProvider,
        project_id: context.projectId,
        query_count: props.queryCount,

        // Cost breakdown (individual components)
        query_generation_cost_usd: props.costs.queryGenerationCostUsd,
        rag_vector_search_cost_usd: props.costs.ragVectorSearchCostUsd,
        result_count: props.resultCount,
        round_number: context.roundNumber,

        search_provider: props.searchProvider,
        // Context
        thread_id: context.threadId,

        // Search results
        user_query: props.userQuery,
        user_tier: context.userTier ?? 'free',
        vector_search_count: props.vectorSearchCount ?? 0,
        web_search_cost_usd: props.costs.webSearchCostUsd,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail - analytics should not break the application
  }
}

/**
 * Track AI search error event
 *
 * Call this when a search operation fails.
 * Captures error details and any partial costs incurred.
 *
 * @param context - Search context (user, thread, project info)
 * @param props - Search error properties
 * @param trackingIds - Trace and span IDs from initializeSearchTracking
 */
export async function trackAISearchError(
  context: AISearchContext,
  props: AISearchErrorProps,
  trackingIds: AISearchTrackingResult,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    const latencySeconds = props.durationMs / 1000;

    posthog.capture({
      distinctId: context.sessionId ?? context.userId,
      event: 'ai_search_error',
      properties: {
        $ai_is_error: true,
        $ai_latency: latencySeconds,
        $ai_span_id: trackingIds.spanId,
        $ai_span_name: 'ai_search',
        // Required trace properties
        $ai_trace_id: trackingIds.traceId,

        // Session linking
        ...(context.sessionId && { $session_id: context.sessionId }),

        // Error details
        $ai_error: {
          category: props.errorCategory,
          message: props.errorMessage,
        },
        duration_ms: props.durationMs,
        error_category: props.errorCategory ?? 'unknown',

        error_message: props.errorMessage,
        search_provider: props.searchProvider,
        // Search context
        user_query: props.userQuery,

        // Partial costs (if any operations completed before failure)
        ...(props.partialCosts && {
          $ai_total_cost_usd: props.partialCosts.totalCostUsd,
          content_extraction_cost_usd: props.partialCosts.contentExtractionCostUsd,
          cost_usd: props.partialCosts.totalCostUsd,
          query_generation_cost_usd: props.partialCosts.queryGenerationCostUsd,
          rag_vector_search_cost_usd: props.partialCosts.ragVectorSearchCostUsd,
          web_search_cost_usd: props.partialCosts.webSearchCostUsd,
        }),

        project_id: context.projectId,
        round_number: context.roundNumber,
        // Context
        thread_id: context.threadId,
        user_tier: context.userTier ?? 'free',
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail - analytics should not break the application
  }
}

// ============================================================================
// CONVENIENCE WRAPPER
// ============================================================================

/**
 * AI Search tracking helper object
 *
 * Provides a clean API for tracking search operations:
 * ```ts
 * const tracking = initializeSearchTracking();
 * await aiSearchTracking.started(context, { userQuery: 'test' }, tracking);
 * // ... perform search ...
 * await aiSearchTracking.completed(context, { ... }, tracking);
 * ```
 */
export const aiSearchTracking = {
  completed: trackAISearchCompleted,
  error: trackAISearchError,
  initialize: initializeSearchTracking,
  started: trackAISearchStarted,
};
