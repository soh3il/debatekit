/**
 * Module-scope ad click capture — runs synchronously on import, before React hydration.
 *
 * Captures click IDs from all major ad platforms and UTM params from the landing URL,
 * persisting them in sessionStorage so they survive TanStack Router redirects
 * (e.g. / → /auth/sign-in → /chat).
 *
 * Supported platforms:
 * - Google Ads: gclid, gbraid, wbraid, gad_source
 * - Meta/Facebook: fbclid
 * - LinkedIn: li_fat_id
 * - Reddit: rdt_cid
 * - TikTok: ttclid
 * - Microsoft/Bing: msclkid
 * - Twitter/X: twclid
 *
 * Also sets the _gcl_aw cookie in Google's expected format so gtag can attribute
 * conversions even when the gclid is no longer in the URL.
 */

const STORAGE_PREFIX = 'rt_';

const PARAM_KEYS = [
  // Google Ads
  'gclid',
  'gbraid',
  'wbraid',
  'gad_source',
  // Meta/Facebook
  'fbclid',
  // LinkedIn
  'li_fat_id',
  // Reddit
  'rdt_cid',
  // TikTok
  'ttclid',
  // Microsoft/Bing
  'msclkid',
  // Twitter/X
  'twclid',
  // UTM params
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

type ParamKey = (typeof PARAM_KEYS)[number];

// Capture immediately on import — before hydrateRoot or beforeLoad can redirect
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);

  for (const key of PARAM_KEYS) {
    const value = params.get(key);
    if (value) {
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
      } catch {
        // Private browsing or storage full — silently ignore
      }
    }
  }

  // Set _gcl_aw cookie so gtag can attribute conversions
  const gclid = params.get('gclid');
  if (gclid) {
    const unixSeconds = Math.floor(Date.now() / 1000);
    const value = `GCL.${unixSeconds}.${gclid}`;
    const maxAge = 90 * 24 * 60 * 60; // 90 days
    document.cookie = `_gcl_aw=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
}

function getStored(key: ParamKey): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

export function getStoredGclid(): string | null {
  return getStored('gclid');
}

export function getStoredFbclid(): string | null {
  return getStored('fbclid');
}

export function getStoredLiFatId(): string | null {
  return getStored('li_fat_id');
}

export function getStoredRdtCid(): string | null {
  return getStored('rdt_cid');
}

export function getStoredTtclid(): string | null {
  return getStored('ttclid');
}

export function getStoredMsclkid(): string | null {
  return getStored('msclkid');
}

export function getStoredTwclid(): string | null {
  return getStored('twclid');
}

export function getStoredUtm(): Record<string, string> {
  const utm: Record<string, string> = {};
  const utmKeys: ParamKey[] = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ];
  for (const key of utmKeys) {
    const value = getStored(key);
    if (value) {
      utm[key] = value;
    }
  }
  return utm;
}

export function hasGclid(): boolean {
  return getStoredGclid() !== null;
}

/**
 * Get all stored tracking params as a record.
 * Includes gclid, fbclid, and all UTM params.
 */
export function getAllStoredTrackingParams(): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of PARAM_KEYS) {
    const value = getStored(key);
    if (value) {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Build a URL path with tracking params appended.
 * Used for magic link and OAuth callback URLs to preserve conversion attribution.
 *
 * @param basePath - The base path (e.g., '/chat' or '/chat?redirect=/settings')
 * @returns Path with tracking params appended (e.g., '/chat?gclid=xxx&utm_source=google')
 */
export function buildPathWithTrackingParams(basePath: string): string {
  const trackingParams = getAllStoredTrackingParams();

  // No tracking params stored, return base path as-is
  if (Object.keys(trackingParams).length === 0) {
    return basePath;
  }

  // Parse existing query params from basePath
  const [pathname = '', existingQuery] = basePath.split('?');
  const searchParams = new URLSearchParams(existingQuery || '');

  // Append tracking params (don't override if already present)
  for (const [key, value] of Object.entries(trackingParams)) {
    if (!searchParams.has(key)) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
