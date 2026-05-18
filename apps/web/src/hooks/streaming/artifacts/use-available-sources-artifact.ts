/**
 * Available Sources Artifact Hook
 *
 * Reads citation source data directly from AI SDK message parts.
 * Uses useChatMessages() from @ai-sdk-tools/store to access
 * data-artifact-available-sources parts.
 *
 * @module hooks/streaming/artifacts/use-available-sources-artifact
 */

import type { ArtifactStatus, AvailableSourceData } from '@debatekit/shared';
import { useMemo } from 'react';

import { useChatMessagesOptional } from '@/hooks/streaming/use-chat-messages-optional';

type AvailableSourcesPayload = {
  sources: AvailableSourceData[];
  timestamp: string;
};

type AvailableSourcesEnvelope = {
  createdAt: number;
  id: string;
  payload: AvailableSourcesPayload;
  status: ArtifactStatus;
  type: string;
  updatedAt: number;
  version: number;
};

function isAvailableSourcesArtifactPart(part: { type: string }): part is { type: string; data: AvailableSourcesEnvelope } {
  return part.type === 'data-artifact-available-sources' && 'data' in part;
}

export function useAvailableSourcesArtifact() {
  const messages = useChatMessagesOptional();

  return useMemo(() => {
    let latest: AvailableSourcesEnvelope | null = null;

    for (const message of messages) {
      if (!message.parts || !Array.isArray(message.parts)) {
        continue;
      }
      for (const part of message.parts) {
        if (isAvailableSourcesArtifactPart(part)) {
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

    return {
      sources: latest?.payload?.sources ?? [],
      status: (latest?.status ?? 'idle') as ArtifactStatus,
    };
  }, [messages]);
}
