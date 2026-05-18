/**
 * Chat Messages Service - Message Types & Metadata
 *
 * 100% type-safe message types derived from backend Hono RPC responses.
 * All types automatically inferred from API response shapes.
 *
 * Extracted from threads.ts to separate message-related concerns
 * from thread CRUD operations.
 */

import type { ThreadDetailData } from './threads';

// ============================================================================
// Message Types - Derived from API Response (SINGLE SOURCE OF TRUTH)
// ============================================================================

/**
 * Message type from API response - derived from ThreadDetailData
 */
export type ApiMessage = ThreadDetailData['messages'][number];

/**
 * ApiMessageMetadata - RPC-inferred metadata type from API response
 */
export type ApiMessageMetadata = NonNullable<ApiMessage['metadata']>;

/**
 * ApiMessageParts - Parts array type derived from ApiMessage
 */
export type ApiMessageParts = ApiMessage['parts'];

/**
 * ApiMessagePart - Single part type from message parts array
 */
export type ApiMessagePart = ApiMessageParts[number];

// ============================================================================
// Message Metadata Types - Derived from RPC Response (SINGLE SOURCE OF TRUTH)
// ============================================================================

/**
 * Message metadata type derived from API response
 * Discriminated union of all metadata types
 */
export type DbMessageMetadata = NonNullable<ApiMessage['metadata']>;

/**
 * User message metadata type (discriminated union member)
 */
export type DbUserMessageMetadata = Extract<DbMessageMetadata, { role: 'user' }>;

/**
 * Base assistant message metadata extracted from discriminated union
 */
type BaseAssistantMessageMetadata = Extract<DbMessageMetadata, { role: 'assistant'; participantId: string }>;

/**
 * Assistant message metadata type (discriminated union member)
 * Excludes moderator messages - isModerator must not be true
 */
export type DbAssistantMessageMetadata = BaseAssistantMessageMetadata & {
  isModerator?: never;
};

/**
 * Pre-search message metadata type (discriminated union member)
 */
export type DbPreSearchMessageMetadata = Extract<DbMessageMetadata, { role: 'system'; isPreSearch: true }>;

/**
 * Moderator message metadata type (discriminated union member)
 */
export type DbModeratorMessageMetadata = Extract<DbMessageMetadata, { role: 'assistant'; isModerator: true }>;

/**
 * Citation type derived from assistant message metadata
 */
export type DbCitation = NonNullable<DbAssistantMessageMetadata['citations']>[number];

/**
 * Available source type derived from assistant message metadata
 */
export type AvailableSource = NonNullable<DbAssistantMessageMetadata['availableSources']>[number];

/**
 * Participant message metadata - explicitly NOT including moderator messages.
 * Use this type when you need to access participant-specific fields.
 */
export type ParticipantMessageMetadata = DbAssistantMessageMetadata;

// ============================================================================
// Streaming State Types - SSR Streaming Resumption
// ============================================================================

/**
 * Streaming state from API for SSR partial content rendering.
 * Returned by getThreadBySlug when an active stream exists.
 * Allows server to render partial streaming content during page refresh.
 */
export type StreamingState = ThreadDetailData['streamingState'];

// ============================================================================
// Type Guards - Re-export from type-guards.ts
// ============================================================================

export {
  isAssistantMessageMetadata,
  isModeratorMessageMetadata,
  isParticipantMessageMetadata,
  isPreSearchMessageMetadata,
  isUserMessageMetadata,
} from './type-guards';
