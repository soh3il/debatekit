import { useChatMessages } from '@ai-sdk-tools/store';
import type { ChatMode, ScreenMode } from '@debatekit/shared';
import { ChatModeSchema, ErrorBoundaryContexts, ScreenModes, SidebarStates } from '@debatekit/shared';
import type { UIMessage } from 'ai';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ChatInput } from '@/components/chat/chat-input';
import { ChatInputContainer } from '@/components/chat/chat-input-container';
import { ChatInputHeader } from '@/components/chat/chat-input-header';
import type { ChatInputToolbarMenuProps } from '@/components/chat/chat-input-toolbar-lazy';
import { ChatScrollButton } from '@/components/chat/chat-scroll-button';
import type { ConversationModeModalProps } from '@/components/chat/conversation-mode-modal';
import type { ModelSelectionModalProps } from '@/components/chat/model-selection-modal';
import { ThreadTimeline } from '@/components/chat/thread-timeline';
import { UnifiedErrorBoundary } from '@/components/chat/unified-error-boundary';
import { useChatStore, useChatStoreApi } from '@/components/providers';
import { useSidebarOptional } from '@/components/ui/sidebar';
import { useCustomRolesQuery, useModelsQuery, useThreadChangelogQuery } from '@/hooks/queries';
import type { TimelineItem, UseChatAttachmentsReturn } from '@/hooks/utils';
import {
  useBoolean,
  useChatScroll,
  useMediaQuery,
  useOrderedModels,
  useThreadTimeline,
  useVisualViewportPosition,
} from '@/hooks/utils';
import { getDefaultChatMode } from '@/lib/config/chat-modes';
import type { ModelPreset } from '@/lib/config/model-presets';
import { filterPresetParticipants, ToastNamespaces } from '@/lib/config/model-presets';
import { useTranslations } from '@/lib/i18n';
import type { ParticipantConfig } from '@/lib/schemas';
import { isFilePart } from '@/lib/schemas';
import { useShallow } from '@/lib/store';
import { toastManager } from '@/lib/toast';
import {
  getDetailedIncompatibleModelIds,
  getModeratorMetadata,
  getParticipantIndex,
  getRoundNumber,
  isDocumentFile,
  isImageFile,
  isModeratorMessage,
  isVisionRequiredMimeType,
  resolveManualModeParticipants,
  splitUnifiedStreamMessages,
  supplementPresetParticipants,
} from '@/lib/utils';
import dynamic from '@/lib/utils/dynamic';
import type { ApiChangelog, ApiParticipant, Model, StoredPreSearch } from '@/services/api';
import {
  ChatPhases,
  deriveWaitingToStartStreaming,
  useAutoModeAnalysis,
  useChatFormActions,
  useThreadActions,
} from '@/stores/chat';

const ModelSelectionModal = dynamic<ModelSelectionModalProps>(
  () => import('@/components/chat/model-selection-modal').then(m => ({ default: m.ModelSelectionModal })),
  { ssr: false },
);
const ConversationModeModal = dynamic<ConversationModeModalProps>(
  () => import('@/components/chat/conversation-mode-modal').then(m => ({ default: m.ConversationModeModal })),
  { ssr: false },
);
const ChatInputToolbarMenu = dynamic<ChatInputToolbarMenuProps>(
  () => import('@/components/chat/chat-input-toolbar-lazy').then(m => ({ default: m.ChatInputToolbarMenu })),
  { ssr: false },
);

export type ChatViewProps = {
  user: {
    name: string;
    image: string | null;
  };
  slug?: string;
  mode: ScreenMode;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  chatAttachments: UseChatAttachmentsReturn;
  threadId?: string;
  /**
   * SSR: Initial messages from route loader for first paint
   * Store may be empty during SSR - use these for immediate content render
   */
  initialMessages?: UIMessage[];
  /**
   * SSR: Initial participants from route loader for first paint
   */
  initialParticipants?: ApiParticipant[];
  /**
   * SSR: Initial pre-searches from route loader for first paint
   * Store may be empty during SSR - use these for immediate content render
   */
  initialPreSearches?: StoredPreSearch[];
  /**
   * SSR: Initial changelog from route loader for first paint
   * Ensures changelog accordion shows on SSR without waiting for client-side query
   */
  initialChangelog?: ApiChangelog[];
  /**
   * Skip entrance animations for SSR-hydrated content to prevent flash
   */
  skipEntranceAnimations?: boolean;
};

