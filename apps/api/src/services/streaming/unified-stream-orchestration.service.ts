/**
 * Unified Stream Orchestration Service
 *
 * Orchestrates entire round execution using AI SDK v6 createUIMessageStream,
 * executing presearch -> participants -> moderator phases sequentially while
 * emitting to a single unified stream compatible with AI SDK useChat.
 *
 * **KEY ARCHITECTURE (AI SDK v6 Native)**:
 * - Uses `createUIMessageStream` with manual `writer.write()` pattern
 * - Phase transitions sent as custom data parts (`type: 'data-phase'`)
 * - Each `streamText` result iterated via `fullStream` and written event-by-event
 * - Compatible with `useChat({ resume: true })` on frontend
 *
 * **PHASE FLOW**:
 * - Presearch (optional): Web search phase
 * - Participants (sequential): P0 -> P1 -> ... -> Pn, each sees prior responses
 * - Moderator: Synthesizes all participant responses
 *
 * @module api/services/streaming/unified-stream-orchestration
 * @see /docs/backend-patterns.md for streaming patterns
 */

import { availableSourcesArtifact, presearchArtifact } from '@debatekit/shared/artifacts';
import type { ChatMode, DataSourceId, SubscriptionTier, ThreadVerticalMetadata } from '@debatekit/shared/enums';
import {
  DATA_SOURCE_LABELS,
  FinishReasons,
  FinishReasonSchema,
  MessagePartTypes,
  MessageRoles,
  MessageStatuses,
  StreamPhases,
} from '@debatekit/shared/enums';
import type {
  DomainSourceProgressData,
  PhaseMarkerData,
  PresearchQueryData,
  PresearchResultData,
  RoundCompleteData,
  StreamPhase,
  UnifiedMessageMetadata,
  UnifiedStreamDataTypes,
} from '@debatekit/shared/types';
import { AiSdkPhaseStatuses, UnifiedPhaseStatuses } from '@debatekit/shared/types';
import type { ModelMessage, UIMessage, UIMessageStreamWriter, UserContent } from 'ai';
import { and, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';

import { invalidateMessagesCache } from '@/common/cache-utils';
import { COUNCIL_MODERATOR_MODEL_ID } from '@/core/ai-models';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import { DbMessagePartsSchema, DbPreSearchTableDataSchema } from '@/db/schemas/chat-metadata';
import { createTracedModel } from '@/lib/analytics';
import { generateTraceId } from '@/lib/analytics/posthog-ai-wrapper';
import { createModeratorMetadata, createParticipantMetadata } from '@/lib/utils';
import { parseCitations } from '@/lib/utils/citation-parser';
import { rlog } from '@/lib/utils/dev-logger';
import type { ValidatedPreSearchData, WebSearchResultItem } from '@/routes/chat/schema';
import { WebSearchParametersSchema } from '@/routes/chat/schema';
import { resolveSkillTokens } from '@/services/admin/skill-registry';
import { getAdminSetting } from '@/services/admin-settings.service';
import { getMaxOutputTokensForTier } from '@/services/billing';
import {
  trackAiCallFailed,
  trackPresearchCompleted,
  trackRoundCompleted,
  trackRoundStarted,
  trackStreamError,
} from '@/services/errors/posthog-llm-tracking.service';
import { buildCitableContext, buildFilePartCitationContext, loadAttachmentContent } from '@/services/messages';
import { buildOpenRouterOptions, getModelById } from '@/services/models/models-config.service';
import type { DetectedLanguage } from '@/services/prompts/language-detection';
import { detectLanguage } from '@/services/prompts/language-detection';
import type { ParticipantResponse } from '@/services/prompts/prompts.service';
import {
  buildCouncilModeratorSystemPrompt,
  buildParticipantSystemPrompt,
  getModeratorFormatSection,
  PARTICIPANT_ROSTER_PLACEHOLDER,
} from '@/services/prompts/prompts.service';
import { extractMultipleUrls } from '@/services/search/content-extraction.service';
import type { SearchContextResult } from '@/services/search/search-context-builder';
import { buildDirectSearchContext } from '@/services/search/search-context-builder';
import { generateSearchQuery, performWebSearch } from '@/services/search/web-search.service';
import type { ApiEnv } from '@/types';
import type { AvailableSource, CitableSource, CitationSourceMap } from '@/types/citations';
import type { TypedLogger } from '@/types/logger';
import { LogHelpers } from '@/types/logger';
import type { LoadAttachmentContentResult } from '@/types/uploads';

import { loadAndPruneConversationHistory } from './conversation-history.service';
import { extractReadableModelName } from './stream-utils';
import type { RedisEnv } from './unified-redis-stream-buffer.service';
import {
  appendUnifiedChunk,
  completeUnifiedStream,
  emitPhaseTransition,
  failUnifiedStream,
} from './unified-redis-stream-buffer.service';

// ============================================================================
// PROJECT CONTEXT LIMITS
// ============================================================================

/**
 * Maximum character length for project context appended to system prompts.
 * Project sub-threads accumulate context from working memory, cross-chat
 * messages, moderator analyses, search results, and file attachments.
 * Without a cap, this context can grow to 10K+ chars (~2500+ tokens),
 * compressing the model's output token budget and causing truncated or
 * empty participant responses.
 *
 * 4000 chars ≈ ~1000 tokens — enough for meaningful context without
 * starving the model of output room.
 */
const MAX_PROJECT_CONTEXT_CHARS = 4000;

// ============================================================================
// AI SDK CUSTOM UIMESSAGE TYPE
// ============================================================================

/**
 * Custom UIMessage type with our data part schemas and message metadata.
 * This enables type-safe writer.write() calls with custom data and message boundaries.
 */
type UnifiedUIMessage = UIMessage<UnifiedMessageMetadata, UnifiedStreamDataTypes>;

// ============================================================================
// LAZY AI SDK LOADING
// ============================================================================

/**
 * AI SDK is lazy-loaded to reduce worker startup CPU time.
 * Critical for Cloudflare Workers which have a 400ms startup limit.
 */
/**
 * Schema for serialized error log entries.
 *
 * Discriminated union: Error instances produce a structured entry with
 * message/name/cause (and optional AI SDK APICallError fields), while
 * non-Error values produce a raw string representation.
 */
const _SerializedErrorLogSchema = z.discriminatedUnion('_kind', [
  z.object({
    _kind: z.literal('error'),
    cause: z.string().optional(),
    data: z.string().optional(),
    message: z.string(),
    name: z.string(),
    responseBody: z.string().optional(),
    statusCode: z.number().optional(),
  }),
  z.object({
    _kind: z.literal('raw'),
    raw: z.string(),
  }),
]);

type SerializedErrorLog = z.infer<typeof _SerializedErrorLogSchema>;

/**
 * AI SDK APICallError shape for runtime property access.
 * Validated via Zod safeParse rather than `as` casting.
 */
const ApiCallErrorFieldsSchema = z.object({
  data: z.unknown().optional(),
  isRetryable: z.boolean().optional(),
  responseBody: z.string().optional(),
  statusCode: z.number().optional(),
});

/** Serialize an unknown error for structured logging. Handles Error instances (including AI SDK APICallError), plain objects, and primitives. */
function serializeErrorForLog(error: unknown): SerializedErrorLog {
  if (error instanceof Error) {
    const base: SerializedErrorLog = {
      _kind: 'error',
      cause: error.cause !== undefined ? String(error.cause) : undefined,
      message: error.message,
      name: error.name,
    };
    // AI SDK APICallError exposes statusCode, responseBody, and data for provider errors
    const apiErrorResult = ApiCallErrorFieldsSchema.safeParse(error);
    if (apiErrorResult.success) {
      const apiError = apiErrorResult.data;
      if (apiError.statusCode !== undefined) {
        base.statusCode = apiError.statusCode;
      }
      if (apiError.responseBody !== undefined) {
        base.responseBody = apiError.responseBody.length > 500
          ? `${apiError.responseBody.slice(0, 500)}...`
          : apiError.responseBody;
      }
      if (apiError.data !== undefined) {
        base.data = JSON.stringify(apiError.data);
      }
    }
    return base;
  }
  return { _kind: 'raw', raw: (error !== null && error !== undefined && typeof error === 'object') ? JSON.stringify(error) : String(error) };
}

let aiSdkModulePromise: Promise<typeof import('ai')> | null = null;

function getAiSdkModule() {
  if (!aiSdkModulePromise) {
    aiSdkModulePromise = import('ai');
  }
  return aiSdkModulePromise;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Participant configuration for unified round stream
 */
export type UnifiedParticipant = {
  id: string;
  modelId: string;
  systemPrompt?: string;
  role?: string | null;
  index: number;
};

/**
 * Parameters for unified round stream execution
 */
export type UnifiedRoundStreamParams = {
  threadId: string;
  roundNumber: number;
  userMessage: string;
  enableWebSearch: boolean;
  participants: UnifiedParticipant[];
  env: ApiEnv['Bindings'];
  userId?: string;
  sessionId?: string;
  executionCtx?: ExecutionContext;
  logger?: TypedLogger;
  /** Thread mode for mode-specific prompts (ANALYZING, BRAINSTORMING, DEBATING, SOLVING) */
  mode?: ChatMode | null;
  /** Database connection for citation context loading */
  db?: Awaited<ReturnType<typeof getDbAsync>>;
  /** Project ID for loading project context (memories, threads, attachments) */
  projectId?: string | null;
  /** Base URL for generating citation download links */
  baseUrl?: string;
  /** Optional attachment upload IDs for file context */
  attachmentIds?: string[];
  /** User subscription tier for tier-based token limits */
  userTier?: SubscriptionTier;
  /**
   * Optional pre-loaded conversation history from prior rounds.
   * If provided, this is injected into each participant's messages array.
   * Loaded once per round and shared across all participants.
   */
  conversationHistory?: ModelMessage[];
  /** Pre-loaded working memory prompt (user preferences + chat context) */
  workingMemoryPrompt?: string;
  /** Thread metadata containing vertical preset data (dataSources, moderatorFormat) */
  threadMetadata?: ThreadVerticalMetadata | null;
};

/**
 * Callbacks for unified stream lifecycle events
 */
export type UnifiedStreamCallbacks = {
  onComplete?: (roundId: string) => Promise<void> | void;
  onError?: (error: Error, phase: StreamPhase) => Promise<void> | void;
};

/**
 * Prior response from a participant for context building
 */
type PriorParticipantResponse = {
  participantId: string;
  participantIndex: number;
  modelId: string;
  modelName: string;
  role: string | null;
  response: string;
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * AI SDK streaming protocol finish reasons (subset of FinishReason).
 * Excludes application-level values ('unknown', 'failed') which map to 'other'.
 *
 * Uses 5-part enum pattern per /docs/type-inference-patterns.md.
 */
const STREAMING_FINISH_REASONS = ['stop', 'length', 'tool-calls', 'content-filter', 'error', 'other'] as const;
const StreamingFinishReasonSchema = z.enum(STREAMING_FINISH_REASONS);
type StreamingFinishReason = z.infer<typeof StreamingFinishReasonSchema>;

/**
 * Map an AI SDK finish reason to the streaming protocol subset.
 * Application-level values ('unknown', 'failed') are mapped to 'other'.
 */
function mapToStreamingFinishReason(finishReason: string): StreamingFinishReason {
  const result = StreamingFinishReasonSchema.safeParse(finishReason);
  return result.success ? result.data : FinishReasons.OTHER;
}

/**
 * Extract Redis env from full env
 */
function toRedisEnv(env: ApiEnv['Bindings']): RedisEnv {
  return {
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
  };
}

/**
 * Build participant roster string for prompt injection.
 * Creates human-readable list of participants with their models and roles.
 *
 * Example output: "Claude (Analyst), GPT-4 (Ideator), Gemini (no role)"
 */
function buildParticipantRoster(participants: UnifiedParticipant[]): string {
  return participants
    .map((p) => {
      // Extract readable model name from full model ID (e.g., "anthropic/claude-3.5-sonnet" -> "Claude 3.5 Sonnet")
      const modelName = p.modelId.split('/').pop()?.replace(/-/g, ' ') || p.modelId;
      const roleStr = p.role ? ` (${p.role})` : '';
      return `${modelName}${roleStr}`;
    })
    .join(', ');
}

/**
 * Convert CitableSource[] to AvailableSource[] for frontend consumption.
 *
 * CitableSource is the internal format with full content for AI prompts.
 * AvailableSource is the frontend format for displaying in the Sources UI.
 */
function convertCitableSourcesToAvailable(sources: CitableSource[]): AvailableSource[] {
  return sources.map((source): AvailableSource => {
    // Build title with defensive fallback chain
    const title = source.title
      || source.metadata?.filename
      || source.metadata?.domain
      || source.metadata?.threadTitle
      || `${source.type.charAt(0).toUpperCase() + source.type.slice(1)} Source`;

    const baseSource: AvailableSource = {
      id: source.id,
      sourceType: source.type,
      title,
    };

    // Add excerpt from content (truncated)
    if (source.content) {
      baseSource.excerpt = source.content.slice(0, 300);
    }

    // Add attachment-specific fields
    if (source.type === 'attachment' && source.metadata) {
      if (source.metadata.downloadUrl) {
        baseSource.downloadUrl = source.metadata.downloadUrl;
      }
      if (source.metadata.filename) {
        baseSource.filename = source.metadata.filename;
      }
      if (source.metadata.mimeType) {
        baseSource.mimeType = source.metadata.mimeType;
      }
      if (source.metadata.fileSize) {
        baseSource.fileSize = source.metadata.fileSize;
      }
    }

    // Add search-specific fields
    if (source.type === 'search' && source.metadata) {
      if (source.metadata.url) {
        baseSource.url = source.metadata.url;
      }
      if (source.metadata.domain) {
        baseSource.domain = source.metadata.domain;
      }
      if (source.metadata.query) {
        baseSource.query = source.metadata.query;
      }
      if (source.metadata.publishedDate) {
        baseSource.publishedDate = source.metadata.publishedDate;
      }
      if (source.metadata.author) {
        baseSource.author = source.metadata.author;
      }
    }

    // Add domain-specific fields (SEC EDGAR, PubMed, etc.)
    if (source.type === 'domain' && source.metadata) {
      if (source.metadata.url) {
        baseSource.url = source.metadata.url;
      }
      if (source.metadata.domain) {
        baseSource.domain = source.metadata.domain;
      }
      if (source.metadata.query) {
        baseSource.query = source.metadata.query;
      }
    }

    // Add memory-specific fields
    if (source.type === 'memory' && source.metadata) {
      if (source.metadata.url) {
        baseSource.url = source.metadata.url;
      }
    }

    // Add thread-specific fields with navigation URL
    if (source.type === 'thread' && source.metadata) {
      if (source.metadata.url) {
        baseSource.url = source.metadata.url;
      } else if (source.metadata.threadId) {
        baseSource.url = `/chat/thread/${source.metadata.threadId}`;
      }
    }

    // Add thread title for context
    if (source.metadata?.threadTitle) {
      baseSource.threadTitle = source.metadata.threadTitle;
    }

    // Add description if available
    if (source.metadata?.description) {
      baseSource.description = source.metadata.description;
    }

    // Add roundNumber for context (threads, moderators, searches)
    if (source.metadata?.roundNumber !== undefined) {
      baseSource.roundNumber = source.metadata.roundNumber;
    }

    return baseSource;
  });
}

/**
 * Phase chunk types for Redis buffering with proper discriminated unions
 */
type PhaseStartChunk = {
  type: 'phase-start';
  phase: StreamPhase;
  timestamp: string;
  participantId?: string;
  participantIndex?: number;
  totalParticipants?: number;
};

type PhaseCompleteChunk = {
  type: 'phase-complete';
  phase: StreamPhase;
  timestamp: string;
  participantId?: string;
};

type PhaseErrorChunk = {
  type: 'phase-error';
  phase: StreamPhase;
  timestamp: string;
  error: string;
  participantId?: string;
  participantIndex?: number;
};

type PhaseChunk = PhaseStartChunk | PhaseCompleteChunk | PhaseErrorChunk;

/**
 * Create phase marker chunk for Redis buffering - overloaded for type safety
 */
function createPhaseChunk(
  type: 'phase-start',
  phase: StreamPhase,
  participantId?: string,
  participantIndex?: number,
  totalParticipants?: number,
): PhaseStartChunk;
function createPhaseChunk(
  type: 'phase-complete',
  phase: StreamPhase,
  participantId?: string,
): PhaseCompleteChunk;
function createPhaseChunk(
  type: 'phase-error',
  phase: StreamPhase,
  participantId: string | undefined,
  participantIndex: number | undefined,
  totalParticipants: number | undefined,
  error: string,
): PhaseErrorChunk;
function createPhaseChunk(
  type: 'phase-start' | 'phase-complete' | 'phase-error',
  phase: StreamPhase,
  participantId?: string,
  participantIndex?: number,
  totalParticipants?: number,
  error?: string,
): PhaseChunk {
  const timestamp = new Date().toISOString();

  if (type === 'phase-start') {
    return { participantId, participantIndex, phase, timestamp, totalParticipants, type };
  }
  if (type === 'phase-complete') {
    return { participantId, phase, timestamp, type };
  }
  // type === 'phase-error'
  return { error: error ?? 'Unknown error', participantId, participantIndex, phase, timestamp, type };
}

// ============================================================================
// PHASE EXECUTION
// ============================================================================

/**
 * Writer type alias for phase execution functions.
 * Uses AI SDK's UIMessageStreamWriter with our custom data types.
 */
type UnifiedStreamWriter = UIMessageStreamWriter<UnifiedUIMessage>;

// ============================================================================
// SSE HEARTBEAT (Cloudflare Workers 30s idle timeout prevention)
// ============================================================================

/**
 * Interval in ms between heartbeat SSE events during blocking operations.
 * Cloudflare Workers has a 30-second idle timeout on SSE connections.
 * Sending a transient data event every 10 seconds keeps the connection alive.
 */
const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Start a periodic heartbeat that writes transient `data-heartbeat` events
 * to the SSE stream. Returns the interval ID for cleanup via `clearInterval`.
 *
 * The heartbeat is a transient data part (not persisted to message state)
 * that produces a valid `data: {...}\n\n` SSE frame, preventing
 * Cloudflare Workers from killing the connection during long blocking
 * operations such as content extraction and context building.
 */
function startHeartbeat(writer: UnifiedStreamWriter): ReturnType<typeof setInterval> {
  return setInterval(() => {
    try {
      writer.write({
        data: { timestamp: new Date().toISOString() },
        transient: true,
        type: 'data-heartbeat',
      });
    } catch {
      // Writer may be closed; interval will be cleared by caller
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Pre-search result returned from executePreSearchPhase
 */
type DomainSourceResult = {
  formattedPrompt: string;
  citableSources?: CitableSource[];
};

type PreSearchResult = {
  data: ValidatedPreSearchData | null;
  domainSourceResults?: Map<DataSourceId, DomainSourceResult>;
  success: boolean;
};

/**
 * Execute pre-search phase - generates search queries and performs web searches
 *
 * @returns Pre-search result with success status and search data for participant context
 */
async function executePreSearchPhase(
  params: UnifiedRoundStreamParams,
  writer: UnifiedStreamWriter,
): Promise<PreSearchResult> {
  const { enableWebSearch, env, logger, roundNumber, threadId, userMessage } = params;
  const redisEnv = toRedisEnv(env);

  const hasDataSources = (params.threadMetadata?.dataSources?.length ?? 0) > 0;
  if (!enableWebSearch && !hasDataSources) {
    // Notify frontend that presearch was skipped so its phase state machine advances
    const phaseSkipped: PhaseMarkerData = {
      phase: StreamPhases.PRESEARCH,
      skipped: true,
      status: AiSdkPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    };
    writer.write({ data: phaseSkipped, transient: true, type: 'data-phase' });

    logger?.info('Pre-search skipped (disabled)', LogHelpers.operation({
      operationName: 'executePreSearchPhase',
      roundNumber,
      threadId,
    }));
    return { data: null, success: false };
  }

  if (!enableWebSearch && hasDataSources) {
    // Domain sources only — no web search. Still run presearch phase for domain source visibility.
    const phaseStart: PhaseMarkerData = {
      phase: StreamPhases.PRESEARCH,
      status: AiSdkPhaseStatuses.START,
      timestamp: new Date().toISOString(),
    };
    writer.write({ data: phaseStart, type: 'data-phase' });

    // Persist phase-start to Redis for resume support
    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-start', StreamPhases.PRESEARCH),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append presearch phase-start chunk', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    await emitPhaseTransition(threadId, roundNumber, {
      phase: StreamPhases.PRESEARCH,
      status: UnifiedPhaseStatuses.ACTIVE,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit presearch phase transition', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    // Fetch domain sources with progress
    const threadDataSources = params.threadMetadata?.dataSources ?? [];
    const domainResults = new Map<DataSourceId, DomainSourceResult>();
    const { fetchDomainSource } = await import('@/services/search/domain-sources/registry');
    const domainEnv = {
      FINNHUB_API_KEY: 'FINNHUB_API_KEY' in env ? String(env.FINNHUB_API_KEY) : undefined,
      FRED_API_KEY: 'FRED_API_KEY' in env ? String(env.FRED_API_KEY) : undefined,
    };

    await Promise.all(
      threadDataSources.map(async (source) => {
        const label = DATA_SOURCE_LABELS[source.id] ?? source.id;
        const progressStart: DomainSourceProgressData = {
          label,
          sourceId: source.id,
          status: 'start',
          timestamp: new Date().toISOString(),
        };
        try {
          writer.write({ data: progressStart, transient: true, type: 'data-domain-source-progress' });
        } catch { /* writer closed */ }

        try {
          const result = await fetchDomainSource(source.id, userMessage, source.config, domainEnv);
          if (result) {
            domainResults.set(source.id, result);
          }
          const progressComplete: DomainSourceProgressData = {
            label,
            sourceId: source.id,
            status: 'complete',
            timestamp: new Date().toISOString(),
          };
          try {
            writer.write({ data: progressComplete, transient: true, type: 'data-domain-source-progress' });
          } catch { /* writer closed */ }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          const progressError: DomainSourceProgressData = {
            error: errorMsg,
            label,
            sourceId: source.id,
            status: 'error',
            timestamp: new Date().toISOString(),
          };
          try {
            writer.write({ data: progressError, transient: true, type: 'data-domain-source-progress' });
          } catch { /* writer closed */ }
          logger?.warn(`Domain source ${source.id} failed (no-websearch path)`, LogHelpers.operation({
            error: errorMsg,
            operationName: 'executePreSearchPhase',
            roundNumber,
            threadId,
          }));
        }
      }),
    );

    // Complete presearch phase
    const phaseComplete: PhaseMarkerData = {
      phase: StreamPhases.PRESEARCH,
      status: AiSdkPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    };
    try {
      writer.write({ data: phaseComplete, transient: true, type: 'data-phase' });
    } catch { /* writer closed */ }

    // Persist phase-complete to Redis for resume support
    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-complete', StreamPhases.PRESEARCH),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append presearch phase-complete chunk', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    await emitPhaseTransition(threadId, roundNumber, {
      phase: StreamPhases.PRESEARCH,
      status: UnifiedPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit presearch phase-complete transition', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    logger?.info(`Pre-search phase completed (domain sources only, ${domainResults.size} fetched)`, LogHelpers.operation({
      operationName: 'executePreSearchPhase',
      roundNumber,
      threadId,
    }));

    return { data: null, domainSourceResults: domainResults, success: domainResults.size > 0 };
  }

  const startTime = performance.now();

  try {
    // Emit phase start - Redis FIRST (so resume can find it), then SSE
    const phaseStart: PhaseMarkerData = {
      phase: StreamPhases.PRESEARCH,
      status: AiSdkPhaseStatuses.START,
      timestamp: new Date().toISOString(),
    };

    // Persist to Redis before emitting SSE so clients reconnecting
    // immediately can see the phase boundary
    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-start', StreamPhases.PRESEARCH),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append presearch phase-start chunk', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    writer.write({ data: phaseStart, type: 'data-phase' });

    await emitPhaseTransition(threadId, roundNumber, {
      phase: StreamPhases.PRESEARCH,
      status: UnifiedPhaseStatuses.ACTIVE,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit presearch phase transition', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    logger?.info('Pre-search phase executing', LogHelpers.operation({
      operationName: 'executePreSearchPhase',
      roundNumber,
      threadId,
    }));

    // =========================================================================
    // STEP 1: Generate search queries from user message
    // =========================================================================
    logger?.info(`Generating search queries from user message (${userMessage.length} chars)`, LogHelpers.operation({
      operationName: 'executePreSearchPhase',
      roundNumber,
      threadId,
    }));

    const queryResult = await generateSearchQuery(userMessage, env, logger);
    const generatedQueries = queryResult.output;

    logger?.info(`Search queries generated: ${generatedQueries.queries.length} queries`, LogHelpers.operation({
      operationName: 'executePreSearchPhase',
      roundNumber,
      threadId,
    }));

    // Stream presearch data via artifact for progressive UI updates.
    // The artifact accumulates queries + results and streams state updates
    // to the frontend where useArtifact() provides reactive access.
    const presearchHandle = presearchArtifact.stream(
      { queries: [], results: [], summary: '', totalResults: 0 },
      writer,
    );

    // Stream query events progressively
    for (let i = 0; i < generatedQueries.queries.length; i++) {
      const q = generatedQueries.queries[i];
      if (!q) {
        continue;
      }

      const queryData: PresearchQueryData = {
        index: i,
        query: q.query,
        rationale: q.rationale || '',
        searchDepth: q.searchDepth || 'basic',
        total: generatedQueries.queries.length,
      };

      await presearchHandle.update({
        progress: ((i + 1) / generatedQueries.queries.length) * 0.5,
        queries: [...presearchHandle.data.queries, queryData],
      });
    }

    // =========================================================================
    // STEP 2: Execute web searches for each query
    // =========================================================================
    const searchResults: Array<{
      answer: string | null;
      query: string;
      responseTime: number;
      results: WebSearchResultItem[];
    }> = [];

    let successCount = 0;
    let failureCount = 0;
    let totalResults = 0;

    // BUG FIX: Start heartbeat to prevent Cloudflare Workers 30s idle timeout.
    // Each performWebSearch call includes Serper API + generateAnswerSummary (AI call),
    // taking 8-20s per query. With 3 sequential queries and zero SSE output, the
    // total idle time easily exceeds 30s, causing Cloudflare to kill the connection.
    const searchHeartbeat = startHeartbeat(writer);
    try {
      for (let i = 0; i < generatedQueries.queries.length; i++) {
        const queryObj = generatedQueries.queries[i];
        if (!queryObj) {
          continue;
        }

        const queryStartTime = performance.now();

        try {
          logger?.info(`Executing search ${i + 1}/${generatedQueries.queries.length}`, LogHelpers.operation({
            operationName: 'executePreSearchPhase',
            query: queryObj.query.slice(0, 50),
            roundNumber,
            threadId,
          }));

          // Ensure sourceCount is a number (schema max is 3)
          const maxResults = typeof queryObj.sourceCount === 'string'
            ? Number.parseInt(queryObj.sourceCount, 10) || 3
            : queryObj.sourceCount || 3;

          // Parse through schema to apply defaults.
          // includeAnswer: false — skip generateAnswerSummary AI call during presearch.
          // Each answer generation adds 5-15s per query (OpenRouter round-trip).
          // With 3 queries that's 15-45s of blocking latency. Participants use raw
          // search results for context, not the answer summary.
          const searchParams = WebSearchParametersSchema.parse({
            includeAnswer: false,
            maxResults,
            query: queryObj.query,
            searchDepth: queryObj.searchDepth || 'basic',
          });

          const searchResult = await performWebSearch(
            searchParams,
            env,
            undefined, // complexity
            logger,
          );

          logger?.info(`Presearch result for query ${i + 1}: results=${searchResult.results.length}, hasAnswer=${!!searchResult.answer}, responseTime=${searchResult.responseTime.toFixed(0)}ms`, LogHelpers.operation({
            operationName: 'executePreSearchPhase',
            resultCount: searchResult.results.length,
            roundNumber,
            threadId,
          }));

          // DEBUG: Warn if results are empty - check for _meta.error
          if (searchResult.results.length === 0) {
            const metaError = searchResult._meta?.error ? `_meta.error=${searchResult._meta.message}` : 'no _meta.error';
            logger?.warn(`EMPTY PRESEARCH RESULTS for query "${queryObj.query.slice(0, 40)}..." - ${metaError}`, LogHelpers.operation({
              operationName: 'executePreSearchPhase',
              roundNumber,
              threadId,
            }));
          }

          const queryResponseTime = performance.now() - queryStartTime;

          searchResults.push({
            answer: searchResult.answer,
            query: queryObj.query,
            responseTime: queryResponseTime,
            results: searchResult.results,
          });

          successCount++;
          totalResults += searchResult.results.length;

          // Stream result via artifact for progressive UI updates
          const resultData: PresearchResultData = {
            answer: searchResult.answer,
            index: i,
            query: queryObj.query,
            responseTime: queryResponseTime,
            results: searchResult.results.map(r => ({
              description: r.metadata?.description || r.content || '',
              favicon: r.metadata?.faviconUrl || '',
              snippet: r.excerpt || r.content.slice(0, 200) || '',
              title: r.title,
              url: r.url,
            })),
          };

          await presearchHandle.update({
            progress: 0.5 + ((i + 1) / generatedQueries.queries.length) * 0.5,
            results: [...presearchHandle.data.results, resultData],
            totalResults,
          });

          logger?.info(`Search ${i + 1} completed (${searchResult.results.length} results, ${queryResponseTime.toFixed(0)}ms)`, LogHelpers.operation({
            operationName: 'executePreSearchPhase',
            resultCount: searchResult.results.length,
            roundNumber,
            threadId,
          }));
        } catch (searchError) {
          failureCount++;
          const errorMsg = searchError instanceof Error ? searchError.message : 'Unknown search error';
          const queryResponseTime = performance.now() - queryStartTime;

          // DEBUG: Log FULL error details - this is a critical failure point
          rlog.stuck('presearch-failed', `query=${i + 1} error=${errorMsg}`);

          logger?.warn(`Search ${i + 1} failed`, LogHelpers.operation({
            error: errorMsg,
            operationName: 'executePreSearchPhase',
            query: queryObj.query.slice(0, 50),
            roundNumber,
            threadId,
          }));

          // Add empty result for failed search
          searchResults.push({
            answer: null,
            query: queryObj.query,
            responseTime: queryResponseTime,
            results: [],
          });

          // CRITICAL: Still emit result via artifact even on error
          // Frontend needs to know the search was attempted (with empty results)
          const errorResultData: PresearchResultData = {
            answer: null,
            index: i,
            query: queryObj.query,
            responseTime: queryResponseTime,
            results: [],
          };
          await presearchHandle.update({
            progress: 0.5 + ((i + 1) / generatedQueries.queries.length) * 0.5,
            results: [...presearchHandle.data.results, errorResultData],
            totalResults,
          });
        }
      }
    } finally {
      clearInterval(searchHeartbeat);
    }

    // =========================================================================
    // STEP 3: Content extraction (BLOCKING) - Ensures participants get full context
    // =========================================================================
    // Serper only provides snippets (~200 chars). For richer participant context,
    // we extract full page content from top URLs using Jina Reader API.
    //
    // ⛔ FIX: Changed from waitUntil() (background) to blocking await
    // Previously, content extraction ran in background and participants might start
    // BEFORE extraction completed, receiving only sparse snippets instead of full content.
    // Now extraction completes BEFORE participants start, ensuring all participants
    // have access to the same enriched search context.
    // =========================================================================
    if (totalResults > 0) {
      logger?.info('Starting blocking content extraction', LogHelpers.operation({
        operationName: 'executePreSearchPhase',
        resultCount: totalResults,
        roundNumber,
        threadId,
      }));

      // BUG-04 FIX: Start heartbeat to prevent Cloudflare Workers 30s idle timeout
      // Content extraction can take up to 15s with zero SSE output
      const extractionHeartbeat = startHeartbeat(writer);

      // Collect all URLs from search results (limit to top 5 per query for speed)
      const urlsToExtract: string[] = [];
      for (const sr of searchResults) {
        const topUrls = sr.results.slice(0, 5).map(r => r.url);
        urlsToExtract.push(...topUrls);
      }

      // Extract content from unique URLs (max 10 total to avoid timeout)
      const uniqueUrls = [...new Set(urlsToExtract)].slice(0, 10);
      // Blocking content extraction with outer timeout guard.
      // Per-URL timeout is 8s but 10 URLs at maxConcurrent=3 could take 24s+.
      // Outer timeout caps total extraction at 15s so participants are not starved.
      const EXTRACTION_TIMEOUT_MS = 15_000;
      try {
        const extractionResults = await Promise.race([
          extractMultipleUrls(
            uniqueUrls,
            { maxConcurrent: 3, maxLength: 3000, timeout: 8000 },
            logger,
          ),
          new Promise<never>((_resolve, reject) => {
            setTimeout(() => reject(new Error(`Content extraction timed out after ${EXTRACTION_TIMEOUT_MS}ms`)), EXTRACTION_TIMEOUT_MS);
          }),
        ]);

        // Enrich search results with extracted content (in-place mutation)
        let enrichedCount = 0;
        for (const sr of searchResults) {
          for (const result of sr.results) {
            const extraction = extractionResults.get(result.url);
            if (extraction?.success && extraction.content.length > 0) {
              // Set rawContent (preferred by context builder) AND update content
              result.rawContent = extraction.content;
              result.content = extraction.content;
              enrichedCount++;
            }
          }
        }

        logger?.info(`Content extraction complete: ${enrichedCount}/${totalResults} enriched`, LogHelpers.operation({
          operationName: 'executePreSearchPhase',
          resultCount: enrichedCount,
          roundNumber,
          threadId,
        }));
      } catch (extractionError) {
        const errMsg = extractionError instanceof Error ? extractionError.message : 'Unknown error';
        rlog.stuck('extraction-failed', `error=${errMsg}`);
        logger?.warn('Content extraction failed', LogHelpers.operation({
          error: errMsg,
          operationName: 'executePreSearchPhase',
          roundNumber,
          threadId,
        }));
        // Non-fatal - participants will use original snippets
      } finally {
        clearInterval(extractionHeartbeat);
      }
    }

    const totalTime = performance.now() - startTime;

    // =========================================================================
    // STEP 4: Build ValidatedPreSearchData for participant context
    // =========================================================================
    const preSearchData: ValidatedPreSearchData = {
      failureCount,
      queries: generatedQueries.queries.map((q, idx) => ({
        index: idx,
        query: q.query,
        rationale: q.rationale || '',
        searchDepth: q.searchDepth || 'basic',
      })),
      results: searchResults,
      successCount,
      summary: `Searched ${generatedQueries.queries.length} queries, found ${totalResults} results in ${(totalTime / 1000).toFixed(1)}s`,
      totalResults,
      totalTime,
    };

    // Complete the presearch artifact with final summary before phase marker
    await presearchHandle.complete({
      ...presearchHandle.data,
      summary: preSearchData.summary,
      totalResults: preSearchData.totalResults,
    });

    // Emit phase complete (writer may be closed — don't block subsequent phases)
    const phaseComplete: PhaseMarkerData = {
      phase: StreamPhases.PRESEARCH,
      status: AiSdkPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    };
    try {
      writer.write({ data: phaseComplete, transient: true, type: 'data-phase' });
    } catch { /* Writer closed */ }

    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-complete', StreamPhases.PRESEARCH),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append presearch phase-complete chunk', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    await emitPhaseTransition(threadId, roundNumber, {
      phase: StreamPhases.PRESEARCH,
      status: UnifiedPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit presearch phase-complete transition', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    logger?.info(`Pre-search phase completed (${successCount} succeeded, ${failureCount} failed, ${totalResults} results, ${totalTime.toFixed(0)}ms)`, LogHelpers.operation({
      operationName: 'executePreSearchPhase',
      roundNumber,
      threadId,
    }));

    // =========================================================================
    // DOMAIN DATA SOURCES (parallel fetch with progress streaming)
    // =========================================================================
    const threadDataSources = params.threadMetadata?.dataSources;
    let domainResults: Map<DataSourceId, DomainSourceResult> | undefined;
    if (threadDataSources?.length) {
      const collectedResults = new Map<DataSourceId, DomainSourceResult>();
      const { fetchDomainSource } = await import('@/services/search/domain-sources/registry');
      const domainEnv = {
        FINNHUB_API_KEY: 'FINNHUB_API_KEY' in env ? String(env.FINNHUB_API_KEY) : undefined,
        FRED_API_KEY: 'FRED_API_KEY' in env ? String(env.FRED_API_KEY) : undefined,
      };

      await Promise.all(
        threadDataSources.map(async (source) => {
          const label = DATA_SOURCE_LABELS[source.id] ?? source.id;
          const progressStart: DomainSourceProgressData = {
            label,
            sourceId: source.id,
            status: 'start',
            timestamp: new Date().toISOString(),
          };
          try {
            writer.write({ data: progressStart, transient: true, type: 'data-domain-source-progress' });
          } catch { /* writer closed */ }

          try {
            const result = await fetchDomainSource(source.id, userMessage, source.config, domainEnv);
            if (result) {
              collectedResults.set(source.id, result);
            }
            const progressComplete: DomainSourceProgressData = {
              label,
              sourceId: source.id,
              status: 'complete',
              timestamp: new Date().toISOString(),
            };
            try {
              writer.write({ data: progressComplete, transient: true, type: 'data-domain-source-progress' });
            } catch { /* writer closed */ }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const progressError: DomainSourceProgressData = {
              error: errorMsg,
              label,
              sourceId: source.id,
              status: 'error',
              timestamp: new Date().toISOString(),
            };
            try {
              writer.write({ data: progressError, transient: true, type: 'data-domain-source-progress' });
            } catch { /* writer closed */ }
            logger?.warn(`Domain source ${source.id} failed`, LogHelpers.operation({
              error: errorMsg,
              operationName: 'executePreSearchPhase',
              roundNumber,
              threadId,
            }));
          }
        }),
      );
      domainResults = collectedResults;
    }

    return { data: preSearchData, domainSourceResults: domainResults, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown presearch error';
    // Sanitize/truncate error message for database storage (max 500 chars)
    const sanitizedErrorMsg = errorMsg.slice(0, 500);

    logger?.error('Pre-search phase failed', LogHelpers.operation({
      error: errorMsg,
      operationName: 'executePreSearchPhase',
      roundNumber,
      threadId,
    }));

    // =========================================================================
    // UPDATE DATABASE: Mark chatPreSearch record as FAILED
    // =========================================================================
    // This ensures the record doesn't stay as 'pending' forever.
    // Without this, orphan cleanup is the only way to clean up failed records.
    // =========================================================================
    const { db } = params;
    if (db) {
      try {
        await db.update(tables.chatPreSearch)
          .set({
            completedAt: new Date(),
            errorMessage: sanitizedErrorMsg,
            status: MessageStatuses.FAILED,
          })
          .where(and(
            eq(tables.chatPreSearch.threadId, threadId),
            eq(tables.chatPreSearch.roundNumber, roundNumber),
          ));

        // ✅ FIX: Invalidate message cache so frontend sees FAILED status
        await invalidateMessagesCache(db, threadId);

        logger?.info('Updated chatPreSearch record to FAILED status', LogHelpers.operation({
          operationName: 'executePreSearchPhase',
          roundNumber,
          status: 'failed',
          threadId,
        }));
      } catch (dbError) {
        // Log but don't fail - the phase error handling should still continue
        const dbErrorMsg = dbError instanceof Error ? dbError.message : 'Unknown DB error';
        logger?.warn('Failed to update chatPreSearch record to FAILED status', LogHelpers.operation({
          error: dbErrorMsg,
          operationName: 'executePreSearchPhase',
          roundNumber,
          threadId,
        }));
      }
    }

    const phaseError: PhaseMarkerData = {
      error: errorMsg,
      phase: StreamPhases.PRESEARCH,
      status: AiSdkPhaseStatuses.ERROR,
      timestamp: new Date().toISOString(),
    };
    try {
      writer.write({ data: phaseError, transient: true, type: 'data-phase' });
    } catch { /* Writer closed — don't escape error handler */ }

    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-error', StreamPhases.PRESEARCH, undefined, undefined, undefined, errorMsg),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append chunk to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    await emitPhaseTransition(threadId, roundNumber, {
      error: errorMsg,
      phase: StreamPhases.PRESEARCH,
      status: UnifiedPhaseStatuses.ERROR,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit phase transition to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    return { data: null, success: false };
  }
}

/**
 * Execute participant phase for a single participant using AI SDK streamText
 *
 * Each participant sees:
 * 1. Original user message
 * 2. Web search context (if pre-search was executed)
 * 3. All prior participant responses
 *
 * @returns Object with success status and the participant's full response
 */
async function executeParticipantPhase(
  params: UnifiedRoundStreamParams,
  participant: UnifiedParticipant,
  writer: UnifiedStreamWriter,
  priorResponses: PriorParticipantResponse[] = [],
  preSearchData: ValidatedPreSearchData | null = null,
  preBuiltSearchContext: SearchContextResult | null = null,
  sharedAttachmentContent: LoadAttachmentContentResult | null = null,
  detectedLanguage: DetectedLanguage = null,
  cachedDomainResults?: Map<DataSourceId, DomainSourceResult>,
): Promise<{ success: boolean; response: string; finishReason: StreamingFinishReason; citableSources?: CitableSource[]; citationSourceMap?: CitationSourceMap }> {
  const { attachmentIds, baseUrl, db, env, logger, mode, participants, projectId, roundNumber, sessionId, threadId, userId, userMessage } = params;
  const redisEnv = toRedisEnv(env);

  try {
    // Emit phase start - Redis FIRST (so resume can find it), then SSE
    const phaseStart: PhaseMarkerData = {
      participantId: participant.id,
      participantIndex: participant.index,
      phase: StreamPhases.PARTICIPANT,
      status: AiSdkPhaseStatuses.START,
      timestamp: new Date().toISOString(),
      totalParticipants: participants.length,
    };

    // Persist to Redis before emitting SSE so clients reconnecting
    // immediately can see the phase boundary
    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-start', StreamPhases.PARTICIPANT, participant.id, participant.index, participants.length),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append participant phase-start chunk', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    writer.write({ data: phaseStart, type: 'data-phase' });

    await emitPhaseTransition(threadId, roundNumber, {
      participantId: participant.id,
      participantIndex: participant.index,
      phase: StreamPhases.PARTICIPANT,
      status: UnifiedPhaseStatuses.ACTIVE,
      timestamp: new Date().toISOString(),
      totalParticipants: participants.length,
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit participant phase transition', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    logger?.info('Participant phase starting', LogHelpers.operation({
      operationName: 'executeParticipantPhase',
      participantIndex: participant.index,
      roundNumber,
      threadId,
      totalParticipants: participants.length,
    }));

    // Lazy load AI SDK
    const { streamText } = await getAiSdkModule();

    // Import OpenRouter service lazily
    const { initializeOpenRouter, openRouterService } = await import('@/services/models');
    initializeOpenRouter(env);
    const client = await openRouterService.getClient();

    // =========================================================================
    // BUILD SYSTEM PROMPT (V3.0 LLM Council Pattern)
    // =========================================================================
    // Priority:
    // 1. Use inline systemPrompt if participant has one (from DB settings)
    // 2. Otherwise, build mode-specific prompt using prompts.service
    //    - Includes CEBR protocol (Challenge, Extend, Build, Reframe)
    //    - Mode-specific behavior (ANALYZING, BRAINSTORMING, DEBATING, SOLVING)
    //    - Participant roster injection for natural dialogue
    // =========================================================================
    let systemPrompt: string;

    if (participant.systemPrompt) {
      // Use custom inline system prompt from participant settings
      systemPrompt = participant.systemPrompt;
      logger?.debug('Using custom inline system prompt', LogHelpers.operation({
        operationName: 'executeParticipantPhase',
        participantId: participant.id,
        participantIndex: participant.index,
        promptSource: 'inline',
        roundNumber,
        threadId,
      }));
    } else {
      // Build mode-specific prompt from prompts.service (V3.0 LLM Council)
      const settingsDb = db ?? await getDbAsync();
      const dbBehaviorPrompt = await getAdminSetting(settingsDb, 'participantBehaviorPrompt');
      const resolvedBehavior = dbBehaviorPrompt?.trim() ? await resolveSkillTokens(dbBehaviorPrompt, settingsDb) : undefined;
      const basePrompt = buildParticipantSystemPrompt(participant.role, mode, detectedLanguage, resolvedBehavior);

      // Inject participant roster for natural dialogue
      const rosterString = buildParticipantRoster(participants);
      systemPrompt = basePrompt.replace(PARTICIPANT_ROSTER_PLACEHOLDER, rosterString);

      logger?.info('Built V3.0 LLM Council prompt', LogHelpers.operation({
        hasRole: !!participant.role,
        mode: mode || 'default (analyzing)',
        operationName: 'executeParticipantPhase',
        participantId: participant.id,
        participantIndex: participant.index,
        participantRoster: rosterString,
        promptSource: 'prompts.service',
        role: participant.role || 'none',
        roundNumber,
        threadId,
      }));
    }

    // =========================================================================
    // PERFORMANCE: Build all context in PARALLEL (non-blocking)
    // =========================================================================
    // Previously these were sequential awaits that blocked streaming start.
    // Now we run them all in parallel using Promise.all to reduce latency.
    // This can save 200-500ms before first token.
    // =========================================================================
    let citableSources: CitableSource[] = [];
    const citationSourceMap: CitationSourceMap = new Map();

    // AI SDK v6 content part types (per https://ai-sdk.dev/docs/foundations/prompts):
    // Files can be: Uint8Array, ArrayBuffer, Buffer, base64 string, data URL, or http(s) URL
    // Let models that support native PDF/vision handle files directly - no extraction needed.
    //
    // - ImagePart: { type: 'image'; image: Uint8Array | string; mediaType?: string }
    // - FilePart: { type: 'file'; data: Uint8Array | string; mediaType: string; filename?: string }
    type AiSdkImagePart = { type: 'image'; image: Uint8Array | string; mediaType?: string };
    type AiSdkFilePart = { type: 'file'; data: Uint8Array | string; mediaType: string; filename?: string };
    type AiSdkContentPart = AiSdkImagePart | AiSdkFilePart;
    let attachmentContentParts: AiSdkContentPart[] = [];
    let attachmentTextContent: string | null = null;

    // Start all async context-building operations in parallel
    const contextPromises: Promise<void>[] = [];

    // =========================================================================
    // CONTEXT 1: Citation context (memories, threads, attachments from project)
    // =========================================================================
    if (db && projectId && baseUrl) {
      contextPromises.push((async () => {
        try {
          const citableContext = await buildCitableContext({
            baseUrl,
            currentThreadId: threadId,
            db,
            maxMemories: 10,
            maxMessagesPerThread: 3,
            maxModerators: 3,
            maxSearchResults: 5,
            projectId,
            r2Bucket: env.UPLOADS_R2_BUCKET,
            userQuery: userMessage,
          });

          // Merge sources into collections
          for (const [id, source] of citableContext.sourceMap) {
            citationSourceMap.set(id, source);
          }
          citableSources = [...citableSources, ...citableContext.sources];

          // Append formatted citation context to system prompt.
          // Cap project context to prevent unbounded system prompt growth that
          // compresses the output token budget and causes truncated responses.
          if (citableContext.formattedPrompt) {
            const truncatedContext = citableContext.formattedPrompt.length > MAX_PROJECT_CONTEXT_CHARS
              ? `${citableContext.formattedPrompt.slice(0, MAX_PROJECT_CONTEXT_CHARS)}\n\n[Project context truncated for brevity]`
              : citableContext.formattedPrompt;
            systemPrompt = `${systemPrompt}${truncatedContext}`;
          }

          logger?.info(`Built citation context for participant (${citableContext.sources.length} sources, prompt chars: ${citableContext.formattedPrompt?.length ?? 0})`, LogHelpers.operation({
            operationName: 'executeParticipantPhase',
            participantIndex: participant.index,
            roundNumber,
            threadId,
          }));
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger?.warn('Failed to build citation context', LogHelpers.operation({
            error: errorMsg,
            operationName: 'executeParticipantPhase',
            participantIndex: participant.index,
            projectId,
            roundNumber,
            threadId,
          }));
        }
      })());
    }

    // =========================================================================
    // CONTEXT 2: Web search context (if search was executed in pre-search phase)
    // =========================================================================
    // ✅ PERF: Use pre-built search context (built once per round, shared across participants)
    // instead of calling buildDirectSearchContext per-participant.
    if (preBuiltSearchContext) {
      // Use pre-built context directly (no async needed)
      for (const [id, source] of preBuiltSearchContext.sourceMap) {
        citationSourceMap.set(id, source);
      }
      citableSources = [...citableSources, ...preBuiltSearchContext.citableSources];

      if (preBuiltSearchContext.formattedPrompt) {
        systemPrompt = `${systemPrompt}${preBuiltSearchContext.formattedPrompt}`;
      }

      logger?.info(`Using pre-built search context for participant (${preBuiltSearchContext.citableSources.length} sources)`, LogHelpers.operation({
        operationName: 'executeParticipantPhase',
        participantIndex: participant.index,
        roundNumber,
        sourceCount: preBuiltSearchContext.citableSources.length,
        threadId,
      }));
    } else if (preSearchData && preSearchData.results.length > 0) {
      // Fallback: build search context inline (shouldn't happen with pre-built context)
      contextPromises.push((async () => {
        try {
          const searchContext = buildDirectSearchContext(preSearchData, roundNumber);

          for (const [id, source] of searchContext.sourceMap) {
            citationSourceMap.set(id, source);
          }
          citableSources = [...citableSources, ...searchContext.citableSources];

          if (searchContext.formattedPrompt) {
            systemPrompt = `${systemPrompt}${searchContext.formattedPrompt}`;
          }

          logger?.info(`Built web search context for participant (${searchContext.citableSources.length} sources)`, LogHelpers.operation({
            operationName: 'executeParticipantPhase',
            participantIndex: participant.index,
            roundNumber,
            sourceCount: searchContext.citableSources.length,
            threadId,
          }));
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger?.warn('Failed to build web search context', LogHelpers.operation({
            error: errorMsg,
            operationName: 'executeParticipantPhase',
            participantIndex: participant.index,
            roundNumber,
            threadId,
          }));
        }
      })());
    }

    // =========================================================================
    // CONTEXT 3: Attachment content (files uploaded with this message)
    // =========================================================================
    // ✅ PERF: Uses pre-loaded shared attachment content (loaded once per round)
    // instead of calling loadAttachmentContent per-participant.
    // This eliminates N× R2 fetches and N× memory copies.
    if (sharedAttachmentContent && sharedAttachmentContent.fileParts.length > 0) {
      // Convert to AI SDK v6 content parts format (references shared Uint8Array data - no copies)
      attachmentContentParts = sharedAttachmentContent.fileParts.map((part): AiSdkContentPart => {
        const isImage = part.mimeType.startsWith('image/');
        if (isImage) {
          return {
            image: part.data,
            mediaType: part.mimeType,
            type: 'image' as const,
          };
        } else {
          return {
            data: part.data,
            filename: part.filename,
            mediaType: part.mimeType,
            type: 'file' as const,
          };
        }
      });

      const imageCount = attachmentContentParts.filter(p => p.type === 'image').length;
      const fileCount = attachmentContentParts.filter(p => p.type === 'file').length;

      logger?.info(`Using shared attachment content for participant (${imageCount} images, ${fileCount} files)`, LogHelpers.operation({
        attachmentCount: attachmentContentParts.length,
        operationName: 'executeParticipantPhase',
        participantIndex: participant.index,
        roundNumber,
        threadId,
      }));

      // Build attachment citation context with citable sources
      if (attachmentIds) {
        const citationContext = buildFilePartCitationContext(
          sharedAttachmentContent.fileParts,
          attachmentIds,
        );
        attachmentTextContent = citationContext.formattedPrompt;

        for (const source of citationContext.citableSources) {
          citationSourceMap.set(source.id, source);
        }
        citableSources = [...citableSources, ...citationContext.citableSources];

        logger?.debug(`Generated ${citationContext.citableSources.length} attachment citations for participant: ${citationContext.citableSources.map(s => s.id).join(', ')}`, LogHelpers.operation({
          attachmentCount: citationContext.citableSources.length,
          operationName: 'executeParticipantPhase',
          participantIndex: participant.index,
          roundNumber,
          threadId,
        }));
      }

      if (sharedAttachmentContent.errors.length > 0) {
        logger?.warn('Some attachments failed to load', LogHelpers.operation({
          errors: sharedAttachmentContent.errors,
          operationName: 'executeParticipantPhase',
          participantIndex: participant.index,
          roundNumber,
          threadId,
        }));
      }
    }

    // =========================================================================
    // CONTEXT 4: Domain data sources (from thread metadata — vertical presets)
    // =========================================================================
    // When a vertical preset (M&A Advisory, Clinical Board, etc.) is selected,
    // dataSources are stored in thread metadata. We fetch domain-specific data
    // (SEC EDGAR filings, PubMed articles) and append to the system prompt.
    // Runs IN PARALLEL with other context fetches — zero added latency.
    // Non-fatal: if a domain source fails, models still respond via web search.
    const threadDataSources = params.threadMetadata?.dataSources;
    if (threadDataSources?.length) {
      contextPromises.push((async () => {
        try {
          // Use cached results from presearch phase if available (avoid re-fetching)
          if (cachedDomainResults && cachedDomainResults.size > 0) {
            for (const result of cachedDomainResults.values()) {
              systemPrompt = `${systemPrompt}\n\n${result.formattedPrompt}`;
              if (result.citableSources) {
                citableSources = [...citableSources, ...result.citableSources];
                for (const source of result.citableSources) {
                  citationSourceMap.set(source.id, source);
                }
              }
            }
          } else {
            // Fallback: fetch domain sources directly (presearch didn't run or no cache)
            const { fetchDomainSource } = await import('@/services/search/domain-sources/registry');
            const sourceResults = await Promise.all(
              threadDataSources.map((source) => {
                const domainEnv = {
                  FINNHUB_API_KEY: 'FINNHUB_API_KEY' in env ? String(env.FINNHUB_API_KEY) : undefined,
                  FRED_API_KEY: 'FRED_API_KEY' in env ? String(env.FRED_API_KEY) : undefined,
                };
                return fetchDomainSource(source.id, userMessage, source.config, domainEnv);
              }),
            );
            for (const result of sourceResults) {
              if (result) {
                systemPrompt = `${systemPrompt}\n\n${result.formattedPrompt}`;
                if (result.citableSources) {
                  citableSources = [...citableSources, ...result.citableSources];
                  for (const source of result.citableSources) {
                    citationSourceMap.set(source.id, source);
                  }
                }
              }
            }
          }
        } catch (error) {
          logger?.warn('Domain source fetch failed (non-fatal)', LogHelpers.operation({
            error: error instanceof Error ? error.message : 'Unknown error',
            operationName: 'executeParticipantPhase',
            participantIndex: participant.index,
            roundNumber,
            threadId,
          }));
        }
      })());
    }

    // Wait for all context building to complete IN PARALLEL
    // This is much faster than sequential awaits
    await Promise.all(contextPromises);

    // =========================================================================
    // SEND AVAILABLE SOURCES DATA PART (For early citation display)
    // =========================================================================
    // Send sources BEFORE streaming starts so frontend can display proper titles
    // (e.g., actual filenames instead of "Attached File") during streaming.
    // =========================================================================
    if (citableSources.length > 0) {
      const availableSources = convertCitableSourcesToAvailable(citableSources);
      const sourcesData = {
        sources: availableSources,
        timestamp: new Date().toISOString(),
      };
      const sourcesHandle = availableSourcesArtifact.stream(sourcesData, writer);
      await sourcesHandle.complete();

      logger?.debug(`Sent ${availableSources.length} available sources for early citation display (types: ${[...new Set(availableSources.map(s => s.sourceType))].join(', ')})`, LogHelpers.operation({
        operationName: 'executeParticipantPhase',
        participantIndex: participant.index,
        roundNumber,
        threadId,
      }));
    }

    // Append attachment text context to system prompt if present
    if (attachmentTextContent) {
      systemPrompt = `${systemPrompt}${attachmentTextContent}`;
    }

    // CONTEXT 4: Working memory (user preferences + chat context)
    if (params.workingMemoryPrompt) {
      systemPrompt = `${systemPrompt}${params.workingMemoryPrompt}`;
    }

    // =========================================================================
    // FILTER ATTACHMENTS BY MODEL CAPABILITY
    // =========================================================================
    // Not all models support images/files. Filter based on model capabilities
    // to avoid "model does not support file content types" errors.
    // =========================================================================
    const modelInfo = getModelById(participant.modelId);
    let filteredContentParts = attachmentContentParts;

    if (attachmentContentParts.length > 0 && modelInfo) {
      const originalCount = attachmentContentParts.length;
      filteredContentParts = attachmentContentParts.filter((part) => {
        if (part.type === 'image' && !modelInfo.supports_vision) {
          return false;
        }
        if (part.type === 'file' && !modelInfo.supports_file) {
          return false;
        }
        return true;
      });

      const removedCount = originalCount - filteredContentParts.length;
      if (removedCount > 0) {
        // Model doesn't support native file/vision processing - files will be skipped
        // To process these files, use a model with supports_file=true or supports_vision=true
        logger?.warn(`Filtered ${removedCount} attachment parts for ${participant.modelId} (vision=${modelInfo.supports_vision}, file=${modelInfo.supports_file}) - model lacks native file capability. Use Gemini, GPT-4o, or Claude for native PDF/image processing.`, LogHelpers.operation({
          attachmentCount: removedCount,
          operationName: 'executeParticipantPhase',
          participantIndex: participant.index,
          roundNumber,
          threadId,
        }));
      }
    }

    // Build messages array with context from prior participants
    // Use AI SDK ModelMessage type for proper typing with streamText
    const messages: ModelMessage[] = [];

    // =========================================================================
    // CONVERSATION HISTORY: Messages from prior rounds (loaded once per round)
    // =========================================================================
    // Inject conversation history FIRST so participants have full context.
    // History is loaded once in executeUnifiedRoundStream and shared across
    // all participants to avoid redundant DB queries.
    //
    // Format: Prior assistant messages are converted to user role with
    // attribution prefix to prevent the model from thinking IT said those things.
    // =========================================================================
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      messages.push(...params.conversationHistory);
      logger?.debug(`Injected conversation history (${params.conversationHistory.length} messages from prior rounds)`, LogHelpers.operation({
        messageCount: params.conversationHistory.length,
        operationName: 'executeParticipantPhase',
        participantIndex: participant.index,
        roundNumber,
        threadId,
      }));
    }

    // Current round's user message (includes attachments if present)
    if (filteredContentParts.length > 0) {
      // Multi-modal: text + image/file parts
      // AI SDK UserContent type accepts array of text, image, and file parts
      const userContent: UserContent = [
        { text: userMessage, type: 'text' },
        ...filteredContentParts,
      ];

      messages.push({ content: userContent, role: 'user' });
    } else {
      // Text-only message
      messages.push({ content: userMessage, role: 'user' });
    }

    // Add prior responses from CURRENT ROUND as context in a SINGLE user message
    // IMPORTANT: Do NOT use role: 'assistant' for prior responses - that makes
    // the model think IT already said those things, causing it to summarize/conclude
    // instead of providing its own fresh response.
    if (priorResponses.length > 0) {
      const priorContext = priorResponses
        .map((prior) => {
          const label = prior.role
            ? `**${prior.role} (${prior.modelName})**`
            : `**${prior.modelName}**`;
          return `${label}:\n${prior.response}`;
        })
        .join('\n\n---\n\n');

      const languageReminder = detectedLanguage
        ? `Remember: respond entirely in ${detectedLanguage}. `
        : '';
      messages.push({
        content: `The discussion so far:\n\n${priorContext}\n\n---\n\n${languageReminder}Consider what's missing or underweighted in the discussion, then engage and add your perspective.`,
        role: 'user',
      });
    }

    logger?.debug(`Participant context built: ${params.conversationHistory?.length ?? 0} history + ${priorResponses.length} prior responses = ${messages.length} messages`, LogHelpers.operation({
      operationName: 'executeParticipantPhase',
      participantIndex: participant.index,
      roundNumber,
      threadId,
    }));

    // Get tier-based max output tokens (default to 'free' tier if not provided)
    // Each participant gets their own full token allowance - NOT shared
    const baseTierTokens = getMaxOutputTokensForTier(params.userTier ?? 'free');
    // Project sub-threads inject extra context (working memory, cross-chat,
    // moderator analyses, tool schemas) that inflates the system prompt by
    // ~1-3K tokens. Boost the output budget by 50% (capped at 16384) so
    // the model still has room for a full response after the larger prompt.
    const participantMaxOutputTokens = projectId
      ? Math.min(Math.ceil(baseTierTokens * 1.5), 16384)
      : baseTierTokens;

    // Generate trace ID for PostHog LLM analytics
    const traceId = generateTraceId();

    // Wrap model with PostHog tracing for automatic $ai_generation capture
    const baseModel = client.chat(participant.modelId);
    const tracedModel = createTracedModel(baseModel, {
      distinctId: sessionId || userId || 'anonymous',
      participantId: participant.id,
      participantIndex: participant.index,
      roundNumber,
      subscriptionTier: params.userTier,
      threadId,
      traceId,
    });

    // Stream participant response using AI SDK v6
    // NOTE: streamText() does NOT throw immediately - errors occur when iterating fullStream
    const participantOpenRouterOpts = buildOpenRouterOptions(participant.modelId);
    let result: ReturnType<typeof streamText>;
    try {
      result = streamText({
        abortSignal: AbortSignal.timeout(300000),
        maxOutputTokens: participantMaxOutputTokens,
        messages,
        model: tracedModel,
        onError: ({ error }) => {
          rlog.stuck('participant-onError', `P${participant.index} model=${participant.modelId} error=${JSON.stringify(serializeErrorForLog(error))}`);
          const errMsg = error instanceof Error ? error.message : String(error);
          const errType = error instanceof Error ? error.name : 'unknown';
          trackAiCallFailed(
            { sessionId, threadId, userId: userId || 'anonymous', userTier: params.userTier },
            { errorMessage: errMsg, errorType: errType, modelId: participant.modelId, operation: 'participant', participantId: participant.id, roundNumber },
          );
        },
        ...(participantOpenRouterOpts && { providerOptions: { openrouter: participantOpenRouterOpts } }),
        system: systemPrompt,
      });
    } catch (streamTextError) {
      rlog.stuck('participant-streamText-threw', `P${participant.index} error=${JSON.stringify(serializeErrorForLog(streamTextError))}`);
      throw streamTextError;
    }

    // Collect full response while streaming via fullStream
    // This allows us to capture text AND emit proper AI SDK events
    let totalText = '';
    let totalReasoning = '';
    let toolCallCount = 0;
    const textId = `participant-${participant.index}-text`;

    // Collect Redis write promises - DO NOT await inside loop to avoid blocking stream
    const redisWritePromises: Promise<number>[] = [];

    let fullStreamEventCount = 0;
    let textDeltaCount = 0;

    // Wrap fullStream iteration in try-catch to catch stream errors specifically
    try {
      for await (const part of result.fullStream) {
        fullStreamEventCount++;

        switch (part.type) {
          case 'text-start':
            // Emit text-start to writer for UI update
            writer.write({ id: textId, type: 'text-start' });
            break;

          case 'text-delta':
            textDeltaCount++;
            // Accumulate text and emit to writer IMMEDIATELY (non-blocking)
            totalText += part.text;
            writer.write({ delta: part.text, id: textId, type: 'text-delta' });
            // Buffer to Redis for resumption - fire and forget, don't block stream
            redisWritePromises.push(appendUnifiedChunk(threadId, roundNumber, {
              content: part.text,
              participantId: participant.id,
              phase: StreamPhases.PARTICIPANT,
              type: 'text-delta',
            }, redisEnv, logger));
            break;

          case 'text-end':
            // Emit text-end to complete the text block
            writer.write({ id: textId, type: 'text-end' });
            break;

          case 'finish':
            // Handled below after loop
            break;

          case 'error': {
            const errorObj = part.error;
            const errorMsg = errorObj instanceof Error ? errorObj.message : String(errorObj);
            let errorDetails: string;
            if (errorObj instanceof Error) {
              errorDetails = JSON.stringify({
                ...serializeErrorForLog(errorObj),
                stack: errorObj.stack?.split('\n').slice(0, 3).join(' | '), // First 3 stack lines
              });
            } else {
              errorDetails = JSON.stringify(serializeErrorForLog(errorObj));
            }
            rlog.stuck('participant-stream-error', `P${participant.index} error=${errorDetails}`);

            // Forward error to client so frontend can display it
            writer.write({
              data: {
                error: errorMsg,
                participantIndex: participant.index,
                phase: StreamPhases.PARTICIPANT,
                timestamp: new Date().toISOString(),
              },
              type: 'data-error',
            });
            break;
          }

          // =====================================================================
          // REASONING EVENTS - Forward chain-of-thought tokens to frontend
          // =====================================================================
          // Some models (e.g., o1, gpt-5-nano with reasoning) emit reasoning tokens
          // before text output. These must be forwarded to the client for:
          // 1. UI to show "thinking" indicator
          // 2. Proper stream flow (not appearing stuck)
          // =====================================================================
          case 'reasoning-start': {
            const reasoningId = `participant-${participant.index}-reasoning`;
            writer.write({ id: reasoningId, type: 'reasoning-start' });
            break;
          }

          case 'reasoning-delta': {
            const reasoningId = `participant-${participant.index}-reasoning`;
            totalReasoning += part.text;
            // AI SDK fullStream has `text`, writer expects `delta`
            writer.write({ delta: part.text, id: reasoningId, type: 'reasoning-delta' });
            break;
          }

          case 'reasoning-end': {
            const reasoningId = `participant-${participant.index}-reasoning`;
            writer.write({ id: reasoningId, type: 'reasoning-end' });
            break;
          }

          // =====================================================================
          // TOOL EVENTS - Forward tool execution to frontend
          // =====================================================================
          // Working memory tools auto-execute (no needsApproval) because DebateKit
          // uses single-request streaming incompatible with the multi-request approval
          // flow. The fullStream emits tool-input-*, tool-call, tool-result,
          // tool-error events. These are forwarded to the UIMessageStreamWriter
          // so the frontend can display tool execution notifications.
          // =====================================================================

          case 'tool-input-start':
            writer.write({
              toolCallId: part.id,
              toolName: part.toolName,
              type: 'tool-input-start',
              ...(part.providerExecuted !== undefined && { providerExecuted: part.providerExecuted }),
              ...(part.title !== undefined && { title: part.title }),
            });
            break;

          case 'tool-input-delta':
            writer.write({
              inputTextDelta: part.delta,
              toolCallId: part.id,
              type: 'tool-input-delta',
            });
            break;

          case 'tool-input-end':
            // AI SDK does not forward tool-input-end to UIMessageStream — no-op
            break;

          case 'tool-call':
            // tool-call completes the tool input. Forward as tool-input-available
            // (or tool-input-error if the call is invalid).
            if ('invalid' in part && part.invalid) {
              writer.write({
                errorText: part.error instanceof Error ? part.error.message : String(part.error),
                input: part.input,
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                type: 'tool-input-error',
              });
            } else {
              writer.write({
                input: part.input,
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                type: 'tool-input-available',
              });
            }
            break;

          case 'tool-approval-request':
            writer.write({
              approvalId: part.approvalId,
              toolCallId: part.toolCall.toolCallId,
              type: 'tool-approval-request',
            });
            break;

          case 'tool-result':
            toolCallCount++;
            writer.write({
              output: part.output,
              toolCallId: part.toolCallId,
              type: 'tool-output-available',
              ...(part.providerExecuted !== undefined && { providerExecuted: part.providerExecuted }),
            });
            break;

          case 'tool-error':
            writer.write({
              errorText: part.error instanceof Error ? part.error.message : String(part.error),
              toolCallId: part.toolCallId,
              type: 'tool-output-error',
            });
            break;

          case 'tool-output-denied':
            writer.write({
              toolCallId: part.toolCallId,
              type: 'tool-output-denied',
            });
            break;

          case 'start':
          case 'start-step':
          case 'finish-step':
            // AI SDK lifecycle events - logged above, no action needed
            break;

          default:
            break;
        }
      }
    } catch (fullStreamError) {
      rlog.stuck('participant-iteration-failed', `P${participant.index} error=${fullStreamError instanceof Error ? fullStreamError.message : String(fullStreamError)} events=${fullStreamEventCount} deltas=${textDeltaCount}`);
      throw fullStreamError;
    }

    // When a model produces only tool calls with no visible text,
    // emit a synthetic text block so the UI shows something meaningful.
    // This happens when models like GPT-5 Nano call updateWorkingMemory
    // and consider the task complete without producing visible text output.
    // NOTE: Always emit regardless of reasoning — reasoning is collapsed under
    // "Thought for X seconds" and isn't visible content in the message body.
    if (totalText === '' && toolCallCount > 0) {
      const syntheticText = `[Tool executed: ${toolCallCount} action${toolCallCount > 1 ? 's' : ''} completed]`;
      const textId = `participant-${participant.index}-text`;
      try {
        writer.write({ id: textId, type: 'text-start' });
        writer.write({ delta: syntheticText, id: textId, type: 'text-delta' });
        writer.write({ id: textId, type: 'text-end' });
        totalText = syntheticText;
      } catch { /* Writer may be closed */ }
    }

    // Wait for all Redis writes to complete (for resumption integrity)
    // This happens AFTER stream is done, so doesn't block client
    // BUG-10 FIX: Guard against indefinite hang with a timeout.
    // If Redis writes haven't settled within 10s, proceed anyway --
    // partial buffer loss is acceptable vs. a hung stream.
    const REDIS_FLUSH_TIMEOUT_MS = 10_000;
    await Promise.race([
      Promise.allSettled(redisWritePromises),
      new Promise((resolve) => {
        setTimeout(resolve, REDIS_FLUSH_TIMEOUT_MS);
      }),
    ]);

    // Get usage stats after stream completes
    const usage = await result.usage;
    const finishReason = await result.finishReason;

    // Buffer finish event - map to AI SDK streaming protocol finish reasons
    // Application-level values ('unknown', 'failed') map to 'other'
    const mappedFinishReason = mapToStreamingFinishReason(finishReason);

    await appendUnifiedChunk(threadId, roundNumber, {
      finishReason: mappedFinishReason,
      participantId: participant.id,
      phase: StreamPhases.PARTICIPANT,
      type: 'finish',
      usage: {
        completionTokens: usage.outputTokens ?? 0,
        promptTokens: usage.inputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to append chunk to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    // Emit phase complete (writer may be closed on client disconnect — don't block D1 persist)
    const phaseComplete: PhaseMarkerData = {
      participantId: participant.id,
      participantIndex: participant.index,
      phase: StreamPhases.PARTICIPANT,
      status: AiSdkPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    };
    try {
      writer.write({ data: phaseComplete, transient: true, type: 'data-phase' });
    } catch { /* Writer closed — D1 persist below still runs */ }

    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-complete', StreamPhases.PARTICIPANT, participant.id),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append chunk to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    await emitPhaseTransition(threadId, roundNumber, {
      participantId: participant.id,
      phase: StreamPhases.PARTICIPANT,
      status: UnifiedPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit phase transition to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    // =========================================================================
    // PERSIST PARTICIPANT MESSAGE TO D1
    // =========================================================================
    // Messages MUST be persisted to D1 so they survive page refresh.
    // Redis buffer is only for stream resumption, not permanent storage.
    // =========================================================================
    if (db && (totalText || totalReasoning)) {
      try {
        const messageId = ulid();

        // Build usage metadata
        const usageMetadata = {
          completionTokens: usage.outputTokens ?? 0,
          promptTokens: usage.inputTokens ?? 0,
          totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        };

        // Map finish reason to valid enum value (default to stop for successful completion)
        const parsedValidFinish = FinishReasonSchema.safeParse(finishReason);
        const validFinishReason = parsedValidFinish.success ? parsedValidFinish.data : FinishReasons.STOP;

        // Convert citable sources to available sources for frontend UI
        const availableSources = convertCitableSourcesToAvailable(citableSources);

        // Build participant message metadata
        const messageMetadata = createParticipantMetadata({
          availableSources,
          finishReason: validFinishReason,
          hasError: false,
          model: participant.modelId,
          participantId: participant.id,
          participantIndex: participant.index,
          participantRole: participant.role ?? null,
          roundNumber,
          usage: usageMetadata,
        });

        // Build message parts - include reasoning when available (reasoning models like o1, GPT-5 Nano, DeepSeek)
        const parts = DbMessagePartsSchema.parse([
          ...(totalText ? [{ text: totalText, type: MessagePartTypes.TEXT }] : []),
          ...(totalReasoning ? [{ text: totalReasoning, type: MessagePartTypes.REASONING }] : []),
        ]);

        await db.insert(tables.chatMessage)
          .values({
            createdAt: new Date(),
            id: messageId,
            metadata: messageMetadata,
            participantId: participant.id,
            parts,
            role: MessageRoles.ASSISTANT,
            roundNumber,
            threadId,
          })
          .onConflictDoNothing();

        // Cache invalidation moved to end-of-round (single invalidation per round)

        logger?.info('Persisted participant message to D1', LogHelpers.operation({
          messageId,
          operationName: 'executeParticipantPhase',
          participantId: participant.id,
          participantIndex: participant.index,
          reasoningLength: totalReasoning.length,
          roundNumber,
          textLength: totalText.length,
          threadId,
        }));
      } catch (persistError) {
        // Log but don't fail the phase - message is still in Redis buffer
        const errMsg = persistError instanceof Error ? persistError.message : 'Unknown error';
        logger?.error('Failed to persist participant message to D1', LogHelpers.operation({
          error: errMsg,
          operationName: 'executeParticipantPhase',
          participantId: participant.id,
          participantIndex: participant.index,
          roundNumber,
          threadId,
        }));
      }
    }

    logger?.info(`Participant phase completed (${totalText.length} chars)`, LogHelpers.operation({
      operationName: 'executeParticipantPhase',
      participantIndex: participant.index,
      roundNumber,
      threadId,
    }));

    // =========================================================================
    // RLOG DIAGNOSTIC: Analyze citation usage in response
    // =========================================================================
    // Check if participant properly cited sources, especially search results
    // =========================================================================
    const searchSourcesProvided = citableSources.filter(s => s.type === 'search').length;
    if (searchSourcesProvided > 0) {
      // Parse citations from response text
      const citationResult = parseCitations(totalText);
      const searchCitationsUsed = citationResult.citations.filter(c => c.typePrefix === 'sch').length;

      // Build expected citation IDs from search sources
      const expectedSearchIds = citableSources
        .filter(s => s.type === 'search')
        .map(s => s.id);

      // Check for generic phrases without specific citations
      const genericPhrases = [
        'according to sources',
        'according to the sources',
        'sources indicate',
        'sources suggest',
        'based on the sources',
        'the sources show',
        'research shows',
        'research indicates',
        'studies show',
        'studies indicate',
      ];
      const lowerText = totalText.toLowerCase();
      const usedGenericPhrases = genericPhrases.filter(phrase => lowerText.includes(phrase));

      // Flag if no citations but sources were available
      if (searchCitationsUsed === 0 && searchSourcesProvided > 0) {
        rlog.stuck('citation-missing', `P${participant.index} tid=${threadId.slice(-6)} WARN: 0 search citations but ${searchSourcesProvided} sources available`);
      }

      // Flag if generic phrases used without specific citations
      if (usedGenericPhrases.length > 0 && searchCitationsUsed < searchSourcesProvided) {
        rlog.stuck('citation-generic', `P${participant.index} tid=${threadId.slice(-6)} WARN: generic phrases=[${usedGenericPhrases.join(', ')}] but only ${searchCitationsUsed}/${searchSourcesProvided} citations`);
      }

      // Log which specific IDs were expected vs used
      const usedIds = citationResult.citations.filter(c => c.typePrefix === 'sch').map(c => c.sourceId);
      const unusedIds = expectedSearchIds.filter(id => !usedIds.includes(id));
      if (unusedIds.length > 0) {
        rlog.stuck('citation-unused', `P${participant.index} tid=${threadId.slice(-6)} unused=${unusedIds.slice(0, 5).join(',')}`);
      }
    }

    return { citableSources, citationSourceMap, finishReason: mappedFinishReason, response: totalText, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown participant error';
    const errorType = error instanceof Error ? error.name : 'unknown';

    logger?.error('Participant phase failed', LogHelpers.operation({
      error: errorMsg,
      operationName: 'executeParticipantPhase',
      participantIndex: participant.index,
      roundNumber,
      threadId,
    }));

    trackAiCallFailed(
      { sessionId, threadId, userId: userId || 'anonymous', userTier: params.userTier },
      { errorMessage: errorMsg, errorType, modelId: participant.modelId, operation: 'participant', participantId: participant.id, roundNumber },
    );

    const phaseError: PhaseMarkerData = {
      error: errorMsg,
      participantId: participant.id,
      participantIndex: participant.index,
      phase: StreamPhases.PARTICIPANT,
      status: AiSdkPhaseStatuses.ERROR,
      timestamp: new Date().toISOString(),
    };
    try {
      writer.write({ data: phaseError, transient: true, type: 'data-phase' });
    } catch { /* Writer may be closed - don't escape error handler */ }

    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-error', StreamPhases.PARTICIPANT, participant.id, participant.index, undefined, errorMsg),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append chunk to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    await emitPhaseTransition(threadId, roundNumber, {
      error: errorMsg,
      participantId: participant.id,
      phase: StreamPhases.PARTICIPANT,
      status: UnifiedPhaseStatuses.ERROR,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit phase transition to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    return { citableSources: [], citationSourceMap: new Map(), finishReason: FinishReasons.OTHER, response: '', success: false };
  }
}

// extractReadableModelName imported from ./stream-utils

/**
 * Execute moderator phase using AI SDK streamText
 *
 * Uses V3.0 LLM Council moderator prompt for rich synthesis.
 * Only executes if there are 2+ participants.
 */
async function executeModeratorPhase(
  params: UnifiedRoundStreamParams,
  writer: UnifiedStreamWriter,
  participantResponses: Map<string, string>,
  allCitableSources: CitableSource[] = [],
  detectedLanguage: DetectedLanguage = null,
): Promise<{ success: boolean; finishReason: StreamingFinishReason }> {
  const { db, env, logger, mode, participants, projectId, roundNumber, sessionId, threadId, userId, userMessage } = params;
  const redisEnv = toRedisEnv(env);

  if (participants.length < 2) {
    // Notify frontend that moderator was skipped so its phase state machine advances
    const phaseSkipped: PhaseMarkerData = {
      phase: StreamPhases.MODERATOR,
      skipped: true,
      status: AiSdkPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    };
    writer.write({ data: phaseSkipped, transient: true, type: 'data-phase' });

    logger?.info('Moderator phase skipped (single participant)', LogHelpers.operation({
      operationName: 'executeModeratorPhase',
      roundNumber,
      threadId,
      totalParticipants: participants.length,
    }));
    return { finishReason: FinishReasons.OTHER, success: false };
  }

  const moderatorModel = COUNCIL_MODERATOR_MODEL_ID;

  try {
    // Emit phase start - Redis FIRST (so resume can find it), then SSE
    const phaseStart: PhaseMarkerData = {
      phase: StreamPhases.MODERATOR,
      status: AiSdkPhaseStatuses.START,
      timestamp: new Date().toISOString(),
    };

    // Persist to Redis before emitting SSE so clients reconnecting
    // immediately can see the phase boundary
    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-start', StreamPhases.MODERATOR),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append chunk to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    writer.write({ data: phaseStart, type: 'data-phase' });

    await emitPhaseTransition(threadId, roundNumber, {
      phase: StreamPhases.MODERATOR,
      status: UnifiedPhaseStatuses.ACTIVE,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit phase transition to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    logger?.info('Moderator phase starting', LogHelpers.operation({
      operationName: 'executeModeratorPhase',
      roundNumber,
      threadId,
      totalParticipants: participants.length,
    }));

    const { streamText } = await getAiSdkModule();

    const { initializeOpenRouter, openRouterService } = await import('@/services/models');
    initializeOpenRouter(env);
    const client = await openRouterService.getClient();

    // =========================================================================
    // BUILD PARTICIPANT RESPONSES FOR MODERATOR (V3.0 LLM Council)
    // =========================================================================
    // Convert Map<id, response> to ParticipantResponse[] with model names and roles
    // This enables rich moderator synthesis with proper crediting
    // =========================================================================
    const formattedResponses: ParticipantResponse[] = Array.from(participantResponses.entries())
      .map(([id, response]) => {
        const participant = participants.find(p => p.id === id);
        return {
          modelId: participant?.modelId ?? 'unknown',
          modelName: extractReadableModelName(participant?.modelId ?? 'unknown'),
          participantIndex: participant?.index ?? 0,
          participantRole: participant?.role || 'Participant',
          responseContent: response,
        };
      })
      .sort((a, b) => a.participantIndex - b.participantIndex);

    // =========================================================================
    // BUILD V3.0 LLM COUNCIL MODERATOR PROMPT
    // =========================================================================
    // Uses buildCouncilModeratorSystemPrompt for rich synthesis:
    // - Convergence/divergence analysis
    // - Model crediting by name and role
    // - Mode-specific behavior
    // - Copy-pasteable decision-ready summaries
    // =========================================================================
    const moderatorSystemPrompt = buildCouncilModeratorSystemPrompt(
      roundNumber,
      mode,
      userMessage,
      formattedResponses,
      undefined,
      detectedLanguage,
      getModeratorFormatSection(params.threadMetadata?.moderatorFormat),
    );

    logger?.info(`Built V3.0 LLM Council moderator prompt (${formattedResponses.length} participants, mode: ${mode || 'analyzing'})`, LogHelpers.operation({
      operationName: 'executeModeratorPhase',
      roundNumber,
      threadId,
    }));

    const searchSourcesProvided = allCitableSources.filter(s => s.type === 'search').length;

    // Moderator is a system-internal model — needs sufficient tokens to always produce output.
    // Reasoning models (Gemini 2.5 Flash) split maxOutputTokens between reasoning + text,
    // so 1024 (free tier 2x) causes "No output generated" when reasoning exhausts the budget.
    // Minimum 4096 ensures reasoning models have room for both thinking and synthesis.
    // Project threads synthesize longer participant responses (boosted by project context),
    // so raise the cap to 12288 to prevent moderator truncation.
    const baseTierModeratorTokens = getMaxOutputTokensForTier(params.userTier ?? 'free');
    const moderatorCap = projectId ? 12288 : 8192;
    const moderatorMaxOutputTokens = Math.max(Math.min(baseTierModeratorTokens * 2, moderatorCap), 4096);

    // Generate trace ID for PostHog LLM analytics
    const moderatorTraceId = generateTraceId();

    // Wrap model with PostHog tracing for automatic $ai_generation capture
    const baseModeratorModel = client.chat(moderatorModel);
    const tracedModeratorModel = createTracedModel(baseModeratorModel, {
      distinctId: sessionId || userId || 'anonymous',
      operation: 'moderator',
      roundNumber,
      subscriptionTier: params.userTier,
      threadId,
      traceId: moderatorTraceId,
    });

    // V3.0 LLM Council: No separate user prompt needed - system prompt contains all context
    const moderatorOpenRouterOpts = buildOpenRouterOptions(moderatorModel);
    const result = streamText({
      abortSignal: AbortSignal.timeout(300000),
      maxOutputTokens: moderatorMaxOutputTokens,
      messages: [{
        content: detectedLanguage
          ? `Please synthesize the council discussion. Write your entire synthesis in ${detectedLanguage}.`
          : 'Please synthesize the council discussion.',
        role: 'user',
      }],
      model: tracedModeratorModel,
      ...(moderatorOpenRouterOpts && { providerOptions: { openrouter: moderatorOpenRouterOpts } }),
      system: moderatorSystemPrompt,
    });

    // Stream via fullStream - emit AI SDK events and collect text
    const textId = 'moderator-text';
    let totalModeratorText = '';
    let totalModeratorReasoning = '';

    // Collect Redis write promises - DO NOT await inside loop to avoid blocking stream
    const moderatorRedisPromises: Promise<number>[] = [];

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-start':
          writer.write({ id: textId, type: 'text-start' });
          break;

        case 'text-delta':
          // Write to client IMMEDIATELY (non-blocking)
          totalModeratorText += part.text;
          writer.write({ delta: part.text, id: textId, type: 'text-delta' });
          // Buffer to Redis for resumption - fire and forget, don't block stream
          moderatorRedisPromises.push(appendUnifiedChunk(threadId, roundNumber, {
            content: part.text,
            phase: StreamPhases.MODERATOR,
            type: 'text-delta',
          }, redisEnv, logger));
          break;

        case 'text-end':
          writer.write({ id: textId, type: 'text-end' });
          break;

        case 'finish':
          // Handled below
          break;

        // =====================================================================
        // REASONING EVENTS - Forward chain-of-thought tokens for moderator
        // =====================================================================
        case 'reasoning-start': {
          const reasoningId = 'moderator-reasoning';
          writer.write({ id: reasoningId, type: 'reasoning-start' });
          break;
        }

        case 'reasoning-delta': {
          const reasoningId = 'moderator-reasoning';
          totalModeratorReasoning += part.text;
          // AI SDK fullStream has `text`, writer expects `delta`
          writer.write({ delta: part.text, id: reasoningId, type: 'reasoning-delta' });
          break;
        }

        case 'reasoning-end': {
          const reasoningId = 'moderator-reasoning';
          writer.write({ id: reasoningId, type: 'reasoning-end' });
          break;
        }

        case 'error': {
          const errorObj = part.error;
          const errorMsg = errorObj instanceof Error ? errorObj.message : String(errorObj);
          rlog.stuck('moderator-stream-error', `error=${errorMsg}`);

          // Forward error to client so frontend can display it
          writer.write({
            data: {
              error: errorMsg,
              phase: StreamPhases.MODERATOR,
              timestamp: new Date().toISOString(),
            },
            type: 'data-error',
          });
          break;
        }

        // =====================================================================
        // TOOL EVENTS - Forward tool approval flow to frontend
        // =====================================================================
        // Moderator currently has no tools, but these cases are included for
        // consistency with participant handling and future-proofing.
        // =====================================================================

        case 'tool-input-start':
          writer.write({
            toolCallId: part.id,
            toolName: part.toolName,
            type: 'tool-input-start',
            ...(part.providerExecuted !== undefined && { providerExecuted: part.providerExecuted }),
            ...(part.title !== undefined && { title: part.title }),
          });
          break;

        case 'tool-input-delta':
          writer.write({
            inputTextDelta: part.delta,
            toolCallId: part.id,
            type: 'tool-input-delta',
          });
          break;

        case 'tool-input-end':
          // AI SDK does not forward tool-input-end to UIMessageStream — no-op
          break;

        case 'tool-call':
          if ('invalid' in part && part.invalid) {
            writer.write({
              errorText: part.error instanceof Error ? part.error.message : String(part.error),
              input: part.input,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              type: 'tool-input-error',
            });
          } else {
            writer.write({
              input: part.input,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              type: 'tool-input-available',
            });
          }
          break;

        case 'tool-approval-request':
          writer.write({
            approvalId: part.approvalId,
            toolCallId: part.toolCall.toolCallId,
            type: 'tool-approval-request',
          });
          break;

        case 'tool-result':
          writer.write({
            output: part.output,
            toolCallId: part.toolCallId,
            type: 'tool-output-available',
            ...(part.providerExecuted !== undefined && { providerExecuted: part.providerExecuted }),
          });
          break;

        case 'tool-error':
          writer.write({
            errorText: part.error instanceof Error ? part.error.message : String(part.error),
            toolCallId: part.toolCallId,
            type: 'tool-output-error',
          });
          break;

        case 'tool-output-denied':
          writer.write({
            toolCallId: part.toolCallId,
            type: 'tool-output-denied',
          });
          break;

        case 'start':
        case 'start-step':
        case 'finish-step':
          // AI SDK lifecycle events - no action needed
          break;

        default:
          break;
      }
    }

    // Wait for all Redis writes to complete (for resumption integrity)
    // This happens AFTER stream is done, so doesn't block client
    // BUG-10 FIX: Guard against indefinite hang with a timeout.
    // If Redis writes haven't settled within 10s, proceed anyway --
    // partial buffer loss is acceptable vs. a hung stream.
    const REDIS_FLUSH_TIMEOUT_MS = 10_000;
    await Promise.race([
      Promise.allSettled(moderatorRedisPromises),
      new Promise((resolve) => {
        setTimeout(resolve, REDIS_FLUSH_TIMEOUT_MS);
      }),
    ]);

    const usage = await result.usage;
    const finishReason = await result.finishReason;

    // Buffer finish event - map to AI SDK streaming protocol finish reasons
    // Application-level values ('unknown', 'failed') map to 'other'
    const mappedFinishReason = mapToStreamingFinishReason(finishReason);

    await appendUnifiedChunk(threadId, roundNumber, {
      finishReason: mappedFinishReason,
      phase: StreamPhases.MODERATOR,
      type: 'finish',
      usage: {
        completionTokens: usage.outputTokens ?? 0,
        promptTokens: usage.inputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to append chunk to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    // Emit phase complete (writer may be closed — don't block D1 persist)
    const phaseComplete: PhaseMarkerData = {
      phase: StreamPhases.MODERATOR,
      status: AiSdkPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    };
    try {
      writer.write({ data: phaseComplete, transient: true, type: 'data-phase' });
    } catch { /* Writer closed — D1 persist below still runs */ }

    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-complete', StreamPhases.MODERATOR),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append chunk to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    await emitPhaseTransition(threadId, roundNumber, {
      phase: StreamPhases.MODERATOR,
      status: UnifiedPhaseStatuses.COMPLETE,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit phase transition to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    // =========================================================================
    // PERSIST MODERATOR MESSAGE TO D1
    // =========================================================================
    if (db && (totalModeratorText || totalModeratorReasoning)) {
      try {
        const messageId = ulid();
        const usageMetadata = {
          completionTokens: usage.outputTokens ?? 0,
          promptTokens: usage.inputTokens ?? 0,
          totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        };

        const validFinishReason = finishReason === 'stop'
          ? FinishReasons.STOP
          : finishReason === 'length'
            ? FinishReasons.LENGTH
            : finishReason === 'tool-calls'
              ? FinishReasons.TOOL_CALLS
              : finishReason === 'content-filter'
                ? FinishReasons.CONTENT_FILTER
                : finishReason === 'error'
                  ? FinishReasons.ERROR
                  : FinishReasons.UNKNOWN;

        // Moderator uses dedicated metadata builder with:
        // - isModerator: true (discriminator for frontend detection)
        // - participantIndex: MODERATOR_PARTICIPANT_INDEX (-99) for proper sorting AFTER participants
        // - availableSources: includes all participant sources for citation display
        // NOTE: participantId is set to null in DB (not in metadata)
        const messageMetadata = createModeratorMetadata({
          availableSources: allCitableSources.length > 0 ? convertCitableSourcesToAvailable(allCitableSources) : undefined,
          finishReason: validFinishReason,
          hasError: false,
          model: moderatorModel,
          roundNumber,
          usage: usageMetadata,
        });

        // Build message parts - include reasoning when available (reasoning models like o1, GPT-5 Nano, DeepSeek)
        const parts = DbMessagePartsSchema.parse([
          ...(totalModeratorText ? [{ text: totalModeratorText, type: MessagePartTypes.TEXT }] : []),
          ...(totalModeratorReasoning ? [{ text: totalModeratorReasoning, type: MessagePartTypes.REASONING }] : []),
        ]);

        await db
          .insert(tables.chatMessage)
          .values({
            createdAt: new Date(),
            id: messageId,
            metadata: messageMetadata,
            participantId: null,
            parts,
            role: MessageRoles.ASSISTANT,
            roundNumber,
            threadId,
          })
          .onConflictDoNothing();

        // Cache invalidation moved to end-of-round (single invalidation per round)

        logger?.info('Moderator message persisted to D1', LogHelpers.operation({
          messageId,
          operationName: 'executeModeratorPhase',
          reasoningLength: totalModeratorReasoning.length,
          roundNumber,
          textLength: totalModeratorText.length,
          threadId,
        }));
      } catch (persistError) {
        // Log but don't fail the stream - message is already sent to client
        const errorMsg = persistError instanceof Error ? persistError.message : 'Unknown error';
        logger?.error('Failed to persist moderator message', LogHelpers.operation({
          error: errorMsg,
          operationName: 'executeModeratorPhase',
          roundNumber,
          threadId,
        }));
      }
    }

    // =========================================================================
    // RLOG DIAGNOSTICS: Analyze moderator citation quality
    // =========================================================================
    // Similar to participant analysis - check if moderator properly cited sources
    if (searchSourcesProvided > 0 && totalModeratorText) {
      // Parse citations from moderator response text
      const citationResult = parseCitations(totalModeratorText);
      const searchCitationsUsed = citationResult.citations.filter(c => c.typePrefix === 'sch').length;

      // Build expected citation IDs from search sources
      const expectedSearchIds = allCitableSources
        .filter(s => s.type === 'search')
        .map(s => s.id);

      // Check for generic phrases without specific citations
      const genericPhrases = [
        'according to sources',
        'according to the sources',
        'sources indicate',
        'sources suggest',
        'based on the sources',
        'the sources show',
        'research shows',
        'research indicates',
        'studies show',
        'studies indicate',
      ];
      const lowerText = totalModeratorText.toLowerCase();
      const usedGenericPhrases = genericPhrases.filter(phrase => lowerText.includes(phrase));

      // Flag if no citations but sources were available
      if (searchCitationsUsed === 0 && searchSourcesProvided > 0) {
        rlog.stuck('moderator-citation-missing', `tid=${threadId.slice(-6)} WARN: 0 search citations but ${searchSourcesProvided} sources available`);
      }

      // Flag if generic phrases used without specific citations
      if (usedGenericPhrases.length > 0 && searchCitationsUsed < searchSourcesProvided) {
        rlog.stuck('moderator-citation-generic', `tid=${threadId.slice(-6)} WARN: generic phrases=[${usedGenericPhrases.join(', ')}] but only ${searchCitationsUsed}/${searchSourcesProvided} citations`);
      }

      // Log which specific IDs were expected vs used (citation coverage)
      const usedIds = citationResult.citations.filter(c => c.typePrefix === 'sch').map(c => c.sourceId);
      const unusedIds = expectedSearchIds.filter(id => !usedIds.includes(id));
      if (unusedIds.length > 0) {
        rlog.stuck('moderator-citation-unused', `tid=${threadId.slice(-6)} unused=${unusedIds.slice(0, 5).join(',')}`);
      }
    }

    logger?.info('Moderator phase completed', LogHelpers.operation({
      operationName: 'executeModeratorPhase',
      roundNumber,
      threadId,
    }));

    return { finishReason: mappedFinishReason, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown moderator error';
    const errorType = error instanceof Error ? error.name : 'unknown';

    logger?.error('Moderator phase failed', LogHelpers.operation({
      error: errorMsg,
      operationName: 'executeModeratorPhase',
      roundNumber,
      threadId,
    }));

    trackAiCallFailed(
      { sessionId, threadId, userId: userId || 'anonymous', userTier: params.userTier },
      { errorMessage: errorMsg, errorType, modelId: moderatorModel, operation: 'moderator', roundNumber },
    );

    const phaseError: PhaseMarkerData = {
      error: errorMsg,
      phase: StreamPhases.MODERATOR,
      status: AiSdkPhaseStatuses.ERROR,
      timestamp: new Date().toISOString(),
    };
    try {
      writer.write({ data: phaseError, transient: true, type: 'data-phase' });
    } catch { /* Writer closed — don't escape error handler */ }

    await appendUnifiedChunk(
      threadId,
      roundNumber,
      createPhaseChunk('phase-error', StreamPhases.MODERATOR, undefined, undefined, undefined, errorMsg),
      redisEnv,
      logger,
    ).catch((err) => {
      logger?.error('Failed to append chunk to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'appendUnifiedChunk',
        threadId,
      }));
    });

    await emitPhaseTransition(threadId, roundNumber, {
      error: errorMsg,
      phase: StreamPhases.MODERATOR,
      status: UnifiedPhaseStatuses.ERROR,
      timestamp: new Date().toISOString(),
    }, redisEnv, logger).catch((err) => {
      logger?.error('Failed to emit phase transition to Redis', LogHelpers.operation({
        error: err instanceof Error ? err.message : 'Unknown error',
        operationName: 'emitPhaseTransition',
        threadId,
      }));
    });

    // Persist error moderator message to D1 so frontend can detect failure on refresh
    if (db) {
      try {
        const messageId = ulid();
        const errorMetadata = createModeratorMetadata({
          errorMessage: errorMsg,
          finishReason: FinishReasons.ERROR,
          hasError: true,
          model: moderatorModel,
          roundNumber,
        });
        const parts = DbMessagePartsSchema.parse([
          { text: '', type: MessagePartTypes.TEXT },
        ]);
        await db
          .insert(tables.chatMessage)
          .values({
            createdAt: new Date(),
            id: messageId,
            metadata: errorMetadata,
            participantId: null,
            parts,
            role: MessageRoles.ASSISTANT,
            roundNumber,
            threadId,
          })
          .onConflictDoNothing();

        logger?.info('Persisted error moderator message to D1', LogHelpers.operation({
          messageId,
          operationName: 'executeModeratorPhase',
          roundNumber,
          threadId,
        }));
      } catch (persistError) {
        const persistErrMsg = persistError instanceof Error ? persistError.message : 'Unknown error';
        logger?.error('Failed to persist error moderator message', LogHelpers.operation({
          error: persistErrMsg,
          operationName: 'executeModeratorPhase',
          roundNumber,
          threadId,
        }));
      }
    }

    return { finishReason: FinishReasons.OTHER, success: false };
  }
}

// ============================================================================
// MAIN ORCHESTRATION FUNCTION
// ============================================================================

/**
 * Execute unified round stream using AI SDK v6 createUIMessageStream
 *
 * Orchestrates presearch -> participants -> moderator phases sequentially,
 * emitting all events through AI SDK's native UI message stream format.
 *
 * Compatible with useChat({ resume: true }) on frontend.
 *
 * @param params - Round execution parameters
 * @param callbacks - Optional lifecycle callbacks
 * @returns ReadableStream for SSE response (from createUIMessageStream)
 */
export async function executeUnifiedRoundStream(
  params: UnifiedRoundStreamParams,
  callbacks?: UnifiedStreamCallbacks,
) {
  const { env, logger, participants, roundNumber, threadId } = params;
  const redisEnv = toRedisEnv(env);
  const roundId = `${threadId}:r${roundNumber}`;

  logger?.info('Unified stream starting', LogHelpers.operation({
    operationName: 'executeUnifiedRoundStream',
    roundNumber,
    threadId,
    totalParticipants: participants.length,
  }));

  // Lazy load AI SDK
  const { createUIMessageStream } = await getAiSdkModule();

  // Track participant responses for moderator
  const participantResponses = new Map<string, string>();

  const stream = createUIMessageStream<UnifiedUIMessage>({
    execute: async ({ writer }) => {
      const completedPhases: StreamPhase[] = [];
      let currentPhase: StreamPhase = StreamPhases.PRESEARCH;

      try {
        // Track round start for analytics (fire-and-forget)
        const roundStartTime = performance.now();
        trackRoundStarted(
          {
            sessionId: params.sessionId,
            threadId,
            userId: params.userId || 'anonymous',
            userTier: params.userTier,
          },
          {
            hasWebSearch: params.enableWebSearch,
            participantCount: participants.length,
            roundNumber,
            threadMode: params.mode ?? null,
          },
        ).catch(() => { /* analytics fire-and-forget */ });

        // =====================================================================
        // LANGUAGE DETECTION (runs in parallel with pre-search)
        // =====================================================================
        // Detect user message language before round starts.
        // Non-English → language directives injected into all system prompts.
        // English → null, no behavioral change.
        // =====================================================================
        const languageDetectionPromise = detectLanguage(params.userMessage, env);

        // =====================================================================
        // PHASE 1: Pre-search (optional)
        // =====================================================================
        currentPhase = StreamPhases.PRESEARCH;
        const presearchResult = await executePreSearchPhase(params, writer);
        if (presearchResult.success) {
          completedPhases.push(StreamPhases.PRESEARCH);

          // Track presearch completion for analytics (fire-and-forget)
          if (presearchResult.data) {
            trackPresearchCompleted(
              {
                sessionId: params.sessionId,
                threadId,
                userId: params.userId || 'anonymous',
                userTier: params.userTier,
              },
              {
                durationMs: presearchResult.data.totalTime,
                queryCount: presearchResult.data.queries.length,
                resultCount: presearchResult.data.totalResults,
                roundNumber,
              },
            ).catch(() => { /* analytics fire-and-forget */ });
          }

          // ===================================================================
          // PERSIST PRE-SEARCH COMPLETION TO D1
          // ===================================================================
          // The chatPreSearch record is created with status='pending' when the
          // thread starts. We MUST update it to 'complete' with searchData so
          // that page refresh shows the search results instead of loading state.
          //
          // IMPORTANT: Transform ValidatedPreSearchData to DbPreSearchTableData:
          // - Add 'total' field to each query entry
          // - Ensure publishedDate is string | null (not undefined)
          // - Use schema validation for type safety
          // ===================================================================
          if (params.db && presearchResult.data) {
            try {
              // Transform ValidatedPreSearchData to DbPreSearchTableData format
              const totalQueries = presearchResult.data.queries.length;
              const dbSearchDataRaw = {
                failureCount: presearchResult.data.failureCount,
                queries: presearchResult.data.queries.map(q => ({
                  index: q.index,
                  query: q.query,
                  rationale: q.rationale,
                  searchDepth: q.searchDepth,
                  total: totalQueries,
                })),
                results: presearchResult.data.results.map(r => ({
                  answer: r.answer,
                  query: r.query,
                  responseTime: r.responseTime,
                  results: r.results.map(item => ({
                    content: item.content,
                    contentType: item.contentType,
                    domain: item.domain,
                    excerpt: item.excerpt,
                    fullContent: item.fullContent,
                    images: item.images,
                    keyPoints: item.keyPoints,
                    metadata: item.metadata,
                    // Convert undefined to null for DB schema compatibility
                    publishedDate: item.publishedDate ?? null,
                    rawContent: item.rawContent,
                    score: item.score,
                    title: item.title,
                    url: item.url,
                  })),
                })),
                successCount: presearchResult.data.successCount,
                summary: presearchResult.data.summary,
                totalResults: presearchResult.data.totalResults,
                totalTime: presearchResult.data.totalTime,
              };

              // Validate with schema for type safety
              const dbSearchData = DbPreSearchTableDataSchema.parse(dbSearchDataRaw);

              await params.db.update(tables.chatPreSearch)
                .set({
                  completedAt: new Date(),
                  searchData: dbSearchData,
                  status: MessageStatuses.COMPLETE,
                })
                .where(and(
                  eq(tables.chatPreSearch.threadId, threadId),
                  eq(tables.chatPreSearch.roundNumber, roundNumber),
                ));

              // Cache invalidation moved to end-of-round (single invalidation per round)

              logger?.info('Pre-search record updated to complete', LogHelpers.operation({
                operationName: 'executeUnifiedRoundStream',
                roundNumber,
                threadId,
              }));
            } catch (persistError) {
              // Log but don't fail the stream - pre-search data is already sent to client
              const errMsg = persistError instanceof Error ? persistError.message : 'Unknown error';
              logger?.error('Failed to persist pre-search completion to D1', LogHelpers.operation({
                error: errMsg,
                operationName: 'executeUnifiedRoundStream',
                roundNumber,
                threadId,
              }));
            }
          }

          // Persist domain-source-only presearch completion to D1
          // When presearchResult.data is null but domainSourceResults exist,
          // still mark the chatPreSearch record as complete so page refresh works
          if (params.db && !presearchResult.data && presearchResult.domainSourceResults && presearchResult.domainSourceResults.size > 0) {
            try {
              await params.db.update(tables.chatPreSearch)
                .set({
                  completedAt: new Date(),
                  status: MessageStatuses.COMPLETE,
                })
                .where(and(
                  eq(tables.chatPreSearch.threadId, threadId),
                  eq(tables.chatPreSearch.roundNumber, roundNumber),
                ));

              logger?.info('Pre-search record updated to complete (domain sources only)', LogHelpers.operation({
                operationName: 'executeUnifiedRoundStream',
                roundNumber,
                threadId,
              }));
            } catch (persistError) {
              const errMsg = persistError instanceof Error ? persistError.message : 'Unknown error';
              logger?.error('Failed to persist domain-source presearch completion to D1', LogHelpers.operation({
                error: errMsg,
                operationName: 'executeUnifiedRoundStream',
                roundNumber,
                threadId,
              }));
            }
          }
        }

        // If presearch ran successfully, finish its message so participants get separate messages
        if (presearchResult.success) {
          try {
            writer.write({
              messageMetadata: { isPresearch: true, role: MessageRoles.ASSISTANT, roundNumber },
              type: 'finish',
            });
          } catch {
            // Writer closed — presearch data already persisted, continue to participants
          }
        }

        // =====================================================================
        // LOAD CONVERSATION HISTORY (once, shared across all participants)
        // =====================================================================
        // Load messages from prior rounds to give participants context.
        // This is loaded ONCE and passed to all participants to avoid
        // redundant DB queries and ensure consistent context.
        // =====================================================================
        let sharedConversationHistory: ModelMessage[] | undefined;

        // BUG-04 FIX: Start heartbeat during context building block.
        // loadAndPruneConversationHistory, language detection, loadAttachmentContent,
        // and search context building are all blocking with zero SSE output.
        // Combined they can exceed the 30-second Cloudflare Workers idle timeout.
        const contextBuildingHeartbeat = startHeartbeat(writer);

        if (params.db && roundNumber > 0) {
          try {
            const historyResult = await loadAndPruneConversationHistory({
              currentRoundNumber: roundNumber,
              db: params.db,
              logger,
              threadId,
            });

            if (historyResult.messages.length > 0) {
              sharedConversationHistory = historyResult.messages;
              logger?.info('Pre-loaded shared conversation history', LogHelpers.operation({
                loadedCount: historyResult.stats.rawCount,
                messageCount: historyResult.messages.length,
                operationName: 'executeUnifiedRoundStream',
                roundNumber,
                threadId,
              }));
            }
          } catch (historyError) {
            // Log but don't fail - participants will work without history
            const errMsg = historyError instanceof Error ? historyError.message : 'Unknown error';
            logger?.warn('Failed to load conversation history', LogHelpers.operation({
              error: errMsg,
              operationName: 'executeUnifiedRoundStream',
              roundNumber,
              threadId,
            }));
          }
        }

        // =====================================================================
        // LOAD WORKING MEMORY (project-scoped memory via chatId=projectId)
        // Uses @ai-sdk-tools/memory DrizzleProvider + library formatting helpers
        // No project = no memory features
        // =====================================================================
        let workingMemoryPrompt: string | undefined;
        if (params.db && params.userId && params.projectId) {
          try {
            const { createMemoryProvider, loadWorkingMemoryForPrompt } = await import('@/services/memory');
            const provider = createMemoryProvider(params.db);
            const memoryResult = await loadWorkingMemoryForPrompt({
              logger,
              projectId: params.projectId,
              provider,
            });
            // Memory content only — no tool instructions (memory auto-extracts in background)
            workingMemoryPrompt = memoryResult.formattedPrompt || undefined;
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            logger?.warn('Failed to load working memory', LogHelpers.operation({
              error: errMsg,
              operationName: 'executeUnifiedRoundStream',
              roundNumber,
              threadId,
            }));
          }
        }

        // Merge conversation history + working memory into params for participants
        const paramsWithHistory: UnifiedRoundStreamParams = {
          ...params,
          ...(sharedConversationHistory && { conversationHistory: sharedConversationHistory }),
          ...(workingMemoryPrompt && { workingMemoryPrompt }),
        };

        // Await language detection (started in parallel with pre-search)
        const detectedLanguage = await languageDetectionPromise;
        if (detectedLanguage) {
          logger?.info(`Detected non-English language: ${detectedLanguage}`, LogHelpers.operation({
            operationName: 'executeUnifiedRoundStream',
            roundNumber,
            threadId,
          }));
        }

        // =====================================================================
        // PHASE 2: Participants (sequential)
        // =====================================================================
        currentPhase = StreamPhases.PARTICIPANT;
        const priorResponses: PriorParticipantResponse[] = [];
        const allCitableSources: CitableSource[] = [];

        // ✅ PERF: Build search context ONCE before participant loop (shared across all participants)
        let sharedSearchContext: SearchContextResult | null = null;
        if (presearchResult.data && presearchResult.data.results.length > 0) {
          try {
            sharedSearchContext = buildDirectSearchContext(presearchResult.data, roundNumber);
            logger?.info('Pre-built shared search context for all participants', LogHelpers.operation({
              operationName: 'executeUnifiedRoundStream',
              roundNumber,
              sourceCount: sharedSearchContext.citableSources.length,
              threadId,
            }));
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            logger?.warn('Failed to pre-build shared search context', LogHelpers.operation({
              error: errMsg,
              operationName: 'executeUnifiedRoundStream',
              roundNumber,
              threadId,
            }));
          }
        }

        // ✅ PERF: Load attachment content ONCE before participant loop (shared across all participants)
        // Previously each participant loaded files independently from R2, causing N× memory usage
        // and N× R2 subrequests. Loading once reduces memory from O(N×M) to O(M) where N=participants, M=files.
        let sharedAttachmentContent: LoadAttachmentContentResult | null = null;
        if (params.attachmentIds && params.attachmentIds.length > 0 && params.db) {
          try {
            sharedAttachmentContent = await loadAttachmentContent({
              attachmentIds: params.attachmentIds,
              db: params.db,
              logger,
              r2Bucket: params.env.UPLOADS_R2_BUCKET,
            });
            logger?.info('Pre-loaded shared attachment content for all participants', LogHelpers.operation({
              operationName: 'executeUnifiedRoundStream',
              roundNumber,
              stats: sharedAttachmentContent.stats,
              threadId,
            }));
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            logger?.warn('Failed to pre-load shared attachment content', LogHelpers.operation({
              error: errMsg,
              operationName: 'executeUnifiedRoundStream',
              roundNumber,
              threadId,
            }));
          }
        }

        // NOTE: contextBuildingHeartbeat is NOT cleared here. It continues running
        // through the participant loop and moderator phase. Each streamText call has
        // first-token latency (5-15s on OpenRouter), and between 3 sequential
        // participants + moderator the idle gaps can exceed 30s. The heartbeat is
        // cleared after round completion (see below) or in the outer catch block.

        for (let i = 0; i < participants.length; i++) {
          const participant = participants[i];
          if (!participant) {
            continue;
          }

          // ALWAYS emit start with messageMetadata for every participant.
          // createUIMessageStream creates an implicit first message, but we need
          // to emit start with metadata so the UIMessage has metadata set.
          // When i === 0 and presearch didn't run, this sets metadata on the implicit message.
          // When i > 0 or presearch ran, this creates a new message boundary.
          try {
            writer.write({
              messageMetadata: {
                model: participant.modelId,
                participantId: participant.id,
                participantIndex: participant.index,
                role: MessageRoles.ASSISTANT,
                roundNumber,
              },
              type: 'start',
            });
          } catch (writerErr) {
            // Writer closed (client disconnect) — skip this participant but continue loop
            // so remaining participants can still persist to D1 even without SSE delivery
            logger?.warn('Writer closed before participant start, skipping SSE', LogHelpers.operation({
              error: writerErr instanceof Error ? writerErr.message : String(writerErr),
              operationName: 'executeUnifiedRoundStream',
              participantIndex: i,
              threadId,
            }));
          }

          const result = await executeParticipantPhase(
            paramsWithHistory,
            participant,
            writer,
            priorResponses,
            presearchResult.data,
            sharedSearchContext,
            sharedAttachmentContent,
            detectedLanguage,
            presearchResult.domainSourceResults, // Cached domain source results from presearch
          );

          // Finish this participant's message with metadata and finishReason
          try {
            writer.write({
              finishReason: result.finishReason,
              messageMetadata: {
                model: participant.modelId,
                participantId: participant.id,
                participantIndex: participant.index,
                role: MessageRoles.ASSISTANT,
                roundNumber,
              },
              type: 'finish',
            });
          } catch {
            // Writer closed — message already persisted to D1, SSE delivery lost
          }

          if (result.success) {
            priorResponses.push({
              modelId: participant.modelId,
              modelName: extractReadableModelName(participant.modelId),
              participantId: participant.id,
              participantIndex: participant.index,
              response: result.response,
              role: participant.role ?? null,
            });
            participantResponses.set(participant.id, result.response);

            // Collect citable sources from this participant for moderator
            if (result.citableSources) {
              allCitableSources.push(...result.citableSources);
            }
          }
        }

        // All participants were processed (successful or failed)
        completedPhases.push(StreamPhases.PARTICIPANT);

        // =====================================================================
        // PHASE 3: Moderator (if 2+ participants)
        // =====================================================================
        if (participants.length >= 2) {
          currentPhase = StreamPhases.MODERATOR;

          // Start new message for moderator
          try {
            writer.write({
              messageMetadata: {
                isModerator: true,
                role: MessageRoles.ASSISTANT,
                roundNumber,
              },
              type: 'start',
            });
          } catch {
            // Writer closed — moderator phase still executes for D1 persistence
          }

          const moderatorResult = await executeModeratorPhase(params, writer, participantResponses, allCitableSources, detectedLanguage);
          if (moderatorResult.success) {
            completedPhases.push(StreamPhases.MODERATOR);
          }

          // Finish moderator's message with finishReason
          try {
            writer.write({
              finishReason: moderatorResult.finishReason,
              messageMetadata: {
                isModerator: true,
                role: MessageRoles.ASSISTANT,
                roundNumber,
              },
              type: 'finish',
            });
          } catch {
            // Writer closed — moderator message already persisted to D1
          }
        }

        // =====================================================================
        // ROUND COMPLETE
        // =====================================================================
        const roundComplete: RoundCompleteData = {
          completedPhases,
          roundId,
          timestamp: new Date().toISOString(),
        };
        try {
          writer.write({ data: roundComplete, type: 'data-round-complete' });
        } catch {
          // Writer closed — round completion still persisted to Redis/D1
        }

        await completeUnifiedStream(threadId, roundNumber, redisEnv, logger).catch((err) => {
          logger?.error('Failed to complete unified stream in Redis', LogHelpers.operation({
            error: err instanceof Error ? err.message : 'Unknown error',
            operationName: 'completeUnifiedStream',
            threadId,
          }));
        });

        // ✅ PERF: Single cache invalidation per round (replaces per-participant + moderator + presearch invalidations)
        if (params.db) {
          await invalidateMessagesCache(params.db, threadId);
        }

        // Stop the context-building heartbeat now that the round is complete
        // and all SSE events have been written (participants + moderator).
        clearInterval(contextBuildingHeartbeat);

        await callbacks?.onComplete?.(roundId);

        // Track round completion for analytics (fire-and-forget)
        trackRoundCompleted(
          {
            sessionId: params.sessionId,
            threadId,
            userId: params.userId || 'anonymous',
            userTier: params.userTier,
          },
          {
            durationMs: performance.now() - roundStartTime,
            hadModerator: completedPhases.includes(StreamPhases.MODERATOR),
            hadPresearch: completedPhases.includes(StreamPhases.PRESEARCH),
            participantCount: participants.length,
            roundNumber,
          },
        ).catch(() => { /* analytics fire-and-forget */ });

        logger?.info('Unified stream completed', LogHelpers.operation({
          operationName: 'executeUnifiedRoundStream',
          roundNumber,
          status: 'completed',
          threadId,
          totalParticipants: participants.length,
        }));
      } catch (error) {
        // Ensure heartbeat is cleaned up on error path too
        clearInterval(contextBuildingHeartbeat);

        const err = error instanceof Error ? error : new Error(String(error));

        logger?.error('Unified stream failed', LogHelpers.operation({
          error: err.message,
          operationName: 'executeUnifiedRoundStream',
          roundNumber,
          status: currentPhase,
          threadId,
        }));

        // Track stream error for analytics (fire-and-forget)
        trackStreamError(
          {
            sessionId: params.sessionId,
            threadId,
            userId: params.userId || 'anonymous',
            userTier: params.userTier,
          },
          {
            errorType: err.name || 'UnknownError',
            phase: currentPhase,
            roundNumber,
          },
        ).catch(() => { /* analytics fire-and-forget */ });

        // Emit error as data part
        try {
          writer.write({
            data: { error: err.message, phase: currentPhase, timestamp: new Date().toISOString() },
            type: 'data-error',
          });
        } catch { /* Writer may be closed */ }

        // Always emit round-complete with partial phases so frontend
        // knows exactly which phases succeeded vs failed
        try {
          const roundComplete: RoundCompleteData = {
            completedPhases,
            roundId,
            timestamp: new Date().toISOString(),
          };
          writer.write({ data: roundComplete, type: 'data-round-complete' });
        } catch {
          // Writer may be closed — frontend fallback handles this
        }

        await failUnifiedStream(threadId, roundNumber, err.message, redisEnv, logger).catch((failErr) => {
          logger?.error('Failed to mark unified stream as failed in Redis', LogHelpers.operation({
            error: failErr instanceof Error ? failErr.message : 'Unknown error',
            operationName: 'failUnifiedStream',
            threadId,
          }));
        });

        await callbacks?.onError?.(err, currentPhase);
      }
    },
  });

  return stream;
}
