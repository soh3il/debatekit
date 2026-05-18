/**
 * Metadata Utilities
 *
 * **TYPE-SAFE METADATA EXTRACTION**: Single source of truth for all metadata operations
 * **ELIMINATES ANTI-PATTERNS**: No more `as Record<string, unknown>` casts
 *
 * This module consolidates:
 * - metadata-extraction.ts patterns
 * - Inline metadata casts from handlers
 * - Type guards for metadata validation
 *
 * Design Principles:
 * 1. Use Zod validation for runtime type safety
 * 2. Return properly typed values, never `unknown`
 * 3. Provide both nullable and throwing variants
 * 4. Support both frontend (UIMessage) and backend (ApiMessage) types
 */

import type { AvailableSource, PresearchQueryData, PresearchResultData } from '@debatekit/shared';
import {
  DbAssistantMessageMetadataSchema,
  DbMessageMetadataSchema,
  FinishReasons,
  isAvailableSource,
  MessageRoles,
  MODERATOR_PARTICIPANT_INDEX,
  PresearchQueryDataSchema,
  PresearchResultDataSchema,
} from '@debatekit/shared';
import type { UIMessage } from 'ai';
import { z } from 'zod';

import type {
  ApiMessage,
  DbAssistantMessageMetadata,
  DbMessageMetadata,
  DbModeratorMessageMetadata,
  DbPreSearchMessageMetadata,
  DbUserMessageMetadata,
} from '@/services/api';
import {
  isAssistantMessageMetadata,
  isModeratorMessageMetadata,
  isParticipantMessageMetadata,
  isPreSearchMessageMetadata,
  isUserMessageMetadata,
} from '@/services/api';
import type { PreSearchDataPayload } from '@/services/api/chat/pre-search';

import { isObject } from './type-guards';

// ============================================================================
// Type Guards with Zod Validation
// ============================================================================

/**
 * ✅ PERF FIX: WeakMap cache for Zod validation results
 * Avoids repeated validation of the same metadata object during re-renders.
 * WeakMap allows garbage collection when metadata object is no longer referenced.
 */
const metadataValidationCache = new WeakMap<object, DbMessageMetadata | null>();

/**
 * Safely extract and parse message metadata using Zod validation
 *
 * Uses DbMessageMetadataSchema from @debatekit/shared for type-safe parsing
 *
 * ✅ PERF: Caches validation results in WeakMap to avoid repeated Zod parsing
 * during re-renders. Cache hit rate is high since metadata objects are reused.
 *
 * @param metadata - Raw metadata object from message
 * @returns Parsed MessageMetadata or undefined if validation fails
 *
 * @example
 * ```typescript
 * const metadata = getMessageMetadata(message.metadata);
 * if (metadata?.participantId) {
 *   const participantId = metadata.participantId;
 * }
 * ```
 */
export function getMessageMetadata(metadata: unknown): DbMessageMetadata | undefined {
  // ✅ PERF: Check cache first for object metadata
  if (metadata && typeof metadata === 'object') {
    const cached = metadataValidationCache.get(metadata as object);
    if (cached !== undefined) {
      return cached ?? undefined; // Convert null to undefined
    }

    // Validate and cache result
    const result = DbMessageMetadataSchema.safeParse(metadata);
    const validated = result.success ? result.data : null;
    metadataValidationCache.set(metadata as object, validated);
    return validated ?? undefined;
  }

  // Non-object metadata - just validate without caching
  const result = DbMessageMetadataSchema.safeParse(metadata);
  return result.success ? result.data : undefined;
}

/**
 * Type-safe user metadata extraction
 * Returns user metadata or null
 */
export function getUserMetadata(
  metadata: unknown,
): DbUserMessageMetadata | null {
  const parsed = getMessageMetadata(metadata);
  return parsed && isUserMessageMetadata(parsed) ? parsed : null;
}

/**
 * Type-safe assistant metadata extraction
 * Returns assistant metadata or null
 */
export function getAssistantMetadata(
  metadata: unknown,
): DbAssistantMessageMetadata | null {
  const parsed = getMessageMetadata(metadata);
  return parsed && isAssistantMessageMetadata(parsed) ? parsed : null;
}

/**
 * Type-safe participant metadata extraction
 * Returns participant metadata or null
 */
export function getParticipantMetadata(
  metadata: unknown,
): DbAssistantMessageMetadata | null {
  const parsed = getMessageMetadata(metadata);
  return parsed && isParticipantMessageMetadata(parsed) ? parsed : null;
}

/**
 * Type-safe pre-search metadata extraction
 * Returns pre-search metadata or null
 */
export function getPreSearchMetadata(
  metadata: unknown,
): DbPreSearchMessageMetadata | null {
  const parsed = getMessageMetadata(metadata);
  return parsed && isPreSearchMessageMetadata(parsed) ? parsed : null;
}

/**
 * Type-safe moderator metadata extraction
 * Returns moderator metadata or null
 * ✅ TEXT STREAMING: Used to identify moderator messages in the messages array
 */
export function getModeratorMetadata(
  metadata: unknown,
): DbModeratorMessageMetadata | null {
  const parsed = getMessageMetadata(metadata);
  return parsed && isModeratorMessageMetadata(parsed) ? parsed : null;
}

