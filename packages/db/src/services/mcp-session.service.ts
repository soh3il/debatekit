/**
 * MCP Session Service
 *
 * Drizzle ORM replacement for raw D1 SQL in apps/mcp/src/engine/session-store.ts.
 * CRUD operations, aggregates, and context chaining for MCP tool execution sessions.
 */

import type { McpEvaluationStatus } from '@debatekit/shared/enums';
import { and, avg, count, desc, eq, gt, inArray } from 'drizzle-orm';
import * as z from 'zod';

import type { DbInstance } from '../factory';
import { mcpSession } from '../tables/mcp';

// ============================================================================
// Schemas & Types
// ============================================================================

const _SaveSessionParamsSchema = z.object({
  durationMs: z.number(),
  format: z.string(),
  inputJson: z.string(),
  mode: z.string(),
  modelIds: z.array(z.string()),
  prompt: z.string(),
  promptVersion: z.number().optional(),
  resultJson: z.string(),
  thinkingLevel: z.string(),
  toolName: z.string(),
  totalCredits: z.number(),
  userId: z.string(),
});

export type SaveSessionParams = z.infer<typeof _SaveSessionParamsSchema>;

type ListSessionsOptions = {
  limit?: number;
  offset?: number;
  toolName?: string;
};

// ============================================================================
// Save Session
// ============================================================================

export async function saveSession(db: DbInstance, params: SaveSessionParams) {
  const id = crypto.randomUUID();
  const now = new Date(Date.now());

  await db.insert(mcpSession).values({
    createdAt: now,
    durationMs: params.durationMs,
    evaluationStatus: 'pending',
    executionMode: 'sequential',
    format: params.format,
    id,
    inputJson: params.inputJson,
    mode: params.mode,
    modelIdsJson: JSON.stringify(params.modelIds),
    prompt: params.prompt,
    promptVersion: params.promptVersion ?? null,
    qualityScore: null,
    resultJson: params.resultJson,
    thinkingLevel: params.thinkingLevel,
    threadId: null,
    toolName: params.toolName,
    totalCredits: params.totalCredits,
    userId: params.userId,
  });

  return id;
}

// ============================================================================
// Get Session
// ============================================================================

export async function getSession(db: DbInstance, userId: string, sessionId: string) {
  const rows = await db
    .select()
    .from(mcpSession)
    .where(and(eq(mcpSession.id, sessionId), eq(mcpSession.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

// ============================================================================
// List Sessions
// ============================================================================

export async function listSessions(db: DbInstance, userId: string, opts: ListSessionsOptions = {}) {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  const conditions = [eq(mcpSession.userId, userId)];

  if (opts.toolName) {
    conditions.push(eq(mcpSession.toolName, opts.toolName));
  }

  return db
    .select()
    .from(mcpSession)
    .where(and(...conditions))
    .orderBy(desc(mcpSession.createdAt))
    .limit(limit)
    .offset(offset);
}

// ============================================================================
// Update Quality Score
// ============================================================================

export async function updateQualityScore(
  db: DbInstance,
  userId: string,
  sessionId: string,
  qualityScore: number,
  evaluationStatus: Exclude<McpEvaluationStatus, 'pending'>,
) {
  await db
    .update(mcpSession)
    .set({ evaluationStatus, qualityScore })
    .where(and(eq(mcpSession.id, sessionId), eq(mcpSession.userId, userId)));
}

// ============================================================================
// Average Credits by Thinking Level (last 30 days)
// ============================================================================

export async function getAvgTokensByThinkingLevel(
  db: DbInstance,
  userId: string,
  thinkingLevel: string,
) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      avgCredits: avg(mcpSession.totalCredits).mapWith(Number),
      sessionCount: count(),
    })
    .from(mcpSession)
    .where(
      and(
        eq(mcpSession.userId, userId),
        eq(mcpSession.thinkingLevel, thinkingLevel),
        gt(mcpSession.createdAt, thirtyDaysAgo),
      ),
    );

  const row = rows[0];
  if (!row || row.sessionCount === 0) {
    return null;
  }

  return {
    avgCredits: row.avgCredits,
    sessionCount: row.sessionCount,
  };
}

// ============================================================================
// Resolve Session Context (for context chaining)
// ============================================================================

export async function resolveSessionContext(
  db: DbInstance,
  userId: string,
  sessionIds: string[],
) {
  if (sessionIds.length === 0) {
    return [];
  }

  const limitedIds = sessionIds.slice(0, 3);

  return db
    .select({
      id: mcpSession.id,
      prompt: mcpSession.prompt,
      resultJson: mcpSession.resultJson,
      toolName: mcpSession.toolName,
    })
    .from(mcpSession)
    .where(
      and(
        eq(mcpSession.userId, userId),
        inArray(mcpSession.id, limitedIds),
      ),
    )
    .orderBy(desc(mcpSession.createdAt));
}

// ============================================================================
// Link Session to Thread
// ============================================================================

export async function linkSessionToThread(
  db: DbInstance,
  userId: string,
  sessionId: string,
  threadId: string,
) {
  await db
    .update(mcpSession)
    .set({ threadId })
    .where(and(eq(mcpSession.id, sessionId), eq(mcpSession.userId, userId)));
}
