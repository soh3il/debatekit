/**
 * Participant Message Lookup Utilities
 *
 * Re-exports from @debatekit/shared with platform-specific metadata extractors.
 *
 * @module lib/utils/participant-message-lookup
 */

import type {
  MetadataExtractors,
  ParticipantContext,
  ParticipantMessageMaps,
} from '@debatekit/shared';
import {
  allParticipantsHaveVisibleContent as sharedAllParticipantsHaveVisibleContent,
  buildParticipantMessageMaps as sharedBuildParticipantMessageMaps,
  participantHasVisibleContent as sharedParticipantHasVisibleContent,
} from '@debatekit/shared';
import type { UIMessage } from 'ai';

import type { ChatParticipant } from '@/services/api';

import {
  getMessageMetadata,
  getModel,
  getParticipantId,
  getParticipantIndex,
} from './metadata';

// ============================================================================
// Re-exports (types and functions that don't need extractors)
// ============================================================================

export type { MetadataExtractors, ParticipantMessageMaps } from '@debatekit/shared';
export { getParticipantMessageFromMaps } from '@debatekit/shared';

// ============================================================================
// Platform-specific Metadata Extractors
// ============================================================================

/**
 * Web-specific metadata extractors using local metadata utilities
 */
const webExtractors: MetadataExtractors = {
  getMessageMetadata,
  getModel,
  getParticipantId,
  getParticipantIndex,
};

// ============================================================================
// Wrapped Functions (pre-inject extractors for backward compatibility)
// ============================================================================

/**
 * Build multi-strategy lookup maps from assistant messages
 *
 * Wrapper that injects Web-specific metadata extractors.
 *
 * @param assistantMessages - Assistant messages from a specific round
 * @returns ParticipantMessageMaps for multi-strategy lookup
 */
export function buildParticipantMessageMaps(
  assistantMessages: UIMessage[],
): ParticipantMessageMaps {
  return sharedBuildParticipantMessageMaps(assistantMessages, webExtractors);
}

/**
 * Check if a participant has visible content using multi-strategy lookup
 *
 * @param maps - Pre-built ParticipantMessageMaps
 * @param participant - The participant to check
 * @param participantIdx - The participant's index in the sorted list
 * @returns True if the participant has a message with visible content
 */
export function participantHasVisibleContent(
  maps: ParticipantMessageMaps,
  participant: ChatParticipant | ParticipantContext,
  participantIdx: number,
): boolean {
  return sharedParticipantHasVisibleContent(maps, participant, participantIdx);
}

/**
 * Check if ALL participants have visible content
 *
 * @param maps - Pre-built ParticipantMessageMaps
 * @param participants - Sorted array of participants
 * @returns True if all participants have visible content
 */
export function allParticipantsHaveVisibleContent(
  maps: ParticipantMessageMaps,
  participants: (ChatParticipant | ParticipantContext)[],
): boolean {
  return sharedAllParticipantsHaveVisibleContent(maps, participants);
}
