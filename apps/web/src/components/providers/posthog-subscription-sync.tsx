/**
 * PostHog Subscription Sync Component
 *
 * Wrapper component that syncs subscription tier to PostHog user properties.
 * Must be inside PostHogProvider to access PostHog instance.
 *
 * Location: /src/components/providers/posthog-subscription-sync.tsx
 */

import { usePostHogSubscriptionSync } from '@/hooks/utils';

/**
 * Component that syncs subscription tier to PostHog user properties
 */
export function PostHogSubscriptionSync() {
  usePostHogSubscriptionSync();
  return null;
}
