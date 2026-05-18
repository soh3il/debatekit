/**
 * OpenRouter Provider
 *
 * Wraps OpenRouter API for multi-model text generation.
 * Extracted from debate-engine.ts for provider abstraction.
 *
 * Features:
 * - reasoning effort control for OpenAI o-series (prevents token exhaustion)
 * - reasoning_content extraction from response
 */

import { calculateCreditsForModelId } from '@debatekit/shared';

import { OpenRouterResponseSchema } from '../../schemas/tool-schemas';
import type { Env } from '../../types';
import type { LLMProvider, ProviderMessage, ProviderResponse } from './types';

// ============================================================================
// Constants
// ============================================================================

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_RETRIES = 2;

// ============================================================================
// Provider Implementation
// ============================================================================

export function createOpenRouterProvider(env: Env): LLMProvider {
  async function generateText(
    modelId: string,
    messages: ProviderMessage[],
    maxTokens: number,
  ): Promise<ProviderResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(OPENROUTER_URL, {
          body: JSON.stringify({
            max_tokens: maxTokens,
            messages,
            model: modelId,
            // Native X/Twitter search for xAI models — OpenRouter enables web_search + x_search
            ...(modelId.startsWith('x-ai/') && { plugins: [{ id: 'web' }] }),
            temperature: 0.7,
          }),
          headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://debatekit.ai',
            'X-Title': 'DebateKit MCP',
          },
          method: 'POST',
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        const raw = await response.json();
        const data = OpenRouterResponseSchema.parse(raw);
        const choice = data.choices[0];

        // Prefer content, fall back to reasoning_content for reasoning-only responses
        const text = choice?.message?.content ?? choice?.message?.reasoning_content;
        if (!text) {
          throw new Error(`Empty response from model ${modelId}`);
        }

        return {
          text,
          usage: {
            input: data.usage?.prompt_tokens ?? 0,
            output: data.usage?.completion_tokens ?? 0,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 1000 * (attempt + 1));
          });
        }
      }
    }

    throw new Error(`Failed after ${MAX_RETRIES + 1} attempts for model ${modelId}: ${lastError?.message}`);
  }

  function estimateCost(modelId: string, inputTokens: number, outputTokens: number) {
    return calculateCreditsForModelId(inputTokens + outputTokens, modelId);
  }

  return {
    estimateCost,
    generateText,
  };
}
