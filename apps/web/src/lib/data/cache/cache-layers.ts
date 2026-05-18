/**
 * Multi-Layer Cache Clearing
 *
 * Consolidates cache clearing across TanStack Query and service worker layers.
 * Used on auth state changes (logout, impersonation start/stop).
 */

import type { QueryClient } from '@tanstack/react-query';

import { invalidationPatterns } from './invalidation-map';

/**
 * Invalidate all user-specific query caches (TanStack Query layer)
 *
 * Following TanStack Query pattern - targeted invalidation, not clear all.
 *
 * Used on:
 * - Logout: clear current user's cached data
 * - Impersonation start: prepare for different user's data
 * - Impersonation stop: restore admin's data
 */
export function invalidateUserQueries(queryClient: QueryClient) {
  for (const queryKey of invalidationPatterns.sessionChange) {
    queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * Clear service worker document cache
 * Prevents stale HTML from being served after login/logout/impersonation
 */
export function clearServiceWorkerCache() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_AUTH_CACHE' });
}
