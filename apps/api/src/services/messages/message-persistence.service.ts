/**
 * Message Persistence Service
 *
 * Following backend-patterns.md: Service layer for business logic
 *
 * Saves AI assistant messages after streaming completes:
 * - Extracts reasoning from multiple sources (deltas, finishResult, providerMetadata)
 * - Resolves citations from RAG sources
 * - Builds type-safe message parts with error handling
 */

import { FinishReasons, FinishReasonSchema, MessagePartTypes, MessageRoles } from '@debatekit/shared/enums';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import * as z from 'zod';

import { invalidateMessagesCache } from '@/common/cache-utils';
import { CoreSchemas } from '@/core/schemas';
import type { AppDb } from '@/db';
import * as tables from '@/db';
import { DbMessagePartsSchema } from '@/db/schemas/chat-metadata';
import { log } from '@/lib/logger';
import type { MessagePart, StreamingFinishResult } from '@/lib/schemas';
import { cleanCitationExcerpt, createParticipantMetadata, hasCitations, parseCitations, toDbCitations } from '@/lib/utils';
import { rlog } from '@/lib/utils/dev-logger';
import type { UsageStats } from '@/services/errors';
import { extractErrorMetadata } from '@/services/errors';
import type { CitationSourceMap } from '@/types/citations';
import { AvailableSourceSchema } from '@/types/citations';

// ============================================================================
// Provider Metadata Reasoning Schemas
// ============================================================================

/**
 * Zod schema for extracting reasoning from provider metadata.
 *
 * AI SDK providers can embed reasoning in various fields depending on the provider.
 * Instead of using `Record<string, unknown>` with dynamic key access, we define
 * explicit schemas for all known reasoning field locations.
 *
 * Covered providers:
 * - OpenAI: `openai.reasoning`
 * - Anthropic/generic: `reasoning`, `thinking`, `thought`, `thoughts`
 * - Other: `chain_of_thought`, `internal_reasoning`, `scratchpad`
 *
 * Each field can be a string directly, or an object with `content` or `text`.
 */
const ReasoningContentSchema = z.object({
  content: z.string().optional(),
  text: z.string().optional(),
});

const ProviderReasoningFieldSchema = z.union([
  z.string(),
  ReasoningContentSchema,
]);

const ProviderReasoningMetadataSchema = z.object({
  chain_of_thought: ProviderReasoningFieldSchema.optional(),
  internal_reasoning: ProviderReasoningFieldSchema.optional(),
  openai: z.object({
    reasoning: ProviderReasoningFieldSchema.optional(),
  }).optional(),
  reasoning: ProviderReasoningFieldSchema.optional(),
  scratchpad: ProviderReasoningFieldSchema.optional(),
  thinking: ProviderReasoningFieldSchema.optional(),
  thought: ProviderReasoningFieldSchema.optional(),
  thoughts: ProviderReasoningFieldSchema.optional(),
});

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Parameters for saveStreamedMessage.
 * Defined explicitly to annotate the schema const and prevent TS7056.
 */
export type SaveMessageParams = {
  availableSources?: z.infer<typeof AvailableSourceSchema>[];
  citationSourceMap?: CitationSourceMap;
  db: AppDb;
  emptyResponseError?: string | null;
  finishResult: StreamingFinishResult;
  messageId: string;
  modelId: string;
  participantId: string;
  participantIndex: number;
  participantRole: string | null;
  reasoningDeltas: string[];
  reasoningDuration?: number;
  roundNumber: number;
  text: string;
  threadId: string;
};

/**
 * Schema for saveStreamedMessage parameters
 * Following type-inference-patterns.md: Zod-first type inference
 */
export const SaveMessageParamsSchema: z.ZodType<SaveMessageParams> = z.object({
  availableSources: z.array(AvailableSourceSchema).optional(),
  citationSourceMap: z.custom<CitationSourceMap>().optional(),
  db: z.custom<AppDb>(),
  emptyResponseError: z.string().nullable().optional(),
  finishResult: z.custom<StreamingFinishResult>(),
  messageId: CoreSchemas.id(),
  modelId: z.string().min(1),
  participantId: CoreSchemas.id(),
  participantIndex: z.number().int().nonnegative(),
  participantRole: z.string().nullable(),
  reasoningDeltas: z.array(z.string()),
  reasoningDuration: z.number().nonnegative().optional(),
  roundNumber: z.number().int().nonnegative(),
  text: z.string(),
  threadId: CoreSchemas.id(),
}).strict();

