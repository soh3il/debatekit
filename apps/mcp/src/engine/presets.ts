/**
 * MCP Engine Presets
 *
 * MCP-specific thinking presets, format postscripts, and participant limits.
 * Enums and credit functions are imported directly from @debatekit/shared.
 */

import type { McpOutputFormat, McpThinkingLevel } from '@debatekit/shared/enums';
import { z } from 'zod';

// ============================================================================
// MCP-SPECIFIC: FORMAT POSTSCRIPTS
// ============================================================================

/**
 * MCP-specific format instructions appended after the shared moderator prompt.
 * The shared prompt uses adaptive formatting; this adds MCP's explicit format
 * selection as a postscript when the user picks a specific format.
 */
export const FORMAT_POSTSCRIPTS: Record<McpOutputFormat, string> = {
  'adr':
    '\n\n## Format Override\nFormat as an Architecture Decision Record: Context, Decision, Consequences, Alternatives Considered. Credit specific participants for their contributions to each section.',
  'comparison':
    '\n\n## Format Override\nFormat as a comparison table with key dimensions, then a narrative recommendation explaining the trade-offs the council identified.',
  'discussion': '', // No override -- use adaptive format from shared prompt
  'pros-cons':
    '\n\n## Format Override\nFormat as structured pros/cons for each option discussed, crediting which participants raised each point, then a clear recommendation.',
};

// ============================================================================
// MCP-SPECIFIC: THINKING PRESETS
// ============================================================================

const _ThinkingPresetSchema = z.object({
  defaultModels: z.array(z.string()),
  description: z.string(),
  label: z.string(),
  moderatorMaxTokens: z.number(),
  moderatorModel: z.string(),
  participantMaxTokens: z.number(),
});
type ThinkingPreset = z.infer<typeof _ThinkingPresetSchema>;

export const THINKING_PRESETS: Record<McpThinkingLevel, ThinkingPreset> = {
  high: {
    defaultModels: [
      'anthropic/claude-opus-4.6',
      'openai/o3',
      'google/gemini-2.5-pro',
    ],
    description: 'Maximum reasoning models for critical decisions and complex architecture',
    label: 'Ultra Think',
    moderatorMaxTokens: 1200,
    moderatorModel: 'anthropic/claude-opus-4.6',
    participantMaxTokens: 1000,
  },
  low: {
    defaultModels: [
      'google/gemini-2.5-flash',
      'openai/gpt-4o-mini',
      'deepseek/deepseek-v3.2',
    ],
    description: 'Fast, cheap models for quick brainstorms and simple questions',
    label: 'Quick Think',
    moderatorMaxTokens: 600,
    moderatorModel: 'google/gemini-2.5-flash',
    participantMaxTokens: 400,
  },
  medium: {
    defaultModels: [
      'anthropic/claude-sonnet-4.6',
      'openai/gpt-5.4',
      'google/gemini-2.5-pro',
    ],
    description: 'Balanced smart models for moderate complexity tasks',
    label: 'Deep Think',
    moderatorMaxTokens: 800,
    moderatorModel: 'anthropic/claude-sonnet-4.6',
    participantMaxTokens: 600,
  },
} as const;

// ============================================================================
// MCP-SPECIFIC: PARTICIPANT LIMITS
// ============================================================================

export const MIN_PARTICIPANTS = 3;
export const MAX_PARTICIPANTS = 6;
