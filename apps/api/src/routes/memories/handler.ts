/**
 * Project Memory Route Handlers
 *
 * Handlers for viewing and deleting project-scoped working memory.
 */

import type { RouteHandler } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';

import { invalidateProjectCache } from '@/common/cache-utils';
import { createHandler, IdParamSchema, Responses } from '@/core';
import { getDbAsync } from '@/db';
import { workingMemory } from '@/db/tables/working-memory';
import { verifyProjectOwnership } from '@/shared-operations';
import type { ApiEnv } from '@/types';

import type { deleteProjectMemoryRoute, extractProjectMemoryRoute, getProjectMemoryRoute, restoreProjectMemoryRoute } from './route';
import { ExtractMemoryRequestSchema, RestoreMemoryRequestSchema } from './schema';

// ============================================================================
// Get Project Memory
// ============================================================================

export const getProjectMemoryHandler: RouteHandler<
  typeof getProjectMemoryRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session',
    operationName: 'getProjectMemory',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: projectId } = c.validated.params;

    const db = await getDbAsync();
    await verifyProjectOwnership(projectId, user.id, db);

    const compoundId = `chat:${projectId}`;
    const rows = await db
      .select()
      .from(workingMemory)
      .where(eq(workingMemory.id, compoundId))
      .limit(1);

    const row = rows[0];

    return Responses.ok(c, {
      content: row?.content ?? null,
      id: row?.id ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    });
  },
);

// ============================================================================
// Delete Project Memory
// ============================================================================

export const deleteProjectMemoryHandler: RouteHandler<
  typeof deleteProjectMemoryRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session',
    operationName: 'deleteProjectMemory',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: projectId } = c.validated.params;

    const db = await getDbAsync();
    await verifyProjectOwnership(projectId, user.id, db);

    const compoundId = `chat:${projectId}`;
    await db.delete(workingMemory)
      .where(eq(workingMemory.id, compoundId));

    await invalidateProjectCache(db, projectId);

    return Responses.ok(c, { success: true });
  },
);

// ============================================================================
// Extract Memory
// ============================================================================

export const extractProjectMemoryHandler: RouteHandler<
  typeof extractProjectMemoryRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session',
    operationName: 'extractProjectMemory',
    validateBody: ExtractMemoryRequestSchema,
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: projectId } = c.validated.params;
    const { userMessage } = c.validated.body;

    const db = await getDbAsync();
    await verifyProjectOwnership(projectId, user.id, db);

    const { createMemoryProvider, extractMemoryFromPrompt } = await import('@/services/memory');
    const provider = createMemoryProvider(db);

    // Load existing memory
    const existing = await provider.getWorkingMemory({ chatId: projectId, scope: 'chat' });
    const existingContent = existing?.content ?? null;

    const result = await extractMemoryFromPrompt({
      existingMemory: existingContent,
      projectId,
      provider,
      userMessage,
    });

    if (result.extracted) {
      await invalidateProjectCache(db, projectId);
    }

    return Responses.ok(c, result);
  },
);

// ============================================================================
// Restore Memory
// ============================================================================

export const restoreProjectMemoryHandler: RouteHandler<
  typeof restoreProjectMemoryRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session',
    operationName: 'restoreProjectMemory',
    validateBody: RestoreMemoryRequestSchema,
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: projectId } = c.validated.params;
    const { content } = c.validated.body;

    const db = await getDbAsync();
    await verifyProjectOwnership(projectId, user.id, db);

    if (content === null) {
      // Delete memory entirely
      await db.delete(workingMemory)
        .where(eq(workingMemory.id, `chat:${projectId}`));
    } else {
      // Restore to specific content
      const { createMemoryProvider } = await import('@/services/memory');
      const provider = createMemoryProvider(db);
      await provider.updateWorkingMemory({
        chatId: projectId,
        content,
        scope: 'chat',
      });
    }

    await invalidateProjectCache(db, projectId);

    return Responses.ok(c, { success: true });
  },
);