/**
 * Check if a message is from the moderator
 * ✅ TEXT STREAMING: Moderator messages are now in the messages array
 * ✅ ZOD-FIRST PATTERN: Uses safeParse for validation instead of manual type checks
 * @param message - UIMessage or ApiMessage to check
 * @returns true if the message is from the moderator
 */
export function isModeratorMessage(
  message: UIMessage | ApiMessage,
): boolean {
  const metadata = getMessageMetadata(message.metadata);
  return metadata ? isModeratorMessageMetadata(metadata) : false;
}

// ============================================================================
// Fast Moderator Detection (O(1) without Zod validation)
// ============================================================================

/**
 * Minimal schema for fast moderator metadata detection
 * Validates only the fields needed for moderator identification without full schema validation
 * Handles both new format (isModerator: true) and legacy data patterns
 */
const FastModeratorCheckSchema = z.object({
  isModerator: z.literal(true).optional(),
  participantIndex: z.number().int().optional(),
  participantRole: z.string().optional(),
}); // Zod default strips unknown keys, which is correct for fast check schemas

/**
 * Fast check if metadata indicates a moderator message
 *
 * O(1) check without full Zod validation - use when performance matters.
 * Falls back to isModeratorMessageMetadata for full validation when needed.
 *
 * REPLACES: 11+ inline moderator detection patterns across:
 * - provider.tsx line 673
 * - store.ts lines 256-258
 * - chat-message-list.tsx (multiple)
 *
 * LEGACY DATA FALLBACK: Before the fix, moderator messages were persisted with:
 * - participantIndex: -1 (not MODERATOR_PARTICIPANT_INDEX = -99)
 * - participantRole: 'Moderator'
 * - NO isModerator: true field
 *
 * This caused sorting issues where moderator appeared between participants after refresh.
 * This function now detects both new and legacy moderator data.
 *
 * ✅ ZOD-FIRST PATTERN: Uses safeParse for type-safe field extraction
 *
 * @param metadata - Raw metadata object (unknown type)
 * @returns true if metadata indicates a moderator message
 */
export function isModeratorMetadataFast(metadata: unknown): boolean {
  // Use safeParse to extract fields type-safely
  const result = FastModeratorCheckSchema.safeParse(metadata);
  if (!result.success) {
    return false;
  }

  const m = result.data;

  // Primary check - explicit isModerator flag (new format)
  if (m.isModerator === true) {
    return true;
  }

  // Fallback for legacy data - detect by participantRole
  if (m.participantRole === 'Moderator') {
    return true;
  }

  // Fallback for legacy data - detect by moderator participantIndex values
  // Legacy used -1, new format uses MODERATOR_PARTICIPANT_INDEX (-99)
  if (m.participantIndex === -1 || m.participantIndex === MODERATOR_PARTICIPANT_INDEX) {
    return true;
  }

  return false;
}

// ============================================================================
// Message-Level Helpers
// ============================================================================

/**
 * Extract metadata from UIMessage with type validation
 * Handles both frontend and backend message types
 * ✅ TEXT STREAMING: Now includes moderator message metadata
 */
export function extractMessageMetadata(
  message: UIMessage | ApiMessage,
): DbUserMessageMetadata | DbAssistantMessageMetadata | DbPreSearchMessageMetadata | DbModeratorMessageMetadata | null {
  if (!message.metadata) {
    return null;
  }

  // Try each schema in order of likelihood
  const userResult = getUserMetadata(message.metadata);
  if (userResult) {
    return userResult;
  }

  // ✅ TEXT STREAMING: Check moderator before regular assistant
  // (moderator is a specialized assistant type)
  const moderatorResult = getModeratorMetadata(message.metadata);
  if (moderatorResult) {
    return moderatorResult;
  }

  const assistantResult = getAssistantMetadata(message.metadata);
  if (assistantResult) {
    return assistantResult;
  }

  const preSearchResult = getPreSearchMetadata(message.metadata);
  if (preSearchResult) {
    return preSearchResult;
  }

  return null;
}

// ============================================================================
// Specific Field Extractors (Null-Safe)
// ============================================================================

/**
 * Extract createdAt from a message or its metadata
 * Returns ISO string or null if not available
 *
 * **REPLACES**: `(m as { createdAt?: Date | string }).createdAt`
 *
 * ✅ TYPE-SAFE: Uses type guards instead of .passthrough()
 * Handles Date objects, ISO strings, and metadata.createdAt field
 *
 * @param message - Message object (UIMessage, ApiMessage, or extended type)
 * @returns ISO date string or null
 */
export function getCreatedAt(message: unknown): string | null {
  if (!isObject(message)) {
    return null;
  }

  // 1. Check direct createdAt property (ApiMessage or extended UIMessage)
  if ('createdAt' in message && message.createdAt !== undefined) {
    if (message.createdAt instanceof Date) {
      return message.createdAt.toISOString();
    }
    if (typeof message.createdAt === 'string') {
      return message.createdAt;
    }
  }

  // 2. Check metadata.createdAt (our custom metadata field)
  if ('metadata' in message && isObject(message.metadata)) {
    if ('createdAt' in message.metadata && typeof message.metadata.createdAt === 'string') {
      return message.metadata.createdAt;
    }
  }

  return null;
}

