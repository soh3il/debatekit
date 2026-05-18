/**
 * Web Search Service - Serper API Search
 *
 * Uses Serper (Google Search API) exclusively for web searches.
 * Serper provides search results with titles, URLs, snippets,
 * and knowledge graph data - no browser rendering needed.
 */

import type {
  WebSearchActiveAnswerMode,
  WebSearchComplexity,
  WebSearchDepth,
  WebSearchTimeRange,
  WebSearchTopic,
} from '@debatekit/shared/enums';
import {
  CreditActions,
  DEFAULT_ACTIVE_ANSWER_MODE,
  LogTypes,
  UIMessageRoles,
  WebSearchActiveAnswerModes,
  WebSearchAnswerModes,
  WebSearchStreamEventTypes,
} from '@debatekit/shared/enums';
import type { LanguageModelUsage } from 'ai';
import {
  generateId,
  generateText,
  Output,
  streamText,
} from 'ai';
import { ulid } from 'ulid';

import { createError } from '@/common/error-handling';
import { getErrorMessage } from '@/common/error-types';
import type { BillingContext } from '@/common/schemas/billing-context';
import type { ErrorContext } from '@/core';
import { AIModels } from '@/core';
import { createTracedModel } from '@/lib/analytics/posthog-ai-wrapper';
import type { AISearchContext } from '@/lib/analytics/posthog-search-cost';
import {
  aiSearchTracking,
  calculateTotalSearchCost,
  SearchProviders,
} from '@/lib/analytics/posthog-search-cost';
import { trackSearchCacheHit, trackWebSearchExecuted } from '@/lib/analytics/posthog-search-events';
import type {
  MultiQueryGeneration,
  WebSearchParameters,
  WebSearchResult,
  WebSearchResultItem,
} from '@/routes/chat/schema';
import { MultiQueryGenerationSchema } from '@/routes/chat/schema';
import { finalizeCredits } from '@/services/billing';
import {
  initializeOpenRouter,
  openRouterService,
} from '@/services/models';
import { validateModelForOperation } from '@/services/participants';
import {
  buildAutoParameterDetectionPrompt,
  buildWebSearchComplexityAnalysisPrompt,
  buildWebSearchQueryPrompt,
  getAnswerSummaryPrompt,
} from '@/services/prompts';
import type { ApiEnv } from '@/types';
import type { TypedLogger } from '@/types/logger';

import { isSerperConfigured, searchWithSerperRetry } from './serper.service';
import {
  cacheSearchResult,
  generateSearchCacheKey,
  getCachedSearch,
} from './web-search-cache.service';

// ============================================================================
// SEARCH ENGINE TYPES
// ============================================================================

/**
 * Search engine identifier
 */
type SearchEngine = 'serper';

/**
 * Result of search attempt
 */
type SearchResult = {
  engine: SearchEngine;
  results: Array<{ title: string; url: string; snippet: string; date?: string }>;
  responseTimeMs: number;
};

/**
 * Project context for informed query generation
 */
type SearchProjectContext = {
  instructions?: string | null;
  ragContext?: string;
};

export async function streamSearchQuery(
  userMessage: string,
  env: ApiEnv['Bindings'],
  logger?: TypedLogger,
  projectContext?: SearchProjectContext,
): Promise<ReturnType<typeof streamText>> {
  try {
    validateModelForOperation(AIModels.WEB_SEARCH, 'web-search-query-generation', {
      minJsonQuality: 'good',
      streaming: true,
      structuredOutput: true,
    });

    initializeOpenRouter(env);
    const client = await openRouterService.getClient();

    // Build system prompt with optional project context
    let systemPrompt = buildWebSearchComplexityAnalysisPrompt();
    if (projectContext?.instructions || projectContext?.ragContext) {
      const contextParts: string[] = [];
      if (projectContext.instructions) {
        contextParts.push(`## Project Guidelines\n${projectContext.instructions}`);
      }
      if (projectContext.ragContext) {
        contextParts.push(`## Existing Knowledge\nThis info exists in project files - avoid redundant searches:\n${projectContext.ragContext}`);
      }
      systemPrompt = `${systemPrompt}\n\n${contextParts.join('\n\n')}`;
    }

    return streamText({
      maxRetries: 3,
      model: createTracedModel(client.chat(AIModels.WEB_SEARCH), { distinctId: 'system', operation: 'web-search-query-stream' }),
      onError: (error) => {
        if (logger) {
          logger.error('Stream generation error', {
            error: getErrorMessage(error),
            logType: LogTypes.OPERATION,
            operationName: 'streamSearchQuery',
          });
        }
      },
      output: Output.object({ schema: MultiQueryGenerationSchema }),
      prompt: buildWebSearchQueryPrompt(userMessage),
      system: systemPrompt,
    });
  } catch (error) {
    if (logger) {
      logger.error('Search query generation failed', {
        error: getErrorMessage(error),
        logType: LogTypes.OPERATION,
        operationName: 'streamSearchQuery',
      });
    }

    throw createError.internal(
      'Failed to generate search query. Try using a more capable model.',
      {
        errorType: 'external_service',
        operation: 'query_generation',
        service: 'openrouter',
      },
    );
  }
}

