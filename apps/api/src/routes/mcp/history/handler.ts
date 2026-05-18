import type { RouteHandler } from '@hono/zod-openapi';
import { desc, eq } from 'drizzle-orm';

import { createHandler, Responses } from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import type { ApiEnv } from '@/types';

import type { getMcpHistoryRoute } from './route';
import { McpHistoryQuerySchema } from './schema';

// ============================================================================
// Handler
// ============================================================================

export const getMcpHistoryHandler: RouteHandler<
  typeof getMcpHistoryRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session',
    operationName: 'getMcpHistory',
    validateQuery: McpHistoryQuerySchema,
  },
  async (c) => {
    const { user } = c.auth();
    const query = c.validated.query;
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const db = await getDbAsync();

    const whereClause = eq(tables.mcpSession.userId, user.id);

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(tables.mcpSession)
        .leftJoin(tables.chatThread, eq(tables.mcpSession.threadId, tables.chatThread.id))
        .where(whereClause)
        .orderBy(desc(tables.mcpSession.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select()
        .from(tables.mcpSession)
        .where(whereClause),
    ]);

    const total = countRows.length;

    return Responses.ok(c, {
      hasMore: offset + rows.length < total,
      items: rows.map(row => ({
        createdAt: row.mcp_session.createdAt,
        durationMs: row.mcp_session.durationMs,
        format: row.mcp_session.format,
        id: row.mcp_session.id,
        mode: row.mcp_session.mode,
        modelIds: JSON.parse(row.mcp_session.modelIdsJson) as string[],
        prompt: row.mcp_session.prompt,
        thinkingLevel: row.mcp_session.thinkingLevel,
        threadSlug: row.chat_thread?.slug ?? null,
        toolName: row.mcp_session.toolName,
        totalCredits: row.mcp_session.totalCredits,
      })),
      total,
    });
  },
);