/**
 * Minimal schema for roundNumber extraction
 * Used as fallback when full validation fails during streaming
 */
const PartialRoundNumberSchema = z.object({
  roundNumber: z.number().int().nonnegative(),
});

/**
 * Extract roundNumber from metadata (all message types have this)
 * Returns null if metadata is invalid or roundNumber is missing
 *
 * **REPLACES**: `(metadata as Record<string, unknown>)?.roundNumber`
 *
 * ✅ ZOD-FIRST PATTERN: Validates using Zod safeParse without type casting
 * Handles 0-based indexing where roundNumber: 0 is valid
 */
export function getRoundNumber(metadata: unknown): number | null {
  // Try full schema validation first
  const parsed = getMessageMetadata(metadata);
  if (parsed?.roundNumber !== undefined) {
    return parsed.roundNumber;
  }

  // ✅ FALLBACK: Minimal schema for roundNumber extraction only
  // Handles cases where metadata has roundNumber but fails full validation
  // Uses .partial() to make fields optional for flexible extraction
  const partialResult = PartialRoundNumberSchema.partial().safeParse(metadata);
  if (partialResult.success && partialResult.data.roundNumber !== undefined) {
    return partialResult.data.roundNumber;
  }

  return null;
}

/**
 * Minimal schema for participantId extraction
 * Used as fallback when full validation fails during streaming
 */
const PartialParticipantIdSchema = z.object({
  participantId: z.string().min(1),
});

/**
 * Extract participantId from metadata (only participant messages)
 * Returns null if not a participant message
 *
 * **REPLACES**: `(metadata as Record<string, unknown>)?.participantId`
 *
 * ✅ ZOD-FIRST PATTERN: Uses safeParse for streaming-safe extraction
 * **FALLBACK**: If full schema validation fails but participantId exists,
 * returns the value anyway. This handles race conditions where metadata
 * is partially populated during streaming.
 */
export function getParticipantId(metadata: unknown): string | null {
  // Try full validation first
  const validated = getParticipantMetadata(metadata);
  if (validated?.participantId) {
    return validated.participantId;
  }

  // ✅ FALLBACK: Minimal schema for participantId extraction only
  // Handles streaming race conditions where full schema validation fails
  // Uses .partial() to make fields optional for flexible extraction
  const partialResult = PartialParticipantIdSchema.partial().safeParse(metadata);
  if (partialResult.success && partialResult.data.participantId) {
    return partialResult.data.participantId;
  }

  return null;
}

/**
 * Minimal schema for participantIndex extraction
 * Used as fallback when full validation fails during streaming
 */
const PartialParticipantIndexSchema = z.object({
  participantIndex: z.number().int().nonnegative(),
});

/**
 * Extract participantIndex from metadata (only participant messages)
 * Returns null if not a participant message
 *
 * **REPLACES**: `(metadata as Record<string, unknown>)?.participantIndex`
 *
 * ✅ ZOD-FIRST PATTERN: Uses safeParse for streaming-safe extraction
 * **FALLBACK**: If full schema validation fails but participantIndex exists,
 * returns the value anyway. This handles race conditions where metadata
 * is partially populated during streaming.
 */
export function getParticipantIndex(metadata: unknown): number | null {
  // Try full validation first
  const validated = getParticipantMetadata(metadata);
  if (validated?.participantIndex !== undefined) {
    return validated.participantIndex;
  }

  // ✅ FALLBACK: Minimal schema for participantIndex extraction only
  // Handles streaming race conditions where full schema validation fails
  // Uses .partial() to make fields optional for flexible extraction
  const partialResult = PartialParticipantIndexSchema.partial().safeParse(metadata);
  if (partialResult.success && partialResult.data.participantIndex !== undefined) {
    return partialResult.data.participantIndex;
  }

  return null;
}

/**
 * Extract participantRole from metadata (only participant messages)
 * Returns null if not a participant message or role not set
 *
 * **REPLACES**: `(metadata as Record<string, unknown>)?.participantRole`
 */
export function getParticipantRole(metadata: unknown): string | null {
  const validated = getParticipantMetadata(metadata);
  if (validated?.participantRole && typeof validated.participantRole === 'string') {
    return validated.participantRole;
  }
  return null;
}

/**
 * Minimal schema for fast model extraction
 * Used as fallback when full validation fails during streaming
 */
const PartialModelSchema = z.object({
  model: z.string().min(1),
});

/**
 * Extract model from metadata (only assistant messages)
 * Returns null if not an assistant message
 *
 * **REPLACES**: `(metadata as Record<string, unknown>)?.model`
 */
export function getModel(metadata: unknown): string | null {
  const validated = getAssistantMetadata(metadata);
  if (validated?.model && typeof validated.model === 'string') {
    return validated.model;
  }
  return null;
}

/**
 * Fast O(1) model extraction without full Zod validation
 *
 * During streaming, placeholder metadata doesn't pass full DbAssistantMessageMetadataSchema
 * validation because required fields like finishReason and usage aren't populated yet.
 * This function extracts the model field directly for avatar/display purposes.
 *
 * ✅ ZOD-FIRST PATTERN: Uses minimal Zod schema for type-safe extraction
 *
 * @param metadata - Raw metadata object (unknown type)
 * @returns Model string or null if not present
 */
