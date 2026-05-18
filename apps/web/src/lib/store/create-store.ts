/**
 * Minimal pub-sub store — drop-in replacement for zustand/vanilla createStore.
 *
 * API: { getState, setState, subscribe, getInitialState }
 * setState accepts partial state or updater function.
 * Notifies subscribers on every setState call.
 */

/**
 * SetState signature compatible with zustand's set(partial, replace?, actionName?).
 * The third `_actionName` param is accepted but ignored (devtools removed).
 */
export type SetState<T> = (
  partial: Partial<T> | ((state: T) => Partial<T>),
  replace?: boolean,
  _actionName?: string,
) => void;

export type StoreApi<T> = {
  getInitialState: () => T;
  getState: () => T;
  setState: SetState<T>;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
};

/** Initializer function that may carry a persist post-init hook. */
export type PersistableInitializer<T> = ((set: SetState<T>, get: () => T) => T) & {
  __persistInit?: (store: StoreApi<T>) => void;
};

export function createStore<T>(initializer: PersistableInitializer<T>): StoreApi<T> {
  let state: T;
  const listeners = new Set<(state: T, prevState: T) => void>();

  const getState: StoreApi<T>['getState'] = () => state;

  const setState: SetState<T> = (partial, replace) => {
    const prevState = state;
    const nextPartial = typeof partial === 'function'
      ? (partial as (state: T) => Partial<T>)(state)
      : partial;

    if (replace) {
      state = nextPartial as T;
    } else {
      state = Object.assign({}, state, nextPartial);
    }

    for (const listener of listeners) {
      listener(state, prevState);
    }
  };

  const subscribe: StoreApi<T>['subscribe'] = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  // Initialize state by calling the initializer with set/get
  state = initializer(setState, getState);

  const initialState = state;
  const getInitialState = () => initialState;

  const store: StoreApi<T> = { getInitialState, getState, setState, subscribe };

  // Support persist middleware post-init hook
  const persistInit = initializer.__persistInit;
  if (persistInit) {
    persistInit(store);
  }

  return store;
}
