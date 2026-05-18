/**
 * PostHog Funnel Tracking Hook
 *
 * Provides type-safe methods for tracking conversion funnel events.
 * Uses PostHog's capture API with standardized event properties.
 *
 * @example
 * ```typescript
 * const { trackAuth, trackBilling, trackOnboarding } = useFunnelTracking();
 *
 * // Track auth funnel
 * trackAuth.signInMethodSelected({ method: 'google' });
 *
 * // Track billing funnel
 * trackBilling.pricingPageViewed({ source: 'header_cta' });
 * ```
 */

import type { BillingInterval, SubscriptionTier } from '@debatekit/shared';
import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';

import {
  AUTH_FUNNEL_EVENTS,
  BILLING_FUNNEL_EVENTS,
  ENGAGEMENT_EVENTS,
  FEATURE_ADOPTION_EVENTS,
  ONBOARDING_FUNNEL_EVENTS,
} from '@/constants/analytics';
import type { PostHogProperties } from '@/lib/analytics/use-analytics';

// ============================================================================
// PROPERTY TYPES
// ============================================================================

type AuthMethod = 'google' | 'magic_link';
type BillingSource = 'header_cta' | 'sidebar' | 'usage_limit' | 'settings' | 'direct';

type SignInMethodSelectedProps = {
  method: AuthMethod;
};

type MagicLinkProps = {
  email_domain?: string; // e.g., 'gmail.com' - useful for B2B analysis
};

type OAuthStartedProps = {
  provider: string;
};

type PricingPageViewedProps = {
  source?: BillingSource;
  current_tier?: SubscriptionTier;
};

type PlanSelectedProps = {
  plan_name: string;
  price_id: string;
  billing_interval: BillingInterval;
  price_amount: number;
  currency: string;
};

type CheckoutStartedProps = {
  plan_name: string;
  price_id: string;
};

type CheckoutCompletedProps = {
  plan_name?: string;
  price_id?: string;
};

type SubscriptionActivatedProps = {
  plan_name: string;
  tier: SubscriptionTier;
  billing_interval?: BillingInterval;
};

type SubscriptionCancelledProps = {
  plan_name: string;
  reason?: string;
  immediately: boolean;
};

type ThreadCreatedProps = {
  thread_id: string;
  participant_count: number;
  has_attachments: boolean;
  mode: string;
  is_first_thread?: boolean;
};

type RoundCompletedProps = {
  thread_id: string;
  round_number: number;
  participant_count: number;
  is_first_round?: boolean;
};

type QuickStartClickedProps = {
  suggestion_text: string;
  category?: string;
};

type ModelsConfiguredProps = {
  model_count: number;
  model_ids: string[];
};

type PresetAppliedProps = {
  preset_name: string;
  model_count: number;
};

type ThreadSharedProps = {
  thread_id: string;
  share_method: 'link' | 'public';
};

type FeatureUsedProps = {
  context?: string;
};

// ============================================================================
// HOOK
// ============================================================================

