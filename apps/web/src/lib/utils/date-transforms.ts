/**
 * Date Transformation Utilities - Single Source of Truth
 *
 * Centralized date conversion utilities for transforming API responses.
 * Prevents duplicated date transformation logic across stores and hooks.
 *
 * **SINGLE SOURCE OF TRUTH**: All date transformations must use these utilities.
 * Do NOT duplicate date conversion logic inline.
 *
 * @module lib/utils/date-transforms
 */

import { ensureDate, ensureDateOrNull, toISOString, toISOStringOrNull } from '@debatekit/shared/lib';
import { z } from 'zod';

import type { ApiMessage, ChatParticipant, ChatThread } from '@/services/api';
import type { StoredPreSearchValidated } from '@/services/api/chat/pre-search';
import { StoredPreSearchSchema } from '@/services/api/chat/pre-search';

export { ensureDate, ensureDateOrNull, toISOString, toISOStringOrNull };

// ============================================================================
// RAW API INPUT SCHEMAS - For function parameters with string | Date fields
// ============================================================================

/**
 * Schema for raw ChatThread from API (before date transformation)
 * Dates may be strings or Date objects depending on API serialization
 */
const RawChatThreadInputSchema = z.custom<
  Omit<ChatThread, 'createdAt' | 'updatedAt' | 'lastMessageAt'> & {
    createdAt: string | Date;
    updatedAt: string | Date;
    lastMessageAt: string | Date | null;
  }
>();
type RawChatThreadInput = z.infer<typeof RawChatThreadInputSchema>;

/**
 * Schema for raw ChatParticipant from API (before date transformation)
 */
const RawChatParticipantInputSchema = z.custom<
  Omit<ChatParticipant, 'createdAt' | 'updatedAt'> & {
    createdAt: string | Date;
    updatedAt: string | Date;
  }
>();
type RawChatParticipantInput = z.infer<typeof RawChatParticipantInputSchema>;

/**
 * Schema for raw ApiMessage from API (before date transformation)
 */
const RawApiMessageInputSchema = z.custom<
  Omit<ApiMessage, 'createdAt'> & {
    createdAt: string | Date;
  }
>();
type RawApiMessageInput = z.infer<typeof RawApiMessageInputSchema>;

// ============================================================================
// ENTITY-SPECIFIC TRANSFORMATIONS
// ============================================================================

/**
 * Transform ChatThread API response with date fields
 *
 * **SINGLE SOURCE OF TRUTH**: Use for all thread data transformations.
 *
 * Converts string dates to Date objects:
 * - createdAt: always present
 * - updatedAt: always present
 * - lastMessageAt: nullable
 *
 * @param thread - Raw thread from API (may have string dates)
 * @returns Thread with Date objects
 *
 * @example
 * ```typescript
 * // In store actions or hooks
 * const thread = transformChatThread(apiResponse.data.thread);
 * ```
 */
export function transformChatThread(
  thread: RawChatThreadInput,
): ChatThread {
  return {
    ...thread,
    createdAt: toISOString(ensureDate(thread.createdAt)),
    lastMessageAt: toISOStringOrNull(ensureDateOrNull(thread.lastMessageAt)),
    updatedAt: toISOString(ensureDate(thread.updatedAt)),
  };
}

/**
 * Transform ChatParticipant API response with date fields
 *
 * **SINGLE SOURCE OF TRUTH**: Use for all participant data transformations.
 *
 * Converts string dates to Date objects:
 * - createdAt: always present
 * - updatedAt: always present
 *
 * @param participant - Raw participant from API (may have string dates)
 * @returns Participant with Date objects
 *
 * @example
 * ```typescript
 * const participants = apiResponse.data.participants.map(transformChatParticipant);
 * ```
 */
export function transformChatParticipant(
  participant: RawChatParticipantInput,
): ChatParticipant {
  return {
    ...participant,
    createdAt: toISOString(ensureDate(participant.createdAt)),
    updatedAt: toISOString(ensureDate(participant.updatedAt)),
  };
}

/**
 * Transform ApiMessage API response with date fields
 *
 * **SINGLE SOURCE OF TRUTH**: Use for all message data transformations.
 *
 * Converts string dates to Date objects:
 * - createdAt: always present
 *
 * @param message - Raw message from API (may have string dates)
 * @returns Message with Date objects
 *
 * @example
 * ```typescript
 * const messages = apiResponse.data.items.map(transformChatMessage);
 * ```
 */
export function transformChatMessage(
  message: RawApiMessageInput,
): ApiMessage {
  return {
    ...message,
    createdAt: toISOString(ensureDate(message.createdAt)),
  };
}

// ============================================================================
// BATCH TRANSFORMATIONS
// ============================================================================

