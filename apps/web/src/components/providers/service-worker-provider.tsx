import { SwContext } from './use-service-worker';
import { useServiceWorkerRegistration } from './use-service-worker-registration';

/**
 * Service Worker Registration Provider
 *
 * Registers the service worker with auto-update behavior.
 * SW calls skipWaiting() on install, activates immediately,
 * and the page reloads on controllerchange.
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useServiceWorkerRegistration();

  return (
    <SwContext value={{ applyUpdate: () => {}, updateAvailable: false }}>
      {children}
    </SwContext>
  );
}
