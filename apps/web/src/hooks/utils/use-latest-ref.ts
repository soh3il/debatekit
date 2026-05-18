import { useRef } from 'react';

/**
 * Keeps a ref always in sync with the latest value.
 * Synchronous assignment (not via useEffect) to prevent stale closures in callbacks.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