/**
 * Transform array of chat threads
 *
 * @param threads - Array of raw threads from API
 * @returns Array of threads with Date objects
 *
 * @example
 * ```typescript
 * const threads = transformChatThreads(apiResponse.data.items);
 * ```
 */
export function transformChatThreads(
  threads: RawChatThreadInput[],
): ChatThread[] {
  return threads.map(transformChatThread);
}

/**
 * Transform array of chat participants
 *
 * @param participants - Array of raw participants from API
 * @returns Array of participants with Date objects
 *
 * @example
 * ```typescript
 * const participants = transformChatParticipants(apiResponse.data.participants);
 * ```
 */
export function transformChatParticipants(
  participants: RawChatParticipantInput[],
): ChatParticipant[] {
  return participants.map(transformChatParticipant);
}

/**
 * Transform array of chat messages
 *
 * @param messages - Array of raw messages from API
 * @returns Array of messages with Date objects
 *
 * @example
 * ```typescript
 * const messages = transformChatMessages(apiResponse.data.items);
 * ```
 */
export function transformChatMessages(
  messages: RawApiMessageInput[],
): ApiMessage[] {
  return messages.map(transformChatMessage);
}

/**
 * Transform a single pre-search from API format to application format
 * Validates against schema - dates remain as strings (JSON serialization format)
 *
 * @param preSearch - Raw pre-search from API (validated against StoredPreSearchSchema)
 * @returns Validated pre-search, or null if validation fails
 */
export function transformPreSearch(
  preSearch: unknown,
): StoredPreSearchValidated | null {
  const result = StoredPreSearchSchema.safeParse(preSearch);

  if (!result.success) {
    return null;
  }

  // Dates remain as strings (JSON serialization format from RPC)
  return result.data;
}

/**
 * Transform array of pre-searches
 *
 * **Zod-validated transformation** - No type assertions needed.
 * ✅ FOLLOWS: transformModerators pattern exactly
 *
 * @param preSearches - Array of raw pre-searches from API (validated against schema)
 * @returns Array of pre-searches with validated types (filters out validation failures)
 *
 * @example
 * ```typescript
 * const preSearches = transformPreSearches(apiResponse.data.items);
 * ```
 */
export function transformPreSearches(
  preSearches: unknown[],
): StoredPreSearchValidated[] {
  return preSearches
    .map(transformPreSearch)
    .filter((item): item is StoredPreSearchValidated => item !== null);
}

// ============================================================================
// BUNDLE TRANSFORMATIONS - CONVENIENCE UTILITIES
// ============================================================================

/**
 * Schema for thread data bundle - batch transformation input
 * Represents a complete thread response with related entities
 */
const _ThreadDataBundleSchema = z.object({
  messages: z.array(RawApiMessageInputSchema).optional(),
  participants: z.array(RawChatParticipantInputSchema).optional(),
  thread: RawChatThreadInputSchema.optional(),
});
export type ThreadDataBundle = z.infer<typeof _ThreadDataBundleSchema>;

/**
 * Schema for transformed thread data bundle with Date objects
 */
const _TransformedThreadDataBundleSchema = z.object({
  messages: z.custom<ApiMessage[]>().optional(),
  participants: z.custom<ChatParticipant[]>().optional(),
  thread: z.custom<ChatThread>().optional(),
});
export type TransformedThreadDataBundle = z.infer<typeof _TransformedThreadDataBundleSchema>;

/**
 * Transform complete thread data bundle in one call
 * Reduces boilerplate when transforming multiple related entities
 *
 * **SINGLE SOURCE OF TRUTH**: Use for all bulk API response transformations.
 *
 * @param bundle - Thread data bundle with string dates
 * @returns Transformed bundle with Date objects
 *
 * @example
 * ```typescript
 * // Instead of:
 * const thread = transformChatThread(apiResponse.data.thread);
 * const participants = transformChatParticipants(apiResponse.data.participants);
 * const messages = transformChatMessages(apiResponse.data.items);
 *
 * // Use:
 * const { thread, participants, messages } = transformThreadBundle(apiResponse.data);
 * ```
 *
 * @example
 * ```typescript
 * // Partial transformations work too
 * const { thread, participants } = transformThreadBundle({
 *   thread: apiResponse.data.thread,
 *   participants: apiResponse.data.participants,
 * });
 * ```
 */
export function transformThreadBundle(
  bundle: ThreadDataBundle,
): TransformedThreadDataBundle {
  return {
    messages: bundle.messages ? transformChatMessages(bundle.messages) : undefined,
    participants: bundle.participants ? transformChatParticipants(bundle.participants) : undefined,
    thread: bundle.thread ? transformChatThread(bundle.thread) : undefined,
  };
}
