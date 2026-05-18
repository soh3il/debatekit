/**
 * PostHog Product Event Tracking
 *
 * Thread and participant lifecycle events for product analytics.
 * LLM generation tracking is handled automatically by @posthog/ai `withTracing`.
 *
 * @see posthog-ai-wrapper.ts for $ai_generation event capture
 */

import { getPostHogClient } from '@/lib/analytics';

/**
 * Track thread creation event
 */
export async function trackThreadCreated(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    threadMode: string;
    userTier?: string;
  },
  params: {
    participantCount: number;
    enableWebSearch: boolean;
    models: string[];
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'thread_created',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        enable_web_search: params.enableWebSearch,
        models: params.models,
        participant_count: params.participantCount,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
        thread_mode: context.threadMode,
        unique_models: [...new Set(params.models)].length,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track thread deletion event
 */
export async function trackThreadDeleted(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    threadMode: string;
    threadAge: number; // milliseconds since creation
    roundCount: number;
    messageCount: number;
    participantCount: number;
    hadWebSearch: boolean;
    wasPublic: boolean;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'thread_deleted',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        had_web_search: params.hadWebSearch,
        message_count: params.messageCount,
        participant_count: params.participantCount,
        round_count: params.roundCount,
        subscription_tier: context.userTier || 'free',
        thread_age_hours: params.threadAge / (1000 * 60 * 60),
        thread_age_ms: params.threadAge,
        thread_id: context.threadId,
        thread_mode: params.threadMode,
        was_public: params.wasPublic,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track thread update event
 */
export async function trackThreadUpdated(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    changeType: 'mode_change' | 'web_search_toggle' | 'visibility_change' | 'title_change' | 'favorite_toggle' | 'project_assignment';
    oldValue?: string | boolean | null;
    newValue?: string | boolean | null;
    roundNumber?: number;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'thread_updated',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        change_type: params.changeType,
        new_value: params.newValue,
        old_value: params.oldValue,
        round_number: params.roundNumber,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track participant added event
 */
export async function trackParticipantAdded(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    participantId: string;
    modelId: string;
    role: string | null;
    participantCount: number; // total after adding
    isInitialSetup: boolean; // true if added during thread creation
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    const provider = params.modelId.split('/')[0] || 'unknown';
    const modelName = params.modelId.split('/').pop() || params.modelId;

    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'participant_added',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        is_initial_setup: params.isInitialSetup,
        model_id: params.modelId,
        model_name: modelName,
        model_provider: provider,
        participant_count: params.participantCount,
        participant_id: params.participantId,
        role: params.role,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track participant removed event
 */
export async function trackParticipantRemoved(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    participantId: string;
    modelId: string;
    role: string | null;
    participantCount: number; // total after removing
    roundsParticipated: number; // how many rounds this participant was in
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    const provider = params.modelId.split('/')[0] || 'unknown';
    const modelName = params.modelId.split('/').pop() || params.modelId;

    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'participant_removed',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        model_id: params.modelId,
        model_name: modelName,
        model_provider: provider,
        participant_count: params.participantCount,
        participant_id: params.participantId,
        role: params.role,
        rounds_participated: params.roundsParticipated,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track participant updated event
 */
export async function trackParticipantUpdated(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    participantId: string;
    modelId: string;
    changeType: 'role_change' | 'priority_change' | 'settings_change' | 'enabled_toggle';
    oldValue?: string | number | boolean | null;
    newValue?: string | number | boolean | null;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    const modelName = params.modelId.split('/').pop() || params.modelId;

    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'participant_updated',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        change_type: params.changeType,
        model_id: params.modelId,
        model_name: modelName,
        new_value: params.newValue,
        old_value: params.oldValue,
        participant_id: params.participantId,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

// ============================================================================
// Streaming Phase Lifecycle Events
// ============================================================================

/**
 * Track round started event - fired when a streaming round begins execution
 */
export async function trackRoundStarted(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    roundNumber: number;
    participantCount: number;
    hasWebSearch: boolean;
    threadMode: string | null;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'round_started',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        has_web_search: params.hasWebSearch,
        participant_count: params.participantCount,
        round_number: params.roundNumber,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
        thread_mode: params.threadMode || 'unknown',
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track round completed event - fired when all phases finish successfully
 */
export async function trackRoundCompleted(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    roundNumber: number;
    participantCount: number;
    durationMs: number;
    hadPresearch: boolean;
    hadModerator: boolean;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'round_completed',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        duration_ms: params.durationMs,
        duration_seconds: params.durationMs / 1000,
        had_moderator: params.hadModerator,
        had_presearch: params.hadPresearch,
        participant_count: params.participantCount,
        round_number: params.roundNumber,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track presearch completed event - fired when web search phase finishes
 */
export async function trackPresearchCompleted(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    roundNumber: number;
    queryCount: number;
    resultCount: number;
    durationMs: number;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'presearch_completed',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        duration_ms: params.durationMs,
        duration_seconds: params.durationMs / 1000,
        query_count: params.queryCount,
        result_count: params.resultCount,
        round_number: params.roundNumber,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track stream error event - fired when any streaming phase encounters an error
 */
export async function trackStreamError(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    roundNumber: number;
    phase: 'presearch' | 'participant' | 'moderator';
    errorType: string;
    modelId?: string;
    participantId?: string;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'stream_error',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        error_type: params.errorType,
        model_id: params.modelId,
        participant_id: params.participantId,
        phase: params.phase,
        round_number: params.roundNumber,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track AI call failure event.
 * Captures when a streamText/generateText call fails during round execution.
 * More granular than trackStreamError -- includes model ID, provider, and error message.
 */
export async function trackAiCallFailed(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    roundNumber: number;
    modelId: string;
    operation: 'participant' | 'moderator' | 'presearch' | 'analysis';
    errorType: string;
    errorMessage: string;
    participantId?: string;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    const provider = params.modelId.split('/')[0] || 'unknown';
    const modelName = params.modelId.split('/').pop() || params.modelId;

    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'ai_call_failed',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        error_message: params.errorMessage.slice(0, 500),
        error_type: params.errorType,
        model_id: params.modelId,
        model_name: modelName,
        model_provider: provider,
        operation: params.operation,
        ...(params.participantId && { participant_id: params.participantId }),
        round_number: params.roundNumber,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}

/**
 * Track thread shared event
 */
export async function trackThreadShared(
  context: {
    userId: string;
    sessionId?: string;
    threadId: string;
    userTier?: string;
  },
  params: {
    slug: string;
    roundCount: number;
    participantCount: number;
    messageCount: number;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: context.sessionId || context.userId,
      event: 'thread_shared',
      properties: {
        ...(context.sessionId && { $session_id: context.sessionId }),
        message_count: params.messageCount,
        participant_count: params.participantCount,
        round_count: params.roundCount,
        slug: params.slug,
        subscription_tier: context.userTier || 'free',
        thread_id: context.threadId,
      },
    });

    await posthog.flush();
  } catch {
    // Silently fail
  }
}