export function getModelFast(metadata: unknown): string | null {
  // Fast path: validate minimal model field via Zod before full validation.
  // Streaming placeholders store model directly in metadata object.
  const fastParsed = PartialModelSchema.safeParse(metadata);
  if (fastParsed.success) {
    return fastParsed.data.model;
  }

  // Try full validation (may be cached)
  const fullModel = getModel(metadata);
  if (fullModel) {
    return fullModel;
  }

  return null;
}

/**
 * Check if message has error (only assistant messages)
 * Returns false for non-assistant messages
 *
 * **REPLACES**: `(metadata as Record<string, unknown>)?.hasError`
 */
export function hasError(metadata: unknown): boolean {
  const validated = getAssistantMetadata(metadata);
  return validated?.hasError === true;
}

/**
 * Extract availableSources from metadata (streaming-safe)
 *
 * During streaming, the metadata might not pass full DbAssistantMessageMetadataSchema
 * validation because some required fields (like finishReason, usage) are only
 * populated at the 'finish' event. This function extracts availableSources even
 * when full validation fails, enabling citation display during streaming.
 *
 * **PURPOSE**: Enable citation display during streaming before metadata is complete
 */
export function getAvailableSources(
  metadata: unknown,
): DbAssistantMessageMetadata['availableSources'] | null {
  // Try full validation first
  const validated = getAssistantMetadata(metadata);
  if (validated?.availableSources) {
    return validated.availableSources;
  }

  // Fallback: Extract availableSources even when full schema validation fails
  // This handles streaming metadata that has availableSources but is missing
  // required fields like finishReason or usage
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  if ('availableSources' in metadata && Array.isArray(metadata.availableSources)) {
    const sources = metadata.availableSources;

    // ✅ ZOD-FIRST PATTERN: Use Zod schema validation from @debatekit/shared
    // Filter to valid sources only (don't reject all if some are invalid)
    const validSources = sources.filter(isAvailableSource);

    if (validSources.length > 0) {
      return validSources;
    }
  }

  return null;
}

/**
 * Schema for extracting presearch data for source building
 *
 * ✅ ZOD-FIRST PATTERN: Defines expected structure with Zod instead of type assertions
 * Zod default behavior strips unknown keys, which is correct since we only access declared fields
 */
const PreSearchSourceDataSchema = z.object({
  results: z.array(z.object({
    answer: z.string().nullable().optional(),
    index: z.number().optional(),
    query: z.string().optional(),
    responseTime: z.number().optional(),
    results: z.array(z.object({
      content: z.string().optional(),
      domain: z.string().optional(),
      excerpt: z.string().optional(),
      fullContent: z.string().optional(),
      metadata: z.object({
        author: z.string().optional(),
        description: z.string().optional(),
        readingTime: z.number().optional(),
        wordCount: z.number().optional(),
      }).optional(),
      publishedDate: z.string().nullable().optional(),
      score: z.number().optional(),
      title: z.string(),
      url: z.string(),
    })).optional(),
  })).optional(),
}); // Zod default strips unknown keys; function only accesses declared fields

type PreSearchSourceData = z.infer<typeof PreSearchSourceDataSchema>;

/**
 * Build AvailableSource array from presearch data
 *
 * During streaming, message metadata doesn't have availableSources populated yet.
 * This function builds sources from presearch data stored in the chat store,
 * enabling citation display before the stream completes.
 *
 * ✅ ZOD-FIRST PATTERN: Uses safeParse for type-safe data extraction
 *
 * @param searchData - Presearch data from StoredPreSearch.searchData
 * @returns Array of AvailableSource objects or empty array if no valid data
 */
export function buildSourcesFromPreSearch(searchData: unknown): AvailableSource[] {
  // Use Zod safeParse for type-safe validation
  const parseResult = PreSearchSourceDataSchema.safeParse(searchData);
  if (!parseResult.success) {
    return [];
  }

  const data: PreSearchSourceData = parseResult.data;

  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }

  const sources: AvailableSource[] = [];

  // Use iteration index for queryIndex since results may not have explicit index field
  // This matches backend behavior in search-context-builder.ts which uses loop counter
  for (let queryIndex = 0; queryIndex < data.results.length; queryIndex++) {
    const queryResult = data.results[queryIndex];
    if (!queryResult) {
      continue;
    }

    const innerResults = queryResult.results;

    if (!innerResults || !Array.isArray(innerResults)) {
      continue;
    }

    for (let resultIndex = 0; resultIndex < innerResults.length; resultIndex++) {
      const result = innerResults[resultIndex];
      if (!result) {
        continue;
      }

      // Generate citation ID matching backend format: sch_qXrY
      const citationId = `sch_q${queryIndex}r${resultIndex}`;

      // Extract domain from URL (fallback if not in result)
      let domain: string | undefined = result.domain;
      if (!domain && result.url) {
        try {
          domain = new URL(result.url).hostname.replace(/^www\./, '');
        } catch {
          // Invalid URL, skip domain extraction
        }
      }

      // Build title with fallback chain - title should exist per schema
      const title = result.title || domain || result.url || `Search Result ${resultIndex + 1}`;

      sources.push({
        // Include author if available
        author: result.metadata?.author,
        description: result.metadata?.description || result.excerpt,
        domain,
        excerpt: result.excerpt || result.content?.slice(0, 200),
        id: citationId,
        // Include published date for display
        publishedDate: result.publishedDate ?? undefined,
        // Include the search query that returned this result
        query: queryResult.query,
        sourceType: 'search' as const,
        title,
        url: result.url,
      });
    }
  }

  return sources;
}

