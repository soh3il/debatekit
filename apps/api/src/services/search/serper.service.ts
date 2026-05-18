/**
 * Serper Search Service - Google Search via Serper.dev API
 *
 * Uses Serper.dev's REST endpoint with native fetch (Workers-compatible).
 * Provides organic results, knowledge graph, and related searches.
 *
 * @see https://serper.dev/
 */

import { LogTypes } from '@debatekit/shared/enums';
import { z } from 'zod';

import type { ApiEnv } from '@/types';
import type { TypedLogger } from '@/types/logger';

// ============================================================================
// SCHEMAS (from Serper.dev response)
// ============================================================================

/** Serper organic search result schema */
const SerperOrganicResultSchema = z.object({
  date: z.string().optional(),
  link: z.string(),
  position: z.number(),
  sitelinks: z.array(z.object({ link: z.string(), title: z.string() })).optional(),
  snippet: z.string(),
  title: z.string(),
});

/** Serper knowledge graph schema (internal) */
const SerperKnowledgeGraphInternalSchema = z.object({
  attributes: z.record(z.string(), z.string()).optional(),
  description: z.string().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  website: z.string().optional(),
});

/** Serper People Also Ask schema */
const SerperPeopleAlsoAskSchema = z.object({
  link: z.string(),
  question: z.string(),
  snippet: z.string(),
  title: z.string(),
});

/** Serper related search schema */
const SerperRelatedSearchSchema = z.object({
  query: z.string(),
});

/** Serper API response schema */
const SerperApiResponseSchema = z.object({
  answerBox: z.object({
    answer: z.string().optional(),
    snippet: z.string().optional(),
    title: z.string().optional(),
  }).optional(),
  credits: z.number().optional(),
  knowledgeGraph: SerperKnowledgeGraphInternalSchema.optional(),
  organic: z.array(SerperOrganicResultSchema).optional(),
  peopleAlsoAsk: z.array(SerperPeopleAlsoAskSchema).optional(),
  relatedSearches: z.array(SerperRelatedSearchSchema).optional(),
  searchParameters: z.object({
    engine: z.string(),
    num: z.number().optional(),
    q: z.string(),
    type: z.string(),
  }),
});

// ============================================================================
// EXPORTED TYPES
// ============================================================================

/**
 * Normalized search result for internal use
 */
export type SerperSearchResult = {
  title: string;
  url: string;
  snippet: string;
  position: number;
  date?: string;
};

/**
 * Knowledge graph data
 */
export type SerperKnowledgeGraph = {
  title?: string;
  type?: string;
  website?: string;
  description?: string;
};

/**
 * Search response with metadata
 */
