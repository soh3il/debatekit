/**
 * Type-Safe Metadata Builder
 *
 * Enforces all required fields at compile-time via TypeScript.
 * Uses DbAssistantMessageMetadata as single source of truth.
 *
 * PREVENTS: Missing fields that cause schema validation failures
 * ENSURES: Backend and frontend always create valid metadata
 */

import type { ErrorType, FinishReason } from '@debatekit/shared/enums';
import { FinishReasons, MessageRoles, MODERATOR_PARTICIPANT_INDEX } from '@debatekit/shared/enums';
import type { LanguageModelUsage } from 'ai';

import type {
  DbAssistantMessageMetadata,
  DbCitation,
  DbModeratorMessageMetadata,
} from '@/db/schemas/chat-metadata';
import type { RoundNumber } from '@/lib/schemas';
import type { AvailableSource } from '@/types/citations';

// ============================================================================
// Type-Safe Builder Parameters
// ============================================================================

/**
 * Required parameters for creating participant message metadata
 * Note: Optional properties include `| undefined` for exactOptionalPropertyTypes compatibility
 */
export type ParticipantMetadataParams = {
  // Round tracking (0-based: first round is 0)
  roundNumber: RoundNumber;

  // Participant identification
  participantId: string;
  participantIndex: number;
  participantRole: string | null;

  // Model information
  model: string;

  // AI SDK core fields (will have defaults if not provided)
  finishReason?: FinishReason | undefined;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | undefined;

  // Error state (defaults to false if not provided)
  hasError?: boolean | undefined;
  errorType?: ErrorType | undefined;
  errorMessage?: string | undefined;
  errorCategory?: string | undefined;

  // Error flags (defaults to false if not provided)
  isTransient?: boolean | undefined;
  isPartialResponse?: boolean | undefined;

  // Optional backend fields
  providerMessage?: string | undefined;
  openRouterError?: { message: string; code?: string | number; type?: string } | undefined;
  retryAttempts?: number | undefined;
  isEmptyResponse?: boolean | undefined;
  statusCode?: number | undefined;
  responseBody?: string | undefined;
  aborted?: boolean | undefined;
  createdAt?: string | undefined;

  // RAG citations (resolved source references from AI response)
  citations?: DbCitation[] | undefined;

  // Available sources (files/context available to AI, shown even without inline citations)
  availableSources?: AvailableSource[] | undefined;

  // Reasoning duration in seconds (for "Thought for X seconds" display on page refresh)
  reasoningDuration?: number | undefined;
};

// ============================================================================
// Type-Safe Metadata Builder Functions
// ============================================================================

/**
 * Create participant message metadata with type safety
 */
export function createParticipantMetadata(
  params: ParticipantMetadataParams,
): DbAssistantMessageMetadata {
  return {
    // AI SDK fields with defaults
    finishReason: params.finishReason ?? FinishReasons.UNKNOWN,

    hasError: params.hasError ?? false,
    isPartialResponse: params.isPartialResponse ?? false,
    isTransient: params.isTransient ?? false,
    model: params.model,
    participantId: params.participantId,

    participantIndex: params.participantIndex,
    participantRole: params.participantRole,

    role: MessageRoles.ASSISTANT,
    // Required fields (no defaults)
    roundNumber: params.roundNumber,
    usage: params.usage ?? {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0,
    },

    // Optional error details (only present if provided)
    ...(params.errorType && { errorType: params.errorType }),
    ...(params.errorMessage && { errorMessage: params.errorMessage }),
    ...(params.errorCategory && { errorCategory: params.errorCategory }),

    // Optional backend fields (only present if provided)
    ...(params.providerMessage && { providerMessage: params.providerMessage }),
    ...(params.openRouterError && { openRouterError: params.openRouterError }),
    ...(params.retryAttempts !== undefined && {
      retryAttempts: params.retryAttempts,
    }),
    ...(params.isEmptyResponse !== undefined && {
      isEmptyResponse: params.isEmptyResponse,
    }),
    ...(params.statusCode !== undefined && { statusCode: params.statusCode }),
    ...(params.responseBody && { responseBody: params.responseBody }),
    ...(params.aborted !== undefined && { aborted: params.aborted }),
    ...(params.createdAt && { createdAt: params.createdAt }),

    // RAG citations (only present if AI referenced sources)
    ...(params.citations
      && params.citations.length > 0 && { citations: params.citations }),

    // Available sources (files/context available to AI for "Sources" UI)
    ...(params.availableSources
      && params.availableSources.length > 0 && {
      availableSources: params.availableSources,
    }),

    // Reasoning duration (for "Thought for X seconds" display)
    ...(params.reasoningDuration !== undefined
      && params.reasoningDuration > 0 && {
      reasoningDuration: params.reasoningDuration,
    }),
  };
}

/**
 * Update participant metadata with new fields
 * Preserves existing fields while updating specified ones
 */