// ============================================================================
// Presearch Data Extraction from AI SDK Message Parts
// ============================================================================

/**
 * Type guard for presearch query data parts persisted in AI SDK message parts.
 * AI SDK stores custom data parts as `{ type: 'data-presearch-query', data: {...} }`.
 */
function isPresearchQueryPart(part: unknown): part is { type: 'data-presearch-query'; data: PresearchQueryData } {
  if (!part || typeof part !== 'object') {
    return false;
  }
  if (!('type' in part) || part.type !== 'data-presearch-query') {
    return false;
  }
  if (!('data' in part) || !part.data) {
    return false;
  }
  return PresearchQueryDataSchema.safeParse(part.data).success;
}

/**
 * Type guard for presearch result data parts persisted in AI SDK message parts.
 * AI SDK stores custom data parts as `{ type: 'data-presearch-result', data: {...} }`.
 */
function isPresearchResultPart(part: unknown): part is { type: 'data-presearch-result'; data: PresearchResultData } {
  if (!part || typeof part !== 'object') {
    return false;
  }
  if (!('type' in part) || part.type !== 'data-presearch-result') {
    return false;
  }
  if (!('data' in part) || !part.data) {
    return false;
  }
  return PresearchResultDataSchema.safeParse(part.data).success;
}

/**
 * Minimal schema for artifact-based presearch data part validation.
 * Checks only the fields needed for type guard identification (queries and results arrays).
 *
 * Uses z.unknown() array elements since we only need to confirm the shape exists;
 * full element validation happens downstream via PresearchQueryDataSchema/PresearchResultDataSchema.
 */
const ArtifactPresearchDataShape = z.object({
  queries: z.array(z.unknown()),
  results: z.array(z.unknown()),
});

/**
 * Type guard for artifact-based presearch data parts.
 * With @ai-sdk-tools/artifacts, presearch data is streamed as `data-artifact-presearch` parts
 * containing the full accumulated state.
 *
 * Uses Zod safeParse instead of `as Record<string, unknown>` for type-safe validation.
 */
function isArtifactPresearchPart(part: unknown): part is { type: string; data: { queries: PresearchQueryData[]; results: PresearchResultData[]; summary: string; totalResults: number } } {
  if (!part || typeof part !== 'object') {
    return false;
  }
  if (!('type' in part) || typeof part.type !== 'string') {
    return false;
  }
  // Artifact data parts use the pattern: data-artifact-{id}
  if (!part.type.startsWith('data-artifact-presearch')) {
    return false;
  }
  if (!('data' in part) || !part.data || typeof part.data !== 'object') {
    return false;
  }
  return ArtifactPresearchDataShape.safeParse(part.data).success;
}

/**
 * Extract presearch data from AI SDK message parts.
 *
 * During resume/page refresh, presearch query and result data parts are persisted
 * in the AI SDK message's `parts` array (registered via `unifiedDataPartSchemas`).
 * However, the presearch-complete event is transient and NOT replayed. This means
 * the store's `searchData` may remain undefined even though the data exists in the
 * message parts.
 *
 * This function scans message parts for `data-presearch-query` and
 * `data-presearch-result` parts and reconstructs `PreSearchDataPayload` from them.
 * It also handles artifact-based presearch parts (`data-artifact-presearch`) from
 * the @ai-sdk-tools/artifacts migration, which contain the full accumulated state.
 *
 * @param messages - Array of UIMessages to scan for presearch data parts
 * @returns Reconstructed PreSearchDataPayload or null if no presearch data found
 */
