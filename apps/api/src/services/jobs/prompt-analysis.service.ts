/**
 * Prompt Analysis Service for Automated Jobs
 *
 * Analyzes prompts to determine optimal configuration for automated conversations.
 * Similar to auto mode but designed for server-side job execution without streaming.
 *
 * Determines:
 * - Model selection (2-3 diverse models)
 * - Conversation mode (brainstorming, debating, analyzing, etc.)
 * - Web search enablement (when current events/data needed)
 */

import type { ChatMode } from '@debatekit/shared/enums';
import { ChatModes, ChatModeSchema, DEFAULT_CHAT_MODE, ModelIds } from '@debatekit/shared/enums';
import { enforceProviderDiversity, extractProvider } from '@debatekit/shared/prompts';
import { z } from 'zod';

import { PROMPT_ANALYSIS_MODEL_ID } from '@/core/ai-models';
import { createTracedModel } from '@/lib/analytics/posthog-ai-wrapper';
import { MAX_JOB_PARTICIPANTS, MIN_PARTICIPANTS_REQUIRED } from '@/lib/config';
import { AI_TIMEOUT_CONFIG } from '@/services/billing';
import type { AnalyzeModelInfo } from '@/services/prompts';
import { buildAnalyzeSystemPrompt } from '@/services/prompts';
import type { ApiEnv } from '@/types';

import { HARDCODED_MODELS, initializeOpenRouter, openRouterService } from '../models';

// Lazy load AI SDK
// Uses Promise caching to avoid race condition (ESLint require-atomic-updates)
let aiSdkModulePromise: Promise<typeof import('ai')> | null = null;

function getAiSdkModule() {
  if (!aiSdkModulePromise) {
    aiSdkModulePromise = import('ai');
  }
  return aiSdkModulePromise;
}

// Schema for AI structured output - same structure as analyze.handler.ts but with job-specific limits
// Uses MAX_JOB_PARTICIPANTS (6) — same global cap as MAX_PARTICIPANTS_LIMIT
const AIAnalysisOutputSchema = z.object({
  dataSources: z.array(z.object({
    id: z.string(),
  })).optional().default([]),
  enableWebSearch: z.boolean(),
  mode: z.string(),
  participants: z.array(z.object({
    modelId: z.string(),
    role: z.string().nullable(),
  }).strict()).min(MIN_PARTICIPANTS_REQUIRED, {
    message: `INVALID: Must include at least ${MIN_PARTICIPANTS_REQUIRED} participants. Multi-AI perspective is mandatory.`,
  }).max(MAX_JOB_PARTICIPANTS),
}).strict();

// Default/fallback config
const DEFAULT_JOB_CONFIG: JobPromptAnalysisResult = {
  enableWebSearch: false,
  mode: ChatModes.BRAINSTORMING,
  modelIds: [ModelIds.GOOGLE_GEMINI_2_5_FLASH, ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.OPENAI_GPT_5_1],
  participants: [
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_FLASH, role: 'Analyst' as const },
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, role: 'Strategist' as const },
    { modelId: ModelIds.OPENAI_GPT_5_1, role: 'Critic' as const },
  ],
  reasoning: 'Default configuration: diverse model selection for balanced perspectives.',
};

// Schema for job participant (modelId + role only, no id needed)
const JobParticipantSchema = z.object({
  modelId: z.string(),
  role: z.string().nullable(),
});

// Schema for job prompt analysis result
const _JobPromptAnalysisResultSchema = z.object({
  dataSources: z.array(z.object({ id: z.string() })).optional(),
  enableWebSearch: z.boolean(),
  mode: ChatModeSchema,
  modelIds: z.array(z.string()),
  participants: z.array(JobParticipantSchema),
  reasoning: z.string(),
});

export type JobPromptAnalysisResult = z.infer<typeof _JobPromptAnalysisResultSchema>;

/**
 * Parses and sanitizes a role name string
 * Accepts any non-empty string role, capped at 40 chars for UI safety
 */
function parseRoleName(role: string | null | undefined): string | null {
  if (!role || typeof role !== 'string') {
    return null;
  }
  const trimmed = role.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 40) : null;
}

