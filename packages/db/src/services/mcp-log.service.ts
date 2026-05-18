/**
 * MCP Log Service
 *
 * Drizzle ORM replacement for raw D1 SQL in apps/mcp/src/engine/logger.ts.
 * INSERT and filtered paginated queries against the mcpLog table.
 */

import type { McpLogLevel } from '@debatekit/shared/enums';
import { McpLogLevelSchema } from '@debatekit/shared/enums';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import * as z from 'zod';

import type { DbInstance } from '../factory';
import { mcpLog } from '../tables/mcp';

// ============================================================================
// Schemas & Types
// ============================================================================

const LogEventDataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

const _LogEventParamsSchema = z.object({
  data: LogEventDataSchema.optional(),
  event: z.string(),
  level: McpLogLevelSchema.optional(),
  sessionId: z.string().optional(),
  userId: z.string(),
});

export type LogEventParams = z.infer<typeof _LogEventParamsSchema>;

type QueryLogsOptions = {
  endTime?: number;
  event?: string;
  level?: McpLogLevel;
  limit?: number;
  offset?: number;
  sessionId?: string;
  startTime?: number;
};

// ============================================================================
// Log Event
// ============================================================================

export async function logEvent(db: DbInstance, params: LogEventParams) {
  const id = crypto.randomUUID();
  const now = new Date(Date.now());

  await db.insert(mcpLog).values({
    createdAt: now,
    dataJson: params.data ? JSON.stringify(params.data) : null,
    event: params.event,
    id,
    level: params.level ?? 'info',
    sessionId: params.sessionId ?? null,
    userId: params.userId,
  });

  return id;
}

// ============================================================================
// Query Logs
// ============================================================================

export async function queryLogs(db: DbInstance, userId: string, opts: QueryLogsOptions = {}) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const conditions = [eq(mcpLog.userId, userId)];

  if (opts.sessionId) {
    conditions.push(eq(mcpLog.sessionId, opts.sessionId));
  }

  if (opts.level) {
    conditions.push(eq(mcpLog.level, opts.level));
  }

  if (opts.event) {
    conditions.push(eq(mcpLog.event, opts.event));
  }

  if (opts.startTime) {
    conditions.push(gte(mcpLog.createdAt, new Date(opts.startTime)));
  }

  if (opts.endTime) {
    conditions.push(lte(mcpLog.createdAt, new Date(opts.endTime)));
  }

  return db
    .select()
    .from(mcpLog)
    .where(and(...conditions))
    .orderBy(desc(mcpLog.createdAt))
    .limit(limit)
    .offset(offset);
}
