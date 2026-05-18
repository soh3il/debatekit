/**
 * Podcast Generation Enums
 *
 * Enums for podcast generation status tracking and scope definitions.
 * Follows 5-part pattern: array -> schema -> type -> default -> constant object
 */

import { z } from '@hono/zod-openapi';

// ============================================================================
// PODCAST STATUS
// ============================================================================

// 1. ARRAY CONSTANT - Source of truth for values
export const PODCAST_STATUSES = [
  'pending',
  'generating_script',
  'generating_audio',
  'uploading',
  'completed',
  'failed',
] as const;

// 2. ZOD SCHEMA - Runtime validation + OpenAPI docs
export const PodcastStatusSchema = z.enum(PODCAST_STATUSES).openapi({
  description: 'Current status of podcast generation',
  example: 'pending',
});

// 3. TYPESCRIPT TYPE - Inferred from Zod schema
export type PodcastStatus = z.infer<typeof PodcastStatusSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_PODCAST_STATUS: PodcastStatus = 'pending';

// 5. CONSTANT OBJECT - For usage in code
export const PodcastStatuses = {
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  GENERATING_AUDIO: 'generating_audio' as const,
  GENERATING_SCRIPT: 'generating_script' as const,
  PENDING: 'pending' as const,
  UPLOADING: 'uploading' as const,
} as const;

/** Set of statuses that indicate active podcast generation */
export const ACTIVE_GENERATION_STATUSES: ReadonlySet<PodcastStatus> = new Set([
  PodcastStatuses.GENERATING_AUDIO,
  PodcastStatuses.GENERATING_SCRIPT,
  PodcastStatuses.PENDING,
  PodcastStatuses.UPLOADING,
]);

// ============================================================================
// PODCAST SCOPE
// ============================================================================

// 1. ARRAY CONSTANT - Source of truth for values
export const PODCAST_SCOPES = ['thread', 'round'] as const;

// 2. ZOD SCHEMA - Runtime validation + OpenAPI docs
export const PodcastScopeSchema = z.enum(PODCAST_SCOPES).openapi({
  description: 'Scope of the podcast: entire thread or single round',
  example: 'round',
});

// 3. TYPESCRIPT TYPE - Inferred from Zod schema
export type PodcastScope = z.infer<typeof PodcastScopeSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_PODCAST_SCOPE: PodcastScope = 'round';

// 5. CONSTANT OBJECT - For usage in code
export const PodcastScopes = {
  ROUND: 'round' as const,
  THREAD: 'thread' as const,
} as const;

// ============================================================================
// PODCAST SCRIPT LINE ROLE
// ============================================================================

// 1. ARRAY CONSTANT - Source of truth for values
export const PODCAST_SCRIPT_LINE_ROLES = ['narrator', 'participant', 'moderator'] as const;

// 2. ZOD SCHEMA - Runtime validation + OpenAPI docs
export const PodcastScriptLineRoleSchema = z.enum(PODCAST_SCRIPT_LINE_ROLES).openapi({
  description: 'Role of the speaker in a podcast script line: narrator (host/MC), participant (AI panelist), or moderator (council moderator)',
  example: 'participant',
});

// 3. TYPESCRIPT TYPE - Inferred from Zod schema
export type PodcastScriptLineRole = z.infer<typeof PodcastScriptLineRoleSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_PODCAST_SCRIPT_LINE_ROLE: PodcastScriptLineRole = 'participant';

// 5. CONSTANT OBJECT - For usage in code
export const PodcastScriptLineRoles = {
  MODERATOR: 'moderator' as const,
  NARRATOR: 'narrator' as const,
  PARTICIPANT: 'participant' as const,
} as const;
