/**
 * PostHog Search Analytics Events
 *
 * Granular per-operation tracking for search subsystems:
 * - web_search_executed: Fired after each Serper API call
 * - rag_query_executed: Fired after each AutoRAG query
 * - search_cache_hit: Fired when a cached search result is served
 *
 * Complements the higher-level ai_search_* events in posthog-search-cost.ts.
 */

import { getPostHogClient } from './posthog-server';

// ============================================================================
// web_search_executed
// ============================================================================

/**
 * Track a successful web search execution.
 *
 * Call after Serper (or any future provider) returns results.
 */
export async function trackWebSearchExecuted(
  context: {
    userId: string;
    threadId: string;
  },
  params: {
    provider: string;
    resultCount: number;
    durationMs: number;
    query: string;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.userId,
      event: 'web_search_executed',
      properties: {
        duration_ms: params.durationMs,
        provider: params.provider,
        query: params.query.substring(0, 200),
        result_count: params.resultCount,
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail - analytics should not break the application
  }
}

// ============================================================================
// rag_query_executed
// ============================================================================

/**
 * Track a successful RAG (AutoRAG) query execution.
 *
 * Call after AutoRAG returns results and credits are deducted.
 */
export async function trackRagQueryExecuted(
  context: {
    userId: string;
    projectId: string;
  },
  params: {
    resultCount: number;
    query: string;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.userId,
      event: 'rag_query_executed',
      properties: {
        project_id: context.projectId,
        query: params.query.substring(0, 200),
        result_count: params.resultCount,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail - analytics should not break the application
  }
}

// ============================================================================
// search_cache_hit
// ============================================================================

/**
 * Track a search cache hit (result served from KV instead of Serper).
 *
 * Call when performWebSearch returns a cached result early.
 */
export async function trackSearchCacheHit(
  context: {
    userId: string;
    threadId: string;
  },
  params: {
    queryHash: string;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.userId,
      event: 'search_cache_hit',
      properties: {
        query_hash: params.queryHash,
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail - analytics should not break the application
  }
}
