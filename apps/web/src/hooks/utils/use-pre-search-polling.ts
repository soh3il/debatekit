/**
 * Pre-Search Polling Utility
 *
 * Simple polling hook for fetching pre-search results.
 * Used as fallback when SSE stream encounters 409 conflict.
 */

import { useCallback } from 'react';

import { getThreadPreSearchesService } from '@/services/api';

/**
 * Hook for polling pre-search results
 * Used as fallback when SSE stream encounters 409 conflict
 */
export function useGetThreadPreSearchesForPolling() {
  return useCallback(async (threadId: string) => {
    return getThreadPreSearchesService({ param: { id: threadId } });
  }, []);
}
