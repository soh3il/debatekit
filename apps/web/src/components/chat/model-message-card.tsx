import type { MessagePartType, MessageStatus } from '@debatekit/shared';
import { getRoleBadgeStyle, MessagePartTypes, MessageStatuses, TextPartStates } from '@debatekit/shared';
import { memo, useMemo } from 'react';
import Markdown from 'react-markdown';

import { Actions } from '@/components/ai-elements/actions';
import { Message, MessageAvatar, MessageContent } from '@/components/ai-elements/message';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { TextShimmer } from '@/components/ai-elements/shimmer';
import { CitedMessageContent } from '@/components/chat/cited-message-content';
import { MessageCopyAction } from '@/components/chat/copy-actions';
import { CustomDataPart } from '@/components/chat/custom-data-part';
import { MessageErrorDetails } from '@/components/chat/message-error-details';
import { ToolCallPart } from '@/components/chat/tool-call-part';
import { ToolResultPart } from '@/components/chat/tool-result-part';
import { LazyStreamdown } from '@/components/markdown/lazy-streamdown';
import { remarkPlugins, streamdownComponents } from '@/components/markdown/unified-markdown-components';
// NOTE: useChatStoreOptional removed - streaming state passed via status prop
// Using store selector caused 80+ re-renders/4s during streaming (all cards subscribed)
import { Badge } from '@/components/ui/badge';
import { StreamingMessageContent } from '@/components/ui/motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMounted } from '@/hooks/utils';
import { useTranslations } from '@/lib/i18n';
import type { MessagePart } from '@/lib/schemas';
import { isDataPart } from '@/lib/schemas/data-part-schema';
import { cn } from '@/lib/ui/cn';
import { hasCitations } from '@/lib/utils';
import type { AvailableSource, DbMessageMetadata, Model } from '@/services/api';
import { isAssistantMessageMetadata } from '@/services/api';

/**
 * Strip ALL [REDACTED] tokens from reasoning text.
 * Models (Grok/xAI, OpenAI o1) include [REDACTED] markers in reasoning to
 * indicate redacted chain-of-thought. These are meaningless to the user.
 * Removes all occurrences (leading, trailing, inline) and collapses whitespace.
 */
function cleanReasoningText(text: string): string {
  return text.replace(/\[REDACTED\]/gi, '').replace(/\s{2,}/g, ' ').trim();
}

function isNonRenderableReasoningPart(part: MessagePart): boolean {
  if (part.type !== MessagePartTypes.REASONING) {
    return false;
  }
  // Always render reasoning parts -- even when text is redacted/empty,
  // the Reasoning component shows "Thought for X seconds" label
  return false;
}

type ModelMessageCardProps = {
  model?: Model | undefined;
  role?: string | null | undefined;
  participantIndex: number;
  status: MessageStatus;
  parts?: MessagePart[] | undefined;
  avatarSrc: string;
  avatarName: string;
  className?: string | undefined;
  messageId?: string | undefined;
  metadata?: DbMessageMetadata | null | undefined;
  isAccessible?: boolean | undefined;
  hideInlineHeader?: boolean | undefined;
  hideAvatar?: boolean | undefined;
  /** Hide the copy action (used for moderator where council actions handle it) */
  hideActions?: boolean | undefined;
  /** Custom loading text to display instead of "Generating response from {model}..." */
  loadingText?: string | undefined;
  /** Max height for scrollable content area. When set, wraps content in ScrollArea */
  maxContentHeight?: number | undefined;
  /**
   * Fallback sources from group messages for streaming citation display
   * When streaming, message metadata isn't populated yet, so we use sources
   * collected from all messages in the same group as fallback.
   */
  groupAvailableSources?: AvailableSource[] | undefined;
  /** Skip opacity transitions for SSR/read-only pages to prevent hydration delay */
  skipTransitions?: boolean | undefined;
};
const DEFAULT_PARTS: MessagePart[] = [];

/**
 * ✅ PERF FIX: Custom memo comparison for ModelMessageCard
 *
 * Problem: Default memo uses reference equality, causing re-renders when:
 * - `parts` array is new reference but same content
 * - `metadata` object is new reference but same content
 * - `groupAvailableSources` array is new reference
 *
 * This comparison function checks meaningful changes only:
 * - Primitive props: direct equality
 * - parts: length + text content (with streaming optimization)
 * - status: most critical for UI updates
 *
 * Streaming optimization: During streaming, text parts are compared by
 * length buckets (50 char increments) instead of exact content. This
 * reduces re-renders from 200+ to ~20-30 per participant.
 */