// ============================================================================
// Reasoning Extraction
// ============================================================================

/**
 * Extract reasoning from finishResult with priority order:
 * 1. Accumulated reasoning deltas from stream chunks
 * 2. finishResult.reasoning (string or array)
 * 3. finishResult.reasoningText (Claude 4 models)
 * 4. providerMetadata reasoning fields
 */
function extractReasoning(reasoningDeltas: string[], finishResult: StreamingFinishResult) {
  if (reasoningDeltas.length > 0) {
    return reasoningDeltas.join('');
  }

  if (typeof finishResult.reasoning === 'string' && finishResult.reasoning.trim()) {
    return finishResult.reasoning.trim();
  }

  if (Array.isArray(finishResult.reasoning) && finishResult.reasoning.length > 0) {
    const reasoningTexts: string[] = [];
    for (const part of finishResult.reasoning) {
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' && part.text.trim()) {
        if ('type' in part && part.type === 'redacted') {
          continue;
        }
        reasoningTexts.push(part.text.trim());
      }
    }
    if (reasoningTexts.length > 0) {
      return reasoningTexts.join('\n\n');
    }
  }

  if (typeof finishResult.reasoningText === 'string' && finishResult.reasoningText.trim()) {
    return finishResult.reasoningText.trim();
  }

  const parseResult = ProviderReasoningMetadataSchema.safeParse(finishResult.providerMetadata);
  if (!parseResult.success) {
    return null;
  }

  const parsed = parseResult.data;

  // Check each known reasoning field in priority order
  const fields = [
    parsed.openai?.reasoning,
    parsed.reasoning,
    parsed.thinking,
    parsed.thought,
    parsed.thoughts,
    parsed.chain_of_thought,
    parsed.internal_reasoning,
    parsed.scratchpad,
  ];

  for (const field of fields) {
    if (typeof field === 'string' && field.trim()) {
      return field.trim();
    }
    if (field && typeof field === 'object') {
      if (field.content && field.content.trim()) {
        return field.content.trim();
      }
      if (field.text && field.text.trim()) {
        return field.text.trim();
      }
    }
  }

  return null;
}

// ============================================================================
// Message Persistence
// ============================================================================

/**
 * Save AI assistant message to database after streaming completes
 *
 * Process:
 * 1. Extract reasoning from multiple sources
 * 2. Detect and categorize errors
 * 3. Build parts[] array (text + reasoning + tool-calls)
 * 4. Resolve citations from RAG sources
 * 5. Save message with metadata
 * 6. Invalidate cache
 */
