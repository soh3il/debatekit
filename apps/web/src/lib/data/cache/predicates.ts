/**
 * Query Key Predicates
 *
 * Type-safe predicates for filtering queries by key segments.
 * Used in cache updates for infinite query lists and sidebar queries.
 */

// ============================================================================
// Query Key Segments - Enum for type-safe key segment checks
// ============================================================================

/**
 * Query key segment values used in infinite query predicates
 * Use these instead of hardcoded string literals
 */
export const QueryKeySegments = {
  DETAIL: 'detail',
  LIST: 'list',
  SIDEBAR: 'sidebar',
} as const;

export type QueryKeySegment = typeof QueryKeySegments[keyof typeof QueryKeySegments];

/**
 * Predicate for checking if a query is a list or sidebar infinite query
 * Used for cache updates in flow-controller and form-actions
 */
export function isListOrSidebarQuery(query: { queryKey: readonly unknown[] }): boolean {
  if (query.queryKey.length < 2) {
    return false;
  }
  const key = query.queryKey[1];
  return key === QueryKeySegments.LIST || key === QueryKeySegments.SIDEBAR;
}

/**
 * Predicate for list/sidebar queries WITHOUT a projectId
 * Prevents new standalone threads from being added to project-specific caches
 */
export function isNonProjectListOrSidebarQuery(query: { queryKey: readonly unknown[] }): boolean {
  if (!isListOrSidebarQuery(query)) {
    return false;
  }
  // Check if query has a projectId in its params (3rd element)
  const params = query.queryKey[2];
  if (!params || typeof params !== 'object') {
    return true;
  }
  return !('projectId' in params && params.projectId);
}
