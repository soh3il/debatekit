/**
 * MCP Evaluation Framework
 *
 * Evaluates debate quality using a fast, cheap model (Gemini Flash).
 * Scores across 5 dimensions with configurable weights.
 * Results persist via session store and track via PostHog.
 */

import { z } from 'zod';

import type { Env } from '../types';

// ============================================================================
// Constants
// ============================================================================

const EVALUATOR_MODEL = 'google/gemini-2.5-flash';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ============================================================================
// Scoring Dimensions
// ============================================================================

const SCORING_DIMENSIONS = ['actionability', 'consensus', 'depth', 'diversity', 'relevance'] as const;
type ScoringDimension = (typeof SCORING_DIMENSIONS)[number];

const DIMENSION_WEIGHTS: Record<ScoringDimension, number> = {
  actionability: 0.25,
  consensus: 0.15,
  depth: 0.15,
  diversity: 0.15,
  relevance: 0.30,
};

// ============================================================================
// Schemas
// ============================================================================

const DimensionScoreSchema = z.object({
  explanation: z.string(),
  score: z.number().min(0).max(10),
});

const DimensionsSchema = z.object({
  actionability: DimensionScoreSchema,
  consensus: DimensionScoreSchema,
  depth: DimensionScoreSchema,
  diversity: DimensionScoreSchema,
  relevance: DimensionScoreSchema,
});

const EvaluationResultSchema = z.object({
  compositeScore: z.number().min(0).max(10),
  dimensions: DimensionsSchema,
  summary: z.string(),
});
type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

const LLMEvaluationResponseSchema = z.object({
  dimensions: DimensionsSchema,
  summary: z.string(),
});

const OpenRouterEvalResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }),
  })).min(1),
});

// ============================================================================
// Composite Score Calculation
// ============================================================================

function computeCompositeScore(dimensions: EvaluationResult['dimensions']) {
  let total = 0;
  for (const dim of SCORING_DIMENSIONS) {
    total += dimensions[dim].score * DIMENSION_WEIGHTS[dim];
  }
  return Math.round(total * 100) / 100;
}

// ============================================================================
// Evaluation Prompt
// ============================================================================

function buildEvaluationPrompt(prompt: string, moderatorSummary: string, participantCount: number) {
  return `You are an AI debate quality evaluator. Evaluate the following council discussion output.

## Original Question
${prompt}

## Council Output (Moderator Summary)
${moderatorSummary}

## Participants
${participantCount} models participated in this discussion.

## Scoring Instructions
Rate each dimension from 0-10 with a brief explanation:

1. **relevance** (weight: 30%): Does the output directly address the user's question? Is it on-topic and useful?
2. **actionability** (weight: 25%): Can the user act on this output? Are there concrete recommendations, steps, or decisions?
3. **consensus** (weight: 15%): Did the moderator identify clear points of agreement and disagreement? Is the synthesis balanced?
4. **diversity** (weight: 15%): Did different participants bring genuinely different perspectives? Was there meaningful disagreement?
5. **depth** (weight: 15%): Is the analysis substantive? Does it go beyond surface-level observations?

Respond with ONLY valid JSON in this exact format:
{
  "dimensions": {
    "actionability": { "score": <0-10>, "explanation": "<brief>" },
    "consensus": { "score": <0-10>, "explanation": "<brief>" },
    "depth": { "score": <0-10>, "explanation": "<brief>" },
    "diversity": { "score": <0-10>, "explanation": "<brief>" },
    "relevance": { "score": <0-10>, "explanation": "<brief>" }
  },
  "summary": "<1-2 sentence overall assessment>"
}`;
}

// ============================================================================
// LLM-Based Evaluation
// ============================================================================

async function evaluateDebate(
  env: Env,
  prompt: string,
  moderatorSummary: string,
  participantCount: number,
) {
  const evalPrompt = buildEvaluationPrompt(prompt, moderatorSummary, participantCount);

  const response = await fetch(OPENROUTER_URL, {
    body: JSON.stringify({
      max_tokens: 500,
      messages: [
        { content: 'You are a precise evaluation assistant. Always respond with valid JSON only.', role: 'system' },
        { content: evalPrompt, role: 'user' },
      ],
      model: EVALUATOR_MODEL,
      temperature: 0.3,
    }),
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://debatekit.ai',
      'X-Title': 'DebateKit MCP Evaluator',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Evaluator API error (${response.status}): ${await response.text()}`);
  }

  const raw = await response.json();
  const parsed = OpenRouterEvalResponseSchema.parse(raw);
  const firstChoice = parsed.choices[0];
  if (!firstChoice) {
    throw new Error('Empty evaluator response: no choices returned');
  }
  const content = firstChoice.message.content;

  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const evaluation = LLMEvaluationResponseSchema.parse(JSON.parse(cleaned));
  const compositeScore = computeCompositeScore(evaluation.dimensions);

  return EvaluationResultSchema.parse({
    compositeScore,
    dimensions: evaluation.dimensions,
    summary: evaluation.summary,
  });
}

// ============================================================================
// Full Evaluation Pipeline
// ============================================================================

export async function runEvaluation(
  env: Env,
  userId: string,
  sessionId: string,
  prompt: string,
  moderatorSummary: string,
  participantCount: number,
) {
  const { updateQualityScore } = await import('./session-store');

  try {
    const result = await evaluateDebate(env, prompt, moderatorSummary, participantCount);

    // Persist score to session (0-100 scale)
    await updateQualityScore(env, userId, sessionId, Math.round(result.compositeScore * 10), 'completed');

    return result;
  } catch (error) {
    console.error('[evaluator] Evaluation failed:', error);

    // Mark session as evaluation failed
    await updateQualityScore(env, userId, sessionId, 0, 'failed').catch(() => {});

    return null;
  }
}
