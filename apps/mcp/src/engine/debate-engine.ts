/**
 * Anonymous Debate Engine
 *
 * Runs a full debatekit round without database persistence.
 * Uses LLM provider abstraction for model generation.
 * Returns complete results as JSON payload.
 *
 * V2: Now uses shared V3.0 prompts from @debatekit/shared/prompts
 * for parity with the web app debate experience.
 */

import { calculateCreditsForModelId } from '@debatekit/shared';
import type { ParticipantResponse } from '@debatekit/shared/prompts';
import { buildCouncilModeratorSystemPrompt, buildParticipantSystemPrompt, detectLanguageHeuristic, PARTICIPANT_ROSTER_PLACEHOLDER } from '@debatekit/shared/prompts';
import { z } from 'zod';

import type { ParticipantResponseSchema, RunDebateOutput } from '../schemas/tool-schemas';
import {
  RunDebateInputSchema,
} from '../schemas/tool-schemas';
import type { Env } from '../types';
import { FORMAT_POSTSCRIPTS, MIN_PARTICIPANTS, THINKING_PRESETS } from './presets';
import { getOrFallback } from './prompt-resolver';
import type { ProviderMessage } from './providers';
import { getProvider } from './providers';

// ============================================================================
// Types (derived from tool-schemas.ts)
// ============================================================================

type DebateParticipant = {
  index: number;
  modelId: string;
  modelName: string;
  role: string | null;
};

type ParticipantResult = z.infer<typeof ParticipantResponseSchema>;

export type DebateResult = RunDebateOutput;

const _RunDebateParamsSchema = RunDebateInputSchema.pick({
  context: true,
  format: true,
  mode: true,
  models: true,
  prompt: true,
  roles: true,
}).extend({
  onProgress: z.optional(z.custom<(message: string) => void>()),
  thinkingLevel: RunDebateInputSchema.shape.thinking_level,
  toolName: z.string().optional(),
  userId: z.string(),
});
type RunDebateParams = z.infer<typeof _RunDebateParamsSchema>;

// ============================================================================
// Model Name Resolution
// ============================================================================

export function extractModelName(modelId: string): string {
  const parts = modelId.split('/');
  const name = parts[parts.length - 1] ?? modelId;
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Core Debate Execution
// ============================================================================

export async function runDebate(params: RunDebateParams, env: Env): Promise<DebateResult> {
  const startTime = Date.now();
  const provider = getProvider(env);
  const preset = THINKING_PRESETS[params.thinkingLevel];

  // Resolve prompt template version (for tracking, future template switching)
  const templateInfo = await getOrFallback(
    env,
    params.toolName ?? 'consult-council',
    'participant_system',
    '',
  ).catch(() => ({ templateId: null, text: '', version: null }));

  // Resolve models
  const modelIds = params.models && params.models.length >= MIN_PARTICIPANTS
    ? params.models
    : preset.defaultModels;

  // Build participant list
  const participants: DebateParticipant[] = modelIds.map((modelId, i) => ({
    index: i,
    modelId,
    modelName: extractModelName(modelId),
    role: params.roles?.[i] ?? null,
  }));

  const roster = participants
    .map(p => p.role ? `${p.role} (${p.modelName})` : p.modelName)
    .join(', ');

  // Detect language from prompt (heuristic only, no LLM call)
  const detectedLanguage = detectLanguageHeuristic(params.prompt);

  // Notify: debate starting
  params.onProgress?.(`Starting debate — ${participants.length} participants (${params.thinkingLevel} thinking, ${params.mode} mode)`);

  // Phase 1: Generate participant responses
  const participantResults: ParticipantResult[] = [];

  const baseUserMessage = params.context
    ? `${params.prompt}\n\n## Context\n${params.context}`
    : params.prompt;

  // Sequential: each participant sees prior responses embedded in a single user message.
  // We consolidate all prior discussion into one user message to maintain strict
  // [system, user] message structure — no back-to-back assistant or user messages.
  const priorResponses: { content: string; role: string }[] = [];

  for (const participant of participants) {
    const rawPrompt = buildParticipantSystemPrompt(participant.role, params.mode, detectedLanguage);
    const systemPrompt = rawPrompt.replace(PARTICIPANT_ROSTER_PLACEHOLDER, roster);

    // Build single user message with prior discussion embedded as context
    let userContent = baseUserMessage;
    if (priorResponses.length > 0) {
      const discussion = priorResponses
        .map(r => `### ${r.role}\n${r.content}`)
        .join('\n\n');
      userContent += `\n\n## Prior Discussion\n${discussion}\n\nNow share your perspective on the discussion above.`;
    }

    const messages: ProviderMessage[] = [
      { content: systemPrompt, role: 'system' },
      { content: userContent, role: 'user' },
    ];

    const result = await provider.generateText(
      participant.modelId,
      messages,
      preset.participantMaxTokens,
    );

    priorResponses.push({
      content: result.text,
      role: participant.role ?? participant.modelName,
    });

    participantResults.push({
      model_id: participant.modelId,
      model_name: participant.modelName,
      response: result.text,
      role: participant.role,
      token_usage: result.usage,
    });

    // Notify: participant completed
    const roleLabel = participant.role ? `${participant.modelName} (${participant.role})` : participant.modelName;
    params.onProgress?.(`${participantResults.length}/${participants.length} responded — ${roleLabel}`);
  }

  // Phase 2: Generate moderator synthesis using shared V3.0 prompt
  const participantResponses: ParticipantResponse[] = participantResults.map((p, i) => ({
    modelId: p.model_id,
    modelName: p.model_name,
    participantIndex: i,
    participantRole: p.role || 'Participant',
    responseContent: p.response,
  }));

  const moderatorBasePrompt = buildCouncilModeratorSystemPrompt(
    1,
    params.mode,
    params.prompt,
    participantResponses,
    undefined,
    detectedLanguage,
  );

  // Append MCP-specific format postscript if non-default format selected
  const formatPostscript = FORMAT_POSTSCRIPTS[params.format] || '';
  const moderatorPrompt = moderatorBasePrompt + formatPostscript;

  // Notify: moderator phase
  params.onProgress?.('Moderator synthesizing...');

  const moderatorResult = await provider.generateText(
    preset.moderatorModel,
    [
      { content: moderatorPrompt, role: 'system' },
      { content: params.prompt, role: 'user' },
    ],
    preset.moderatorMaxTokens,
  );

  // Calculate per-model credits using tier-based multipliers
  const participantCredits = participantResults.reduce(
    (sum, p) => sum + calculateCreditsForModelId(p.token_usage.input + p.token_usage.output, p.model_id),
    0,
  );
  const moderatorCredits = calculateCreditsForModelId(
    moderatorResult.usage.input + moderatorResult.usage.output,
    preset.moderatorModel,
  );
  const totalCredits = participantCredits + moderatorCredits;

  return {
    metadata: {
      duration_ms: Date.now() - startTime,
      format: params.format,
      mode: params.mode,
      prompt_version: templateInfo.version,
      thinking_level: params.thinkingLevel,
      total_credits_used: totalCredits,
    },
    moderator: {
      model_id: preset.moderatorModel,
      summary: moderatorResult.text,
      token_usage: moderatorResult.usage,
    },
    participants: participantResults,
  };
}
