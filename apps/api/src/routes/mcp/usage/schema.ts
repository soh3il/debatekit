import { z } from '@hono/zod-openapi';
import { McpLimitStatusSchema, PlanTypeSchema } from '@debatekit/shared/enums';

import { createApiResponseSchema } from '@/core/schemas';

// ============================================================================
// MCP Window Usage Schema (reusable for each time window)
// ============================================================================

const McpWindowUsageSchema = z.object({
  count: z.number().int().nonnegative().openapi({
    description: 'Number of requests made in this window',
    example: 5,
  }),
  limit: z.number().int().positive().openapi({
    description: 'Maximum requests allowed in this window',
    example: 15,
  }),
  remaining: z.number().int().nonnegative().openapi({
    description: 'Requests remaining in this window',
    example: 10,
  }),
  resetAt: z.string().datetime().openapi({
    description: 'ISO 8601 timestamp when this window resets',
    example: '2025-01-15T15:00:00.000Z',
  }),
}).openapi('McpWindowUsage');

// ============================================================================
// MCP Usage Response Schema
// ============================================================================

export const McpUsagePayloadSchema = z.object({
  cooldown: z.object({
    active: z.boolean().openapi({
      description: 'Whether the user is currently in a cooldown period',
      example: false,
    }),
    endsAt: z.string().datetime().nullable().openapi({
      description: 'ISO 8601 timestamp when cooldown ends (null if not in cooldown)',
      example: null,
    }),
    remainingSeconds: z.number().nullable().openapi({
      description: 'Seconds remaining in cooldown (null if not in cooldown)',
      example: null,
    }),
  }).openapi({
    description: 'Cooldown status (applies to free tier after hitting 5-hour limit)',
  }),
  daily: McpWindowUsageSchema.openapi({
    description: 'Daily usage window (UTC midnight to midnight)',
  }),
  fiveHour: McpWindowUsageSchema.openapi({
    description: '5-hour usage window (0-5, 5-10, 10-15, 15-20, 20-24 UTC)',
  }),
  plan: PlanTypeSchema.openapi({
    description: 'User plan type determining usage limits',
    example: 'free',
  }),
  status: McpLimitStatusSchema.openapi({
    description: 'Overall usage status',
    example: 'ok',
  }),
  weekly: McpWindowUsageSchema.openapi({
    description: 'Weekly usage window (Monday 00:00 UTC to Sunday 23:59 UTC)',
  }),
}).openapi('McpUsagePayload');

export const McpUsageResponseSchema = createApiResponseSchema(
  McpUsagePayloadSchema,
).openapi('McpUsageResponse');

// ============================================================================
// Type Exports
// ============================================================================

export type McpUsagePayload = z.infer<typeof McpUsagePayloadSchema>;
