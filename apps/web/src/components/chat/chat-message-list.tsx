import type { MessageStatus } from '@debatekit/shared';
import { ErrorStateVariants, FinishReasons, isAvailableSource, isCompletionFinishReason, MessagePartTypes, MessageRoles, MessageStatuses, MODERATOR_NAME, MODERATOR_PARTICIPANT_INDEX, TextPartStates } from '@debatekit/shared';
import type { UIMessage } from 'ai';
import { memo, useCallback, useMemo, useRef } from 'react';
import Markdown from 'react-markdown';

import { LazyPersona } from '@/components/ai-elements/lazy-persona';
import type { PersonaState } from '@/components/ai-elements/persona';
import { ErrorState } from '@/components/chat/chat-states';
import { CompactPreSearchIndicator } from '@/components/chat/compact-pre-search-indicator';
import { MemorySavedNotification } from '@/components/chat/memory-saved-notification';
import type { MessageAttachment } from '@/components/chat/message-attachment-preview';
import { MessageAttachmentPreview } from '@/components/chat/message-attachment-preview';
import { ModelMessageCard } from '@/components/chat/model-message-card';
import { ParticipantHeader } from '@/components/chat/participant-header';
import { LazyStreamdown } from '@/components/markdown/lazy-streamdown';
import { remarkPlugins, streamdownComponents } from '@/components/markdown/unified-markdown-components';
import { useChatStoreOptional } from '@/components/providers/chat-store-provider/context';
import { useMemoryNotification } from '@/components/providers/chat-store-provider/memory-notification-context';
import { ScrollAwareParticipant, ScrollAwareUserMessage, ScrollFromTop } from '@/components/ui/motion';
import { BRAND } from '@/constants';
import { useAvailableSourcesArtifact } from '@/hooks/streaming/artifacts/use-available-sources-artifact';
import { useChatErrorOptional } from '@/hooks/streaming/use-chat-error-optional';
import { useModelLookup } from '@/hooks/utils';
import { useTranslations } from '@/lib/i18n';
import type { FilePart, MessagePart } from '@/lib/schemas';
import { getUploadIdFromFilePart, isFilePart, isMessagePart } from '@/lib/schemas';
import { cn } from '@/lib/ui/cn';
import { allParticipantsHaveVisibleContent, buildParticipantMessageMaps, buildSourcesFromPreSearch, getAvailableSources, getAvatarPropsFromModelId, getEnabledParticipants, getMessageMetadata, getMessageStatus, getModel, getModelFast, getModeratorMetadata, getParticipantId, getParticipantIndex, getParticipantMessageFromMaps, getParticipantRole, getRoundNumber, getUserMetadata, isModeratorMessage, isModeratorMetadataFast, isPreSearch as isPreSearchMessage, isPreSearchFast, isStreamingMarkedComplete, isStreamingMetadata, participantHasVisibleContent } from '@/lib/utils';
import type { ApiParticipant, AvailableSource, DbMessageMetadata, Model, StoredPreSearch } from '@/services/api';
import { isAssistantMessageMetadata } from '@/services/api';

const EMPTY_PARTICIPANTS: ApiParticipant[] = [];
const EMPTY_PRE_SEARCHES: StoredPreSearch[] = [];

function moderatorPersonaState(status: MessageStatus): PersonaState {
  if (status === MessageStatuses.STREAMING) {
    return 'speaking';
  }
  if (status === MessageStatuses.PENDING) {
    return 'thinking';
  }
  return 'idle';
}

// ============================================================================
// Source Collection Helpers (extracted from 4 repeated inline computations)
// ============================================================================

/**
 * Check if a source title is generic/fallback (should be replaced by better data).
 * These indicate backend couldn't find a meaningful title.
 */
function isGenericSourceTitle(title: string | undefined | null): boolean {
  if (!title) {
    return true;
  }
  return title === 'Attached File'
    || title === 'Project Memory'
    || title === 'Previous Conversation'
    || title === 'Indexed Document'
    || title.startsWith('Web Search Result')
    || title.startsWith('Round ')
    || title.endsWith(' Source');
}

/**
 * Merge an incoming source into a map, preferring the entry with more complete data.
 * When both exist for the same ID, prefer the one with a real title/filename.
 */
function mergeSourceIntoMap(
  map: Map<string, AvailableSource>,
  source: AvailableSource,
): void {
  if (!source.id || !isAvailableSource(source)) {
    return;
  }

  const existing = map.get(source.id);
  if (!existing) {
    map.set(source.id, source);
    return;
  }

  const existingHasGenericTitle = isGenericSourceTitle(existing.title);
  const incomingHasRealTitle = !isGenericSourceTitle(source.title);
  const existingHasFilename = !!(existing.filename && existing.filename.trim());
  const incomingHasFilename = !!(source.filename && source.filename.trim());

  if ((existingHasGenericTitle && incomingHasRealTitle) || (!existingHasFilename && incomingHasFilename)) {
    map.set(source.id, source);
  }
}

/**
 * Collect available sources for a round from three data layers:
 * 1. Message metadata (available after streaming completes)
 * 2. PreSearch data (available early, before metadata is populated)
 * 3. Streaming available sources from store (sent at start with proper titles)
 */
function collectRoundAvailableSources(
  assistantMessages: UIMessage[],
  preSearch: StoredPreSearch | null | undefined,
  streamingSources: Map<number, AvailableSource[]> | null | undefined,
  roundNumber: number,
): AvailableSource[] | undefined {
  const allSources = new Map<string, AvailableSource>();

  // Layer 1: Extract from message metadata (streaming-safe via getAvailableSources)
  for (const msg of assistantMessages) {
    const availableSourcesFromMsg = getAvailableSources(msg.metadata);
    if (availableSourcesFromMsg) {
      for (const source of availableSourcesFromMsg) {
        if (source.id && !allSources.has(source.id) && isAvailableSource(source)) {
          allSources.set(source.id, source);
        }
      }
    }
  }

  // Layer 2: Fallback to presearch data when no sources in message metadata
  if (allSources.size === 0 && preSearch?.searchData) {
    const presearchSources = buildSourcesFromPreSearch(preSearch.searchData);
    for (const source of presearchSources) {
      if (source.id && !allSources.has(source.id)) {
        allSources.set(source.id, source);
      }
    }
  }

  // Layer 3: ALWAYS merge streaming sources (they have the most complete titles)
  if (streamingSources) {
    const sourcesForRound = streamingSources.get(roundNumber);
    if (sourcesForRound) {
      for (const source of sourcesForRound) {
        mergeSourceIntoMap(allSources, source);
      }
    }
  }

  return allSources.size > 0 ? Array.from(allSources.values()) : undefined;
}

/**
 * Collect sources for a completed round's assistant-group.
 * Uses message metadata + presearch fallback + streaming sources.
 *
 * ✅ FIX: Added presearch fallback and lenient extraction (getAvailableSources)
 * to match collectRoundAvailableSources. Without this, citations like [sch_q0r1]
 * render as raw text after streaming completes because availableSources aren't
 * found in strict metadata validation and presearch data isn't checked.
 */
function collectCompletedRoundSources(
  assistantMessages: UIMessage[],
  streamingSources: Map<number, AvailableSource[]> | null | undefined,
  roundNumber: number,
  preSearch?: StoredPreSearch | null,
): AvailableSource[] | undefined {
  const allSources = new Map<string, AvailableSource>();

  // Layer 1: Extract from message metadata (streaming-safe via getAvailableSources)
  for (const msg of assistantMessages) {
    const availableSourcesFromMsg = getAvailableSources(msg.metadata);
    if (availableSourcesFromMsg) {
      for (const source of availableSourcesFromMsg) {
        if (source.id && !allSources.has(source.id) && isAvailableSource(source)) {
          allSources.set(source.id, source);
        }
      }
    }
  }

  // Layer 2: Fallback to presearch data when no sources in message metadata
  if (allSources.size === 0 && preSearch?.searchData) {
    const presearchSources = buildSourcesFromPreSearch(preSearch.searchData);
    for (const source of presearchSources) {
      if (source.id && !allSources.has(source.id)) {
        allSources.set(source.id, source);
      }
    }
  }

  // Layer 3: ALWAYS merge streaming sources (they have the most complete titles)
  if (streamingSources) {
    const sourcesForRound = streamingSources.get(roundNumber);
    if (sourcesForRound) {
      for (const source of sourcesForRound) {
        mergeSourceIntoMap(allSources, source);
      }
    }
  }

  return allSources.size > 0 ? Array.from(allSources.values()) : undefined;
}

type ParticipantInfo = {
  participantIndex: number | undefined;
  modelId: string | undefined;
  role: string | null | undefined;
  isStreaming: boolean;
};

type MessageGroup
  = | {
    type: 'user-group';
    messages: { message: UIMessage; index: number }[];
    headerInfo: {
      avatarSrc: string;
      avatarName: string;
      displayName: string;
    };
  }
  | {
    type: 'assistant-group';
    participantKey: string;
    messages: {
      message: UIMessage;
      index: number;
      participantInfo: ParticipantInfo;
    }[];
    headerInfo: {
      avatarSrc: string;
      avatarName: string;
      avatarNode?: React.ReactNode;
      displayName: string;
      role: string | null;
      requiredTierName?: string;
      isAccessible: boolean;
    };
  };

type ParticipantMessageWrapperProps = {
  participant?: ApiParticipant;
  participantIndex: number;
  model: Model | undefined;
  status: MessageStatus;
  parts: MessagePart[];
  isAccessible: boolean;
  messageId?: string;
  metadata?: DbMessageMetadata | null;
  /** Custom loading text for pending state */
  loadingText?: string;
  /** Max height for scrollable content */
  maxContentHeight?: number;
  /** Override avatar (for moderator) */
  avatarSrc?: string;
  /** Override avatar name (for moderator) */
  avatarName?: string;
  /** Override avatar with a React node (for moderator orb) */
  avatarNode?: React.ReactNode;
  /** Override display name (for moderator) */
  displayName?: string;
  /** Hide action buttons (for moderator where council actions handle it) */
  hideActions?: boolean;
  /**
   * Fallback sources from other participants in the round
   * Used during streaming when this participant's metadata isn't populated yet
   */
  groupAvailableSources?: AvailableSource[];
  /** Skip opacity transitions for SSR/read-only pages to prevent hydration delay */
  skipTransitions?: boolean;
};

const ParticipantMessageWrapper = memo(({
  avatarName: avatarNameOverride,
  avatarNode,
  avatarSrc: avatarSrcOverride,
  displayName: displayNameOverride,
  groupAvailableSources,
  hideActions = false,
  isAccessible,
  loadingText,
  maxContentHeight,
  messageId,
  metadata,
  model,
  participant,
  participantIndex,
  parts,
  skipTransitions = false,
  status,
}: ParticipantMessageWrapperProps) => {
  const assistantMetadata = metadata && isAssistantMessageMetadata(metadata) ? metadata : null;

  // ✅ FIX: Use getModelFast for streaming-safe model extraction
  // Streaming placeholders may not pass full DbAssistantMessageMetadataSchema validation
  // because they're missing fields like finishReason and usage during streaming.
  // getModelFast extracts model with minimal Zod validation that handles partial metadata.
  const metadataModelId = getModelFast(metadata);

  // Fallback to raw participantRole extraction for streaming placeholders
  const rawParticipantRole = getParticipantRole(metadata);

  // Prioritize stored metadata for avatar derivation, then fall back to participant/model props.
  // ParticipantMessageWrapper is only used during streaming (pending cards + moderator),
  // so participant and model props are always from the current round and safe to use as fallback.
  // Streaming placeholder metadata fails strict Zod validation (has isStreaming, missing finishReason/usage),
  // so metadataModelId is often null during streaming — participant.modelId and model.id fill the gap.
  const effectiveModelId = metadataModelId || participant?.modelId || model?.id;
  const effectiveRole = assistantMetadata?.participantRole ?? rawParticipantRole ?? participant?.role ?? null;

  const defaultAvatarProps = effectiveModelId
    ? getAvatarPropsFromModelId(MessageRoles.ASSISTANT, effectiveModelId, null, 'AI')
    : { name: 'AI', src: '' };

  const avatarSrc = avatarSrcOverride ?? defaultAvatarProps.src;
  const avatarName = avatarNameOverride ?? defaultAvatarProps.name;
  const displayName = displayNameOverride ?? model?.name ?? effectiveModelId ?? 'AI Assistant';
  const isStreaming = status === MessageStatuses.STREAMING || status === MessageStatuses.PENDING;
  const hasError = status === MessageStatuses.FAILED || assistantMetadata?.hasError;

  return (
    <div className="flex justify-start min-w-0">
      <div className="w-full min-w-0">
        <ParticipantHeader
          avatarSrc={avatarSrc}
          avatarNode={avatarNode}
          avatarName={avatarName}
          displayName={displayName}
          role={effectiveRole}
          requiredTierName={model?.required_tier_name ?? undefined}
          isAccessible={isAccessible}
          isStreaming={isStreaming}
          hasError={!!hasError}
        />
        <ModelMessageCard
          messageId={messageId}
          model={model}
          role={effectiveRole}
          participantIndex={participantIndex}
          status={status}
          parts={parts}
          avatarSrc={avatarSrc}
          avatarName={avatarName}
          metadata={metadata}
          isAccessible={isAccessible}
          hideInlineHeader
          hideAvatar
          hideActions={hideActions}
          loadingText={loadingText}
          maxContentHeight={maxContentHeight}
          groupAvailableSources={groupAvailableSources}
          skipTransitions={skipTransitions}
        />
      </div>
    </div>
  );
});

