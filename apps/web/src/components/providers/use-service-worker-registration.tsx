import { WebAppEnvs } from '@debatekit/shared/enums';
import { useEffect } from 'react';

import { getWebappEnv } from '@/lib/config/base-urls';

/**
 * Service Worker Registration Hook — Auto-Update Mode
 *
 * Registers the service worker and lets it auto-activate on each deploy.
 * The SW calls skipWaiting() on install, so updates apply immediately.
 * On controllerchange the page reloads to pick up the new version.
 *
 * Update checks happen:
 * - On visibility change (user returns to tab)
 * - Every 5 minutes
 * - On focus
 */
export function useServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window === 'undefined'
      || !('serviceWorker' in navigator)
      || getWebappEnv() === WebAppEnvs.LOCAL
    ) {
      return undefined;
    }

    let refreshing = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const handleControllerChange = () => {
      if (refreshing) {
        return;
      }
      refreshing = true;
      window.location.reload();
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        // Check for updates on visibility change (user returns to tab)
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        // eslint-disable-next-line react-web-api/no-leaked-event-listener
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Check for updates every 5 minutes
        intervalId = setInterval(() => {
          registration.update().catch(() => {});
        }, 5 * 60 * 1000);

        // Auto-reload when new SW takes control
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        // Warm up cache for common routes when browser is idle
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            navigator.serviceWorker.controller?.postMessage({
              routes: ['/auth/sign-in', '/chat/pricing', '/legal/terms', '/legal/privacy'],
              type: 'WARM_CACHE',
            });
          }, { timeout: 5000 });
        }
      } catch {
        // SW registration failed - not critical, app works without it
      }
    };

    if (document.readyState === 'complete') {
      void registerServiceWorker();
    } else {
      const onLoad = () => void registerServiceWorker();
      window.addEventListener('load', onLoad);
      return () => {
        window.removeEventListener('load', onLoad);
        if (intervalId) {
          clearInterval(intervalId);
        }
        navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
      };
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);
}
