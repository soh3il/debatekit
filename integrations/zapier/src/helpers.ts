/**
 * Shared helpers for Zapier actions to eliminate duplication.
 */

import { ConsultResponseSchema } from './shared-constants';
import type { ConsultResponse } from './shared-constants';

/** Split a comma-separated string into a trimmed array. */
export const splitComma = (value: string) =>
  value.split(',').map(s => s.trim());

/** Parse raw response data into a validated ConsultResponse. */
export const parseConsultResponse = (data: Parameters<typeof ConsultResponseSchema.parse>[0]) =>
  ConsultResponseSchema.parse(data);

/** Standard output fields shared by most create actions. */
export const BASE_OUTPUT_FIELDS = [
  { key: 'sessionId', label: 'Session ID', type: 'string' },
  { key: 'threadSlug', label: 'Thread Slug', type: 'string' },
  { key: 'moderator_summary', label: 'Moderator Summary', type: 'string' },
  { key: 'participant_count', label: 'Participant Count', type: 'integer' },
  { key: 'duration_ms', label: 'Duration (ms)', type: 'integer' },
] as const;

/** Map a ConsultResponse to the base output shape used by most actions. */
export const mapBaseResult = (result: ConsultResponse) => ({
  sessionId: result.sessionId ?? '',
  threadSlug: result.threadSlug ?? '',
  moderator_summary: result.moderator.summary,
  participant_count: result.participants.length,
  duration_ms: result.metadata.duration_ms,
});

/** Map a ConsultResponse to the base output plus thinking_level. */
export const mapResultWithThinking = (result: ConsultResponse) => ({
  ...mapBaseResult(result),
  thinking_level: result.metadata.thinking_level,
});

/** Common thinking_level input field definition. */
export const THINKING_LEVEL_INPUT_FIELD = {
  key: 'thinking_level',
  label: 'Thinking Level',
  type: 'string',
  choices: ['low', 'medium', 'high'],
  default: 'medium',
  required: false,
  helpText:
    'Controls model quality and cost. Low = fast/cheap, medium = balanced, high = maximum reasoning.',
} as const;
