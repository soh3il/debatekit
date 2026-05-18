/**
 * Mode-Specific AI Parameters
 *
 * Single source of truth for temperature and topP values per ChatMode.
 * Used by both the API streaming pipeline and the MCP debate engine.
 */

import type { ChatMode } from '../enums/chat';
import { ChatModes } from '../enums/chat';

export const DEFAULT_AI_PARAMS = {
  maxTokens: 1024,
  temperature: 0.7,
  topP: 0.9,
} as const;

export const MODE_SPECIFIC_AI_PARAMS: Record<
  ChatMode,
  { maxTokens: number; temperature: number; topP: number }
> = {
  [ChatModes.ANALYZING]: {
    maxTokens: 1024,
    temperature: 0.3,
    topP: 0.7,
  },
  [ChatModes.BRAINSTORMING]: {
    maxTokens: 1024,
    temperature: 0.6,
    topP: 0.85,
  },
  [ChatModes.DEBATING]: {
    maxTokens: 1024,
    temperature: 0.5,
    topP: 0.8,
  },
  [ChatModes.SOLVING]: {
    maxTokens: 1024,
    temperature: 0.4,
    topP: 0.75,
  },
} as const;

export function getAIParamsForMode(mode: ChatMode): {
  maxTokens: number;
  temperature: number;
  topP: number;
} {
  const params = MODE_SPECIFIC_AI_PARAMS[mode];
  if (!params) {
    throw new Error(`Invalid chat mode: ${mode}`);
  }
  return params;
}
