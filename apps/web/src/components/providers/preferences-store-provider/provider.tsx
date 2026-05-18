import { useEffect, useState } from 'react';

import type { StoreApiWithPersist } from '@/lib/store/persist';
import type { ModelPreferencesStore } from '@/stores/preferences/store';
import {
  createModelPreferencesStore,
  initPreferencesStore,
} from '@/stores/preferences/store';

import { PreferencesStoreContext } from './context';
import type { PreferencesStoreProviderProps } from './types';

/**
 * Preferences Store Provider — SSR Pattern for TanStack Start
 *
 * Factory pattern with initPreferencesStore allows server-passed initial state.
 * Cookie-based persistence with SSR hydration support.
 */
export function PreferencesStoreProvider({
  children,
  initialState,
}: PreferencesStoreProviderProps) {
  const [store] = useState(() =>
    createModelPreferencesStore(initPreferencesStore(initialState)),
  );

  useEffect(() => {
    if (!initialState && store) {
      const persistStore = store as unknown as StoreApiWithPersist<ModelPreferencesStore>;
      persistStore.persist.rehydrate();
    }
  }, [initialState, store]);

  return (
    <PreferencesStoreContext value={store}>
      {children}
    </PreferencesStoreContext>
  );
}
