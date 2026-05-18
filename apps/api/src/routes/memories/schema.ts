/**
 * Project Memory API Schemas
 *
 * Schemas for viewing and deleting project-scoped working memory.
 */

import { z } from '@hono/zod-openapi';

import { createApiResponseSchema } from '@/core/schemas';

// ============================================================================
// Project Memory Response Schema
// ============================================================================

export const ProjectMemoryPayloadSchema = z.object({
  content: z.string().nullable().openapi({
    description: 'Memory content text (null if no memory exists)',
    example: 'User prefers concise responses with code examples.',
  }),
  id: z.string().nullable().openapi({
    description: 'Memory entry ID (null if no memory exists)',
    example: 'chat:proj_abc123',
  }),
  updatedAt: z.string().datetime().nullable().openapi({
    description: 'Last updated timestamp (ISO 8601)',
    example: '2025-06-15T10:30:00.000Z',
  }),
}).openapi('ProjectMemoryPayload');

export const ProjectMemoryResponseSchema = createApiResponseSchema(
  ProjectMemoryPayloadSchema,
).openapi('ProjectMemoryResponse');

// ============================================================================
// Delete Memory Response Schema
// ============================================================================

export const DeleteMemoryPayloadSchema = z.object({
  success: z.boolean().openapi({
    description: 'Whether the deletion was successful',
    example: true,
  }),
}).openapi('DeleteMemoryPayload');

export const DeleteMemoryResponseSchema = createApiResponseSchema(
  DeleteMemoryPayloadSchema,
).openapi('DeleteMemoryResponse');

// ============================================================================
// Extract Memory Schemas
// ============================================================================

export const ExtractMemoryRequestSchema = z.object({
  userMessage: z.string().min(1).openapi({
    description: 'The user message to analyze for memorable content',
    example: 'My name is Alex and I prefer TypeScript over JavaScript.',
  }),
}).openapi('ExtractMemoryRequest');

export const ExtractMemoryPayloadSchema = z.object({
  extracted: z.boolean().openapi({
    description: 'Whether new memory was extracted and saved',
    example: true,
  }),
  previousContent: z.string().nullable().openapi({
    description: 'Previous memory content before update (for undo)',
    example: 'User prefers concise responses.',
  }),
  summary: z.string().nullable().openapi({
    description: 'Brief summary of what was extracted (null if nothing extracted)',
    example: 'Saved user name (Alex) and language preference (TypeScript).',
  }),
}).openapi('ExtractMemoryPayload');

export const ExtractMemoryResponseSchema = createApiResponseSchema(
  ExtractMemoryPayloadSchema,
).openapi('ExtractMemoryResponse');

// ============================================================================
// Restore Memory Schemas
// ============================================================================

export const RestoreMemoryRequestSchema = z.object({
  content: z.string().nullable().openapi({
    description: 'Memory content to restore (null to clear memory entirely)',
    example: 'User prefers concise responses.',
  }),
}).openapi('RestoreMemoryRequest');

export const RestoreMemoryPayloadSchema = z.object({
  success: z.boolean().openapi({
    description: 'Whether the restore was successful',
    example: true,
  }),
}).openapi('RestoreMemoryPayload');

export const RestoreMemoryResponseSchema = createApiResponseSchema(
  RestoreMemoryPayloadSchema,
).openapi('RestoreMemoryResponse');

// ============================================================================
// Type Exports
// ============================================================================

export type ProjectMemoryPayload = z.infer<typeof ProjectMemoryPayloadSchema>;
export type DeleteMemoryPayload = z.infer<typeof DeleteMemoryPayloadSchema>;
export type ExtractMemoryRequest = z.infer<typeof ExtractMemoryRequestSchema>;
export type ExtractMemoryPayload = z.infer<typeof ExtractMemoryPayloadSchema>;
export type RestoreMemoryRequest = z.infer<typeof RestoreMemoryRequestSchema>;
export type RestoreMemoryPayload = z.infer<typeof RestoreMemoryPayloadSchema>;
