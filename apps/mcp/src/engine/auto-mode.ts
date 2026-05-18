/**
 * MCP Auto Mode
 *
 * Lightweight auto-mode for MCP that uses AI to recommend
 * optimal models, roles, and mode for a given prompt.
 *
 * Uses shared analyze prompt builder from @debatekit/shared/prompts
 * and calls a fast model via the existing OpenRouter client.
 */

import { getMultiplierForModelId, MODEL_ID_TO_TIER } from '@debatekit/shared';
import type { ChatMode, McpThinkingLevel } from '@debatekit/shared/enums';
import { CHAT_MODES, ChatModeSchema, DEFAULT_CHAT_MODE, DEFAULT_MCP_THINKING_LEVEL, McpThinkingLevelSchema } from '@debatekit/shared/enums';
import type { AnalyzeModelInfo } from '@debatekit/shared/prompts';
import { buildAnalyzeSystemPrompt, enforceProviderDiversity, extractProvider } from '@debatekit/shared/prompts';
import { z } from 'zod';

import type { Env } from '../types';
import { extractModelName } from './debate-engine';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, THINKING_PRESETS } from './presets';
import { getProvider } from './providers';

// ============================================================================
// Types
// ============================================================================

export type AutoModeResult = {
  mode: ChatMode;
  models: string[];
  roles: (string | null)[];
  thinkingLevel: McpThinkingLevel;
};

// ============================================================================
// Model Catalog for MCP
// ============================================================================

/**
 * Build model info list from the MCP's known models.
 * Uses MODEL_ID_TO_TIER as the source of available models.
 */
function getMcpModelCatalog(): AnalyzeModelInfo[] {
  return Object.keys(MODEL_ID_TO_TIER).map((id) => {
    const provider = extractProvider(id);
    const name = extractModelName(id);
    const multiplier = getMultiplierForModelId(id);

    return {
      description: name,
      hasVision: false, // MCP doesn't handle vision
      id,
      isFast: multiplier <= 3,
      isReasoning: id.includes('o3') || id.includes('pro'),
      name,
      provider,
    };
  });
}

// ============================================================================
// AI Analysis Output Schema
// ============================================================================

const AutoModeOutputSchema = z.object({
  mode: z.string(),
  participants: z.array(z.object({
    modelId: z.string(),
    role: z.string().nullable(),
  })).min(MIN_PARTICIPANTS).max(MAX_PARTICIPANTS),
  thinking_level: McpThinkingLevelSchema.optional(),
});

// ============================================================================
// Auto Mode Analysis
// ============================================================================

/** Fast model for analysis — cheap and quick */
const ANALYSIS_MODEL = 'google/gemini-2.5-flash';

/**
 * Run auto-mode analysis for MCP.
 * Calls a fast model to recommend optimal config for the given prompt.
 * Falls back to preset defaults on any failure.
 */
export async function analyzeForAutoMode(
  prompt: string,
  thinkingLevel: McpThinkingLevel,
  env: Env,
): Promise<AutoModeResult> {
  const preset = THINKING_PRESETS[thinkingLevel];

  try {
    const models = getMcpModelCatalog();
    const chatModes = [...CHAT_MODES];

    const basePrompt = buildAnalyzeSystemPrompt(
      models,
      MAX_PARTICIPANTS,
      MIN_PARTICIPANTS,
      chatModes,
    );

    const thinkingLevelGuide = `

## THINKING LEVEL RECOMMENDATION

Also recommend a thinking_level based on prompt complexity:
- **low**: Simple factual questions, quick brainstorms, casual topics
- **medium**: Moderate complexity — most coding, architecture, planning tasks
- **high**: Critical decisions, complex architecture, security analysis, deep reasoning

Add "thinking_level": "low" | "medium" | "high" to your JSON output.`;

    const systemPrompt = basePrompt + thinkingLevelGuide;

    const provider = getProvider(env);
    const result = await provider.generateText(
      ANALYSIS_MODEL,
      [
        { content: systemPrompt, role: 'system' },
        { content: prompt, role: 'user' },
      ],
      500,
    );

    // Parse JSON from response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return buildFallback(preset.defaultModels);
    }

    const parsed = AutoModeOutputSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) {
      return buildFallback(preset.defaultModels);
    }

    const data = parsed.data;

    // Validate mode
    const modeResult = ChatModeSchema.safeParse(data.mode);
    const mode = modeResult.success ? modeResult.data : DEFAULT_CHAT_MODE;

    // Validate and filter participants
    const knownModelIds = Object.keys(MODEL_ID_TO_TIER);
    const validParticipants = data.participants
      .filter(p => knownModelIds.includes(p.modelId))
      .slice(0, MAX_PARTICIPANTS);

    if (validParticipants.length < MIN_PARTICIPANTS) {
      return buildFallback(preset.defaultModels);
    }

    // Enforce provider diversity
    const usedModelIds = new Set(validParticipants.map(p => p.modelId));
    const diverseParticipants = enforceProviderDiversity(
      validParticipants,
      knownModelIds,
      usedModelIds,
    );

    const recommendedLevel = data.thinking_level ?? thinkingLevel;

    return {
      mode,
      models: diverseParticipants.map(p => p.modelId),
      roles: diverseParticipants.map(p => p.role),
      thinkingLevel: recommendedLevel,
    };
  } catch (error) {
    console.error('[auto-mode] Analysis failed, using fallback:', error);
    return buildFallback(preset.defaultModels);
  }
}

function buildFallback(defaultModels: string[]): AutoModeResult {
  return {
    mode: DEFAULT_CHAT_MODE,
    models: defaultModels,
    roles: defaultModels.map(() => null),
    thinkingLevel: DEFAULT_MCP_THINKING_LEVEL,
  };
}
