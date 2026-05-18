/**
 * Shallow comparison wrapper for store selectors.
 * Prevents re-renders when selected object is structurally equal.
 *
 * Replaces: import { useShallow } from 'zustand/react/shallow'
 *
 * Usage:
 *   useChatStore(useShallow(s => ({ a: s.a, b: s.b })))
 */

import { useRef } from 'react';

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.is(Reflect.get(a, key), Reflect.get(b, key))) {
      return false;
    }
  }

  return true;
}

/**
 * Creates a selector that memoizes using shallow comparison.
 * Wrap your selector with useShallow to prevent re-renders on structurally equal objects.
 */
export function useShallow<S, T>(selector: (state: S) => T): (state: S) => T {
  const prevRef = useRef<T | undefined>(undefined);

  return (state: S) => {
    const next = selector(state);
    if (prevRef.current !== undefined && shallowEqual(prevRef.current, next)) {
      return prevRef.current;
    }
    prevRef.current = next;
    return next;
  };
}