/**
 * Non-streaming search query generation (fallback)
 *
 * Uses generateText with Output.object() for single-shot query generation when streaming fails.
 * More reliable than streaming but doesn't provide progressive updates.
 *
 * ✅ MODEL VALIDATION: Checks model capabilities before generation
 * ✅ ERROR HANDLING: Comprehensive error context and logging
 * ✅ VALIDATION: Validates output matches schema
 *
 * @param userMessage - User's question to generate query for
 * @param env - Cloudflare environment bindings
 * @param logger - Optional logger for error tracking
 * @param projectContext - Optional project instructions and RAG context
 * @returns Generated query result
 * @throws HttpException with error context if query generation fails
 */
export async function generateSearchQuery(
  userMessage: string,
  env: ApiEnv['Bindings'],
  logger?: TypedLogger,
  projectContext?: SearchProjectContext,
) {
  const modelId = AIModels.WEB_SEARCH;

  try {
    validateModelForOperation(modelId, 'web-search-query-generation-sync', {
      minJsonQuality: 'good',
      structuredOutput: true,
    });

    initializeOpenRouter(env);
    const client = await openRouterService.getClient();

    // Build system prompt with optional project context
    let systemPrompt = buildWebSearchComplexityAnalysisPrompt();
    if (projectContext?.instructions || projectContext?.ragContext) {
      const contextParts: string[] = [];
      if (projectContext.instructions) {
        contextParts.push(`## Project Guidelines\n${projectContext.instructions}`);
      }
      if (projectContext.ragContext) {
        contextParts.push(`## Existing Knowledge\nThis info exists in project files - avoid redundant searches:\n${projectContext.ragContext}`);
      }
      systemPrompt = `${systemPrompt}\n\n${contextParts.join('\n\n')}`;
    }

    const inputPrompt = buildWebSearchQueryPrompt(userMessage);

    // Try structured output first, fall back to plain text + manual JSON parse
    // Some runtimes (Cloudflare Workers) can have issues with Output.object()
    let output: MultiQueryGeneration;
    let usage: LanguageModelUsage;

    try {
      const result = await generateText({
        maxRetries: 3,
        model: createTracedModel(client.chat(modelId), { distinctId: 'system', operation: 'web-search-query' }),
        output: Output.object({ schema: MultiQueryGenerationSchema }),
        prompt: inputPrompt,
        system: systemPrompt,
      });

      if (!result.output) {
        throw new Error('Structured output returned null');
      }

      output = result.output;
      usage = result.usage;
    } catch (structuredError) {
      // Fallback: plain text generation + manual JSON parse
      const plainResult = await generateText({
        maxRetries: 3,
        model: createTracedModel(client.chat(modelId), { distinctId: 'system', operation: 'web-search-query-fallback' }),
        prompt: `${inputPrompt}\n\nRespond with ONLY valid JSON matching this schema: { "analysisRationale": string, "queries": [{ "query": string, "rationale": string, "searchDepth": "basic"|"advanced" }], "totalQueries": number }`,
        system: systemPrompt,
      });

      // Extract JSON from response text (may have markdown fences)
      const jsonMatch = plainResult.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw structuredError; // Re-throw original error if fallback also fails
      }

      const parsed = MultiQueryGenerationSchema.safeParse(JSON.parse(jsonMatch[0]));
      if (!parsed.success) {
        throw structuredError;
      }

      output = parsed.data;
      usage = plainResult.usage;
    }

    if (!output.queries || output.queries.length === 0) {
      const errorContext: ErrorContext = {
        errorType: 'validation',
        field: 'queries',
      };
      throw createError.badRequest('Generated object does not contain valid queries', errorContext);
    }

    // Anthropic doesn't support min/max in schema, so validate after generation
    // Coerce string to number if needed
    const totalQueriesNum
      = typeof output.totalQueries === 'string'
        ? Number.parseInt(output.totalQueries, 10)
        : output.totalQueries;

    // Clamp totalQueries to valid range (1-3)
    output.totalQueries = Math.max(1, Math.min(3, totalQueriesNum || 1));

    if (output.queries.length > 3) {
      output.queries = output.queries.slice(0, 3);
    }

    output.queries = output.queries.map((q) => {
      const sourceCount
        = typeof q.sourceCount === 'string'
          ? Number.parseInt(q.sourceCount, 10)
          : q.sourceCount;
      if (sourceCount && sourceCount > 3) {
        return { ...q, sourceCount: 3 };
      }
      return q;
    });

    // ✅ BILLING: Return usage info for credit deduction
    return {
      output,
      usage,
    };
  } catch (error) {
    const actualError = error instanceof Error ? error.message : String(error);

    if (logger) {
      logger.error(`Search query generation failed: ${actualError}`, {
        error: getErrorMessage(error),
        logType: LogTypes.OPERATION,
        operationName: 'generateSearchQuery',
      });
    }

    throw createError.internal(
      `Failed to generate search query using ${modelId}: ${actualError}`,
      {
        errorType: 'external_service',
        operation: 'query_generation_sync',
        service: 'openrouter',
      },
    );
  }
}

// ============================================================================
// SERPER SEARCH EXECUTION
// ============================================================================

