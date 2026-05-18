/**
 * Active Stream Database Service
 *
 * Manages active stream records in the database for AI SDK resumable streams.
 * Per AI SDK docs: "Storage to track which stream belongs to each chat"
 *
 * Operations:
 * - setActiveStream: Save stream ID when starting a stream
 * - getActiveStream: Retrieve stream ID for resumption
 * - clearActiveStream: Remove stream ID when stream completes
 */

import type { EntityPhase } from '@debatekit/shared/enums';
import { EntityPhases } from '@debatekit/shared/enums';
import { generateId } from 'ai';
import { and, eq, isNull } from 'drizzle-orm';

import type { getDbAsync } from '@/db';
import { activeStream } from '@/db/tables/active-stream';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type DbClient = Awaited<ReturnType<typeof getDbAsync>>;

/** Parameters for identifying a specific entity stream */
export type EntityStreamIdentifier = {
  threadId: string;
  roundNumber: number;
  entityType: EntityPhase;
  entityIndex: number | null;
};

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Get the active stream ID for a specific entity.
 * Per AI SDK docs: "Check for active stream in DB"
 */
export async function getActiveStream(
  db: DbClient,
  { entityIndex, entityType, roundNumber, threadId }: EntityStreamIdentifier,
) {
  // Build conditions array
  const conditions = [
    eq(activeStream.threadId, threadId),
    eq(activeStream.roundNumber, roundNumber),
    eq(activeStream.entityType, entityType),
  ];

  // Handle null entityIndex (presearch/moderator) vs numeric (participant)
  if (entityIndex !== null) {
    conditions.push(eq(activeStream.entityIndex, entityIndex));
  } else {
    conditions.push(isNull(activeStream.entityIndex));
  }

  const result = await db.query.activeStream.findFirst({
    where: and(...conditions),
  });

  return result ?? null;
}

// ============================================================================
// MUTATION OPERATIONS
// ============================================================================

/**
 * Set the active stream ID for a specific entity.
 * Per AI SDK docs: "Update the chat with the active stream ID"
 *
 * Uses upsert (insert with onConflictDoUpdate) to handle race conditions.
 */
export async function setActiveStream(
  db: DbClient,
  { entityIndex, entityType, roundNumber, threadId }: EntityStreamIdentifier,
  streamId: string,
) {
  const id = generateId();
  const now = new Date().toISOString();

  await db
    .insert(activeStream)
    .values({
      createdAt: now,
      entityIndex,
      entityType,
      id,
      roundNumber,
      streamId,
      threadId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        streamId,
        updatedAt: now,
      },
      target: [
        activeStream.threadId,
        activeStream.roundNumber,
        activeStream.entityType,
        activeStream.entityIndex,
      ],
    });
}

/**
 * Clear the active stream ID for a specific entity.
 * Per AI SDK docs: "Clear the active stream when finished"
 *
 * Called in onFinish callback to clean up after stream completion.
 */
export async function clearActiveStream(
  db: DbClient,
  { entityIndex, entityType, roundNumber, threadId }: EntityStreamIdentifier,
) {
  // Build conditions array
  const conditions = [
    eq(activeStream.threadId, threadId),
    eq(activeStream.roundNumber, roundNumber),
    eq(activeStream.entityType, entityType),
  ];

  // Handle null entityIndex (presearch/moderator) vs numeric (participant)
  if (entityIndex !== null) {
    conditions.push(eq(activeStream.entityIndex, entityIndex));
  } else {
    conditions.push(isNull(activeStream.entityIndex));
  }

  await db.delete(activeStream).where(and(...conditions));
}

// ============================================================================
// UNIFIED STREAM HELPERS
// ============================================================================

/**
 * Sentinel value for unified stream entityIndex.
 * SQLite unique constraints with NULL don't work for upsert (NULL != NULL),
 * so we use -1 as a sentinel value for unified streams.
 */
export const UNIFIED_ENTITY_INDEX = -1;

/**
 * Get the unified stream for a round.
 * Unified streams represent the entire round stream (all participants + moderator).
 */
export async function getUnifiedStream(
  db: DbClient,
  threadId: string,
  roundNumber: number,
) {
  return getActiveStream(db, {
    entityIndex: UNIFIED_ENTITY_INDEX,
    entityType: EntityPhases.UNIFIED,
    roundNumber,
    threadId,
  });
}
