/**
 * Content Extraction Service - Jina Reader API
 *
 * Uses Jina Reader API (https://r.jina.ai/) to extract clean markdown content
 * from URLs. This enhances web search results by fetching actual page content
 * instead of just snippets.
 *
 * The Jina Reader API is free and requires no API key.
 * Simply fetch: https://r.jina.ai/{url} to get markdown content.
 */

import { LogTypes } from '@debatekit/shared/enums';
import { z } from 'zod';

import type { TypedLogger } from '@/types/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default configuration for content extraction
 */
const DEFAULTS = {
  /** Maximum concurrent URL extractions to avoid rate limiting */
  maxConcurrent: 3,
  /** Maximum content length to return (chars) - keeps LLM context manageable */
  maxLength: 4000,
  /** Request timeout in milliseconds */
  timeout: 10000,
} as const;

/**
 * Jina Reader API base URL
 */
const JINA_READER_BASE_URL = 'https://r.jina.ai';

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

/**
 * Schema for content extraction options
 */
export const ExtractionOptionsSchema = z.object({
  /** Maximum content length to return in characters (default: 4000) */
  maxLength: z.number().int().positive().optional(),
  /** Request timeout in milliseconds (default: 10000) */
  timeout: z.number().int().positive().optional(),
});

/**
 * Options for content extraction
 */
export type ExtractionOptions = z.infer<typeof ExtractionOptionsSchema>;

/**
 * Schema for batch extraction options - extends ExtractionOptionsSchema
 */
export const BatchExtractionOptionsSchema = ExtractionOptionsSchema.extend({
  /** Maximum concurrent requests (default: 3) */
  maxConcurrent: z.number().int().positive().optional(),
});

/**
 * Options for batch extraction
 */
export type BatchExtractionOptions = z.infer<typeof BatchExtractionOptionsSchema>;

/**
 * Schema for extraction result
 */
export const ExtractionResultSchema = z.object({
  /** Extracted markdown content (empty string on failure) */
  content: z.string(),
  /** Error message if extraction failed */
  error: z.string().optional(),
  /** Whether the extraction was successful */
  success: z.boolean(),
});

/**
 * Result of a content extraction attempt
 */
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ============================================================================
// SINGLE URL EXTRACTION
// ============================================================================

/**
 * Extract clean markdown content from a single URL using Jina Reader API
 *
 * The Jina Reader API converts any web page to clean, readable markdown.
 * It's free to use and requires no API key.
 *
 * @param url - The URL to extract content from
 * @param options - Optional extraction configuration
 * @param logger - Optional TypedLogger for structured logging
 * @returns Extraction result with content, success status, and optional error
 *
 * @example
 * ```typescript
 * const result = await extractUrlContent('https://example.com/article');
 * if (result.success) {
 *   console.log('Content:', result.content);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */
export async function extractUrlContent(
  url: string,
  options?: ExtractionOptions,
  logger?: TypedLogger,
): Promise<ExtractionResult> {
  const timeout = options?.timeout ?? DEFAULTS.timeout;
  const maxLength = options?.maxLength ?? DEFAULTS.maxLength;

  logger?.info('Starting content extraction', {
    logType: LogTypes.OPERATION,
    operationName: 'extractUrlContent',
    query: url.slice(0, 100),
  });

  // Validate URL
  if (!isValidUrl(url)) {
    const errorMsg = `Invalid URL: ${url.slice(0, 100)}`;
    logger?.warn('Invalid URL for content extraction', {
      logType: LogTypes.EDGE_CASE,
      query: url.slice(0, 100),
      scenario: 'invalid_url',
    });

    return {
      content: '',
      error: errorMsg,
      success: false,
    };
  }

  // Build Jina Reader URL
  const jinaUrl = `${JINA_READER_BASE_URL}/${url}`;

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'DebateKit/1.0 (Content Extraction)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      logger?.warn('Content extraction HTTP error', {
        context: errorMsg,
        logType: LogTypes.EDGE_CASE,
        query: url.slice(0, 100),
        scenario: 'content_extraction_http_error',
      });

      return {
        content: '',
        error: errorMsg,
        success: false,
      };
    }

    // Read and truncate content
    const rawContent = await response.text();
    const content = truncateContent(rawContent, maxLength);

    logger?.info('Content extraction successful', {
      logType: LogTypes.OPERATION,
      operationName: 'extractUrlContent',
      query: url.slice(0, 100),
      resultCount: 1,
      textLength: content.length,
    });

    return {
      content,
      success: true,
    };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    const isTimeout = error instanceof Error && error.name === 'AbortError';

    logger?.error('Content extraction failed', {
      error: errorMsg,
      logType: LogTypes.OPERATION,
      operationName: 'extractUrlContent',
      query: url.slice(0, 100),
    });

    return {
      content: '',
      error: isTimeout ? `Request timeout after ${timeout}ms` : errorMsg,
      success: false,
    };
  }
}

