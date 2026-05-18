/**
 * PostHog Subscription Sync Hook
 *
 * Automatically syncs subscription tier to PostHog user properties.
 * Updates when subscription status changes for accurate segmentation.
 *
 * Location: /src/hooks/utils/use-posthog-subscription-sync.ts
 */

import { PlanTypes, StripeSubscriptionStatuses } from '@debatekit/shared';
import { usePostHog } from 'posthog-js/react';
import { useEffect, useRef } from 'react';

import { useSubscriptionsQuery, useUsageStatsQuery } from '@/hooks/queries';
import { useSession } from '@/lib/auth/client';
import { getSubscriptionsFromResponse } from '@/services/api/billing/subscriptions';
import { getPlanTypeFromUsageStats } from '@/services/api/usage';

/**
 * Hook that syncs subscription tier to PostHog user properties.
 *
 * Updates the following user properties:
 * - subscription_tier: 'free' | 'pro'
 * - subscription_status: 'active' | 'trialing' | 'canceled' | 'none'
 * - is_paid_user: boolean
 *
 * @example
 * ```typescript
 * // In a provider or layout component:
 * function AppLayout() {
 *   usePostHogSubscriptionSync();
 *   return <App />;
 * }
 * ```
 */
export function usePostHogSubscriptionSync() {
  const posthog = usePostHog();
  const { data: session } = useSession();
  const subscriptionsQuery = useSubscriptionsQuery();
  const usageStatsQuery = useUsageStatsQuery();

  const lastSyncedTierRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if not authenticated or PostHog not ready
    if (!posthog || !session?.user?.id) {
      return;
    }

    // Extract subscription data
    const subscriptions = getSubscriptionsFromResponse(subscriptionsQuery.data);
    const planType = getPlanTypeFromUsageStats(usageStatsQuery.data);

    // Find active or trialing subscription
    const activeSubscription = subscriptions.find(
      sub => sub.status === StripeSubscriptionStatuses.ACTIVE
        || sub.status === StripeSubscriptionStatuses.TRIALING,
    );

    // Determine tier and status
    const isPaidUser = planType === PlanTypes.PAID || activeSubscription !== undefined;
    const subscriptionTier = isPaidUser ? 'pro' : 'free';
    const subscriptionStatus = activeSubscription?.status ?? 'none';

    // Create sync key to detect changes
    const syncKey = `${subscriptionTier}-${subscriptionStatus}`;

    // Skip if already synced this state
    if (lastSyncedTierRef.current === syncKey) {
      return;
    }

    // Update PostHog user properties
    posthog.setPersonProperties({
      is_paid_user: isPaidUser,
      subscription_status: subscriptionStatus,
      // Set update timestamp for debugging
      subscription_synced_at: new Date().toISOString(),
      subscription_tier: subscriptionTier,
    });

    lastSyncedTierRef.current = syncKey;
  }, [posthog, session, subscriptionsQuery.data, usageStatsQuery.data]);
}