export type SerperSearchOutput = {
  results: SerperSearchResult[];
  knowledgeGraph?: SerperKnowledgeGraph;
  relatedSearches?: string[];
  relatedQuestions?: Array<{ question: string; snippet?: string }>;
  answerBox?: { title?: string; answer?: string; snippet?: string };
  responseTimeMs: number;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const SERPER_API_URL = 'https://google.serper.dev/search';
const DEFAULT_NUM_RESULTS = 10;
const MAX_RESULTS = 100;
const REQUEST_TIMEOUT_MS = 15000;

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Check if Serper API is configured
 * Returns false if key is missing, empty, or matches example placeholder values
 */
export function isSerperConfigured(env: ApiEnv['Bindings']): boolean {
  const key = env.SERP_API_KEY;
  if (!key) {
    return false;
  }
  // Check for all known placeholder values from .dev.vars.example
  const placeholders = [
    'your-serper-api-key-here',
    'your-serper-api-key-from-serper-dev',
  ];
  return !placeholders.includes(key);
}

/**
 * Perform a Google search via Serper.dev API
 *
 * Uses native fetch for Cloudflare Workers compatibility.
 *
 * @param query - Search query string
 * @param env - Cloudflare environment bindings
 * @param options - Optional search configuration
 * @param options.numResults - Number of results to return
 * @param options.country - Country code for localized results
 * @param options.language - Language code for results
 * @param logger - Optional TypedLogger for structured logging
 */
export async function searchWithSerper(
  query: string,
  env: ApiEnv['Bindings'],
  options?: {
    numResults?: number;
    country?: string;
    language?: string;
  },
  logger?: TypedLogger,
): Promise<SerperSearchOutput> {
  const startTime = performance.now();

  const isConfigured = isSerperConfigured(env);
  logger?.info('Serper API configuration check', {
    logType: LogTypes.OPERATION,
    operationName: 'searchWithSerper',
    status: isConfigured ? 'configured' : 'not_configured',
  });

  if (!isConfigured) {
    logger?.warn('Serper API key not configured', {
      logType: LogTypes.EDGE_CASE,
      scenario: 'serper_api_not_configured',
    });
    throw new Error('Serper API key not configured');
  }

  const numResults = Math.min(options?.numResults || DEFAULT_NUM_RESULTS, MAX_RESULTS);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SERPER_API_URL, {
      body: JSON.stringify({
        autocorrect: true,
        gl: options?.country || 'us',
        hl: options?.language || 'en',
        num: numResults,
        q: query,
      }),
      headers: {
        'Accept-Encoding': 'identity',
        'Content-Type': 'application/json',
        'X-API-KEY': env.SERP_API_KEY,
      },
      method: 'POST',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    logger?.info('Serper API response received', {
      logType: LogTypes.OPERATION,
      operationName: 'searchWithSerper',
      status: response.ok ? 'success' : 'error',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger?.error('Serper HTTP error', {
        error: `${response.status} - ${errorText.slice(0, 200)}`,
        logType: LogTypes.EDGE_CASE,
        scenario: 'serper_http_error',
      });
      throw new Error(`Serper HTTP error: ${response.status} - ${errorText}`);
    }

    const parseResult = SerperApiResponseSchema.safeParse(await response.json());
    if (!parseResult.success) {
      logger?.error('Serper response validation failed', {
        error: parseResult.error.message.slice(0, 200),
        logType: LogTypes.EDGE_CASE,
        scenario: 'serper_invalid_response',
      });
      throw new Error(`Serper response validation failed: ${parseResult.error.message}`);
    }
    const data = parseResult.data;
    const responseTimeMs = performance.now() - startTime;

    if (!data.organic || data.organic.length === 0) {
      logger?.warn('Serper returned empty organic results', {
        context: `Raw data keys: ${Object.keys(data).join(', ')}`,
        logType: LogTypes.EDGE_CASE,
        query: query.substring(0, 50),
        scenario: 'serper_empty_organic_results',
      });
    }

    // Normalize organic results
    const results: SerperSearchResult[] = (data.organic || []).map((r) => {
      const result: SerperSearchResult = {
        position: r.position,
        snippet: r.snippet || '',
        title: r.title || '',
        url: r.link || '',
      };
      if (r.date) {
        result.date = r.date;
      }
      return result;
    });

    // Build output
    const output: SerperSearchOutput = {
      responseTimeMs,
      results,
    };

    // Add knowledge graph if present
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      output.knowledgeGraph = {
        description: kg.description,
        title: kg.title,
        type: kg.type,
        website: kg.website,
      };
    }

    // Add related searches if present
    if (data.relatedSearches && data.relatedSearches.length > 0) {
      output.relatedSearches = data.relatedSearches.map(r => r.query);
    }

    // Add related questions (People Also Ask) if present
    if (data.peopleAlsoAsk && data.peopleAlsoAsk.length > 0) {
      output.relatedQuestions = data.peopleAlsoAsk.map(r => ({
        question: r.question,
        snippet: r.snippet,
      }));
    }

    // Add answer box if present
    if (data.answerBox) {
      output.answerBox = {
        answer: data.answerBox.answer,
        snippet: data.answerBox.snippet,
        title: data.answerBox.title,
      };
    }

    logger?.info('Serper search completed', {
      duration: responseTimeMs,
      logType: LogTypes.PERFORMANCE,
      query: query.substring(0, 50),
      resultCount: results.length,
    });

    return output;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger?.error('Serper request timeout', {
        error: `Timeout after ${REQUEST_TIMEOUT_MS}ms`,
        logType: LogTypes.EDGE_CASE,
        query: query.substring(0, 50),
        scenario: 'serper_timeout',
      });
      throw new Error(`Serper timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }

    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    const errStack = error instanceof Error ? error.stack : 'No stack trace';
    logger?.error('Serper search failed', {
      error: errMsg,
      errorStack: errStack ?? undefined,
      logType: LogTypes.OPERATION,
      operationName: 'searchWithSerper',
      query: query.substring(0, 50),
    });
    throw error;
  }
}

/**
 * Search with automatic retry on failure
 *
 * @param query - Search query string
 * @param env - Cloudflare environment bindings
 * @param options - Optional search configuration including retry settings
 * @param options.numResults - Number of results to return
 * @param options.country - Country code for localized results
 * @param options.language - Language code for results
 * @param options.maxRetries - Maximum number of retry attempts
 * @param options.retryDelayMs - Delay between retries in milliseconds
 * @param logger - Optional TypedLogger for structured logging
 */
export async function searchWithSerperRetry(
  query: string,
  env: ApiEnv['Bindings'],
  options?: {
    numResults?: number;
    country?: string;
    language?: string;
    maxRetries?: number;
    retryDelayMs?: number;
  },
  logger?: TypedLogger,
): Promise<SerperSearchOutput> {
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 500;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await searchWithSerper(query, env, options, logger);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        logger?.warn('Serper search retry', {
          context: `Attempt ${attempt + 1}/${maxRetries}, delay ${retryDelayMs}ms`,
          error: lastError.message,
          logType: LogTypes.EDGE_CASE,
          query: query.substring(0, 50),
          scenario: 'serper_retry',
        });
        await new Promise<void>((resolve) => {
          setTimeout(resolve, retryDelayMs);
        });
      }
    }
  }

  logger?.error('Serper search failed after all retries', {
    error: lastError?.message ?? 'Unknown error',
    logType: LogTypes.OPERATION,
    operationName: 'searchWithSerperRetry',
    query: query.substring(0, 50),
    retryCount: maxRetries,
  });

  throw lastError || new Error('Serper search failed after retries');
}