export function useFunnelTracking() {
  const posthog = usePostHog();

  // Helper to safely capture events (handles SSR and missing PostHog)
  const capture = useCallback((event: string, properties?: PostHogProperties) => {
    if (posthog) {
      posthog.capture(event, {
        ...properties,
        // Add timestamp for funnel ordering accuracy
        $timestamp: new Date().toISOString(),
      });
    }
  }, [posthog]);

  // ============================================================================
  // AUTH FUNNEL TRACKERS
  // ============================================================================

  const trackAuth = {
    // NOTE: signup/login completion events are tracked SERVER-SIDE only
    // (user_signed_up / user_logged_in in Better Auth hooks).
    // Client-side only tracks UI interaction events below.

    magicLinkRequested: useCallback((props?: MagicLinkProps) => {
      capture(AUTH_FUNNEL_EVENTS.MAGIC_LINK_REQUESTED, props);
    }, [capture]),

    magicLinkSent: useCallback((props?: MagicLinkProps) => {
      capture(AUTH_FUNNEL_EVENTS.MAGIC_LINK_SENT, props);
    }, [capture]),

    oauthStarted: useCallback((props: OAuthStartedProps) => {
      capture(AUTH_FUNNEL_EVENTS.OAUTH_STARTED, props);
    }, [capture]),

    signInMethodSelected: useCallback((props: SignInMethodSelectedProps) => {
      capture(AUTH_FUNNEL_EVENTS.SIGN_IN_METHOD_SELECTED, props);
    }, [capture]),

    signInPageViewed: useCallback(() => {
      capture(AUTH_FUNNEL_EVENTS.SIGN_IN_PAGE_VIEWED);
    }, [capture]),
  };

  // ============================================================================
  // ONBOARDING FUNNEL TRACKERS
  // ============================================================================

  const trackOnboarding = {
    chatOverviewViewed: useCallback(() => {
      capture(ONBOARDING_FUNNEL_EVENTS.CHAT_OVERVIEW_VIEWED);
    }, [capture]),

    firstInputStarted: useCallback(() => {
      capture(ONBOARDING_FUNNEL_EVENTS.FIRST_INPUT_STARTED);
    }, [capture]),

    firstRoundCompleted: useCallback((props: Omit<RoundCompletedProps, 'is_first_round'>) => {
      capture(ONBOARDING_FUNNEL_EVENTS.FIRST_ROUND_COMPLETED, { ...props, is_first_round: true });
    }, [capture]),

    firstThreadCreated: useCallback((props: Omit<ThreadCreatedProps, 'is_first_thread'>) => {
      capture(ONBOARDING_FUNNEL_EVENTS.FIRST_THREAD_CREATED, { ...props, is_first_thread: true });
    }, [capture]),

    modelsExplored: useCallback(() => {
      capture(ONBOARDING_FUNNEL_EVENTS.MODELS_EXPLORED);
    }, [capture]),
  };

  // ============================================================================
  // BILLING FUNNEL TRACKERS
  // ============================================================================

  const trackBilling = {
    checkoutCompleted: useCallback((props?: CheckoutCompletedProps) => {
      capture(BILLING_FUNNEL_EVENTS.CHECKOUT_COMPLETED, props);
    }, [capture]),

    checkoutStarted: useCallback((props: CheckoutStartedProps) => {
      capture(BILLING_FUNNEL_EVENTS.CHECKOUT_STARTED, props);
    }, [capture]),

    planSelected: useCallback((props: PlanSelectedProps) => {
      capture(BILLING_FUNNEL_EVENTS.PLAN_SELECTED, props);
    }, [capture]),

    portalAccessed: useCallback(() => {
      capture(BILLING_FUNNEL_EVENTS.PORTAL_ACCESSED);
    }, [capture]),

    pricingPageViewed: useCallback((props?: PricingPageViewedProps) => {
      capture(BILLING_FUNNEL_EVENTS.PRICING_PAGE_VIEWED, props);
    }, [capture]),

    subscriptionActivated: useCallback((props: SubscriptionActivatedProps) => {
      capture(BILLING_FUNNEL_EVENTS.SUBSCRIPTION_ACTIVATED, props);
    }, [capture]),

    subscriptionCancelled: useCallback((props: SubscriptionCancelledProps) => {
      capture(BILLING_FUNNEL_EVENTS.SUBSCRIPTION_CANCELLED, props);
    }, [capture]),

    upgradeCompleted: useCallback((props: SubscriptionActivatedProps) => {
      capture(BILLING_FUNNEL_EVENTS.UPGRADE_COMPLETED, props);
    }, [capture]),
  };

  // ============================================================================
  // ENGAGEMENT TRACKERS
  // ============================================================================

  const trackEngagement = {
    modelsConfigured: useCallback((props: ModelsConfiguredProps) => {
      capture(ENGAGEMENT_EVENTS.MODELS_CONFIGURED, props);
    }, [capture]),

    presetApplied: useCallback((props: PresetAppliedProps) => {
      capture(ENGAGEMENT_EVENTS.PRESET_APPLIED, props);
    }, [capture]),

    quickStartClicked: useCallback((props: QuickStartClickedProps) => {
      capture(ENGAGEMENT_EVENTS.QUICK_START_CLICKED, props);
    }, [capture]),

    roundCompleted: useCallback((props: RoundCompletedProps) => {
      capture(ENGAGEMENT_EVENTS.ROUND_COMPLETED, props);
    }, [capture]),

    threadCreated: useCallback((props: ThreadCreatedProps) => {
      capture(ENGAGEMENT_EVENTS.THREAD_CREATED, props);
    }, [capture]),

    threadFavorited: useCallback((props: { thread_id: string; is_favorite: boolean }) => {
      capture(ENGAGEMENT_EVENTS.THREAD_FAVORITED, props);
    }, [capture]),

    threadShared: useCallback((props: ThreadSharedProps) => {
      capture(ENGAGEMENT_EVENTS.THREAD_SHARED, props);
    }, [capture]),
  };

  // ============================================================================
  // FEATURE ADOPTION TRACKERS
  // ============================================================================

  const trackFeature = {
    attachmentUsed: useCallback((props?: FeatureUsedProps & { file_type?: string }) => {
      capture(FEATURE_ADOPTION_EVENTS.ATTACHMENT_USED, props);
    }, [capture]),

    autoModeUsed: useCallback((props?: FeatureUsedProps) => {
      capture(FEATURE_ADOPTION_EVENTS.AUTO_MODE_USED, props);
    }, [capture]),

    customRoleCreated: useCallback((props?: FeatureUsedProps) => {
      capture(FEATURE_ADOPTION_EVENTS.CUSTOM_ROLE_CREATED, props);
    }, [capture]),

    projectCreated: useCallback((props?: FeatureUsedProps) => {
      capture(FEATURE_ADOPTION_EVENTS.PROJECT_CREATED, props);
    }, [capture]),

    webSearchEnabled: useCallback((props?: FeatureUsedProps) => {
      capture(FEATURE_ADOPTION_EVENTS.WEB_SEARCH_ENABLED, props);
    }, [capture]),
  };

  return {
    // Raw capture for custom events
    capture,
    trackAuth,
    trackBilling,
    trackEngagement,
    trackFeature,
    trackOnboarding,
  };
}
