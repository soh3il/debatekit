/**
 * Presearch Artifact Hook
 *
 * Reads presearch streaming data directly from AI SDK message parts.
 * Uses useChatMessages() from @ai-sdk-tools/store to access data-artifact-presearch
 * parts that the backend writes via @ai-sdk-tools/artifacts.
 *
 * Bypasses useArtifact() due to reactivity issues with its internal useState/useEffect
 * pattern — useChatMessages() is proven reliable in this codebase (ChatView.tsx).
 *
 * @module hooks/streaming/artifacts/use-presearch-artifact
 */

import type { ArtifactStatus, PresearchQueryData, PresearchResultData } from '@debatekit/shared';
import { useMemo } from 'react';

import { useChatMessagesOptional } from '@/hooks/streaming/use-chat-messages-optional';

type PresearchArtifactPayload = {
  queries: PresearchQueryData[];
  results: PresearchResultData[];
  summary: string;
  totalResults: number;
};

type PresearchArtifactEnvelope = {
  createdAt: number;
  id: string;
  payload: PresearchArtifactPayload;
  progress?: number;
  status: ArtifactStatus;
  type: string;
  updatedAt: number;
  version: number;
};

function isPresearchArtifactPart(part: { type: string }): part is { type: string; data: PresearchArtifactEnvelope; id: string } {
  return part.type === 'data-artifact-presearch' && 'data' in part;
}

export function usePresearchArtifact() {
  const messages = useChatMessagesOptional();

  return useMemo(() => {
    // Scan message parts for the latest presearch artifact (highest version)
    let latest: PresearchArtifactEnvelope | null = null;

    for (const message of messages) {
      if (!message.parts || !Array.isArray(message.parts)) {
        continue;
      }
      for (const part of message.parts) {
        if (isPresearchArtifactPart(part)) {
          const envelope = part.data;
          if (!envelope) {
            continue;
          }
          if (
            !latest
            || envelope.version > latest.version
            || (envelope.version === latest.version && envelope.createdAt > latest.createdAt)
          ) {
            latest = envelope;
          }
        }
      }
    }

    if (!latest) {
      return {
        isActive: false,
        progress: undefined as number | undefined,
        queries: [] as PresearchQueryData[],
        results: [] as PresearchResultData[],
        status: 'idle' as ArtifactStatus,
        summary: '',
        totalResults: 0,
      };
    }

    const isActive = latest.status === 'loading' || latest.status === 'streaming';

    return {
      isActive,
      progress: latest.progress,
      queries: latest.payload?.queries ?? [],
      results: latest.payload?.results ?? [],
      status: latest.status,
      summary: latest.payload?.summary ?? '',
      totalResults: latest.payload?.totalResults ?? 0,
    };
  }, [messages]);
}
