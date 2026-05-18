/**
 * Stream Utilities - Consolidated helpers for streaming services
 *
 * Centralizes duplicate patterns across streaming buffer services:
 * - parseChunkArray<T>(): Generic chunk parsing with Zod validation
 * - logStreamError(): Standardized error logging helper
 * - StreamKeyBuilder: Centralized key generation for all storage backends
 *
 * @module api/services/streaming/stream-utils
 */

import type { ZodSchema } from 'zod';

import { getErrorMessage } from '@/common/error-types';
import type { TypedLogger } from '@/types/logger';
import { LogHelpers } from '@/types/logger';

// Re-export for consumers that import getErrorMessage from stream-utils
export { getErrorMessage };

// ============================================================================
// CHUNK PARSING
// ============================================================================

/**
 * Parse an array of raw JSON strings into validated typed chunks.
 *
 * Generic helper that eliminates duplicate chunk parsing loops across services.
 * Silently skips invalid chunks (logs at debug level if logger provided).
 *
 * @param rawChunks - Array of raw JSON strings from Redis/KV
 * @param schema - Zod schema for validation
 * @param logger - Optional logger for debug output
 * @returns Array of validated chunks
 *
 * @example
 * const chunks = parseChunkArray(rawChunks, UnifiedStreamChunkSchema, logger);
 */
export function parseChunkArray<T>(
  rawChunks: (string | null)[],
  schema: ZodSchema<T>,
  logger?: TypedLogger,
): T[] {
  const chunks: T[] = [];

  for (const raw of rawChunks) {
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      const result = schema.safeParse(parsed);
      if (result.success) {
        chunks.push(result.data);
      } else {
        logger?.debug('Skipped invalid chunk during parsing', LogHelpers.operation({
          error: result.error.message,
          operationName: 'parseChunkArray',
        }));
      }
    } catch {
      // Skip unparseable JSON
    }
  }

  return chunks;
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

/**
 * Log a stream operation error with standardized context.
 *
 * Combines error extraction and LogHelpers.operation() in one call.
 *
 * @param logger - TypedLogger instance
 * @param level - Log level ('warn' | 'error')
 * @param message - Log message
 * @param operationName - Operation name for context
 * @param error - Unknown error value
 * @param extra - Additional context fields
 *
 * @example
 * logStreamError(logger, 'error', 'Failed to append chunk', 'appendChunk', error, { threadId });
 */
export function logStreamError(
  logger: TypedLogger | undefined,
  level: 'warn' | 'error',
  message: string,
  operationName: string,
  error: unknown,
  extra?: Record<string, string | number | boolean | undefined>,
): void {
  if (!logger) {
    return;
  }

  const context = LogHelpers.operation({
    error: getErrorMessage(error),
    operationName,
    ...extra,
  });

  logger[level](message, context);
}

// ============================================================================
// MODEL NAME EXTRACTION
// ============================================================================

/**
 * Extract readable model name from full model ID.
 *
 * Strips provider prefix and converts kebab-case to Title Case.
 * Single source of truth - replaces duplicate helpers in:
 * - conversation-history.service.ts (extractModelName)
 * - unified-stream-orchestration.service.ts (extractReadableModelName)
 *
 * @param modelId - Full model ID (e.g., "anthropic/claude-3.5-sonnet")
 * @returns Readable model name (e.g., "Claude 3.5 Sonnet")
 */
export function extractReadableModelName(modelId: string): string {
  const shortName = modelId.split('/').pop() ?? modelId;
  return shortName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// REDIS ENV TYPE
// ============================================================================

/** Environment with Upstash Redis credentials. Single source of truth. */
export type RedisEnv = {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
};

// ============================================================================
// KEY BUILDERS
// ============================================================================

/**
 * Centralized key generation for all streaming storage backends.
 *
 * Consolidates key patterns from:
 * - unified-stream-buffer.service.ts (KV)
 * - unified-redis-stream-buffer.service.ts (Redis)
 * - redis-round-state.service.ts (Redis)
 */
export const StreamKeyBuilder = {
  // ===========================================================================
  // KV KEYS (Pre-search stream buffer)
  // ===========================================================================

  /** KV: Active pre-search stream lookup */
  kvActivePreSearch: (threadId: string, roundNumber: number, discriminator: string) =>
    `stream:active:${threadId}:r${roundNumber}:${discriminator}`,

  /** KV: Pre-search stream chunk by index */
  kvPreSearchChunk: (streamId: string, index: number) =>
    `stream:buffer:${streamId}:c:${index}`,

  /** KV: Pre-search stream metadata */
  kvPreSearchMeta: (streamId: string) =>
    `stream:buffer:${streamId}:meta`,

  // ===========================================================================
  // REDIS KEYS (Unified stream buffer)
  // ===========================================================================

  /** Redis: Unified stream chunks list */
  redisUnifiedChunks: (threadId: string, roundNumber: number) =>
    `unified:${threadId}:r${roundNumber}:chunks`,

  /** Redis: Unified stream metadata hash */
  redisUnifiedMeta: (threadId: string, roundNumber: number) =>
    `unified:${threadId}:r${roundNumber}:meta`,
} as const;
