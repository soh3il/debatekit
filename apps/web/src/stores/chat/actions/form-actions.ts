import type { ChatMode } from '@debatekit/shared';
import { DataSourceEntrySchema, MessagePartTypes, ModeratorFormatIdSchema } from '@debatekit/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';
import { z } from 'zod';

import { toCreateThreadRequest } from '@/components/chat/chat-form-schemas';
import { useChatStore, useChatStoreApi } from '@/components/providers/chat-store-provider/context';
import { CHAT_UI_EVENTS, ENGAGEMENT_EVENTS, FEATURE_ADOPTION_EVENTS, ONBOARDING_FUNNEL_EVENTS } from '@/constants/analytics';
import {
  useCreateThreadMutation,
  useUpdateThreadMutation,
} from '@/hooks/mutations';
import { MIN_PARTICIPANTS_REQUIRED } from '@/lib/config/participant-limits';
import { isNonProjectListOrSidebarQuery } from '@/lib/data/cache/predicates';
import { queryKeys } from '@/lib/data/keys';
import type { ExtendedFilePart } from '@/lib/schemas';
import { useShallow } from '@/lib/store';
import { showApiErrorToast } from '@/lib/toast';
import { chatParticipantsToConfig, createPrefetchMeta, prepareParticipantUpdate, shouldUpdateParticipantConfig, toISOString, toISOStringOrNull, transformChatMessages, transformChatParticipants, transformChatThread, useMemoizedReturn } from '@/lib/utils';
import { rlog } from '@/lib/utils/dev-logger';
import { getThreadRoundChangelogService } from '@/services/api/chat/threads';

import { ROUND_UNINITIALIZED } from '../store-schemas';
import { createOptimisticChangelogItems, createOptimisticUserMessage, createPlaceholderPreSearch } from '../utils/placeholder-factories';
import { validateInfiniteQueryCache } from './types';

/**
 * Attachment metadata passed from file upload handling
 */
export const AttachmentInfoSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  previewUrl: z.string().optional(),
  uploadId: z.string(),
});

export type AttachmentInfo = z.infer<typeof AttachmentInfoSchema>;

/**
 * Return type for useChatFormActions hook
 */
export type UseChatFormActionsReturn = {
  handleCreateThread: (attachmentIds?: string[], attachmentInfos?: AttachmentInfo[], projectId?: string) => Promise<void>;
  handleDataSourcesChange: (dataSources: { id: string; config?: Record<string, string> }[] | undefined) => void;
  handleModeratorFormatChange: (format: string | undefined) => void;
  handleUpdateThreadAndSend: (threadId: string, attachmentIds?: string[], attachmentInfos?: AttachmentInfo[]) => Promise<void>;
  handleResetForm: () => void;
  handleModeChange: (mode: ChatMode) => void;
  handleWebSearchToggle: (enabled: boolean) => void;
  isFormValid: boolean;
  isSubmitting: boolean;
};

/**
 * Form action handlers for chat thread creation and updates
 *
 * Handles:
 * - Thread creation with optimistic UI
 * - Thread updates with config change detection
 * - Form state management and validation
 *
 * Uses storeApi.getState() for fresh state access to avoid stale closures
 */