// ============================================================================
// BATCH URL EXTRACTION
// ============================================================================

/**
 * Extract content from multiple URLs in parallel with rate limiting
 *
 * Uses a semaphore pattern to limit concurrent requests and avoid
 * overwhelming the Jina Reader API.
 *
 * @param urls - Array of URLs to extract content from
 * @param options - Optional batch extraction configuration
 * @param logger - Optional TypedLogger for structured logging
 * @returns Map of URL to extraction result
 *
 * @example
 * ```typescript
 * const urls = ['https://example.com/a', 'https://example.com/b'];
 * const results = await extractMultipleUrls(urls);
 *
 * for (const [url, result] of results) {
 *   if (result.success) {
 *     console.log(`${url}: ${result.content.slice(0, 100)}...`);
 *   }
 * }
 * ```
 */
export async function extractMultipleUrls(
  urls: string[],
  options?: BatchExtractionOptions,
  logger?: TypedLogger,
): Promise<Map<string, ExtractionResult>> {
  const maxConcurrent = options?.maxConcurrent ?? DEFAULTS.maxConcurrent;
  const timeout = options?.timeout ?? DEFAULTS.timeout;
  const maxLength = options?.maxLength ?? DEFAULTS.maxLength;

  // Deduplicate and filter valid URLs
  const uniqueUrls = [...new Set(urls)].filter(isValidUrl);

  logger?.info('Starting batch content extraction', {
    count: uniqueUrls.length,
    logType: LogTypes.OPERATION,
    operationName: 'extractMultipleUrls',
  });

  if (uniqueUrls.length === 0) {
    return new Map();
  }

  // Create semaphore for rate limiting
  const results = new Map<string, ExtractionResult>();
  let activeCount = 0;
  const queue: Array<() => Promise<void>> = [];

  /**
   * Process next item in queue if under concurrency limit
   */
  const processQueue = (): void => {
    while (activeCount < maxConcurrent && queue.length > 0) {
      const task = queue.shift();
      if (task) {
        activeCount++;
        task()
          .catch(() => {
            // Error handling is done inside the task itself
          })
          .finally(() => {
            activeCount--;
            processQueue();
          });
      }
    }
  };

  /**
   * Create extraction task for a URL
   */
  const createTask = (url: string): Promise<void> => {
    return new Promise((resolve) => {
      const task = async (): Promise<void> => {
        const result = await extractUrlContent(
          url,
          { maxLength, timeout },
          logger,
        );
        results.set(url, result);
        resolve();
      };
      queue.push(task);
      processQueue();
    });
  };

  // Create tasks for all URLs and wait for completion
  await Promise.all(uniqueUrls.map(url => createTask(url)));

  const successCount = [...results.values()].filter(r => r.success).length;

  logger?.info('Batch content extraction complete', {
    failureCount: results.size - successCount,
    logType: LogTypes.OPERATION,
    operationName: 'extractMultipleUrls',
    successCount,
    totalResults: results.size,
  });

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Truncate content to a maximum length while preserving word boundaries
 *
 * Attempts to break at the last sentence ending (. ? !) before the limit,
 * or at the last word boundary if no sentence ending is found.
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Look for a sentence ending within the last 200 chars of the limit
  const searchStart = Math.max(0, maxLength - 200);
  const searchEnd = maxLength;
  const searchArea = content.slice(searchStart, searchEnd);

  // Find last sentence ending
  const sentenceEndMatch = searchArea.match(/[.!?]\s+[A-Z]/g);
  if (sentenceEndMatch && sentenceEndMatch.length > 0) {
    const lastMatch = sentenceEndMatch[sentenceEndMatch.length - 1];
    if (lastMatch) {
      const lastEndIndex = searchArea.lastIndexOf(lastMatch);
      if (lastEndIndex !== -1) {
        return `${content.slice(0, searchStart + lastEndIndex + 1).trim()}...`;
      }
    }
  }

  // Fall back to word boundary
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return `${truncated.slice(0, lastSpace).trim()}...`;
  }

  return `${truncated.trim()}...`;
}

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
