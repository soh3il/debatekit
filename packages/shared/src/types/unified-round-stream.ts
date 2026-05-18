/**
 * Unified Round Stream Types
 *
 * Type definitions for the unified SSE stream that consolidates presearch,
 * participant, and moderator phases into a single connection.
 * Follows AI SDK v6 streaming patterns.
 */

import { z } from '@hono/zod-openapi';

import { FinishReasonSchema } from '../enums/ai-sdk';
import { MessageRoleSchema } from '../enums/chat';
import { DataSourceIdSchema } from '../enums/data-sources';
import { CitationSourceTypeSchema } from '../enums/project';
import type {
  StreamPhase,
} from '../enums/streaming';
import {
  ArtifactStatusSchema,
  DEFAULT_STREAM_PHASE,
  STREAM_PHASES,
  StreamPhases,
  StreamPhaseSchema,
} from '../enums/streaming';
import { WebSearchDepthSchema } from '../enums/web-search';

// ============================================================================
// UNIFIED PHASE STATUS (Phase lifecycle within unified stream)
// ============================================================================

// 1. ARRAY CONSTANT
export const UNIFIED_PHASE_STATUSES = ['pending', 'active', 'complete', 'skipped', 'error'] as const;

// 2. ZOD SCHEMA
export const UnifiedPhaseStatusSchema = z.enum(UNIFIED_PHASE_STATUSES).openapi({
  description: 'Status of a phase within the unified round stream',
  example: 'active',
});

// 3. TYPESCRIPT TYPE
export type UnifiedPhaseStatus = z.infer<typeof UnifiedPhaseStatusSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_UNIFIED_PHASE_STATUS: UnifiedPhaseStatus = 'pending';

// 5. CONSTANT OBJECT
export const UnifiedPhaseStatuses = {
  ACTIVE: 'active' as const,
  COMPLETE: 'complete' as const,
  ERROR: 'error' as const,
  PENDING: 'pending' as const,
  SKIPPED: 'skipped' as const,
} as const;

// ============================================================================
// UNIFIED EVENT TYPE (Discriminator for unified stream events)
// ============================================================================

// 1. ARRAY CONSTANT
export const UNIFIED_EVENT_TYPES = [
  'phase-start',
  'phase-complete',
  'phase-error',
  'text-delta',
  'reasoning-delta',
  'tool-call',
  'tool-result',
  'finish',
  'round-complete',
] as const;

// 2. ZOD SCHEMA
export const UnifiedEventTypeSchema = z.enum(UNIFIED_EVENT_TYPES).openapi({
  description: 'Event type discriminator for unified round stream',
  example: 'text-delta',
});

// 3. TYPESCRIPT TYPE
export type UnifiedEventType = z.infer<typeof UnifiedEventTypeSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_UNIFIED_EVENT_TYPE: UnifiedEventType = 'text-delta';

// 5. CONSTANT OBJECT
export const UnifiedEventTypes = {
  FINISH: 'finish' as const,
  PHASE_COMPLETE: 'phase-complete' as const,
  PHASE_ERROR: 'phase-error' as const,
  PHASE_START: 'phase-start' as const,
  REASONING_DELTA: 'reasoning-delta' as const,
  ROUND_COMPLETE: 'round-complete' as const,
  TEXT_DELTA: 'text-delta' as const,
  TOOL_CALL: 'tool-call' as const,
  TOOL_RESULT: 'tool-result' as const,
} as const;

// ============================================================================
// PHASE EVENT SCHEMA (Phase transition events)
// ============================================================================