export function useChatFormActions(): UseChatFormActionsReturn {
  const queryClient = useQueryClient();
  const router = useRouter();
  const storeApi = useChatStoreApi();
  const posthog = usePostHog();

  const formState = useChatStore(useShallow(s => ({
    enableWebSearch: s.enableWebSearch,
    inputValue: s.inputValue,
    selectedMode: s.selectedMode,
    selectedParticipants: s.selectedParticipants,
  })));

  const actions = useChatStore(useShallow(s => ({
    addChangelogItems: s.addChangelogItems,
    addPreSearch: s.addPreSearch,
    clearAttachments: s.clearAttachments,
    initializeThread: s.initializeThread,
    prepareForNewMessage: s.prepareForNewMessage,
    resetForm: s.resetForm,
    setCreatedThreadId: s.setCreatedThreadId,
    setCreatedThreadProjectId: s.setCreatedThreadProjectId,
    setCurrentRoundNumber: s.setCurrentRoundNumber,
    setDataSources: s.setDataSources,
    setEnableWebSearch: s.setEnableWebSearch,
    setHasInitiallyLoaded: s.setHasInitiallyLoaded,
    setInputValue: s.setInputValue,
    setIsCreatingThread: s.setIsCreatingThread,
    setModeratorFormat: s.setModeratorFormat,
    setPendingAttachmentIds: s.setPendingAttachmentIds,
    setPendingFileParts: s.setPendingFileParts,
    setPendingMessage: s.setPendingMessage,
    setSelectedMode: s.setSelectedMode,
    setSelectedParticipants: s.setSelectedParticipants,
    setShowInitialUI: s.setShowInitialUI,
    setThread: s.setThread,
    syncChangelogFromApi: s.syncChangelogFromApi,
    updateParticipants: s.updateParticipants,
  })));

  const createThreadMutation = useCreateThreadMutation();
  const updateThreadMutation = useUpdateThreadMutation();

  const isFormValid = Boolean(
    formState.inputValue.trim()
    && formState.selectedParticipants.length >= MIN_PARTICIPANTS_REQUIRED
    && formState.selectedMode,
  );

  const handleCreateThread = useCallback(async (attachmentIds?: string[], attachmentInfos?: AttachmentInfo[], projectId?: string) => {
    // ✅ CRITICAL FIX: Use fresh state from storeApi instead of stale formState closure
    // After auto mode analysis updates the store, formState still has old values
    // This was causing enableWebSearch and participants from auto mode to be ignored
    const freshState = storeApi.getState();
    const prompt = freshState.inputValue.trim();
    const freshSelectedMode = freshState.selectedMode;
    const freshSelectedParticipants = freshState.selectedParticipants;
    const freshEnableWebSearch = freshState.enableWebSearch;
    const freshDataSources = freshState.dataSources;
    const freshModeratorFormat = freshState.moderatorFormat;

    if (!prompt || freshSelectedParticipants.length < MIN_PARTICIPANTS_REQUIRED || !freshSelectedMode) {
      return;
    }

    try {
      actions.setIsCreatingThread(true);

      // Resume is already blocked for new threads: resume = effectiveThreadId !== createdThreadId.
      // pendingMessage is set AFTER prepareForNewMessage() below (see end of try block).

      const createThreadRequest = toCreateThreadRequest({
        dataSources: freshDataSources,
        enableWebSearch: freshEnableWebSearch,
        message: prompt,
        mode: freshSelectedMode,
        moderatorFormat: freshModeratorFormat,
        participants: freshSelectedParticipants,
      }, attachmentIds, projectId);

      const apiResponse = await createThreadMutation.mutateAsync({
        json: createThreadRequest,
      });

      if (!apiResponse) {
        throw new Error('No response from server');
      }

      if (!('success' in apiResponse) || !apiResponse.success || !('data' in apiResponse) || !apiResponse.data) {
        throw new Error('Invalid response from server');
      }

      const { messages: initialMessages, participants, thread } = apiResponse.data;

      const threadWithDates = transformChatThread(thread);
      const participantsWithDates = transformChatParticipants(participants);
      const messagesWithDates = transformChatMessages(initialMessages);

      actions.setShowInitialUI(false);
      actions.setCreatedThreadId(thread.id);
      actions.setCreatedThreadProjectId(projectId ?? null);

      actions.initializeThread(threadWithDates, participantsWithDates);
      // ✅ STREAMING TRIGGER FIX: Enable Store→AI SDK sync in ChatStoreProvider
      // Without this, chat.isReady stays false and streaming never starts
      actions.setHasInitiallyLoaded(true);

      const syncedParticipantConfigs = chatParticipantsToConfig(participantsWithDates);
      actions.setSelectedParticipants(syncedParticipantConfigs);

      // ✅ Sync form state from created thread (backend is source of truth)
      // useSyncHydrateStore may skip hydration for new threads, so we must
      // explicitly sync mode/webSearch here.
      actions.setSelectedMode(threadWithDates.mode);
      actions.setEnableWebSearch(threadWithDates.enableWebSearch);

      // AI SDK now manages streaming placeholders -- no upfront creation needed.

      // Thread item for cache updates
      const threadItem = {
        createdAt: thread.createdAt,
        enableWebSearch: thread.enableWebSearch,
        id: thread.id,
        isAiGeneratedTitle: thread.isAiGeneratedTitle,
        isFavorite: thread.isFavorite,
        isPublic: thread.isPublic,
        lastMessageAt: thread.lastMessageAt,
        mode: thread.mode,
        slug: thread.slug,
        status: thread.status,
        title: thread.title,
        updatedAt: thread.updatedAt,
      };

      // ✅ STEP 1: Pre-populate thread detail caches BEFORE navigation
      // This prevents skeleton flash when route loader runs
      queryClient.setQueryData(queryKeys.threads.bySlug(thread.slug), {
        data: {
          messages: messagesWithDates,
          participants: participantsWithDates.map(p => ({
            ...p,
            createdAt: toISOString(p.createdAt),
            updatedAt: toISOString(p.updatedAt),
          })),
          thread: {
            ...thread,
            createdAt: toISOString(thread.createdAt),
            lastMessageAt: toISOStringOrNull(thread.lastMessageAt),
            updatedAt: toISOString(thread.updatedAt),
          },
        },
        meta: createPrefetchMeta(),
        success: true,
      });

      queryClient.setQueryData(queryKeys.threads.detail(thread.id), {
        data: {
          messages: messagesWithDates,
          participants: participantsWithDates.map(p => ({
            ...p,
            createdAt: toISOString(p.createdAt),
            updatedAt: toISOString(p.updatedAt),
          })),
          thread: {
            ...thread,
            createdAt: toISOString(thread.createdAt),
            lastMessageAt: toISOStringOrNull(thread.lastMessageAt),
            updatedAt: toISOString(thread.updatedAt),
          },
        },
        meta: createPrefetchMeta(),
        success: true,
      });

      // ✅ STEP 2: Navigate BEFORE sidebar cache updates
      // This ensures URL is updated when sidebar re-renders from cache change
      if (projectId) {
        router.navigate({
          params: { projectId, slug: thread.slug },
          replace: true,
          to: '/chat/projects/$projectId/$slug',
        });
      } else {
        router.navigate({
          params: { slug: thread.slug },
          replace: true,
          to: '/chat/$slug',
        });
      }

      // ✅ STEP 3: Update sidebar list caches AFTER navigation
      // When React re-renders sidebar, URL already reflects new thread
      if (projectId) {
        const projectThreadsKey = queryKeys.projects.threads(projectId);
        const existingData = queryClient.getQueryData(projectThreadsKey);
        const parsedExisting = validateInfiniteQueryCache(existingData);

        if (parsedExisting) {
          queryClient.setQueryData(
            projectThreadsKey,
            {
              ...parsedExisting,
              pages: parsedExisting.pages.map((page, index) => {
                if (index !== 0 || !page.success || !page.data?.items) {
                  return page;
                }

                return {
                  ...page,
                  data: {
                    ...page.data,
                    items: [threadItem, ...page.data.items],
                  },
                };
              }),
            },
          );
        } else {
          queryClient.setQueryData(
            projectThreadsKey,
            {
              pageParams: [undefined],
              pages: [{
                data: { items: [threadItem], pagination: { nextCursor: null } },
                meta: createPrefetchMeta(),
                success: true,
              }],
            },
          );
        }

        // Increment thread count in sidebar projects cache
        queryClient.setQueriesData(
          { queryKey: queryKeys.projects.sidebar() },
          (old) => {
            const parsedQuery = validateInfiniteQueryCache(old);
            if (!parsedQuery) {
              return old;
            }

            return {
              ...parsedQuery,
              pages: parsedQuery.pages.map((page) => {
                if (!page.success || !page.data?.items) {
                  return page;
                }

                return {
                  ...page,
                  data: {
                    ...page.data,
                    items: page.data.items.map((item: { id: string; threadCount?: number }) =>
                      item.id === projectId
                        ? { ...item, threadCount: (item.threadCount ?? 0) + 1 }
                        : item,
                    ),
                  },
                };
              }),
            };
          },
        );
      } else {
        queryClient.setQueriesData(
          {
            predicate: isNonProjectListOrSidebarQuery,
            queryKey: queryKeys.threads.all,
          },
          (old) => {
            const parsedQuery = validateInfiniteQueryCache(old);
            if (!parsedQuery) {
              return old;
            }

            return {
              ...parsedQuery,
              pages: parsedQuery.pages.map((page, index) => {
                if (index !== 0 || !page.success || !page.data?.items) {
                  return page;
                }

                return {
                  ...page,
                  data: {
                    ...page.data,
                    items: [threadItem, ...page.data.items],
                  },
                };
              }),
            };
          },
        );
      }

      // Invalidate project caches to ensure consistency after optimistic updates
      // Immediate invalidation - optimistic updates provide instant UX,
      // invalidation triggers background refetch for consistency
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.threads(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
        // Also refresh attachments if any were uploaded (auto-link runs async)
        if (attachmentIds?.length) {
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.attachments(projectId) });
        }
      }

      actions.setInputValue('');
      actions.clearAttachments();

      // Track thread creation and message sent
      posthog.capture(ENGAGEMENT_EVENTS.THREAD_CREATED, {
        has_attachments: Boolean(attachmentIds?.length),
        message_length: prompt.length,
        mode: freshSelectedMode,
        participant_count: freshSelectedParticipants.length,
        project_id: projectId ?? null,
        thread_id: thread.id,
        web_search_enabled: freshEnableWebSearch,
      });

      // Track first thread for onboarding funnel
      posthog.capture(ONBOARDING_FUNNEL_EVENTS.FIRST_THREAD_CREATED, {
        mode: freshSelectedMode,
        participant_count: freshSelectedParticipants.length,
        thread_id: thread.id,
      });

      // Track message sent
      posthog.capture(CHAT_UI_EVENTS.MESSAGE_SENT, {
        attachment_count: attachmentIds?.length ?? 0,
        is_new_thread: true,
        message_length: prompt.length,
        mode: freshSelectedMode,
        participant_count: freshSelectedParticipants.length,
        round_number: 0,
        thread_id: thread.id,
        web_search_enabled: freshEnableWebSearch,
      });

      // Track web search feature adoption
      if (freshEnableWebSearch) {
        posthog.capture(FEATURE_ADOPTION_EVENTS.WEB_SEARCH_ENABLED, {
          thread_id: thread.id,
        });
      }

      // Track attachment usage
      if (attachmentIds?.length) {
        posthog.capture(FEATURE_ADOPTION_EVENTS.ATTACHMENT_USED, {
          attachment_count: attachmentIds.length,
          thread_id: thread.id,
        });
      }

      if (freshEnableWebSearch) {
        actions.addPreSearch(createPlaceholderPreSearch({
          roundNumber: 0,
          threadId: thread.id,
          userQuery: prompt,
        }));
      }

      // Prepare store for new round: reset counters and hasSentPendingMessage.
      // CRITICAL: This clears pendingMessage AND createdThreadId, so all
      // pending state must be set AFTER this call.
      actions.prepareForNewMessage();

      // Re-set createdThreadId AFTER prepareForNewMessage (which clears it).
      // Without this, React batches both mutations into one render and
      // useTitlePolling never sees createdThreadId, so check-slug polling
      // never starts and the AI title animation never fires.
      // Also needed for the resume gate: resume = effectiveThreadId !== createdThreadId.
      actions.setCreatedThreadId(thread.id);
      actions.setCreatedThreadProjectId(projectId ?? null);

      // Set pending state AFTER prepareForNewMessage so pendingMessage persists.
      // waitingToStartStreaming = phase === IDLE && pendingMessage !== null.
      // This triggers useRoundTrigger on the next React render to POST the stream.
      if (attachmentInfos?.length) {
        const fileParts: ExtendedFilePart[] = attachmentInfos
          .filter(att => Boolean(att.uploadId))
          .map(att => ({
            filename: att.filename,
            mediaType: att.mimeType,
            type: MessagePartTypes.FILE,
            uploadId: att.uploadId,
            url: `/api/v1/uploads/${att.uploadId}/download`,
          }));
        if (fileParts.length > 0) {
          actions.setPendingFileParts(fileParts);
        }
      }
      if (attachmentIds?.length) {
        actions.setPendingAttachmentIds(attachmentIds);
      }
      actions.setPendingMessage(prompt);
      actions.setCurrentRoundNumber(0);
    } catch (error) {
      showApiErrorToast('Error creating thread', error);
      // Defensive: restore UI even if other cleanup fails
      try {
        actions.setShowInitialUI(true);
      } catch {
        // Ignore cleanup errors
      }
      // Reset pending message in case it was set before the error
      try {
        actions.setPendingMessage(null);
      } catch {
        // Ignore cleanup errors
      }
    } finally {
      try {
        actions.setIsCreatingThread(false);
      } catch {
        // Ignore cleanup errors - critical flag reset should never crash
      }
    }
  }, [
    storeApi,
    createThreadMutation,
    actions,
    queryClient,
    router,
    posthog,
  ]);

  const handleUpdateThreadAndSend = useCallback(async (threadId: string, attachmentIds?: string[], attachmentInfos?: AttachmentInfo[]) => {
    // ✅ CRITICAL FIX: Use fresh state from storeApi instead of stale formState closure
    // After auto mode analysis updates the store, formState still has old values
    const freshState = storeApi.getState();
    const trimmed = freshState.inputValue.trim();

    // Compare selector vs getState to detect staleness
    const selectorSelectedParticipants = formState.selectedParticipants;
    const stateSelectedParticipants = freshState.selectedParticipants;
    const selectorHasMore = selectorSelectedParticipants.length > stateSelectedParticipants.length;

    if (!trimmed || freshState.selectedParticipants.length === 0 || !freshState.selectedMode) {
      return;
    }

    // ✅ DUPLICATE REQUEST FIX: This flag must be set BEFORE any re-render that could
    // trigger AI SDK's resume: true GET request. However, we need messages and round number
    // set FIRST so the trigger effect has correct data. The flag is now set at the end
    // of state preparation, just before clearing input (see below).

    const freshThread = freshState.thread;
    const freshParticipants = freshState.participants;
    const freshSelectedMode = freshState.selectedMode;
    const freshEnableWebSearch = freshState.enableWebSearch;
    let freshSelectedParticipants = freshState.selectedParticipants;

    // ✅ FIX: If selector has MORE participants than getState, use selector value
    // This happens when API response sync from previous round overwrites store
    // The selector represents what the user saw, so use that.
    if (selectorHasMore && selectorSelectedParticipants.length >= MIN_PARTICIPANTS_REQUIRED) {
      freshSelectedParticipants = selectorSelectedParticipants;
      // Also update the store to keep it in sync
      actions.setSelectedParticipants(selectorSelectedParticipants);
    }

    // ✅ FIX: Defensive check for stale closure race condition
    // formState.selectedParticipants (from hook) might be stale while freshState is empty
    // If fresh state has empty selectedParticipants but modelOrder has models, create participants from modelOrder
    const freshModelOrder = freshState.modelOrder;
    if (freshSelectedParticipants.length === 0 && freshModelOrder.length > 0) {
      freshSelectedParticipants = freshModelOrder.map((modelId, index) => ({
        id: modelId,
        modelId,
        priority: index,
        role: '',
      }));
      // Update store to prevent future desyncs
      actions.setSelectedParticipants(freshSelectedParticipants);
    }

    // ✅ FIX: Additional guard - if still empty after sync attempt, abort
    // Note: setWaitingToStartStreaming is set later in the function, so no cleanup needed here
    if (freshSelectedParticipants.length === 0) {
      return;
    }

    // Derive next round from store's currentRoundNumber (source of truth).
    // AI SDK owns messages; round tracking is via the store's phase machine.
    const storeRound = freshState.currentRoundNumber;
    const nextRoundNumber = (storeRound !== null && storeRound !== ROUND_UNINITIALIZED) ? storeRound + 1 : 0;

    // participants from store is already typed as ChatParticipant[] via ChatParticipantSchema
    const { optimisticParticipants, updatePayloads, updateResult } = prepareParticipantUpdate(
      freshParticipants,
      freshSelectedParticipants,
      threadId,
    );

    const currentModeId = freshThread?.mode || null;
    const currentWebSearch = freshThread?.enableWebSearch || false;
    const modeChanged = currentModeId !== freshSelectedMode;
    const webSearchChanged = currentWebSearch !== freshEnableWebSearch;

    const hasParticipantChanges = shouldUpdateParticipantConfig(updateResult);
    const hasAnyChanges = hasParticipantChanges || modeChanged || webSearchChanged;

    // ✅ FIX: Backend loads participants from DB via loadParticipantConfiguration()
    // Only send config when there are actual changes to minimize payload size
    const shouldSendConfig = hasAnyChanges;

    // ✅ BUG FIX: Filter out attachments without uploadId to prevent broken file previews
    // uploadId is required for backend fallback when previewUrl is empty (e.g., PDFs)
    const fileParts: ExtendedFilePart[] = attachmentInfos && attachmentInfos.length > 0
      ? attachmentInfos
          .filter((att) => {
            if (!att.uploadId) {
              return false;
            }
            return true;
          })
          .map(att => ({
            filename: att.filename,
            mediaType: att.mimeType,
            type: MessagePartTypes.FILE,
            uploadId: att.uploadId,
            url: `/api/v1/uploads/${att.uploadId}/download`,
          }))
      : [];

    const optimisticMessage = createOptimisticUserMessage({
      fileParts,
      roundNumber: nextRoundNumber,
      text: trimmed,
    });

    // AI SDK manages messages -- optimistic user message is added by the stream hook.
    // participants from store is already typed as ChatParticipant[] via ChatParticipantSchema
    const effectiveParticipants = hasParticipantChanges ? optimisticParticipants : freshParticipants;

    // NOTE: participants update and placeholder creation moved AFTER PATCH API response
    // Backend is source of truth - we must wait for response to get correct participant IDs

    if (freshEnableWebSearch) {
      actions.addPreSearch(createPlaceholderPreSearch({
        roundNumber: nextRoundNumber,
        threadId,
        userQuery: trimmed,
      }));
    }

    // ✅ FRAME 9 FIX: Create optimistic changelog items immediately so UI shows them on send
    // This ensures changelog appears instantly (Frame 9) before async API call completes
    // Without this, changelog only appears after the entire round finishes
    if (hasAnyChanges) {
      const optimisticChangelog = createOptimisticChangelogItems({
        currentParticipants: freshParticipants,
        newMode: freshSelectedMode,
        newWebSearch: freshEnableWebSearch,
        oldMode: currentModeId,
        oldWebSearch: currentWebSearch,
        roundNumber: nextRoundNumber,
        selectedParticipants: freshSelectedParticipants,
        threadId,
      });
      if (optimisticChangelog.length > 0) {
        actions.addChangelogItems(optimisticChangelog);
      }
    }

    // Clear input immediately for responsive UX — user sees their message was received.
    // pendingMessage/roundNumber are set AFTER PATCH response to prevent the round trigger
    // from firing before config changes (participants, mode, webSearch) are applied.
    actions.setInputValue('');
    actions.clearAttachments();

    try {
      // ✅ FIX: Only send participants when they actually changed
      // Backend loads participants from DB - avoid sending unchanged data
      // Mode/webSearch are small payloads, send when any config changed
      const apiResponse = await updateThreadMutation.mutateAsync({
        json: {
          enableWebSearch: shouldSendConfig ? freshEnableWebSearch : undefined,
          mode: shouldSendConfig && freshSelectedMode ? freshSelectedMode : undefined,
          newMessage: {
            attachmentIds: attachmentIds?.length ? attachmentIds : undefined,
            content: trimmed,
            id: optimisticMessage.id,
            roundNumber: nextRoundNumber,
          },
          participants: hasParticipantChanges ? updatePayloads : undefined,
        },
        param: { id: threadId },
      });

      if (!apiResponse.success) {
        throw new Error('Invalid response from server');
      }

      const responseData = apiResponse.data;

      // AI SDK manages messages -- persisted message sync is handled by the stream hook.

      // ✅ STATE SYNC TIMING FIX: Process participants from API response FIRST
      // Backend is source of truth - sync participants before creating placeholders
      // This ensures placeholders have correct participant IDs from backend
      let syncedParticipantsForPlaceholders = effectiveParticipants;

      // ✅ RACE CONDITION FIX: Guard against empty array ([] is truthy but wipes store)
      // Also guard against syncing fewer participants than user configured via auto-mode
      if (responseData?.participants && responseData.participants.length > 0) {
        const participantsWithDates = transformChatParticipants(responseData.participants);

        // ✅ Step 1: Update store participants FIRST (source of truth for placeholders)
        actions.updateParticipants(participantsWithDates);

        // ✅ Step 2: Always sync selectedParticipants from API response (backend is source of truth)
        // Previous conditional check (count >= currentSelected) caused desync when auto-mode
        // set more participants than API returned, leaving stale form state for the round.
        const syncedParticipantConfigs = chatParticipantsToConfig(participantsWithDates);
        actions.setSelectedParticipants(syncedParticipantConfigs);

        // Use synced participants for placeholder creation
        syncedParticipantsForPlaceholders = participantsWithDates;
      } else if (responseData?.participants?.length === 0) {
        // ✅ FIX: Still update participants optimistically if we had changes
        if (hasParticipantChanges) {
          actions.updateParticipants(optimisticParticipants);
          syncedParticipantsForPlaceholders = optimisticParticipants;
        }
      } else {
        // No participants in response - use optimistic if we had changes
        if (hasParticipantChanges) {
          actions.updateParticipants(optimisticParticipants);
          syncedParticipantsForPlaceholders = optimisticParticipants;
        }
      }

      // AI SDK manages streaming placeholders -- no upfront creation needed.
      const enabledCount = syncedParticipantsForPlaceholders.filter(p => p.isEnabled).length;

      // ✅ CRITICAL FIX: Set pending state AFTER PATCH response is processed.
      // This ensures participants and selectedParticipants are
      // synced from the API (backend source of truth) BEFORE waitingToStartStreaming
      // becomes true and useRoundTrigger fires startRound(). Without this ordering,
      // the round trigger fires immediately after setPendingMessage (on next render),
      // capturing stale participant snapshots and wrong participant counts.
      actions.setPendingFileParts(fileParts.length > 0 ? fileParts : null);
      actions.setPendingMessage(trimmed);
      actions.setPendingAttachmentIds(attachmentIds?.length ? attachmentIds : null);
      actions.setCurrentRoundNumber(nextRoundNumber);

      // Track message sent for existing thread
      posthog.capture(CHAT_UI_EVENTS.MESSAGE_SENT, {
        attachment_count: attachmentIds?.length ?? 0,
        config_changed: hasAnyChanges,
        is_new_thread: false,
        message_length: trimmed.length,
        mode: freshSelectedMode,
        mode_changed: modeChanged,
        participant_count: syncedParticipantsForPlaceholders.filter(p => p.isEnabled).length,
        participants_changed: hasParticipantChanges,
        round_number: nextRoundNumber,
        thread_id: threadId,
        web_search_changed: webSearchChanged,
        web_search_enabled: freshEnableWebSearch,
      });

      // Track round completion for engagement
      posthog.capture(ENGAGEMENT_EVENTS.ROUND_COMPLETED, {
        has_web_search: freshEnableWebSearch,
        participant_count: enabledCount,
        round_number: nextRoundNumber,
        thread_id: threadId,
      });

      // Track first round completion for onboarding funnel
      if (nextRoundNumber === 0) {
        posthog.capture(ONBOARDING_FUNNEL_EVENTS.FIRST_ROUND_COMPLETED, {
          participant_count: enabledCount,
          round_number: nextRoundNumber,
          thread_id: threadId,
        });
      }

      // Track attachment usage if any
      if (attachmentIds?.length) {
        posthog.capture(FEATURE_ADOPTION_EVENTS.ATTACHMENT_USED, {
          attachment_count: attachmentIds.length,
          round_number: nextRoundNumber,
          thread_id: threadId,
        });
      }

      if (responseData?.thread) {
        const syncedThread = transformChatThread(responseData.thread);
        actions.setThread(syncedThread);

        // ✅ Sync form state from API thread (backend is source of truth for config)
        // Without this, selectedMode/enableWebSearch could be stale from previous round
        actions.setSelectedMode(syncedThread.mode);
        actions.setEnableWebSearch(syncedThread.enableWebSearch);
      }

      // ✅ Sync changelog from API after config changes (API is source of truth)
      if (hasAnyChanges && nextRoundNumber > 0) {
        getThreadRoundChangelogService({
          param: { roundNumber: String(nextRoundNumber), threadId },
        }).then((response) => {
          if (response.success && response.data?.items) {
            actions.syncChangelogFromApi(nextRoundNumber, response.data.items);
          }
        }).catch(() => {
          // Silent fail - optimistic changelog remains
        });
      }
    } catch (error) {
      // Defensive: each cleanup operation wrapped to prevent cascade failures
      // AI SDK manages messages -- no optimistic message rollback needed here.
      try {
        // Clear pending message to unblock UI
        actions.setPendingMessage(null);
      } catch {
        // Ignore - state reset failure shouldn't crash
      }

      rlog.submit('patch-error', `r${nextRoundNumber} error updating thread`);
      showApiErrorToast('Error updating thread', error);
    }
  }, [
    formState,
    storeApi,
    updateThreadMutation,
    actions,
    posthog,
  ]);

  const handleResetForm = useCallback(() => {
    actions.resetForm();
  }, [actions]);

  const handleModeChange = useCallback((mode: ChatMode) => {
    const previousMode = storeApi.getState().selectedMode;
    actions.setSelectedMode(mode);

    // Track mode change
    posthog.capture(CHAT_UI_EVENTS.CONVERSATION_MODE_CHANGED, {
      new_mode: mode,
      previous_mode: previousMode,
      thread_id: storeApi.getState().thread?.id ?? null,
    });
  }, [actions, posthog, storeApi]);

  const handleWebSearchToggle = useCallback((enabled: boolean) => {
    actions.setEnableWebSearch(enabled);

    // Track web search toggle
    posthog.capture(CHAT_UI_EVENTS.WEB_SEARCH_TOGGLED, {
      enabled,
      thread_id: storeApi.getState().thread?.id ?? null,
    });

    // Track feature adoption when enabled
    if (enabled) {
      posthog.capture(FEATURE_ADOPTION_EVENTS.WEB_SEARCH_ENABLED, {
        thread_id: storeApi.getState().thread?.id ?? null,
      });
    }
  }, [actions, posthog, storeApi]);

  const handleDataSourcesChange = useCallback((dataSources: { id: string; config?: Record<string, string> }[] | undefined) => {
    if (!dataSources) {
      actions.setDataSources(undefined);
      return;
    }
    const parsed = dataSources
      .map(ds => DataSourceEntrySchema.safeParse(ds))
      .filter(r => r.success)
      .map(r => r.data);
    actions.setDataSources(parsed.length > 0 ? parsed : undefined);
  }, [actions]);

  const handleModeratorFormatChange = useCallback((format: string | undefined) => {
    if (!format) {
      actions.setModeratorFormat(undefined);
      return;
    }
    const parsed = ModeratorFormatIdSchema.safeParse(format);
    actions.setModeratorFormat(parsed.success ? parsed.data : undefined);
  }, [actions]);

  const isSubmitting = createThreadMutation.isPending || updateThreadMutation.isPending;

  return useMemoizedReturn({
    handleCreateThread,
    handleDataSourcesChange,
    handleModeChange,
    handleModeratorFormatChange,
    handleResetForm,
    handleUpdateThreadAndSend,
    handleWebSearchToggle,
    isFormValid,
    isSubmitting,
  }, [handleCreateThread, handleDataSourcesChange, handleUpdateThreadAndSend, handleResetForm, handleModeChange, handleModeratorFormatChange, handleWebSearchToggle, isFormValid, isSubmitting]);
}
