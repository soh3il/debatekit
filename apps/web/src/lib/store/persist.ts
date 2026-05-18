/**
 * Custom persist middleware for cookie-based storage.
 * Drop-in replacement for zustand/middleware persist.
 *
 * Adds: persist.hasHydrated(), persist.onHydrate(), persist.onFinishHydration(), persist.rehydrate()
 */

import type { PersistableInitializer, SetState, StoreApi } from './create-store';

export type PersistStorage<T> = {
  getItem: (name: string) => { state: Partial<T>; version?: number } | null;
  setItem: (name: string, value: { state: Partial<T>; version?: number }) => void;
  removeItem: (name: string) => void;
};

export type PersistOptions<T, P> = {
  name: string;
  storage: PersistStorage<P>;
  /** Extract the subset of state to persist */
  partialize: (state: T) => P;
  /** Merge persisted state into current state */
  merge?: (persistedState: Partial<P>, currentState: T) => T;
  /** Skip automatic hydration (for SSR) */
  skipHydration?: boolean;
  /** Called when rehydration starts; returns callback for when it finishes */
  onRehydrateStorage?: () => ((state: T | undefined) => void) | void;
};

export type PersistApi = {
  hasHydrated: () => boolean;
  onHydrate: (fn: () => void) => () => void;
  onFinishHydration: (fn: () => void) => () => void;
  rehydrate: () => void;
};

export type StoreApiWithPersist<T> = StoreApi<T> & { persist: PersistApi };

/**
 * Wraps a store initializer to add cookie persistence.
 * Returns a function compatible with createStore's initializer signature,
 * plus attaches a `persist` API to the returned store.
 */
export function withPersist<T, P>(
  initializer: (set: SetState<T>, get: () => T) => T,
  options: PersistOptions<T, P>,
): PersistableInitializer<T> {
  const { merge, name, onRehydrateStorage, partialize, skipHydration, storage } = options;

  let _hasHydrated = false;
  const hydrateListeners = new Set<() => void>();
  const finishHydrationListeners = new Set<() => void>();

  // We'll attach persist API after store creation via a post-init hook
  let storeRef: StoreApi<T> | null = null;

  function doRehydrate() {
    if (!storeRef) {
      return;
    }

    // Notify hydration start
    for (const fn of hydrateListeners) {
      fn();
    }

    const onRehydrateCallback = onRehydrateStorage?.();

    try {
      const stored = storage.getItem(name);
      if (stored?.state) {
        const currentState = storeRef.getState();
        const merged = merge
          ? merge(stored.state, currentState)
          : { ...currentState, ...stored.state };
        storeRef.setState(merged as Partial<T>, true);
      }
    } catch {
      // Silently ignore corrupt storage
    }

    _hasHydrated = true;
    onRehydrateCallback?.(storeRef.getState());

    // Notify hydration complete
    for (const fn of finishHydrationListeners) {
      fn();
    }
  }

  const persistApi: PersistApi = {
    hasHydrated: () => _hasHydrated,
    onFinishHydration: (fn) => {
      finishHydrationListeners.add(fn);
      return () => {
        finishHydrationListeners.delete(fn);
      };
    },
    onHydrate: (fn) => {
      hydrateListeners.add(fn);
      return () => {
        hydrateListeners.delete(fn);
      };
    },
    rehydrate: () => doRehydrate(),
  };

  // Return the wrapped initializer
  const wrappedInitializer = (set: SetState<T>, get: () => T): T => {
    // Wrap set to persist on every state change
    const persistingSet: SetState<T> = (partial, replace, actionName) => {
      set(partial, replace, actionName);
      // Write persisted subset to storage after state update
      try {
        const partialized = partialize(get());
        storage.setItem(name, { state: partialized });
      } catch {
        // Silently ignore write failures
      }
    };

    const state = initializer(persistingSet, get);
    return state;
  };

  // Attach persist API and trigger initial hydration
  // This is called from a post-creation hook in createStore
  const persistableInitializer: PersistableInitializer<T> = wrappedInitializer;
  persistableInitializer.__persistInit = (store: StoreApi<T>) => {
    storeRef = store;
    const storeWithPersist: StoreApiWithPersist<T> = Object.assign(store, { persist: persistApi });
    // Mutate in-place so callers holding a reference see the persist API
    void storeWithPersist;

    if (!skipHydration) {
      doRehydrate();
    }
  };

  return persistableInitializer;
}
