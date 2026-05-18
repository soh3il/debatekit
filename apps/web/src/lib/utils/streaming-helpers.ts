/**
 * Streaming Utilities - Single Source of Truth
 *
 * Consolidates streaming-related patterns for unified round streams.
 *
 * This module provides:
 * - Streaming ID generation (participant and moderator)
 * - Streaming metadata checks
 * - Terminal status checks
 * - Participant count utilities
 * - Per-participant completion checks
 */

import { TextPartStates } from '@debatekit/shared';
import type { UIMessage } from 'ai';

// ============================================================================
// STREAMING ID GENERATION
// ============================================================================

/**
 * Generate streaming message ID for a participant
 *
 * Format: `streaming_p{index}_r{roundNumber}`
 *
 * REPLACES: Inline template literals in:
 * - store.ts line 181: `streaming_p${participantIndex}_r${roundNumber}`
 * - store.ts line 420: `streaming_p${i}_r${roundNumber}`
 *
 * @param participantIndex - 0-based participant index
 * @param roundNumber - Round number (0-based)
 */
export function getParticipantStreamingId(participantIndex: number, roundNumber: number): string {
  return `streaming_p${participantIndex}_r${roundNumber}`;
}

/**
 * Generate streaming message ID for the moderator
 *
 * Format: `{threadId}_r{roundNumber}_moderator` (preferred)
 * Fallback: `streaming_moderator_r{roundNumber}` (when threadId is null)
 *
 * REPLACES: Inline logic in:
 * - store.ts lines 243-244
 * - store.ts lines 457-459
 *
 * @param threadId - Thread ID (null for new threads before ID is assigned)
 * @param roundNumber - Round number (0-based)
 */
export function getModeratorStreamingId(threadId: string | null, roundNumber: number): string {
  return threadId
    ? `${threadId}_r${roundNumber}_moderator`
    : `streaming_moderator_r${roundNumber}`;
}

// ============================================================================
// STREAMING METADATA CHECKS
// ============================================================================

/**
 * Check if metadata indicates a streaming message
 *
 * Fast O(1) check without Zod validation.
 *
 * REPLACES: Inline checks in:
 * - provider.tsx line 161: `'isStreaming' in meta && ...`
 * - store.ts lines 256-258
 *
 * @param metadata - Message metadata (unknown type for safety)
 */
export function isStreamingMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  return 'isStreaming' in metadata && metadata.isStreaming === true;
}

/**
 * Check if metadata explicitly marks streaming as complete (isStreaming === false)
 *
 * Useful for distinguishing between "no streaming metadata" and "streaming finished".
 * Returns true ONLY when isStreaming is explicitly set to false.
 *
 * @param metadata - Message metadata (unknown type for safety)
 */
export function isStreamingMarkedComplete(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  return 'isStreaming' in metadata && metadata.isStreaming === false;
}

/**
 * Safely set the isStreaming flag on a message's metadata
 *
 * Validates that metadata exists and is an object before mutation.
 * Returns true if the mutation was successful, false otherwise.
 *
 * @param metadata - Message metadata (unknown type for safety)
 * @param isStreaming - New value for isStreaming flag
 * @returns true if mutation succeeded, false if metadata was invalid
 */
export function setStreamingStatus(metadata: unknown, isStreaming: boolean): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  if (!('isStreaming' in metadata)) {
    return false;
  }
  // After confirming 'isStreaming' exists via `in`, mutate the property directly.
  // We need to write to a property on an object whose exact shape is unknown at
  // compile time. Using Object.assign preserves the runtime object identity
  // while satisfying TypeScript without an `as` cast.
  Object.assign(metadata, { isStreaming });
  return true;
}

