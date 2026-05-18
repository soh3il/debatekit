/**
 * PostHog User Identification Hook
 *
 * Identifies users to PostHog when they authenticate, resets on sign-out.
 *
 * CRITICAL: Required for `person_profiles: 'identified_only'` mode.
 * Without this, all user events are lost (not associated with any person).
 *
 * NOTE: Signup vs login event tracking is handled SERVER-SIDE only
 * (user_signed_up / user_logged_in in Better Auth hooks). The client
 * only does identify/reset — no auth completion events here.
 *
 * Location: /src/hooks/utils/use-posthog-identify.ts
 */

import { usePostHog } from 'posthog-js/react';
import { useEffect, useRef } from 'react';

import { trackSignupConversionIfNew } from '@/components/providers/google-ads-provider';
import { useSession } from '@/lib/auth/client';

export function usePostHogIdentify() {
  const posthog = usePostHog();
  const { data: session } = useSession();
  const lastIdentifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) {
      return;
    }

    const userId = session?.user?.id;

    // User authenticated — identify to PostHog
    if (userId && lastIdentifiedUserId.current !== userId) {
      posthog.identify(userId, {
        $set: {
          email: session.user.email,
          name: session.user.name,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        ...(session.user.createdAt && {
          $set_once: {
            created_at: new Date(session.user.createdAt).toISOString(),
          },
        }),
      });

      // Fire Google Ads signup conversion if this is a fresh account
      trackSignupConversionIfNew(session.user);

      lastIdentifiedUserId.current = userId;
      return;
    }

    // User signed out — reset PostHog identity
    if (!userId && lastIdentifiedUserId.current !== null) {
      posthog.reset();
      lastIdentifiedUserId.current = null;
    }
  }, [posthog, session]);
}
