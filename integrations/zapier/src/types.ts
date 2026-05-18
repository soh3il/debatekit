/**
 * Centralized Zapier-specific types.
 *
 * All types are Zod schemas with inferred TypeScript types; action files
 * import from this module. Shared types (ConsultResponse, etc.) live in
 * ./shared-constants.ts (inlined for `zapier push` isolation).
 */

import { z } from 'zod';
import {
  ThinkingLevelSchema,
  ChatModeSchema,
  ArchitectScaleSchema,
} from './shared-constants';

// ============================================================================
// API SESSION (returned by /api/v1/sessions endpoints)
// ============================================================================

/** Base session fields shared between list and detail endpoints. */
export const ApiSessionSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  prompt: z.string(),
  thinkingLevel: z.string(),
  totalCredits: z.number(),
  durationMs: z.number(),
  createdAt: z.string(),
});
export type ApiSession = z.infer<typeof ApiSessionSchema>;

/** Detail endpoint returns additional fields beyond ApiSession. */
export const ApiSessionDetailSchema = ApiSessionSchema.extend({
  qualityScore: z.number(),
  resultJson: z.string(),
});
export type ApiSessionDetail = z.infer<typeof ApiSessionDetailSchema>;

/** Response shape from GET /api/v1/sessions. */
export const SessionsListResponseSchema = z.object({
  sessions: z.array(ApiSessionSchema),
  count: z.number(),
});
export type SessionsListResponse = z.infer<typeof SessionsListResponseSchema>;

// ============================================================================
// CREATE ACTION INPUT SCHEMAS (match Zapier inputFields per tool)
// ============================================================================

export const StartDebateKitInputSchema = z.object({
  prompt: z.string(),
  thinking_level: ThinkingLevelSchema.optional(),
  mode: ChatModeSchema.optional(),
  context: z.string().optional(),
});
export type StartDebateKitInput = z.infer<typeof StartDebateKitInputSchema>;

export const DebugIssueInputSchema = z.object({
  problem: z.string(),
  error: z.string().optional(),
  expected_behavior: z.string().optional(),
  code: z.string().optional(),
  thinking_level: ThinkingLevelSchema.optional(),
});
export type DebugIssueInput = z.infer<typeof DebugIssueInputSchema>;

export const ReviewCodeInputSchema = z.object({
  code: z.string(),
  language: z.string().optional(),
  focus: z.string().optional(),
  thinking_level: ThinkingLevelSchema.optional(),
});
export type ReviewCodeInput = z.infer<typeof ReviewCodeInputSchema>;

export const DesignArchitectureInputSchema = z.object({
  description: z.string(),
  scale: ArchitectScaleSchema.optional(),
  tech_stack: z.string().optional(),
  focus_areas: z.string().optional(),
});
export type DesignArchitectureInput = z.infer<typeof DesignArchitectureInputSchema>;

export const PlanImplementationInputSchema = z.object({
  feature: z.string(),
  codebase_context: z.string().optional(),
  constraints: z.string().optional(),
  thinking_level: ThinkingLevelSchema.optional(),
});
export type PlanImplementationInput = z.infer<typeof PlanImplementationInputSchema>;

export const AssessTradeoffsInputSchema = z.object({
  decision: z.string(),
  options: z.string(),
  priorities: z.string().optional(),
  thinking_level: ThinkingLevelSchema.optional(),
});
export type AssessTradeoffsInput = z.infer<typeof AssessTradeoffsInputSchema>;

// ============================================================================
// SEARCH / TRIGGER INPUT SCHEMAS
// ============================================================================

export const FindSessionInputSchema = z.object({
  session_id: z.string(),
});
export type FindSessionInput = z.infer<typeof FindSessionInputSchema>;

export const GetThreadLinkInputSchema = z.object({
  session_id: z.string(),
});
export type GetThreadLinkInput = z.infer<typeof GetThreadLinkInputSchema>;

// ============================================================================
// REQUEST BODY SCHEMAS (match MCP API schemas per tool)
// ============================================================================

export const ConsultRequestBodySchema = z.object({
  prompt: z.string(),
  thinking_level: ThinkingLevelSchema.optional(),
  mode: ChatModeSchema.optional(),
  context: z.string().optional(),
});
export type ConsultRequestBody = z.infer<typeof ConsultRequestBodySchema>;

export const DebugRequestBodySchema = z.object({
  problem: z.string(),
  error: z.string().optional(),
  expected_behavior: z.string().optional(),
  code: z.string().optional(),
  thinking_level: ThinkingLevelSchema.optional(),
});
export type DebugRequestBody = z.infer<typeof DebugRequestBodySchema>;

export const ReviewCodeRequestBodySchema = z.object({
  code: z.string(),
  language: z.string().optional(),
  focus: z.array(z.string()).optional(),
  thinking_level: ThinkingLevelSchema.optional(),
});
export type ReviewCodeRequestBody = z.infer<typeof ReviewCodeRequestBodySchema>;

export const ArchitectRequestBodySchema = z.object({
  description: z.string(),
  scale: ArchitectScaleSchema.optional(),
  tech_stack: z.array(z.string()).optional(),
  focus_areas: z.array(z.string()).optional(),
});
export type ArchitectRequestBody = z.infer<typeof ArchitectRequestBodySchema>;

export const PlanImplementationRequestBodySchema = z.object({
  feature: z.string(),
  codebase_context: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  thinking_level: ThinkingLevelSchema.optional(),
});
export type PlanImplementationRequestBody = z.infer<typeof PlanImplementationRequestBodySchema>;

export const AssessTradeoffsRequestBodySchema = z.object({
  decision: z.string(),
  options: z.array(z.string()),
  priorities: z.array(z.string()).optional(),
  thinking_level: ThinkingLevelSchema.optional(),
});
export type AssessTradeoffsRequestBody = z.infer<typeof AssessTradeoffsRequestBodySchema>;
