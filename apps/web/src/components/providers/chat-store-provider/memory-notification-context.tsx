/**
 * Memory Notification Context
 *
 * Surfaces memory auto-extraction results to the chat UI.
 * When the provider detects a successful extraction, it sets notification state
 * that the chat message list reads via this context to render inline feedback.
 */

import { createContext, use } from 'react';

export type MemoryNotification = {
  previousContent: string | null;
  summary: string;
};

export type MemoryNotificationContextValue = {
  dismiss: () => void;
  notification: MemoryNotification | null;
  undo: () => void;
};

export const MemoryNotificationContext = createContext<MemoryNotificationContextValue>({
  dismiss: () => {},
  notification: null,
  undo: () => {},
});

/**
 * Hook to access memory notification state.
 * Returns default noop values when used outside the provider (e.g., public pages).
 */
export function useMemoryNotification() {
  return use(MemoryNotificationContext);
}