export function ChatView({
  chatAttachments,
  initialChangelog,
  initialMessages,
  initialParticipants,
  initialPreSearches,
  mode,
  onSubmit,
  skipEntranceAnimations = false,
  slug,
  threadId: serverThreadId,
  user,
}: ChatViewProps) {
  const t = useTranslations();

  const isModeModalOpen = useBoolean(false);
  const isModelModalOpen = useBoolean(false);

  const attachmentClickRef = useRef<(() => void) | null>(null);
  // Track initial mount to skip showing "models deselected" toast on page load
  const hasCompletedInitialMountRef = useRef(false);
  const handleAttachmentClick = useCallback(() => {
    attachmentClickRef.current?.();
  }, []);

  // AI SDK owns live/streaming messages via @ai-sdk-tools/store.
  // initialMessages from route loader has full DB history.
  const aiMessages = useChatMessages();

  const {
    addChangelogItems,
    autoMode,
    changelogItems,
    contextParticipants,
    createdThreadId,
    currentParticipantIndex,
    currentRoundNumber,
    dataSources,
    enableWebSearch,
    hasInitiallyLoaded,
    inputValue,
    isAnalyzingPrompt,
    isCreatingThread,
    isModeratorStreaming,
    isStreaming,
    modelOrder,
    phase,
    preSearches,
    selectedMode,
    selectedParticipants,
    setAutoMode,
    setInputValue,
    setModelOrder,
    setSelectedParticipants,
    showInitialUI,
    streamingRoundNumber,
    thread,
    waitingToStartStreaming,
  } = useChatStore(
    useShallow(s => ({
      addChangelogItems: s.addChangelogItems,
      autoMode: s.autoMode,
      changelogItems: s.changelogItems,
      contextParticipants: s.participants,
      createdThreadId: s.createdThreadId,
      currentParticipantIndex: s.currentParticipantIndex,
      // Needed for completedRoundNumbers fallback when phase is COMPLETE
      currentRoundNumber: s.currentRoundNumber,
      dataSources: s.dataSources,
      enableWebSearch: s.enableWebSearch,
      hasInitiallyLoaded: s.hasInitiallyLoaded,
      inputValue: s.inputValue,
      isAnalyzingPrompt: s.isAnalyzingPrompt,
      isCreatingThread: s.isCreatingThread,
      // Derive streaming state from phase (source of truth)
      isModeratorStreaming: s.phase === ChatPhases.MODERATOR,
      isStreaming: s.phase === ChatPhases.PRESEARCH
        || s.phase === ChatPhases.PARTICIPANTS
        || s.phase === ChatPhases.MODERATOR,
      modelOrder: s.modelOrder,
      phase: s.phase,
      preSearches: s.preSearches,
      selectedMode: s.selectedMode,
      selectedParticipants: s.selectedParticipants,
      setAutoMode: s.setAutoMode,
      setInputValue: s.setInputValue,
      setModelOrder: s.setModelOrder,
      setSelectedParticipants: s.setSelectedParticipants,
      showInitialUI: s.showInitialUI,
      // streamingRoundNumber is same as currentRoundNumber when streaming
      // BUG 1 FIX: Also include waitingToStartStreaming so moderator placeholder
      // appears immediately alongside participant placeholders (not delayed until
      // phase transitions from IDLE to PARTICIPANTS/PRESEARCH).
      streamingRoundNumber: (s.phase === ChatPhases.PRESEARCH
        || s.phase === ChatPhases.PARTICIPANTS
        || s.phase === ChatPhases.MODERATOR
        || (s.pendingMessage !== null
          && (s.phase === ChatPhases.IDLE || s.phase === ChatPhases.COMPLETE)
          && s.currentRoundNumber !== null
          && s.currentRoundNumber >= 0))
        ? s.currentRoundNumber
        : null,
      thread: s.thread,
      waitingToStartStreaming: deriveWaitingToStartStreaming(s.phase, s.pendingMessage),
    })),
  );

  const storeApi = useChatStoreApi();
  const getIsStreamingFromStore = useCallback(() => {
    const state = storeApi.getState();
    // Derive streaming state from phase (source of truth)
    return state.phase === ChatPhases.PRESEARCH
      || state.phase === ChatPhases.PARTICIPANTS
      || state.phase === ChatPhases.MODERATOR;
  }, [storeApi]);

  const effectiveThreadId = serverThreadId || thread?.id || createdThreadId || '';
  const currentStreamingParticipant = contextParticipants[currentParticipantIndex] || null;

  // ✅ DEDUP FIX: Split accumulated multi-participant messages BEFORE merge/dedup.
  // AI SDK accumulates all participant responses into ONE unified message during streaming.
  // The unified message's metadata gets overwritten to the LAST participant (e.g., participantIndex: 2).
  // If we dedup BEFORE splitting, the unified message passes dedup checks (its metadata says "P2"
  // while DB has P0, P1), then splitting produces virtual P0+P1+P2 = duplicates with DB's P0+P1.
  // By splitting first, each virtual message has correct per-participant metadata for accurate dedup.
  const splitAiMessages = useMemo(
    () => {
      if (aiMessages.length === 0 || !effectiveThreadId) {
        return [];
      }
      // Build participant model lookup inline - contextParticipants may be empty during early resume,
      // splitUnifiedStreamMessages handles this gracefully (falls back to data-phase marker data).
      const lookup = new Map<number, string>();
      contextParticipants.forEach((p, idx) => {
        lookup.set(idx, p.modelId);
      });
      return splitUnifiedStreamMessages(aiMessages, lookup);
    },
    [aiMessages, contextParticipants, effectiveThreadId],
  );

  // Merge: base history + any new split messages from current session (deduplicated).
  const messages = useMemo(() => {
    const base = initialMessages ?? [];
    if (splitAiMessages.length === 0) {
      return base;
    }
    const existingIds = new Set(base.map(m => m.id));
    // Content+round dedup for user messages (AI SDK generates random IDs that won't match DB IDs)
    // Uses roundNumber:text composite key so identical text in different rounds is preserved
    const existingUserKeys = new Set(
      base
        .filter(m => m.role === 'user')
        .map((m) => {
          const textPart = m.parts?.find(p => p.type === 'text');
          const text = textPart && 'text' in textPart ? (textPart.text as string)?.trim() : '';
          if (!text) {
            return '';
          }
          const round = getRoundNumber(m.metadata) ?? 0;
          return `r${round}:${text}`;
        })
        .filter(Boolean),
    );
    // Metadata-based dedup for assistant messages (roundNumber + participantIndex/moderator)
    const existingAssistantKeys = new Set(
      base
        .filter(m => m.role === 'assistant')
        .map((m) => {
          const roundNum = getRoundNumber(m.metadata);
          if (roundNum === null) {
            return '';
          }
          if (isModeratorMessage(m)) {
            return `r${roundNum}_mod`;
          }
          const pIdx = getParticipantIndex(m.metadata);
          return pIdx !== null ? `r${roundNum}_p${pIdx}` : '';
        })
        .filter(Boolean),
    );

    const newMessages = splitAiMessages.filter((m) => {
      if (existingIds.has(m.id)) {
        return false;
      }
      if (m.role === 'user') {
        const textPart = m.parts?.find(p => p.type === 'text');
        const content = textPart && 'text' in textPart ? (textPart.text as string)?.trim() : '';
        if (content) {
          const round = getRoundNumber(m.metadata) ?? 0;
          if (existingUserKeys.has(`r${round}:${content}`)) {
            return false;
          }
        }
      }
      // Assistant dedup: skip if base already has message for same (round, participant/moderator)
      if (m.role === 'assistant') {
        const roundNum = getRoundNumber(m.metadata);
        if (roundNum !== null) {
          const key = isModeratorMessage(m)
            ? `r${roundNum}_mod`
            : (() => {
                const pIdx = getParticipantIndex(m.metadata);
                return pIdx !== null ? `r${roundNum}_p${pIdx}` : '';
              })();
          if (key && existingAssistantKeys.has(key)) {
            return false;
          }
        }
      }
      return true;
    });

    return newMessages.length > 0 ? [...base, ...newMessages] : base;
  }, [splitAiMessages, initialMessages]);

  // ✅ SSR FIX: Compute effective data EARLY for use in completedRoundNumbers
  // Store hydration happens in useLayoutEffect (client-only), so server renders with empty store
  // Fall back to initialMessages/initialParticipants/initialPreSearches for SSR content paint
  // Messages are already split via splitAiMessages before merge, so no second split needed.
  const effectiveMessages = useMemo(
    () => messages.length > 0 ? messages : (initialMessages ?? []),
    [messages, initialMessages],
  );

  const effectiveParticipants = useMemo(
    () => contextParticipants.length > 0 ? contextParticipants : (initialParticipants ?? []),
    [contextParticipants, initialParticipants],
  );
  // ✅ FIX: Filter pre-searches by threadId to prevent cross-thread contamination during navigation
  // During thread navigation, the store may still contain pre-searches from the previous thread.
  // Without this filter, stale pre-searches could be displayed (e.g., showing "streaming" state
  // for a completed pre-search from another thread that happens to have the same round number).
  const effectivePreSearches = useMemo(
    () => {
      const raw = preSearches.length > 0 ? preSearches : (initialPreSearches ?? []);
      return effectiveThreadId ? raw.filter(ps => ps.threadId === effectiveThreadId) : raw;
    },
    [preSearches, initialPreSearches, effectiveThreadId],
  );

  // ✅ MOVED UP: Need completedRoundNumbers early for shouldSkipAuxiliaryQueries
  // ✅ PERF FIX: Use ref to stabilize Set reference - only create new Set when contents change
  // Previously, useMemo created a new Set on every messages change, causing ChatMessageList
  // memo comparison to always fail (reference inequality) even when contents were identical.
  // This caused unnecessary re-renders and the "round flash" at round completion.
  const completedRoundNumbersRef = useRef<Set<number>>(new Set());
  const completedRoundNumbers = useMemo(() => {
    const completed = new Set<number>();
    effectiveMessages.forEach((msg) => {
      if (isModeratorMessage(msg)) {
        const moderatorMeta = getModeratorMetadata(msg.metadata);
        const roundNum = getRoundNumber(msg.metadata);

        // ✅ CHANGELOG FIX: Count round as complete if moderator has either:
        // 1. finishReason (explicit completion signal from backend), OR
        // 2. Non-streaming text content (message is complete even if finishReason missing)
        // 3. hasError flag (moderator failed but round finished - backend marked error)
        // This fixes changelog not showing on SSR when finishReason isn't in metadata
        const hasFinishReason = !!moderatorMeta?.finishReason;
        const hasNonStreamingContent = msg.parts?.some(
          p => p.type === 'text' && 'text' in p && typeof p.text === 'string' && p.text.trim().length > 0
            && (!('state' in p) || p.state !== 'streaming'),
        ) ?? false;
        // ✅ MODERATOR ERROR FIX: A moderator with hasError=true means the round completed
        // but the moderator failed to generate a summary. Treat as complete so the UI
        // doesn't get stuck showing pending state on page reload.
        const hasModeratorError = moderatorMeta && 'hasError' in moderatorMeta && moderatorMeta.hasError === true;

        if ((hasFinishReason || hasNonStreamingContent || hasModeratorError) && roundNum !== null) {
          completed.add(roundNum);
        }
      }
    });
    // ✅ PHASE FIX: When phase is COMPLETE, treat the current round as complete
    // This enables input immediately when moderator finishes.
    // Uses currentRoundNumber (not streamingRoundNumber) because streamingRoundNumber
    // is derived as null when phase !== PRESEARCH/PARTICIPANTS/MODERATOR, making the
    // previous check dead code. currentRoundNumber persists through COMPLETE phase.
    if (phase === ChatPhases.COMPLETE && currentRoundNumber !== null) {
      completed.add(currentRoundNumber);
    }

    // ✅ STABLE REFERENCE: Only return new Set if contents actually changed
    const prevSet = completedRoundNumbersRef.current;
    if (prevSet.size === completed.size && [...prevSet].every(n => completed.has(n))) {
      return prevSet; // Contents unchanged - return stable reference
    }
    completedRoundNumbersRef.current = completed;
    return completed;
  }, [effectiveMessages, phase, currentRoundNumber]);

  // ✅ PERF: Detect when auxiliary queries should be skipped
  // Changelog/feedback data only exists AFTER a round completes, so skip when:
  // 1. Initial creation flow (just created from overview, streaming round 0)
  // 2. First round is currently streaming
  // 3. No completed rounds yet AND not returning to existing thread with data
  const isInitialCreationFlow = Boolean(createdThreadId) && streamingRoundNumber === 0;
  // Skip during ANY active streaming, not just first round - prevents changelog blocking Round 2+ UI
  const isActivelyStreaming = isStreaming || isModeratorStreaming || waitingToStartStreaming;
  const hasNoCompletedRounds = completedRoundNumbers.size === 0;
  // ✅ FIX: Don't skip when returning to existing thread with initial messages
  // Race condition: effectiveMessages may be empty during first render before hydration
  // If initialMessages exist from loader, we're returning to an existing thread that has data
  const isReturningToExistingThread = mode === ScreenModes.THREAD && effectiveThreadId && initialMessages && initialMessages.length > 0;
  const shouldSkipAuxiliaryQueries = isInitialCreationFlow || isActivelyStreaming || (hasNoCompletedRounds && !isReturningToExistingThread);

  const { data: modelsData, isLoading: isModelsLoading } = useModelsQuery();
  const { data: customRolesData } = useCustomRolesQuery(isModelModalOpen.value && !isStreaming);

  // ✅ PERF: Only fetch changelog for established threads (not during initial creation)
  // This query is not needed during the first round - data doesn't exist yet
  const { data: changelogResponse } = useThreadChangelogQuery(
    effectiveThreadId,
    mode === ScreenModes.THREAD && Boolean(effectiveThreadId) && !shouldSkipAuxiliaryQueries,
  );

  const allEnabledModels = useMemo(() => {
    if (!modelsData?.success) {
      return [];
    }
    return modelsData.data.items;
  }, [modelsData]);

  const customRoles = useMemo(() => {
    if (!customRolesData?.pages) {
      return [];
    }
    return customRolesData.pages.flatMap((page) => {
      if (!page?.success) {
        return [];
      }
      return page.data.items;
    });
  }, [customRolesData?.pages]);

  const userTierConfig = useMemo(() => {
    if (!modelsData?.success) {
      return undefined;
    }
    return modelsData.data.user_tier_config;
  }, [modelsData]);

  // ✅ FIX: Use store's changelogItems for persistence across navigation
  // Store is hydrated on SSR via useSyncHydrateStore, query syncs new items
  const changelog: ApiChangelog[] = useMemo(() => {
    // Use store data, fall back to initial prop for SSR first paint before hydration
    const items = changelogItems.length > 0 ? changelogItems : (initialChangelog ?? []);

    // Deduplicate by ID
    const seen = new Set<string>();
    return items.filter((item: ApiChangelog) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }, [changelogItems, initialChangelog]);

  // ✅ FIX: Sync query response to store for persistence across navigation
  useEffect(() => {
    if (changelogResponse?.success && changelogResponse.data?.items?.length) {
      addChangelogItems(changelogResponse.data.items);
    }
  }, [changelogResponse, addChangelogItems]);

  const orderedModels = useOrderedModels({
    allEnabledModels,
    modelOrder,
    selectedParticipants,
  });

  // Sort selected models to top when modal opens (on revisit)
  useEffect(() => {
    if (!isModelModalOpen.value || selectedParticipants.length === 0) {
      return;
    }

    // Get selected model IDs sorted by priority
    const selectedModelIds = [...selectedParticipants]
      .sort((a, b) => a.priority - b.priority)
      .map(p => p.modelId);

    // Get unselected model IDs in current order
    const unselectedModelIds = modelOrder.filter(id => !selectedModelIds.includes(id));

    // New order: selected first, then unselected
    const newOrder = [...selectedModelIds, ...unselectedModelIds];

    // Only update if order actually changed
    const orderChanged = newOrder.some((id, i) => modelOrder[i] !== id);
    if (orderChanged) {
      setModelOrder(newOrder);
    }
  // Only run when modal opens, not on every participant/order change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModelModalOpen.value]);

  // ✅ GRANULAR: Track vision (image) and file (document) incompatibilities separately
  const incompatibleModelData = useMemo(() => {
    const incompatible = new Set<string>();

    // Add inaccessible models (tier restrictions)
    for (const model of allEnabledModels) {
      if (!model.is_accessible_to_user) {
        incompatible.add(model.id);
      }
    }

    // Check for images in thread and attachments
    const existingImageFiles = messages.some((msg) => {
      if (!msg.parts) {
        return false;
      }
      return msg.parts.some((part) => {
        if (!isFilePart(part)) {
          return false;
        }
        return isImageFile(part.mediaType);
      });
    });
    const newImageFiles = chatAttachments.attachments.some(att =>
      isImageFile(att.file.type),
    );
    const hasImages = existingImageFiles || newImageFiles;

    // Check for documents in thread and attachments
    const existingDocumentFiles = messages.some((msg) => {
      if (!msg.parts) {
        return false;
      }
      return msg.parts.some((part) => {
        if (!isFilePart(part)) {
          return false;
        }
        return isDocumentFile(part.mediaType);
      });
    });
    const newDocumentFiles = chatAttachments.attachments.some(att =>
      isDocumentFile(att.file.type),
    );
    const hasDocuments = existingDocumentFiles || newDocumentFiles;

    // Build file list for capability checking
    const files: { mimeType: string }[] = [];
    if (hasImages) {
      files.push({ mimeType: 'image/png' }); // Representative image type
    }
    if (hasDocuments) {
      files.push({ mimeType: 'application/pdf' }); // Representative document type
    }

    // Get detailed incompatibility info
    // Map models to the shape expected by getDetailedIncompatibleModelIds
    const modelsWithCapabilities = allEnabledModels.map((m: Model) => ({
      capabilities: {
        file: m.supports_file,
        vision: m.supports_vision,
      },
      id: m.id,
    }));
    const {
      fileIncompatibleIds,
      incompatibleIds,
      visionIncompatibleIds,
    } = getDetailedIncompatibleModelIds(modelsWithCapabilities, files);

    // Merge with tier-restricted models
    for (const id of incompatibleIds) {
      incompatible.add(id);
    }

    return {
      fileIncompatibleModelIds: fileIncompatibleIds,
      incompatibleModelIds: incompatible,
      visionIncompatibleModelIds: visionIncompatibleIds,
    };
  }, [messages, chatAttachments.attachments, allEnabledModels]);

  const incompatibleModelIds = incompatibleModelData.incompatibleModelIds;
  const visionIncompatibleModelIds = incompatibleModelData.visionIncompatibleModelIds;
  const fileIncompatibleModelIds = incompatibleModelData.fileIncompatibleModelIds;

  const incompatibleModelIdsRef = useRef(incompatibleModelIds);
  useEffect(() => {
    incompatibleModelIdsRef.current = incompatibleModelIds;
  }, [incompatibleModelIds]);

  // ✅ SSR FIX: effectiveMessages/effectiveParticipants/effectivePreSearches computed earlier
  // for use in completedRoundNumbers. Use effectivePreSearches for timeline.
  const timelineItems: TimelineItem[] = useThreadTimeline({
    changelog,
    messages: effectiveMessages,
    preSearches: effectivePreSearches,
  });

  const inputContainerRef = useRef<HTMLDivElement | null>(null);

  // Sidebar state for dynamic input positioning
  // FLOATING variant with ICON collapsible: collapsed = 6rem (icon + padding), expanded = 20rem
  const sidebarContext = useSidebarOptional();
  const isSidebarCollapsed = sidebarContext?.state === SidebarStates.COLLAPSED;
  // Desktop-first SSR: default to true on server, hydrate to actual viewport
  const isDesktop = useMediaQuery('(min-width: 768px)', true);

  const threadActions = useThreadActions({
    isRoundInProgress: isStreaming || isModeratorStreaming,
    slug: slug || '',
  });

  useEffect(() => {
    // Mark initial mount as complete after first run
    // This prevents showing toast on page load for pre-existing incompatible models
    const isInitialMount = !hasCompletedInitialMountRef.current;
    if (isInitialMount) {
      hasCompletedInitialMountRef.current = true;
    }

    const hasVisualAttachments = chatAttachments.attachments.some(att =>
      isVisionRequiredMimeType(att.file.type),
    );

    // Skip incompatible filter when autoMode is enabled in OVERVIEW mode
    // Server validates model accessibility in auto mode - trust those results
    // ✅ VISION FIX: ALWAYS check vision incompatibility when files are attached
    // Even in auto mode, we need to filter out non-vision models before submission
    if (mode === ScreenModes.OVERVIEW && autoMode && !hasVisualAttachments) {
      return;
    }

    // Skip in OVERVIEW mode with no messages and no visual files
    if (mode === ScreenModes.OVERVIEW && messages.length === 0 && !hasVisualAttachments) {
      return;
    }
    if (incompatibleModelIds.size === 0) {
      return;
    }

    const incompatibleSelected = selectedParticipants.filter(p =>
      incompatibleModelIds.has(p.modelId),
    );

    if (incompatibleSelected.length === 0) {
      return;
    }

    // ✅ GRANULAR: Track deselected models by reason
    const visionDeselected = incompatibleSelected.filter(
      p => visionIncompatibleModelIds.has(p.modelId),
    );
    const fileDeselected = incompatibleSelected.filter(
      p => fileIncompatibleModelIds.has(p.modelId) && !visionIncompatibleModelIds.has(p.modelId),
    );

    const visionModelNames = visionDeselected
      .map((p: ParticipantConfig) => allEnabledModels.find((m: Model) => m.id === p.modelId)?.name)
      .filter((name): name is string => Boolean(name));

    const fileModelNames = fileDeselected
      .map((p: ParticipantConfig) => allEnabledModels.find((m: Model) => m.id === p.modelId)?.name)
      .filter((name): name is string => Boolean(name));

    const compatibleParticipants = selectedParticipants
      .filter(p => !incompatibleModelIds.has(p.modelId))
      .map((p, index) => ({ ...p, priority: index }));

    if (mode === ScreenModes.THREAD) {
      threadActions.handleParticipantsChange(compatibleParticipants);
    } else {
      setSelectedParticipants(compatibleParticipants);
    }

    // ✅ GRANULAR TOASTS: Show specific reason for deselection (not on initial page load)
    if (!isInitialMount) {
      // Toast for vision (image) incompatibility
      if (visionModelNames.length > 0) {
        const modelList = visionModelNames.length <= 2
          ? visionModelNames.join(' and ')
          : `${visionModelNames.slice(0, 2).join(', ')} and ${visionModelNames.length - 2} more`;

        toastManager.warning(
          t('chat.models.modelsDeselected'),
          t('chat.models.modelsDeselectedDueToImages', { models: modelList }),
        );
      }

      // Toast for file (document) incompatibility - separate from vision
      if (fileModelNames.length > 0) {
        const modelList = fileModelNames.length <= 2
          ? fileModelNames.join(' and ')
          : `${fileModelNames.slice(0, 2).join(', ')} and ${fileModelNames.length - 2} more`;

        toastManager.warning(
          t('chat.models.modelsDeselected'),
          t('chat.models.modelsDeselectedDueToDocuments', { models: modelList }),
        );
      }
    }
  }, [mode, autoMode, incompatibleModelIds, visionIncompatibleModelIds, fileIncompatibleModelIds, selectedParticipants, messages, threadActions, setSelectedParticipants, allEnabledModels, t, chatAttachments.attachments]);

  const formActions = useChatFormActions();
  // syncToPreferences=false for ChatView - overview screen handles preference persistence
  const { analyzeAndApply } = useAutoModeAnalysis(false);

  // ✅ SSR FIX: Data is ready if store is hydrated OR initial data is available from props
  // This allows SSR to render content immediately using initialMessages
  const hasInitialDataFromProps = (initialMessages?.length ?? 0) > 0;
  // ✅ CREATION FLOW FIX: Detect active creation flow to prevent skeleton flash
  // When createdThreadId is set and showInitialUI is false, we're mid-creation with valid store data
  const isInActiveCreationFlow = Boolean(createdThreadId) && !showInitialUI;
  const isStoreReady = mode === ScreenModes.THREAD
    ? ((hasInitiallyLoaded && messages.length > 0) || hasInitialDataFromProps || isInActiveCreationFlow)
    : true;

  // Chat scroll hook provides manual scrollToBottom for user-initiated actions only
  // NO auto-scroll on page load - user controls their scroll position
  useChatScroll({
    enableNearBottomDetection: true,
    messages,
  });

  // ✅ SIMPLIFIED: Phase-based input blocking
  // Input blocked during ALL active streaming phases (presearch, participants, moderator)
  // Input enabled when: phase === 'idle' || phase === 'complete'
  const isPhaseBlocking = phase === ChatPhases.PRESEARCH || phase === ChatPhases.PARTICIPANTS || phase === ChatPhases.MODERATOR;

  // Core blocking state for operations in progress.
  // waitingToStartStreaming already checks pendingMessage — no separate Boolean(pendingMessage)
  // needed. Removing it prevents stale pendingMessage from permanently blocking input.
  const isOperationBlocked = isPhaseBlocking
    || isCreatingThread
    || waitingToStartStreaming
    || formActions.isSubmitting
    || isAnalyzingPrompt;

  // Full input blocking includes loading states
  const isInputBlocked = isOperationBlocked || isModelsLoading;

  // Toggle can work even while models load - only block during active operations
  const isToggleDisabled = isOperationBlocked;

  const showSubmitSpinner = formActions.isSubmitting || (waitingToStartStreaming && !isStreaming) || isAnalyzingPrompt;

  const handleAutoModeChange = useCallback((enabled: boolean) => {
    if (enabled) {
      setAutoMode(true);
      return;
    }

    // ChatView (thread context): use thread's API participants as fallback
    const threadParticipants = storeApi.getState().participants;
    const accessibleIds = allEnabledModels
      .filter((m: Model) => m.is_accessible_to_user)
      .map((m: Model) => m.id);

    const resolved = resolveManualModeParticipants({
      accessibleModelIds: accessibleIds,
      currentParticipants: storeApi.getState().selectedParticipants,
      fallbackParticipants: threadParticipants,
      incompatibleModelIds,
    });

    storeApi.setState({ autoMode: false, selectedParticipants: resolved });
  }, [setAutoMode, storeApi, allEnabledModels, incompatibleModelIds]);

  const handleAutoModeSubmit = useCallback(async (e: React.FormEvent) => {
    if (autoMode && inputValue.trim()) {
      // Check for image files to restrict model selection to vision-capable models
      const hasImageFiles = chatAttachments.attachments.some(att =>
        isVisionRequiredMimeType(att.file.type),
      );

      // Check for document files (PDFs, etc.)
      const hasDocumentFiles = chatAttachments.attachments.some(att =>
        isDocumentFile(att.file.type),
      );

      // ✅ FIX: Filter out incompatible models BEFORE passing to analyze
      // This ensures AI only picks from models with BOTH capabilities when both file types present
      // Uses the same incompatibleModelIds computed by the incompatible models effect
      const compatibleAccessibleIds = allEnabledModels
        .filter((m: Model) => m.is_accessible_to_user && !incompatibleModelIds.has(m.id))
        .map((m: Model) => m.id);
      const accessibleModelIds = new Set<string>(compatibleAccessibleIds);

      // Consolidated auto mode analysis - updates store directly
      await analyzeAndApply({
        accessibleModelIds,
        hasDocumentFiles,
        hasImageFiles,
        prompt: inputValue.trim(),
      });
    }
    await onSubmit(e);
  }, [autoMode, inputValue, chatAttachments.attachments, allEnabledModels, incompatibleModelIds, analyzeAndApply, onSubmit]);

  const keyboardOffset = useVisualViewportPosition();

  const handleModeSelect = useCallback((newMode: ChatMode) => {
    if (mode === ScreenModes.THREAD) {
      threadActions.handleModeChange(newMode);
    } else {
      formActions.handleModeChange(newMode);
    }
    isModeModalOpen.onFalse();
  }, [mode, threadActions, formActions, isModeModalOpen]);

  const handleWebSearchToggle = useCallback((enabled: boolean) => {
    if (mode === ScreenModes.THREAD) {
      threadActions.handleWebSearchToggle(enabled);
    } else {
      formActions.handleWebSearchToggle(enabled);
    }
  }, [mode, threadActions, formActions]);

  const handleDataSourceToggle = useCallback((sourceId: string, enabled: boolean) => {
    const current = storeApi.getState().dataSources ?? [];
    let updated: { id: string; config?: Record<string, string> }[] | undefined;
    if (enabled) {
      updated = current.some(ds => ds.id === sourceId) ? current : [...current, { id: sourceId }];
    } else {
      const filtered = current.filter(ds => ds.id !== sourceId);
      updated = filtered.length > 0 ? filtered : undefined;
    }
    if (mode === ScreenModes.THREAD) {
      threadActions.handleDataSourcesChange(updated);
    } else {
      formActions.handleDataSourcesChange(updated);
    }
  }, [mode, storeApi, threadActions, formActions]);

  const handleModelReorder = useCallback((reordered: typeof orderedModels) => {
    const seen = new Set<string>();
    const newModelOrder = reordered
      .map(om => om.model.id)
      .filter((id) => {
        if (seen.has(id)) {
          return false;
        }
        seen.add(id);
        return true;
      });

    setModelOrder(newModelOrder);

    const reorderedParticipants = newModelOrder
      .map((modelId, visualIndex) => {
        const participant = selectedParticipants.find(p => p.modelId === modelId);
        return participant ? { ...participant, priority: visualIndex } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p, idx) => ({ ...p, priority: idx }));

    if (mode === ScreenModes.THREAD) {
      threadActions.handleParticipantsChange(reorderedParticipants);
    } else {
      setSelectedParticipants(reorderedParticipants);
    }
  }, [mode, threadActions, setModelOrder, setSelectedParticipants, selectedParticipants]);

  const handleModelToggle = useCallback((modelId: string) => {
    const orderedModel = orderedModels.find(om => om.model.id === modelId);
    if (!orderedModel) {
      return;
    }

    let updatedParticipants;
    if (orderedModel.participant) {
      const participantToRemove = orderedModel.participant;
      const filtered = selectedParticipants.filter(p => p.id !== participantToRemove.id);
      const sortedByVisualOrder = filtered.sort((a, b) => {
        const aIdx = modelOrder.indexOf(a.modelId);
        const bIdx = modelOrder.indexOf(b.modelId);
        return aIdx - bIdx;
      });
      updatedParticipants = sortedByVisualOrder.map((p, index) => ({ ...p, priority: index }));
    } else {
      const latestIncompatible = incompatibleModelIdsRef.current;
      if (latestIncompatible.has(modelId)) {
        toastManager.warning(
          t('chat.models.cannotSelectModel'),
          t('chat.models.modelIncompatibleWithFiles'),
        );
        return;
      }

      const newParticipant = {
        id: modelId,
        modelId,
        priority: selectedParticipants.length,
        role: '',
      };
      const updated = [...selectedParticipants, newParticipant].sort((a, b) => {
        const aIdx = modelOrder.indexOf(a.modelId);
        const bIdx = modelOrder.indexOf(b.modelId);
        return aIdx - bIdx;
      });
      updatedParticipants = updated.map((p, index) => ({ ...p, priority: index }));
    }

    if (mode === ScreenModes.THREAD) {
      threadActions.handleParticipantsChange(updatedParticipants);
    } else {
      setSelectedParticipants(updatedParticipants);
    }
  }, [orderedModels, selectedParticipants, modelOrder, mode, threadActions, setSelectedParticipants, t]);

  const handleModelRoleChange = useCallback((modelId: string, role: string, customRoleId?: string) => {
    const updated = selectedParticipants.map(p =>
      p.modelId === modelId ? { ...p, customRoleId, role } : p,
    );
    if (mode === ScreenModes.THREAD) {
      threadActions.handleParticipantsChange(updated);
    } else {
      setSelectedParticipants(updated);
    }
  }, [selectedParticipants, mode, threadActions, setSelectedParticipants]);

  const handleModelRoleClear = useCallback((modelId: string) => {
    const updated = selectedParticipants.map(p =>
      p.modelId === modelId ? { ...p, customRoleId: undefined, role: '' } : p,
    );
    if (mode === ScreenModes.THREAD) {
      threadActions.handleParticipantsChange(updated);
    } else {
      setSelectedParticipants(updated);
    }
  }, [selectedParticipants, mode, threadActions, setSelectedParticipants]);

  const handlePresetSelect = useCallback(async (preset: ModelPreset) => {
    const result = await filterPresetParticipants(
      preset,
      incompatibleModelIdsRef.current,
      t,
      ToastNamespaces.CHAT_MODELS,
    );

    if (!result.success) {
      return;
    }

    const accessibleIds = allEnabledModels
      .filter((m: Model) => m.is_accessible_to_user)
      .map((m: Model) => m.id);
    const participants = supplementPresetParticipants({
      accessibleModelIds: accessibleIds,
      incompatibleModelIds: incompatibleModelIdsRef.current,
      participants: result.participants,
    });

    if (mode === ScreenModes.THREAD) {
      threadActions.handleParticipantsChange(participants);
    } else {
      setSelectedParticipants(participants);
    }

    const modelIds = participants.map(p => p.modelId);
    setModelOrder(modelIds);

    if (mode === ScreenModes.THREAD) {
      threadActions.handleModeChange(preset.mode);
    } else {
      formActions.handleModeChange(preset.mode);
    }

    const searchEnabled = preset.searchEnabled === 'conditional' ? true : preset.searchEnabled;
    if (mode === ScreenModes.THREAD) {
      threadActions.handleWebSearchToggle(searchEnabled);
    } else {
      formActions.handleWebSearchToggle(searchEnabled);
    }

    // Store vertical preset data for thread metadata (dataSources, moderatorFormat)
    if (mode === ScreenModes.THREAD) {
      threadActions.handleDataSourcesChange(preset.dataSources);
      threadActions.handleModeratorFormatChange(preset.moderatorFormat);
    } else {
      formActions.handleDataSourcesChange(preset.dataSources);
      formActions.handleModeratorFormatChange(preset.moderatorFormat);
    }
  }, [mode, threadActions, formActions, setSelectedParticipants, setModelOrder, t, allEnabledModels]);

  return (
    <>
      <UnifiedErrorBoundary context={ErrorBoundaryContexts.CHAT}>
        <div className="flex flex-col relative flex-1 min-h-full">
          <div className="container max-w-4xl mx-auto px-5 md:px-6 pt-16 pb-[20rem]">
            <ThreadTimeline
              timelineItems={timelineItems}
              user={user}
              participants={effectiveParticipants}
              threadId={effectiveThreadId}
              threadTitle={thread?.title}
              isStreaming={isStreaming}
              currentParticipantIndex={currentParticipantIndex}
              currentStreamingParticipant={
                isStreaming && currentStreamingParticipant
                  ? currentStreamingParticipant
                  : null
              }
              streamingRoundNumber={streamingRoundNumber}
              preSearches={effectivePreSearches}
              isDataReady={isStoreReady}
              completedRoundNumbers={completedRoundNumbers}
              isModeratorStreaming={isModeratorStreaming}
              getIsStreamingFromStore={getIsStreamingFromStore}
              initialScrollToBottom={false}
              skipEntranceAnimations={skipEntranceAnimations}
            />
          </div>

          <div
            ref={inputContainerRef}
            className="fixed inset-x-0 z-30"
            style={{
              bottom: `${keyboardOffset}px`,
              // Dynamic left offset for desktop based on sidebar state
              // FLOATING variant: collapsed = icon + padding (6rem), expanded = 20rem
              left: isDesktop
                ? (isSidebarCollapsed ? 'calc(var(--sidebar-width-icon) + 2rem)' : 'var(--sidebar-width)')
                : undefined,
            }}
          >
            <div className="absolute inset-0 -bottom-4 bg-gradient-to-t from-background from-85% to-transparent pointer-events-none" />
            <div className="w-full max-w-4xl mx-auto px-5 md:px-6 pt-4 pb-4 relative">
              <ChatScrollButton variant="input" />
              <ChatInputContainer
                participants={selectedParticipants}
                inputValue={inputValue}
                isHydrating={mode === ScreenModes.THREAD && !hasInitiallyLoaded}
                isModelsLoading={isModelsLoading}
                autoMode={autoMode}
              >
                <ChatInputHeader
                  autoMode={autoMode}
                  onAutoModeChange={handleAutoModeChange}
                  isAnalyzing={isAnalyzingPrompt}
                  disabled={isToggleDisabled && !isAnalyzingPrompt}
                  className="border-0 rounded-none"
                />
                <ChatInput
                  className="border-0 shadow-none rounded-none"
                  hideInternalAlerts
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={handleAutoModeSubmit}
                  disabled={isAnalyzingPrompt}
                  status={isInputBlocked ? 'submitted' : 'ready'}
                  placeholder={t('chat.input.placeholder')}
                  participants={selectedParticipants}
                  showCreditAlert
                  attachments={chatAttachments.attachments}
                  onAddAttachments={chatAttachments.addFiles}
                  onRemoveAttachment={chatAttachments.removeAttachment}
                  enableAttachments={!isInputBlocked}
                  attachmentClickRef={attachmentClickRef}
                  isUploading={chatAttachments.isUploading}
                  isHydrating={mode === ScreenModes.THREAD && !hasInitiallyLoaded}
                  isSubmitting={showSubmitSpinner}
                  isModelsLoading={isModelsLoading}
                  autoMode={autoMode}
                  toolbar={(
                    <ChatInputToolbarMenu
                      selectedParticipants={selectedParticipants}
                      allModels={allEnabledModels}
                      onOpenModelModal={isModelModalOpen.onTrue}
                      selectedMode={selectedMode || ChatModeSchema.catch(getDefaultChatMode()).parse(thread?.mode)}
                      onOpenModeModal={isModeModalOpen.onTrue}
                      enableWebSearch={enableWebSearch}
                      onWebSearchToggle={handleWebSearchToggle}
                      dataSources={dataSources}
                      onDataSourceToggle={handleDataSourceToggle}
                      onAttachmentClick={handleAttachmentClick}
                      attachmentCount={chatAttachments.attachments.length}
                      enableAttachments={!isInputBlocked}
                      disabled={isInputBlocked}
                      isModelsLoading={isModelsLoading}
                      autoMode={autoMode}
                    />
                  )}
                />
              </ChatInputContainer>
            </div>
          </div>
        </div>
      </UnifiedErrorBoundary>

      <ConversationModeModal
        open={isModeModalOpen.value}
        onOpenChange={isModeModalOpen.setValue}
        selectedMode={selectedMode || ChatModeSchema.catch(getDefaultChatMode()).parse(thread?.mode)}
        onModeSelect={handleModeSelect}
      />

      {userTierConfig && (
        <ModelSelectionModal
          open={isModelModalOpen.value}
          onOpenChange={isModelModalOpen.setValue}
          orderedModels={orderedModels}
          onReorder={handleModelReorder}
          customRoles={customRoles}
          onToggle={handleModelToggle}
          onRoleChange={handleModelRoleChange}
          onClearRole={handleModelRoleClear}
          onPresetSelect={handlePresetSelect}
          selectedCount={selectedParticipants.length}
          maxModels={userTierConfig.max_models}
          userTierInfo={{
            can_upgrade: userTierConfig.can_upgrade,
            current_tier: userTierConfig.tier,
            max_models: userTierConfig.max_models,
            tier_name: userTierConfig.tier_name,
          }}
          visionIncompatibleModelIds={visionIncompatibleModelIds}
          fileIncompatibleModelIds={fileIncompatibleModelIds}
        />
      )}
    </>
  );
}
