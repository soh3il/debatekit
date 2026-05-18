/**
 * LLM Provider Interface
 *
 * Abstracts model generation behind a provider interface.
 * Currently only OpenRouter, but designed for future multi-provider support.
 */

import { z } from 'zod';

// ============================================================================
// Schemas & Types
// ============================================================================

const CHAT_ROLES = ['assistant', 'system', 'user'] as const;

const _ProviderMessageSchema = z.object({
  content: z.string(),
  role: z.enum(CHAT_ROLES),
});
export type ProviderMessage = z.infer<typeof _ProviderMessageSchema>;

const _ProviderResponseSchema = z.object({
  text: z.string(),
  usage: z.object({
    input: z.number(),
    output: z.number(),
  }),
});
export type ProviderResponse = z.infer<typeof _ProviderResponseSchema>;

// ============================================================================
// Provider Interface
// ============================================================================

export type LLMProvider = {
  estimateCost: (
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ) => number;

  generateText: (
    modelId: string,
    messages: ProviderMessage[],
    maxTokens: number,
  ) => Promise<ProviderResponse>;
};
