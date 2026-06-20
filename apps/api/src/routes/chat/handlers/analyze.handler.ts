/**
 * Analyze Handler - Auto Mode Prompt Analysis (Streaming)
 *
 * ✅ STREAMING: Uses streamText with Output.object() for gradual config streaming
 * ✅ PATTERN: Follows pre-search.handler.ts SSE streaming architecture
 *
 * Analyzes user prompts and streams optimal configuration:
 * - Participant models based on user's tier and prompt complexity
 * - Contextual roles for each participant (dynamically generated per prompt)
 * - Chat mode (BRAINSTORMING, ANALYZING, DEBATING, etc.)
 * - Web search enabled/disabled
 *
 * Used by Auto Mode feature for intelligent chat setup.
 */

import type { ChatMode } from '@debatekit/shared/enums';
import {
  AnalyzePromptSseEvents,
  ChatModes,
  ChatModeSchema,
  CreditActions,
  DEFAULT_CHAT_MODE,
  ModelIds,
  SubscriptionTiers,
} from '@debatekit/shared/enums';
import { enforceProviderDiversity, extractProvider } from '@debatekit/shared/prompts';
import type { RouteHandler } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { ulid } from 'ulid';
import * as z from 'zod';

import type { ModelForPricing } from '@/common/schemas/model-pricing';
import { createHandler } from '@/core';
import { PROMPT_ANALYSIS_MODEL_ID } from '@/core/ai-models';
import { createTracedModel } from '@/lib/analytics/posthog-ai-wrapper';
import { MAX_PARTICIPANTS_LIMIT, MIN_PARTICIPANTS_REQUIRED } from '@/lib/config';
import { log } from '@/lib/logger';
import {
  AI_TIMEOUT_CONFIG,
  canAccessModelByPricing,
  checkFreeUserHasCompletedRound,
  enforceCredits,
  finalizeCredits,
  MAX_MODELS_BY_TIER,
} from '@/services/billing';
import { HARDCODED_MODELS, initializeOpenRouter, openRouterService } from '@/services/models';
import type { AnalyzeModelInfo } from '@/services/prompts';
import { buildAnalyzeSystemPrompt } from '@/services/prompts';
import { getUserTier } from '@/services/usage';
import type { ApiEnv } from '@/types';

import type { analyzePromptRoute } from '../route';
import type { AnalyzePromptPayload, PartialAnalysisConfig, RecommendedParticipant } from '../schema';
import { AnalyzePromptRequestSchema } from '../schema';

// ============================================================================
// LAZY AI SDK LOADING
// ============================================================================

// Cache the AI SDK module to avoid repeated dynamic imports
// This is critical for Cloudflare Workers which have a 400ms startup limit
// Uses Promise caching to avoid race condition (ESLint require-atomic-updates)
let aiSdkModulePromise: Promise<typeof import('ai')> | null = null;

function getAiSdkModule() {
  if (!aiSdkModulePromise) {
    aiSdkModulePromise = import('ai');
  }
  return aiSdkModulePromise;
}

async function getAiSdk() {
  return getAiSdkModule();
}

// ============================================================================
// Constants
// ============================================================================

const ANALYSIS_TEMPERATURE = 0.3;

// Fallback config when AI analysis fails
const AUTO_MODE_FALLBACK_CONFIG: {
  participants: { modelId: string; role: string | null }[];
  mode: typeof DEFAULT_CHAT_MODE;
  enableWebSearch: boolean;
  dataSources: { id: string }[];
} = {
  dataSources: [],
  enableWebSearch: false,
  mode: DEFAULT_CHAT_MODE,
  participants: [
    { modelId: ModelIds.OPENAI_GPT_4O_MINI, role: null },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_FLASH, role: null },
    { modelId: ModelIds.X_AI_GROK_4_FAST, role: null },
  ],
};

// ============================================================================
// Zod Schema for AI Structured Output
// ============================================================================

const KNOWN_DATA_SOURCE_IDS = new Set(['sec-edgar', 'fred', 'finnhub', 'clinical-trials']);

