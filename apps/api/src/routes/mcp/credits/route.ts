/**
 * MCP Credits Route
 *
 * Returns credit balance, plan type, monthly allocation, percentage used, and status.
 */

import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createProtectedRouteResponses } from '@/core';

import { McpCreditResponseSchema } from './schema';

export const getMcpCreditsRoute = createRoute({
  description: 'Retrieve credit balance, plan information, and usage status for MCP dashboard',
  method: 'get',
  path: '/mcp/credits',
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: McpCreditResponseSchema },
      },
      description: 'MCP credit data retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get MCP credit balance',
  tags: ['mcp'],
});
