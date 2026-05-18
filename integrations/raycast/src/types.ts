import { z } from "zod";
import {
  ConsultResponseSchema,
  ListSessionsResponseSchema,
  SessionDetailSchema,
  SessionSummarySchema,
} from "@debatekit/integration-shared";

export type {
  ChatMode,
  ConsultResponse,
  DebateMetadata,
  ModeratorResult,
  ParticipantResponse,
  ThinkingLevel,
  TokenUsage,
} from "@debatekit/integration-shared";

/** Raycast extension preferences */
export const PreferencesSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

/** Full debate result with a guaranteed sessionId (API POST endpoints always return one) */
export const DebateResultSchema = ConsultResponseSchema.extend({
  sessionId: z.string(),
});
export type DebateResult = z.infer<typeof DebateResultSchema>;

/** Session summary from list endpoint */
export { SessionSummarySchema };
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

/** Full session detail from get endpoint */
export { SessionDetailSchema };
export type Session = z.infer<typeof SessionDetailSchema>;

/** Sessions list response */
export const SessionsResponseSchema = ListSessionsResponseSchema;
export type SessionsResponse = z.infer<typeof SessionsResponseSchema>;
