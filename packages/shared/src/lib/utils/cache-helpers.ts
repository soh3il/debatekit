/**
 * React Query Cache Manipulation Helpers
 *
 * Consolidates repetitive cache update patterns.
 * Single source of truth for cache operations.
 */

/**
 * Standard cache metadata for prefetch operations
 *
 * @param requestId - Optional request ID (default: 'prefetch')
 * @returns Cache meta object with timestamp and version
 */
export function createPrefetchMeta(requestId = 'prefetch') {
  return {
    requestId,
    timestamp: new Date().toISOString(),
    version: 'v1',
  } as const;
}

/**
 * Creates empty cache response with meta for prefetch operations
 */
export function createEmptyListCache() {
  return {
    data: { items: [] },
    meta: createPrefetchMeta(),
    success: true,
  } as const;
}
