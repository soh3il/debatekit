/**
 * Shared types for DebateKit integrations.
 * Mirrors RunDebateOutputSchema from apps/mcp/src/schemas/tool-schemas.ts.
 *
 * All types derived from Zod schemas via z.infer<>.
 */

import { z } from 'zod'

// ============================================================================
// KNOWLEDGE ITEM
// ============================================================================

export const KNOWLEDGE_ITEM_TYPES = ['text', 'url'] as const
export const KnowledgeItemTypeSchema = z.enum(KNOWLEDGE_ITEM_TYPES)
export type KnowledgeItemType = z.infer<typeof KnowledgeItemTypeSchema>

export const KnowledgeItemSchema = z.object({
  content: z.string(),
  label: z.string().optional(),
  type: KnowledgeItemTypeSchema,
})
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>

// ============================================================================
// TOKEN USAGE
// ============================================================================

export const TokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
})
export type TokenUsage = z.infer<typeof TokenUsageSchema>

// ============================================================================
// PARTICIPANT RESPONSE
// ============================================================================

export const ParticipantResponseSchema = z.object({
  model_id: z.string(),
  model_name: z.string(),
  response: z.string(),
  role: z.string().nullable(),
  token_usage: TokenUsageSchema,
})
export type ParticipantResponse = z.infer<typeof ParticipantResponseSchema>

// ============================================================================
// MODERATOR RESULT
// ============================================================================

export const ModeratorResultSchema = z.object({
  model_id: z.string(),
  summary: z.string(),
  token_usage: TokenUsageSchema,
})
export type ModeratorResult = z.infer<typeof ModeratorResultSchema>

// ============================================================================
// DEBATE METADATA
// ============================================================================

export const DebateMetadataSchema = z.object({
  duration_ms: z.number(),
  format: z.string(),
  mode: z.string(),
  prompt_version: z.number().nullable().optional(),
  thinking_level: z.string(),
  total_credits_used: z.number(),
})
export type DebateMetadata = z.infer<typeof DebateMetadataSchema>

// ============================================================================
// CONSULT RESPONSE (main API response shape)
// ============================================================================

export const ConsultResponseSchema = z.object({
  metadata: DebateMetadataSchema,
  moderator: ModeratorResultSchema,
  participants: z.array(ParticipantResponseSchema),
  sessionId: z.string().optional(),
  threadSlug: z.string().optional(),
})
export type ConsultResponse = z.infer<typeof ConsultResponseSchema>

// ============================================================================
// THREAD LINK RESPONSE
// ============================================================================

export const ThreadLinkResponseSchema = z.object({
  dashboardUrl: z.string(),
  isPublic: z.boolean(),
  publicUrl: z.string(),
})
export type ThreadLinkResponse = z.infer<typeof ThreadLinkResponseSchema>

// ============================================================================
// SESSION (list-sessions / get-session response shapes)
// ============================================================================

export const SessionSummarySchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  participantCount: z.number(),
  prompt: z.string(),
  toolName: z.string(),
})
export type SessionSummary = z.infer<typeof SessionSummarySchema>

export const SessionDetailSchema = SessionSummarySchema.extend({
  inputJson: z.string(),
  resultJson: z.string(),
})
export type SessionDetail = z.infer<typeof SessionDetailSchema>

export const ListSessionsResponseSchema = z.object({
  count: z.number(),
  sessions: z.array(SessionSummarySchema),
})
export type ListSessionsResponse = z.infer<typeof ListSessionsResponseSchema>

// ============================================================================
// API ERROR (structured auth error from MCP)
// ============================================================================

export const API_ERROR_CODES = ['MISSING_KEY', 'INVALID_FORMAT', 'INVALID_KEY', 'KEY_DISABLED', 'KEY_EXPIRED', 'RATE_LIMITED'] as const
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
  }),
})
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>

/** User-facing messages per error code for integration UX. */
export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_FORMAT: 'Invalid API key format. Keys must start with rpnd_.',
  INVALID_KEY: 'Your API key is invalid or was deleted. Create a new one at debatekit.com/chat/settings/api-keys and use /setkey.',
  KEY_DISABLED: 'Your API key has been disabled. Re-enable it at debatekit.com/chat/settings/api-keys.',
  KEY_EXPIRED: 'Your API key has expired. Create a new one at debatekit.com/chat/settings/api-keys and use /setkey.',
  MISSING_KEY: 'No API key provided. Use /setkey rpnd_your_key to configure one.',
  RATE_LIMITED: 'Rate limit exceeded. Please try again in 60 seconds.',
}