export async function saveStreamedMessage(params: SaveMessageParams): Promise<void> {
  const {
    availableSources,
    citationSourceMap,
    db,
    emptyResponseError,
    finishResult,
    messageId,
    modelId,
    participantId,
    participantIndex,
    participantRole,
    reasoningDeltas,
    reasoningDuration,
    roundNumber,
    text,
    threadId,
  } = params;

  try {
    // ✅ FIX: Check for duplicate message FIRST before expensive operations
    // This prevents wasted work on reasoning extraction, citation parsing, and metadata building
    const existingMessage = await db.query.chatMessage.findFirst({
      where: eq(tables.chatMessage.id, messageId),
    });

    if (existingMessage) {
      // ✅ FIX: Still invalidate cache even when message already exists
      // This handles race conditions and ensures frontend gets fresh data
      // after page refresh or stream resumption scenarios
      await invalidateMessagesCache(db, threadId);
      return;
    }

    const reasoningText = extractReasoning(reasoningDeltas, finishResult);

    const getTotalUsage = (): { inputTokens?: number; outputTokens?: number } | undefined => {
      if (
        !('totalUsage' in finishResult)
        || !finishResult.totalUsage
        || typeof finishResult.totalUsage !== 'object'
      ) {
        return undefined;
      }
      const tu = finishResult.totalUsage;
      const inputTokens = 'inputTokens' in tu && typeof tu.inputTokens === 'number' ? tu.inputTokens : null;
      const outputTokens = 'outputTokens' in tu && typeof tu.outputTokens === 'number' ? tu.outputTokens : null;

      // Conditionally build object to satisfy exactOptionalPropertyTypes
      if (inputTokens !== null && outputTokens !== null) {
        return { inputTokens, outputTokens };
      }
      if (inputTokens !== null) {
        return { inputTokens };
      }
      if (outputTokens !== null) {
        return { outputTokens };
      }
      return {};
    };
    const usageData = finishResult.usage || getTotalUsage();

    // Build extractErrorMetadata params conditionally to satisfy exactOptionalPropertyTypes
    const errorMetadataParams: {
      finishReason: string;
      providerMetadata: unknown;
      response: unknown;
      text?: string;
      usage?: UsageStats;
      reasoning?: string;
    } = {
      finishReason: finishResult.finishReason,
      providerMetadata: finishResult.providerMetadata,
      response: finishResult.response,
      text,
    };
    // Conditionally add usage to avoid exactOptionalPropertyTypes issues
    if (usageData) {
      const normalizedUsage: UsageStats = {};
      if (usageData.inputTokens !== undefined) {
        normalizedUsage.inputTokens = usageData.inputTokens;
      }
      if (usageData.outputTokens !== undefined) {
        normalizedUsage.outputTokens = usageData.outputTokens;
      }
      errorMetadataParams.usage = normalizedUsage;
    }
    if (reasoningText) {
      errorMetadataParams.reasoning = reasoningText;
    }
    const errorMetadata = extractErrorMetadata(errorMetadataParams);

    const parts: MessagePart[] = [];

    if (emptyResponseError) {
      parts.push({ text: emptyResponseError, type: MessagePartTypes.TEXT });
    } else if (text) {
      parts.push({ text, type: MessagePartTypes.TEXT });
    }

    const isRedactedOnlyReasoning = reasoningText && /^\[REDACTED\]$/i.test(reasoningText.trim());
    if (reasoningText && !isRedactedOnlyReasoning) {
      parts.push({ text: reasoningText, type: MessagePartTypes.REASONING });
    }

    const toolCalls = finishResult.toolCalls && Array.isArray(finishResult.toolCalls) ? finishResult.toolCalls : [];
    for (const toolCall of toolCalls) {
      parts.push({
        args: toolCall.args,
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        type: 'tool-call',
      });
    }

    const toolResults = finishResult.toolResults && Array.isArray(finishResult.toolResults) ? finishResult.toolResults : [];

    if (parts.length === 0) {
      parts.push({ text: '', type: MessagePartTypes.TEXT });
    }

    const usageMetadata = usageData
      ? {
          completionTokens: usageData.outputTokens ?? 0,
          promptTokens: usageData.inputTokens ?? 0,
          totalTokens:
            (usageData.inputTokens ?? 0) + (usageData.outputTokens ?? 0),
        }
      : text.trim().length > 0
        ? {
            completionTokens: Math.ceil(text.length / 4),
            promptTokens: 0,
            totalTokens: Math.ceil(text.length / 4),
          }
        : {
            completionTokens: 0,
            promptTokens: 0,
            totalTokens: 0,
          };

    let resolvedCitations;
    if (text && citationSourceMap && hasCitations(text)) {
      const parsedResult = parseCitations(text);
      if (parsedResult.citations.length > 0) {
        resolvedCitations = toDbCitations(
          parsedResult.citations,
          (sourceId) => {
            const source = citationSourceMap.get(sourceId);
            if (!source) {
              log.warn('Citation source lookup failed: source not found in citationSourceMap', {
                availableSourceIds: Array.from(citationSourceMap.keys()).join(', '),
                messageId,
                sourceId,
                threadId,
              });
              return undefined;
            }
            // Build result conditionally to satisfy exactOptionalPropertyTypes
            // Only include properties that have defined values
            type SourceDataResult = {
              title?: string;
              excerpt?: string;
              description?: string;
              url?: string;
              domain?: string;
              threadId?: string;
              threadTitle?: string;
              roundNumber?: number;
              // Search-specific fields
              query?: string;
              publishedDate?: string;
              author?: string;
              // Attachment-specific fields
              downloadUrl?: string;
              filename?: string;
              mimeType?: string;
              fileSize?: number;
            };
            const result: SourceDataResult = {
              // Clean and format the excerpt for better display
              excerpt: cleanCitationExcerpt(source.content, 200),
              title: source.title,
            };
            // Search-specific fields
            if (source.metadata.author !== undefined) {
              result.author = source.metadata.author;
            }
            if (source.metadata.description !== undefined) {
              result.description = source.metadata.description;
            }
            if (source.metadata.domain !== undefined) {
              result.domain = source.metadata.domain;
            }
            if (source.metadata.publishedDate !== undefined) {
              result.publishedDate = source.metadata.publishedDate;
            }
            if (source.metadata.query !== undefined) {
              result.query = source.metadata.query;
            }
            // Attachment-specific fields
            if (source.metadata.downloadUrl !== undefined) {
              result.downloadUrl = source.metadata.downloadUrl;
            }
            if (source.metadata.filename !== undefined) {
              result.filename = source.metadata.filename;
            }
            if (source.metadata.fileSize !== undefined) {
              result.fileSize = source.metadata.fileSize;
            }
            if (source.metadata.mimeType !== undefined) {
              result.mimeType = source.metadata.mimeType;
            }
            // Context fields
            if (source.metadata.roundNumber !== undefined) {
              result.roundNumber = source.metadata.roundNumber;
            }
            if (source.metadata.threadId !== undefined) {
              result.threadId = source.metadata.threadId;
            }
            if (source.metadata.threadTitle !== undefined) {
              result.threadTitle = source.metadata.threadTitle;
            }
            if (source.metadata.url !== undefined) {
              result.url = source.metadata.url;
            }
            return result;
          },
        );
      }
    }

    const finalHasError = errorMetadata.hasError || !!emptyResponseError;
    const finalErrorMessage = emptyResponseError || errorMetadata.errorMessage;

    // Parse and validate finish reason
    // If stream completed with content but invalid finishReason, infer 'stop' (successful completion)
    // 'unknown' is reserved for truly interrupted/aborted streams with no content
    const finishReasonResult = FinishReasonSchema.safeParse(finishResult.finishReason);
    const validatedFinishReason = finishReasonResult.success
      ? finishReasonResult.data
      : (text || reasoningText) ? FinishReasons.STOP : FinishReasons.UNKNOWN;

    const messageMetadata = createParticipantMetadata({
      availableSources,
      citations: resolvedCitations,
      errorCategory: errorMetadata.errorCategory,
      errorMessage: finalErrorMessage,
      finishReason: validatedFinishReason,
      hasError: finalHasError,
      isPartialResponse: errorMetadata.isPartialResponse,
      isTransient: errorMetadata.isTransientError,
      model: modelId,
      openRouterError: errorMetadata.openRouterError
        ? { message: errorMetadata.openRouterError }
        : undefined,
      participantId,
      participantIndex,
      participantRole,
      providerMessage: errorMetadata.providerMessage,
      reasoningDuration,
      roundNumber,
      usage: usageMetadata,
    });

    // ✅ FIX: Use onConflictDoNothing to handle race conditions
    // Multiple concurrent onFinish callbacks can try to insert the same messageId
    // This prevents UNIQUE constraint errors while ensuring the message is saved
    await db
      .insert(tables.chatMessage)
      .values({
        createdAt: new Date(),
        id: messageId,
        metadata: messageMetadata,
        participantId,
        // Validate parts against DbMessageParts schema for type safety
        parts: DbMessagePartsSchema.parse(parts),
        role: MessageRoles.ASSISTANT,
        roundNumber,
        threadId,
      })
      .onConflictDoNothing()
      .returning();

    if (toolResults.length > 0) {
      const toolMessageId = ulid();
      const toolParts: MessagePart[] = toolResults.map(toolResult => ({
        isError: toolResult.isError,
        result: toolResult.result,
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
        type: 'tool-result',
      }));

      // ✅ FIX: Use onConflictDoNothing instead of check-then-insert
      // Eliminates race condition between check and insert
      await db.insert(tables.chatMessage)
        .values({
          createdAt: new Date(),
          id: toolMessageId,
          metadata: null,
          participantId,
          // Validate toolParts against DbMessageParts schema for type safety
          parts: DbMessagePartsSchema.parse(toolParts),
          role: MessageRoles.TOOL,
          roundNumber,
          threadId,
        })
        .onConflictDoNothing();
    }

    await invalidateMessagesCache(db, threadId);
  } catch (error) {
    // ✅ DEBUG: Log the error for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    rlog.stuck('PERSIST-FAILED', `tid=${threadId.slice(-8)} msgId=${messageId.slice(-8)} pIdx=${participantIndex} err=${errorMsg}`);
    log.db('error', 'Failed to save message', {
      error: errorMsg,
      messageId,
      participantId,
      participantIndex,
      roundNumber,
      stack: errorStack,
      threadId,
    });
    // ✅ FIX: Re-throw error so streaming handler knows persistence failed
    // This prevents KV from being marked "complete" when D1 doesn't have the message
    // The streaming handler's error handling will deal with the failure appropriately
    throw error;
  }
}
