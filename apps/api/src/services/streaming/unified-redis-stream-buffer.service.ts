/**
 * Unified Redis Stream Buffer Service - Strongly Consistent Multi-Phase Stream Buffering
 *
 * Manages Redis buffering for unified round streams that consolidate presearch,
 * participant, and moderator phases into a single connection with global sequence numbers.
 *
 * Key patterns:
 * - Chunks: `unified:{threadId}:r{roundNumber}:chunks` (Redis list via RPUSH)
 * - Metadata: `unified:{threadId}:r{roundNumber}:meta` (Redis hash via HSET)
 *
 * Benefits over KV:
 * - RPUSH: O(1) append, immediately visible to all readers
 * - LRANGE: Read chunks from index for resumption
 * - HINCRBY: Atomic globalSeq increment
 * - No 100-250ms eventual consistency delay
 *
 * @module api/services/streaming/unified-redis-stream-buffer
 */

import { ParticipantStreamStatuses, ParticipantStreamStatusSchema, StreamPhaseSchema } from '@debatekit/shared/enums';
import type {
  PhaseEvent,
  StreamPhase,
  UnifiedRoundState,
  UnifiedStreamChunk,
} from '@debatekit/shared/types';
import {
  createInitialUnifiedRoundState,
  PhaseEventSchema,
  PhaseProgressSchema,
  StreamPhases,
  UnifiedPhaseStatuses,
  UnifiedRoundStateSchema,
  UnifiedStreamChunkSchema,
} from '@debatekit/shared/types';
import { z } from 'zod';

import { getRedis } from '@/lib/redis';
import type { TypedLogger } from '@/types/logger';
import { LogHelpers } from '@/types/logger';

import type { RedisEnv } from './stream-utils';
import { getErrorMessage, logStreamError, parseChunkArray, StreamKeyBuilder } from './stream-utils';

export type { RedisEnv } from './stream-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

/** TTL for stream data (1 hour) */
const STREAM_TTL_SECONDS = 3600;

// ============================================================================
// TYPES
// ============================================================================

/** Stored metadata fields in Redis hash (all strings for Redis compatibility) */
const StoredUnifiedMetaSchema = z.object({
  activeParticipantId: z.string(), // 'null' string if null
  completedAt: z.string(), // empty string if not completed
  currentPhase: z.string(),
  errorMessage: z.string(), // empty string if no error
  globalSeq: z.string(),
  lastEventAt: z.string(), // empty string if undefined
  phaseStatuses: z.string(), // JSON stringified
  progress: z.string(), // JSON stringified or empty
  roundId: z.string(),
  roundNumber: z.string(),
  startedAt: z.string(),
  status: ParticipantStreamStatusSchema,
  threadId: z.string(),
});

type StoredUnifiedMeta = z.infer<typeof StoredUnifiedMetaSchema>;

/**
 * Parse Redis hgetall result into StoredUnifiedMeta, returns null for empty/invalid.
 * Accepts the raw hgetall return value (generic object or null) and validates with Zod.
 */
function parseStoredMeta(raw: unknown): StoredUnifiedMeta | null {
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
    return null;
  }
  const result = StoredUnifiedMetaSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Safely parse JSON and validate as PhaseProgress, returning undefined on failure */
