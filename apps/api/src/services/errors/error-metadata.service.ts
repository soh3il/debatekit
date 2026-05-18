/**
 * Error Metadata Service - Unified Error Extraction and Categorization
 *
 * Single source of truth for AI provider error detection and categorization.
 * All type validations use Zod schemas - no type casting.
 *
 * Provides:
 * - Unified error metadata extraction from AI provider responses
 * - Error categorization following ErrorCategorySchema
 * - Transient error detection for retry logic
 * - Empty response error building with context-aware messages
 * - Provider-specific error extraction (OpenRouter, OpenAI, etc.)
 */

import type { ErrorCategory } from '@debatekit/shared/enums';
import {
  ErrorCategories,
  ErrorCategorySchema,
  FinishReasons,
} from '@debatekit/shared/enums';
import * as z from 'zod';

import { categorizeErrorMessage } from '@/lib/schemas';
import { isTransientError } from '@/lib/utils/error-metadata-builders';

// ============================================================================
// HELPER SCHEMAS
// ============================================================================

/**
 * Schema for provider metadata error fields
 * Models the known error-related fields from AI provider metadata.
 */
/**
 * Constrained error object value schema
 */
const ErrorObjectValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const ProviderMetadataSchema = z.object({
  contentFilter: z.union([z.string(), z.boolean(), z.record(z.string(), ErrorObjectValueSchema)]).optional(),
  error: z.union([z.string(), z.record(z.string(), ErrorObjectValueSchema)]).optional(),
  errorMessage: z.string().optional(),
  moderation: z.union([z.string(), z.boolean(), z.record(z.string(), ErrorObjectValueSchema)]).optional(),
}).partial();

/**
 * Schema for response object error fields
 */
const ResponseWithErrorSchema = z.object({
  error: z.union([z.string(), z.record(z.string(), ErrorObjectValueSchema)]).optional(),
}).partial();

// ============================================================================
// TYPE DEFINITIONS (Zod Schemas - Single Source of Truth)
// ============================================================================

/**
 * Error metadata structure returned by extraction functions
 * Provides comprehensive error context for storage and display
 */
const _ExtractedErrorMetadataSchema = z.object({
  errorCategory: ErrorCategorySchema.optional(),
  errorMessage: z.string().optional(),
  hasError: z.boolean(),
  isPartialResponse: z.boolean(),
  isTransientError: z.boolean(),
  openRouterError: z.string().optional(),
  providerMessage: z.string().optional(),
}).strict();

export type ExtractedErrorMetadata = z.infer<typeof _ExtractedErrorMetadataSchema>;

/**
 * Provider error extraction result
 */
const _ProviderErrorResultSchema = z.object({
  category: ErrorCategorySchema.optional(),
  rawError: z.string().optional(),
}).strict();

export type ProviderErrorResult = z.infer<typeof _ProviderErrorResultSchema>;

/**
 * Usage statistics from AI provider
 */
export const UsageStatsSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
}).strict();

export type UsageStats = z.infer<typeof UsageStatsSchema>;

// ============================================================================
// ERROR CATEGORIZATION
// ============================================================================

/**
 * Categorize error based on error message content
 * Delegates to categorizeErrorMessage from error-schemas.ts
 */
function categorizeError(errorMessage: string): ErrorCategory {
  return categorizeErrorMessage(errorMessage);
}

// ============================================================================
// PROVIDER ERROR EXTRACTION
// ============================================================================

/**
 * Extract provider-specific error details from metadata and response
 * Uses Zod .safeParse() for type-safe extraction at validation boundary.
 *
 * providerMetadata and response are `unknown` because they come from AI SDK
 * runtime responses -- this is a validation boundary where unknown is justified.
 *
 * Checks for errors in:
 * - providerMetadata.error
 * - providerMetadata.errorMessage
 * - providerMetadata.moderation (content filter)
 * - providerMetadata.contentFilter
 * - response.error
 */
function extractProviderError(
  providerMetadata: unknown,
  response: unknown,
): ProviderErrorResult {
  let rawError: string | undefined;
  let category: ErrorCategory | undefined;

  // Check providerMetadata with Zod validation
  const metadataResult = ProviderMetadataSchema.safeParse(providerMetadata);
  if (metadataResult.success) {
    const metadata = metadataResult.data;

    // Extract error field (string or object)
    if (metadata.error) {
      rawError
        = typeof metadata.error === 'string'
          ? metadata.error
          : JSON.stringify(metadata.error);
    }

    // Check errorMessage field as fallback
    if (!rawError && metadata.errorMessage) {
      rawError = metadata.errorMessage;
    }

    // Detect content moderation errors
    if (metadata.moderation || metadata.contentFilter) {
      category = ErrorCategories.CONTENT_FILTER;
      rawError = rawError || 'Content was filtered by safety systems';
    }
  }

  // Check response with Zod validation
  if (!rawError) {
    const responseResult = ResponseWithErrorSchema.safeParse(response);
    if (responseResult.success && responseResult.data.error) {
      rawError
        = typeof responseResult.data.error === 'string'
          ? responseResult.data.error
          : JSON.stringify(responseResult.data.error);
    }
  }

  // Categorize error if found
  if (rawError && !category) {
    category = categorizeError(rawError);
  }

  return { category, rawError };
}

