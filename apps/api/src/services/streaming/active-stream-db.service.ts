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
import { and, eq, isNull, sql } from 'drizzle-orm';

import { STREAMING_CONFIG } from '@/core/config';
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
 * Atomically claim the active stream for a specific entity (compare-and-set).
 *
 * Unlike {@link setActiveStream} (which unconditionally upserts and lets the
 * LAST writer win), this only succeeds when there is NO live active stream for
 * the thread/round/entity. The claim succeeds when:
 *   1. No row exists yet (fresh INSERT), OR
 *   2. The existing row is STALE — its `updatedAt` is older than
 *      STREAMING_CONFIG.STALE_CHUNK_TIMEOUT_MS (the previous owner died / hung), OR
 *   3. The existing row is already owned by this same `streamId` (idempotent retry).
 *
 * If a live, different stream already owns the slot, the conflict update's
 * WHERE evaluates false → no row is written → `.returning()` is empty → we
 * return `false`. This is the atomic guard that stops two concurrent workers
 * from both believing they own the round.
 *
 * D1-safe: single conditional upsert (no db.transaction()). `updatedAt` is
 * always written as an ISO-8601 string, which sorts chronologically, so the
 * lexicographic `<` comparison against the cutoff is a valid time comparison.
 *
 * @returns `true` if the claim was acquired, `false` if a live stream owns it.
 */
export async function tryClaimActiveStream(
  db: DbClient,
  { entityIndex, entityType, roundNumber, threadId }: EntityStreamIdentifier,
  streamId: string,
) {
  const id = generateId();
  const now = new Date().toISOString();
  const staleCutoff = new Date(
    Date.now() - STREAMING_CONFIG.STALE_CHUNK_TIMEOUT_MS,
  ).toISOString();

  const claimed = await db
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
      // CAS guard: only take over a conflicting row when the current owner is
      // stale OR when we already own it (idempotent re-claim).
      setWhere: sql`(${activeStream.updatedAt} < ${staleCutoff}) or (${activeStream.streamId} = ${streamId})`,
      target: [
        activeStream.threadId,
        activeStream.roundNumber,
        activeStream.entityType,
        activeStream.entityIndex,
      ],
    })
    .returning();

  return claimed.length > 0;
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