export function extractPresearchDataFromMessageParts(
  messages: UIMessage[],
): PreSearchDataPayload | null {
  const queries: PreSearchDataPayload['queries'] = [];
  const results: PreSearchDataPayload['results'] = [];
  const seenQueryIndices = new Set<number>();
  const seenResultIndices = new Set<number>();

  for (const message of messages) {
    if (message.role !== 'assistant' || !message.parts) {
      continue;
    }

    for (const part of message.parts) {
      // Check for artifact-based presearch parts (new format via @ai-sdk-tools/artifacts)
      // Artifact parts contain the full accumulated state, so use the last one found
      if (isArtifactPresearchPart(part)) {
        // Clear previous data - each artifact update contains the full state
        queries.length = 0;
        results.length = 0;
        seenQueryIndices.clear();
        seenResultIndices.clear();

        const { data } = part;
        for (const q of data.queries) {
          if (!seenQueryIndices.has(q.index)) {
            seenQueryIndices.add(q.index);
            queries.push({
              index: q.index,
              query: q.query,
              rationale: q.rationale,
              searchDepth: q.searchDepth,
              total: q.total,
            });
          }
        }
        for (const r of data.results) {
          if (!seenResultIndices.has(r.index)) {
            seenResultIndices.add(r.index);
            results.push({
              answer: r.answer,
              index: r.index,
              query: r.query,
              responseTime: r.responseTime,
              results: r.results.map((item) => {
                let domain: string | undefined;
                try {
                  domain = new URL(item.url).hostname.replace(/^www\./, '');
                } catch {
                  domain = undefined;
                }
                return {
                  content: item.snippet || item.description || '',
                  domain,
                  metadata: {
                    description: item.description,
                    faviconUrl: item.favicon,
                  },
                  publishedDate: null,
                  score: 0,
                  title: item.title,
                  url: item.url,
                };
              }),
            });
          }
        }
        continue;
      }

      // Legacy format: individual presearch query and result data parts
      if (isPresearchQueryPart(part)) {
        const { data } = part;
        if (!seenQueryIndices.has(data.index)) {
          seenQueryIndices.add(data.index);
          queries.push({
            index: data.index,
            query: data.query,
            rationale: data.rationale,
            searchDepth: data.searchDepth,
            total: data.total,
          });
        }
      } else if (isPresearchResultPart(part)) {
        const { data } = part;
        if (!seenResultIndices.has(data.index)) {
          seenResultIndices.add(data.index);
          results.push({
            answer: data.answer,
            index: data.index,
            query: data.query,
            responseTime: data.responseTime,
            // Map streaming result shape (description/favicon/snippet) to
            // stored shape (content/score) expected by PreSearchDataPayload.
            // Streaming data parts use a simplified UI-friendly format;
            // the stored format matches the Tavily search result schema.
            results: data.results.map((r) => {
              let domain: string | undefined;
              try {
                domain = new URL(r.url).hostname.replace(/^www\./, '');
              } catch {
                domain = undefined;
              }
              return {
                content: r.snippet || r.description || '',
                domain,
                metadata: {
                  description: r.description,
                  faviconUrl: r.favicon,
                },
                publishedDate: null,
                score: 0,
                title: r.title,
                url: r.url,
              };
            }),
          });
        }
      }
    }
  }

  if (queries.length === 0 && results.length === 0) {
    return null;
  }

  const totalResults = results.reduce(
    (sum, r) => sum + r.results.length,
    0,
  );

  return {
    failureCount: 0,
    queries,
    results,
    successCount: results.length,
    summary: '',
    totalResults,
    totalTime: 0,
  };
}

/**
 * Check if message is pre-search
 * Returns true only if metadata validates as PreSearchMessageMetadata
 *
 * **REPLACES**: `(metadata as Record<string, unknown>)?.isPreSearch === true`
 */
export function isPreSearch(metadata: unknown): boolean {
  const validated = getPreSearchMetadata(metadata);
  return validated !== null;
}

/**
 * Minimal schema for fast pre-search metadata detection
 * Validates only the isPreSearch field for quick identification
 *
 * NOTE: Two field names exist due to schema divergence:
 * - `isPreSearch` (capital S): Used by DbPreSearchMessageMetadataSchema (persisted in D1)
 * - `isPresearch` (lowercase s): Used by UnifiedMessageMetadataSchema (streaming wire format)
 * Both must be checked to detect presearch messages in all contexts.
 */
const FastPreSearchCheckSchema = z.object({
  isPreSearch: z.literal(true).optional(),
  isPresearch: z.literal(true).optional(),
}); // Zod default strips unknown keys, which is correct for fast check schemas

/**
 * Fast O(1) pre-search check without full Zod validation
 *
 * Use as defensive fallback when Zod validation may fail due to:
 * - Partial metadata during streaming
 * - Schema mismatches between frontend/backend versions
 * - Race conditions during round completion
 *
 * Checks:
 * 1. Message ID pattern (most reliable) - IDs starting with 'pre-search-'
 * 2. Metadata isPreSearch flag (capital S, DB format) using Zod safeParse
 * 3. Metadata isPresearch flag (lowercase s, streaming format) using Zod safeParse
 *
 * ✅ ZOD-FIRST PATTERN: Uses safeParse for type-safe field extraction
 *
 * @param message - Message object with optional id and metadata
 * @returns true if message is identified as pre-search
 */
export function isPreSearchFast(message: { id?: string; metadata?: unknown }): boolean {
  // Check ID pattern first (most reliable)
  if (message.id?.startsWith('pre-search-')) {
    return true;
  }

  // Check metadata flag using Zod safeParse for type-safe extraction
  const result = FastPreSearchCheckSchema.safeParse(message.metadata);
  if (!result.success) {
    return false;
  }

  // Check both casing variants: DB format (isPreSearch) and streaming format (isPresearch)
  return result.data.isPreSearch === true || result.data.isPresearch === true;
}

// ============================================================================
// Upload Metadata Extraction
// ============================================================================

/**
 * Extract extractedText from upload metadata
 *
 * Upload metadata may contain text extracted from documents (PDFs, text files, etc.)
 * during processing. This helper provides type-safe access to that text.
 *
 * **REPLACES**: `(upload.metadata as { extractedText?: string } | null)?.extractedText`
 *
 * @param metadata - Upload metadata object (from upload.metadata field)
 * @returns Extracted text or null if not available
 *
 * @example
 * ```typescript
 * const text = getExtractedText(upload.metadata);
 * if (text) {
 *   // Use extracted text for citation or context
 *   const preview = text.slice(0, 500);
 * }
 * ```
 */