const AIAnalysisOutputSchema = z.object({
  dataSources: z.array(z.object({
    id: z.string(),
  })).optional().default([]),
  enableWebSearch: z.boolean(),
  mode: z.string(),
  participants: z.array(z.object({
    modelId: z.string(),
    role: z.string().nullable(),
  })).min(MIN_PARTICIPANTS_REQUIRED, {
    message: `INVALID: Must include at least ${MIN_PARTICIPANTS_REQUIRED} participants. Multi-AI perspective is mandatory.`,
  }).max(MAX_PARTICIPANTS_LIMIT),
}).refine(
  (data) => {
    const modelIds = data.participants.map(p => p.modelId);
    return new Set(modelIds).size === modelIds.length;
  },
  { message: 'INVALID: Each model can only appear ONCE. Duplicate modelIds are forbidden.' },
);

// ============================================================================
// Model Info Helper
// ============================================================================

function getModelInfo(accessibleModelIds: string[]): AnalyzeModelInfo[] {
  return HARDCODED_MODELS
    .filter(m => accessibleModelIds.includes(m.id))
    .map((m) => {
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

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Type guard for ChatMode validation using Zod schema
 */
function isValidChatMode(mode: string | undefined): mode is ChatMode {
  if (!mode) {
    return false;
  }
  return ChatModeSchema.safeParse(mode).success;
}

function validateAndCleanConfig(
  partial: PartialAnalysisConfig,
  accessibleModelIds: string[],
  maxModels: number,
): AnalyzePromptPayload | null {
  // Need accessible models to work with
  if (accessibleModelIds.length === 0) {
    return null;
  }

  // Validate and filter participants
  const validParticipants: RecommendedParticipant[] = [];
  const usedModelIds = new Set<string>();

  // First, collect valid participants from the AI response
  if (partial.participants && partial.participants.length > 0) {
    for (const p of partial.participants) {
      if (!p?.modelId) {
        continue;
      }
      if (!accessibleModelIds.includes(p.modelId)) {
        continue;
      }
      if (usedModelIds.has(p.modelId)) {
        continue; // Skip duplicates
      }
      if (validParticipants.length >= maxModels) {
        break;
      }

      // Accept any non-empty string role, capped at 40 chars for UI safety
      const validatedRole: string | null = p.role && typeof p.role === 'string' && p.role.trim().length > 0
        ? p.role.trim().slice(0, 40)
        : null;

      validParticipants.push({
        modelId: p.modelId,
        role: validatedRole,
      });
      usedModelIds.add(p.modelId);
    }
  }

  // ✅ ENFORCE PROVIDER DIVERSITY: Ensure at least 2 unique providers
  // This prevents AI from selecting both models from same company (e.g., two OpenAI models)
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
  // The moderator requires >= 2 participants to trigger
  if (diverseParticipants.length < MIN_PARTICIPANTS_REQUIRED) {
    // Find accessible models not yet used, prioritizing different providers
    const usedProviders = new Set(diverseParticipants.map(p => extractProvider(p.modelId)));
    const availableFallbacks = accessibleModelIds
      .filter(id => !usedModelIds.has(id))
      .sort((a, b) => {
        // Prioritize models from unused providers
        const providerA = extractProvider(a);
        const providerB = extractProvider(b);
        const aIsNew = !usedProviders.has(providerA);
        const bIsNew = !usedProviders.has(providerB);
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
      if (diverseParticipants.length >= maxModels) {
        break;
      }

      diverseParticipants.push({
        modelId,
        role: null, // Fallback models get no role
      });
      usedModelIds.add(modelId);
      usedProviders.add(extractProvider(modelId));
    }
  }

  // If still below minimum after padding (shouldn't happen with valid accessibleModelIds)
  if (diverseParticipants.length < MIN_PARTICIPANTS_REQUIRED) {
    return null;
  }

  // Type guard narrows partial.mode to ChatMode or uses default
  const validatedMode = isValidChatMode(partial.mode) ? partial.mode : DEFAULT_CHAT_MODE;

  // Validate dataSources - only allow known registry IDs
  const validDataSources = (partial.dataSources ?? [])
    .filter((ds): ds is { id: string } => !!ds?.id && KNOWN_DATA_SOURCE_IDS.has(ds.id));

  return {
    dataSources: validDataSources.length > 0 ? validDataSources : undefined,
    enableWebSearch: partial.enableWebSearch ?? false,
    mode: validatedMode,
    participants: diverseParticipants,
  };
}

// ============================================================================
// Handler
// ============================================================================

export const analyzePromptHandler: RouteHandler<typeof analyzePromptRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'analyzePrompt',
    validateBody: AnalyzePromptRequestSchema,
  },
  async (c) => {
    // ✅ LAZY LOAD AI SDK: Load at handler invocation, not module startup
    const { Output, streamText } = await getAiSdk();

    const { user } = c.auth();
    const {
      accessibleModelIds: clientAccessibleModelIds,
      hasDocumentFiles,
      hasImageFiles,
      prompt,
    } = c.validated.body;

    const requiresVision = hasImageFiles;
    const requiresFile = hasDocumentFiles;

    // Get user tier and model limits
    const userTier = await getUserTier(user.id);
    const maxModels = MAX_MODELS_BY_TIER[userTier] ?? 3;

    // Free users get 1 free round - skip credit enforcement if they haven't used it yet
    const isFreeUser = userTier === SubscriptionTiers.FREE;
    const freeRoundUsed = isFreeUser ? await checkFreeUserHasCompletedRound(user.id) : false;

    // ✅ BILLING: Enforce credits before AI call (actual deduction happens after with real token count)
    // Only enforce if user is paid OR has already used their free round
    const shouldBill = !isFreeUser || freeRoundUsed;
    if (shouldBill) {
      await enforceCredits(user.id, 1, { skipRoundCheck: true });
    }

    // ✅ CLIENT-PROVIDED MODEL LIST: Use client's pre-filtered list when available
    // Client filters by: tier access + vision capability + document capability
    // This ensures AI picks only from models the frontend knows are usable
    let accessibleModelIds: string[];

    log.ai('debug', 'Client provided accessibleModelIds', {
      count: clientAccessibleModelIds?.length ?? 0,
    });

    if (clientAccessibleModelIds && clientAccessibleModelIds.length > 0) {
      // ✅ USE CLIENT LIST: Frontend already filtered by tier and file capabilities
      // Validate that provided IDs exist in HARDCODED_MODELS for security
      const validModelIds = new Set<string>(HARDCODED_MODELS.map(m => m.id));
      accessibleModelIds = clientAccessibleModelIds.filter(id => validModelIds.has(id));

      // If client list is invalid/empty after validation, fall back to server-side filtering
      if (accessibleModelIds.length === 0) {
        accessibleModelIds = getServerFilteredModelIds(userTier, requiresVision, requiresFile);
      }
    } else {
      // ✅ FALLBACK: Server-side filtering (legacy behavior)
      accessibleModelIds = getServerFilteredModelIds(userTier, requiresVision, requiresFile);
    }

    function getServerFilteredModelIds(tier: typeof userTier, vision: boolean, file: boolean): string[] {
      const accessibleModels = HARDCODED_MODELS.filter((model) => {
        const modelForPricing: ModelForPricing = {
          capabilities: model.capabilities,
          context_length: model.context_length,
          created: model.created,
          id: model.id,
          name: model.name,
          pricing: model.pricing,
          pricing_display: model.pricing_display,
          provider: model.provider,
        };
        return canAccessModelByPricing(tier, modelForPricing);
      });

      let filteredModels = accessibleModels;
      if (vision) {
        filteredModels = filteredModels.filter(model => model.supports_vision);
      }
      if (file) {
        filteredModels = filteredModels.filter(model => model.supports_file);
      }

      return filteredModels.map(m => m.id);
    }

    // Build system prompt with user's accessible options
    // ✅ SINGLE SOURCE: Uses buildAnalyzeSystemPrompt from prompts.service.ts
    const models = getModelInfo(accessibleModelIds);
    const systemPrompt = buildAnalyzeSystemPrompt(
      models,
      maxModels,
      MIN_PARTICIPANTS_REQUIRED,
      Object.values(ChatModes),
      requiresVision,
    );

    // ✅ STREAMING: Return SSE stream for gradual config updates
    return streamSSE(c, async (stream) => {
      const startTime = performance.now();

      // Helper for sending SSE events
      const writeSSE = async (event: string, data: string) => {
        await stream.writeSSE({ data, event });
      };

      try {
        // Send start event
        await writeSSE(AnalyzePromptSseEvents.START, JSON.stringify({
          prompt: prompt.substring(0, 100),
          timestamp: Date.now(),
        }));

        // Initialize OpenRouter
        initializeOpenRouter(c.env);
        const client = await openRouterService.getClient();

        // ✅ STREAM: Use streamText with Output.object() for structured output
        const analysisStream = streamText({
          // ✅ STREAMING TIMEOUT: 30 min for prompt analysis
          abortSignal: AbortSignal.timeout(AI_TIMEOUT_CONFIG.default),
          model: createTracedModel(client.chat(PROMPT_ANALYSIS_MODEL_ID), { distinctId: user.id, operation: 'prompt-analysis' }),
          output: Output.object({ schema: AIAnalysisOutputSchema }),
          prompt,
          system: systemPrompt,
          temperature: ANALYSIS_TEMPERATURE,
        });

        // Track best partial result for fallback
        let bestConfig: AnalyzePromptPayload | null = null;
        let lastSentConfig: string | null = null;

        // ✅ INCREMENTAL STREAMING: Stream partial configs as they're generated
        try {
          for await (const partialResult of analysisStream.partialOutputStream) {
            const validated = validateAndCleanConfig(
              partialResult,
              accessibleModelIds,
              maxModels,
            );

            if (validated) {
              bestConfig = validated;
              const configJson = JSON.stringify(validated);

              // Only send if config changed
              if (configJson !== lastSentConfig) {
                lastSentConfig = configJson;
                await writeSSE(AnalyzePromptSseEvents.CONFIG, JSON.stringify({
                  config: validated,
                  partial: true,
                  timestamp: Date.now(),
                }));
              }
            }
          }
        } catch (streamErr) {
          log.ai('error', 'Analyze streaming error', { error: streamErr instanceof Error ? streamErr.message : String(streamErr) });
        }

        // ✅ FINAL: Get complete output
        let finalConfig: AnalyzePromptPayload;
        try {
          const finalOutput = await analysisStream.output;
          const validated = validateAndCleanConfig(
            finalOutput,
            accessibleModelIds,
            maxModels,
          );
          finalConfig = validated ?? bestConfig ?? AUTO_MODE_FALLBACK_CONFIG;
        } catch {
          // Use best partial or fallback
          finalConfig = bestConfig ?? AUTO_MODE_FALLBACK_CONFIG;
        }

        // ✅ BILLING: Deduct credits based on actual token usage
        try {
          const usage = await analysisStream.usage;
          if (usage) {
            const rawInput = usage.inputTokens ?? 0;
            const rawOutput = usage.outputTokens ?? 0;
            const safeInputTokens = Number.isFinite(rawInput) ? rawInput : 0;
            const safeOutputTokens = Number.isFinite(rawOutput) ? rawOutput : 0;

            // Billing deduction
            if (shouldBill && (safeInputTokens > 0 || safeOutputTokens > 0)) {
              c.executionCtx.waitUntil(
                finalizeCredits(user.id, `analyze-prompt-${ulid()}`, {
                  action: CreditActions.AI_RESPONSE,
                  inputTokens: safeInputTokens,
                  modelId: PROMPT_ANALYSIS_MODEL_ID,
                  outputTokens: safeOutputTokens,
                }),
              );
            }
          }
        } catch (billingError) {
          log.billing('error', 'Analyze billing/tracking failed', { error: billingError instanceof Error ? billingError.message : String(billingError) });
        }

        // Send final done event with complete config
        await writeSSE(AnalyzePromptSseEvents.DONE, JSON.stringify({
          config: finalConfig,
          duration: performance.now() - startTime,
          timestamp: Date.now(),
        }));
      } catch (error) {
        log.ai('error', 'Analyze handler error', { error: error instanceof Error ? error.message : String(error) });

        // Send error event with fallback config
        await writeSSE(AnalyzePromptSseEvents.FAILED, JSON.stringify({
          config: AUTO_MODE_FALLBACK_CONFIG,
          error: error instanceof Error ? error.message : 'Analysis failed',
          timestamp: Date.now(),
        }));
      }
    });
  },
);
