import type { RouteHandler } from '@hono/zod-openapi';

import { createHandler, Responses } from '@/core';
import { getDbAsync } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { getSkillList } from '@/services/admin/skill-registry';
import type { ApiEnv } from '@/types';

import type { listAdminSkillsRoute } from './route';

/**
 * GET /admin/skills
 * Returns list of available prompt skills for admin UI.
 */
export const listAdminSkillsHandler: RouteHandler<typeof listAdminSkillsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'listAdminSkills',
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const db = await getDbAsync();

    return Responses.ok(c, { skills: await getSkillList(db) });
  },
);