function safeParseProgress(jsonStr: string): z.infer<typeof PhaseProgressSchema> | undefined {
  try {
    const result = PhaseProgressSchema.safeParse(JSON.parse(jsonStr));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/** Parse phaseStatuses JSON string into Record<string, string> */
const PhaseStatusesSchema = z.record(z.string(), z.string());

function parsePhaseStatuses(jsonStr: string): Record<string, string> {
  try {
    const result = PhaseStatusesSchema.safeParse(JSON.parse(jsonStr));
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

// ============================================================================
// BUFFER OPERATIONS
// ============================================================================

/**
 * Initialize a new unified stream buffer in Redis.
 *
 * Creates metadata hash with initial round state.
 * Sets TTL for automatic cleanup.
 *
 * @returns Initial UnifiedRoundState
 */
export async function initUnifiedStreamBuffer(
  threadId: string,
  roundNumber: number,
  roundId: string,
  env: RedisEnv,
  options: {
    includePresearch?: boolean;
    logger?: TypedLogger;
  } = {},
): Promise<UnifiedRoundState> {
  const { includePresearch = true, logger } = options;

  try {
    const redis = getRedis(env);
    const metadataKey = StreamKeyBuilder.redisUnifiedMeta(threadId, roundNumber);
    const chunksKey = StreamKeyBuilder.redisUnifiedChunks(threadId, roundNumber);

    // Create initial state using shared helper
    const initialState = createInitialUnifiedRoundState(roundId, threadId, includePresearch);

    // Store metadata as hash (strings for Redis compatibility)
    const storedMeta: StoredUnifiedMeta = {
      activeParticipantId: initialState.activeParticipantId ?? 'null',
      completedAt: '',
      currentPhase: initialState.currentPhase,
      errorMessage: '',
      globalSeq: '0',
      lastEventAt: initialState.lastEventAt ?? '',
      phaseStatuses: JSON.stringify(initialState.phaseStatuses),
      progress: initialState.progress ? JSON.stringify(initialState.progress) : '',
      roundId: initialState.roundId,
      roundNumber: roundNumber.toString(),
      startedAt: initialState.startedAt,
      status: ParticipantStreamStatuses.ACTIVE,
      threadId: initialState.threadId,
    };

    // Pipeline for atomic initialization
    const pipeline = redis.pipeline();
    pipeline.hset(metadataKey, storedMeta);
    pipeline.expire(metadataKey, STREAM_TTL_SECONDS);
    pipeline.expire(chunksKey, STREAM_TTL_SECONDS);
    await pipeline.exec();

    logger?.info('Initialized unified stream buffer', LogHelpers.operation({
      operationName: 'initUnifiedStreamBuffer',
      roundNumber,
      threadId,
    }));

    return initialState;
  } catch (error) {
    logger?.error('Failed to initialize unified stream buffer', LogHelpers.operation({
      error: getErrorMessage(error),
      operationName: 'initUnifiedStreamBuffer',
      roundNumber,
      threadId,
    }));
    throw error;
  }
}

/**
 * Append a chunk to the unified stream buffer.
 *
 * Uses RPUSH for O(1) strongly consistent append.
 * Chunk is immediately visible to all readers.
 * Atomically increments globalSeq and returns it.
 *
 * @returns The globalSeq assigned to this chunk
 */
export async function appendUnifiedChunk(
  threadId: string,
  roundNumber: number,
  chunk: UnifiedStreamChunk,
  env: RedisEnv,
  logger?: TypedLogger,
): Promise<number> {
  try {
    const redis = getRedis(env);
    const chunksKey = StreamKeyBuilder.redisUnifiedChunks(threadId, roundNumber);
    const metadataKey = StreamKeyBuilder.redisUnifiedMeta(threadId, roundNumber);

    // Validate chunk against schema
    const parseResult = UnifiedStreamChunkSchema.safeParse(chunk);
    if (!parseResult.success) {
      logger?.warn('Invalid unified chunk schema', LogHelpers.operation({
        error: parseResult.error.message,
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
      return -1;
    }

    // Pipeline: RPUSH chunk, increment globalSeq, update lastEventAt
    const pipeline = redis.pipeline();
    pipeline.rpush(chunksKey, JSON.stringify(parseResult.data));
    pipeline.hincrby(metadataKey, 'globalSeq', 1);
    pipeline.hset(metadataKey, { lastEventAt: new Date().toISOString() });

    const results = await pipeline.exec();
    const seqResult = z.coerce.number().safeParse(results[1]);
    if (!seqResult.success) {
      logger?.warn('Invalid globalSeq from Redis HINCRBY', LogHelpers.operation({
        error: seqResult.error.message,
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
      return -1;
    }
    const newGlobalSeq = seqResult.data - 1; // hincrby returns new value, seq is 0-indexed

    // TTL refresh every 50 chunks
    if (newGlobalSeq % 50 === 0) {
      const ttlPipeline = redis.pipeline();
      ttlPipeline.expire(chunksKey, STREAM_TTL_SECONDS);
      ttlPipeline.expire(metadataKey, STREAM_TTL_SECONDS);
      await ttlPipeline.exec();
    }

    return newGlobalSeq;
  } catch (error) {
    logger?.warn('Failed to append unified chunk', LogHelpers.operation({
      error: getErrorMessage(error),
      operationName: 'appendUnifiedChunk',
      threadId,
    }));
    return -1;
  }
}

/**
 * Emit a phase transition event and update metadata.
 *
 * Appends phase event to chunks and updates currentPhase/phaseStatuses in metadata.
 *
 * @returns The globalSeq assigned to the phase event
 */
export async function emitPhaseTransition(
  threadId: string,
  roundNumber: number,
  phaseEvent: PhaseEvent,
  env: RedisEnv,
  logger?: TypedLogger,
): Promise<number> {
  try {
    const redis = getRedis(env);
    const metadataKey = StreamKeyBuilder.redisUnifiedMeta(threadId, roundNumber);

    // Validate phase event
    const parseResult = PhaseEventSchema.safeParse(phaseEvent);
    if (!parseResult.success) {
      logger?.warn('Invalid phase event schema', LogHelpers.operation({
        error: parseResult.error.message,
        operationName: 'emitPhaseTransition',
        threadId,
      }));
      return -1;
    }

    // Get current metadata to update phaseStatuses
    const currentMeta = parseStoredMeta(await redis.hgetall(metadataKey));
    if (!currentMeta) {
      logger?.warn('Unified stream metadata not found', LogHelpers.operation({
        operationName: 'emitPhaseTransition',
        roundNumber,
        threadId,
      }));
      return -1;
    }

    // Parse current phaseStatuses
    const phaseStatuses = parsePhaseStatuses(currentMeta.phaseStatuses);

    // Map PhaseEvent status to the phase key
    const phaseKey = parseResult.data.phase;
    phaseStatuses[phaseKey] = parseResult.data.status;

    // Determine chunk type based on status
    let chunkType: 'phase-start' | 'phase-complete' | 'phase-error';
    if (parseResult.data.status === UnifiedPhaseStatuses.ACTIVE) {
      chunkType = 'phase-start';
    } else if (parseResult.data.status === UnifiedPhaseStatuses.COMPLETE) {
      chunkType = 'phase-complete';
    } else if (parseResult.data.status === UnifiedPhaseStatuses.ERROR) {
      chunkType = 'phase-error';
    } else {
      // For pending/skipped, use phase-start as placeholder
      chunkType = 'phase-start';
    }

    // Create the stream chunk for phase transition
    const phaseChunk: UnifiedStreamChunk = chunkType === 'phase-error'
      ? {
          error: parseResult.data.error ?? 'Unknown error',
          participantId: parseResult.data.participantId,
          phase: parseResult.data.phase,
          timestamp: parseResult.data.timestamp,
          type: 'phase-error',
        }
      : chunkType === 'phase-complete'
        ? {
            participantId: parseResult.data.participantId,
            phase: parseResult.data.phase,
            timestamp: parseResult.data.timestamp,
            type: 'phase-complete',
          }
        : {
            participantId: parseResult.data.participantId,
            participantIndex: parseResult.data.participantIndex,
            phase: parseResult.data.phase,
            timestamp: parseResult.data.timestamp,
            totalParticipants: parseResult.data.totalParticipants,
            type: 'phase-start',
          };

    // Append phase chunk and update metadata
    const seq = await appendUnifiedChunk(threadId, roundNumber, phaseChunk, env, logger);

    // Update metadata with new phase status and current phase
    await redis.hset(metadataKey, {
      currentPhase: parseResult.data.phase,
      phaseStatuses: JSON.stringify(phaseStatuses),
    });

    logger?.info('Emitted phase transition', LogHelpers.operation({
      operationName: 'emitPhaseTransition',
      roundNumber,
      status: parseResult.data.status,
      threadId,
    }));

    return seq;
  } catch (error) {
    logger?.error('Failed to emit phase transition', LogHelpers.operation({
      error: getErrorMessage(error),
      operationName: 'emitPhaseTransition',
      threadId,
    }));
    return -1;
  }
}

/**
 * Get chunks from a specific sequence number for resumption.
 *
 * Uses LRANGE for efficient range queries.
 * Returns parsed chunks starting from `fromSeq` to end of list.
 *
 * @returns Array of validated UnifiedStreamChunk objects
 */
export async function getUnifiedChunksFromSeq(
  threadId: string,
  roundNumber: number,
  fromSeq: number,
  env: RedisEnv,
  logger?: TypedLogger,
): Promise<UnifiedStreamChunk[]> {
  try {
    const redis = getRedis(env);
    const chunksKey = StreamKeyBuilder.redisUnifiedChunks(threadId, roundNumber);

    // LRANGE fromSeq -1 gets all chunks from index to end
    const rawChunks = await redis.lrange(chunksKey, fromSeq, -1);

    return parseChunkArray(rawChunks, UnifiedStreamChunkSchema, logger);
  } catch (error) {
    logStreamError(logger, 'error', 'Failed to get unified chunks', 'getUnifiedChunksFromSeq', error, { threadId });
    return [];
  }
}

/**
 * Get current unified round state from Redis.
 *
 * Parses stored metadata hash into UnifiedRoundState.
 *
 * @returns Validated UnifiedRoundState or null if not found
 */
export async function getUnifiedRoundState(
  threadId: string,
  roundNumber: number,
  env: RedisEnv,
  logger?: TypedLogger,
): Promise<UnifiedRoundState | null> {
  try {
    const redis = getRedis(env);
    const metadataKey = StreamKeyBuilder.redisUnifiedMeta(threadId, roundNumber);

    const data = parseStoredMeta(await redis.hgetall(metadataKey));

    if (!data) {
      return null;
    }

    // Reconstruct UnifiedRoundState from stored hash
    const phaseResult = StreamPhaseSchema.safeParse(data.currentPhase);
    const reconstructed = {
      activeParticipantId: data.activeParticipantId === 'null' ? null : data.activeParticipantId,
      currentPhase: phaseResult.success ? phaseResult.data : StreamPhases.PARTICIPANT,
      lastEventAt: data.lastEventAt || undefined,
      phaseStatuses: parsePhaseStatuses(data.phaseStatuses),
      progress: data.progress ? safeParseProgress(data.progress) : undefined,
      roundId: data.roundId,
      startedAt: data.startedAt,
      threadId: data.threadId,
    };

    const result = UnifiedRoundStateSchema.safeParse(reconstructed);
    if (!result.success) {
      logger?.warn('Invalid unified round state in Redis', LogHelpers.operation({
        error: result.error.message,
        operationName: 'getUnifiedRoundState',
        threadId,
      }));
      return null;
    }

    return result.data;
  } catch (error) {
    logger?.error('Failed to get unified round state', LogHelpers.operation({
      error: getErrorMessage(error),
      operationName: 'getUnifiedRoundState',
      threadId,
    }));
    return null;
  }
}

/**
 * Mark unified stream as completed.
 *
 * Updates metadata status to 'completed' and sets completedAt timestamp.
 * Emits round-complete event if roundId is available.
 *
 * @returns The globalSeq of the round-complete event, or -1 on failure
 */
export async function completeUnifiedStream(
  threadId: string,
  roundNumber: number,
  env: RedisEnv,
  logger?: TypedLogger,
): Promise<number> {
  try {
    const redis = getRedis(env);
    const metadataKey = StreamKeyBuilder.redisUnifiedMeta(threadId, roundNumber);

    // Get current metadata for roundId
    const currentMeta = parseStoredMeta(await redis.hgetall(metadataKey));
    if (!currentMeta) {
      logger?.warn('Unified stream metadata not found during completion', LogHelpers.operation({
        operationName: 'completeUnifiedStream',
        roundNumber,
        threadId,
      }));
      return -1;
    }

    const phaseStatuses = parsePhaseStatuses(currentMeta.phaseStatuses);

    // Determine completed phases
    const completedPhases: StreamPhase[] = [];
    if (phaseStatuses[StreamPhases.PRESEARCH] === UnifiedPhaseStatuses.COMPLETE) {
      completedPhases.push(StreamPhases.PRESEARCH);
    }
    if (phaseStatuses[StreamPhases.PARTICIPANT] === UnifiedPhaseStatuses.COMPLETE) {
      completedPhases.push(StreamPhases.PARTICIPANT);
    }
    if (phaseStatuses[StreamPhases.MODERATOR] === UnifiedPhaseStatuses.COMPLETE) {
      completedPhases.push(StreamPhases.MODERATOR);
    }

    // Emit round-complete chunk
    const roundCompleteChunk: UnifiedStreamChunk = {
      completedPhases,
      roundId: currentMeta.roundId,
      timestamp: new Date().toISOString(),
      type: 'round-complete',
    };

    const seq = await appendUnifiedChunk(threadId, roundNumber, roundCompleteChunk, env, logger);

    // Update metadata status
    await redis.hset(metadataKey, {
      completedAt: new Date().toISOString(),
      status: ParticipantStreamStatuses.COMPLETED,
    });

    logger?.info('Completed unified stream', LogHelpers.operation({
      operationName: 'completeUnifiedStream',
      roundNumber,
      threadId,
    }));

    return seq;
  } catch (error) {
    logger?.error('Failed to complete unified stream', LogHelpers.operation({
      error: getErrorMessage(error),
      operationName: 'completeUnifiedStream',
      threadId,
    }));
    return -1;
  }
}

/**
 * Mark unified stream as failed.
 *
 * Updates metadata status to 'failed' and stores error message.
 * Emits phase-error event for current phase.
 *
 * @returns The globalSeq of the error event, or -1 on failure
 */
export async function failUnifiedStream(
  threadId: string,
  roundNumber: number,
  errorMessage: string,
  env: RedisEnv,
  logger?: TypedLogger,
): Promise<number> {
  try {
    const redis = getRedis(env);
    const metadataKey = StreamKeyBuilder.redisUnifiedMeta(threadId, roundNumber);

    // Get current metadata for current phase
    const currentMeta = parseStoredMeta(await redis.hgetall(metadataKey));
    const phaseResult = StreamPhaseSchema.safeParse(currentMeta?.currentPhase);
    const currentPhase: StreamPhase = phaseResult.success ? phaseResult.data : StreamPhases.PARTICIPANT;

    // Emit phase-error chunk
    const errorChunk: UnifiedStreamChunk = {
      error: errorMessage,
      phase: currentPhase,
      timestamp: new Date().toISOString(),
      type: 'phase-error',
    };

    const seq = await appendUnifiedChunk(threadId, roundNumber, errorChunk, env, logger);

    // Update metadata status
    await redis.hset(metadataKey, {
      completedAt: new Date().toISOString(),
      errorMessage,
      status: ParticipantStreamStatuses.FAILED,
    });

    // Update phase status to error
    if (currentMeta) {
      const phaseStatuses = parsePhaseStatuses(currentMeta.phaseStatuses);
      phaseStatuses[currentPhase] = UnifiedPhaseStatuses.ERROR;
      await redis.hset(metadataKey, {
        phaseStatuses: JSON.stringify(phaseStatuses),
      });
    }

    logger?.info('Failed unified stream', LogHelpers.operation({
      errorMessage,
      operationName: 'failUnifiedStream',
      roundNumber,
      threadId,
    }));

    return seq;
  } catch (error) {
    logger?.error('Failed to mark unified stream as failed', LogHelpers.operation({
      error: getErrorMessage(error),
      operationName: 'failUnifiedStream',
      threadId,
    }));
    return -1;
  }
}

/**
 * Get chunks and metadata in single HTTP request.
 * Optimized for polling operations.
 */
export async function getUnifiedChunksAndState(
  threadId: string,
  roundNumber: number,
  fromSeq: number,
  env: RedisEnv,
  logger?: TypedLogger,
): Promise<{ chunks: UnifiedStreamChunk[]; state: UnifiedRoundState | null }> {
  try {
    const redis = getRedis(env);
    const chunksKey = StreamKeyBuilder.redisUnifiedChunks(threadId, roundNumber);
    const metadataKey = StreamKeyBuilder.redisUnifiedMeta(threadId, roundNumber);

    // Pipeline: fetch both in single HTTP request
    const pipeline = redis.pipeline();
    pipeline.lrange(chunksKey, fromSeq, -1);
    pipeline.hgetall(metadataKey);

    const results = await pipeline.exec();
    const rawChunks: string[] = Array.isArray(results[0])
      ? results[0].map(item => String(item))
      : [];
    const metaData = parseStoredMeta(results[1]);

    // Parse chunks using shared utility
    const chunks = parseChunkArray(rawChunks, UnifiedStreamChunkSchema, logger);

    // Parse state
    let state: UnifiedRoundState | null = null;
    if (metaData) {
      const phaseResult = StreamPhaseSchema.safeParse(metaData.currentPhase);
      const reconstructed = {
        activeParticipantId: metaData.activeParticipantId === 'null' ? null : metaData.activeParticipantId,
        currentPhase: phaseResult.success ? phaseResult.data : StreamPhases.PARTICIPANT,
        lastEventAt: metaData.lastEventAt || undefined,
        phaseStatuses: parsePhaseStatuses(metaData.phaseStatuses),
        progress: metaData.progress ? JSON.parse(metaData.progress) : undefined,
        roundId: metaData.roundId,
        startedAt: metaData.startedAt,
        threadId: metaData.threadId,
      };

      const result = UnifiedRoundStateSchema.safeParse(reconstructed);
      if (result.success) {
        state = result.data;
      }
    }

    return { chunks, state };
  } catch (error) {
    logger?.error('Failed to get unified chunks and state', LogHelpers.operation({
      error: getErrorMessage(error),
      operationName: 'getUnifiedChunksAndState',
      threadId,
    }));
    return { chunks: [], state: null };
  }
}
