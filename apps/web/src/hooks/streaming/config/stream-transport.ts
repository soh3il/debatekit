/**
 * Stream Transport Configuration
 *
 * Extracts transport construction and chat configuration memos from
 * use-debatekit-chat.ts. The transport is STABLE per thread --
 * only recreated when threadId changes. Round-specific endpoint is
 * resolved dynamically from apiEndpointRef inside callbacks.
 *
 * @module hooks/streaming/config/stream-transport
 */

import { DefaultChatTransport } from 'ai';
import type { MutableRefObject } from 'react';
import { useLayoutEffect, useMemo, useRef } from 'react';

// TYPES

type StreamTransportOptions = {
  threadId: string;
  roundNumber: number;
  attachmentIdsRef: MutableRefObject<string[] | null | undefined>;
};

// HOOK

export function useStreamTransport(options: StreamTransportOptions) {
  const { attachmentIdsRef, roundNumber, threadId } = options;

  // Build API endpoint - guard against empty threadId to prevent double-slash URLs
  // When threadId is empty/undefined, return null to signal that streaming should be disabled
  // NOTE: apiEndpoint changes when roundNumber changes, but transport uses apiEndpointRef
  // to avoid recreating the transport object (which would cause Chat recreation).
  const apiEndpoint = useMemo(() => {
    if (!threadId) {
      return null;
    }
    return `/api/v1/chat/threads/${threadId}/rounds/${roundNumber}/unified-stream`;
  }, [threadId, roundNumber]);

  // Ref for apiEndpoint - accessible in transport callback
  // CRITICAL: Initialize with computed value (not null) to ensure correct endpoint
  // is available from the very first render. This prevents a race condition where
  // AI SDK's resume check reads null and falls back to baseApi (round 0).
  const apiEndpointRef = useRef<string | null>(
    threadId
      ? `/api/v1/chat/threads/${threadId}/rounds/${roundNumber}/unified-stream`
      : null,
  );

  // Keep apiEndpointRef in sync with apiEndpoint for transport callbacks
  // CRITICAL: Use useLayoutEffect to update BEFORE AI SDK's resume GET fires
  // If we use useEffect, the ref update happens AFTER mount, but AI SDK's resume
  // triggers ON mount. The transport's prepareReconnectToStreamRequest would use
  // stale apiEndpointRef (null or previous value) and fall back to baseApi (round 0).
  useLayoutEffect(() => {
    apiEndpointRef.current = apiEndpoint;
  }, [apiEndpoint]);

  // Build chat ID for useChat
  // CRITICAL: Use threadId ONLY to prevent Chat recreation when roundNumber changes.
  // When roundNumber changes (e.g., r0 -> r1), changing chatId causes AI SDK to
  // recreate the Chat instance. If sendMessage is called during recreation,
  // it throws "Cannot read properties of undefined (reading 'state')".
  //
  // The API endpoint already includes roundNumber, so backend routes correctly.
  // Using stable chatId per thread prevents the recreation race condition.
  const chatId = useMemo(
    () => `unified_${threadId}`,
    [threadId],
  );

  // Build transport for API endpoint with custom request transformation
  // AI SDK sends { messages: [...] } but our backend expects { message: {...} }
  // Also configures stream resumption endpoint per AI SDK v6 pattern
  // When apiEndpoint is null (no threadId), transport is undefined to disable useChat
  //
  // CRITICAL FIX: Transport is now STABLE and only recreated when threadId changes.
  // The transport callbacks use apiEndpointRef.current to get the current endpoint,
  // which includes the current roundNumber. This prevents Chat instance recreation
  // when roundNumber changes, fixing the "Cannot read properties of undefined (reading 'state')" error.
  const transport = useMemo(() => {
    // Only create transport when we have a valid threadId
    if (!threadId) {
      return undefined;
    }
    // Use a base API pattern for initial transport creation
    // The actual endpoint with roundNumber is read from apiEndpointRef in callbacks
    const baseApi = `/api/v1/chat/threads/${threadId}/rounds/0/unified-stream`;
    return new DefaultChatTransport({
      api: baseApi, // Initial API - overridden by callbacks
      // AI SDK v6 resume pattern: Configure the GET endpoint for stream resumption
      // When resume: true, AI SDK calls this endpoint on mount to check for active streams.
      // No lastSequence param -- backend is the sole source of truth for stream position.
      // Dedup is handled natively by AI SDK: AbstractChat.makeRequest replaces the
      // last assistant message by ID (replaceMessage) rather than appending, so
      // replayed SSE content rebuilds the message from scratch without duplication.
      prepareReconnectToStreamRequest: ({ id: _chatId }) => ({
        api: apiEndpointRef.current || baseApi,
        credentials: 'include',
      }),
      // AI SDK v6 pattern: Pass message object directly - SDK already validates format
      // Include attachmentIds from ref for file upload support
      prepareSendMessagesRequest: ({ id, messages }) => ({
        api: apiEndpointRef.current || baseApi, // Use current endpoint from ref
        body: {
          attachmentIds: attachmentIdsRef.current ?? undefined,
          id,
          message: messages[messages.length - 1],
        },
      }),
    });
  }, [threadId]); // Only depend on threadId, NOT apiEndpoint/roundNumber

  return { apiEndpoint, apiEndpointRef, chatId, transport };
}
