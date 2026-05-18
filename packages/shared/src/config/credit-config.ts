/**
 * Credit Configuration
 *
 * ✅ SINGLE SOURCE OF TRUTH: Credit and plan configuration shared between API and web
 * ✅ NO SERVER-ONLY DEPENDENCIES: Safe for client-side usage
 *
 * Defines credit costs, plan details, and pricing for the billing system.
 */

import type { PlanType } from '../enums';
import {
  MODEL_TIER_CREDIT_MULTIPLIERS,
  ModelPricingTiers,
  PlanTypes,
  SIGNUP_BONUS_CREDITS,
  SubscriptionTiers,
  TIER_MONTHLY_CREDITS,
  TIER_PRICE_CENTS,
} from '../enums';

// ============================================================================
// MCP USAGE LIMITS (per plan type)
// ============================================================================

export const MCP_USAGE_LIMITS = {
  free: {
    cooldownMinutes: 60,
    requestsPerDay: 50,
    requestsPerFiveHours: 15,
    requestsPerWeek: 200,
  },
  paid: {
    cooldownMinutes: 0,
    requestsPerDay: 500,
    requestsPerFiveHours: 100,
    requestsPerWeek: 2000,
  },
} as const satisfies Record<PlanType, {
  requestsPerFiveHours: number;
  requestsPerDay: number;
  requestsPerWeek: number;
  cooldownMinutes: number;
}>;

export const CREDIT_CONFIG = {
  ACTION_COSTS: {
    analysisGeneration: 2000,
    autoModeAnalysis: 500,
    customRoleCreation: 50,
    fileReading: 100,
    // Project feature costs
    memoryExtraction: 100,
    podcastGeneration: 500,
    projectFileLink: 25,
    projectStoragePer10MB: 10,
    ragQuery: 150,
    threadCreation: 100,
    webSearchQuery: 500,
  },
  DEFAULT_ESTIMATED_INPUT_TOKENS: 500,

  DEFAULT_ESTIMATED_TOKENS_PER_RESPONSE: 2000,

  DEFAULT_MODEL_TIER: ModelPricingTiers.STANDARD,

  ESTIMATION_SAFETY_MULTIPLIER: 1.5,

  MIN_CREDITS_FOR_STREAMING: 10,
  PLANS: {
    [PlanTypes.PAID]: {
      monthlyCredits: TIER_MONTHLY_CREDITS[SubscriptionTiers.PRO],
      priceInCents: TIER_PRICE_CENTS[SubscriptionTiers.PRO],
      signupCredits: 0,
    },
  } satisfies Record<Exclude<PlanType, 'free'>, {
    signupCredits: number;
    monthlyCredits: number;
    priceInCents: number;
  }>,

  SIGNUP_CREDITS: SIGNUP_BONUS_CREDITS,

  TIER_MULTIPLIERS: MODEL_TIER_CREDIT_MULTIPLIERS,

  TOKENS_PER_CREDIT: 1000,
} as const;

// ============================================================================
// CREDIT CALCULATION FUNCTIONS
// ============================================================================

export function tokensToCredits(tokens: number) {
  return Math.ceil(tokens / CREDIT_CONFIG.TOKENS_PER_CREDIT);
}

export function creditsToTokens(credits: number) {
  return credits * CREDIT_CONFIG.TOKENS_PER_CREDIT;
}

export function calculateCreditsWithMultiplier(totalTokens: number, multiplier: number) {
  return Math.ceil(totalTokens / CREDIT_CONFIG.TOKENS_PER_CREDIT) * multiplier;
}

export const PLAN_NAMES = {
  [PlanTypes.FREE]: 'Free',
  [PlanTypes.PAID]: 'Pro',
} as const satisfies Record<PlanType, string>;