export function getExtractedText(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  // Use minimal Zod schema for extractedText field extraction
  // NOTE: Used with .partial() below - passthrough not needed since partial handles flexibility
  const ExtractedTextSchema = z.object({
    extractedText: z.string().min(1),
  }).strict();

  const result = ExtractedTextSchema.partial().safeParse(metadata);
  if (result.success && result.data.extractedText) {
    return result.data.extractedText;
  }

  return null;
}

/**
 * Structured OpenRouter error matching DbAssistantMessageMetadataSchema.openRouterError
 */
const OpenRouterErrorObjectSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  message: z.string(),
  type: z.string().optional(),
});

type OpenRouterErrorObject = z.infer<typeof OpenRouterErrorObjectSchema>;

/** Lenient schema for legacy error objects that may not match the strict schema */
const LegacyOpenRouterErrorSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
  type: z.string().optional(),
}).catchall(z.unknown());

/**
 * Normalize openRouterError to the structured object format
 *
 * ErrorMetadataSchema allows openRouterError to be string or structured object.
 * This helper converts the union type to the explicit object shape required by
 * DbAssistantMessageMetadataSchema.
 *
 * @param openRouterError - OpenRouter error from ErrorMetadataSchema (string | object | undefined)
 * @returns Typed OpenRouter error object or undefined
 */
export function normalizeOpenRouterError(
  openRouterError: unknown,
): OpenRouterErrorObject | undefined {
  if (!openRouterError) {
    return undefined;
  }

  // If it's a string, wrap it in the structured format
  if (typeof openRouterError === 'string') {
    return { message: openRouterError };
  }

  // If it already matches the structured schema, return directly
  const objectResult = OpenRouterErrorObjectSchema.safeParse(openRouterError);
  if (objectResult.success) {
    return objectResult.data;
  }

  // Fallback for legacy record-style data: extract message field if present
  // Use a lenient Zod schema to safely extract known fields without `as` cast
  const legacyResult = LegacyOpenRouterErrorSchema.safeParse(openRouterError);
  if (legacyResult.success) {
    const { code, message: msg, type } = legacyResult.data;
    return {
      code,
      message: msg ?? JSON.stringify(openRouterError),
      type,
    };
  }

  return undefined;
}

// ============================================================================
// Metadata Builders
// ============================================================================

/**
 * Build assistant message metadata with type safety
 *
 * **PURPOSE**: Single source of truth for assistant metadata construction
 * **REPLACES**: Inline metadata building in message-transforms.ts and handlers
 *
 * @param baseMetadata - Base metadata fields (finishReason, usage, etc.)
 * @param baseMetadata.finishReason - Finish reason from streaming response
 * @param baseMetadata.usage - Token usage statistics
 * @param options - Additional fields to include
 * @param options.participantId - Unique participant identifier
 * @param options.participantIndex - Index of participant in list
 * @param options.participantRole - Role assigned to participant
 * @param options.model - Model identifier used for generation
 * @param options.roundNumber - Round number in conversation
 * @param options.hasError - Whether message has error
 * @param options.errorType - Type of error if present
 * @param options.errorMessage - Error message if present
 * @param options.errorCategory - Error category for grouping
 * @param options.rawErrorMessage - Raw error message from provider
 * @param options.providerMessage - Provider-specific error message
 * @param options.statusCode - HTTP status code if applicable
 * @param options.openRouterError - OpenRouter-specific error details
 * @param options.openRouterCode - OpenRouter error code
 * @returns Fully constructed AssistantMessageMetadata
 *
 * @example
 * ```typescript
 * const metadata = buildAssistantMetadata(
 *   { finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50 } },
 *   {
 *     participantId: 'part-123',
 *     participantIndex: 0,
 *     model: 'gpt-4',
 *     roundNumber: 1,
 *   }
 * );
 * ```
 */
/**
 * Builder for assistant metadata construction during streaming
 *
 * JUSTIFIED TYPE ASSERTION: This function builds metadata incrementally during streaming
 * when not all required fields are available. The type assertion is intentional because:
 * 1. Accepts Partial<DbAssistantMessageMetadata> as input
 * 2. Used during message construction when fields arrive progressively
 * 3. Caller is responsible for ensuring completeness before persistence
 *
 * @see docs/type-inference-patterns.md - Builder patterns with justified assertions
 */
