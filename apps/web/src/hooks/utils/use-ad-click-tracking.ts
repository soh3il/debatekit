/**
 * Ad Click ID Tracking Hook
 *
 * Captures and stores advertising click IDs from URL parameters:
 * - gclid/gbraid/wbraid: Google Ads Click IDs
 * - fbclid: Facebook/Meta Click ID (used to generate fbc for Meta conversions)
 * - li_fat_id: LinkedIn Ads Click ID
 * - rdt_cid: Reddit Ads Click ID
 * - ttclid: TikTok Ads Click ID
 * - msclkid: Microsoft/Bing Ads Click ID
 * - twclid: Twitter/X Ads Click ID
 * - UTM parameters: Campaign attribution data
 *
 * These IDs are stored as PostHog person properties so they can be
 * passed to ad platform destinations.
 *
 * @see https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#gclid
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc
 */

import { usePostHog } from 'posthog-js/react';
import { useEffect, useRef } from 'react';

import {
  getStoredFbclid,
  getStoredGclid,
  getStoredLiFatId,
  getStoredMsclkid,
  getStoredRdtCid,
  getStoredTtclid,
  getStoredTwclid,
  getStoredUtm,
} from '@/lib/analytics/ad-click-capture';

/**
 * Generate Facebook Click ID (fbc) from fbclid
 *
 * Format: fb.{version}.{creation_time}.{fbclid}
 * - version: Always 1
 * - creation_time: Unix timestamp in milliseconds when the fbc was created
 * - fbclid: The Facebook click ID from URL parameter
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc
 */
function generateFbc(fbclid: string): string {
  const version = 1;
  const creationTime = Date.now();
  return `fb.${version}.${creationTime}.${fbclid}`;
}

/** All ad platform click ID keys to extract from URLs */
const AD_CLICK_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'gad_source',
  'fbclid',
  'li_fat_id',
  'rdt_cid',
  'ttclid',
  'msclkid',
  'twclid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

type AdClickKey = (typeof AD_CLICK_KEYS)[number];
type AdClickParams = Record<AdClickKey, string | null>;

/** Storage getters keyed by param name for sessionStorage fallback */
const STORAGE_GETTERS: Partial<Record<AdClickKey, () => string | null>> = {
  fbclid: getStoredFbclid,
  gclid: getStoredGclid,
  li_fat_id: getStoredLiFatId,
  msclkid: getStoredMsclkid,
  rdt_cid: getStoredRdtCid,
  ttclid: getStoredTtclid,
  twclid: getStoredTwclid,
};

/**
 * Extract ad click parameters from URL, including from nested redirect param
 *
 * When users land on protected pages with click IDs, they're redirected to sign-in
 * with the original URL encoded in the `redirect` param:
 * /auth/sign-in?redirect=/chat?gclid=xxx
 *
 * This function extracts params from both top-level and nested redirect URLs,
 * then falls back to sessionStorage for any missing values.
 */
function createEmptyAdClickParams(): AdClickParams {
  const params: Partial<AdClickParams> = {};
  for (const key of AD_CLICK_KEYS) {
    params[key] = null;
  }
  // All keys are assigned in the loop above (AD_CLICK_KEYS is exhaustive)
  return params as AdClickParams;
}

function getAdClickParams(searchParams: URLSearchParams): AdClickParams {
  const params = createEmptyAdClickParams();

  // First try top-level params
  for (const key of AD_CLICK_KEYS) {
    params[key] = searchParams.get(key);
  }

  // Check inside redirect param for any missing values
  const redirectUrl = searchParams.get('redirect');
  if (redirectUrl) {
    try {
      const redirectParams = new URLSearchParams(
        redirectUrl.includes('?') ? redirectUrl.split('?')[1] : '',
      );
      for (const key of AD_CLICK_KEYS) {
        if (!params[key]) {
          params[key] = redirectParams.get(key);
        }
      }
    } catch {
      // Invalid redirect URL, ignore
    }
  }

  // Fallback to sessionStorage for click IDs captured before redirect
  // Iterate known keys to avoid `as AdClickKey` cast from Object.entries()
  for (const key of AD_CLICK_KEYS) {
    const getter = STORAGE_GETTERS[key];
    if (!params[key] && getter) {
      params[key] = getter();
    }
  }

  // Fallback to sessionStorage for UTM params
  const storedUtm = getStoredUtm();
  for (const key of AD_CLICK_KEYS) {
    if (key.startsWith('utm_') && !params[key]) {
      params[key] = storedUtm[key] ?? null;
    }
  }

  return params;
}

/**
 * Hook to capture and store ad click IDs from URL parameters
 *
 * Runs once on mount to capture click IDs from the landing URL.
 * Stores them as PostHog super properties (persisted across sessions)
 * and person properties (for server-side destinations).
 *
 * @example
 * ```tsx
 * // In your root layout or PostHog provider:
 * function App() {
 *   useAdClickTracking();
 *   return <YourApp />;
 * }
 * ```
 */
export function useAdClickTracking() {
  const posthog = usePostHog();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Skip SSR
    if (typeof window === 'undefined') {
      return;
    }

    // Only process once per session
    if (hasProcessed.current) {
      return;
    }

    // Skip if PostHog not initialized
    if (!posthog) {
      return;
    }

    hasProcessed.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const params = getAdClickParams(searchParams);

    // Build properties object with non-null values
    const properties: Record<string, string> = {};

    // Copy all non-null params directly
    for (const key of AD_CLICK_KEYS) {
      if (params[key]) {
        properties[key] = params[key];
      }
    }

    // Generate derived values for Meta Conversions API
    if (params.fbclid) {
      properties.fbc = generateFbc(params.fbclid);
    }

    // Only proceed if we have any ad-related parameters
    if (Object.keys(properties).length === 0) {
      return;
    }

    // Register as super properties - these persist and are sent with every event
    // This ensures the gclid/fbc are available for conversion events
    posthog.register(properties);

    // Also set as person properties so they're available for server-side destinations
    // The $set ensures these are stored on the person profile
    posthog.setPersonProperties(properties);

    // Capture a landing event with ad attribution
    posthog.capture('$ad_landing', {
      $set: properties,
      landing_url: window.location.href,
      referrer: document.referrer,
    });
  }, [posthog]);
}
