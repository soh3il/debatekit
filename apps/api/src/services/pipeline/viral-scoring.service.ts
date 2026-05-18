/**
 * Viral Scoring Service
 *
 * Scores tweet/content for viral potential (0-100) using AI analysis.
 * Evaluates: hook strength, emotional triggers, curiosity gap,
 * relevance/timeliness, and engagement potential.
 *
 * Uses Gemini 2.5 Flash for fast, cost-effective scoring.
 */

import { ModelIds } from '@debatekit/shared/enums';
import { generateObject } from 'ai';
import { z } from 'zod';

import { getDbAsync } from '@/db';
import { createTracedModel } from '@/lib/analytics/posthog-ai-wrapper';
import { log } from '@/lib/logger';
import { resolveSkillTokens } from '@/services/admin/skill-registry';
import { getAdminSetting } from '@/services/admin-settings.service';
import { initializeOpenRouter, openRouterService } from '@/services/models';
import type { ApiEnv } from '@/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const VIRAL_SCORING_MODEL = ModelIds.GOOGLE_GEMINI_2_5_FLASH;

// ============================================================================
// SCHEMAS
// ============================================================================

const ViralScoreBreakdownSchema = z.object({
  curiosityGap: z.number().int().min(0).max(20),
  emotionalTrigger: z.number().int().min(0).max(20),
  engagementPotential: z.number().int().min(0).max(20),
  hookStrength: z.number().int().min(0).max(20),
  relevanceTimeliness: z.number().int().min(0).max(20),
}).strict();

export type ViralScoreBreakdown = z.infer<typeof ViralScoreBreakdownSchema>;

const _ViralScoreResultSchema = z.object({
  breakdown: ViralScoreBreakdownSchema,
  score: z.number(),
  suggestions: z.array(z.string()),
});

export type ViralScoreResult = z.infer<typeof _ViralScoreResultSchema>;

// Internal schema for AI generation (breakdown + suggestions, score is computed)
const ViralScoreAIResponseSchema = z.object({
  breakdown: ViralScoreBreakdownSchema,
  suggestions: z.array(z.string().min(5).max(300)).min(1).max(3),
}).strict();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Score content for viral potential using AI analysis.
 *
 * @param tweetContent - The tweet or content text to score
 * @param topicContext - Context about the topic for timeliness evaluation
 * @param env - API environment bindings
 * @returns Viral score result with breakdown and improvement suggestions
 */
export async function scoreTweetVirality(
  tweetContent: string,
  topicContext: string,
  env: ApiEnv['Bindings'],
): Promise<ViralScoreResult> {
  initializeOpenRouter(env);
  const client = await openRouterService.getClient();

  const prompt = `Score the viral potential of this content:

Content to score:
"${tweetContent}"

Topic context:
${topicContext}

Provide the breakdown scores and improvement suggestions.`;

  const db = await getDbAsync();
  const dbPrompt = await getAdminSetting(db, 'viralScoringPrompt');
  const viralSystemPrompt = await resolveSkillTokens(dbPrompt, db);

  try {
    const result = await generateObject({
      model: createTracedModel(client.chat(VIRAL_SCORING_MODEL), {
        distinctId: 'system',
        operation: 'viral-scoring',
      }),
      prompt,
      schema: ViralScoreAIResponseSchema,
      system: viralSystemPrompt,
      temperature: 0.4,
    });

    const { breakdown, suggestions } = result.object;

    // Compute total score from breakdown
    const score = breakdown.curiosityGap
      + breakdown.emotionalTrigger
      + breakdown.engagementPotential
      + breakdown.hookStrength
      + breakdown.relevanceTimeliness;

    log.info(`[ViralScoring] Scored content: ${score}/100`);

    return {
      breakdown,
      score,
      suggestions,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`[ViralScoring] Scoring failed: ${errMsg}`);

    // Return a conservative default score on failure
    return {
      breakdown: {
        curiosityGap: 10,
        emotionalTrigger: 10,
        engagementPotential: 10,
        hookStrength: 10,
        relevanceTimeliness: 10,
      },
      score: 50,
      suggestions: ['AI scoring unavailable - manual review recommended'],
    };
  }
}