export function updateParticipantMetadata(
  existing: DbAssistantMessageMetadata,
  updates: Partial<ParticipantMetadataParams>,
): DbAssistantMessageMetadata {
  return createParticipantMetadata({
    aborted: updates.aborted ?? existing.aborted,
    availableSources: updates.availableSources ?? (existing.availableSources as ParticipantMetadataParams['availableSources']),
    citations: updates.citations ?? existing.citations,
    createdAt: updates.createdAt ?? existing.createdAt,
    errorCategory: updates.errorCategory ?? existing.errorCategory,
    errorMessage: updates.errorMessage ?? existing.errorMessage,
    errorType: updates.errorType ?? existing.errorType,
    finishReason: updates.finishReason ?? existing.finishReason,
    hasError: updates.hasError ?? existing.hasError,
    isEmptyResponse: updates.isEmptyResponse ?? existing.isEmptyResponse,
    isPartialResponse: updates.isPartialResponse ?? existing.isPartialResponse,
    isTransient: updates.isTransient ?? existing.isTransient,
    model: existing.model,
    openRouterError: updates.openRouterError ?? existing.openRouterError,
    participantId: existing.participantId,
    participantIndex: existing.participantIndex,
    participantRole: existing.participantRole,
    providerMessage: updates.providerMessage ?? existing.providerMessage,
    reasoningDuration: updates.reasoningDuration ?? existing.reasoningDuration,
    responseBody: updates.responseBody ?? existing.responseBody,
    retryAttempts: updates.retryAttempts ?? existing.retryAttempts,
    roundNumber: existing.roundNumber,
    statusCode: updates.statusCode ?? existing.statusCode,
    usage: updates.usage ?? existing.usage,
  });
}

// ============================================================================
// Streaming-Specific Metadata Builders
// ============================================================================

/**
 * Create initial streaming metadata (before streaming starts)
 * Used in AI SDK messageMetadata callback with type='start'
 */
export function createStreamingMetadata(
  params: Omit<ParticipantMetadataParams, 'finishReason' | 'usage'>,
): DbAssistantMessageMetadata {
  return createParticipantMetadata({
    ...params,
    finishReason: FinishReasons.UNKNOWN,
    usage: {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0,
    },
  });
}

/**
 * Update streaming metadata when stream finishes
 * Used in AI SDK messageMetadata callback with type='finish'
 */
export function completeStreamingMetadata(
  streamMetadata: DbAssistantMessageMetadata,
  finishResult: {
    finishReason: FinishReason;
    usage?: LanguageModelUsage;
    totalUsage?: LanguageModelUsage;
  },
): DbAssistantMessageMetadata {
  const usageData = finishResult.usage || finishResult.totalUsage;
  const promptTokens = usageData?.inputTokens ?? 0;
  const completionTokens = usageData?.outputTokens ?? 0;
  const totalTokens = usageData?.totalTokens;

  return updateParticipantMetadata(streamMetadata, {
    finishReason: finishResult.finishReason,
    usage: usageData
      ? {
          completionTokens,
          promptTokens,
          totalTokens: totalTokens ?? promptTokens + completionTokens,
        }
      : streamMetadata.usage,
  });
}

/**
 * Create assistant message metadata with error state for failed streams
 */
export function createStreamErrorMetadata(
  streamMetadata: DbAssistantMessageMetadata,
  error: {
    message: string;
    errorType?: ErrorType;
    errorCategory?: string;
    isTransient?: boolean;
    statusCode?: number;
    responseBody?: string;
  },
): DbAssistantMessageMetadata {
  return updateParticipantMetadata(streamMetadata, {
    errorCategory: error.errorCategory,
    errorMessage: error.message,
    errorType: error.errorType,
    hasError: true,
    isPartialResponse: false,
    isTransient: error.isTransient ?? false,
    responseBody: error.responseBody,
    statusCode: error.statusCode,
  });
}

// ============================================================================
// Moderator Metadata Builder
// ============================================================================

/**
 * Parameters for creating moderator message metadata
 * Note: Optional properties include `| undefined` for exactOptionalPropertyTypes compatibility
 */
export type ModeratorMetadataParams = {
  // Round tracking (0-based: first round is 0)
  roundNumber: RoundNumber;

  // Model information
  model: string;

  // AI SDK core fields (will have defaults if not provided)
  finishReason?: FinishReason | undefined;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | undefined;

  // Error state (defaults to false if not provided)
  hasError?: boolean | undefined;
  errorMessage?: string | undefined;

  // Optional timestamp
  createdAt?: string | undefined;

  // Available sources (files/context available to AI, shown even without inline citations)
  availableSources?: AvailableSource[] | undefined;
};

/**
 * Create moderator message metadata with type safety
 *
 * IMPORTANT: This function sets isModerator: true and participantIndex: MODERATOR_PARTICIPANT_INDEX (-99)
 * which are REQUIRED for:
 * 1. Frontend to detect moderator messages via isModeratorMessageMetadata()
 * 2. Proper sorting where moderator appears AFTER all participants (not between them)
 *
 * Previously, moderator used createParticipantMetadata with participantIndex: -1,
 * which caused sorting issues after page refresh since -1 sorts BEFORE 0.
 */
export function createModeratorMetadata(
  params: ModeratorMetadataParams,
): DbModeratorMessageMetadata {
  return {
    // Available sources for citation display
    ...(params.availableSources
      && params.availableSources.length > 0 && {
      availableSources: params.availableSources,
    }),

    // Optional timestamp
    ...(params.createdAt && { createdAt: params.createdAt }),

    // Error state
    ...(params.errorMessage && { errorMessage: params.errorMessage }),

    // AI SDK fields with defaults
    finishReason: params.finishReason ?? FinishReasons.UNKNOWN,

    hasError: params.hasError ?? false,
    // CRITICAL: isModerator: true is the discriminator for frontend detection
    isModerator: true,

    model: params.model,
    // CRITICAL: Use MODERATOR_PARTICIPANT_INDEX (-99) for proper sorting
    // -99 sorts AFTER all participants (0, 1, 2, ...) when using Math.abs() or
    // explicit moderator detection in sorting logic
    participantIndex: MODERATOR_PARTICIPANT_INDEX,
    role: MessageRoles.ASSISTANT,
    // Required field (no default)
    roundNumber: params.roundNumber,

    // Usage tracking
    ...(params.usage && { usage: params.usage }),
  };
}
