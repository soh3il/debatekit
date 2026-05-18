/**
 * Error Metadata Builders
 *
 * Transient error detection and error object classification.
 * Used by error-metadata.service.ts and product-logic.service.ts.
 */

import { ErrorCategorySchema, FinishReasonSchema } from '@debatekit/shared/enums';
import { z } from 'zod';

/**
 * Determine if an error is transient (retriable)
 *
 * Transient: provider_error, network, rate_limit, empty_response (unless explicit stop)
 * Permanent: model_not_found, content_filter
 */
export function isTransientError(
  errorCategory?: string,
  finishReason?: string,
): boolean {
  if (!errorCategory) {
    return true; // Unknown errors are assumed transient
  }

  // Transient error categories
  const transientCategories = [
    ErrorCategorySchema.enum.provider_error,
    ErrorCategorySchema.enum.network,
    ErrorCategorySchema.enum.rate_limit,
  ];

  if (
    transientCategories.includes(
      errorCategory as (typeof transientCategories)[number],
    )
  ) {
    return true;
  }

  // Empty response is transient unless it's an explicit stop
  if (
    errorCategory === ErrorCategorySchema.enum.empty_response
    && finishReason !== FinishReasonSchema.enum.stop
  ) {
    return true;
  }

  // Permanent error categories (don't retry)
  const permanentCategories = [
    ErrorCategorySchema.enum.model_not_found,
    ErrorCategorySchema.enum.content_filter,
  ];

  return !permanentCategories.includes(
    errorCategory as (typeof permanentCategories)[number],
  );
}

/**
 * Zod schema for extracting statusCode from error objects
 */
const ErrorWithStatusCodeSchema = z.object({
  statusCode: z.number(),
}).partial();

/**
 * Zod schema for Error-like objects with message
 */
const ErrorLikeSchema = z.object({
  message: z.string(),
}).partial();

/**
 * Check if error is transient based on error object or message string.
 * Accepts Error objects, strings, or unknown values.
 */
export function isTransientErrorFromObject(error: unknown): boolean {
  if (!error) {
    return true; // No error is treated as transient
  }

  // Extract HTTP status code using Zod
  const statusResult = ErrorWithStatusCodeSchema.safeParse(error);
  if (statusResult.success && statusResult.data.statusCode !== undefined) {
    const statusCode = statusResult.data.statusCode;
    if (statusCode === 429 || statusCode === 503 || statusCode === 502) {
      return true; // Rate limits and server errors are transient
    }
  }

  // Extract error message using Zod or Error instance check
  let errorMessage: string;
  if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    const errorResult = ErrorLikeSchema.safeParse(error);
    if (errorResult.success && errorResult.data.message) {
      errorMessage = errorResult.data.message;
    } else {
      errorMessage = String(error);
    }
  }

  const errorLower = errorMessage.toLowerCase();

  // Permanent error patterns - don't retry (user action required)
  const permanentErrorPatterns = [
    'model not found',
    'invalid api key',
    'invalid model',
    'unauthorized',
    'forbidden',
    'model does not exist',
    'data policy',
    'no endpoints found',
    'payment required',
    'quota exceeded',
    'invalid request',
    'unsupported',
  ];

  for (const pattern of permanentErrorPatterns) {
    if (errorLower.includes(pattern)) {
      return false; // Don't retry permanent errors
    }
  }

  // Network errors are transient
  if (errorLower.includes('network') || errorLower.includes('timeout')) {
    return true;
  }

  // All other errors are considered transient - retry
  return true;
}