function arePropsEqual(
  prev: ModelMessageCardProps,
  next: ModelMessageCardProps,
): boolean {
  // Fast path: status changes always trigger re-render (most common during streaming)
  if (prev.status !== next.status) {
    return false;
  }

  // Primitive prop comparisons
  if (
    prev.messageId !== next.messageId
    || prev.participantIndex !== next.participantIndex
    || prev.avatarSrc !== next.avatarSrc
    || prev.avatarName !== next.avatarName
    || prev.role !== next.role
    || prev.className !== next.className
    || prev.hideActions !== next.hideActions
    || prev.hideAvatar !== next.hideAvatar
    || prev.hideInlineHeader !== next.hideInlineHeader
    || prev.isAccessible !== next.isAccessible
    || prev.loadingText !== next.loadingText
    || prev.maxContentHeight !== next.maxContentHeight
    || prev.skipTransitions !== next.skipTransitions
  ) {
    return false;
  }

  // Model comparison (object) - check by ID only
  if (prev.model?.id !== next.model?.id) {
    return false;
  }

  // Parts comparison - the critical one for streaming
  const prevParts = prev.parts ?? DEFAULT_PARTS;
  const nextParts = next.parts ?? DEFAULT_PARTS;

  if (prevParts.length !== nextParts.length) {
    return false;
  }

  // Check parts content - compare both reasoning and text parts for streaming updates
  // Deep comparison would be O(n) - we optimize for streaming case by checking key parts
  if (prevParts.length > 0 && nextParts.length > 0) {
    // Check for reasoning part changes (chain-of-thought streaming)
    // ✅ FIX: Must compare reasoning parts to detect incremental reasoning token updates
    // Previously only compared TEXT parts, causing reasoning to batch instead of stream
    const prevReasoning = prevParts.find(p => p.type === MessagePartTypes.REASONING);
    const nextReasoning = nextParts.find(p => p.type === MessagePartTypes.REASONING);
    const prevReasoningExists = prevReasoning !== undefined;
    const nextReasoningExists = nextReasoning !== undefined;

    if (prevReasoningExists !== nextReasoningExists) {
      return false; // Reasoning part added or removed
    }
    if (prevReasoning && nextReasoning && 'text' in prevReasoning && 'text' in nextReasoning) {
      // Compare reasoning text - triggers re-render for each reasoning chunk
      if (prevReasoning.text !== nextReasoning.text) {
        return false;
      }
      // Also compare streaming state for reasoning
      const prevReasoningState = 'state' in prevReasoning ? prevReasoning.state : undefined;
      const nextReasoningState = 'state' in nextReasoning ? nextReasoning.state : undefined;
      if (prevReasoningState !== nextReasoningState) {
        return false;
      }
    }

    // Check for text part changes (main response streaming)
    const prevText = prevParts.find(p => p.type === MessagePartTypes.TEXT);
    const nextText = nextParts.find(p => p.type === MessagePartTypes.TEXT);

    if (prevText && nextText && 'text' in prevText && 'text' in nextText) {
      // Compare text content directly
      // AI SDK's experimental_throttle (16ms) already limits update frequency
      // React batching handles multiple rapid updates automatically
      if (prevText.text !== nextText.text) {
        return false;
      }
      // ✅ FIX: Also compare text part streaming state for UI updates
      // Without this, state changes (STREAMING -> DONE) might not trigger re-renders
      const prevTextState = 'state' in prevText ? prevText.state : undefined;
      const nextTextState = 'state' in nextText ? nextText.state : undefined;
      if (prevTextState !== nextTextState) {
        return false;
      }
    } else if ((prevText !== undefined) !== (nextText !== undefined)) {
      return false; // Text part added or removed
    }
  }

  // Metadata comparison - check key fields only
  const prevMeta = prev.metadata;
  const nextMeta = next.metadata;
  if (prevMeta !== nextMeta) {
    const prevIsNullish = prevMeta === null || prevMeta === undefined;
    const nextIsNullish = nextMeta === null || nextMeta === undefined;
    // Both null/undefined is equal
    if (prevIsNullish && nextIsNullish) {
      // Equal
    } else if (prevIsNullish || nextIsNullish) {
      return false;
    } else {
      // Check isStreaming flag if present
      const prevIsStreaming = typeof prevMeta === 'object' && 'isStreaming' in prevMeta ? prevMeta.isStreaming : undefined;
      const nextIsStreaming = typeof nextMeta === 'object' && 'isStreaming' in nextMeta ? nextMeta.isStreaming : undefined;
      if (prevIsStreaming !== nextIsStreaming) {
        return false;
      }
      // Check hasError flag if present
      const prevHasError = typeof prevMeta === 'object' && 'hasError' in prevMeta ? prevMeta.hasError : undefined;
      const nextHasError = typeof nextMeta === 'object' && 'hasError' in nextMeta ? nextMeta.hasError : undefined;
      if (prevHasError !== nextHasError) {
        return false;
      }
      // Check isEmptyResponse flag if present (set when a participant produces 0-char output)
      const prevEmpty = typeof prevMeta === 'object' && 'isEmptyResponse' in prevMeta ? prevMeta.isEmptyResponse : undefined;
      const nextEmpty = typeof nextMeta === 'object' && 'isEmptyResponse' in nextMeta ? nextMeta.isEmptyResponse : undefined;
      if (prevEmpty !== nextEmpty) {
        return false;
      }
    }
  }

  // groupAvailableSources - compare by length only (sources don't change during streaming)
  const prevSources = prev.groupAvailableSources;
  const nextSources = next.groupAvailableSources;
  if ((prevSources?.length ?? 0) !== (nextSources?.length ?? 0)) {
    return false;
  }

  return true;
}

