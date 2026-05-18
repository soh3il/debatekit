/**
 * MCP History Route
 *
 * Returns the last N MCP credit transactions (action = 'mcp_debate').
 */

import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createProtectedRouteResponses } from '@/core';

import { McpHistoryQuerySchema, McpHistoryResponseSchema } from './schema';

export const getMcpHistoryRoute = createRoute({
  description: 'Retrieve recent MCP credit transactions with tool name, credits used, model, and timestamps',
  method: 'get',
  path: '/mcp/history',
  request: {
    query: McpHistoryQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: McpHistoryResponseSchema },
      },
      description: 'MCP transaction history retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get MCP transaction history',
  tags: ['mcp'],
});