// ============================================================================
// EMPTY RESPONSE ERROR BUILDING
// ============================================================================

const _BuildEmptyResponseErrorParamsSchema = z.object({
  finishReason: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});

type BuildEmptyResponseErrorParams = z.infer<typeof _BuildEmptyResponseErrorParamsSchema>;

/**
 * Build context-aware error messages for empty responses
 *
 * Empty response scenarios:
 * - stop: Model completed but filtered (content filter)
 * - length: Hit token limit without output (configuration issue)
 * - content-filter: Explicit content moderation (safety block)
 * - failed/other: Provider error (transient)
 * - unknown: Generic empty response
 */
function buildEmptyResponseError(
  params: BuildEmptyResponseErrorParams,
): ExtractedErrorMetadata;
function buildEmptyResponseError(
  inputTokens: number,
  outputTokens: number,
  finishReason: string,
): ExtractedErrorMetadata;
function buildEmptyResponseError(
  inputTokensOrParams: number | BuildEmptyResponseErrorParams,
  outputTokens?: number,
  finishReason?: string,
): ExtractedErrorMetadata {
  // Handle both calling patterns
  const params = typeof inputTokensOrParams === 'object'
    ? inputTokensOrParams
    : {
        finishReason: finishReason ?? 'unknown',
        inputTokens: inputTokensOrParams,
        outputTokens: outputTokens ?? 0,
      };

  const { finishReason: reason, inputTokens, outputTokens: outTokens } = params;
  // Build base statistics for all error messages
  const baseStats = `Input: ${inputTokens} tokens, Output: ${outTokens} tokens, Status: ${reason}`;

  let providerMessage: string;
  let errorMessage: string;
  let errorCategory: ErrorCategory;
  let isTransientErrorFlag: boolean;

  if (reason === FinishReasons.STOP) {
    // stop = Model completed intentionally with no output (likely content filter)
    providerMessage = `Model completed but returned no content. ${baseStats}. This may indicate content filtering, safety constraints, or the model chose not to respond.`;
    errorMessage = 'Returned empty response - possible content filtering or safety block';
    errorCategory = ErrorCategories.CONTENT_FILTER;
    isTransientErrorFlag = false; // Content filters are not transient
  } else if (reason === FinishReasons.LENGTH) {
    // length = Hit token limit before generating output (configuration issue)
    providerMessage = `Model hit token limit before generating content. ${baseStats}. Try reducing the conversation history or input length.`;
    errorMessage = 'Exceeded token limit without generating content';
    errorCategory = ErrorCategories.PROVIDER_ERROR;
    isTransientErrorFlag = true; // User can retry with shorter input
  } else if (reason === FinishReasons.CONTENT_FILTER) {
    // content-filter = Explicit content moderation
    providerMessage = `Content was filtered by safety systems. ${baseStats}`;
    errorMessage = 'Blocked by content filter';
    errorCategory = ErrorCategories.CONTENT_FILTER;
    isTransientErrorFlag = false; // Content filters are policy-based, not transient
  } else if (reason === FinishReasons.FAILED || reason === FinishReasons.OTHER) {
    // failed/other = Provider error (transient)
    providerMessage = `Provider error prevented response generation. ${baseStats}. This may be a temporary issue with the model provider.`;
    errorMessage = 'Encountered a provider error';
    errorCategory = ErrorCategories.PROVIDER_ERROR;
    isTransientErrorFlag = true; // Provider errors are usually transient
  } else {
    // unknown = Generic empty response
    providerMessage = `Model returned empty response. ${baseStats}`;
    errorMessage = `Returned empty response (reason: ${reason})`;
    errorCategory = ErrorCategories.EMPTY_RESPONSE;
    isTransientErrorFlag = true; // Unknown empty responses may be transient
  }

  return {
    errorCategory,
    errorMessage,
    hasError: true,
    isPartialResponse: false, // Empty response = no partial content
    isTransientError: isTransientErrorFlag,
    providerMessage,
  };
}

// ============================================================================
// COMPREHENSIVE ERROR METADATA EXTRACTION
// ============================================================================

/**
 * Schema for extractErrorMetadata params object.
 * providerMetadata and response use z.unknown() at the validation boundary --
 * they come from AI SDK runtime and are validated inside extractProviderError.
 */
