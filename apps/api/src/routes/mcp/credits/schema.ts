import { PlanTypeSchema, UsageStatusSchema } from '@debatekit/shared/enums';
import { z } from '@hono/zod-openapi';

import { createApiResponseSchema } from '@/core/schemas';

// ============================================================================
// MCP Credit Balance Schema
// ============================================================================

export const McpCreditPayloadSchema = z.object({
  available: z.number().openapi({
    description: 'Credits available for use',
    example: 8500,
  }),
  balance: z.number().openapi({
    description: 'Current credit balance',
    example: 8500,
  }),
  percentage: z.number().openapi({
    description: 'Percentage of credits used (from monthly allocation or signup bonus)',
    example: 15,
  }),
  plan: z.object({
    monthlyCredits: z.number().openapi({
      description: 'Monthly credit allocation (0 for free tier)',
      example: 0,
    }),
    nextRefillAt: z.string().datetime().nullable().openapi({
      description: 'Next monthly refill date (null for free tier)',
      example: null,
    }),
    type: PlanTypeSchema.openapi({
      description: 'Current plan type',
      example: 'free',
    }),
  }).openapi({
    description: 'Plan information',
  }),
  status: UsageStatusSchema.openapi({
    description: 'Visual status indicator (default/warning/critical)',
    example: 'default',
  }),
}).openapi('McpCreditPayload');

export const McpCreditResponseSchema = createApiResponseSchema(
  McpCreditPayloadSchema,
).openapi('McpCreditResponse');

// ============================================================================
// Type Exports
// ============================================================================

export type McpCreditPayload = z.infer<typeof McpCreditPayloadSchema>;
