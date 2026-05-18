/**
 * Unified Stream Buffer Service - Cloudflare KV-based SSE stream buffering
 *
 * **BACKEND SERVICE**: Enables stream resumption after page reload for pre-search streams
 * Following backend-patterns.md: Service layer for streaming infrastructure
 *
 * **PURPOSE**:
 * - Buffer SSE events from pre-search streams into Cloudflare KV
 * - Enable resumption after page reload/connection loss
 *
 * **ARCHITECTURE**:
 * - Chunks stored as individual KV keys (O(1) memory, no array accumulation)
 * - Metadata tracks chunk count and stream status
 * - Automatic cleanup on stream completion with 1-hour TTL
 *
 * **INTEGRATION**:
 * - Called from pre-search streaming handler via callbacks
 * - Frontend resumes via GET endpoints checking KV for active streams
 *
 * @module api/services/unified-stream-buffer
 * @see /src/api/types/streaming.ts for type definitions
 */

import { StreamPhases } from '@debatekit/shared/enums';

import type { ApiEnv } from '@/types';
import type { TypedLogger } from '@/types/logger';
import { LogHelpers } from '@/types/logger';
import type {
  PreSearchStreamChunk,
  PreSearchStreamMetadata,
} from '@/types/streaming';
import {
  PreSearchStreamChunkSchema,
  PreSearchStreamMetadataSchema,
} from '@/types/streaming';

import { getErrorMessage, parseChunkArray, StreamKeyBuilder } from './stream-utils';

// ============================================================================
// PRE-SEARCH STREAM BUFFER OPERATIONS
// ============================================================================

export async function clearActivePreSearchStream(
  threadId: string,
  roundNumber: number,
  env: ApiEnv['Bindings'],
  logger?: TypedLogger,
): Promise<void> {
  if (!env?.KV) {
    return;
  }

  try {
    await env.KV.delete(StreamKeyBuilder.kvActivePreSearch(threadId, roundNumber, StreamPhases.PRESEARCH));
    logger?.debug('Cleared active pre-search stream', LogHelpers.operation({
      operationName: 'clearActivePreSearchStream',
      roundNumber,
      threadId,
    }));
  } catch (error) {
    logger?.warn('Failed to clear active pre-search stream', LogHelpers.edgeCase({
      error: getErrorMessage(error),
      roundNumber,
      scenario: 'pre_search_clear_failed',
      threadId,
    }));
  }
}

async function getPreSearchStreamMetadata(
  streamId: string,
  env: ApiEnv['Bindings'],
): Promise<PreSearchStreamMetadata | null> {
  if (!env?.KV) {
    return null;
  }

  try {
    const raw = await env.KV.get(StreamKeyBuilder.kvPreSearchMeta(streamId), 'json');
    const result = PreSearchStreamMetadataSchema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function getPreSearchStreamChunks(
  streamId: string,
  env: ApiEnv['Bindings'],
  startFromSeq = 0,
): Promise<PreSearchStreamChunk[] | null> {
  if (!env?.KV) {
    return null;
  }

  try {
    const metadata = await getPreSearchStreamMetadata(streamId, env);

    if (!metadata) {
      return null;
    }

    if (metadata.chunkCount === 0) {
      return [];
    }

    const BATCH_SIZE = 50;
    const chunks: PreSearchStreamChunk[] = [];

    for (let batchStart = startFromSeq; batchStart < metadata.chunkCount; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, metadata.chunkCount);
      const batchPromises: Promise<string | null>[] = [];

      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(env.KV.get(StreamKeyBuilder.kvPreSearchChunk(streamId, i), 'text'));
      }

      const batchResults = await Promise.all(batchPromises);
      const parsedBatch = parseChunkArray(batchResults, PreSearchStreamChunkSchema);
      chunks.push(...parsedBatch);
    }

    return chunks;
  } catch {
    return null;
  }
}
