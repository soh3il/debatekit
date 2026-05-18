/**
 * Model Selection Service
 *
 * Analyzes prompts and selects diverse AI models for automated jobs.
 * Uses a fast model to analyze the prompt and pick 2-3 models from USER_FACING_MODEL_IDS.
 */

import { ModelIds } from '@debatekit/shared/enums';
import { z } from 'zod';

import { getDbAsync } from '@/db';
import { resolveSkillTokens } from '@/services/admin/skill-registry';
import { getAdminSetting } from '@/services/admin-settings.service';
import type { ApiEnv } from '@/types';

import { getModelById, openRouterService, USER_FACING_MODEL_IDS } from '../models';

const USER_FACING_MODEL_SET = new Set<string>(USER_FACING_MODEL_IDS);

export type ModelSelectionResult = {
  modelIds: string[];
  reasoning: string;
};

/**
 * Select models for an automated job based on the initial prompt
 *
 * Uses Gemini Flash for fast, cheap analysis to pick 2-3 diverse models.
 */
export async function selectModelsForPrompt(
  prompt: string,
  env: ApiEnv['Bindings'],
): Promise<ModelSelectionResult> {
  // Initialize service if needed
  openRouterService.initialize({
    apiKey: env.OPENROUTER_API_KEY,
  });

  const modelId = ModelIds.GOOGLE_GEMINI_2_5_FLASH;
  const inputMessage = `Select 2-3 AI models for this discussion prompt:\n\n"${prompt}"`;

  const db = await getDbAsync();
  const dbPrompt = await getAdminSetting(db, 'modelSelectionPrompt');
  const modelSystemPrompt = await resolveSkillTokens(dbPrompt, db);

  try {
    const result = await openRouterService.generateText({
      maxTokens: 500,
      messages: [{
        id: 'select-models',
        parts: [{ text: inputMessage, type: 'text' }],
        role: 'user',
      }],
      modelId,
      system: modelSystemPrompt,
      temperature: 0.3,
      traceContext: { distinctId: 'system', operation: 'model-selection' },
    });

    // Parse the JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultSelection();
    }

    const modelSelectionSchema = z.object({
      models: z.array(z.string()),
      reasoning: z.string(),
    });

    const parseResult = modelSelectionSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parseResult.success) {
      return getDefaultSelection();
    }

    const parsed = parseResult.data;

    // Validate model IDs
    const validModels = parsed.models.filter(id =>
      USER_FACING_MODEL_SET.has(id)
      && getModelById(id),
    );

    if (validModels.length < 2) {
      return getDefaultSelection();
    }

    return {
      modelIds: validModels.slice(0, 3),
      reasoning: parsed.reasoning || 'Models selected for diverse perspectives.',
    };
  } catch {
    return getDefaultSelection();
  }
}

/**
 * Default selection when AI selection fails
 */
function getDefaultSelection(): ModelSelectionResult {
  return {
    modelIds: [
      ModelIds.GOOGLE_GEMINI_2_5_PRO,
      ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6,
      ModelIds.OPENAI_GPT_5_1,
    ],
    reasoning: 'Default selection: Gemini Pro (analytical), Claude Sonnet (nuanced), GPT-5 (conversational).',
  };
}
