/**
 * Provider Registry
 *
 * Factory function to get the appropriate LLM provider.
 * Currently always returns OpenRouter, designed for future expansion.
 */

import type { Env } from '../../types';
import { createOpenRouterProvider } from './openrouter';
import type { LLMProvider } from './types';

export function getProvider(env: Env): LLMProvider {
  return createOpenRouterProvider(env);
}

export type { ProviderMessage } from './types';
