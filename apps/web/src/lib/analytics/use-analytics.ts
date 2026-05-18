/**
 * PostHog Analytics Hook - Type-Safe Event Tracking
 *
 * Provides a type-safe wrapper around PostHog event tracking.
 * Use this hook for all feature usage and engagement tracking.
 *
 * Location: /src/lib/analytics/use-analytics.ts
 *
 * @example
 * ```typescript
 * import { useAnalytics, AnalyticsEvents } from '@/lib/analytics';
 *
 * function MyComponent() {
 *   const { track, trackFeatureDiscovery, isReady } = useAnalytics();
 *
 *   const handleMessageSent = () => {
 *     track(AnalyticsEvents.MESSAGE_SENT, {
 *       is_new_thread: true,
 *       participant_count: 3,
 *       has_attachments: false,
 *       message_length: 150,
 *       round_number: 0,
 *     });
 *   };
 * }
 * ```
 */

import { usePostHog } from 'posthog-js/react';
import { useCallback, useRef } from 'react';
import { z } from 'zod';

import type {
  AnalyticsEventName,
  DiscoverableFeature,
} from './events';
import { AnalyticsEvents } from './events';

// ============================================================================
// POSTHOG PROPERTY TYPES (Zod-inferred)
// ============================================================================

/**
 * Zod schema for individual PostHog property values.
 * Matches the value types that posthog-js accepts in capture() properties.
 */
const PostHogPropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.undefined(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

/**
 * Zod schema for PostHog event properties.
 * Use this instead of Record<string, unknown> for all PostHog property maps.
 */
export const PostHogPropertiesSchema = z.record(z.string(), PostHogPropertyValueSchema);

/**
 * Type-safe PostHog properties inferred from Zod schema.
 * Replaces Record<string, unknown> in analytics code.
 */
export type PostHogProperties = z.infer<typeof PostHogPropertiesSchema>;

// Storage key for discovered features
const DISCOVERED_FEATURES_KEY = 'debatekit_discovered_features';

/**
 * Get the set of features the user has already discovered
 */
function getDiscoveredFeatures(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }

  try {
    const stored = localStorage.getItem(DISCOVERED_FEATURES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch {
    // Ignore parsing errors
  }

  return new Set();
}

/**
 * Mark a feature as discovered
 */
function markFeatureDiscovered(feature: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const discovered = getDiscoveredFeatures();
    discovered.add(feature);
    localStorage.setItem(
      DISCOVERED_FEATURES_KEY,
      JSON.stringify(Array.from(discovered)),
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if a feature has been discovered
 */
function isFeatureDiscovered(feature: string): boolean {
  return getDiscoveredFeatures().has(feature);
}

export type TrackFn = <T extends PostHogProperties>(
  event: AnalyticsEventName,
  properties?: T,
) => void;

export type UseAnalyticsReturn = {
  /**
   * Track an analytics event with type-safe properties
   */
  track: TrackFn;

  /**
   * Track first-time feature discovery
   * Only fires once per feature per user (stored in localStorage)
   */
  trackFeatureDiscovery: (
    feature: DiscoverableFeature,
    context?: string,
  ) => void;

  /**
   * Track a feature usage event and potentially discovery
   * Convenience method that combines usage tracking with discovery
   */
  trackFeatureUsage: (
    event: AnalyticsEventName,
    feature: DiscoverableFeature,
    properties?: PostHogProperties,
  ) => void;

  /**
   * Whether PostHog is initialized and ready
   */
  isReady: boolean;
};

/**
 * Hook for type-safe PostHog analytics tracking
 *
 * Provides methods for tracking events, feature discovery, and engagement.
 * All events are typed and validated at compile time.
 */
export function useAnalytics(): UseAnalyticsReturn {
  const posthog = usePostHog();
  const isReady = Boolean(posthog);

  // Track which features have been discovered this session (for deduplication)
  const sessionDiscoveredRef = useRef<Set<string>>(new Set());

  /**
   * Track an analytics event
   */
  const track = useCallback<TrackFn>(
    (event, properties) => {
      if (!posthog) {
        return;
      }

      posthog.capture(event, {
        timestamp: new Date().toISOString(),
        ...properties,
      });
    },
    [posthog],
  );

  /**
   * Track first-time feature discovery
   */
  const trackFeatureDiscovery = useCallback(
    (feature: DiscoverableFeature, context?: string) => {
      if (!posthog) {
        return;
      }

      // Check if already discovered (localStorage)
      if (isFeatureDiscovered(feature)) {
        return;
      }

      // Check if already tracked this session
      if (sessionDiscoveredRef.current.has(feature)) {
        return;
      }

      // Mark as discovered
      markFeatureDiscovered(feature);
      sessionDiscoveredRef.current.add(feature);

      // Track the discovery event
      posthog.capture(AnalyticsEvents.FEATURE_DISCOVERED, {
        context,
        feature,
        is_first_time: true,
        timestamp: new Date().toISOString(),
      });

      // Also set a user property for the discovery
      posthog.setPersonProperties({
        [`discovered_${feature}`]: new Date().toISOString(),
      });
    },
    [posthog],
  );

  /**
   * Track feature usage with optional discovery
   */
  const trackFeatureUsage = useCallback(
    (
      event: AnalyticsEventName,
      feature: DiscoverableFeature,
      properties?: PostHogProperties,
    ) => {
      // Track the usage event
      track(event, properties);

      // Also track discovery if first time
      trackFeatureDiscovery(feature, event);
    },
    [track, trackFeatureDiscovery],
  );

  return {
    isReady,
    track,
    trackFeatureDiscovery,
    trackFeatureUsage,
  };
}