export function buildAssistantMetadata(
  baseMetadata: Partial<DbAssistantMessageMetadata>,
  options: {
    participantId?: string;
    participantIndex?: number;
    participantRole?: string | null;
    model?: string;
    roundNumber?: number;
    hasError?: boolean;
    errorType?: string;
    errorMessage?: string;
    errorCategory?: string;
    rawErrorMessage?: string;
    providerMessage?: string;
    statusCode?: number;
    openRouterError?: { message: string; code?: string | number; type?: string };
    openRouterCode?: string | number;
  },
): DbAssistantMessageMetadata {
  // Build the metadata object with role as discriminator
  // Provides safe defaults for required fields missing from partial base metadata
  // (this function is an incremental builder used during streaming enrichment)
  const metadata = {
    // Required fields with safe defaults when missing from partial base
    finishReason: baseMetadata.finishReason ?? FinishReasons.STOP,
    hasError: baseMetadata.hasError ?? options.hasError ?? false,
    isPartialResponse: baseMetadata.isPartialResponse ?? false,
    isTransient: baseMetadata.isTransient ?? false,
    model: options.model ?? baseMetadata.model ?? 'unknown',
    participantId: options.participantId ?? baseMetadata.participantId ?? 'unknown',
    participantIndex: options.participantIndex ?? baseMetadata.participantIndex ?? 0,
    participantRole: options.participantRole !== undefined
      ? options.participantRole
      : baseMetadata.participantRole ?? null,
    role: MessageRoles.ASSISTANT,
    roundNumber: options.roundNumber ?? baseMetadata.roundNumber ?? 0,
    usage: baseMetadata.usage ?? { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
    // Optional base metadata fields
    ...(baseMetadata.createdAt && { createdAt: baseMetadata.createdAt }),
    // Error fields
    ...(options.errorType && { errorType: options.errorType }),
    ...(options.errorMessage && { errorMessage: options.errorMessage }),
    ...(options.errorCategory && { errorCategory: options.errorCategory }),
    ...(options.rawErrorMessage && { rawErrorMessage: options.rawErrorMessage }),
    ...(options.providerMessage && { providerMessage: options.providerMessage }),
    ...(options.statusCode !== undefined && { statusCode: options.statusCode }),
    ...(options.openRouterError && { openRouterError: options.openRouterError }),
    ...(options.openRouterCode !== undefined && { openRouterCode: options.openRouterCode }),
    // Citation fields - preserve from backend streaming metadata
    ...(Array.isArray(baseMetadata.availableSources) && baseMetadata.availableSources.length > 0 && {
      availableSources: baseMetadata.availableSources,
    }),
    ...(Array.isArray(baseMetadata.citations) && baseMetadata.citations.length > 0 && {
      citations: baseMetadata.citations,
    }),
    ...(typeof baseMetadata.reasoningDuration === 'number' && baseMetadata.reasoningDuration > 0 && {
      reasoningDuration: baseMetadata.reasoningDuration,
    }),
  };

  return DbAssistantMessageMetadataSchema.parse(metadata);
}

/**
 * Check if message has participant enrichment data
 *
 * Participant enrichment includes:
 * - participantId
 * - participantIndex
 * - participantRole (optional)
 * - model
 *
 * @param metadata - Message metadata to check
 * @returns True if metadata has participant enrichment
 *
 * @example
 * ```typescript
 * const hasEnrichment = hasParticipantEnrichment(message.metadata);
 * if (!hasEnrichment) {
 *   // Enrich message with participant data
 *   message.metadata = enrichMessageWithParticipant(message, participant);
 * }
 * ```
 */
export function hasParticipantEnrichment(metadata: unknown): boolean {
  const validated = getParticipantMetadata(metadata);
  return validated !== null
    && validated.participantId !== undefined
    && validated.participantIndex !== undefined
    && validated.model !== undefined;
}

/**
 * Enrich message metadata with participant information
 *
 * **PURPOSE**: Add participant context to existing message metadata
 * **USE CASE**: Frontend enrichment when displaying messages
 *
 * @param baseMetadata - Existing message metadata
 * @param participant - Participant data to enrich with
 * @param participant.id - Participant identifier
 * @param participant.modelId - Model identifier for participant
 * @param participant.role - Role assigned to participant
 * @param participant.index - Index of participant in list
 * @returns Enriched metadata with participant fields
 *
 * @example
 * ```typescript
 * const enriched = enrichMessageWithParticipant(
 *   message.metadata,
 *   {
 *     id: 'part-123',
 *     modelId: 'gpt-4',
 *     role: 'assistant',
 *     index: 0,
 *   }
 * );
 * ```
 */
/**
 * Schema for participant enrichment fields
 * Used to validate the enriched metadata result
 */
const ParticipantEnrichmentSchema = z.object({
  model: z.string().min(1),
  participantId: z.string().min(1),
  participantIndex: z.number().int().nonnegative(),
  participantRole: z.string().nullable().optional(),
}).strict();

/**
 * Enrich metadata with participant information
 *
 * JUSTIFIED TYPE ASSERTION: Merges validated enrichment data with base metadata.
 * The assertion is intentional because DbMessageMetadata is a discriminated union,
 * and we're adding assistant-specific fields to potentially incomplete base metadata.
 *
 * Type safety is partially preserved via:
 * 1. Zod validation of participant enrichment fields
 * 2. Default role discriminator for undefined base
 *
 * @see docs/type-inference-patterns.md - Enrichment patterns
 */
export function enrichMessageWithParticipant(
  baseMetadata: DbMessageMetadata | undefined,
  participant: {
    id: string;
    modelId: string;
    role: string | null;
    index: number;
  },
): DbMessageMetadata {
  // Validate participant input first
  const enrichmentResult = ParticipantEnrichmentSchema.safeParse({
    model: participant.modelId,
    participantId: participant.id,
    participantIndex: participant.index,
    participantRole: participant.role,
  });

  if (!enrichmentResult.success) {
    throw new Error(`Invalid participant data for enrichment: ${enrichmentResult.error.message}`);
  }

  const base = baseMetadata || { role: MessageRoles.ASSISTANT };

  // Validate merged result against discriminated union schema
  return DbMessageMetadataSchema.parse({
    ...base,
    ...enrichmentResult.data,
  });
}
