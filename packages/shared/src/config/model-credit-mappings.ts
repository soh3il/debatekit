/**
 * Model ID → Pricing Tier Mapping
 *
 * Maps known OpenRouter model IDs to their ModelPricingTier,
 * then uses getModelTierMultiplier() for the credit multiplier.
 *
 * ✅ SINGLE SOURCE OF TRUTH: Used by both apps/api and apps/mcp
 */

import type { ModelPricingTier } from '../enums';
import { DEFAULT_MODEL_PRICING_TIER, getModelTierMultiplier, ModelPricingTiers } from '../enums';
import { calculateCreditsWithMultiplier } from './credit-config';

export const MODEL_ID_TO_TIER: Record<string, ModelPricingTier> = {
  'anthropic/claude-opus-4.6': ModelPricingTiers.ULTIMATE, // $5/M → 200x
  'anthropic/claude-sonnet-4': ModelPricingTiers.FLAGSHIP, // $3/M → 75x
  'anthropic/claude-sonnet-4.6': ModelPricingTiers.FLAGSHIP, // $3/M → 75x
  'deepseek/deepseek-v3.2': ModelPricingTiers.STANDARD, // $0.25/M → 3x
  'deepseek/deepseek-v3.2-speciale': ModelPricingTiers.STANDARD, // $0.40/M → 3x
  'google/gemini-2.5-flash': ModelPricingTiers.STANDARD, // $0.30/M → 3x
  'google/gemini-2.5-pro': ModelPricingTiers.PRO, // $1.25/M → 25x
  'google/gemini-3.1-flash-lite-preview': ModelPricingTiers.STANDARD, // $0.25/M → 3x
  'mistralai/ministral-3b-2512': ModelPricingTiers.BUDGET, // $0.10/M → 1x
  'openai/gpt-4.1': ModelPricingTiers.FLAGSHIP, // $2/M → 75x
  'openai/gpt-4o-mini': ModelPricingTiers.STANDARD, // $0.15/M → 3x
  'openai/gpt-5.3-codex': ModelPricingTiers.PRO, // $1.75/M → 25x
  'openai/gpt-5.4': ModelPricingTiers.FLAGSHIP, // $2.50/M → 75x
  'openai/o3': ModelPricingTiers.ULTIMATE, // $10/M → 200x
};

export function getMultiplierForModelId(modelId: string) {
  const tier = MODEL_ID_TO_TIER[modelId] ?? DEFAULT_MODEL_PRICING_TIER;
  return getModelTierMultiplier(tier);
}

export function calculateCreditsForModelId(totalTokens: number, modelId: string) {
  return calculateCreditsWithMultiplier(totalTokens, getMultiplierForModelId(modelId));
}