const ExtractErrorMetadataParamsSchema = z.object({
  finishReason: z.string(),
  providerMetadata: z.unknown(),
  reasoning: z.string().optional(),
  response: z.unknown(),
  text: z.string().optional(),
  usage: UsageStatsSchema.optional(),
});

type ExtractErrorMetadataParams = z.infer<typeof ExtractErrorMetadataParamsSchema>;

/**
 * Validate if value matches ExtractErrorMetadataParams using Zod .safeParse()
 */
function isExtractErrorMetadataParams(
  value: unknown,
): value is ExtractErrorMetadataParams {
  return ExtractErrorMetadataParamsSchema.safeParse(value).success;
}

/**
 * Extract comprehensive error metadata from AI provider response
 *
 * Detection flow:
 * 1. Extract provider errors from metadata/response
 * 2. Check for empty response (no output tokens)
 * 3. Categorize errors based on content
 * 4. Build detailed error messages
 * 5. Determine transience for retry logic
 * 6. Detect partial responses (error with some content)
 */
export function extractErrorMetadata(
  params: ExtractErrorMetadataParams,
): ExtractedErrorMetadata;
export function extractErrorMetadata(
  providerMetadata: unknown,
  response: unknown,
  finishReason: string,
  usage?: UsageStats,
  text?: string,
  reasoning?: string,
): ExtractedErrorMetadata;
export function extractErrorMetadata(
  providerMetadataOrParams: unknown | ExtractErrorMetadataParams,
  response?: unknown,
  finishReason?: string,
  usage?: UsageStats,
  text?: string,
  reasoning?: string,
): ExtractedErrorMetadata {
  // Handle both calling patterns with type guard
  const params = isExtractErrorMetadataParams(providerMetadataOrParams)
    ? providerMetadataOrParams
    : {
        finishReason: finishReason ?? 'unknown',
        providerMetadata: providerMetadataOrParams,
        reasoning,
        response: response ?? null,
        text,
        usage,
      };

  const {
    finishReason: reason,
    providerMetadata,
    reasoning: reasoningData,
    response: resp,
    text: textData,
    usage: usageData,
  } = params;

  // Extract provider-specific errors
  const { category: providerCategory, rawError } = extractProviderError(
    providerMetadata,
    resp,
  );

  // Handle cases where usage is missing (some models like DeepSeek don't return usage)
  const outputTokens = usageData?.outputTokens || 0;
  const inputTokens = usageData?.inputTokens || 0;
  const hasGeneratedText = (textData?.trim().length || 0) > 0;

  // Check reasoning content for o1/o3 models that output reasoning instead of text
  const hasGeneratedReasoning = (reasoningData?.trim().length || 0) > 0;
  const hasGeneratedContent = hasGeneratedText || hasGeneratedReasoning;

  // ✅ FIX: DeepSeek and some models don't return usage/finishReason but DO generate content
  // Only mark as empty response if we're CERTAIN there's no content:
  // - If text/reasoning exists, it's NOT empty (regardless of token counts)
  // - If finishReason is undefined AND tokens are 0, only mark empty if no content
  // - finishReason 'stop' with 0 tokens but WITH content = successful (some models don't report usage)
  const isKnownFailureReason = reason === FinishReasons.FAILED
    || reason === FinishReasons.ERROR
    || reason === FinishReasons.CONTENT_FILTER;

  // ✅ FIX: Interrupted stream detection (page refresh mid-stream)
  // When reason is undefined/null with 0 tokens and no content, this indicates
  // an interrupted stream (e.g., page refresh), NOT an actual error.
  // DeepSeek and other models may return 200 status with empty body during interruption.
  // The incomplete-round-resumption logic handles retry - don't show as error.
  const isInterruptedStream = !reason && outputTokens === 0 && !hasGeneratedContent;

  // Empty response = no generated content AND known failure reason
  // Don't treat interrupted streams (undefined reason) as empty response errors
  const isEmptyResponse = !hasGeneratedContent && isKnownFailureReason;

  // Error occurred if we have provider error OR empty response (NOT interrupted stream)
  const hasError = (isEmptyResponse || !!rawError) && !isInterruptedStream;

  // Build error metadata based on error type
  if (!hasError) {
    // No error detected
    return {
      hasError: false,
      isPartialResponse: false,
      isTransientError: false,
    };
  }

  // Provider error detected
  if (rawError) {
    const errorCategory = providerCategory || categorizeError(rawError);

    return {
      errorCategory,
      errorMessage: rawError,
      hasError: true,
      isPartialResponse: hasGeneratedContent || outputTokens > 0, // Partial = error with some content
      isTransientError: isTransientError(errorCategory, reason),
      openRouterError: rawError,
      providerMessage: rawError,
    };
  }

  // Empty response detected (no provider error)
  return buildEmptyResponseError(inputTokens, outputTokens, reason);
}
