/**
 * Language Detection Service
 *
 * Detects the language of user messages to enforce language-matching responses
 * from AI participants. Uses a hybrid approach:
 *
 * 1. Heuristic (Unicode script detection) — instant, handles non-Latin scripts
 *    (imported from @debatekit/shared/prompts)
 * 2. LLM fallback (Gemini Flash) — for Latin-script languages that could be
 *    non-English (Spanish, French, Portuguese, etc.)
 *
 * Returns null for English (no directive needed) or a language name string
 * like "Persian/Farsi", "Spanish", "French" for non-English.
 */

import { MessagePartTypes, UIMessageRoles } from '@debatekit/shared/enums';
import { detectScriptHeuristic } from '@debatekit/shared/prompts';

import { LANGUAGE_DETECTION_MODEL_ID } from '@/core/ai-models';
import { log } from '@/lib/logger';
import { initializeOpenRouter, openRouterService } from '@/services/models';
import type { ApiEnv } from '@/types';

export type { DetectedLanguage } from '@debatekit/shared/prompts';

const LANGUAGE_DETECTION_PROMPT = `Detect the language of the following text. If the text is in English, respond with exactly "English". Otherwise, respond with the language name in English (e.g. "Spanish", "French", "Portuguese", "German", "Italian", "Turkish", "Dutch", "Polish", "Vietnamese", "Indonesian", "Malay", "Swahili", "Romanian"). Respond with ONLY the language name, nothing else.`;

/**
 * Detect the language of a user message.
 *
 * Returns null if English (no directive needed), or a language name string
 * for non-English messages.
 *
 * Uses heuristic detection from shared package for non-Latin scripts,
 * with LLM fallback for Latin-script languages.
 *
 * @param userMessage - The user's message text
 * @param env - API environment bindings (needed for LLM calls)
 * @returns Detected language name or null for English
 */
export async function detectLanguage(
  userMessage: string,
  env: ApiEnv['Bindings'],
): Promise<string | null> {
  try {
    // Step 1: Fast heuristic for non-Latin scripts (from shared package)
    const heuristicResult = detectScriptHeuristic(userMessage);

    // Non-Latin script detected — return immediately (zero latency)
    if (heuristicResult && heuristicResult !== 'latin') {
      return heuristicResult;
    }

    // English or ambiguous — null means English (no directive)
    if (heuristicResult === null) {
      return null;
    }

    // Step 2: Latin script detected — use LLM to differentiate English vs other
    initializeOpenRouter(env);

    const result = await openRouterService.generateText({
      maxTokens: 20,
      messages: [
        {
          id: 'msg-lang-detect',
          parts: [{ text: userMessage.slice(0, 500), type: MessagePartTypes.TEXT }],
          role: UIMessageRoles.USER,
        },
      ],
      modelId: LANGUAGE_DETECTION_MODEL_ID,
      system: LANGUAGE_DETECTION_PROMPT,
      temperature: 0,
      traceContext: { distinctId: 'system', operation: 'language-detection' },
    });

    const detected = result.text.trim();

    // English — no directive needed
    if (detected.toLowerCase() === 'english') {
      return null;
    }

    return detected;
  } catch (error) {
    // On failure, don't block the round — just skip language enforcement
    log.ai('warn', 'Language detection failed, skipping language directive', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
