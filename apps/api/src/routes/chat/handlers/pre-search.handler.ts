/**
 * Pre-Search Handler
 *
 * Lists pre-search results for threads. Pre-search execution is handled
 * by the queue worker and streams are read via entity-subscription endpoint.
 *
 * ✅ FOLLOWS: backend-patterns.md patterns
 * ✅ ORPHAN CLEANUP: Fire-and-forget via waitUntil (non-blocking)
 */

import { MessageStatuses } from '@debatekit/shared/enums';
import type { RouteHandler } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';

import { verifyThreadOwnership } from '@/common/permissions';
import { createHandler, IdParamSchema, Responses, STREAMING_CONFIG } from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import { hasTimestampExceededTimeout } from '@/db/utils/timestamps';
import {
  clearActivePreSearchStream,
  getPreSearchStreamChunks,
} from '@/services/streaming';
import type { ApiEnv } from '@/types';
import { generatePreSearchStreamId } from '@/types/streaming';

import type { getThreadPreSearchesRoute } from '../route';

// ============================================================================
// LIST PRE-SEARCHES HANDLER
// ============================================================================

/**
 * Get all pre-search results for a thread
 * ✅ FOLLOWS: getThreadAnalysesHandler pattern exactly
 * ✅ ORPHAN CLEANUP: Fire-and-forget via waitUntil (non-blocking)
 */
export const getThreadPreSearchesHandler: RouteHandler<typeof getThreadPreSearchesRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getThreadPreSearches',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: threadId } = c.validated.params;
    const db = await getDbAsync();

    await verifyThreadOwnership(threadId, user.id, db);

    // ✅ OPTIMIZED: Select only needed columns for faster query
    const allPreSearches = await db.query.chatPreSearch.findMany({
      columns: {
        completedAt: true,
        createdAt: true,
        errorMessage: true,
        id: true,
        roundNumber: true,
        searchData: true,
        status: true,
        threadId: true,
        userQuery: true,
      },
      orderBy: (fields, { asc }) => [asc(fields.roundNumber)],
      where: eq(tables.chatPreSearch.threadId, threadId),
    });

    // ✅ NON-BLOCKING: Fire-and-forget orphan cleanup via waitUntil
    // Don't block response - orphan cleanup happens in background
    // Next request will see updated status if cleanup was needed
    const potentialOrphans = allPreSearches.filter((search) => {
      if (search.status !== MessageStatuses.STREAMING && search.status !== MessageStatuses.PENDING) {
        return false;
      }
      return hasTimestampExceededTimeout(search.createdAt, STREAMING_CONFIG.ORPHAN_CLEANUP_TIMEOUT_MS);
    });

    if (potentialOrphans.length > 0) {
      // ✅ FIRE-AND-FORGET: Orphan cleanup runs after response is sent
      c.executionCtx.waitUntil(
        cleanupOrphanedPreSearches(potentialOrphans, threadId, db, c.env),
      );
    }

    // ✅ RETURN IMMEDIATELY: Don't wait for orphan cleanup
    // Client sees current state; any orphans will be cleaned on next request
    return Responses.ok(c, {
      count: allPreSearches.length,
      items: allPreSearches,
    });
  },
);

/**
 * Background orphan cleanup - runs via waitUntil after response is sent
 */
async function cleanupOrphanedPreSearches(
  potentialOrphans: {
    id: string;
    threadId: string;
    roundNumber: number;
    status: string;
    createdAt: Date;
  }[],
  threadId: string,
  db: Awaited<ReturnType<typeof getDbAsync>>,
  env: ApiEnv['Bindings'],
): Promise<void> {
  try {
    // Check KV for each potential orphan to confirm it's truly orphaned
    const orphanChecks = await Promise.all(
      potentialOrphans.map(async (search) => {
        const streamId = generatePreSearchStreamId(threadId, search.roundNumber);
        const chunks = await getPreSearchStreamChunks(streamId, env);

        if (chunks && chunks.length > 0) {
          const lastChunkTime = Math.max(...chunks.map(chunk => chunk.timestamp));
          const isStale = Date.now() - lastChunkTime > STREAMING_CONFIG.STALE_CHUNK_TIMEOUT_MS;
          if (!isStale) {
            return { isOrphaned: false, search };
          }
        }
        return { isOrphaned: true, search };
      }),
    );

    const orphanedSearches = orphanChecks
      .filter(check => check.isOrphaned)
      .map(check => check.search);

    if (orphanedSearches.length === 0) {
      return;
    }

    // Clean up KV and update DB in parallel
    await Promise.all([
      // Clear KV tracking
      ...orphanedSearches.map(async search =>
        await clearActivePreSearchStream(threadId, search.roundNumber, env),
      ),
      // Update DB status
      ...orphanedSearches.map(search =>
        db.update(tables.chatPreSearch)
          .set({
            errorMessage: 'Search timed out. May have been caused by page refresh or connection issue.',
            status: MessageStatuses.FAILED,
          })
          .where(eq(tables.chatPreSearch.id, search.id)),
      ),
    ]);
  } catch {
    // Silently fail - orphan cleanup is best-effort
    // Will be retried on next request
  }
}
