/**
 * PostHog AI Model Wrapper
 *
 * Wraps AI SDK models with @posthog/ai `withTracing` for automatic
 * $ai_generation event capture. No-op in local environment.
 */

import type { LanguageModelV2, LanguageModelV3 } from '@ai-sdk/provider';
import { withTracing } from '@posthog/ai';
import { ulid } from 'ulid';

import { getPostHogClient } from './posthog-server';

type LanguageModel = LanguageModelV2 | LanguageModelV3;

export type TracedModelContext = {
  distinctId: string;
  traceId?: string;
  threadId?: string;
  roundNumber?: number;
  participantIndex?: number;
  participantId?: string;
  operation?: string;
  subscriptionTier?: string;
};

/**
 * Wrap a language model with PostHog tracing for automatic $ai_generation capture.
 * Returns original model if PostHog is unavailable.
 */
export function createTracedModel<T extends LanguageModel>(
  model: T,
  context: TracedModelContext,
): T {
  const posthog = getPostHogClient();

  if (!posthog) {
    return model;
  }

  const traceId = context.traceId ?? generateTraceId();

  return withTracing(model, posthog, {
    posthogDistinctId: context.distinctId,
    posthogProperties: {
      ...(context.operation && { operation: context.operation }),
      ...(context.participantId && { participant_id: context.participantId }),
      ...(context.participantIndex !== undefined && { participant_index: context.participantIndex }),
      ...(context.roundNumber !== undefined && { round_number: context.roundNumber }),
      ...(context.subscriptionTier && { subscription_tier: context.subscriptionTier }),
      ...(context.threadId && { thread_id: context.threadId }),
    },
    posthogTraceId: traceId,
  }) as T;
}

export function generateTraceId() {
  return `trace_${ulid()}`;
}
