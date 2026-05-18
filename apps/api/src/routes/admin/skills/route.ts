import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createApiResponseSchema, createProtectedRouteResponses } from '@/core';
import { AdminSkillSchema } from '@/services/admin/skill-registry';

/**
 * Admin: List all available prompt skills
 */
export const listAdminSkillsRoute = createRoute({
  description: 'List all available prompt skills that can be referenced in admin prompts using {skill_id} tokens.',
  method: 'get',
  path: '/admin/skills',
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(z.object({
            skills: z.array(AdminSkillSchema),
          })),
        },
      },
      description: 'Skills list retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'List admin prompt skills (admin only)',
  tags: ['admin-skills'],
});
