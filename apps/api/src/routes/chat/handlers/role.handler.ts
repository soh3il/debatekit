import type { RouteHandler } from '@hono/zod-openapi';
import { SubscriptionTiers } from '@debatekit/shared/enums';
import { and, eq } from 'drizzle-orm';
import { ulid } from 'ulid';

import { executeBatch } from '@/common/batch-operations';
import { ErrorContextBuilders } from '@/common/error-contexts';
import { createError } from '@/common/error-handling';
import { verifyCustomRoleOwnership } from '@/common/permissions';
import {
  applyCursorPagination,
  buildCursorWhereWithFilters,
  createHandler,
  createTimestampCursor,
  CursorPaginationQuerySchema,
  getCursorOrderBy,
  IdParamSchema,
  Responses,
} from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import type { ChatCustomRole } from '@/db/validation';
import {
  deductCreditsForAction,
  enforceCredits,
} from '@/services/billing';
import { getUserTier } from '@/services/usage';
import type { ApiEnv } from '@/types';

import type {
  createCustomRoleRoute,
  deleteCustomRoleRoute,
  getCustomRoleRoute,
  listCustomRolesRoute,
  updateCustomRoleRoute,
} from '../route';
import {
  CreateCustomRoleRequestSchema,
  UpdateCustomRoleRequestSchema,
} from '../schema';

export const listCustomRolesHandler: RouteHandler<typeof listCustomRolesRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'listCustomRoles',
    validateQuery: CursorPaginationQuerySchema,
  },
  async (c) => {
    const { user } = c.auth();
    const query = c.validated.query;
    const db = await getDbAsync();
    const customRoles = await db.query.chatCustomRole.findMany({
      limit: query.limit + 1,
      orderBy: getCursorOrderBy(tables.chatCustomRole.updatedAt, 'desc'),
      where: buildCursorWhereWithFilters(
        tables.chatCustomRole.updatedAt,
        query.cursor,
        'desc',
        [eq(tables.chatCustomRole.userId, user.id)],
      ),
    });
    const { items, pagination } = applyCursorPagination(
      customRoles,
      query.limit,
      (customRole: ChatCustomRole) => createTimestampCursor(customRole.updatedAt),
    );
    return Responses.cursorPaginated(c, items, pagination);
  },
);
export const createCustomRoleHandler: RouteHandler<typeof createCustomRoleRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'createCustomRole',
    validateBody: CreateCustomRoleRequestSchema,
  },
  async (c) => {
    const { user } = c.auth();

    // Parallelize independent validation checks
    const [userTier] = await Promise.all([
      getUserTier(user.id),
      enforceCredits(user.id, 1), // ✅ CREDITS: Enforce credits for custom role creation
    ]);

    // Block free users from creating custom roles
    if (userTier === SubscriptionTiers.FREE) {
      throw createError.unauthorized(
        'Custom roles are not available on the Free plan. Upgrade to create custom roles.',
      );
    }
    // ✅ TYPE-SAFE: createHandler validates body via validateBody config
    const body = c.validated.body;
    const db = await getDbAsync();
    const customRoleId = ulid();
    const now = new Date();
    const [customRole] = await db
      .insert(tables.chatCustomRole)
      .values({
        createdAt: now,
        description: body.description ?? null,
        id: customRoleId,
        metadata: body.metadata ?? null,
        name: body.name,
        systemPrompt: body.systemPrompt,
        updatedAt: now,
        userId: user.id,
      })
      .returning();
    // ✅ CREDITS: Deduct for custom role creation
    await deductCreditsForAction(user.id, 'customRoleCreation');
    return Responses.ok(c, {
      customRole,
    });
  },
);
export const getCustomRoleHandler: RouteHandler<typeof getCustomRoleRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getCustomRole',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { id } = c.validated.params;
    const db = await getDbAsync();
    const customRole = await verifyCustomRoleOwnership(id, db);
    return Responses.ok(c, {
      customRole,
    });
  },
);
export const updateCustomRoleHandler: RouteHandler<typeof updateCustomRoleRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'updateCustomRole',
    validateBody: UpdateCustomRoleRequestSchema,
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id } = c.validated.params;
    // ✅ TYPE-SAFE: createHandler validates body via validateBody config
    const body = c.validated.body;
    const db = await getDbAsync();
    const [updatedCustomRole] = await db
      .update(tables.chatCustomRole)
      .set({
        description: body.description ?? null,
        metadata: body.metadata ?? undefined,
        name: body.name,
        systemPrompt: body.systemPrompt,
        updatedAt: new Date(),
      })
      .where(and(
        eq(tables.chatCustomRole.id, id),
        eq(tables.chatCustomRole.userId, user.id),
      ))
      .returning();
    if (!updatedCustomRole) {
      throw createError.notFound('Custom role not found', ErrorContextBuilders.resourceNotFound('custom_role', id));
    }
    return Responses.ok(c, {
      customRole: updatedCustomRole,
    });
  },
);
export const deleteCustomRoleHandler: RouteHandler<typeof deleteCustomRoleRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'deleteCustomRole',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: roleId } = c.validated.params;
    const db = await getDbAsync();

    // First verify the role exists and belongs to the user
    const existingRole = await db.query.chatCustomRole.findFirst({
      where: and(
        eq(tables.chatCustomRole.id, roleId),
        eq(tables.chatCustomRole.userId, user.id),
      ),
    });

    if (!existingRole) {
      throw createError.notFound('Custom role not found', ErrorContextBuilders.resourceNotFound('custom_role', roleId));
    }

    // ✅ PRESET CLEANUP: Clean up user presets that reference this role BEFORE deleting
    // This prevents 404 errors when preset is used with a deleted role
    const userPresets = await db.query.chatUserPreset.findMany({
      where: eq(tables.chatUserPreset.userId, user.id),
    });

    // Find presets that need updating
    const presetsToUpdate: Array<{ id: string; filteredRoles: typeof userPresets[0]['modelRoles'] }> = [];
    const now = new Date();

    for (const preset of userPresets) {
      if (!preset.modelRoles || !Array.isArray(preset.modelRoles)) {
        continue;
      }

      // Filter out entries that reference the deleted role
      // modelRoles[].role stores the custom role ID (ULID)
      const filteredRoles = preset.modelRoles.filter(
        mr => mr.role !== roleId,
      );

      // If any entries were filtered out, mark for update
      if (filteredRoles.length !== preset.modelRoles.length) {
        presetsToUpdate.push({ filteredRoles, id: preset.id });
      }
    }

    // Execute preset updates and role deletion
    // Using executeBatch for D1 compatibility (handles fallback for local SQLite)
    if (presetsToUpdate.length > 0) {
      await executeBatch(db, [
        // Update all affected presets
        ...presetsToUpdate.map(({ filteredRoles, id }) =>
          db.update(tables.chatUserPreset)
            .set({ modelRoles: filteredRoles, updatedAt: now })
            .where(eq(tables.chatUserPreset.id, id)),
        ),
        // Delete the custom role
        db.delete(tables.chatCustomRole)
          .where(eq(tables.chatCustomRole.id, roleId)),
      ]);
    } else {
      // No preset updates needed, just delete the role
      await db
        .delete(tables.chatCustomRole)
        .where(eq(tables.chatCustomRole.id, roleId));
    }

    return Responses.ok(c, {
      deleted: true,
    });
  },
);