function isValidChatMode(mode: string | undefined): mode is ChatMode {
  if (!mode) {
    return false;
  }
  return ChatModeSchema.safeParse(mode).success;
}

function getAvailableModelInfo(): AnalyzeModelInfo[] {
  // For automated jobs, use all user-facing models (admin-level access)
  const userFacingModels = HARDCODED_MODELS.filter(m =>
    m.id.includes('gemini')
    || m.id.includes('claude')
    || m.id.includes('gpt')
    || m.id.includes('grok'),
  );

  return userFacingModels.map((m) => {
    const inputPrice = Number.parseFloat(m.pricing.prompt) * 1_000_000;
    return {
      description: m.description || '',
      hasVision: m.supports_vision,
      id: m.id,
      isFast: inputPrice < 0.5,
      isReasoning: m.is_reasoning_model,
      name: m.name,
      pricingDisplay: m.pricing_display.input,
      provider: m.provider,
    };
  });
}

/**
 * Analyze a prompt to determine optimal job configuration
 *
 * Uses AI to determine:
 * - Which models to use (2-3 diverse models)
 * - What conversation mode fits best
 * - Whether web search should be enabled
 */
export async function analyzePromptForJob(
  prompt: string,
  env: ApiEnv['Bindings'],
): Promise<JobPromptAnalysisResult> {
  try {
    const { generateObject } = await getAiSdkModule();

    initializeOpenRouter(env);
    const client = await openRouterService.getClient();

    // Get available models
    const models = getAvailableModelInfo();
    const accessibleModelIds = models.map(m => m.id);

    // Build system prompt - use job-specific limits for automated jobs
    const systemPrompt = buildAnalyzeSystemPrompt(
      models,
      MAX_JOB_PARTICIPANTS,
      MIN_PARTICIPANTS_REQUIRED,
      Object.values(ChatModes),
      false, // requiresVision
    );

    const result = await generateObject({
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_CONFIG.default),
      model: createTracedModel(client.chat(PROMPT_ANALYSIS_MODEL_ID), { distinctId: 'system', operation: 'prompt-analysis-job' }),
      prompt,
      schema: AIAnalysisOutputSchema,
      system: systemPrompt,
      temperature: 0.3,
    });

    const output = result.object;

    // Validate participants
    const validParticipants: { modelId: string; role: string | null }[] = [];
    const usedModelIds = new Set<string>();

    for (const p of output.participants) {
      if (!p?.modelId) {
        continue;
      }
      if (!accessibleModelIds.includes(p.modelId)) {
        continue;
      }
      if (usedModelIds.has(p.modelId)) {
        continue; // Skip duplicates
      }
      if (validParticipants.length >= MAX_JOB_PARTICIPANTS) {
        break;
      }

      validParticipants.push({
        modelId: p.modelId,
        role: parseRoleName(p.role),
      });
      usedModelIds.add(p.modelId);
    }

    // ✅ ENFORCE PROVIDER DIVERSITY: Ensure at least 2 unique providers
    const diverseParticipants = enforceProviderDiversity(
      validParticipants,
      accessibleModelIds,
      usedModelIds,
    );

    // Update usedModelIds with the diverse set
    usedModelIds.clear();
    for (const p of diverseParticipants) {
      usedModelIds.add(p.modelId);
    }

    // ✅ ENFORCE MINIMUM: Pad with accessible fallback models if below minimum
    // This ensures we ALWAYS have at least MIN_PARTICIPANTS_REQUIRED participants
    if (diverseParticipants.length < MIN_PARTICIPANTS_REQUIRED) {
      const usedProviders = new Set(diverseParticipants.map(p => extractProvider(p.modelId)));
      const availableFallbacks = accessibleModelIds
        .filter(id => !usedModelIds.has(id))
        .sort((a, b) => {
          // Prioritize models from unused providers
          const aIsNew = !usedProviders.has(extractProvider(a));
          const bIsNew = !usedProviders.has(extractProvider(b));
          if (aIsNew && !bIsNew) {
            return -1;
          }
          if (!aIsNew && bIsNew) {
            return 1;
          }
          return 0;
        });

      for (const modelId of availableFallbacks) {
        if (diverseParticipants.length >= MIN_PARTICIPANTS_REQUIRED) {
          break;
        }
        if (diverseParticipants.length >= MAX_JOB_PARTICIPANTS) {
          break;
        }

        diverseParticipants.push({
          modelId,
          role: null,
        });
        usedModelIds.add(modelId);
      }
    }

    // Final fallback if still below minimum (shouldn't happen with valid models)
    if (diverseParticipants.length < MIN_PARTICIPANTS_REQUIRED) {
      return DEFAULT_JOB_CONFIG;
    }

    const validatedMode = isValidChatMode(output.mode) ? output.mode : DEFAULT_CHAT_MODE;

    // Validate dataSources - only allow known registry IDs
    const knownDataSourceIds = new Set(['sec-edgar', 'fred', 'finnhub', 'clinical-trials']);
    const validDataSources = (output.dataSources ?? [])
      .filter(ds => ds?.id && knownDataSourceIds.has(ds.id));

    const analysisResult: JobPromptAnalysisResult = {
      dataSources: validDataSources.length > 0 ? validDataSources : undefined,
      enableWebSearch: output.enableWebSearch ?? false,
      mode: validatedMode,
      modelIds: diverseParticipants.map(p => p.modelId),
      participants: diverseParticipants,
      reasoning: `AI analysis: Selected ${diverseParticipants.length} models for ${validatedMode} mode. Web search: ${output.enableWebSearch ? 'enabled' : 'disabled'}.`,
    };

    return analysisResult;
  } catch {
    return DEFAULT_JOB_CONFIG;
  }
}