export const ModelMessageCard = memo(({
  avatarName,
  avatarSrc,
  className,
  groupAvailableSources,
  hideActions = false,
  hideAvatar = false,
  hideInlineHeader = false,
  isAccessible,
  loadingText,
  maxContentHeight,
  messageId,
  metadata,
  model,
  participantIndex: _participantIndex,
  parts = DEFAULT_PARTS,
  role,
  skipTransitions = false,
  status,
}: ModelMessageCardProps) => {
  const t = useTranslations();
  const isMounted = useIsMounted();
  const modelIsAccessible = model ? (isAccessible ?? model.is_accessible_to_user) : true;

  // ============================================================================
  // STATUS DERIVATION - Per-Participant Streaming Detection
  // ============================================================================
  //
  // HOW THE STATUS PROP IS DERIVED (in chat-message-list.tsx):
  // 1. getParticipantInfoForMessage() determines isStreaming per-message by checking:
  //    - finishReason being a completion reason (stop, length, content_filter, etc.)
  //    - metadata.isStreaming === false (set by AI SDK when the stream closes)
  //    - For moderator: also checks isModeratorStreaming flag
  //
  // 2. getMessageStatus() converts participantInfo.isStreaming to MessageStatus:
  //    - isStreaming=true + no content -> PENDING
  //    - isStreaming=true + has content -> STREAMING
  //    - isStreaming=false (or has finishReason) -> COMPLETE
  //    - hasError=true -> FAILED
  //
  // WHY PULSATING DOT STOPS CORRECTLY FOR EACH PARTICIPANT:
  // - Each message gets its own status based on its finishReason or metadata.isStreaming
  // - When participant A finishes (finishReason='stop'), its status becomes COMPLETE
  // - Participant B can still be STREAMING independently
  // - The showStatusIndicator check below uses THIS participant's status, not global state
  //
  // ✅ FIX: Use status prop instead of store subscription to reduce re-renders
  // Previously used useChatStoreOptional(s => s.isStreaming) which caused all ModelMessageCard
  // instances to re-render whenever ANY store state changed (80+ re-renders in 4s)
  // Now we derive streaming state from the status prop passed by parent
  // ============================================================================
  const isExpectingContentFromProps = status === MessageStatuses.PENDING || status === MessageStatuses.STREAMING;

  // ✅ PERF: Single-pass parts analysis replaces 5 separate .filter()/.some() scans
  // Previously: filter(renderable) + some(streaming) + some(filteredReasoning) + some(visibleText) + filter(text).map().join()
  // Now: one loop computes all derived values
  const partsAnalysis = useMemo(() => {
    const renderable: MessagePart[] = [];
    let anyStreaming = false;
    let anyFinalized = false;
    let filteredReasoning = false;
    let visibleText = false;
    let streamingText = false;
    let joinedText = '';

    for (const part of parts) {
      // Check for streaming/finalized state on any part
      if ('state' in part) {
        if (part.state === TextPartStates.STREAMING) {
          anyStreaming = true;
        } else if (part.state === TextPartStates.DONE) {
          anyFinalized = true;
        }
      }

      // Filter non-renderable reasoning parts
      if (isNonRenderableReasoningPart(part)) {
        if (part.type === MessagePartTypes.REASONING) {
          filteredReasoning = true;
        }
        continue;
      }

      renderable.push(part);

      // Check visible content + collect text in one pass
      if (part.type === MessagePartTypes.TEXT && 'text' in part && typeof part.text === 'string') {
        if (part.text.trim().length > 0) {
          visibleText = true;
          joinedText += (joinedText ? '\n\n' : '') + part.text;
        }
        if ('state' in part && part.state === TextPartStates.STREAMING) {
          streamingText = true;
        }
      } else if (part.type === MessagePartTypes.REASONING && 'text' in part) {
        if (typeof part.text === 'string' && part.text.trim().length > 0) {
          visibleText = true;
        }
      } else if (part.type === MessagePartTypes.TOOL_CALL || part.type === MessagePartTypes.TOOL_RESULT) {
        visibleText = true;
      }
    }

    return {
      hasAnyFinalized: anyFinalized,
      hasAnyStreaming: anyStreaming,
      hasFilteredReasoning: filteredReasoning,
      hasStreamingText: streamingText,
      hasVisibleText: visibleText,
      renderableParts: renderable,
      textContent: joinedText.trim(),
    };
  }, [parts]);

  const { hasAnyFinalized, hasAnyStreaming, hasFilteredReasoning: hasFilteredReasoningParts, hasStreamingText: _hasStreamingText, hasVisibleText: hasVisibleTextContent, renderableParts, textContent: _textContent } = partsAnalysis;

  // Gated by isExpectingContentFromProps to stop indicator once parent determines complete
  const hasActualStreamingParts = isExpectingContentFromProps && hasAnyStreaming;

  // Compute error state early so we can use it for shimmer and status indicator
  const isError = status === MessageStatuses.FAILED;
  const assistantMetadata = metadata && isAssistantMessageMetadata(metadata) ? metadata : null;
  const hasError = isError || assistantMetadata?.hasError;

  // ✅ FIX: When parts have been finalized (state=DONE) with no streaming parts remaining,
  // the participant has completed -- do NOT expect more content even if status prop
  // hasn't transitioned to COMPLETE yet (timing gap between store mutation and re-render).
  // This prevents shimmer from showing indefinitely for participants that complete with 0 chars.
  const partsIndicateComplete = hasAnyFinalized && !hasAnyStreaming;
  const isExpectingContent = (status === MessageStatuses.PENDING || status === MessageStatuses.STREAMING) && !partsIndicateComplete;

  const showShimmer = !hasError && !hasVisibleTextContent && isExpectingContent;

  // ✅ FIX: Don't render anything when there's no renderable content and nothing pending.
  // Covers: (1) redacted reasoning filtered away, (2) empty virtual messages from
  // splitUnifiedStreamMessages (P0 can get an empty segment), (3) messages with only
  // non-renderable part types. The shimmer layer (always present, ~40px) would otherwise
  // create an empty gap visible to the user.
  if (renderableParts.length === 0 && !isExpectingContent && !hasError) {
    return null;
  }

  // ============================================================================
  // PULSATING DOT INDICATOR
  // ============================================================================
  // Shows when THIS specific participant is still streaming:
  // - PENDING with no parts = waiting for first token (thinking)
  // - hasActualStreamingParts = actively receiving tokens
  //
  // CRITICAL: hasActualStreamingParts is gated by isExpectingContentFromProps
  // which uses the status prop. So even if parts have stale state='streaming',
  // the dot stops once status becomes COMPLETE (per-participant, not global).
  // ============================================================================
  const showStatusIndicator = !hasError && (
    (status === MessageStatuses.PENDING && parts.length === 0)
    || hasActualStreamingParts
  );

  const isStreaming = hasActualStreamingParts;

  const modelName = model?.name || assistantMetadata?.model || 'AI Assistant';
  const requiredTierName = model?.required_tier_name;

  return (
    <div className={cn('space-y-1', className)}>
      <Message from="assistant">
        <MessageContent variant="flat" className={hasError ? 'text-destructive' : undefined}>
          <>
            {!hideInlineHeader && (
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <h3 className="contents">
                  <bdi className="text-xl font-semibold text-muted-foreground">
                    {modelName}
                  </bdi>
                </h3>
                {role && (
                  <Badge
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={getRoleBadgeStyle(role)}
                  >
                    {String(role)}
                  </Badge>
                )}
                {!modelIsAccessible && requiredTierName && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {t('chat.participant.tierRequired', { tier: requiredTierName })}
                  </Badge>
                )}
                {showStatusIndicator && (
                  <span className="ms-1 size-1.5 rounded-full bg-primary/60 animate-pulse" />
                )}
                {hasError && (
                  <span className="ms-1 size-1.5 rounded-full bg-destructive/80" />
                )}
              </div>
            )}
            {hasError && (
              <MessageErrorDetails
                metadata={metadata}
                className="mb-2"
              />
            )}
            <div className="grid w-full min-w-0" dir="auto" data-message-content>
              <div
                style={{ gridArea: '1/1' }}
                className={cn(
                  'py-2 text-muted-foreground text-base',
                  !skipTransitions && isMounted && 'transition-opacity duration-200 ease-out',
                  showShimmer ? 'opacity-100' : 'opacity-0 pointer-events-none',
                )}
              >
                <TextShimmer>{loadingText ?? t('chat.participant.generating', { model: modelName })}</TextShimmer>
              </div>
              {!showShimmer && !hasVisibleTextContent && parts.length > 0 && !hasError && !isExpectingContent && (
                <div
                  style={{ gridArea: '1/1' }}
                  className="py-2 text-muted-foreground text-sm italic opacity-100"
                >
                  {hasFilteredReasoningParts
                    ? t('chat.participant.reasoningOnlyResponse', { model: modelName })
                    : t('chat.participant.emptyResponse', { model: modelName })}
                </div>
              )}
              <div
                style={{ gridArea: '1/1' }}
                className={cn(
                  'min-w-0',
                  !skipTransitions && isMounted && 'transition-opacity duration-200 ease-out',
                  hasVisibleTextContent ? 'opacity-100' : 'opacity-0 pointer-events-none',
                )}
              >
                <StreamingMessageContent>
                  {hasVisibleTextContent && (
                    maxContentHeight
                      ? (
                          <ScrollArea
                            className="pr-3"
                            style={{ maxHeight: maxContentHeight }}
                          >
                            {renderContentParts()}
                          </ScrollArea>
                        )
                      : renderContentParts()
                  )}
                </StreamingMessageContent>
              </div>
            </div>

            {!hideActions && (() => {
              const isComplete = status === MessageStatuses.COMPLETE;
              // ✅ PERF: Use pre-computed values from single-pass partsAnalysis
              const hasText = _textContent.length > 0;

              if (!isComplete || !hasText || _hasStreamingText) {
                return null;
              }

              return (
                <Actions className="mt-4">
                  <MessageCopyAction messageText={_textContent} />
                </Actions>
              );
            })()}
          </>
        </MessageContent>
        {!hideAvatar && <MessageAvatar src={avatarSrc} name={avatarName} />}
      </Message>
    </div>
  );

  function renderContentParts() {
    const MESSAGE_PART_ORDER: Readonly<Record<MessagePartType, number>> = {
      [MessagePartTypes.FILE]: 4,
      [MessagePartTypes.REASONING]: 0,
      [MessagePartTypes.SOURCE_DOCUMENT]: 7,
      [MessagePartTypes.SOURCE_URL]: 6,
      [MessagePartTypes.STEP_START]: 5,
      [MessagePartTypes.TEXT]: 1,
      [MessagePartTypes.TOOL_CALL]: 2,
      [MessagePartTypes.TOOL_RESULT]: 3,
    };
    const sortedParts = [...renderableParts].sort((a, b) => {
      return MESSAGE_PART_ORDER[a.type] - MESSAGE_PART_ORDER[b.type];
    });
    return sortedParts.map((part, partIndex) => {
      if (part.type === MessagePartTypes.TEXT) {
        const textHasCitations = hasCitations(part.text);
        const resolvedCitations = assistantMetadata?.citations;

        if (textHasCitations) {
          // ✅ FIX: Merge sources from metadata and group, preferring ones with real titles
          // Issue: metadata.availableSources may have generic titles ("Attached File")
          // while groupAvailableSources (from streaming) may have real titles (filenames)
          // We need to merge and prefer the better quality data
          const effectiveSources = (() => {
            const metadataSources = assistantMetadata?.availableSources;
            const groupSources = groupAvailableSources;

            // If only one source exists, use it
            if (!metadataSources?.length && !groupSources?.length) {
              return undefined;
            }
            if (!metadataSources?.length) {
              return groupSources;
            }
            if (!groupSources?.length) {
              return metadataSources;
            }

            // Merge sources, preferring ones with real titles/filenames
            const merged = new Map<string, AvailableSource>();

            // Add metadata sources first
            for (const source of metadataSources) {
              if (source.id) {
                merged.set(source.id, source);
              }
            }

            // Override with group sources if they have better data
            const GENERIC_TITLES = ['Attached File', 'Project Memory', 'Previous Conversation', 'Indexed Document'];
            for (const source of groupSources) {
              if (!source.id) {
                continue;
              }
              const existing = merged.get(source.id);
              if (!existing) {
                merged.set(source.id, source);
              } else {
                // Check if group source has better title/filename
                const existingIsGeneric = !existing.title || GENERIC_TITLES.includes(existing.title);
                const groupHasRealTitle = source.title && !GENERIC_TITLES.includes(source.title);
                const groupHasFilename = source.filename && source.filename.trim();
                const existingHasFilename = existing.filename && existing.filename.trim();

                if ((existingIsGeneric && groupHasRealTitle) || (!existingHasFilename && groupHasFilename)) {
                  merged.set(source.id, source);
                }
              }
            }

            return Array.from(merged.values());
          })();

          return (
            <div key={messageId ? `${messageId}-text-${partIndex}` : `text-${partIndex}`} dir="auto" className="min-w-0">
              <CitedMessageContent
                text={part.text}
                citations={resolvedCitations}
                availableSources={effectiveSources}
                isStreaming={isStreaming}
                className="text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                skipTransitions={skipTransitions}
              />
            </div>
          );
        }

        // Use ReactMarkdown for SSR/read-only pages, LazyStreamdown for interactive streaming
        return (
          <div
            key={messageId ? `${messageId}-text-${partIndex}` : `text-${partIndex}`}
            dir="auto"
            className="min-w-0 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          >
            {skipTransitions
              ? (
                  // SSR: Direct import renders synchronously - no hydration flash
                  <Markdown remarkPlugins={remarkPlugins} components={streamdownComponents}>{part.text}</Markdown>
                )
              : (
                  // Client-side streaming: Use lazy-loaded streamdown
                  <LazyStreamdown
                    className="text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                    components={streamdownComponents}
                  >
                    {part.text}
                  </LazyStreamdown>
                )}
          </div>
        );
      }
      if (part.type === MessagePartTypes.REASONING) {
        const reasoningMetadata = metadata && isAssistantMessageMetadata(metadata) ? metadata : null;
        const storedDuration = reasoningMetadata?.reasoningDuration;

        const reasoningPartState = 'state' in part ? part.state : undefined;
        const isReasoningStreaming = reasoningPartState === TextPartStates.STREAMING;

        // Strip [REDACTED] tokens for display — models append/intersperse these to indicate redaction
        const displayText = isReasoningStreaming ? part.text : cleanReasoningText(part.text);

        const hasContent = !!displayText;

        return (
          <Reasoning
            key={messageId ? `${messageId}-reasoning-${partIndex}` : `reasoning-${partIndex}`}
            isStreaming={isReasoningStreaming}
            initialContentLength={!isReasoningStreaming ? (displayText?.length ?? 0) : 0}
            storedDuration={storedDuration}
            className="w-full"
          >
            <ReasoningTrigger />
            {hasContent && <ReasoningContent>{displayText}</ReasoningContent>}
          </Reasoning>
        );
      }
      if (part.type === MessagePartTypes.TOOL_CALL) {
        return (
          <ToolCallPart
            key={messageId ? `${messageId}-tool-call-${partIndex}` : `tool-call-${partIndex}`}
            part={part}
            className="my-2"
          />
        );
      }
      if (part.type === MessagePartTypes.TOOL_RESULT) {
        return (
          <ToolResultPart
            key={messageId ? `${messageId}-tool-result-${partIndex}` : `tool-result-${partIndex}`}
            part={part}
            className="my-2"
          />
        );
      }
      if (isDataPart(part)) {
        return (
          <CustomDataPart
            key={messageId ? `${messageId}-data-${partIndex}` : `data-${partIndex}`}
            part={part}
            className="my-2"
          />
        );
      }
      return null;
    });
  }
}, arePropsEqual);

ModelMessageCard.displayName = 'ModelMessageCard';
