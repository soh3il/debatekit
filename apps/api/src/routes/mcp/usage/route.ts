/**
 * MCP Usage Route
 *
 * Returns current MCP usage counters, limits, cooldown status, and reset times.
 */

import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createProtectedRouteResponses } from '@/core';

import { McpUsageResponseSchema } from './schema';

export const getMcpUsageRoute = createRoute({
  description: 'Retrieve MCP usage counters across 5-hour, daily, and weekly windows with limits and cooldown status',
  method: 'get',
  path: '/mcp/usage',
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: McpUsageResponseSchema },
      },
      description: 'MCP usage data retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get MCP usage data',
  tags: ['mcp'],
});