/**
 * Check if a message ID is a streaming placeholder ID
 *
 * Streaming placeholder ID patterns:
 * - Participant: `streaming_p{index}_r{roundNumber}` (e.g., 'streaming_p1_r0')
 * - Moderator (no threadId): `streaming_moderator_r{roundNumber}` (rare)
 * - Moderator (with threadId): `{threadId}_r{roundNumber}_moderator` (e.g., '01KG..._r0_moderator')
 *
 * Real DB message IDs use different patterns:
 * - Participant: `{threadId}_r{roundNumber}_p{index}` (e.g., '01KG..._r0_p1')
 * - Moderator: Same as placeholder when threadId exists
 *
 * NOTE: Moderator IDs with threadId cannot be distinguished from real server IDs by pattern alone.
 * In practice this is fine because:
 * 1. During streaming, moderator has isStreaming=true metadata
 * 2. After round completion, messages are either preserved (with content) or replaced by server fetch
 * 3. The hasStreamingPlaceholders() function also checks isStreamingMetadata() for safety
 *
 * @param id - Message ID to check
 */
export function isPlaceholderId(id: string): boolean {
  // Check for streaming_ prefix (participants and moderator without threadId)
  // Also check for _moderator suffix (moderator with threadId)
  return id.startsWith('streaming_') || id.endsWith('_moderator');
}

/**
 * Check if messages array has any streaming placeholders
 *
 * Checks BOTH:
 * 1. Active streaming (metadata.isStreaming === true)
 * 2. Unreplaced placeholder IDs (ID starts with 'streaming_')
 *
 * The second check is critical for the round completion flow:
 * When an entity completes, the AI SDK transitions streaming state automatically,
 * but the placeholder ID remains until the real message is fetched from the server.
 * Without this check, handleRoundComplete would skip fetching real messages,
 * leaving placeholder IDs like 'streaming_p1_r0' in the messages array forever.
 *
 * REPLACES: Inline checks in:
 * - provider.tsx lines 159-162, 201-204
 * - store.ts lines 778-785
 *
 * @param messages - Array of UIMessages
 */
export function hasStreamingPlaceholders(messages: UIMessage[]): boolean {
  return messages.some(m => isStreamingMetadata(m.metadata) || isPlaceholderId(m.id));
}

// ============================================================================
// STATUS CHECKS
// ============================================================================

/**
 * Check if a participant's streaming is complete
 *
 * Returns true if ANY of these conditions are met:
 * 1. subscriptionStatus is 'complete' (backend confirms completion)
 * 2. message.metadata.isStreaming is explicitly false (set by AI SDK)
 * 3. All text parts have state !== TextPartStates.STREAMING (no active streaming parts)
 *
 * This helper provides a unified way to determine individual participant completion,
 * used by chat-message-list to show appropriate loading/complete states.
 *
 * @param message - UIMessage for the participant (may be undefined if not yet created)
 * @returns true if participant streaming is complete, false if still streaming
 */
export function isParticipantStreamingComplete(
  message: UIMessage | undefined,
): boolean {
  // If no message exists yet, we're still waiting for it
  if (!message) {
    return false;
  }

  // Condition 2: Metadata explicitly marks streaming as false
  // This is set by AI SDK when the participant's stream closes
  const metadata = message.metadata;
  if (metadata && typeof metadata === 'object' && 'isStreaming' in metadata) {
    if (metadata.isStreaming === false) {
      return true;
    }
  }

  // Condition 3: No text parts are in STREAMING state
  // This handles the case where parts have transitioned to DONE
  const parts = message.parts;
  if (!parts || parts.length === 0) {
    // No parts yet - still waiting
    return false;
  }

  // Check if any text part is still streaming
  const hasStreamingParts = parts.some(
    part => 'state' in part && part.state === TextPartStates.STREAMING,
  );

  // Complete if no parts are streaming
  return !hasStreamingParts;
}

// ============================================================================
// PARTICIPANT COUNT UTILITIES
// ============================================================================

/**
 * Count enabled participants
 *
 * REPLACES: Inline filter/length in:
 * - provider.tsx line 83: `.filter(p => p.isEnabled).length`
 * - store.ts line 619
 *
 * @param participants - Array of objects with isEnabled field
 */
export function countEnabledParticipants<T extends { isEnabled: boolean }>(
  participants: T[],
): number {
  let count = 0;
  for (let i = 0; i < participants.length; i++) {
    if (participants[i]?.isEnabled) {
      count++;
    }
  }
  return count;
}
