/**
 * Streaming Hooks
 *
 * Hooks for managing SSE streams in the frontend using AI SDK v6 patterns.
 */

// DebateKit chat hook (replacement for use-unified-round-stream)
export type {
  UseDebateKitChatOptions,
  UseDebateKitChatReturn,
} from './use-debatekit-chat';
export { useDebateKitChat } from './use-debatekit-chat';

// Data part handler (DebateKit phase event routing)
export type { DataPart } from './handlers/handle-data-part';
export { createDataPartHandler, isDataPart } from './handlers/handle-data-part';