/**
 * Re-analyze a follow-up prompt to determine if config should change
 *
 * Used during job continuation to decide if web search should be enabled
 * for a specific round based on the generated prompt content.
 *
 * Returns only web search and mode decisions (models stay the same).
 */
export async function analyzeRoundPrompt(
  prompt: string,
  env: ApiEnv['Bindings'],
): Promise<{ enableWebSearch: boolean; mode: ChatMode }> {
  try {
    const { generateObject } = await getAiSdkModule();

    initializeOpenRouter(env);
    const client = await openRouterService.getClient();

    // Simplified schema for round analysis - just web search and mode
    const RoundAnalysisSchema = z.object({
      enableWebSearch: z.boolean().describe('Enable web search if the prompt asks about current events, recent data, news, or real-time information'),
      mode: z.string().describe('Conversation mode: analyzing, brainstorming, debating, or solving'),
    });

    const systemPrompt = `You are analyzing a follow-up prompt in an ongoing AI discussion.

Determine:
1. enableWebSearch: Set to true if the prompt:
   - Asks about current events, news, or recent happenings
   - Requests up-to-date statistics or data
   - Mentions specific dates, "latest", "current", "recent", "${new Date().getFullYear()}"
   - Asks about real-world facts that may have changed
   - Requests fact-checking or verification
   Set to false for theoretical discussions, creative writing, coding, or general knowledge.

2. mode: Choose the most appropriate:
   - "analyzing": Technical breakdown, research synthesis
   - "brainstorming": Creative exploration, generating ideas
   - "debating": Comparing viewpoints, trade-offs
   - "solving": Moving toward concrete solutions, implementation

Respond with JSON.`;

    const result = await generateObject({
      abortSignal: AbortSignal.timeout(30000), // 30s timeout
      model: createTracedModel(client.chat(PROMPT_ANALYSIS_MODEL_ID), { distinctId: 'system', operation: 'round-analysis-job' }),
      prompt,
      schema: RoundAnalysisSchema,
      system: systemPrompt,
      temperature: 0.2,
    });

    const validatedMode = isValidChatMode(result.object.mode) ? result.object.mode : 'analyzing';

    return {
      enableWebSearch: result.object.enableWebSearch ?? false,
      mode: validatedMode,
    };
  } catch {
    return {
      enableWebSearch: false,
      mode: 'analyzing',
    };
  }
}
