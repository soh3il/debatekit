/**
 * Ad Click Tracker Component
 *
 * Wrapper component that captures advertising click IDs (gclid, fbclid, UTM params)
 * from URL parameters and stores them as PostHog properties.
 *
 * This enables conversion tracking for:
 * - Google Ads (via gclid)
 * - Meta/Facebook Ads (via fbc derived from fbclid)
 *
 * Must be placed inside PostHogProvider.
 */

import { useAdClickTracking } from '@/hooks/utils/use-ad-click-tracking';

export function AdClickTracker() {
  useAdClickTracking();
  return null;
}