type AssistantGroupCardProps = {
  demoMode: boolean;
  findModel: (modelId?: string) => Model | undefined;
  group: Extract<MessageGroup, { type: 'assistant-group' }>;
  groupIndex: number;
  hideMetadata: boolean;
  isReadOnly?: boolean;
  keyForMessage: (message: UIMessage, index: number) => string;
  maxContentHeight?: number;
  roundAvailableSources?: AvailableSource[];
  skipTransitions?: boolean;
  t: (key: string) => string;
};

const AssistantGroupCard = memo(({
  demoMode,
  findModel,
  group,
  groupIndex: _groupIndex,
  hideMetadata,
  isReadOnly = false,
  keyForMessage,
  maxContentHeight,
  roundAvailableSources,
  skipTransitions = false,
  t,
}: AssistantGroupCardProps) => {
  // ✅ PERF FIX: Single-pass group analysis replaces two separate .some() scans
  const { hasErrorMessage, hasStreamingMessage } = useMemo(() => {
    let streaming = false;
    let error = false;
    for (const { message, participantInfo } of group.messages) {
      if (participantInfo.isStreaming) {
        streaming = true;
      }
      if (!error) {
        const metadata = getMessageMetadata(message.metadata);
        const assistantMetadata = metadata && isAssistantMessageMetadata(metadata) ? metadata : null;
        if (assistantMetadata?.hasError) {
          error = true;
        }
      }
      if (streaming && error) {
        break;
      }
    }
    return { hasErrorMessage: error, hasStreamingMessage: streaming };
  }, [group.messages]);

  // ✅ PERF: Replaced ~50-line inline source merging with extracted helper
  const groupAvailableSources = useMemo((): AvailableSource[] | undefined => {
    const allSources = new Map<string, AvailableSource>();
    for (const { message } of group.messages) {
      const availableSourcesFromMsg = getAvailableSources(message.metadata);
      if (availableSourcesFromMsg) {
        for (const source of availableSourcesFromMsg) {
          if (source.id && !allSources.has(source.id) && isAvailableSource(source)) {
            allSources.set(source.id, source);
          }
        }
      }
    }
    // Merge round-level sources (from streaming), preferring more complete data
    if (roundAvailableSources) {
      for (const source of roundAvailableSources) {
        mergeSourceIntoMap(allSources, source);
      }
    }
    return allSources.size > 0 ? Array.from(allSources.values()) : undefined;
  }, [group.messages, roundAvailableSources]);

  return (
    <div
      key={`assistant-group-${group.participantKey}-${group.messages[0]?.index}`}
      className="flex justify-start min-w-0"
    >
      <div className="w-full min-w-0">
        <ParticipantHeader
          avatarSrc={group.headerInfo.avatarSrc}
          avatarNode={group.headerInfo.avatarNode}
          avatarName={group.headerInfo.avatarName}
          displayName={group.headerInfo.displayName}
          role={group.headerInfo.role}
          requiredTierName={group.headerInfo.requiredTierName}
          isAccessible={group.headerInfo.isAccessible}
          isStreaming={hasStreamingMessage}
          hasError={hasErrorMessage}
        />
        {/* Message content */}
        <div className="space-y-4">
          {group.messages.map(({ index, message, participantInfo }) => {
            const messageKey = keyForMessage(message, index);
            const metadata = getMessageMetadata(message.metadata);
            const model = findModel(participantInfo.modelId);
            const isAccessible = demoMode || (model?.is_accessible_to_user ?? true);

            // ✅ PERF FIX: Single-pass part analysis replaces 3 .some() + 2 .filter() scans per message.
            // Previously O(5n) per message inside .map() → O(5n*m) for group. Now O(n) per message.
            const safeParts = message.parts || [];
            const isModerator = participantInfo.participantIndex === MODERATOR_PARTICIPANT_INDEX;
            let hasTextContent = false;
            let hasToolCalls = false;
            const filteredParts: MessagePart[] = [];
            const sourceParts: typeof safeParts = [];
            for (const p of safeParts) {
              if (!p) {
                continue;
              }
              // Content checks (replaces two .some() calls)
              if (!hasTextContent && (p.type === MessagePartTypes.TEXT || p.type === MessagePartTypes.REASONING) && p.text?.trim().length > 0) {
                hasTextContent = true;
              }
              if (!hasToolCalls && p.type === MessagePartTypes.TOOL_CALL) {
                hasToolCalls = true;
              }
              // Renderable parts filter (replaces .filter() for MessagePart[])
              // Hide moderator reasoning from UI — streamed for processing but not displayed
              if (p.type === MessagePartTypes.TEXT
                || (p.type === MessagePartTypes.REASONING && !isModerator)
                || p.type === MessagePartTypes.TOOL_CALL
                || p.type === MessagePartTypes.TOOL_RESULT) {
                if (isMessagePart(p)) {
                  filteredParts.push(p);
                }
              }
              // Source parts filter (replaces .filter() for source parts)
              if ('type' in p && (p.type === MessagePartTypes.SOURCE_URL || p.type === MessagePartTypes.SOURCE_DOCUMENT)) {
                sourceParts.push(p);
              }
            }
            const hasAnyContent = hasTextContent || hasToolCalls;

            const messageStatus: MessageStatus = getMessageStatus({
              hasAnyContent,
              isStreaming: participantInfo.isStreaming,
              message,
            });

            return (
              <div key={messageKey} className="empty:hidden">
                <ModelMessageCard
                  messageId={message.id}
                  model={model}
                  role={participantInfo.role || ''}
                  participantIndex={participantInfo.participantIndex ?? 0}
                  status={messageStatus}
                  parts={filteredParts}
                  avatarSrc={group.headerInfo.avatarSrc}
                  avatarName={group.headerInfo.avatarName}
                  metadata={hideMetadata ? null : (metadata ?? null)}
                  isAccessible={isAccessible}
                  hideInlineHeader
                  hideAvatar
                  hideActions={isModerator || demoMode || isReadOnly}
                  maxContentHeight={maxContentHeight}
                  loadingText={isModerator ? t('chat.participant.moderatorObserving') : undefined}
                  groupAvailableSources={groupAvailableSources}
                  skipTransitions={skipTransitions}
                />
                {sourceParts.length > 0 && (
                  <div className="mt-2 ml-12 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{t('chat.sources.title')}</p>
                    <div className="space-y-1">
                      {sourceParts.map((sourcePart) => {
                        if ('type' in sourcePart && sourcePart.type === MessagePartTypes.SOURCE_URL && 'url' in sourcePart && typeof sourcePart.url === 'string') {
                          return (
                            <div key={`${message.id}-source-${sourcePart.url}`} className="text-xs">
                              <a
                                href={sourcePart.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <span>{('title' in sourcePart && typeof sourcePart.title === 'string' ? sourcePart.title : null) || sourcePart.url}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

function getParticipantInfoForMessage({
  currentParticipantIndex,
  currentStreamingParticipant,
  isGlobalStreaming,
  isModeratorStreaming = false,
  message,
  messageIndex,
  participants,
  participantSnapshotsByRound,
  totalMessages,
}: {
  message: UIMessage;
  messageIndex: number;
  totalMessages: number;
  isGlobalStreaming: boolean;
  currentParticipantIndex: number;
  participants: ApiParticipant[];
  currentStreamingParticipant: ApiParticipant | null;
  isModeratorStreaming?: boolean;
  /** Participant snapshots per round - used for fallback to prevent identity corruption */
  participantSnapshotsByRound?: Map<number, Array<{ modelId: string; role?: string | null }>> | null;
}): {
  participantIndex: number;
  modelId: string | undefined;
  role: string | null;
  isStreaming: boolean;
} {
  const metadata = getMessageMetadata(message.metadata);
  const assistantMetadata = metadata && isAssistantMessageMetadata(metadata) ? metadata : null;

  // ✅ FIX: Extract raw metadata fields directly (O(1))
  // Messages store model/participantIndex/role in metadata even when Zod validation fails.
  // This prevents fallback to current participants array for completed rounds.
  const rawModel = getModel(message.metadata) ?? undefined;
  const rawParticipantIndex = getParticipantIndex(message.metadata) ?? undefined;
  const rawParticipantRole = getParticipantRole(message.metadata);

  const hasVisibleContent = message.parts?.some(
    p =>
      (p.type === MessagePartTypes.TEXT && 'text' in p && typeof p.text === 'string' && p.text.trim().length > 0)
      || p.type === MessagePartTypes.TOOL_CALL
      || p.type === MessagePartTypes.REASONING,
  ) ?? false;

  const isModerator = isModeratorMessage(message);

  // Check if metadata explicitly marks streaming as complete
  // This handles models that return non-standard finishReason values like 'unknown'
  // The metadata.isStreaming flag is set to false by AI SDK when the stream closes
  const metadataMarkedComplete = isStreamingMarkedComplete(message.metadata);

  if (hasVisibleContent) {
    // ✅ FIX: Use message's stored participantIndex, not current streaming index
    const storedParticipantIndex = assistantMetadata?.participantIndex ?? rawParticipantIndex ?? currentParticipantIndex;
    const finishReason = assistantMetadata?.finishReason;
    const hasActuallyFinished = isCompletionFinishReason(finishReason);

    const isComplete = hasActuallyFinished || metadataMarkedComplete;

    // FIX: For moderator messages, also respect the isModeratorStreaming flag
    // Previously, once moderator had visible content, it would show as complete
    // even while still streaming (isModeratorStreaming=true, metadata.isStreaming not yet false)
    const isStillStreaming = isModerator
      ? (isModeratorStreaming && !isComplete)
      : !isComplete;

    // ✅ RACE FIX: Use per-round participant snapshot for fallback instead of current participants
    // The current participants array may have been updated for a NEW round, causing old messages
    // to display wrong participant icons/names. Only fall back for STREAMING messages.
    const metadataModelId = assistantMetadata?.model || rawModel;

    // Get round number from message metadata to find the correct snapshot
    const messageRoundNumber = assistantMetadata?.roundNumber
      ?? getRoundNumber(message.metadata) ?? undefined;

    // ✅ RACE FIX: Use snapshot from the message's round, not current participants
    // ALWAYS use snapshot as fallback (for BOTH streaming AND completed messages)
    // Previously only streaming messages used the snapshot, causing completed messages
    // to show wrong icons when participants changed between rounds.
    let fallbackParticipant: { modelId?: string; role?: string | null } | undefined;
    if (storedParticipantIndex >= 0) {
      // Try per-round snapshot first (immutable, safe for completed rounds)
      const roundSnapshot = messageRoundNumber !== undefined
        ? participantSnapshotsByRound?.get(messageRoundNumber)
        : undefined;

      if (roundSnapshot) {
        // ✅ SAFE: Use immutable snapshot - can't be corrupted by participant changes
        fallbackParticipant = roundSnapshot[storedParticipantIndex];
      } else if (isComplete && messageRoundNumber !== undefined) {
        // ⚠️ COMPLETED message with NO snapshot - use metadata as identity source (immutable)
        // instead of live participants array which may have changed for a new round.
        // Only fall back to live participants if metadata has no model info at all.
        if (metadataModelId) {
          // Metadata has model - use it as authoritative source, skip live participants
          fallbackParticipant = { modelId: metadataModelId, role: assistantMetadata?.participantRole || rawParticipantRole };
        } else {
          fallbackParticipant = participants[storedParticipantIndex];
        }
      } else {
        // Streaming message without snapshot - use live participants
        fallbackParticipant = participants[storedParticipantIndex];
      }
    }

    const resolvedModelId = metadataModelId || fallbackParticipant?.modelId;

    // ✅ RACE FIX: For roles, also use snapshot for fallback (for both streaming and completed)
    const fallbackRole = fallbackParticipant?.role;
    const resolvedRole = assistantMetadata?.participantRole || rawParticipantRole || fallbackRole || null;

    return {
      isStreaming: isStillStreaming,
      // ✅ FIX: Prioritize stored metadata over current participants array
      modelId: resolvedModelId,
      participantIndex: isModerator ? MODERATOR_PARTICIPANT_INDEX : storedParticipantIndex,
      role: resolvedRole,
    };
  }

  const isLastMessage = messageIndex === totalMessages - 1;

  // FIX: Only treat as streaming if metadata.isStreaming is NOT explicitly false
  // Previously this ignored metadata, causing pulsating dot to persist after finalization
  const isThisMessageStreaming = !hasVisibleContent
    && isGlobalStreaming
    && isLastMessage
    && message.role === MessageRoles.ASSISTANT
    && !metadataMarkedComplete;

  if (isThisMessageStreaming) {
    // ✅ RACE CONDITION FIX: Prioritize message metadata over participants array
    // The participants array may be stale (blocked from updating during streaming),
    // but the message metadata (rawModel) has the correct modelId from placeholder creation.
    const participant = participants[currentParticipantIndex] || currentStreamingParticipant;
    return {
      isStreaming: true,
      modelId: assistantMetadata?.model || rawModel || participant?.modelId,
      participantIndex: currentParticipantIndex,
      role: assistantMetadata?.participantRole || rawParticipantRole || participant?.role || null,
    };
  }

  // FIX: Also respect metadata.isStreaming for moderator (same fix as participants)
  if (isModerator && isModeratorStreaming && !hasVisibleContent && !metadataMarkedComplete) {
    return {
      isStreaming: true,
      modelId: assistantMetadata?.model || rawModel,
      participantIndex: MODERATOR_PARTICIPANT_INDEX,
      role: null,
    };
  }

  // ✅ FIX: Use stored participantIndex, prioritize metadata over current participants
  const storedParticipantIndex = assistantMetadata?.participantIndex ?? rawParticipantIndex ?? currentParticipantIndex;

  // ✅ RACE FIX: Use per-round participant snapshot for fallback instead of current participants
  // For non-streaming messages without content, only use fallback if metadata is truly missing.
  // The metadataMarkedComplete flag tells us if this is a finalized message from a previous round.
  const metadataModelId = assistantMetadata?.model || rawModel;

  // Get round number from message metadata to find the correct snapshot
  const messageRoundNumber = assistantMetadata?.roundNumber
    ?? getRoundNumber(message.metadata) ?? undefined;

  // ✅ RACE FIX: Use snapshot from the message's round, not current participants
  // ALWAYS use snapshot as fallback (for BOTH streaming AND completed messages)
  let fallbackParticipant: { modelId?: string; role?: string | null } | undefined;
  if (storedParticipantIndex >= 0) {
    const roundSnapshot = messageRoundNumber !== undefined
      ? participantSnapshotsByRound?.get(messageRoundNumber)
      : undefined;

    if (roundSnapshot) {
      fallbackParticipant = roundSnapshot[storedParticipantIndex];
    } else if (metadataMarkedComplete && messageRoundNumber !== undefined) {
      // ⚠️ COMPLETED message with NO snapshot - prefer metadata over live participants
      if (metadataModelId) {
        fallbackParticipant = { modelId: metadataModelId, role: assistantMetadata?.participantRole || rawParticipantRole };
      } else {
        fallbackParticipant = participants[storedParticipantIndex];
      }
    } else {
      fallbackParticipant = participants[storedParticipantIndex];
    }
  }

  const resolvedModelId = metadataModelId || fallbackParticipant?.modelId;

  // ✅ RACE FIX: For roles, also use snapshot for fallback (for both streaming and completed)
  const fallbackRole = fallbackParticipant?.role;

  return {
    isStreaming: false,
    // ✅ FIX: Prioritize stored metadata over current participants array
    modelId: resolvedModelId,
    participantIndex: storedParticipantIndex,
    role: assistantMetadata?.participantRole || rawParticipantRole || fallbackRole || null,
  };
}

const EMPTY_COMPLETED_ROUNDS = new Set<number>();

type ChatMessageListProps = {
  messages: UIMessage[];
  user?: {
    name: string;
    image: string | null;
  } | null;
  participants?: ApiParticipant[];
  hideMetadata?: boolean;
  isLoading?: boolean;
  isStreaming?: boolean;
  currentStreamingParticipant?: ApiParticipant | null;
  currentParticipantIndex?: number;
  userAvatar?: { src: string; name: string };
  threadId?: string | null; // Optional threadId for pre-search hydration
  preSearches?: StoredPreSearch[]; // Pre-searches from store
  streamingRoundNumber?: number | null; // Pass through from ThreadTimeline
  /** Max height for scrollable content in message cards. Used in demo mode. */
  maxContentHeight?: number;
  /** Skip all entrance animations (for demo that has already completed) */
  skipEntranceAnimations?: boolean;
  /**
   * ✅ BUG FIX: Set of round numbers that have complete summaries.
   * Rounds in this set should NEVER show pending cards.
   */
  completedRoundNumbers?: Set<number>;
  /**
   * ✅ MODERATOR FLAG: Indicates moderator is currently streaming.
   * Used to block input during moderator streaming.
   * Moderator message now renders via normal message flow (added to messages array).
   */
  isModeratorStreaming?: boolean;
  /**
   * Current round number for this message list instance.
   */
  roundNumber?: number;
  /**
   * Demo mode - forces all models to be accessible (hides tier badges).
   */
  demoMode?: boolean;
  /**
   * Read-only mode - skips models API call. Used for public/shared threads.
   */
  isReadOnly?: boolean;
};
export const ChatMessageList = memo(
  ({
    completedRoundNumbers = EMPTY_COMPLETED_ROUNDS,
    currentParticipantIndex = 0,
    currentStreamingParticipant = null,
    demoMode = false,
    hideMetadata = false,
    isLoading: _isLoading = false,
    isModeratorStreaming = false,
    isReadOnly = false,
    isStreaming = false,
    maxContentHeight,
    messages,
    participants = EMPTY_PARTICIPANTS,
    preSearches: _preSearches = EMPTY_PRE_SEARCHES,
    roundNumber: _roundNumber,
    skipEntranceAnimations = false,
    streamingRoundNumber: _streamingRoundNumber = null,
    threadId: _threadId,
    user = null,
    userAvatar,
  }: ChatMessageListProps) => {
    const t = useTranslations();
    const { findModel } = useModelLookup({ enabled: !isReadOnly });
    const { dismiss: dismissMemory, notification: memoryNotification, undo: undoMemory } = useMemoryNotification();
    const userInfo = useMemo(() => user || { image: null, name: 'User' }, [user]);
    const userAvatarSrc = userAvatar?.src || userInfo.image || '';
    const userAvatarName = userAvatar?.name || userInfo.name;

    // ✅ STREAMING CITATIONS: Get available sources from artifact hook during streaming
    // During initial streaming, message metadata doesn't have availableSources yet.
    // The backend sends sources via the available-sources artifact at streaming start.
    // This enables proper citation display (e.g., actual filenames) during streaming.
    //
    // ✅ CITATION PERSISTENCE FIX: Retain the last known sources map after streaming ends.
    // When streaming completes, _streamingRoundNumber becomes null (phase -> COMPLETE),
    // but the AI SDK in-memory messages may not yet have availableSources in their metadata
    // (that only appears after a page refresh loads messages from D1). The ref keeps
    // the last sources map alive so collectRoundAvailableSources / collectCompletedRoundSources
    // can still use them as Layer 3 until the next streaming round begins.
    const { sources: artifactSources } = useAvailableSourcesArtifact();
    const lastStreamingSourcesRef = useRef<Map<number, typeof artifactSources> | null>(null);
    const lastStreamingThreadRef = useRef<string | null | undefined>(null);

    // Clear cached sources when navigating to a different thread
    if (_threadId !== lastStreamingThreadRef.current) {
      lastStreamingThreadRef.current = _threadId;
      lastStreamingSourcesRef.current = null;
    }

    const streamingAvailableSources = useMemo(() => {
      // Active streaming: build fresh map and cache it
      if (artifactSources.length > 0 && _streamingRoundNumber !== null && _streamingRoundNumber !== undefined) {
        const fresh = new Map([[_streamingRoundNumber, artifactSources]]);
        lastStreamingSourcesRef.current = fresh;
        return fresh;
      }
      // Streaming ended but sources existed: return cached map so citations survive
      // the gap between "streaming ends" and "D1 messages are refetched"
      if (_streamingRoundNumber === null || _streamingRoundNumber === undefined) {
        return lastStreamingSourcesRef.current;
      }
      return null;
    }, [artifactSources, _streamingRoundNumber]);

    // ✅ RACE FIX: Get participant snapshots per round to prevent identity corruption
    // When participants change between rounds, old messages should use the snapshot from their round,
    // not the current participants array which may have new models.
    const participantSnapshotsByRound = useChatStoreOptional(s => s.participantSnapshotsByRound);

    // Error state for retry button — sourced from AI SDK (single source of truth)
    const chatError = useChatErrorOptional();
    const retryLastRound = useChatStoreOptional(s => s.retryLastRound);

    // Track previous render state to only log on meaningful changes
    const prevRenderStateRef = useRef<{ msgCount: number; partCount: number }>({ msgCount: -1, partCount: -1 });

    // Debug logging for message list render - only log for current streaming round or when props change
    // This prevents old round ChatMessageList components from spamming logs
    const isCurrentStreamingRound = _streamingRoundNumber !== null && _roundNumber === _streamingRoundNumber;
    const renderStateChanged = messages.length !== prevRenderStateRef.current.msgCount
      || participants.length !== prevRenderStateRef.current.partCount;

    if (isCurrentStreamingRound || renderStateChanged) {
      prevRenderStateRef.current = { msgCount: messages.length, partCount: participants.length };
    }

    // ✅ POST-MODERATOR FLASH FIX: Track rounds that were visible during streaming
    // When content transitions from pending cards to messageGroups, we must skip
    // entrance animations because the content was already visible.
    // Track which rounds have been rendered (their content was visible to user)
    const renderedRoundsRef = useRef<Set<number>>(new Set());

    // Mark current streaming round as "rendered" (content is visible via pending cards)
    if (_streamingRoundNumber !== null) {
      renderedRoundsRef.current.add(_streamingRoundNumber);
    }

    // ✅ ANIMATION: Using whileInView for scroll-triggered animations
    // The viewport={{ once: true }} in motion components handles "don't re-animate"
    // So we always return true here unless explicitly disabled
    //
    // ✅ OPTIMISTIC MESSAGE FIX: Skip animation for optimistic user messages
    // Optimistic messages are added when user submits a new round. Since there's
    // no auto-scroll (by design), the new message may be outside the viewport.
    // whileInView animation wouldn't trigger, leaving the message at opacity:0.
    // By skipping animation for optimistic messages, they appear immediately.
    //
    // ✅ PERF: useCallback to prevent recreation on every render
    const shouldAnimateMessage = useCallback((messageId: string): boolean => {
      // Skip all animations when explicitly requested (e.g., demo already completed)
      if (skipEntranceAnimations) {
        return false;
      }
      // ✅ FIX: Skip animation for optimistic messages (appear immediately)
      // Optimistic messages have IDs starting with 'optimistic-'
      // These are user messages just submitted - they should be visible immediately
      if (messageId.startsWith('optimistic-')) {
        return false;
      }
      // Always animate - whileInView with once:true handles scroll trigger
      return true;
    }, [skipEntranceAnimations]);

    // PERF: Structural fingerprint for dedup cache - only re-run sort/dedup when message IDs change
    // During streaming, message text changes but IDs stay the same. The sort is O(n log n) and
    // was running ~30x/sec. This fingerprint makes it run only when messages are added/removed.
    // ✅ PERF: Structural fingerprint for dedup cache - only re-run sort/dedup when message IDs change
    // Uses a simple numeric hash instead of string concatenation to avoid O(n) string allocation.
    // Hash changes when any message ID changes, messages are added/removed/reordered.
    const dedupFingerprint = useMemo(() => {
      let hash = messages.length;
      for (let i = 0; i < messages.length; i++) {
        const id = messages[i]?.id;
        if (id) {
          // djb2-style hash: fast, low collision for short strings
          for (let j = 0; j < id.length; j++) {
            hash = ((hash << 5) + hash + id.charCodeAt(j)) | 0;
          }
        }
      }
      return hash;
    }, [messages]);

    const lastDedupRef = useRef<{ fingerprint: number; result: UIMessage[] }>({
      fingerprint: 0,
      result: [],
    });

    // Deduplication: Prevent duplicate message IDs, filter participant triggers, deduplicate by (roundNumber, participantIndex/modelId)
    const deduplicatedMessages = useMemo(() => {
      // PERF: Skip full sort/dedup if only text content changed (same message IDs)
      if (dedupFingerprint === lastDedupRef.current.fingerprint && lastDedupRef.current.result.length > 0) {
        // Update message references to pick up new text content without re-sorting.
        // Clone first to avoid mutating the previous memoized result in place.
        const prevResult = lastDedupRef.current.result;
        const msgById = new Map<string, UIMessage>();
        for (const m of messages) {
          msgById.set(m.id, m);
        }
        // Track whether any message objects actually changed (new content from streaming)
        let hasContentUpdates = false;
        for (let i = 0; i < prevResult.length; i++) {
          const prev = prevResult[i];
          if (!prev) {
            continue;
          }
          const updated = msgById.get(prev.id);
          if (updated && updated !== prev) {
            hasContentUpdates = true;
            break;
          }
        }
        // CRITICAL FIX: Return new array ref when content changed so downstream memos re-run.
        // Sort/dedup is still skipped (O(n log n) saved), only the array wrapper changes.
        if (hasContentUpdates) {
          // Build new array with updated references (no in-place mutation of prevResult)
          const updatedResult = prevResult.map((prev) => {
            if (!prev) {
              return prev;
            }
            return msgById.get(prev.id) ?? prev;
          });
          lastDedupRef.current = { fingerprint: dedupFingerprint, result: updatedResult };
          return updatedResult;
        }
        return prevResult;
      }

      const seenMessageIds = new Set<string>();
      const assistantKeyToIdx = new Map<string, number>();
      const moderatorRoundToIdx = new Map<number, number>();
      const userRoundToIdx = new Map<number, number>();
      const result: UIMessage[] = [];

      for (const message of messages) {
        if (seenMessageIds.has(message.id)) {
          continue;
        }

        if (message.role === MessageRoles.USER) {
          const userMeta = getUserMetadata(message.metadata);
          const isParticipantTrigger = userMeta?.isParticipantTrigger === true;

          if (isParticipantTrigger) {
            continue;
          }
          const roundNum = userMeta?.roundNumber;
          if (roundNum !== undefined && roundNum !== null) {
            const existingIdx = userRoundToIdx.get(roundNum);
            if (existingIdx !== undefined) {
              // ✅ FIX: Also prefer messages WITH file parts over text-only duplicates
              // This handles AI SDK creating duplicate user messages with random IDs
              const existingMsg = result[existingIdx];
              const existingHasFiles = existingMsg?.parts?.some(p => p.type === 'file');
              const currentHasFiles = message.parts?.some(p => p.type === 'file');

              // Prefer deterministic IDs over optimistic IDs
              const isDeterministicId = message.id.includes('_r') && message.id.includes('_user');
              const isOptimistic = message.id.startsWith('optimistic-');
              if (isOptimistic) {
                // This is an optimistic message, skip it in favor of the DB message
                continue;
              }
              if (isDeterministicId) {
                // This is a deterministic DB message - replace the optimistic message via O(1) lookup
                result[existingIdx] = message;
                seenMessageIds.add(message.id);
                continue;
              }
              // ✅ FIX: If current has files but existing doesn't, replace
              // This ensures file attachments are preserved even with random IDs
              if (currentHasFiles && !existingHasFiles) {
                result[existingIdx] = message;
                seenMessageIds.add(message.id);
                continue;
              }
              // Skip this duplicate (existing has files or neither has files)
              continue;
            }
            userRoundToIdx.set(roundNum, result.length); // Track index before push
          }

          seenMessageIds.add(message.id);
          result.push(message);
        } else {
          // ✅ BUG FIX: Check if this is a moderator message FIRST
          // Moderator messages use different deduplication logic (by round only)
          const isModerator = isModeratorMessage(message);

          if (isModerator) {
            const roundNum = getRoundNumber(message.metadata);

            // ✅ PERF FIX: Use Map for O(1) lookup instead of O(n) findIndex
            if (roundNum !== null) {
              const existingIdx = moderatorRoundToIdx.get(roundNum);
              if (existingIdx !== undefined) {
                // Prefer deterministic IDs over temp IDs
                const isDeterministicId = message.id.includes('_r') && message.id.includes('_moderator');
                if (!isDeterministicId) {
                  // This is a temp ID message, skip it in favor of the DB message
                  continue;
                }
                // This is a deterministic ID message - replace via O(1) lookup
                result[existingIdx] = message;
                seenMessageIds.add(message.id);
                continue;
              }
              moderatorRoundToIdx.set(roundNum, result.length); // Track index before push
            }
            seenMessageIds.add(message.id);
            result.push(message);
            continue;
          }

          // For assistant messages (participants only, not moderator), deduplicate by (roundNumber, participantIndex OR modelId)
          // This handles the case where resumed streams create messages with different IDs
          const meta = getMessageMetadata(message.metadata);
          const assistantMeta = meta && isAssistantMessageMetadata(meta) ? meta : null;

          if (assistantMeta) {
            const roundNum = assistantMeta.roundNumber;
            const participantIdx = assistantMeta.participantIndex;
            const participantId = assistantMeta.participantId;
            const modelId = assistantMeta.model;

            // Create a unique key for this participant's response in this round.
            // CRITICAL: Use participantIndex first (not participantId) because streaming
            // placeholders only have participantIndex in metadata. Server messages have both.
            // Using participantId first caused different dedup keys for the same participant
            // (r0_pid{uuid} vs r0_p0), allowing duplicates to survive dedup.
            let dedupeKey: string | null = null;
            if (roundNum !== undefined && roundNum !== null) {
              if (participantIdx !== undefined && participantIdx !== null) {
                dedupeKey = `r${roundNum}_p${participantIdx}`;
              } else if (participantId) {
                dedupeKey = `r${roundNum}_pid${participantId}`;
              } else if (modelId) {
                dedupeKey = `r${roundNum}_m${modelId}`;
              }
            }

            // ✅ PERF FIX: Use Map for O(1) lookup instead of O(n) findIndex
            if (dedupeKey) {
              const existingIdx = assistantKeyToIdx.get(dedupeKey);
              if (existingIdx !== undefined) {
                // ✅ PREFER: Keep the message with the deterministic ID (contains _r{N}_p{M})
                // and skip the temp ID message (gen-xxxxx)
                const isDeterministicId = message.id.includes('_r') && message.id.includes('_p');
                if (!isDeterministicId) {
                  // This is a temp ID message, skip it in favor of the DB message
                  continue;
                }
                // This is a deterministic ID message - replace via O(1) lookup
                result[existingIdx] = message;
                seenMessageIds.add(message.id);
                continue;
              }
              assistantKeyToIdx.set(dedupeKey, result.length); // Track index before push
            }
          } else if (message.metadata && typeof message.metadata === 'object') {
            // Fallback dedup for streaming placeholders whose metadata fails
            // full Zod validation (missing finishReason, usage, etc.).
            // Without this, placeholders pass through without round+participant dedup,
            // causing duplicates when initializeThread merges placeholders with server messages.
            const roundNum = getRoundNumber(message.metadata) ?? undefined;
            const participantIdx = getParticipantIndex(message.metadata) ?? undefined;
            const participantId = getParticipantId(message.metadata) ?? undefined;
            const modelId = getModelFast(message.metadata) ?? undefined;

            // CRITICAL: Use same key priority as primary dedup path above:
            // participantIndex first, then participantId, then modelId.
            // Inconsistent ordering creates different keys for the same participant,
            // allowing duplicates through.
            let dedupeKey: string | null = null;
            if (roundNum !== undefined) {
              if (participantIdx !== undefined) {
                dedupeKey = `r${roundNum}_p${participantIdx}`;
              } else if (participantId) {
                dedupeKey = `r${roundNum}_pid${participantId}`;
              } else if (modelId) {
                dedupeKey = `r${roundNum}_m${modelId}`;
              }
            }

            if (dedupeKey) {
              const existingIdx = assistantKeyToIdx.get(dedupeKey);
              if (existingIdx !== undefined) {
                // Streaming placeholders have deterministic IDs (streaming_p{N}_r{M})
                const isDeterministicId = message.id.includes('_r') && message.id.includes('_p');
                if (!isDeterministicId) {
                  continue;
                }
                result[existingIdx] = message;
                seenMessageIds.add(message.id);
                continue;
              }
              assistantKeyToIdx.set(dedupeKey, result.length);
            }
          }

          seenMessageIds.add(message.id);
          result.push(message);
        }
      }

      // =========================================================================
      // SORT MESSAGES: Ensure correct order within each round
      // Order: user → participants (by participantIndex ascending) → moderator
      // =========================================================================
      result.sort((a, b) => {
        // 1. Get round numbers (user messages use their own round, assistant messages have roundNumber in metadata)
        const aRound = a.role === MessageRoles.USER
          ? getUserMetadata(a.metadata)?.roundNumber ?? 0
          : getRoundNumber(a.metadata) ?? 0;
        const bRound = b.role === MessageRoles.USER
          ? getUserMetadata(b.metadata)?.roundNumber ?? 0
          : getRoundNumber(b.metadata) ?? 0;

        // Sort by round first
        if (aRound !== bRound) {
          return aRound - bRound;
        }

        // 2. Within same round: user messages come first
        if (a.role === MessageRoles.USER && b.role !== MessageRoles.USER) {
          return -1;
        }
        if (a.role !== MessageRoles.USER && b.role === MessageRoles.USER) {
          return 1;
        }
        if (a.role === MessageRoles.USER && b.role === MessageRoles.USER) {
          return 0; // Both user messages in same round - maintain order
        }

        // 3. Both are assistant messages - sort by participantIndex
        // MODERATOR must ALWAYS come LAST (after all participants)
        //
        // ✅ FIX: Use isModeratorMessage() for reliable detection instead of
        // relying on getParticipantIndex() which returns null for moderators
        // (since moderator uses -99 which fails the .nonnegative() validation)
        const aIsModerator = isModeratorMessage(a) || isModeratorMetadataFast(a.metadata);
        const bIsModerator = isModeratorMessage(b) || isModeratorMetadataFast(b.metadata);

        // Moderator always last (regardless of participantIndex parsing)
        if (aIsModerator && !bIsModerator) {
          return 1;
        }
        if (!aIsModerator && bIsModerator) {
          return -1;
        }
        if (aIsModerator && bIsModerator) {
          return 0; // Both moderators - maintain order
        }

        // Both are participants - sort by participantIndex ascending
        const aIdx = getParticipantIndex(a.metadata) ?? 0;
        const bIdx = getParticipantIndex(b.metadata) ?? 0;
        return aIdx - bIdx;
      });

      lastDedupRef.current = { fingerprint: dedupFingerprint, result };
      return result;
    }, [messages, dedupFingerprint]);

    // ✅ PERF: Pre-compute message keys in useMemo to avoid mutation during render
    // and prevent recreating the function on every render
    const messageKeyMap = useMemo(() => {
      const seenIds = new Set<string>();
      const keyMap = new Map<string, string>();
      for (let i = 0; i < deduplicatedMessages.length; i++) {
        const message = deduplicatedMessages[i];
        if (!message) {
          continue;
        }
        if (seenIds.has(message.id)) {
          // Fallback key for duplicate IDs
          keyMap.set(`${message.id}-${i}`, `${message.id}-${i}`);
        } else {
          seenIds.add(message.id);
          keyMap.set(`${message.id}-${i}`, message.id);
        }
      }
      return keyMap;
    }, [deduplicatedMessages]);

    // ✅ PERF: useCallback with stable reference
    const keyForMessage = useCallback((message: UIMessage, index: number): string => {
      return messageKeyMap.get(`${message.id}-${index}`) ?? `${message.id}-${index}`;
    }, [messageKeyMap]);

    // ============================================================================
    // PERFORMANCE OPTIMIZATION: Pre-compute O(1) lookup maps
    // ============================================================================
    //
    // Instead of multiple O(n) .filter()/.some()/.find() operations throughout
    // the component, we build lookup maps once and reuse them.
    //
    // This converts operations like:
    // - messages.filter(m => getRoundNumber(m.metadata) === X) → O(n) per call
    // - messages.some(m => isModerator && round === X) → O(n) per call
    // To:
    // - roundToMessages.get(X) → O(1)
    // - roundToModeratorMessage.get(X) → O(1)
    //
    const roundLookups = useMemo(() => {
      const roundToMessages = new Map<number, UIMessage[]>();
      const roundToAssistantMessages = new Map<number, UIMessage[]>();
      const roundToModeratorMessage = new Map<number, UIMessage>();
      const messageHasContent = new Map<string, boolean>();
      let maxRoundNumber = 0;

      for (const message of deduplicatedMessages) {
        const roundNumber = message.role === MessageRoles.USER
          ? getUserMetadata(message.metadata)?.roundNumber ?? 0
          : getRoundNumber(message.metadata) ?? 0;

        // Track max round
        if (roundNumber > maxRoundNumber) {
          maxRoundNumber = roundNumber;
        }

        // Group by round
        const existing = roundToMessages.get(roundNumber);
        if (existing) {
          existing.push(message);
        } else {
          roundToMessages.set(roundNumber, [message]);
        }

        // Check content once and cache (O(1) subsequent lookups)
        const hasContent = message.parts?.some(p =>
          (p.type === MessagePartTypes.TEXT && 'text' in p && typeof p.text === 'string' && p.text.trim().length > 0)
          || p.type === MessagePartTypes.TOOL_CALL
          || p.type === MessagePartTypes.REASONING,
        ) ?? false;
        messageHasContent.set(message.id, hasContent);

        // Assistant-only grouping (excludes user messages)
        if (message.role === MessageRoles.ASSISTANT) {
          const existingAssistant = roundToAssistantMessages.get(roundNumber);
          if (existingAssistant) {
            existingAssistant.push(message);
          } else {
            roundToAssistantMessages.set(roundNumber, [message]);
          }

          // Track moderator messages per round
          const isMod = message.metadata && typeof message.metadata === 'object'
            && 'isModerator' in message.metadata && message.metadata.isModerator === true;
          if (isMod) {
            roundToModeratorMessage.set(roundNumber, message);
          }
        }
      }

      return {
        maxRoundNumber,
        messageHasContent,
        roundToAssistantMessages,
        roundToMessages,
        roundToModeratorMessage,
      };
    }, [deduplicatedMessages]);

    // ✅ PERF FIX: Memoize enabled participants to prevent unstable reference
    // getEnabledParticipants() was called 5+ times in render, each creating new arrays
    // causing downstream useMemo invalidation due to reference inequality.
    const enabledParticipantsMemo = useMemo(
      () => getEnabledParticipants(participants),
      [participants],
    );

    // ============================================================================
    // PERFORMANCE OPTIMIZATION: Split message processing into stable vs dynamic
    // ============================================================================
    //
    // Previously, ALL messages recalculated when transient state changed (37-70×/round).
    // Now we use a cache for completed messages (frozen metadata) and only recalculate
    // streaming messages when their state changes.
    //
    // Cache key: message.id + finishReason (stable once complete)
    // Cache invalidation: Only when message content actually changes

    // ✅ PERF: Cache for completed message participant info (frozen once set)
    const completedMessageCacheRef = useRef<Map<string, {
      isStreaming: boolean;
      modelId: string | undefined;
      participantIndex: number;
      role: string | null | undefined;
    } | null>>(new Map());

    // ✅ PERF: Track previous completedMessageInfo Map for stable reference optimization
    const lastCompletedInfoRef = useRef<Map<string, {
      isStreaming: boolean;
      modelId: string | undefined;
      participantIndex: number;
      role: string | null | undefined;
    } | null> | null>(null);

    // ✅ PERF: Track previous message references for incremental updates
    const prevMessageRefsRef = useRef<Map<string, UIMessage>>(new Map());

    // ✅ PERF: Stable memo for completed messages - ONLY depends on deduplicatedMessages
    // Completed messages have frozen metadata and never change
    const completedMessageInfo = useMemo(() => {
      const cache = completedMessageCacheRef.current;
      const prevRefs = prevMessageRefsRef.current;
      const results = new Map<string, {
        isStreaming: boolean;
        modelId: string | undefined;
        participantIndex: number;
        role: string | null | undefined;
      } | null>();

      // Build new refs map for next comparison
      const newRefs = new Map<string, UIMessage>();

      for (const message of deduplicatedMessages) {
        newRefs.set(message.id, message);

        // ✅ PERF: Skip messages whose reference hasn't changed AND are already in cache
        const prevRef = prevRefs.get(message.id);
        if (prevRef === message) {
          const cached = cache.get(message.id);
          if (cached !== undefined) {
            results.set(message.id, cached);
            continue;
          }
          // Also check lastCompletedInfoRef for null entries (user messages, streaming)
          const prevResult = lastCompletedInfoRef.current?.get(message.id);
          if (prevResult !== undefined) {
            results.set(message.id, prevResult);
            continue;
          }
        }

        // User messages - always null, cache it
        if (message.role === MessageRoles.USER) {
          results.set(message.id, null);
          continue;
        }

        // Check if already cached with finishReason or metadata.isStreaming=false (fully complete)
        const cacheKey = message.id;
        const cached = cache.get(cacheKey);
        if (cached !== undefined) {
          // Verify it's still complete
          const metadata = getMessageMetadata(message.metadata);
          const assistantMetadata = metadata && isAssistantMessageMetadata(metadata) ? metadata : null;
          const hasFinishReason = assistantMetadata?.finishReason && isCompletionFinishReason(assistantMetadata.finishReason);

          // Also check if metadata explicitly marks streaming as complete
          const metadataMarkedComplete = isStreamingMarkedComplete(message.metadata);

          if (hasFinishReason || metadataMarkedComplete) {
            results.set(message.id, cached);
            continue;
          }
        }

        // Check for moderator using fast check (O(1) without Zod validation)
        const isModeratorRaw = isModeratorMetadataFast(message.metadata);

        if (isModeratorRaw || isModeratorMessage(message)) {
          const moderatorMeta = getModeratorMetadata(message.metadata);
          const finishReason = moderatorMeta?.finishReason;
          const hasActuallyFinished = isCompletionFinishReason(finishReason);

          // Also check if metadata explicitly marks streaming as complete
          const metadataMarkedComplete = isStreamingMarkedComplete(message.metadata);

          if (hasActuallyFinished || metadataMarkedComplete) {
            // Completed moderator - cache it
            // Use narrower inline type that matches cache expectations (participantIndex is always defined for moderator)
            const info = {
              isStreaming: false,
              modelId: moderatorMeta?.model,
              participantIndex: MODERATOR_PARTICIPANT_INDEX,
              role: null as string | null | undefined,
            };
            cache.set(cacheKey, info);
            results.set(message.id, info);
            continue;
          }
          // Streaming moderator - mark as needing dynamic calculation (null value)
          results.set(message.id, null);
          continue;
        }

        // Check for completed participant message
        const metadata = getMessageMetadata(message.metadata);
        const assistantMetadata = metadata && isAssistantMessageMetadata(metadata) ? metadata : null;
        const finishReason = assistantMetadata?.finishReason;
        const hasActualFinishReason = isCompletionFinishReason(finishReason);

        // Check if metadata explicitly marks streaming as complete
        // This handles models that return non-standard finishReason values like 'unknown'
        // Uses helper (O(1)) instead of Zod validation because streaming
        // placeholders may not pass full DbAssistantMessageMetadataSchema validation
        // (missing required fields like finishReason and usage during streaming)
        const metadataMarkedComplete = isStreamingMarkedComplete(message.metadata);

        // Extract model and participant info from raw metadata for streaming placeholders
        // that don't pass full schema validation (uses type-safe metadata helpers)
        const rawModel = getModel(message.metadata) ?? undefined;
        const rawParticipantIndex = getParticipantIndex(message.metadata) ?? undefined;
        const rawParticipantRole = getParticipantRole(message.metadata);

        // FIX: metadataMarkedComplete is sufficient for completion detection
        // Don't require full Zod validation (assistantMetadata) - streaming placeholders
        // won't pass validation until finishReason and usage are populated at stream end
        const modelId = assistantMetadata?.model || rawModel;
        // ✅ PERF FIX: Don't use currentParticipantIndex as fallback for completed messages
        // Completed messages MUST have participantIndex in their metadata. If they don't,
        // fall through to dynamic calculation. This removes currentParticipantIndex from
        // dependencies, preventing O(n²) recalculations when participant index changes.
        const participantIndex = assistantMetadata?.participantIndex ?? rawParticipantIndex;
        const participantRole = assistantMetadata?.participantRole ?? rawParticipantRole;

        const isComplete = hasActualFinishReason || metadataMarkedComplete;

        // ✅ PERF FIX: Only cache if we have BOTH modelId AND participantIndex
        // Without participantIndex, we'd need dynamic calculation anyway
        if (isComplete && modelId !== undefined && participantIndex !== undefined) {
          const info = {
            isStreaming: false,
            modelId,
            participantIndex,
            role: participantRole,
          };
          cache.set(cacheKey, info);
          results.set(message.id, info);
          continue;
        }

        // Not complete OR missing required metadata - needs dynamic calculation (null value)
        results.set(message.id, null);
      }

      // ✅ PERF: Update prev refs for next incremental comparison
      prevMessageRefsRef.current = newRefs;

      // ✅ PERF FIX: Return same Map reference when entries haven't changed
      // Prevents downstream cascade (messagesWithParticipantInfoStructural → groups) on every 70ms flush
      const prevMap = lastCompletedInfoRef.current;
      if (prevMap && prevMap.size === results.size) {
        let same = true;
        for (const [id, info] of results) {
          if (prevMap.get(id) !== info) {
            same = false;
            break;
          }
        }
        if (same) {
          return prevMap;
        }
      }
      lastCompletedInfoRef.current = results;
      return results;
      // ✅ PERF FIX: Removed currentParticipantIndex from dependencies
      // Completed messages use metadata values; streaming messages use dynamic calculation
    }, [deduplicatedMessages]);

    // PERF: Split dynamic memo into structural (stable) + streaming (transient) parts
    // Structural part: Only recalculates when message list structure changes
    // This avoids full O(n) recalc when currentParticipantIndex changes (baton pass)
    const messagesWithParticipantInfoStructural = useMemo(() => {
      return deduplicatedMessages.map((message, index) => {
        // Check if we have cached info for this message
        const cachedInfo = completedMessageInfo.get(message.id);

        // User messages
        if (message.role === MessageRoles.USER) {
          return { index, message, needsDynamic: false as const, participantInfo: null };
        }

        // Completed messages - use cached info
        if (cachedInfo !== undefined && cachedInfo !== null) {
          return { index, message, needsDynamic: false as const, participantInfo: cachedInfo };
        }

        // Fast moderator check (O(1) without Zod validation)
        const isModeratorRaw = isModeratorMetadataFast(message.metadata);

        if (isModeratorRaw || isModeratorMessage(message)) {
          return { index, isModerator: true as const, message, needsDynamic: true as const, participantInfo: null };
        }

        // Needs full dynamic calculation
        return { index, isModerator: false as const, message, needsDynamic: true as const, participantInfo: null };
      });
    }, [deduplicatedMessages, completedMessageInfo]);

    // PERF: Dynamic memo - only for messages that need streaming state
    // Separated from structural memo to avoid recalculating ALL messages when
    // currentParticipantIndex changes during baton pass
    // ✅ PERF FIX: Reuse original item reference for non-dynamic items instead of creating
    // new objects. This preserves referential equality for completed/user messages,
    // preventing unnecessary downstream recalculations.
    const messagesWithParticipantInfo = useMemo(() => {
      return messagesWithParticipantInfoStructural.map((item) => {
        if (!item.needsDynamic) {
          // Reuse original item - same shape, avoids new object allocation
          return item;
        }

        if (item.isModerator) {
          const moderatorMeta = getModeratorMetadata(item.message.metadata);
          const finishReason = moderatorMeta?.finishReason;
          const hasActuallyFinished = isCompletionFinishReason(finishReason);
          const modelId = moderatorMeta?.model;

          const metadataMarkedComplete = isStreamingMarkedComplete(item.message.metadata);

          const isComplete = hasActuallyFinished || metadataMarkedComplete;
          const isStillStreaming = isModeratorStreaming && !isComplete;

          return {
            index: item.index,
            message: item.message,
            participantInfo: {
              isStreaming: isStillStreaming,
              modelId,
              participantIndex: MODERATOR_PARTICIPANT_INDEX,
              role: null as string | null | undefined,
            },
          };
        }

        // Streaming participant message - needs dynamic info
        const participantInfo = getParticipantInfoForMessage({
          currentParticipantIndex,
          currentStreamingParticipant,
          isGlobalStreaming: isStreaming,
          isModeratorStreaming,
          message: item.message,
          messageIndex: item.index,
          participants,
          participantSnapshotsByRound,
          totalMessages: deduplicatedMessages.length,
        });

        return { index: item.index, message: item.message, participantInfo };
      });
    }, [messagesWithParticipantInfoStructural, isStreaming, currentParticipantIndex, participants, currentStreamingParticipant, isModeratorStreaming, participantSnapshotsByRound, deduplicatedMessages.length]);

    // ✅ PERF FIX: Structural fingerprint to prevent O(n²) recalculations
    // Only recalculate groups when MESSAGE STRUCTURE changes, not text content.
    // CRITICAL: Depends on messagesWithParticipantInfoStructural (stable during streaming)
    // NOT messagesWithParticipantInfo (changes every 32ms text flush).
    // Uses numeric hash (djb2) instead of O(n) string concat + join.
    const structuralFingerprint = useMemo(() => {
      let hash = (isStreaming ? 1 : 0) * 31 + (_streamingRoundNumber ?? -1);
      for (const item of messagesWithParticipantInfoStructural) {
        const id = item.message.id;
        for (let j = 0; j < id.length; j++) {
          hash = ((hash << 5) + hash + id.charCodeAt(j)) | 0;
        }
        hash = ((hash << 5) + hash + item.message.role.charCodeAt(0)) | 0;
        const roundNum = getRoundNumber(item.message.metadata) ?? 0;
        hash = ((hash << 5) + hash + roundNum) | 0;
        const pIdx = item.participantInfo?.participantIndex ?? (item.needsDynamic ? -2 : -1);
        hash = ((hash << 5) + hash + pIdx) | 0;
      }
      return hash;
    }, [messagesWithParticipantInfoStructural, isStreaming, _streamingRoundNumber]);

    // ✅ PERF: Cache last computed groups to avoid recalculation when only text changes
    const lastGroupsRef = useRef<{ fingerprint: number; groups: MessageGroup[] }>({
      fingerprint: 0,
      groups: [],
    });

    const messageGroups = useMemo((): MessageGroup[] => {
      // ✅ PERF FIX: Early bailout if structural fingerprint hasn't changed
      // During streaming, text content changes constantly but structure stays the same
      if (
        structuralFingerprint === lastGroupsRef.current.fingerprint
        && lastGroupsRef.current.groups.length > 0
      ) {
        return lastGroupsRef.current.groups;
      }
      const groups: MessageGroup[] = [];
      let currentAssistantGroup: Extract<MessageGroup, { type: 'assistant-group' }> | null = null;
      let currentUserGroup: Extract<MessageGroup, { type: 'user-group' }> | null = null;

      // ✅ PERF: Cache findModel + getAvatarProps per modelId to avoid O(n) array lookups per message
      const modelCache = new Map<string, { model: Model | undefined; avatarSrc: string; avatarName: string }>();
      const getModelInfo = (modelId: string | undefined) => {
        if (!modelId) {
          return { avatarName: 'AI Assistant', avatarSrc: '', model: undefined };
        }
        const cached = modelCache.get(modelId);
        if (cached) {
          return cached;
        }
        const model = findModel(modelId);
        const avatarProps = getAvatarPropsFromModelId(MessageRoles.ASSISTANT, modelId, userInfo.image, userInfo.name);
        const result = { avatarName: avatarProps.name, avatarSrc: avatarProps.src, model };
        modelCache.set(modelId, result);
        return result;
      };

      for (const { index, message, participantInfo } of messagesWithParticipantInfo) {
        // BUG FIX: Use BOTH Zod validation AND fast check for pre-search detection
        // Fast check handles cases where Zod validation fails due to partial/mismatched metadata
        const isPreSearch = isPreSearchMessage(message.metadata) || isPreSearchFast(message);
        if (isPreSearch) {
          continue;
        }

        if (message.role === MessageRoles.USER) {
          if (currentAssistantGroup) {
            groups.push(currentAssistantGroup);
            currentAssistantGroup = null;
          }

          if (!currentUserGroup) {
            currentUserGroup = {
              headerInfo: {
                avatarName: userAvatarName,
                avatarSrc: userAvatarSrc,
                displayName: userAvatarName,
              },
              messages: [{ index, message }],
              type: 'user-group',
            };
          } else {
            currentUserGroup.messages.push({ index, message });
          }
          continue;
        }

        // Check for streaming placeholder using utility (O(1) without Zod validation)
        // isStreamingMetadata returns true when metadata.isStreaming === true
        const streamingPlaceholder = isStreamingMetadata(message.metadata);

        // For streaming placeholders without participantInfo (stale props issue),
        // create fallback participantInfo from message metadata using type-safe extractors
        let effectiveParticipantInfo = participantInfo;
        if (!participantInfo && streamingPlaceholder) {
          // Extract participant info using metadata utilities with fallback
          const pIdx = getParticipantIndex(message.metadata);
          const modelId = getModel(message.metadata);
          const role = getParticipantRole(message.metadata);

          if (pIdx !== null) {
            effectiveParticipantInfo = {
              isStreaming: true,
              modelId: modelId ?? undefined,
              participantIndex: pIdx,
              role,
            };
          }
        }

        if (!effectiveParticipantInfo) {
          continue;
        }

        const messageMetadata = getMessageMetadata(message.metadata);
        const messageRoundNumber = getRoundNumber(messageMetadata);
        const isCurrentStreamingRound = messageRoundNumber === _streamingRoundNumber;
        const messageIsModerator = isModeratorMessage(message);

        // ✅ FIX: Skip ALL non-moderator messages from the current streaming round.
        // Pending cards (rendered inside user-group) handle ALL participant rendering
        // during the entire streaming lifecycle (shimmer → content → moderator phase).
        // Without this, once allStreamingRoundParticipantsHaveContent becomes true,
        // messageGroups would ALSO render participants, causing DUPLICATION.
        // Only the moderator message should be rendered via messageGroups during streaming.
        if (isStreaming && isCurrentStreamingRound && !messageIsModerator) {
          continue;
        }

        if (currentUserGroup) {
          groups.push(currentUserGroup);
          currentUserGroup = null;
        }

        const isModerator = effectiveParticipantInfo.participantIndex === MODERATOR_PARTICIPANT_INDEX;
        const metadata = getMessageMetadata(message.metadata);

        let avatarSrc: string;
        let avatarName: string;
        let avatarNode: React.ReactNode | undefined;
        let displayName: string;
        let requiredTierName: string | undefined;
        let isAccessible: boolean;

        if (isModerator) {
          avatarSrc = BRAND.logos.main;
          avatarNode = <LazyPersona state="idle" className="size-8" />;
          avatarName = MODERATOR_NAME;
          displayName = MODERATOR_NAME;
          requiredTierName = undefined;
          isAccessible = true;
        } else {
          // ✅ PERF: Use cached model + avatar lookup (O(1) after first lookup per modelId)
          const cached = getModelInfo(effectiveParticipantInfo.modelId);
          avatarSrc = cached.avatarSrc;
          avatarName = cached.avatarName;
          const assistantMetadata = metadata && isAssistantMessageMetadata(metadata) ? metadata : null;
          displayName = cached.model?.name || assistantMetadata?.model || 'AI Assistant';
          requiredTierName = cached.model?.required_tier_name ?? undefined;
          isAccessible = demoMode || (cached.model?.is_accessible_to_user ?? true);
        }

        // ✅ FIX: Use roundNumber + participantIndex instead of participantIndex + modelId
        // When participants change between rounds (e.g., P1 goes from deepseek to claude),
        // the old key (index-modelId) would create separate groups for each model.
        // Using roundNumber ensures messages from the same participant slot within a round
        // are grouped together, regardless of model changes between rounds.
        const participantKey = `r${messageRoundNumber ?? 0}_p${effectiveParticipantInfo.participantIndex}`;

        if (
          currentAssistantGroup
          && currentAssistantGroup.participantKey === participantKey
        ) {
          // Same participant in same round, add to current group
          currentAssistantGroup.messages.push({
            index,
            message,
            participantInfo: effectiveParticipantInfo,
          });
        } else {
          // Different participant or first assistant message
          if (currentAssistantGroup) {
            groups.push(currentAssistantGroup);
          }

          currentAssistantGroup = {
            headerInfo: {
              avatarName,
              avatarNode,
              avatarSrc,
              displayName,
              isAccessible,
              requiredTierName,
              role: effectiveParticipantInfo.role ?? null,
            },
            messages: [{ index, message, participantInfo: effectiveParticipantInfo }],
            participantKey,
            type: 'assistant-group',
          };
        }
      }

      // Push any remaining groups
      if (currentUserGroup) {
        groups.push(currentUserGroup);
      }
      if (currentAssistantGroup) {
        groups.push(currentAssistantGroup);
      }

      // ✅ PERF: Cache the computed groups for early bailout on next render
      lastGroupsRef.current = { fingerprint: structuralFingerprint, groups };

      return groups;
    }, [messagesWithParticipantInfo, findModel, demoMode, userInfo, userAvatarSrc, userAvatarName, _streamingRoundNumber, isStreaming, structuralFingerprint]);

    // Pre-compute the max round so memory notification only renders on the latest user message
    const maxRoundForNotification = Math.max(
      0,
      _streamingRoundNumber ?? 0,
      roundLookups.maxRoundNumber,
    );

    return (
      <div className="touch-pan-y space-y-14">
        {messageGroups.map((group, groupIndex) => {
          const roundNumber = group.type === 'user-group'
            ? getRoundNumber(group.messages[0]?.message.metadata) ?? 0
            : group.type === 'assistant-group'
              ? getRoundNumber(group.messages[0]?.message.metadata) ?? 0
              : 0;

          // Check if this is the user message group for this round
          const isUserGroupForRound = group.type === 'user-group';
          // ✅ DEFENSIVE GUARD: Ensure _preSearches is an array before calling .find()
          // ✅ FIX: Also check threadId to prevent cross-thread contamination during navigation
          // Without this, stale pre-searches from the previous thread can match the new thread's rounds
          const preSearch = isUserGroupForRound && _threadId && Array.isArray(_preSearches)
            ? _preSearches.find(ps => ps.roundNumber === roundNumber && ps.threadId === _threadId)
            : null;

          // User message group with header inside message box
          if (group.type === 'user-group') {
            // ✅ PERF: Pre-compute shared values ONCE for both pending cards and moderator IIFEs
            // Previously: buildParticipantMessageMaps + roundAvailableSources computed inline in each IIFE
            // Now: computed once here and shared, eliminating duplicate O(n) work per render
            const assistantMessagesForRound = roundLookups.roundToAssistantMessages.get(roundNumber) ?? [];
            const participantMaps = buildParticipantMessageMaps(assistantMessagesForRound);
            const roundAvailableSources = collectRoundAvailableSources(
              assistantMessagesForRound,
              preSearch,
              streamingAvailableSources,
              roundNumber,
            );

            return (
              <div key={`user-group-wrapper-${group.messages[0]?.index}`}>
                {/* User messages - right-aligned bubbles, no avatar/name */}
                <div className="flex flex-col items-end gap-2">
                  {group.messages.map(({ index, message }) => {
                    const messageKey = keyForMessage(message, index);

                    // Extract file attachments and text parts separately
                    // ✅ TYPE-SAFE: Use isFilePart type guard for proper narrowing
                    const fileAttachments: MessageAttachment[] = message.parts
                      .filter((part): part is FilePart => isFilePart(part))
                      .map((filePart) => {
                        // Conditionally build object to satisfy exactOptionalPropertyTypes
                        const attachment: MessageAttachment = { url: filePart.url };
                        if (filePart.filename !== undefined) {
                          attachment.filename = filePart.filename;
                        }
                        if (filePart.mediaType !== undefined) {
                          attachment.mediaType = filePart.mediaType;
                        }
                        const uploadId = getUploadIdFromFilePart(filePart);
                        if (uploadId !== null) {
                          attachment.uploadId = uploadId;
                        }
                        return attachment;
                      });

                    const textParts = message.parts.filter(
                      part => part.type === MessagePartTypes.TEXT,
                    );

                    // ✅ FIX: Skip animation for ALL user messages in non-initial rounds
                    // Not just optimistic messages - because when the DB ID replaces the
                    // optimistic ID, we don't want the component to remount with opacity:0
                    const skipUserMsgAnimation = roundNumber > 0 || !shouldAnimateMessage(message.id);

                    return (
                      <ScrollAwareUserMessage
                        key={messageKey}
                        skipAnimation={skipUserMsgAnimation}
                        enableScrollEffect
                        className="w-full"
                      >
                        <div
                          dir="auto"
                          className={cn(
                            'max-w-[85%] ms-auto w-fit min-w-0 overflow-hidden',
                            'bg-secondary text-secondary-foreground',
                            'rounded-2xl rounded-ee-md px-4 py-3',
                            'text-base leading-relaxed',
                          )}
                        >
                          {/* Attachments displayed above text */}
                          {fileAttachments.length > 0 && (
                            <MessageAttachmentPreview
                              attachments={fileAttachments}
                              isPublicThread={isReadOnly}
                              messageId={message.id}
                              threadId={_threadId ?? undefined}
                            />
                          )}

                          {/* Text content - use ReactMarkdown for SSR/read-only, Streamdown for interactive */}
                          {textParts.map((part, partIndex) => {
                            if (part.type === MessagePartTypes.TEXT) {
                              return (isReadOnly || skipEntranceAnimations)
                                ? (
                                    // SSR: Direct import renders synchronously - no hydration flash
                                    <Markdown
                                      key={`${message.id}-text-${partIndex}`}
                                      remarkPlugins={remarkPlugins}
                                      components={streamdownComponents}
                                    >
                                      {part.text}
                                    </Markdown>
                                  )
                                : (
                                    <LazyStreamdown
                                      key={`${message.id}-text-${partIndex}`}
                                      className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                                      components={streamdownComponents}
                                    >
                                      {part.text}
                                    </LazyStreamdown>
                                  );
                            }
                            return null;
                          })}
                        </div>
                      </ScrollAwareUserMessage>
                    );
                  })}
                </div>

                {/* Memory saved notification - shown after latest user message when extraction succeeds */}
                {memoryNotification && roundNumber >= maxRoundForNotification && (
                  <div className="mt-2 flex justify-end">
                    <MemorySavedNotification
                      summary={memoryNotification.summary}
                      onUndo={() => {
                        undoMemory();
                        dismissMemory();
                      }}
                    />
                  </div>
                )}

                {/* CRITICAL FIX: Render PreSearchCard immediately after user message, before assistant messages */}
                {/* ✅ mt-14 provides consistent spacing from user message content to PreSearchCard */}
                {/* ✅ ScrollFromTop wraps card for scroll-triggered slide-down animation */}
                {preSearch && _threadId && (
                  <ScrollFromTop
                    skipAnimation={skipEntranceAnimations}
                    className="mt-6 mb-3"
                  >
                    <CompactPreSearchIndicator
                      key={`pre-search-${roundNumber}`}
                      preSearch={preSearch}
                    />
                  </ScrollFromTop>
                )}

                {/* ✅ EAGER RENDERING: Show pending participant placeholders when waiting for pre-search or streaming
                    This provides immediate visual feedback showing all participants with "Waiting for response..."
                    The shimmer loading shows until each participant begins streaming and receives content */}
                {(() => {
                  // ✅ CRITICAL FIX: Determine if we should show pending cards
                  // Show pending cards when:
                  // 1. Pre-search is active (PENDING or STREAMING)
                  // 2. Streaming is active
                  // 3. Pre-search just completed but streaming hasn't started yet (waitForStream phase)
                  const preSearchActive = preSearch
                    && (preSearch.status === MessageStatuses.PENDING || preSearch.status === MessageStatuses.STREAMING);
                  const preSearchComplete = preSearch && preSearch.status === MessageStatuses.COMPLETE;

                  // ✅ FIX: Check if this is the round that's about to stream
                  // After pre-search completes, there's a brief gap before isStreaming becomes true
                  // During this gap, we still want to show pending cards
                  const isStreamingRound = roundNumber === _streamingRoundNumber;

                  // ✅ BUG FIX: Only show pending cards for the ACTUAL latest round
                  // Previous logic: `isLatestRound = isStreamingRound || preSearchActive || preSearchComplete`
                  // Bug: ANY round with complete pre-search would show pending cards!
                  // Fix: Check if this round is >= the maximum round number in messages
                  // ✅ BUG FIX 2: Include _streamingRoundNumber in max calculation
                  // Bug: streamingRoundNumber is set BEFORE optimistic user message is added
                  // This caused previous round to see maxRound=N-1 and think it's latest
                  // while streamingRoundNumber was already N. By including streamingRoundNumber,
                  // previous rounds correctly see they're not latest even before message arrives.
                  // ✅ PERF: Use pre-computed maxRoundNumber from roundLookups (O(1) vs O(n) spread)
                  const maxRoundInMessages = Math.max(
                    0,
                    _streamingRoundNumber ?? 0,
                    roundLookups.maxRoundNumber,
                  );
                  const isActuallyLatestRound = roundNumber >= maxRoundInMessages;
                  // ✅ BUG FIX 3: If isStreamingRound is true, ALWAYS consider this the latest round
                  // This is a defensive fix for race conditions where preSearch lookup might fail
                  // during state synchronization (e.g., orchestrator refetch after pre-search completes).
                  // The streamingRoundNumber is the authoritative signal for which round is active.
                  const isLatestRound = isStreamingRound || (isActuallyLatestRound && (preSearchActive || preSearchComplete));

                  if (!isLatestRound || participants.length === 0) {
                    return null;
                  }

                  // ✅ PERF: participantMaps + roundAvailableSources pre-computed at user-group scope
                  // Eliminates duplicate buildParticipantMessageMaps + source collection per render

                  // ✅ FLASH FIX: Keep rendering pending cards until round is COMPLETE
                  // Previously: Stopped when allParticipantsHaveVisibleContent() became true
                  // Problem: This caused a transition to messageGroups with different keys,
                  // which caused React to unmount/remount components = FLASH
                  //
                  // New approach:
                  // 1. Pending cards render ALL participants during streaming round
                  // 2. They keep rendering even when all have content (just show content instead of shimmer)
                  // 3. Only stop when round is marked COMPLETE
                  // 4. MessageGroups skips rendering assistant messages from streaming round
                  //
                  // ✅ MODERATOR TRANSITION FIX: Include isModeratorStreaming in condition
                  // When participants finish (isStreaming=false) but moderator is starting
                  // (isModeratorStreaming=true), we must keep rendering the pending cards section
                  // Otherwise everything disappears during the transition!
                  //
                  // ✅ PLACEHOLDER TIMING FIX: Include isStreamingRound in condition
                  // RACE CONDITION BUG: When streamingRoundNumber is set (handleUpdateThreadAndSend line 437)
                  // but isStreaming is still false (waiting for AI SDK to start), the moderator placeholder
                  // would show immediately (because its condition includes isStreamingRound) but participant
                  // pending cards wouldn't show (because this condition didn't include isStreamingRound).
                  // FIX: Both participant and moderator sections now use same isAnyStreamingActive logic.
                  //
                  // This keeps the same component mounted throughout streaming -> no flash
                  const isRoundComplete = completedRoundNumbers.has(roundNumber);
                  const isAnyStreamingActive = isStreaming || isModeratorStreaming || isStreamingRound;
                  // DUPLICATION GUARD: Removed `preSearchComplete` from the condition.
                  // Previously: `!isRoundComplete && (preSearchActive || preSearchComplete || isAnyStreamingActive)`
                  // Bug: After completion, preSearchComplete stayed true while isAnyStreamingActive was false,
                  // keeping pending cards visible. Meanwhile messageGroups stopped skipping participants
                  // (because isStreaming=false), causing BOTH to render = duplication.
                  // The gap between preSearch completion and streaming start is covered by
                  // isStreamingRound (part of isAnyStreamingActive), so preSearchComplete is redundant.
                  const shouldShowPendingCards = !isRoundComplete && (preSearchActive || isAnyStreamingActive);

                  // ✅ FLASH FIX: Keep component mounted but hidden instead of return null
                  // Previously returning null caused React to unmount/remount when transitioning
                  // from pending cards to messageGroups, triggering animation replays (FLASH).
                  // Now we use opacity + pointer-events to hide without unmounting.

                  // Render ALL enabled participants in priority order (store guarantees sort)
                  // Each participant shows either their actual content or shimmer, maintaining stable positions.

                  // ✅ POST-MODERATOR FLASH FIX: When round completes, hide INSTANTLY (no transition)
                  // The transition was causing a 150ms fadeout that overlapped with messageGroups fadein
                  const wasRenderedDuringStreaming = renderedRoundsRef.current.has(roundNumber);

                  return (
                    // mt-14 provides consistent spacing from user message (matches space-y-14 between participants)
                    // ✅ FLASH FIX: Use opacity transition instead of conditional rendering
                    // ✅ POSITION FIX: Use visibility+height instead of absolute positioning
                    // absolute -z-10 caused layout jumps when content became visible
                    // ✅ POST-MODERATOR FLASH FIX: No transition when hiding (instant) to prevent overlap with messageGroups
                    <div
                      className={cn(
                        'space-y-14 overflow-hidden',
                        // Only transition when showing, not when hiding (prevents flash)
                        shouldShowPendingCards && 'transition-all duration-150',
                        shouldShowPendingCards ? 'mt-14 opacity-100' : 'h-0 opacity-0 pointer-events-none',
                        // Force instant hide when round was already rendered (prevents flash)
                        wasRenderedDuringStreaming && !shouldShowPendingCards && 'transition-none',
                      )}
                      aria-hidden={!shouldShowPendingCards}
                    >
                      {shouldShowPendingCards && enabledParticipantsMemo.map((participant, participantIdx) => {
                        const model = findModel(participant.modelId);
                        // ✅ Use backend-computed is_accessible_to_user (respects actual tier)
                        // In demo mode, all models are accessible
                        const isAccessible = demoMode || (model?.is_accessible_to_user ?? true);

                        // ✅ Use reusable utility for multi-strategy lookup
                        let participantMessage = getParticipantMessageFromMaps(participantMaps, participant, participantIdx);

                        // ✅ STREAMING FALLBACK: Currently streaming participant's message has no
                        // metadata yet (set by `finish` chunk on completion). Fall back to the
                        // last assistant message in the array which is the active streaming message.
                        // GUARD: Validate fallback message belongs to the current round and is not
                        // a presearch or moderator message. Without this, wrong participant content
                        // leaks into other participant cards during split cache misses.
                        if (!participantMessage && participantIdx === currentParticipantIndex) {
                          for (let mi = messages.length - 1; mi >= 0; mi--) {
                            const candidate = messages[mi];
                            if (candidate?.role === MessageRoles.ASSISTANT) {
                              // Verify this message is from the current round and not a presearch/moderator
                              const candidateRound = getRoundNumber(candidate.metadata);
                              const candidateIsPresearch = isPreSearchFast(candidate);
                              const candidateIsModerator = isModeratorMetadataFast(candidate.metadata);
                              if (
                                !candidateIsPresearch
                                && !candidateIsModerator
                                && (candidateRound === null || candidateRound === roundNumber)
                              ) {
                                participantMessage = candidate;
                                break;
                              }
                            }
                          }
                        }

                        const hasContent = participantMessage
                          ? participantHasVisibleContent(participantMaps, participant, participantIdx)
                          || participantMessage.parts?.some(p =>
                            (p.type === MessagePartTypes.TEXT && 'text' in p && typeof p.text === 'string' && p.text.trim().length > 0)
                            || (p.type === MessagePartTypes.REASONING && 'text' in p && typeof p.text === 'string' && p.text.trim().length > 0),
                          ) || false
                          : participantHasVisibleContent(participantMaps, participant, participantIdx);

                        let status: MessageStatus;
                        const parts: MessagePart[] = [];

                        if (hasContent && participantMessage) {
                          // ✅ FIX: Use multiple signals to determine if streaming is done
                          // Some models return finishReason='unknown' even on success
                          const messageMeta = getMessageMetadata(participantMessage.metadata);
                          const assistantMeta = messageMeta && isAssistantMessageMetadata(messageMeta) ? messageMeta : null;
                          const finishReason = assistantMeta?.finishReason;

                          // Signal 1: Standard finish reasons
                          const hasStandardFinishReason = isCompletionFinishReason(finishReason);

                          // Signal 2: Backend marked success with tokens generated
                          const backendMarkedSuccess = assistantMeta?.hasError === false
                            && (assistantMeta?.usage?.completionTokens ?? 0) > 0;

                          // Signal 3: NOT explicitly failed
                          const isExplicitError = finishReason === FinishReasons.FAILED || assistantMeta?.hasError === true;

                          // Signal 4: PER-PARTICIPANT completion via metadata.isStreaming flag
                          // ✅ FIX: Use metadata.isStreaming instead of global isStreaming
                          // AI SDK sets metadata.isStreaming=false when this specific participant's
                          // stream closes, even if others are still streaming
                          const metaIndicatesStreamingComplete = isStreamingMarkedComplete(participantMessage.metadata);

                          // Signal 5: All text parts have finished streaming (no STREAMING state)
                          // AI SDK transitions part.state to DONE when the stream closes
                          const allPartsComplete = !(participantMessage.parts || []).some(
                            p => p && 'state' in p && p.state === TextPartStates.STREAMING,
                          );

                          // ✅ MULTI-SIGNAL: Complete if per-participant signals OR standard finish OR backend success
                          // Participant is complete when:
                          // - metadata.isStreaming explicitly set to false by AI SDK, OR
                          // - All text parts have state !== STREAMING, OR
                          // - Standard completion finish reason (stop, length, etc.), OR
                          // - Backend marked success with tokens generated
                          const hasActuallyFinished = (
                            metaIndicatesStreamingComplete
                            || allPartsComplete
                            || hasStandardFinishReason
                            || backendMarkedSuccess
                          ) && !isExplicitError;

                          // ✅ ANIMATION FIX: Still streaming if content exists but not finished
                          // This keeps the pulsating animation showing during active streaming
                          status = hasActuallyFinished ? MessageStatuses.COMPLETE : MessageStatuses.STREAMING;
                          // AI SDK → app type bridge via Zod safeParse
                          for (const p of participantMessage.parts || []) {
                            const isRenderable = p
                              && (p.type === MessagePartTypes.TEXT
                                || p.type === MessagePartTypes.REASONING
                                || p.type === MessagePartTypes.TOOL_CALL
                                || p.type === MessagePartTypes.TOOL_RESULT);
                            if (isRenderable && isMessagePart(p)) {
                              parts.push(p);
                            }
                          }
                        } else {
                          status = MessageStatuses.PENDING;
                        }

                        let loadingText: string | undefined;
                        if (!hasContent) {
                          if (preSearchActive) {
                            // PRESEARCH phase: all participants show "Searching..."
                            loadingText = t('chat.participant.waitingForWebResults');
                          } else {
                            // PARTICIPANTS phase: show "Thinking..." for all waiting participants
                            loadingText = t('chat.participant.gatheringThoughts');
                          }
                        }

                        return (
                          <ScrollAwareParticipant
                            key={`participant-${participant.id}`}
                            index={participantIdx}
                            skipAnimation={!shouldAnimateMessage(`participant-${participant.id}-${roundNumber}`)}
                            enableScrollEffect
                          >
                            <ParticipantMessageWrapper
                              participant={participant}
                              participantIndex={participantIdx}
                              model={model}
                              status={status}
                              parts={parts}
                              isAccessible={isAccessible}
                              messageId={participantMessage?.id}
                              metadata={participantMessage ? (getMessageMetadata(participantMessage.metadata) ?? null) : null}
                              loadingText={loadingText}
                              maxContentHeight={maxContentHeight}
                              hideActions={demoMode || isReadOnly}
                              groupAvailableSources={roundAvailableSources}
                              skipTransitions={isReadOnly || skipEntranceAnimations}
                            />
                          </ScrollAwareParticipant>
                        );
                      })}

                    </div>
                  );
                })()}

                {(() => {
                  // ✅ PERF: Use pre-computed maxRoundNumber from roundLookups (O(1) vs O(n) spread)
                  const maxRoundInMessages = Math.max(
                    0,
                    _streamingRoundNumber ?? 0,
                    roundLookups.maxRoundNumber,
                  );
                  const isActuallyLatestRound = roundNumber >= maxRoundInMessages;
                  const isRoundComplete = completedRoundNumbers.has(roundNumber);
                  // ✅ FIX: Check if this is the active streaming round
                  const isStreamingRound = roundNumber === _streamingRoundNumber;

                  const moderatorMessage = roundLookups.roundToModeratorMessage.get(roundNumber);
                  const moderatorHasContent = moderatorMessage?.parts?.some(p =>
                    p.type === MessagePartTypes.TEXT && 'text' in p && typeof p.text === 'string' && p.text.trim().length > 0,
                  ) ?? false;

                  // ✅ PERF: roundAvailableSources pre-computed at user-group scope (eliminates duplicate ~80-line IIFE)

                  // ✅ IMMEDIATE PLACEHOLDER: Show moderator placeholder immediately when streaming round starts
                  // This provides visual feedback that moderator will synthesize after participants complete.
                  // Flow:
                  // - Submit pressed → isStreamingRound becomes true → moderator placeholder shows immediately
                  // - Participants stream one by one
                  // - All participants complete → moderator streams (same placeholder, content fills in)
                  // - After streaming ends (_streamingRoundNumber cleared), messageGroups handles rendering
                  // - DUPLICATE FIX: isStreamingRound ensures IIFE only renders during active round
                  const shouldShowModerator = isActuallyLatestRound
                    && !isRoundComplete
                    && isStreamingRound; // Show immediately when streaming round starts

                  // ✅ PERF: Use memoized enabled participants (stable reference)

                  // AI SDK → app type bridge via Zod safeParse
                  // Hide moderator reasoning from UI — streamed for processing but not displayed
                  const moderatorParts: MessagePart[] = [];
                  if (moderatorHasContent && moderatorMessage) {
                    for (const p of moderatorMessage.parts || []) {
                      const isRenderable = p
                        && (p.type === MessagePartTypes.TEXT
                          || p.type === MessagePartTypes.TOOL_CALL
                          || p.type === MessagePartTypes.TOOL_RESULT);
                      if (isRenderable && isMessagePart(p)) {
                        moderatorParts.push(p);
                      }
                    }
                  }

                  // Determine status: pending → streaming → complete
                  const moderatorStatus = moderatorHasContent
                    ? (isModeratorStreaming ? MessageStatuses.STREAMING : MessageStatuses.COMPLETE)
                    : MessageStatuses.PENDING;

                  // ✅ SMART LOADING TEXT: Different message based on participant streaming status
                  // - When participants still streaming: "Waiting to synthesize..."
                  // - When participants done, moderator starting: "Observing discussion..."
                  const moderatorLoadingText = moderatorParts.length === 0
                    ? (isStreaming ? t('chat.participant.waitingToSynthesize') : t('chat.participant.moderatorObserving'))
                    : undefined;

                  // ✅ FLASH FIX: Keep component mounted but hidden instead of return null
                  // ✅ POSITION FIX: Use visibility+height instead of absolute positioning
                  // absolute -z-10 caused layout jumps when moderator became visible
                  // Now we keep it in flow but visually hidden with h-0
                  // ✅ POST-MODERATOR FLASH FIX: When hiding, use instant transition to prevent overlap
                  const wasRenderedDuringStreaming = renderedRoundsRef.current.has(roundNumber);

                  return (
                    <div
                      className={cn(
                        'overflow-hidden',
                        // Only transition when showing, not when hiding (prevents flash)
                        shouldShowModerator && 'transition-all duration-150',
                        shouldShowModerator ? 'mt-14 opacity-100' : 'h-0 opacity-0 pointer-events-none',
                        // Force instant hide when round was already rendered (prevents flash)
                        wasRenderedDuringStreaming && !shouldShowModerator && 'transition-none',
                      )}
                      aria-hidden={!shouldShowModerator}
                    >
                      <ScrollAwareParticipant
                        key={`moderator-${roundNumber}`}
                        index={enabledParticipantsMemo.length}
                        skipAnimation={!shouldAnimateMessage(`moderator-${roundNumber}`)}
                        enableScrollEffect
                      >
                        <ParticipantMessageWrapper
                          participantIndex={MODERATOR_PARTICIPANT_INDEX}
                          model={undefined}
                          status={moderatorStatus}
                          parts={moderatorParts}
                          isAccessible
                          messageId={moderatorMessage?.id}
                          loadingText={moderatorLoadingText}
                          maxContentHeight={maxContentHeight}
                          avatarSrc={BRAND.logos.main}
                          avatarNode={<LazyPersona state={moderatorPersonaState(moderatorStatus)} className="size-8" />}
                          avatarName={MODERATOR_NAME}
                          displayName={MODERATOR_NAME}
                          hideActions
                          groupAvailableSources={roundAvailableSources}
                          skipTransitions={isReadOnly || skipEntranceAnimations}
                        />
                      </ScrollAwareParticipant>
                    </div>
                  );
                })()}

                {/* Error retry button - shown after last round's content on error */}
                {chatError && !isReadOnly && !isStreaming && roundNumber >= roundLookups.maxRoundNumber && retryLastRound && (
                  <div className="mt-6">
                    <ErrorState
                      variant={ErrorStateVariants.ALERT}
                      title={t('chat.roundError')}
                      description={chatError.message}
                      onRetry={retryLastRound}
                      retryLabel={t('chat.retryRound')}
                    />
                  </div>
                )}
              </div>
            );
          }

          // Assistant group with header inside message box
          if (group.type === 'assistant-group') {
            // ✅ FLASH FIX: Skip rendering assistant groups from current streaming round
            // They're rendered by the pending cards section to maintain key stability
            // Only render assistant groups from COMPLETED rounds
            const groupRoundNumber = getRoundNumber(group.messages[0]?.message.metadata) ?? -1;
            const isStreamingRoundGroup = groupRoundNumber === _streamingRoundNumber;
            const isGroupRoundComplete = completedRoundNumbers.has(groupRoundNumber);

            // Skip if this is the streaming round (pending cards handles it)
            // Exception: If round is marked complete, render it here
            if (isStreamingRoundGroup && !isGroupRoundComplete) {
              return null;
            }

            // Skip orphaned AI SDK accumulator messages during active streaming.
            // During presearch, AI SDK creates an assistant message with metadata: undefined.
            // getRoundNumber returns null → groupRoundNumber = -1, so the check above misses it.
            // These messages only contain data-phase/data-presearch parts with no user-facing text.
            if (groupRoundNumber === -1 && _streamingRoundNumber !== null && _streamingRoundNumber !== undefined) {
              return null;
            }

            const firstMessageId = group.messages[0]?.message.id || `group-${groupIndex}`;

            // ✅ POST-MODERATOR FLASH FIX: Skip animation for rounds that were rendered during streaming
            // Content was already visible via pending cards - don't replay entrance animation
            const wasRenderedDuringStreaming = renderedRoundsRef.current.has(groupRoundNumber);
            const shouldSkipAnimation = !shouldAnimateMessage(firstMessageId) || wasRenderedDuringStreaming;

            // ✅ PERF: Use roundLookups O(1) Map lookup instead of O(n) scan over ALL messages
            // Previously: scanned all messages filtering by role + roundNumber = O(n) per assistant group
            // Now: roundToAssistantMessages.get() = O(1)
            const roundAssistantMessages = roundLookups.roundToAssistantMessages.get(groupRoundNumber) ?? [];
            // ✅ FIX: Look up presearch for this round to enable citation source fallback
            const groupPreSearch = _threadId && Array.isArray(_preSearches)
              ? _preSearches.find(ps => ps.roundNumber === groupRoundNumber && ps.threadId === _threadId)
              : null;
            const roundSources = collectCompletedRoundSources(
              roundAssistantMessages,
              streamingAvailableSources,
              groupRoundNumber,
              groupPreSearch,
            );

            return (
              <ScrollAwareParticipant
                key={`assistant-group-${group.participantKey}-${group.messages[0]?.index}`}
                index={0}
                skipAnimation={shouldSkipAnimation}
              >
                <AssistantGroupCard
                  group={group}
                  groupIndex={groupIndex}
                  findModel={findModel}
                  demoMode={demoMode}
                  hideMetadata={hideMetadata}
                  t={t as (key: string) => string}
                  keyForMessage={keyForMessage}
                  maxContentHeight={maxContentHeight}
                  roundAvailableSources={roundSources}
                  skipTransitions={isReadOnly || skipEntranceAnimations}
                  isReadOnly={isReadOnly}
                />
              </ScrollAwareParticipant>
            );
          }

          return null;
        })}

        {/* ✅ MODERATOR PLACEHOLDER: Show after all messageGroups when waiting for moderator
            This renders OUTSIDE the user-group to maintain correct order:
            User → Participants (messageGroups) → Moderator Placeholder
            The placeholder stays visible until moderator stream starts sending chunks

            ✅ FIX: Check for "all have visible content" instead of "all have finished"
            When participants have content, they render via messageGroups (not pending cards).
            The inside-user-group placeholder is hidden at that point, so we need to show
            this placeholder to maintain visibility during the transition. */}
        {(() => {
          // ✅ PERF: Use pre-computed O(1) lookups instead of O(n) operations
          const latestRound = Math.max(0, _streamingRoundNumber ?? 0, roundLookups.maxRoundNumber);

          // ✅ PERF: O(1) lookup for moderator message instead of O(n) .some()
          const moderatorMessage = roundLookups.roundToModeratorMessage.get(latestRound);
          const hasModeratorWithContent = moderatorMessage
            ? (roundLookups.messageHasContent.get(moderatorMessage.id) ?? false)
            : false;

          // ✅ PERF: Check cheap conditions FIRST to avoid expensive buildParticipantMessageMaps
          // During streaming, insideUserGroupHandlesModerator is almost always true,
          // so we skip the O(n) participant maps computation entirely.
          const isRoundComplete = completedRoundNumbers.has(latestRound);

          // ✅ PERF: O(1) check instead of O(n) .some()
          const hasModeratorMessage = !!moderatorMessage;

          // ✅ DUPLICATE FIX: Don't render if inside-user-group is handling the moderator
          // Inside user-group handles moderator when: streaming round OR moderator message exists OR isModeratorStreaming
          // So this section only renders when inside-user-group isn't active
          const isStreamingRound = latestRound === _streamingRoundNumber;
          const insideUserGroupHandlesModerator = isStreamingRound || hasModeratorMessage || isModeratorStreaming;

          // ✅ PERF: Early bailout on cheap checks BEFORE expensive buildParticipantMessageMaps
          // During streaming, insideUserGroupHandlesModerator is true → skip O(n) computation
          if (insideUserGroupHandlesModerator || hasModeratorWithContent || isRoundComplete || enabledParticipantsMemo.length === 0) {
            return null;
          }

          // Only compute participant maps when we actually need them (rare path)
          // Note: moderatorMessage is guaranteed falsy here (hasModeratorMessage is false after early return)
          const roundParticipantMessages = roundLookups.roundToAssistantMessages.get(latestRound) ?? [];
          const participantMaps = buildParticipantMessageMaps(roundParticipantMessages);
          const allParticipantsHaveContent = allParticipantsHaveVisibleContent(participantMaps, enabledParticipantsMemo);

          if (!allParticipantsHaveContent) {
            return null;
          }

          return (
            <div className="mt-14">
              <ScrollAwareParticipant
                key={`moderator-pending-after-groups-${latestRound}`}
                index={enabledParticipantsMemo.length}
                skipAnimation={!shouldAnimateMessage(`moderator-pending-${latestRound}`)}
                enableScrollEffect
              >
                <ParticipantMessageWrapper
                  participantIndex={MODERATOR_PARTICIPANT_INDEX}
                  model={undefined}
                  status={MessageStatuses.PENDING}
                  parts={[]}
                  isAccessible
                  loadingText={t('chat.participant.moderatorObserving')}
                  maxContentHeight={maxContentHeight}
                  avatarSrc={BRAND.logos.main}
                  avatarNode={<LazyPersona state="thinking" className="size-8" />}
                  avatarName={MODERATOR_NAME}
                  displayName={MODERATOR_NAME}
                  hideActions
                  skipTransitions={isReadOnly || skipEntranceAnimations}
                />
              </ScrollAwareParticipant>
            </div>
          );
        })()}
      </div>
    );
  },
  // Custom comparison function to optimize re-renders
  // Only re-render if critical props actually change
  (prevProps, nextProps) => {
    // Always re-render if streaming state changes
    if (prevProps.isStreaming !== nextProps.isStreaming) {
      return false;
    }

    // Always re-render if messages array reference changes OR content changes
    if (
      prevProps.messages !== nextProps.messages
      || prevProps.messages.length !== nextProps.messages.length
    ) {
      return false;
    }

    // ✅ CRITICAL FIX: During streaming, check if last message content changed
    // This ensures pending cards properly transition to streaming content
    // Without this check, the memo might skip re-renders when streaming updates
    // the same message's parts array, causing pending cards to remain visible
    // ✅ MODERATOR FIX: Also check during moderator streaming for gradual UI updates
    const isAnyStreaming = nextProps.isStreaming || nextProps.isModeratorStreaming;
    if (isAnyStreaming && nextProps.messages.length > 0) {
      const prevLast = prevProps.messages[prevProps.messages.length - 1];
      const nextLast = nextProps.messages[nextProps.messages.length - 1];

      // Check if parts array reference changed (indicates content update)
      if (prevLast?.parts !== nextLast?.parts) {
        return false;
      }

      // Deep check: if parts reference is same but content differs
      // This handles edge cases where the array is mutated in place
      // ✅ STREAMING OPTIMIZATION: Use text length buckets (50 char) to reduce re-renders
      // from 200+ to ~20-30 per participant during streaming
      if (prevLast?.parts && nextLast?.parts) {
        // Calculate total text length for comparison without type predicates
        const getTextLength = (parts: typeof prevLast.parts): number => {
          let length = 0;
          for (const p of parts) {
            // ✅ ENUM PATTERN: Use MessagePartTypes enum for type narrowing
            if (p.type === MessagePartTypes.TEXT && 'text' in p) {
              // Type narrowing ensures p.text exists after the check
              length += p.text?.length || 0;
            }
          }
          return length;
        };

        const prevLen = getTextLength(prevLast.parts);
        const nextLen = getTextLength(nextLast.parts);
        // Use 50 char buckets during streaming to throttle re-renders
        const TEXT_BUCKET_SIZE = 50;
        const prevBucket = Math.floor(prevLen / TEXT_BUCKET_SIZE);
        const nextBucket = Math.floor(nextLen / TEXT_BUCKET_SIZE);
        if (prevBucket !== nextBucket) {
          return false;
        }
      }

      // ✅ PULSATING DOT FIX: Check if any message's isStreaming metadata changed
      // When a participant completes, their metadata.isStreaming changes from true to false
      // This triggers the pulsating dot to stop for that participant
      // Without this check, the memo might skip re-renders when isStreaming changes
      // on a message that is NOT the last message (e.g., P0 completes while P1 is streaming)
      for (let i = 0; i < nextProps.messages.length; i++) {
        const prevMsg = prevProps.messages[i];
        const nextMsg = nextProps.messages[i];
        if (!prevMsg || !nextMsg) {
          continue;
        }
        const prevIsStreaming = isStreamingMetadata(prevMsg.metadata) ? true : isStreamingMarkedComplete(prevMsg.metadata) ? false : undefined;
        const nextIsStreaming = isStreamingMetadata(nextMsg.metadata) ? true : isStreamingMarkedComplete(nextMsg.metadata) ? false : undefined;
        if (prevIsStreaming !== nextIsStreaming) {
          return false;
        }
      }
    }

    // Only re-render if currentParticipantIndex changes AND we're currently streaming
    // If not streaming, completed messages don't care about currentParticipantIndex
    if (
      prevProps.currentParticipantIndex !== nextProps.currentParticipantIndex
      && nextProps.isStreaming
    ) {
      return false;
    }

    // Re-render if participants reference changes (shouldn't happen often)
    if (prevProps.participants !== nextProps.participants) {
      return false;
    }

    // Re-render if currentStreamingParticipant changes AND we're streaming
    if (
      prevProps.currentStreamingParticipant !== nextProps.currentStreamingParticipant
      && nextProps.isStreaming
    ) {
      return false;
    }

    // Re-render if preSearches change (for pending participant cards and PreSearchCard)
    if (prevProps.preSearches !== nextProps.preSearches) {
      return false;
    }

    // Re-render if streamingRoundNumber changes
    if (prevProps.streamingRoundNumber !== nextProps.streamingRoundNumber) {
      return false;
    }

    // ✅ BUG FIX: Re-render if completedRoundNumbers changes (new summaries completed)
    // ✅ PERF FIX: Do shallow Set comparison, not just reference equality
    // Even with stable refs from ChatView, verify contents are actually equal
    const prevCompleted = prevProps.completedRoundNumbers;
    const nextCompleted = nextProps.completedRoundNumbers;
    if (prevCompleted !== nextCompleted) {
      // Handle undefined cases
      if (!prevCompleted || !nextCompleted) {
        return false;
      }
      // Quick size check first
      if (prevCompleted.size !== nextCompleted.size) {
        return false;
      }
      // Content check - only re-render if contents actually differ
      for (const num of nextCompleted) {
        if (!prevCompleted.has(num)) {
          return false;
        }
      }
      // Contents are equal despite different references - skip re-render
    }

    // ✅ MODERATOR FLAG: Re-render if moderator streaming state changes
    // Moderator now renders through normal messageGroups path via messages array
    if (prevProps.isModeratorStreaming !== nextProps.isModeratorStreaming) {
      return false;
    }

    // Re-render if roundNumber changes
    if (prevProps.roundNumber !== nextProps.roundNumber) {
      return false;
    }

    // Skip re-render - no meaningful changes
    return true;
  },
);

ChatMessageList.displayName = 'ChatMessageList';
ParticipantHeader.displayName = 'ParticipantHeader';
ParticipantMessageWrapper.displayName = 'ParticipantMessageWrapper';
