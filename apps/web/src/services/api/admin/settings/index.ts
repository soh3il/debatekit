/**
 * Admin Settings Service
 *
 * 100% type-safe RPC service for admin settings operations.
 * Types fully inferred from backend via Hono RPC - no hardcoded types.
 */

import { ADMIN_SETTINGS_LIMITS } from '@debatekit/shared';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';
import { z } from 'zod';

import type { ApiClientType } from '@/lib/api/client';
import { createApiClient } from '@/lib/api/client';
import type { ServiceOptions } from '@/services/api/types';

// ============================================================================
// Type Inference - Endpoint definitions
// ============================================================================

type GetAdminSettingsEndpoint = ApiClientType['admin']['admin']['settings']['$get'];
type UpdateAdminSettingsEndpoint = ApiClientType['admin']['admin']['settings']['$patch'];

// ============================================================================
// Type Exports - Request/Response types inferred from backend
// ============================================================================

// Get admin settings
export type AdminSettingsResponse = InferResponseType<GetAdminSettingsEndpoint, 200>;
type AdminSettingsSuccessResponse = Extract<AdminSettingsResponse, { success: true }>;
export type AdminSettings = AdminSettingsSuccessResponse['data'];

// Update admin settings
export type UpdateAdminSettingsParams = InferRequestType<UpdateAdminSettingsEndpoint>['json'];
export type UpdateAdminSettingsResponse = InferResponseType<UpdateAdminSettingsEndpoint, 200>;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get admin settings (admin only)
 */
export async function getAdminSettingsService(options?: ServiceOptions) {
  const client = createApiClient({ cookieHeader: options?.cookieHeader });
  return parseResponse(client.admin.admin.settings.$get({}));
}

/**
 * Update admin settings (admin only)
 */
export async function updateAdminSettingsService(params: { json: UpdateAdminSettingsParams }) {
  const client = createApiClient();
  return parseResponse(client.admin.admin.settings.$patch({ json: params.json }));
}

// ============================================================================
// Form Schema & Defaults
// ============================================================================

const L = ADMIN_SETTINGS_LIMITS;

export const AdminSettingsFormSchema = z.object({
  autoTweetEnabled: z.boolean(),
  dailyJobLimit: z.number().int().min(L.DAILY_JOB_LIMIT_MIN).max(L.DAILY_JOB_LIMIT_MAX),
  dailyTweetLimit: z.number().int().min(L.DAILY_TWEET_LIMIT_MIN).max(L.DAILY_TWEET_LIMIT_MAX),
  defaultRoundCount: z.number().int().min(L.DEFAULT_ROUND_COUNT_MIN).max(L.DEFAULT_ROUND_COUNT_MAX),
  keywordGenerationPrompt: z.string().max(L.PIPELINE_PROMPT_MAX),
  modelSelectionPrompt: z.string().max(L.PIPELINE_PROMPT_MAX),
  participantBehaviorPrompt: z.string().max(L.PIPELINE_PROMPT_MAX),
  pipelineEnabled: z.boolean(),
  roundPromptGeneration: z.string().max(L.PIPELINE_PROMPT_MAX),
  systemPrompt: z.string().max(L.SYSTEM_PROMPT_MAX),
  topicGuidance: z.string().max(L.TOPIC_GUIDANCE_MAX),
  trendExtractionPrompt: z.string().max(L.PIPELINE_PROMPT_MAX),
  tweetSkillsPrompt: z.string().max(L.TWEET_SKILLS_PROMPT_MAX),
  tweetSystemPrompt: z.string().max(L.TWEET_SYSTEM_PROMPT_MAX),
  viralScoreThreshold: z.number().int().min(L.VIRAL_SCORE_MIN).max(L.VIRAL_SCORE_MAX),
  viralScoringPrompt: z.string().max(L.PIPELINE_PROMPT_MAX),
});

export type AdminSettingsFormValues = z.infer<typeof AdminSettingsFormSchema>;

export const ADMIN_SETTINGS_DEFAULTS: AdminSettingsFormValues = {
  autoTweetEnabled: true,
  dailyJobLimit: 10,
  dailyTweetLimit: 5,
  defaultRoundCount: 3,
  keywordGenerationPrompt: '',
  modelSelectionPrompt: '',
  participantBehaviorPrompt: '',
  pipelineEnabled: false,
  roundPromptGeneration: '',
  systemPrompt: '',
  topicGuidance: '',
  trendExtractionPrompt: '',
  tweetSkillsPrompt: '',
  tweetSystemPrompt: '',
  viralScoreThreshold: 60,
  viralScoringPrompt: '',
};
