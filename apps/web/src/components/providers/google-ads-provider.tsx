/**
 * Google Ads Provider - Deferred loading for conversion tracking
 *
 * Loads gtag.js via G-8NRM019810 (GA4 measurement ID) which manages conversion linker
 * and enables the AW-17914668376 destination to fire.
 */

import { WebAppEnvs } from '@debatekit/shared/enums';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { getStoredGclid } from '@/lib/analytics/ad-click-capture';
import { getWebappEnv } from '@/lib/config/base-urls';
import { rlog, RLOG_ENABLED } from '@/lib/utils/dev-logger';

export const GOOGLE_TAG_ID = 'G-8NRM019810';
export const GOOGLE_ADS_ID = 'AW-17914668376';

export const GOOGLE_ADS_CONVERSIONS = {
  SIGNUP: `AW-17914668376/dtJeCLPEiYgcENjKsN5C`,
  SUBSCRIPTION: `AW-17914668376/8F8gCNnrrYUcENjKsN5C`,
} as const;

type GtagPrimitive = string | number | boolean | undefined;
type GtagRecord = Record<string, GtagPrimitive | Record<string, GtagPrimitive>>;
type GtagArg = GtagPrimitive | Date | GtagRecord;

declare global {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Window {
    dataLayer: GtagArg[][];
    gtag: (...args: GtagArg[]) => void;
  }
}

// Module scope — runs on import, before any conversion call.
// Queue js + config so conversions queued later are attributed correctly
// when gtag.js loads and processes the dataLayer in order.
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: GtagArg[]) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_TAG_ID);
  window.gtag('config', GOOGLE_ADS_ID);
}

type GoogleAdsProviderProps = {
  children: ReactNode;
};

/**
 * Load Google Ads gtag.js script dynamically
 */
function loadGtagScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load gtag.js'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize gtag with Google Ads config
 */
function initializeGtag(): void {
  const storedGclid = getStoredGclid();
  if (storedGclid) {
    window.gtag('config', GOOGLE_ADS_ID, {
      gclid: storedGclid,
      send_page_view: false,
    });
  }
}

type ConversionParams = {
  sendTo: string;
  value?: number;
  currency?: string;
  transactionId?: string;
  userData?: { email?: string; firstName?: string; lastName?: string };
};

export function trackGoogleAdsConversion(params: ConversionParams): void {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  if (params.userData?.email) {
    window.gtag('set', 'user_data', {
      email: params.userData.email.trim().toLowerCase(),
      ...(params.userData.firstName && {
        address: {
          first_name: params.userData.firstName,
          last_name: params.userData.lastName || '',
        },
      }),
    });
  }

  window.gtag('event', 'conversion', {
    send_to: params.sendTo,
    ...(params.value !== undefined && { value: params.value }),
    ...(params.currency && { currency: params.currency }),
    ...(params.transactionId && { transaction_id: params.transactionId }),
  });
}

const SIGNUP_CONVERSION_KEY = 'rt_gads_signup_fired';
const SIGNUP_FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fire signup conversion once per session if user was created recently.
 * Uses sessionStorage to deduplicate across re-renders/navigations.
 */
export function trackSignupConversionIfNew(user: {
  createdAt?: string | Date | null;
  email?: string | null;
  name?: string | null;
}): void {
  if (typeof window === 'undefined' || !user.createdAt) {
    return;
  }

  // Already fired this session
  try {
    if (sessionStorage.getItem(SIGNUP_CONVERSION_KEY)) {
      return;
    }
  } catch {
    // sessionStorage unavailable
  }

  const createdAt = new Date(user.createdAt).getTime();
  const now = Date.now();
  if (now - createdAt > SIGNUP_FRESHNESS_MS) {
    return;
  }

  // Mark as fired before sending
  try {
    sessionStorage.setItem(SIGNUP_CONVERSION_KEY, '1');
  } catch {
    // sessionStorage unavailable — fire anyway, minor risk of double-count
  }

  trackGoogleAdsConversion({
    sendTo: GOOGLE_ADS_CONVERSIONS.SIGNUP,
    userData: {
      email: user.email ?? undefined,
      firstName: user.name?.split(' ')[0],
      lastName: user.name?.split(' ').slice(1).join(' '),
    },
  });
}

export default function GoogleAdsProvider({ children }: GoogleAdsProviderProps) {
  const initStarted = useRef(false);

  const environment = getWebappEnv();
  const isLocal = environment === WebAppEnvs.LOCAL;

  useEffect(() => {
    // Skip SSR
    if (typeof window === 'undefined') {
      return;
    }

    // Skip local env
    if (isLocal) {
      return;
    }

    // Prevent double init
    if (initStarted.current) {
      return;
    }
    initStarted.current = true;

    const loadAndInit = () => {
      loadGtagScript()
        .then(() => {
          initializeGtag();
        })
        .catch((error: unknown) => {
          if (RLOG_ENABLED) {
            rlog.stuck('google-ads', `Failed to load gtag: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
    };

    loadAndInit();
  }, [isLocal]);

  return <>{children}</>;
}
