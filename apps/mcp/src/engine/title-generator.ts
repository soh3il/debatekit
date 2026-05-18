/**
 * MCP Title Generator
 *
 * Generates concise AI titles for MCP debate threads.
 * Uses the same OpenRouter provider as debates, matching
 * the API's title generation behavior (model, prompt, limits).
 */

import type { Env } from '../types';
import { createOpenRouterProvider } from './providers/openrouter';

// ============================================================================
// Constants
// ============================================================================

/** Same model the API uses for title generation (TITLE_GENERATION_MODEL_ID) */
const TITLE_MODEL = 'google/gemini-2.5-flash';

/** Max characters in a generated title */
const MAX_TITLE_LENGTH = 50;

/** Max words in a generated title */
const MAX_TITLE_WORDS = 5;

/**
 * System prompt matching the API's TITLE_GENERATION_PROMPT
 * from apps/api/src/services/prompts/prompts.service.ts
 */
const TITLE_SYSTEM_PROMPT = `Generate a concise, descriptive title (5 words max) for this conversation.
Write the title in the same language as the user's message.
If the message is in Farsi, write a Farsi title.
If in Spanish, write a Spanish title.
Output only the title, no quotes or extra text.`;

/** Max tokens matching API's TITLE_GENERATION_CONFIG.maxTokens */
const TITLE_MAX_TOKENS = 15;

// ============================================================================
// Title Generation
// ============================================================================

/**
 * Generate a concise AI title for a debate prompt.
 *
 * Uses the same model and system prompt as the API's title generator
 * to produce consistent 5-word titles. Falls back to first 5 words
 * of the prompt on any failure.
 */
export async function generateTitle(prompt: string, env: Env) {
  try {
    const provider = createOpenRouterProvider(env);
    const result = await provider.generateText(
      TITLE_MODEL,
      [
        { content: TITLE_SYSTEM_PROMPT, role: 'system' },
        { content: prompt, role: 'user' },
      ],
      TITLE_MAX_TOKENS,
    );

    // Clean: strip surrounding quotes, enforce word/char limits
    let title = result.text.trim().replace(/^["']|["']$/g, '');
    const words = title.split(/\s+/).slice(0, MAX_TITLE_WORDS);
    title = words.join(' ');
    if (title.length > MAX_TITLE_LENGTH) {
      title = title.substring(0, MAX_TITLE_LENGTH).trim();
    }

    return title || fallbackTitle(prompt);
  } catch {
    return fallbackTitle(prompt);
  }
}

// ============================================================================
// Fallback
// ============================================================================

function fallbackTitle(prompt: string) {
  const words = prompt.trim().split(/\s+/).slice(0, MAX_TITLE_WORDS).join(' ');
  if (words.length > MAX_TITLE_LENGTH) {
    return words.substring(0, MAX_TITLE_LENGTH).trim();
  }
  return words || 'MCP Session';
}
