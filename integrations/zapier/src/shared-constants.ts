// =============================================================================
// ZAPIER CONSTRAINT: `zapier push` copies the project to a temp directory
// where workspace/file dependencies do NOT resolve. All values below are
// INLINED copies. Source of truth is noted per section.
// Same pattern as integrations/n8n/nodes/DebateKit/shared/constants.ts.
// =============================================================================

import { z } from 'zod';

// ---------------------------------------------------------------------------
// CONSTANTS
// Source of truth: integrations/shared/src/constants.ts
// ---------------------------------------------------------------------------

export const API_KEY_HEADER = 'x-api-key';
export const API_KEY_SETTINGS_URL = 'https://debatekit.ai/chat/settings/api-keys';
export const DEBATEKIT_DEFAULT_URL = 'https://mcp.debatekit.ai';

// ---------------------------------------------------------------------------
// THINKING LEVELS (5-part enum pattern)
// Source of truth: integrations/shared/src/enums.ts -> THINKING_LEVELS
// ---------------------------------------------------------------------------

export const THINKING_LEVEL_VALUES = ['low', 'medium', 'high'] as const;
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'medium';
export const ThinkingLevelSchema = z.enum(THINKING_LEVEL_VALUES);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;
export const ThinkingLevels = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' } as const;

// ---------------------------------------------------------------------------
// CHAT MODES (5-part enum pattern)
// Source of truth: integrations/shared/src/enums.ts -> CHAT_MODES
// ---------------------------------------------------------------------------

export const CHAT_MODE_VALUES = ['analyzing', 'brainstorming', 'debating', 'solving'] as const;
export const DEFAULT_CHAT_MODE: ChatMode = 'brainstorming';
export const ChatModeSchema = z.enum(CHAT_MODE_VALUES);
export type ChatMode = z.infer<typeof ChatModeSchema>;
export const ChatModes = {
  ANALYZING: 'analyzing',
  BRAINSTORMING: 'brainstorming',
  DEBATING: 'debating',
  SOLVING: 'solving',
} as const;

// ---------------------------------------------------------------------------
// ARCHITECT SCALES (5-part enum pattern)
// Source of truth: integrations/shared/src/enums.ts -> ARCHITECT_SCALES
// ---------------------------------------------------------------------------

export const ARCHITECT_SCALE_VALUES = ['startup', 'growth', 'enterprise'] as const;
export const DEFAULT_ARCHITECT_SCALE: ArchitectScale = 'startup';
export const ArchitectScaleSchema = z.enum(ARCHITECT_SCALE_VALUES);
export type ArchitectScale = z.infer<typeof ArchitectScaleSchema>;
export const ArchitectScales = { STARTUP: 'startup', GROWTH: 'growth', ENTERPRISE: 'enterprise' } as const;

// ---------------------------------------------------------------------------
// API RESPONSE SCHEMAS
// Source of truth: integrations/shared/src/types.ts
// Inlined here because tsc in zapier push temp dir cannot resolve workspace deps.
// ---------------------------------------------------------------------------

export const TokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const ParticipantResponseSchema = z.object({
  model_id: z.string(),
  model_name: z.string(),
  response: z.string(),
  role: z.string().nullable(),
  token_usage: TokenUsageSchema,
});
export type ParticipantResponse = z.infer<typeof ParticipantResponseSchema>;

export const ModeratorResultSchema = z.object({
  model_id: z.string(),
  summary: z.string(),
  token_usage: TokenUsageSchema,
});
export type ModeratorResult = z.infer<typeof ModeratorResultSchema>;

export const DebateMetadataSchema = z.object({
  duration_ms: z.number(),
  format: z.string(),
  mode: z.string(),
  prompt_version: z.number().nullable().optional(),
  thinking_level: z.string(),
  total_credits_used: z.number(),
});
export type DebateMetadata = z.infer<typeof DebateMetadataSchema>;

export const ConsultResponseSchema = z.object({
  metadata: DebateMetadataSchema,
  moderator: ModeratorResultSchema,
  participants: z.array(ParticipantResponseSchema),
  sessionId: z.string().optional(),
  threadSlug: z.string().optional(),
});
export type ConsultResponse = z.infer<typeof ConsultResponseSchema>;

export const ThreadLinkResponseSchema = z.object({
  dashboardUrl: z.string(),
  isPublic: z.boolean(),
  publicUrl: z.string(),
});
export type ThreadLinkResponse = z.infer<typeof ThreadLinkResponseSchema>;
