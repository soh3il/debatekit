/**
 * Thread Query Service
 *
 * Drizzle ORM replacement for raw D1 SQL in:
 * - apps/mcp/src/tools/get-thread-link.ts
 * - apps/mcp/src/tools/set-thread-visibility.ts
 *
 * Session ownership verification, thread lookup by MCP session ID,
 * and thread visibility updates.
 */

import { and, eq, sql } from 'drizzle-orm';

import type { DbInstance } from '../factory';
import { chatThread } from '../tables/chat';
import { mcpSession } from '../tables/mcp';

// ============================================================================
// Verify Session Ownership
// ============================================================================

/**
 * Check that an MCP session belongs to the given user.
 *
 * @returns true if the session exists and belongs to the user
 */
export async function verifySessionOwnership(
  db: DbInstance,
  sessionId: string,
  userId: string,
) {
  const rows = await db
    .select({ id: mcpSession.id })
    .from(mcpSession)
    .where(and(eq(mcpSession.id, sessionId), eq(mcpSession.userId, userId)))
    .limit(1);

  return rows.length > 0;
}

// ============================================================================
// Find Thread by MCP Session ID
// ============================================================================

/**
 * Find the chat thread linked to an MCP session.
 *
 * Primary lookup: uses the mcpSession.threadId FK column (indexed).
 * Fallback: json_extract on chatThread.metadata.mcpSessionId for cases
 * where the fire-and-forget linkSessionToThread hasn't completed yet.
 *
 * @returns { id, slug, isPublic } or null if not found
 */
export async function findThreadByMcpSessionId(
  db: DbInstance,
  userId: string,
  sessionId: string,
) {
  // Primary: use the indexed FK column on mcpSession
  const sessionRows = await db
    .select({ threadId: mcpSession.threadId })
    .from(mcpSession)
    .where(and(eq(mcpSession.id, sessionId), eq(mcpSession.userId, userId)))
    .limit(1);

  const threadId = sessionRows[0]?.threadId;

  if (threadId) {
    const threadRows = await db
      .select({
        id: chatThread.id,
        isPublic: chatThread.isPublic,
        slug: chatThread.slug,
      })
      .from(chatThread)
      .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)))
      .limit(1);

    if (threadRows[0]) {
      return threadRows[0];
    }
  }

  // Fallback: json_extract for cases where threadId column not yet populated
  // (linkSessionToThread is fire-and-forget via waitUntil)
  const rows = await db
    .select({
      id: chatThread.id,
      isPublic: chatThread.isPublic,
      slug: chatThread.slug,
    })
    .from(chatThread)
    .where(
      and(
        eq(chatThread.userId, userId),
        sql`json_extract(${chatThread.metadata}, '$.mcpSessionId') = ${sessionId}`,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// ============================================================================
// Update Thread Visibility
// ============================================================================

/**
 * Set a thread's isPublic flag.
 *
 * Uses .returning() to determine if a row was matched and updated.
 *
 * @returns true if a row was updated, false otherwise
 */
export async function updateThreadVisibility(
  db: DbInstance,
  threadId: string,
  userId: string,
  isPublic: boolean,
) {
  const rows = await db
    .update(chatThread)
    .set({
      isPublic,
      updatedAt: new Date(),
    })
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)))
    .returning({ id: chatThread.id });

  return rows.length > 0;
}
