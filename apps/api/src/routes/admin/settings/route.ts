import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createApiResponseSchema, createProtectedRouteResponses } from '@/core';

import { AdminSettingsPatchBodySchema, AdminSettingsPayloadSchema } from './schema';

/**
 * Admin: Get all pipeline settings
 * Returns current values with defaults for any unset keys
 */
export const getAdminSettingsRoute = createRoute({
  description: 'Retrieve all admin pipeline settings. Returns defaults for any key not explicitly set.',
  method: 'get',
  path: '/admin/settings',
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(AdminSettingsPayloadSchema),
        },
      },
      description: 'Admin settings retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get admin settings (admin only)',
  tags: ['admin-settings'],
});

/**
 * Admin: Update one or more pipeline settings
 */
export const updateAdminSettingsRoute = createRoute({
  description: 'Update one or more admin pipeline settings. Only provided fields are written; omitted fields remain unchanged.',
  method: 'patch',
  path: '/admin/settings',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AdminSettingsPatchBodySchema,
        },
      },
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(AdminSettingsPayloadSchema),
        },
      },
      description: 'Admin settings updated successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Update admin settings (admin only)',
  tags: ['admin-settings'],
});
