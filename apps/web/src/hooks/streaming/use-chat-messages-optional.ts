/**
 * Optional Chat Messages Hook
 *
 * Safe wrapper around useChatMessages from @ai-sdk-tools/store.
 * Returns an empty array when the AI SDK store Provider is absent
 * (e.g., public thread pages), instead of throwing.
 *
 * Follows the same NOOP store pattern as useChatStoreOptional in
 * apps/web/src/components/providers/chat-store-provider/context.ts.
 *
 * @module hooks/streaming/use-chat-messages-optional
 */

import type { StoreState } from '@ai-sdk-tools/store';
import { ChatStoreContext } from '@ai-sdk-tools/store';
import type { UIMessage } from 'ai';
import { use, useRef } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/shallow';

const EMPTY_MESSAGES: UIMessage[] = [];

/**
 * NOOP store shim for when the AI SDK Provider is absent (public pages).
 * Typed to satisfy useStore's ReadonlyStoreApi<StoreState> constraint
 * so the selector parameter infers as StoreState instead of `any`.
 *
 * The getState/getInitialState return partial objects cast to StoreState.
 * This is safe because the NOOP path returns early (hasStore check)
 * before the selector result is consumed by the component.
 */
const NOOP_STATE = { getThrottledMessages: () => EMPTY_MESSAGES } as Partial<StoreState> as StoreState;

const NOOP_AI_SDK_STORE = {
  getInitialState: () => NOOP_STATE,
  getState: () => NOOP_STATE,
  subscribe: () => () => {},
};

/**
 * Returns AI SDK chat messages when inside Provider, or [] when outside.
 * All hooks are called unconditionally to satisfy Rules of Hooks.
 */
export function useChatMessagesOptional(): UIMessage[] {
  // useContext (not use()) for graceful undefined when Provider is absent
  const store = use(ChatStoreContext);
  const storeToUse = store ?? NOOP_AI_SDK_STORE;
  const hasStore = useRef(!!store);

  const messages = useStore(
    storeToUse,
    useShallow(state => state.getThrottledMessages()),
  );

  if (!hasStore.current) {
    return EMPTY_MESSAGES;
  }

  return messages;
}
