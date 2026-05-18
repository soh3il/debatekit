/**
 * Schemas Barrel Export
 *
 * Re-exports from @debatekit/shared for shared schemas.
 * Platform-specific schemas (ChatParticipantSchema) defined locally.
 */

// ============================================================================
// Re-export shared schemas from @debatekit/shared
// ============================================================================

// Error schemas
export type { ErrorMetadata } from '@debatekit/shared';
export {
  categorizeErrorMessage,
  createErrorMetadata,
  createPartialErrorMetadata,
  errorCategoryToUIType,
  ErrorMetadataSchema,
  getErrorCategoryMessage,
  isErrorCategory,
  isUIMessageErrorType,
} from '@debatekit/shared';

// Message schemas
export type {
  ExtendedFilePart,
  FilePart,
  MessagePart,
  ReasoningPart,
  StreamingFinishResult,
  StreamingToolCall,
  StreamingUsage,
} from '@debatekit/shared';
export {
  convertUIMessagesToText,
  createReasoningPart,
  createTextPart,
  createToolCallPart,
  createToolResultPart,
  ExtendedFilePartSchema,
  extractAllTextFromParts,
  extractReasoningFromParts,
  extractTextFromMessage,
  extractTextFromParts,
  extractToolCalls,
  extractToolResults,
  extractUploadIdFromUrl,
  extractValidFileParts,
  FilePartSchema,
  filterPartsByType,
  findToolResult,
  getFilenameFromPart,
  getMimeTypeFromPart,
  getPartsByType,
  getUploadIdFromFilePart,
  getUrlFromPart,
  hasReasoning,
  hasRenderableContent,
  hasText,
  hasToolCalls,
  hasToolResults,
  hasUploadId,
  isFilePart,
  isMessagePart,
  isMessageStatus,
  isReasoningPart,
  isReasoningPartArray,
  isRenderableContent,
  isStreamingPart,
  isToolCallPart,
  isToolResultPart,
  isValidFilePartForTransmission,
  MessagePartSchema,
  ReasoningPartSchema,
  StreamingFinishResultSchema,
  StreamingToolCallSchema,
  StreamingUsageSchema,
} from '@debatekit/shared';

// Round schemas
export type { RoundNumber, RoundNumberWithSentinel } from '@debatekit/shared';
export {
  calculateNextRound,
  DEFAULT_ROUND_NUMBER,
  extractRoundNumber,
  formatRoundNumber,
  getDisplayRoundNumber,
  isValidRoundNumber,
  NO_ROUND_SENTINEL,
  NullableRoundNumberSchema,
  OptionalRoundNumberSchema,
  parseRoundNumber,
  RoundNumberSchema,
  RoundNumberWithSentinelSchema,
  safeParseRoundNumber,
} from '@debatekit/shared';

// Shared participant schemas from @debatekit/shared
export type {
  ComparableParticipant,
  MinimalParticipant,
  ModelReference,
  ParticipantConfig,
  ParticipantConfigInput,
  ParticipantContext,
  ParticipantForValidation,
  ParticipantIndex,
  ParticipantIndexWithSentinel,
  ParticipantUpdatePayload,
  ValidateModelAccessOptions,
} from '@debatekit/shared';
export {
  ComparableParticipantSchema,
  DEFAULT_PARTICIPANT_INDEX,
  formatParticipantIndex,
  getDisplayParticipantIndex,
  isComparableParticipant,
  isMinimalParticipant,
  isParticipantConfig,
  isParticipantConfigArray,
  isParticipantConfigInput,
  isParticipantContext,
  isParticipantForValidation,
  isParticipantForValidationArray,
  isParticipantUpdatePayload,
  MinimalParticipantSchema,
  ModelIdReferenceSchema,
  ModelReferenceSchema,
  NO_PARTICIPANT_SENTINEL,
  ParticipantConfigInputSchema,
  ParticipantConfigSchema,
  ParticipantContextSchema,
  ParticipantForValidationSchema,
  ParticipantIdSchema,
  ParticipantIndexSchema,
  ParticipantIndexWithSentinelSchema,
  ParticipantRoleSchema,
  ParticipantUpdatePayloadSchema,
  ValidateModelAccessOptionsSchema,
} from '@debatekit/shared';

// ============================================================================
// Platform-specific schemas (API only)
// ============================================================================

// Participant schemas with Drizzle dependencies
export type { ChatParticipantWithSettings } from './participant-schemas';
export {
  ChatParticipantSchema,
  isChatParticipant,
  isChatParticipantArray,
  NonEmptyParticipantsArraySchema,
  ParticipantsArraySchema,
} from './participant-schemas';