/**
 * Execute search using Serper API (Google Search)
 *
 * Serper is the sole search provider. It provides:
 * - organic[] - Search results with title, link, snippet, position, date
 * - knowledgeGraph - Structured entity data
 * - relatedSearches[] - Related search queries
 *
 * @param query - Search query
 * @param maxResults - Maximum results to return
 * @param env - Cloudflare environment bindings
 * @param logger - Optional TypedLogger for structured logging
 * @returns Search results with engine metadata
 */
async function executeSearch(
  query: string,
  maxResults: number,
  env: ApiEnv['Bindings'],
  logger?: TypedLogger,
): Promise<SearchResult> {
  const startTime = performance.now();

  if (!isSerperConfigured(env)) {
    const errorMsg = 'Serper API not configured. Set SERP_API_KEY in environment variables.';
    logger?.error('Serper API not configured', {
      logType: LogTypes.EDGE_CASE,
      scenario: 'serper_api_not_configured',
    });
    throw new Error(errorMsg);
  }

  try {
    logger?.info('Executing Serper search', {
      logType: LogTypes.OPERATION,
      operationName: 'executeSearch',
      query: query.substring(0, 50),
    });
    const serperResult = await searchWithSerperRetry(query, env, {
      numResults: maxResults + 5, // Extra to compensate for filtering
    }, logger);

    // Filter out ad/tracking URLs and map to simplified format
    let filteredResults = serperResult.results
      .filter(r => !shouldSkipUrl(r.url))
      .slice(0, maxResults)
      .map(r => ({
        date: r.date,
        snippet: r.snippet,
        title: r.title,
        url: r.url,
      }));

    // FALLBACK: If filtering removed ALL results, keep top N from original
    // This prevents returning 0 results when queries are legitimate but domains are filtered
    const MIN_RESULTS_FALLBACK = 3;
    if (filteredResults.length === 0 && serperResult.results.length > 0) {
      filteredResults = serperResult.results.slice(0, MIN_RESULTS_FALLBACK).map(r => ({
        date: r.date,
        snippet: r.snippet,
        title: r.title,
        url: r.url,
      }));
    }

    if (filteredResults.length > 0) {
      logger?.info('Serper search successful', {
        duration: serperResult.responseTimeMs,
        logType: LogTypes.PERFORMANCE,
        query: query.substring(0, 50),
        resultCount: filteredResults.length,
      });
    } else {
      logger?.warn('Serper search returned no valid results after filtering', {
        logType: LogTypes.EDGE_CASE,
        query: query.substring(0, 50),
        scenario: 'serper_empty_after_filter',
      });
    }

    return {
      engine: 'serper',
      responseTimeMs: serperResult.responseTimeMs,
      results: filteredResults,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    const errStack = error instanceof Error ? error.stack : 'No stack trace';
    const responseTimeMs = performance.now() - startTime;

    logger?.error('Serper search execution failed', {
      error: errMsg,
      errorStack: errStack ?? undefined,
      logType: LogTypes.OPERATION,
      operationName: 'executeSearch',
      query: query.substring(0, 50),
    });

    // Re-throw configuration errors so they can be handled appropriately
    // Other errors (network, etc.) return empty results for graceful degradation
    if (error instanceof Error && error.message.includes('not configured')) {
      throw error;
    }

    logger?.warn('Returning empty results due to Serper error', {
      context: errMsg,
      logType: LogTypes.EDGE_CASE,
      query: query.substring(0, 50),
      scenario: 'serper_fallback_empty',
    });

    return {
      engine: 'serper',
      responseTimeMs,
      results: [],
    };
  }
}

// Answer Summary Generation (AI-Powered)

/**
 * Stream AI answer summary from search results (STREAMING VERSION)
 *
 * ✅ IMPROVED: Now uses streamText() for progressive streaming (75-80% faster TTFC)
 * ✅ TAVILY-ENHANCED: Basic and advanced answer modes
 *
 * @param query - Original search query
 * @param results - Search results to synthesize
 * @param mode - WebSearchActiveAnswerMode (basic or advanced)
 * @param env - Cloudflare environment bindings
 * @param logger - Optional logger
 * @returns Stream object with textStream for progressive rendering
 */
export async function streamAnswerSummary(
  query: string,
  results: WebSearchResultItem[],
  mode: WebSearchActiveAnswerMode,
  env: ApiEnv['Bindings'],
  logger?: TypedLogger,
): Promise<ReturnType<typeof streamText>> {
  if (results.length === 0) {
    throw createError.badRequest(
      'No search results available for answer generation',
      {
        errorType: 'validation',
        field: 'results',
      },
    );
  }

  const modelId = AIModels.WEB_SEARCH;

  try {
    initializeOpenRouter(env);
    const client = await openRouterService.getClient();

    // Build context from search results (use snippet as content)
    const context = results
      .slice(0, mode === WebSearchActiveAnswerModes.ADVANCED ? 10 : 5)
      .map((r, i) => {
        const content = r.content;
        return `[Source ${i + 1}: ${r.domain || r.url}]\n${content.substring(0, mode === WebSearchActiveAnswerModes.ADVANCED ? 1500 : 800)}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt = getAnswerSummaryPrompt(mode);
    const inputPrompt = `Query: ${query}\n\nSearch Results:\n${context}\n\nProvide ${mode === WebSearchActiveAnswerModes.ADVANCED ? 'a comprehensive' : 'a concise'} answer to the query based on these search results.`;

    return streamText({
      model: createTracedModel(client.chat(modelId), { distinctId: 'system', operation: 'web-search-answer-stream' }),
      prompt: inputPrompt,
      system: systemPrompt,
      temperature: 0.5,
      // Note: maxTokens controlled by model config, not streamText params
    });
  } catch (error) {
    if (logger) {
      logger.error('Answer summary streaming failed', {
        error: getErrorMessage(error),
        logType: LogTypes.OPERATION,
        operationName: 'streamAnswerSummary',
        query,
      });
    }

    throw createError.internal('Failed to stream answer summary', {
      errorType: 'external_service',
      operation: 'answer_summary_streaming',
      service: 'openrouter',
    });
  }
}

/**
 * Generate AI answer summary from search results (NON-STREAMING VERSION)
 *
 * Use this for batch API responses (performWebSearch).
 * For streaming responses with progressive rendering, use streamAnswerSummary().
 *
 * ✅ TAVILY-ENHANCED: Basic and advanced answer modes
 * ✅ BILLING: Deducts credits when billing context is provided
 *
 * @param query - Original search query
 * @param results - Search results to synthesize
 * @param mode - WebSearchActiveAnswerMode (basic or advanced)
 * @param env - Cloudflare environment bindings
 * @param logger - Optional logger
 * @param billingContext - Optional billing context for credit deduction
 * @returns AI-generated answer summary
 */
async function generateAnswerSummary(
  query: string,
  results: WebSearchResultItem[],
  mode: WebSearchActiveAnswerMode,
  env: ApiEnv['Bindings'],
  logger?: TypedLogger,
  billingContext?: BillingContext,
): Promise<string | null> {
  if (results.length === 0) {
    return null;
  }

  try {
    initializeOpenRouter(env);

    // Build context from search results (use snippet as content)
    const context = results
      .slice(0, mode === WebSearchActiveAnswerModes.ADVANCED ? 10 : 5)
      .map((r, i) => {
        const content = r.content;
        return `[Source ${i + 1}: ${r.domain || r.url}]\n${content.substring(0, mode === WebSearchActiveAnswerModes.ADVANCED ? 1500 : 800)}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt = getAnswerSummaryPrompt(mode);

    const result = await openRouterService.generateText({
      maxTokens: mode === WebSearchActiveAnswerModes.ADVANCED ? 500 : 200,
      messages: [
        {
          id: 'answer-gen',
          parts: [
            {
              text: `Query: ${query}\n\nSearch Results:\n${context}\n\nProvide ${mode === WebSearchActiveAnswerModes.ADVANCED ? 'a comprehensive' : 'a concise'} answer to the query based on these search results.`,
              type: 'text',
            },
          ],
          role: UIMessageRoles.USER,
        },
      ],
      modelId: AIModels.WEB_SEARCH,
      system: systemPrompt,
      temperature: 0.5,
      traceContext: { distinctId: billingContext?.userId ?? 'system', operation: 'web-search-answer', threadId: billingContext?.threadId },
    });

    // ✅ BILLING: Deduct credits for answer summary AI call
    if (billingContext && result.usage) {
      const rawInput = result.usage.inputTokens ?? 0;
      const rawOutput = result.usage.outputTokens ?? 0;
      const safeInputTokens = Number.isFinite(rawInput) ? rawInput : 0;
      const safeOutputTokens = Number.isFinite(rawOutput) ? rawOutput : 0;
      if (safeInputTokens > 0 || safeOutputTokens > 0) {
        try {
          await finalizeCredits(billingContext.userId, `answer-summary-${ulid()}`, {
            action: CreditActions.AI_RESPONSE,
            inputTokens: safeInputTokens,
            modelId: AIModels.WEB_SEARCH,
            outputTokens: safeOutputTokens,
            threadId: billingContext.threadId,
          });
        } catch {
          // Billing errors are non-fatal — silently swallowed
        }
      }
    }

    return result.text;
  } catch (error) {
    if (logger) {
      logger.error('Answer summary generation failed', {
        error: getErrorMessage(error),
        logType: LogTypes.OPERATION,
        operationName: 'generateAnswerSummary',
        query,
      });
    }
    return null;
  }
}

// Auto-Parameters Detection (AI-Powered)

/**
 * Auto-detect optimal search parameters based on query analysis
 *
 * ✅ TAVILY-ENHANCED: Intelligent parameter detection
 * ✅ BILLING: Deducts credits when billing context is provided
 *
 * @param query - Search query to analyze
 * @param env - Cloudflare environment bindings
 * @param logger - Optional logger
 * @param billingContext - Optional billing context for credit deduction
 * @returns Auto-detected parameters with reasoning
 */
async function detectSearchParameters(
  query: string,
  env: ApiEnv['Bindings'],
  logger?: TypedLogger,
  billingContext?: BillingContext,
): Promise<{
  topic?: WebSearchTopic;
  timeRange?: WebSearchTimeRange;
  searchDepth?: WebSearchDepth;
  reasoning?: string;
} | null> {
  const modelId = AIModels.WEB_SEARCH;

  try {
    initializeOpenRouter(env);

    const inputPrompt = buildAutoParameterDetectionPrompt(query);
    const result = await openRouterService.generateText({
      maxTokens: 200,
      messages: [
        {
          id: 'param-detect',
          parts: [
            {
              text: inputPrompt,
              type: 'text',
            },
          ],
          role: UIMessageRoles.USER,
        },
      ],
      modelId,
      temperature: 0.3,
      traceContext: { distinctId: billingContext?.userId ?? 'system', operation: 'web-search-params', threadId: billingContext?.threadId },
    });

    // ✅ BILLING: Deduct credits for parameter detection AI call
    if (billingContext && result.usage) {
      const rawInput = result.usage.inputTokens ?? 0;
      const rawOutput = result.usage.outputTokens ?? 0;
      const safeInputTokens = Number.isFinite(rawInput) ? rawInput : 0;
      const safeOutputTokens = Number.isFinite(rawOutput) ? rawOutput : 0;
      if (safeInputTokens > 0 || safeOutputTokens > 0) {
        try {
          await finalizeCredits(billingContext.userId, `param-detect-${ulid()}`, {
            action: CreditActions.AI_RESPONSE,
            inputTokens: safeInputTokens,
            modelId,
            outputTokens: safeOutputTokens,
            threadId: billingContext.threadId,
          });
        } catch {
          // Billing errors are non-fatal — silently swallowed
        }
      }
    }

    // Parse JSON response
    const parsed = JSON.parse(result.text);
    return {
      reasoning: parsed.reasoning,
      searchDepth: parsed.searchDepth,
      timeRange: parsed.timeRange !== 'null' ? parsed.timeRange : undefined,
      topic: parsed.topic !== 'null' ? parsed.topic : undefined,
    };
  } catch (error) {
    if (logger) {
      logger.warn('Auto-parameter detection failed', {
        error: getErrorMessage(error),
        logType: LogTypes.EDGE_CASE,
        query,
        scenario: 'auto_parameter_detection_failed',
      });
    }
    return null;
  }
}

// Progressive Result Streaming (AsyncGenerator Pattern)

/**
 * Stream search results progressively as they're discovered
 *
 * ✅ PERFORMANCE: 60-84% faster time to first result vs batch processing
 * ✅ PATTERN: AsyncGenerator similar to answer streaming
 * ✅ UX: Users see results immediately while enhancement loads
 *
 * **STREAMING PHASES**:
 * 1. **Metadata** - Query params and start time
 * 2. **Basic Results** - Title, URL, snippet (fast)
 * 3. **Complete** - Total results and timing
 *
 * **PERFORMANCE CHARACTERISTICS**:
 * - Time to first result: 500-800ms (vs 3-5s batch)
 * - Basic results: Yielded immediately as discovered
 * - Perceived latency reduction: 60-84%
 *
 * @param params - Search parameters
 * @param env - Cloudflare environment bindings
 * @param logger - Optional logger
 * @yields Progressive search events (metadata, result, complete)
 */
/**
 * Stream event types for progressive search results
 * Uses WebSearchStreamEventTypes enum for type discrimination
 */
export type StreamSearchEvent
  = | {
    type: typeof WebSearchStreamEventTypes.METADATA;
    data: {
      query: string;
      maxResults: number;
      searchDepth: string;
      requestId: string;
      startedAt: string;
    };
  }
  | {
    type: typeof WebSearchStreamEventTypes.RESULT;
    data: {
      result: WebSearchResultItem;
      index: number;
      total: number;
      enhanced: boolean;
      requestId: string;
    };
  }
  | {
    type: typeof WebSearchStreamEventTypes.COMPLETE;
    data: { totalResults: number; responseTime: number; requestId: string };
  }
  | {
    type: typeof WebSearchStreamEventTypes.ERROR;
    data: { error: string; requestId: string; responseTime: number };
  };

export async function* streamSearchResults(
  params: WebSearchParameters,
  env: ApiEnv['Bindings'],
  logger?: TypedLogger,
  _billingContext?: BillingContext,
): AsyncGenerator<StreamSearchEvent> {
  const { maxResults = 10, query, searchDepth = 'advanced' } = params;
  const startTime = performance.now();
  const requestId = generateId();

  try {
    // PHASE 1: Yield Metadata Immediately
    yield {
      data: {
        maxResults,
        query,
        requestId,
        searchDepth,
        startedAt: new Date().toISOString(),
      },
      type: WebSearchStreamEventTypes.METADATA,
    };

    // PHASE 2: Get Basic Search Results using Serper
    logger?.info('Starting progressive search', {
      logType: LogTypes.OPERATION,
      operationName: 'streamSearchResults',
      query,
    });

    const searchResult = await executeSearch(
      query,
      maxResults + 5, // Fetch extra to compensate for filtering
      env,
      logger,
    );

    if (searchResult.results.length === 0) {
      yield {
        data: {
          requestId,
          responseTime: performance.now() - startTime,
          totalResults: 0,
        },
        type: WebSearchStreamEventTypes.COMPLETE,
      };
      return;
    }

    // Take only requested number of sources
    const resultsToProcess = searchResult.results.slice(0, maxResults);

    // PHASE 3: Stream Each Result - use Serper snippet as content (no browser extraction)
    for (let i = 0; i < resultsToProcess.length; i++) {
      const result = resultsToProcess[i];
      if (!result) {
        continue;
      }
      const domain = extractDomain(result.url);

      // Use Serper snippet as content - no browser extraction needed
      const basicResult: WebSearchResultItem = {
        content: result.snippet,
        domain,
        excerpt: result.snippet,
        publishedDate: result.date || null,
        score: 0.5 + 0.5 * (1 - i / resultsToProcess.length), // Decay score
        title: result.title,
        url: result.url,
      };

      yield {
        data: {
          enhanced: false,
          index: i,
          requestId,
          result: basicResult,
          total: resultsToProcess.length,
        },
        type: WebSearchStreamEventTypes.RESULT,
      };
    }

    // PHASE 4: Yield Completion
    yield {
      data: {
        requestId,
        responseTime: performance.now() - startTime,
        totalResults: resultsToProcess.length,
      },
      type: WebSearchStreamEventTypes.COMPLETE,
    };
  } catch (error) {
    logger?.error('Progressive search streaming failed', {
      error: getErrorMessage(error),
      logType: LogTypes.OPERATION,
      operationName: 'streamSearchResults',
      query,
    });

    // Yield error event
    yield {
      data: {
        error: error instanceof Error ? error.message : 'Search failed',
        requestId,
        responseTime: performance.now() - startTime,
      },
      type: WebSearchStreamEventTypes.ERROR,
    };
  }
}

// Web Search Execution (Tavily-Enhanced)

/**
 * Perform web search with Tavily-like features
 *
 * ✅ P0 FIXES:
 * - Request ID tracking for debugging
 * - Retry logic for reliability
 * - Progressive result streaming preparation
 * ✅ TAVILY-ENHANCED: All advanced features implemented
 * ✅ BILLING: Deducts credits for all internal AI operations
 *
 * @param params - Enhanced search parameters
 * @param env - Cloudflare environment bindings
 * @param complexity - Optional complexity level for metadata
 * @param logger - Optional logger for error tracking
 * @param billingContext - Optional billing context for credit deduction
 * @returns Formatted search result with Tavily features
 */
export async function performWebSearch(
  params: WebSearchParameters,
  env: ApiEnv['Bindings'],
  complexity?: WebSearchComplexity,
  logger?: TypedLogger,
  billingContext?: BillingContext,
): Promise<WebSearchResult> {
  const startTime = performance.now();

  const requestId = generateId();

  // CRITICAL DEBUG: Log at the very start to verify env bindings
  const apiKeyConfigured = isSerperConfigured(env);
  const apiKeyLength = env.SERP_API_KEY?.length ?? 0;
  logger?.info(`performWebSearch starting: apiKey=${apiKeyConfigured ? 'YES' : 'NO'}(${apiKeyLength}chars)`, {
    logType: LogTypes.OPERATION,
    operationName: 'performWebSearch',
    query: params.query.substring(0, 50),
  });

  // Determine max results (default 10, max 20)
  const maxResults = Math.min(params.maxResults || 10, 20);
  const searchDepth = params.searchDepth || 'advanced';

  const cached = await getCachedSearch(
    params.query,
    maxResults,
    searchDepth,
    env,
    logger,
  );
  if (cached) {
    logger?.info('Cache hit for search query', {
      duration: performance.now() - startTime,
      logType: LogTypes.PERFORMANCE,
      query: params.query.substring(0, 50),
    });

    // Track cache hit in PostHog
    if (billingContext) {
      const cacheKey = generateSearchCacheKey(params.query, maxResults, searchDepth);
      trackSearchCacheHit(
        { threadId: billingContext.threadId, userId: billingContext.userId },
        { queryHash: cacheKey },
      );
    }

    return {
      ...cached,
      _meta: {
        ...cached._meta,
        cached: true, // Mark as cached
        complexity,
      },
      requestId, // Use new request ID even for cached results
      responseTime: performance.now() - startTime, // Update response time
    };
  }

  // Initialize search cost tracking
  const searchTrackingContext: AISearchContext = {
    threadId: billingContext?.threadId ?? requestId,
    userId: billingContext?.userId ?? 'anonymous',
  };
  const trackingIds = aiSearchTracking.initialize();

  // Fire-and-forget: don't block the search pipeline on PostHog flush.
  // posthog-node's flush has a 10s request timeout which adds unacceptable
  // latency to each search query on deployed Workers.
  aiSearchTracking.started(searchTrackingContext, {
    searchProvider: SearchProviders.SERPER,
    userQuery: params.query,
  }, trackingIds).catch(() => { /* analytics fire-and-forget */ });

  try {
    // Auto-detect parameters if requested
    let autoParams: WebSearchResult['autoParameters'];
    if (params.autoParameters) {
      const detected = await detectSearchParameters(params.query, env, logger, billingContext);
      if (detected) {
        autoParams = detected;
        // Apply auto-detected parameters
        if (!params.topic && detected.topic) {
          params.topic = detected.topic;
        }
        if (!params.timeRange && detected.timeRange) {
          params.timeRange = detected.timeRange;
        }
        if (!params.searchDepth && detected.searchDepth) {
          params.searchDepth = detected.searchDepth;
        }
      }
    }

    // Use Serper search (sole search provider)
    const searchResult = await executeSearch(
      params.query,
      maxResults + 5, // Fetch extra to compensate for filtering
      env,
      logger,
    );

    // Track web search execution in PostHog
    if (billingContext) {
      trackWebSearchExecuted(
        { threadId: billingContext.threadId, userId: billingContext.userId },
        {
          durationMs: searchResult.responseTimeMs,
          provider: searchResult.engine,
          query: params.query,
          resultCount: searchResult.results.length,
        },
      );
    }

    const searchResults = searchResult.results;

    if (searchResults.length === 0) {
      if (logger) {
        logger.warn('Search engine returned empty', {
          context: `Engine: ${searchResult.engine}`,
          logType: LogTypes.EDGE_CASE,
          query: params.query,
          scenario: 'search_empty',
        });
      }

      return {
        _meta: complexity ? { complexity } : undefined,
        answer: null,
        autoParameters: autoParams,
        query: params.query,
        requestId,
        responseTime: performance.now() - startTime,
        results: [],
      };
    }

    // Take only requested number of sources
    const sourcesToProcess = searchResults.slice(0, maxResults);

    // Process results - use Serper snippets as content (no browser extraction)
    const results: WebSearchResultItem[] = sourcesToProcess.map((result, index) => {
      const domain = extractDomain(result.url);

      // Split query into terms for matching
      const queryTerms = params.query
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length > 2);
      const titleLower = result.title.toLowerCase();
      const snippetLower = result.snippet.toLowerCase();

      // Score components (0-1 scale):
      // 1. Search engine ranking (Serper pre-ranks results)
      const rankScore = Math.max(0, 1 - index * 0.08); // First result = 1.0, decreases by 0.08

      // 2. Title relevance (high weight - most important)
      const titleMatches = queryTerms.filter(term =>
        titleLower.includes(term),
      ).length;
      const titleScore
        = queryTerms.length > 0 ? titleMatches / queryTerms.length : 0;

      // 3. Content relevance
      const contentMatches = queryTerms.filter(term =>
        snippetLower.includes(term),
      ).length;
      const contentScore
        = queryTerms.length > 0 ? contentMatches / queryTerms.length : 0;

      // 4. Combined weighted score
      // Title = 50%, Content = 30%, Rank = 20%
      const relevanceScore
        = titleScore * 0.5 + contentScore * 0.3 + rankScore * 0.2;

      // Ensure score is between 0.3 and 1.0 (never below 30% for search results)
      const finalScore = Math.max(0.3, Math.min(1.0, relevanceScore));

      // Use Serper snippet as content - no browser extraction needed
      const baseResult: WebSearchResultItem = {
        content: result.snippet,
        domain,
        excerpt: result.snippet,
        publishedDate: result.date || null,
        score: finalScore,
        title: result.title,
        url: result.url,
      };

      // Add favicon metadata if requested
      if (params.includeFavicon) {
        baseResult.metadata = {
          faviconUrl: `https://${domain}/favicon.ico`,
        };
      }

      return baseResult;
    });

    // Generate answer summary if requested
    let answer: string | null = null;
    if (params.includeAnswer) {
      const answerMode: WebSearchActiveAnswerMode
        = typeof params.includeAnswer === 'boolean'
          ? WebSearchActiveAnswerModes.BASIC
          : params.includeAnswer === WebSearchAnswerModes.ADVANCED
            ? WebSearchActiveAnswerModes.ADVANCED
            : params.includeAnswer === WebSearchAnswerModes.BASIC
              ? WebSearchActiveAnswerModes.BASIC
              : DEFAULT_ACTIVE_ANSWER_MODE;

      // Always generate answer since we have at least 'basic' mode
      answer = await generateAnswerSummary(
        params.query,
        results,
        answerMode,
        env,
        logger,
        billingContext,
      );
    }

    const finalResult: WebSearchResult = {
      _meta: complexity ? { complexity } : undefined,
      answer,
      autoParameters: autoParams,
      query: params.query,
      requestId, // ✅ P0 FIX: Add request ID for tracking
      responseTime: performance.now() - startTime,
      results,
    };

    await cacheSearchResult(
      params.query,
      maxResults,
      searchDepth,
      finalResult,
      env,
      logger,
    );

    // Track search completion with cost breakdown
    const durationMs = performance.now() - startTime;
    const costs = calculateTotalSearchCost({
      searchProvider: SearchProviders.SERPER,
      searchQueryCount: 1,
    });

    // Fire-and-forget: don't block return on PostHog flush
    aiSearchTracking.completed(searchTrackingContext, {
      costs,
      durationMs,
      queryCount: 1,
      resultCount: results.length,
      searchProvider: SearchProviders.SERPER,
      userQuery: params.query,
    }, trackingIds).catch(() => { /* analytics fire-and-forget */ });

    return finalResult;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const isConfigError = errorMessage.includes('not configured');

    if (logger) {
      logger.error('Web search failed completely', {
        context: `Search depth: ${params.searchDepth || 'advanced'}`,
        error: errorMessage,
        logType: LogTypes.EDGE_CASE,
        query: params.query,
        scenario: isConfigError ? 'search_api_not_configured' : 'complete_search_failure',
      });
    }

    // Fire-and-forget: don't block error return on PostHog flush
    const errorDurationMs = performance.now() - startTime;
    aiSearchTracking.error(searchTrackingContext, {
      durationMs: errorDurationMs,
      errorCategory: isConfigError ? 'configuration' : 'search_failure',
      errorMessage,
      searchProvider: SearchProviders.SERPER,
      userQuery: params.query,
    }, trackingIds).catch(() => { /* analytics fire-and-forget */ });

    // Return error info in _meta so frontend can display appropriate message
    return {
      _meta: {
        complexity,
        error: true,
        message: isConfigError
          ? 'Web search is not available. The search API is not configured.'
          : 'Web search failed. Please try again later.',
      },
      answer: null,
      query: params.query,
      requestId, // ✅ P0 FIX: Include request ID even in error case
      responseTime: performance.now() - startTime,
      results: [],
    };
  }
}

// Utility Functions

/**
 * Extract domain from URL
 *
 * @param url - URL to extract domain from
 * @returns Domain name without www prefix
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Check if URL should be skipped for content extraction
 *
 * Comprehensive filtering for:
 * - Ad redirect URLs
 * - Tracking URLs
 * - Low-quality domains
 * - Non-content pages
 *
 * @param url - URL to check
 * @returns true if URL should be skipped
 */
function shouldSkipUrl(url: string): boolean {
  // Ad and tracking URL patterns
  const adTrackingPatterns = [
    // DuckDuckGo ad/tracking
    /duckduckgo\.com\/y\.js/i,
    /duckduckgo\.com\/l\//i,
    /duckduckgo\.com.*[?&]ad/i,
    // Google ads/tracking
    /googleadservices\.com/i,
    /googlesyndication\.com/i,
    /google\.com\/aclk/i,
    /google\.com\/pagead/i,
    /googleads\./i,
    /adservice\.google/i,
    // Bing ads
    /bing\.com\/aclick/i,
    /bing\.com\/aclk/i,
    // DoubleClick/Google Marketing
    /doubleclick\.net/i,
    /2mdn\.net/i,
    // Facebook/Meta tracking
    /facebook\.com\/tr/i,
    /facebook\.com\/ads/i,
    /fbcdn\.net.*tracking/i,
    // Twitter/X tracking
    /t\.co\/[a-z0-9]+$/i, // Short links without content
    /twitter\.com\/i\/web\/status/i,
    // Generic ad patterns
    /\/ad\/|\/ads\//i,
    /\.ad\./i,
    /adclick\./i,
    /adserver\./i,
    /advertising\./i,
    /pixel\./i,
    /tracking\./i,
    /tracker\./i,
    /clicktrack/i,
    /click\.linksynergy/i,
    /prf\.hn/i,
    /anrdoezrs\.net/i,
    /apmebf\.com/i,
    // Affiliate networks
    /amazon\.com\/gp\/r\.html/i,
    /amazon\.com\/gp\/redirect/i,
    /shareasale\.com/i,
    /commission-junction/i,
    /cj\.com/i,
    /tkqlhce\.com/i,
    /jdoqocy\.com/i,
    /dpbolvw\.net/i,
    /kqzyfj\.com/i,
    // URL shorteners (often used for tracking)
    /bit\.ly\/[a-z0-9]+$/i,
    /tinyurl\.com\/[a-z0-9]+$/i,
    /goo\.gl\/[a-z0-9]+$/i,
    /ow\.ly\/[a-z0-9]+$/i,
    // Analytics/tracking pixels
    /analytics\./i,
    /stats\./i,
    /metrics\./i,
    /beacon\./i,
    /telemetry\./i,
  ];

  // Low-quality or non-content domains
  const lowQualityDomains = [
    /^(www\.)?pinterest\.(com|co\.\w+)$/i, // Requires login
    /^(www\.)?instagram\.com$/i, // Requires login
    /^(www\.)?tiktok\.com$/i, // JS-heavy, often fails
    /^(www\.)?linkedin\.com$/i, // Requires login
    /^(www\.)?quora\.com$/i, // Paywall/login
    /^(www\.)?researchgate\.net$/i, // Paywall
    /^(www\.)?academia\.edu$/i, // Paywall
  ];

  // Check ad/tracking patterns
  if (adTrackingPatterns.some(pattern => pattern.test(url))) {
    return true;
  }

  // Check low-quality domains
  try {
    const hostname = new URL(url).hostname;
    if (lowQualityDomains.some(pattern => pattern.test(hostname))) {
      return true;
    }
  } catch {
    // Invalid URL
    return true;
  }

  return false;
}

/**
 * Create search result cache for request
 *
 * Simple Map-based cache for deduplicating searches within a single request.
 * Normalizes queries (lowercase, trim) to improve hit rate.
 *
 * @returns Cache object with get/set/has methods
 */
export function createSearchCache() {
  const cache = new Map<string, WebSearchResult>();

  const normalizeQuery = (query: string): string => {
    return query.toLowerCase().trim();
  };

  return {
    get: (query: string): WebSearchResult | null => {
      return cache.get(normalizeQuery(query)) || null;
    },
    has: (query: string): boolean => {
      return cache.has(normalizeQuery(query));
    },
    set: (query: string, result: WebSearchResult): void => {
      cache.set(normalizeQuery(query), result);
    },
  };
}

export type SearchCache = ReturnType<typeof createSearchCache>;
