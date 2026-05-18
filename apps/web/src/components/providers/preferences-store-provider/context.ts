/**
 * Preferences Store Context and Hooks
 *
 * Context holds vanilla store instance. useModelPreferencesStore accesses
 * context + custom useStore for subscriptions. Persist middleware with
 * cookie storage for SSR compatibility.
 */
import { createContext, use, useEffect, useState } from 'react';

import { useStore } from '@/lib/store';
import type { StoreApiWithPersist } from '@/lib/store/persist';
import type {
  ModelPreferencesStore,
  ModelPreferencesStoreApi,
} from '@/stores/preferences/store';

export const PreferencesStoreContext = createContext<
  ModelPreferencesStoreApi | undefined
>(undefined);

/**
 * Primary hook for accessing preferences store state and actions.
 * Uses selector pattern for optimized re-renders.
 */
export function useModelPreferencesStore<T>(
  selector: (store: ModelPreferencesStore) => T,
): T {
  const storeContext = use(PreferencesStoreContext);

  if (!storeContext) {
    throw new Error(
      'useModelPreferencesStore must be used within PreferencesStoreProvider',
    );
  }

  return useStore(storeContext, selector);
}

/**
 * Hook to check if preferences store has finished hydrating from persistence.
 */
export function useModelPreferencesHydrated(): boolean {
  const storeContext = use(PreferencesStoreContext);
  const persistStore = storeContext as unknown as StoreApiWithPersist<ModelPreferencesStore> | undefined;
  const [hydrated, setHydrated] = useState(() =>
    persistStore?.persist.hasHydrated() ?? false,
  );

  useEffect(() => {
    if (!persistStore?.persist) {
      return;
    }

    const unsubHydrate = persistStore.persist.onHydrate(() => {
      setHydrated(false);
    });

    const unsubFinishHydration = persistStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return () => {
      unsubHydrate();
      unsubFinishHydration();
    };
  }, [persistStore]);

  return hydrated;
}
