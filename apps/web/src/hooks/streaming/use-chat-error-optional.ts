/**
 * Optional Chat Error Hook
 *
 * Safe wrapper around useChatError from @ai-sdk-tools/store.
 * Returns undefined when the AI SDK store Provider is absent
 * (e.g., public thread pages), instead of throwing.
 *
 * @module hooks/streaming/use-chat-error-optional
 */

import type { StoreState } from '@ai-sdk-tools/store';
import { ChatStoreContext } from '@ai-sdk-tools/store';
import { use } from 'react';
import { useStore } from 'zustand';

/**
 * NOOP store shim for when the AI SDK Provider is absent (public pages).
 * Typed to satisfy useStore's ReadonlyStoreApi<StoreState> constraint
 * so the selector parameter infers as StoreState instead of `any`.
 *
 * The getState/getInitialState return partial objects cast to StoreState.
 * This is safe because the NOOP path returns early before the selector
 * result is consumed by the component.
 */
const NOOP_STATE = { error: undefined } as Partial<StoreState> as StoreState;

const NOOP_AI_SDK_STORE = {
  getInitialState: () => NOOP_STATE,
  getState: () => NOOP_STATE,
  subscribe: () => () => {},
};

/**
 * Returns AI SDK chat error when inside Provider, or undefined when outside.
 * All hooks are called unconditionally to satisfy Rules of Hooks.
 */
export function useChatErrorOptional(): Error | undefined {
  // useContext (not use()) for graceful undefined when Provider is absent
  const store = use(ChatStoreContext);
  const storeToUse = store ?? NOOP_AI_SDK_STORE;

  const error = useStore(storeToUse, state => state.error);

  if (!store) {
    return undefined;
  }

  return error;
}
