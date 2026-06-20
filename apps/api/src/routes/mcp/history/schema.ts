import { ChatModeSchema, McpOutputFormatSchema, McpThinkingLevelSchema, MCPToolMethodSchema } from '@debatekit/shared/enums';
import { z } from '@hono/zod-openapi';

import { createApiResponseSchema } from '@/core/schemas';

// ============================================================================
// MCP History Query Schema
// ============================================================================

export const McpHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20).openapi({
    description: 'Number of sessions to return (default 20, max 100)',
    example: 20,
  }),
  offset: z.coerce.number().int().min(0).optional().default(0).openapi({
    description: 'Number of sessions to skip (default 0)',
    example: 0,
  }),
}).openapi('McpHistoryQuery');

// ============================================================================
// MCP Session Item Schema
// ============================================================================

const McpSessionItemSchema = z.object({
  createdAt: z.coerce.date().openapi({
    description: 'Session timestamp',
    example: '2025-01-15T10:30:00Z',
  }),
  durationMs: z.number().openapi({
    description: 'Session duration in milliseconds',
    example: 2300,
  }),
  format: McpOutputFormatSchema.openapi({
    description: 'Output format used',
    example: 'discussion',
  }),
  id: z.string().openapi({
    description: 'Session ID',
    example: '01JARW8VXNQH1234567890ABC',
  }),
  mode: ChatModeSchema.openapi({
    description: 'Conversation mode',
    example: 'debating',
  }),
  modelIds: z.array(z.string()).openapi({
    description: 'Model IDs used in the session',
    example: ['anthropic/claude-sonnet-4', 'openai/gpt-4o'],
  }),
  prompt: z.string().openapi({
    description: 'User prompt for the session',
    example: 'How should we architect the auth system?',
  }),
  thinkingLevel: McpThinkingLevelSchema.openapi({
    description: 'Thinking level used',
    example: 'high',
  }),
  threadSlug: z.string().nullable().openapi({
    description: 'Slug of the associated chat thread (if created)',
    example: 'architecture-review-abc12345',
  }),
  toolName: MCPToolMethodSchema.openapi({
    description: 'MCP tool that was used',
    example: 'consult',
  }),
  totalCredits: z.number().openapi({
    description: 'Credits consumed by this session',
    example: 150,
  }),
}).openapi('McpSessionItem');

// ============================================================================
// MCP History Response Schema
// ============================================================================

export const McpHistoryPayloadSchema = z.object({
  hasMore: z.boolean().openapi({
    description: 'Whether there are more sessions to load',
    example: true,
  }),
  items: z.array(McpSessionItemSchema).openapi({
    description: 'List of MCP sessions',
  }),
  total: z.number().int().nonnegative().openapi({
    description: 'Total number of MCP sessions',
    example: 42,
  }),
}).openapi('McpHistoryPayload');

export const McpHistoryResponseSchema = createApiResponseSchema(
  McpHistoryPayloadSchema,
).openapi('McpHistoryResponse');

// ============================================================================
// Type Exports
// ============================================================================

export type McpHistoryQuery = z.infer<typeof McpHistoryQuerySchema>;
export type McpHistoryPayload = z.infer<typeof McpHistoryPayloadSchema>;
