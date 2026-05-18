/**
 * Unified Round Stream Schemas
 *
 * Zod schemas for unified round stream routes (start/resume).
 * Follows backend-patterns.md: Route-specific schemas with z.infer<> types.
 *
 * Accepts AI SDK v6 useChat format: { message: UIMessage, ... }
 * Participants are fetched from DB using threadId from path params.
 *
 * @module api/routes/chat/unified-round-stream.schema
 */

import { z } from '@hono/zod-openapi';

import { CoreSchemas } from '@/core';

// ============================================================================
// AI SDK CHAT ROLE (5-part enum pattern)
// ============================================================================

// 1. ARRAY CONSTANT
export const AI_SDK_CHAT_ROLE_VALUES = ['user', 'assistant', 'system'] as const;

// 2. ZOD SCHEMA
export const AiSdkChatRoleSchema = z.enum(AI_SDK_CHAT_ROLE_VALUES);

// 3. TYPESCRIPT TYPE
export type AiSdkChatRole = z.infer<typeof AiSdkChatRoleSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_AI_SDK_CHAT_ROLE: AiSdkChatRole = 'user';

// 5. CONSTANT OBJECT
export const AiSdkChatRoles = {
  ASSISTANT: 'assistant' as const,
  SYSTEM: 'system' as const,
  USER: 'user' as const,
} as const;

// ============================================================================
// PATH PARAMETERS
// ============================================================================

/**
 * Path parameters for unified round stream routes
 * Used by both POST (start) and GET (resume)
 */
export const UnifiedRoundStreamParamsSchema = z.object({
  roundNumber: z.string().openapi({
    description: 'Round number (0-based: first round is 0)',
    example: '0',
    param: { in: 'path', name: 'roundNumber' },
  }),
  threadId: CoreSchemas.id().openapi({
    description: 'Thread identifier',
    example: 'thread_abc123',
    param: { in: 'path', name: 'threadId' },
  }),
}).openapi('UnifiedRoundStreamParams');

export type UnifiedRoundStreamParams = z.infer<typeof UnifiedRoundStreamParamsSchema>;

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

/**
 * Query parameters for unified round stream resume (GET)
 *
 * AI SDK v6 resumption does NOT use any query parameters.
 * Backend replays ALL SSE data from the beginning on every resume GET.
 * AI SDK handles dedup natively via message-ID-based replaceMessage.
 */
export const UnifiedRoundStreamQuerySchema = z.object({}).openapi('UnifiedRoundStreamQuery');

export type UnifiedRoundStreamQuery = z.infer<typeof UnifiedRoundStreamQuerySchema>;

// ============================================================================
// REQUEST BODY
// ============================================================================

/**
 * AI SDK v6 UIMessage text part schema
 * Matches @ai-sdk/react UIMessage.parts[].type === 'text'
 */
const AiSdkTextPartSchema = z.object({
  text: z.string(),
  type: z.literal('text'),
}).openapi('AiSdkTextPart');

/**
 * AI SDK v6 UIMessage reasoning part schema
 * Matches @ai-sdk/react UIMessage.parts[].type === 'reasoning'
 */
const AiSdkReasoningPartSchema = z.object({
  reasoning: z.string().optional(),
  text: z.string().optional(),
  type: z.literal('reasoning'),
}).openapi('AiSdkReasoningPart');

/**
 * AI SDK v6 UIMessage file part schema
 * Matches @ai-sdk/react UIMessage.parts[].type === 'file'
 * Sent when user attaches files via sendMessage({ files: [...] })
 */
const AiSdkFilePartSchema = z.object({
  filename: z.string().optional(),
  mediaType: z.string(),
  type: z.literal('file'),
  uploadId: z.string().optional(),
  url: z.string(),
}).openapi('AiSdkFilePart');

/**
 * AI SDK v6 UIMessage part union
 * Parts array replaces content property in v5+
 */
const AiSdkPartSchema = z.union([
  AiSdkTextPartSchema,
  AiSdkReasoningPartSchema,
  AiSdkFilePartSchema,
]).openapi('AiSdkPart');

/**
 * AI SDK v6 UIMessage schema
 *
 * Per AI SDK v5+ migration: .content replaced with .parts array
 * https://github.com/vercel/ai/blob/main/content/docs/08-migration-guides/26-migration-guide-5-0.mdx
 */
const AiSdkMessageSchema = z.object({
  id: z.string().optional().openapi({
    description: 'Message ID (optional)',
  }),
  parts: z.array(AiSdkPartSchema).openapi({
    description: 'Message parts array (AI SDK v6 format)',
  }),
  role: AiSdkChatRoleSchema.openapi({
    description: 'Message role',
  }),
}).openapi('AiSdkMessage');

export type AiSdkMessage = z.infer<typeof AiSdkMessageSchema>;

/**
 * Request body for starting a unified round stream (POST)
 *
 * Minimal payload - user's message and optional attachments.
 * All context fetched from DB using path params:
 * - threadId → thread settings (enableWebSearch, mode, etc.)
 * - threadId → participants (ordered by priority)
 * - roundNumber → round context
 */
export const StartUnifiedRoundStreamRequestSchema = z.object({
  attachmentIds: z.array(z.string()).optional().openapi({
    description: 'Optional upload IDs for file attachments to include with this message',
    example: ['upload_abc123', 'upload_def456'],
  }),
  message: AiSdkMessageSchema.openapi({
    description: 'AI SDK UIMessage object containing user message',
  }),
}).openapi('StartUnifiedRoundStreamRequest');

export type StartUnifiedRoundStreamRequest = z.infer<typeof StartUnifiedRoundStreamRequestSchema>;
