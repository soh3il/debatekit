/**
 * Session Query Sync Hook
 *
 * Automatically invalidates all user-specific query cache when session changes.
 * This ensures cached data from one user doesn't leak to another user.
 *
 * Use Case:
 * - User A logs in, data is cached
 * - User A logs out, User B logs in
 * - Without this hook, User B might see stale data from User A
 *
 * Pattern: Watch userId changes, invalidate on change
 */

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { clearServiceWorkerCache, invalidateUserQueries } from '@/lib/data/cache';

import { useAuthCheck } from './use-auth-check';

/**
 * Sync query cache with session changes
 *
 * Call this once at the app root level (e.g., in _protected layout or providers).
 * Automatically invalidates all user-specific queries when userId changes.
 */
export function useSessionQuerySync(): void {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { userId } = useAuthCheck();
  const previousUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;

    // Skip if userId hasn't actually changed (includes undefined → undefined)
    if (previousUserId === userId) {
      return;
    }

    // Skip if no real session established yet (both are nullish)
    if (!previousUserId && !userId) {
      return;
    }

    // User changed - invalidate all user-specific queries
    // This handles: logout -> login as different user, impersonation, anonymous sign-in
    invalidateUserQueries(queryClient);
    // Also invalidate router loader cache so route loaders re-run with new auth
    router.invalidate();
    // Clear SW document cache so stale HTML isn't served on next navigation
    clearServiceWorkerCache();

    // Update ref for next comparison
    previousUserIdRef.current = userId;
  }, [userId, queryClient, router]);
}
