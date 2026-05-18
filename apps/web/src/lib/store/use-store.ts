/**
 * React hook for subscribing to a store with selector optimization.
 * Uses useSyncExternalStore (native React 18+).
 *
 * Replaces: import { useStore } from 'zustand'
 */

import { useCallback, useSyncExternalStore } from 'react';

import type { StoreApi } from './create-store';

export function useStore<T, U>(store: StoreApi<T>, selector: (state: T) => U): U {
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store],
  );

  const getSnapshot = useCallback(
    () => selector(store.getState()),
    [store, selector],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