export const PhaseEventSchema = z
  .object({
    error: z.string().optional().openapi({
      description: 'Error message when status is error',
      example: 'Stream timeout exceeded',
    }),
    participantId: z.string().uuid().optional().openapi({
      description: 'Participant ID when phase is participant',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    participantIndex: z.number().int().min(0).optional().openapi({
      description: 'Zero-based index of current participant',
      example: 0,
    }),
    phase: StreamPhaseSchema,
    status: UnifiedPhaseStatusSchema,
    timestamp: z.string().datetime().openapi({
      description: 'ISO timestamp of phase event',
      example: '2024-01-15T10:30:00.000Z',
    }),
    totalParticipants: z.number().int().min(0).optional().openapi({
      description: 'Total number of participants in round',
      example: 3,
    }),
  })
  .openapi({
    description: 'Phase transition event in unified stream',
  });

export type PhaseEvent = z.infer<typeof PhaseEventSchema>;

// ============================================================================
// PHASE PROGRESS SCHEMA (Progress tracking within phase)
// ============================================================================

export const PhaseProgressSchema = z
  .object({
    completedParticipants: z.array(z.string().uuid()).optional().openapi({
      description: 'List of completed participant IDs',
      example: ['123e4567-e89b-12d3-a456-426614174000'],
    }),
    currentParticipantIndex: z.number().int().min(0).optional().openapi({
      description: 'Current participant index (0-based) for participant phase',
      example: 1,
    }),
    phase: StreamPhaseSchema,
    startedAt: z.string().datetime().optional().openapi({
      description: 'ISO timestamp when phase started',
      example: '2024-01-15T10:30:00.000Z',
    }),
    tokensGenerated: z.number().int().min(0).optional().openapi({
      description: 'Tokens generated in current phase',
      example: 150,
    }),
    totalParticipants: z.number().int().min(0).optional().openapi({
      description: 'Total participants in round',
      example: 3,
    }),
  })
  .openapi({
    description: 'Progress tracking for current phase',
  });

export type PhaseProgress = z.infer<typeof PhaseProgressSchema>;

// ============================================================================
// UNIFIED STREAM CHUNK SCHEMA (Wrapper for all chunk types)
// ============================================================================

export const UnifiedStreamChunkSchema = z
  .discriminatedUnion('type', [
    // Phase lifecycle events
    z.object({
      participantId: z.string().uuid().optional(),
      participantIndex: z.number().int().min(0).optional(),
      phase: StreamPhaseSchema,
      timestamp: z.string().datetime(),
      totalParticipants: z.number().int().min(0).optional(),
      type: z.literal('phase-start'),
    }),
    z.object({
      participantId: z.string().uuid().optional(),
      phase: StreamPhaseSchema,
      timestamp: z.string().datetime(),
      type: z.literal('phase-complete'),
    }),
    z.object({
      error: z.string(),
      participantId: z.string().uuid().optional(),
      phase: StreamPhaseSchema,
      timestamp: z.string().datetime(),
      type: z.literal('phase-error'),
    }),

    // Content streaming events (AI SDK v6 patterns)
    z.object({
      content: z.string(),
      participantId: z.string().uuid().optional(),
      phase: StreamPhaseSchema,
      type: z.literal('text-delta'),
    }),
    z.object({
      content: z.string(),
      participantId: z.string().uuid().optional(),
      phase: StreamPhaseSchema,
      type: z.literal('reasoning-delta'),
    }),

    // Tool events
    z.object({
      args: z.record(z.string(), z.unknown()),
      participantId: z.string().uuid().optional(),
      phase: StreamPhaseSchema,
      toolCallId: z.string(),
      toolName: z.string(),
      type: z.literal('tool-call'),
    }),
    z.object({
      participantId: z.string().uuid().optional(),
      phase: StreamPhaseSchema,
      result: z.unknown(),
      toolCallId: z.string(),
      type: z.literal('tool-result'),
    }),

    // Completion events
    z.object({
      finishReason: FinishReasonSchema,
      participantId: z.string().uuid().optional(),
      phase: StreamPhaseSchema,
      type: z.literal('finish'),
      usage: z
        .object({
          completionTokens: z.number().int().min(0),
          promptTokens: z.number().int().min(0),
          totalTokens: z.number().int().min(0),
        })
        .optional(),
    }),
    z.object({
      completedPhases: z.array(StreamPhaseSchema),
      roundId: z.string().uuid(),
      timestamp: z.string().datetime(),
      type: z.literal('round-complete'),
    }),
  ])
  .openapi({
    description: 'Unified stream chunk with discriminated union by type',
  });

export type UnifiedStreamChunk = z.infer<typeof UnifiedStreamChunkSchema>;

// ============================================================================
// UNIFIED ROUND STATE SCHEMA (Full round state for unified stream)
// ============================================================================

export const UnifiedRoundStateSchema = z
  .object({
    activeParticipantId: z.string().uuid().nullable().openapi({
      description: 'Currently streaming participant ID',
      example: '123e4567-e89b-12d3-a456-426614174002',
    }),
    currentPhase: StreamPhaseSchema.openapi({
      description: 'Currently active phase',
    }),
    lastEventAt: z.string().datetime().optional().openapi({
      description: 'ISO timestamp of last stream event',
      example: '2024-01-15T10:30:05.000Z',
    }),
    phaseStatuses: z
      .object({
        moderator: UnifiedPhaseStatusSchema,
        participant: UnifiedPhaseStatusSchema,
        presearch: UnifiedPhaseStatusSchema,
      })
      .openapi({
        description: 'Status of each phase in the round',
      }),
    progress: PhaseProgressSchema.optional().openapi({
      description: 'Current progress within active phase',
    }),
    roundId: z.string().uuid().openapi({
      description: 'Unique identifier for the round',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    startedAt: z.string().datetime().openapi({
      description: 'ISO timestamp when round started',
      example: '2024-01-15T10:30:00.000Z',
    }),
    threadId: z.string().uuid().openapi({
      description: 'Thread this round belongs to',
      example: '123e4567-e89b-12d3-a456-426614174001',
    }),
  })
  .openapi({
    description: 'Complete state of a unified round stream',
  });

export type UnifiedRoundState = z.infer<typeof UnifiedRoundStateSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create initial unified round state
 */
export function createInitialUnifiedRoundState(
  roundId: string,
  threadId: string,
  includePresearch = true,
): UnifiedRoundState {
  return {
    activeParticipantId: null,
    currentPhase: includePresearch ? StreamPhases.PRESEARCH : StreamPhases.PARTICIPANT,
    lastEventAt: undefined,
    phaseStatuses: {
      moderator: UnifiedPhaseStatuses.PENDING,
      participant: UnifiedPhaseStatuses.PENDING,
      presearch: includePresearch ? UnifiedPhaseStatuses.PENDING : UnifiedPhaseStatuses.SKIPPED,
    },
    progress: undefined,
    roundId,
    startedAt: new Date().toISOString(),
    threadId,
  };
}

/**
 * Check if a phase is terminal (complete, skipped, or error)
 */
export function isPhaseTerminal(status: UnifiedPhaseStatus): boolean {
  return (
    status === UnifiedPhaseStatuses.COMPLETE
    || status === UnifiedPhaseStatuses.SKIPPED
    || status === UnifiedPhaseStatuses.ERROR
  );
}

/**
 * Get next phase after the given phase
 */
export function getNextPhase(currentPhase: StreamPhase): StreamPhase | null {
  switch (currentPhase) {
    case StreamPhases.PRESEARCH:
      return StreamPhases.PARTICIPANT;
    case StreamPhases.PARTICIPANT:
      return StreamPhases.MODERATOR;
    case StreamPhases.MODERATOR:
      return null;
    default:
      return null;
  }
}

// ============================================================================
// AI SDK DATA PART TYPES (For useChat onData callback)
// ============================================================================

// 1. ARRAY CONSTANT - AI SDK data part status values
export const AI_SDK_PHASE_STATUSES = ['start', 'complete', 'error'] as const;

// 2. ZOD SCHEMA
export const AiSdkPhaseStatusSchema = z.enum(AI_SDK_PHASE_STATUSES).openapi({
  description: 'AI SDK data part status for phase lifecycle',
  example: 'start',
});

// 3. TYPESCRIPT TYPE
export type AiSdkPhaseStatus = z.infer<typeof AiSdkPhaseStatusSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_AI_SDK_PHASE_STATUS: AiSdkPhaseStatus = 'start';

// 5. CONSTANT OBJECT
export const AiSdkPhaseStatuses = {
  COMPLETE: 'complete' as const,
  ERROR: 'error' as const,
  START: 'start' as const,
} as const;

/**
 * Phase marker data for AI SDK data parts.
 * Sent as `type: 'data-phase'` custom data parts via AI SDK v6.
 *
 * Used by:
 * - Backend: writer.write({ type: 'data-phase', data: PhaseMarkerData })
 * - Frontend: onData callback in useChat receives these
 */
export const PhaseMarkerDataSchema = z
  .object({
    error: z.string().optional().openapi({
      description: 'Error message when status is error',
    }),
    participantId: z.string().optional().openapi({
      description: 'Participant ID when phase is participant',
    }),
    participantIndex: z.number().int().min(0).optional().openapi({
      description: 'Zero-based index of current participant',
    }),
    phase: StreamPhaseSchema,
    skipped: z.boolean().optional().openapi({
      description: 'Whether this phase was skipped (sent with status complete)',
    }),
    status: AiSdkPhaseStatusSchema,
    timestamp: z.string().datetime().openapi({
      description: 'ISO timestamp of phase marker',
    }),
    totalParticipants: z.number().int().min(0).optional().openapi({
      description: 'Total number of participants in round',
    }),
  })
  .openapi({
    description: 'Phase marker data for AI SDK custom data parts',
  });

export type PhaseMarkerData = z.infer<typeof PhaseMarkerDataSchema>;

/**
 * Round complete data for AI SDK data parts.
 * Sent as `type: 'data-round-complete'` to signal end of unified round stream.
 */
export const RoundCompleteDataSchema = z
  .object({
    completedPhases: z.array(StreamPhaseSchema).openapi({
      description: 'List of phases that completed successfully',
    }),
    roundId: z.string().openapi({
      description: 'Unique identifier for the completed round',
    }),
    timestamp: z.string().datetime().openapi({
      description: 'ISO timestamp of round completion',
    }),
  })
  .openapi({
    description: 'Round complete data for AI SDK custom data parts',
  });

export type RoundCompleteData = z.infer<typeof RoundCompleteDataSchema>;

/**
 * Error data for AI SDK data parts.
 * Sent as `type: 'data-error'` when a stream-level error occurs.
 */
export const StreamErrorDataSchema = z
  .object({
    error: z.string().openapi({
      description: 'Error message',
    }),
    participantIndex: z.number().optional().openapi({
      description: 'Index of the participant that errored (only for participant phase errors)',
    }),
    phase: StreamPhaseSchema,
    timestamp: z.string().datetime().openapi({
      description: 'ISO timestamp of error',
    }),
  })
  .openapi({
    description: 'Stream error data for AI SDK custom data parts',
  });

export type StreamErrorData = z.infer<typeof StreamErrorDataSchema>;

// ============================================================================
// DOMAIN SOURCE PROGRESS DATA PART (For visible domain source fetching)
// ============================================================================

/**
 * Domain source progress data for AI SDK data parts.
 * Sent as `type: 'data-domain-source-progress'` during presearch phase
 * to show users which domain data sources are being checked.
 */
export const DomainSourceProgressDataSchema = z
  .object({
    error: z.string().optional().openapi({
      description: 'Error message when status is error',
    }),
    label: z.string().openapi({
      description: 'Human-readable source name (e.g. "SEC EDGAR")',
    }),
    sourceId: DataSourceIdSchema,
    status: AiSdkPhaseStatusSchema,
    timestamp: z.string().datetime().openapi({
      description: 'ISO timestamp of progress event',
    }),
  })
  .openapi({
    description: 'Domain source progress data for AI SDK custom data parts',
  });

export type DomainSourceProgressData = z.infer<typeof DomainSourceProgressDataSchema>;

// ============================================================================
// PRESEARCH DATA PART TYPES (For progressive presearch streaming)
// ============================================================================

/**
 * Presearch query data for AI SDK data parts.
 * Sent as `type: 'data-presearch-query'` for each generated search query.
 * This enables progressive UI updates as queries are generated.
 */
export const PresearchQueryDataSchema = z
  .object({
    index: z.number().int().min(0).openapi({
      description: 'Zero-based index of this query',
    }),
    query: z.string().openapi({
      description: 'The search query text',
    }),
    rationale: z.string().openapi({
      description: 'Reasoning for why this query was generated',
    }),
    searchDepth: WebSearchDepthSchema.openapi({
      description: 'Search depth for this query',
    }),
    total: z.number().int().min(1).openapi({
      description: 'Total number of queries being generated',
    }),
  })
  .openapi({
    description: 'Presearch query data for AI SDK custom data parts',
  });

export type PresearchQueryData = z.infer<typeof PresearchQueryDataSchema>;

/**
 * Presearch result item for individual search results.
 */
export const PresearchResultItemSchema = z
  .object({
    description: z.string().openapi({
      description: 'Extended description or snippet',
    }),
    favicon: z.string().openapi({
      description: 'Favicon URL for the result domain',
    }),
    snippet: z.string().openapi({
      description: 'Short snippet from the result',
    }),
    title: z.string().openapi({
      description: 'Title of the search result',
    }),
    url: z.string().url().openapi({
      description: 'URL of the search result',
    }),
  })
  .openapi({
    description: 'Individual search result item',
  });

export type PresearchResultItem = z.infer<typeof PresearchResultItemSchema>;

/**
 * Presearch result data for AI SDK data parts.
 * Sent as `type: 'data-presearch-result'` for each completed search.
 * This enables progressive UI updates as search results arrive.
 */
export const PresearchResultDataSchema = z
  .object({
    answer: z.string().nullable().openapi({
      description: 'AI-generated answer summary (if available)',
    }),
    index: z.number().int().min(0).openapi({
      description: 'Zero-based index matching the query index',
    }),
    query: z.string().openapi({
      description: 'The search query this result is for',
    }),
    responseTime: z.number().openapi({
      description: 'Time taken to execute search in milliseconds',
    }),
    results: z.array(PresearchResultItemSchema).openapi({
      description: 'Array of search result items',
    }),
  })
  .openapi({
    description: 'Presearch result data for AI SDK custom data parts',
  });

export type PresearchResultData = z.infer<typeof PresearchResultDataSchema>;

// ============================================================================
// AVAILABLE SOURCES DATA PART TYPE (For streaming citation sources early)
// ============================================================================

/**
 * Available source data for AI SDK data parts.
 * Sent as `type: 'data-available-sources'` at the start of participant phase.
 * This enables the frontend to show proper citation titles during streaming
 * (e.g., actual filenames instead of "Attached File").
 */
export const AvailableSourceDataSchema = z
  .object({
    /** Author of the source content (for search results) */
    author: z.string().optional(),
    /** Brief description of the source */
    description: z.string().optional(),
    /** Domain/hostname for web sources */
    domain: z.string().optional(),
    /** Download URL for file attachments */
    downloadUrl: z.string().optional(),
    /** Content excerpt/snippet that was cited */
    excerpt: z.string().optional(),
    /** Original filename for attachments */
    filename: z.string().optional(),
    /** File size in bytes for attachments */
    fileSize: z.number().optional(),
    /** Unique citation ID (e.g., att_abc123, sch_xyz789) */
    id: z.string(),
    /** MIME type for attachments */
    mimeType: z.string().optional(),
    /** Published date for search results */
    publishedDate: z.string().optional(),
    /** Search query that returned this result */
    query: z.string().optional(),
    /** Round number where source was used */
    roundNumber: z.number().optional(),
    /** Source type (attachment, search, thread, memory, moderator, rag) */
    sourceType: CitationSourceTypeSchema,
    /** Thread title for thread citations */
    threadTitle: z.string().optional(),
    /** Display title for the source */
    title: z.string(),
    /** Source URL for web/search results */
    url: z.string().optional(),
  })
  .openapi({
    description: 'Available source data for citation display during streaming',
  });

export type AvailableSourceData = z.infer<typeof AvailableSourceDataSchema>;

/**
 * Available sources data for AI SDK data parts.
 * Sent as `type: 'data-available-sources'` at the start of participant phase.
 */
export const AvailableSourcesDataSchema = z
  .object({
    sources: z.array(AvailableSourceDataSchema).openapi({
      description: 'Array of available sources for citation display',
    }),
    timestamp: z.string().datetime().openapi({
      description: 'ISO timestamp when sources were sent',
    }),
  })
  .openapi({
    description: 'Available sources data for AI SDK custom data parts',
  });

export type AvailableSourcesData = z.infer<typeof AvailableSourcesDataSchema>;

// ============================================================================
// HEARTBEAT DATA PART TYPE (SSE keep-alive during blocking operations)
// ============================================================================

/**
 * Heartbeat data sent as a transient SSE event to prevent Cloudflare Workers
 * 30-second idle timeout during blocking operations (content extraction,
 * context building, Redis state updates).
 *
 * Sent as `type: 'data-heartbeat'` with `transient: true` so it is not
 * persisted to message state.
 */
export const HeartbeatDataSchema = z
  .object({
    timestamp: z.string().datetime().openapi({
      description: 'ISO 8601 timestamp of the heartbeat',
    }),
  })
  .openapi({
    description: 'Keep-alive heartbeat data for SSE connection maintenance',
  });

export type HeartbeatData = z.infer<typeof HeartbeatDataSchema>;

// ============================================================================
// UNIFIED MESSAGE METADATA (AI SDK v6 messageMetadataSchema)
// ============================================================================

/**
 * Zod schema for message metadata streamed via AI SDK v6 messageMetadata callback.
 * Used by both backend (to type the metadata) and frontend (as messageMetadataSchema
 * in useChat for runtime validation).
 *
 * All fields optional because metadata is incrementally merged from start/finish
 * boundaries - a message may only have a subset at any given time.
 */
export const UnifiedMessageMetadataSchema = z.object({
  isModerator: z.boolean().optional(),
  isPresearch: z.boolean().optional(),
  model: z.string().optional(),
  participantId: z.string().optional(),
  participantIndex: z.number().int().min(0).optional(),
  role: MessageRoleSchema.optional(),
  roundNumber: z.number().int().min(0).optional(),
});

export type UnifiedMessageMetadata = z.infer<typeof UnifiedMessageMetadataSchema>;

// ============================================================================
// ARTIFACT DATA PART SCHEMAS (for @ai-sdk-tools/artifacts registration)
// ============================================================================

/**
 * Generic artifact instance envelope schema.
 * @ai-sdk-tools/artifacts wraps payload data in this structure on the wire.
 * Must be registered in useChat({ dataPartSchemas }) for useArtifact() to work.
 */
function artifactInstanceSchema<T extends z.ZodType>(payloadSchema: T) {
  return z.object({
    createdAt: z.number(),
    error: z.string().optional(),
    id: z.string(),
    payload: payloadSchema,
    progress: z.number().optional(),
    status: ArtifactStatusSchema,
    type: z.string(),
    updatedAt: z.number(),
    version: z.number(),
  });
}

/** Data part schema for `data-artifact-presearch` — key: `'artifact-presearch'` */
const ArtifactPresearchDataPartSchema = artifactInstanceSchema(
  z.object({
    queries: z.array(PresearchQueryDataSchema),
    results: z.array(PresearchResultDataSchema),
    summary: z.string(),
    totalResults: z.number(),
  }),
);

/** Data part schema for `data-artifact-available-sources` — key: `'artifact-available-sources'` */
const ArtifactAvailableSourcesDataPartSchema = artifactInstanceSchema(
  AvailableSourcesDataSchema,
);

// ============================================================================
// UNIFIED DATA PART SCHEMAS (AI SDK v6 dataPartSchemas)
// ============================================================================

/**
 * Data part schemas for AI SDK v6 useChat configuration.
 * Keys map to data part types: key 'phase' → wire type 'data-phase'.
 *
 * When passed to useChat({ dataPartSchemas }), the SDK validates incoming
 * data parts at runtime and provides typed access in the onData callback.
 *
 * Artifact schemas (artifact-presearch, artifact-available-sources) are required
 * so that AI SDK persists these data parts into message.parts, enabling
 * useArtifact() hooks to find and return their payloads.
 */
export const unifiedDataPartSchemas = {
  'artifact-available-sources': ArtifactAvailableSourcesDataPartSchema,
  'artifact-presearch': ArtifactPresearchDataPartSchema,
  'domain-source-progress': DomainSourceProgressDataSchema,
  'error': StreamErrorDataSchema,
  'heartbeat': HeartbeatDataSchema,
  'phase': PhaseMarkerDataSchema,
  'round-complete': RoundCompleteDataSchema,
} as const;

/**
 * TypeScript type for the data parts mapping.
 * Used as the DATA_PARTS generic parameter for UIMessage<METADATA, DATA_PARTS>.
 */
export type UnifiedStreamDataTypes = {
  'artifact-available-sources': z.infer<typeof ArtifactAvailableSourcesDataPartSchema>;
  'artifact-presearch': z.infer<typeof ArtifactPresearchDataPartSchema>;
  'domain-source-progress': DomainSourceProgressData;
  'error': StreamErrorData;
  'heartbeat': HeartbeatData;
  'phase': PhaseMarkerData;
  'round-complete': RoundCompleteData;
};

// Re-export stream phase types for convenience
export {
  DEFAULT_STREAM_PHASE,
  STREAM_PHASES,
  StreamPhases,
  StreamPhaseSchema,
};
export type { StreamPhase };
