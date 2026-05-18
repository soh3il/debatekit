/**
 * Engagement Tracker Component
 *
 * Provides automatic engagement tracking for the app:
 * - Session start detection
 * - Return user vs new user tracking
 * - Registers engagement super properties
 *
 * Location: /src/components/providers/engagement-tracker.tsx
 */

import { usePostHog } from 'posthog-js/react';
import { useEffect, useRef } from 'react';

import { useSession } from '@/lib/auth/client';

// Storage keys
const FIRST_VISIT_KEY = 'debatekit_first_visit';
const LAST_VISIT_KEY = 'debatekit_last_visit';
const VISIT_COUNT_KEY = 'debatekit_visit_count';

/**
 * Engagement Tracker Component
 *
 * Place this inside PostHogProvider to track engagement metrics.
 * Tracks session starts, return visits, and user engagement patterns.
 */
export function EngagementTracker() {
  const posthog = usePostHog();
  const { data: session } = useSession();
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!posthog || hasTrackedRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    hasTrackedRef.current = true;

    const now = Date.now();
    let isFirstVisit = false;
    let isReturnVisit = false;
    let visitCount = 1;
    let daysSinceLastVisit: number | undefined;

    try {
      const firstVisit = localStorage.getItem(FIRST_VISIT_KEY);
      const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
      const storedCount = localStorage.getItem(VISIT_COUNT_KEY);

      if (!firstVisit) {
        // First time visitor
        isFirstVisit = true;
        localStorage.setItem(FIRST_VISIT_KEY, String(now));
      }

      if (lastVisit) {
        const lastVisitTime = Number.parseInt(lastVisit, 10);
        const timeSinceLastVisit = now - lastVisitTime;

        // Consider it a return visit if more than 30 minutes since last visit
        if (timeSinceLastVisit > 30 * 60 * 1000) {
          isReturnVisit = true;
          daysSinceLastVisit = Math.floor(timeSinceLastVisit / (24 * 60 * 60 * 1000));
        }
      }

      if (storedCount) {
        visitCount = Number.parseInt(storedCount, 10) + 1;
      }

      // Update storage
      localStorage.setItem(LAST_VISIT_KEY, String(now));
      localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));
    } catch {
      // localStorage not available
    }

    // Register engagement super properties for all events
    posthog.register({
      is_first_visit: isFirstVisit,
      is_return_visit: isReturnVisit,
      visit_count: visitCount,
      ...(daysSinceLastVisit !== undefined && { days_since_last_visit: daysSinceLastVisit }),
    });

    // Set user properties if authenticated
    if (session?.user) {
      posthog.setPersonProperties({
        last_visit_at: new Date().toISOString(),
        total_visits: visitCount,
        ...(isFirstVisit && { first_visit_at: new Date().toISOString() }),
      });
    }

    // Track session start for return visitors
    if (isReturnVisit) {
      posthog.capture('session_started', {
        days_since_last_visit: daysSinceLastVisit,
        entry_page: window.location.pathname,
        is_return_visit: true,
        timestamp: new Date().toISOString(),
        visit_count: visitCount,
      });
    } else if (isFirstVisit) {
      posthog.capture('session_started', {
        entry_page: window.location.pathname,
        is_first_visit: true,
        referrer: document.referrer || undefined,
        timestamp: new Date().toISOString(),
        visit_count: 1,
      });
    }
  }, [posthog, session]);

  return null;
}
