import {
  ChatModeSchema,
  ComponentVariants,
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_LIMITS,
  UploadStatuses,
} from '@debatekit/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ChatStatus } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChatDeleteDialog } from '@/components/chat/chat-delete-dialog';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatInputContainer } from '@/components/chat/chat-input-container';
import { ChatInputHeader } from '@/components/chat/chat-input-header';
import { ChatInputToolbarMenu } from '@/components/chat/chat-input-toolbar-menu';
import { ConversationModeModal } from '@/components/chat/conversation-mode-modal';
import type { ModelSelectionModalProps } from '@/components/chat/model-selection-modal';
import { useThreadHeader } from '@/components/chat/thread-header-context';
import { Icons } from '@/components/icons';
import {
  LimitReachedDialog,
  ProjectDeleteDialog,
  ProjectIconBadge,
  ProjectSettingsModal,
} from '@/components/projects';
import { useChatStore, useChatStoreApi, useModelPreferencesStore } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomRolesQuery, useModelsQuery, useProjectQuery, useProjectThreadsQuery } from '@/hooks/queries';
import {
  useBoolean,
  useChatAttachments,
  useModelLookup,
  useOrderedModels,
} from '@/hooks/utils';
import { getDefaultChatMode } from '@/lib/config/chat-modes';
import { MODEL_PRESETS } from '@/lib/config/model-presets';
import { MIN_PARTICIPANTS_REQUIRED } from '@/lib/config/participant-limits';
import { useTranslations } from '@/lib/i18n';
import type { ParticipantConfig } from '@/lib/schemas';
import { useShallow } from '@/lib/store';
import { showApiErrorToast, toastManager } from '@/lib/toast';
import { cn } from '@/lib/ui/cn';
import {
  createSuccessResponse,
  getApiErrorDetails,
  getDetailedIncompatibleModelIds,
  hasNonNullField,
  isDocumentFile,
  isImageFile,
} from '@/lib/utils';
import dynamic from '@/lib/utils/dynamic';
import type { GetProjectResponse, ListThreadsResponse, Model } from '@/services/api';
import { ChatPhases, deriveWaitingToStartStreaming, useAutoModeAnalysis, useChatFormActions, useOverviewActions, useOverviewFormCallbacks } from '@/stores/chat';

const ModelSelectionModal = dynamic<ModelSelectionModalProps>(
  () => import('@/components/chat/model-selection-modal').then(m => ({ default: m.ModelSelectionModal })),
  { ssr: false },
);

type ProjectDetailScreenProps = {
  projectId: string;
  initialProject: GetProjectResponse['data'] | null;
  initialThreads?: InfiniteData<ListThreadsResponse, string | undefined>;
  openSettings?: boolean;
};

export function ProjectDetailScreen({
  initialProject,
  initialThreads,
  openSettings,
  projectId,
}: ProjectDetailScreenProps) {
  const t = useTranslations();
  const navigate = useNavigate();
  const storeApi = useChatStoreApi();
  const { setThreadActions } = useThreadHeader();

  const { data: projectResponse, isLoading } = useProjectQuery(projectId, {
    initialData: initialProject
      ? createSuccessResponse(initialProject)
      : undefined,
  });

  const project = projectResponse?.success ? projectResponse.data : null;
  const showSkeleton = isLoading && !project;

  const [isSettingsOpen, setIsSettingsOpen] = useState(() => Boolean(openSettings));
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isThreadLimitDialogOpen, setIsThreadLimitDialogOpen] = useState(false);

  const threadCount = project?.threadCount ?? 0;
  const isThreadLimitReached = threadCount >= PROJECT_LIMITS.MAX_THREADS_PER_PROJECT;

  // --- Chat store integration (same pattern as ProjectChatScreen) ---

  const { defaultModelId } = useModelLookup();
  const incompatibleModelIdsRef = useRef<Set<string>>(new Set());
  const initStateRef = useRef({
    modelOrder: false,
    participants: false,
    reset: false,
    sync: false,
    threadActions: false,
  });

  const {
    _hasHydrated: preferencesHydrated,
    enableWebSearch: persistedWebSearch,
    modelOrder: persistedModelOrder,
    selectedMode: persistedMode,
    selectedModelIds: persistedModelIds,
    setModelOrder: setPersistedModelOrder,
    setSelectedMode: setPersistedMode,
    setSelectedModelIds: setPersistedModelIds,
    syncWithAccessibleModels,
  } = useModelPreferencesStore(useShallow(s => ({
    _hasHydrated: s._hasHydrated,
    enableWebSearch: s.enableWebSearch,
    modelOrder: s.modelOrder,
    selectedMode: s.selectedMode,
    selectedModelIds: s.selectedModelIds,
    setModelOrder: s.setModelOrder,
    setSelectedMode: s.setSelectedMode,
    setSelectedModelIds: s.setSelectedModelIds,
    syncWithAccessibleModels: s.syncWithAccessibleModels,
  })));

  const {
    addParticipant,
    autoMode,
    dataSources,
    enableWebSearch,
    inputValue,
    isAnalyzingPrompt,
    isCreatingThread,
    isStreaming,
    modelOrder,
    removeParticipant,
    resetToOverview,
    selectedMode,
    selectedParticipants,
    setEnableWebSearch,
    setInputValue,
    setModelOrder,
    setSelectedMode,
    setSelectedParticipants,
    updateParticipant,
    waitingToStartStreaming,
  } = useChatStore(
    useShallow(s => ({
      addParticipant: s.addParticipant,
      autoMode: s.autoMode,
      dataSources: s.dataSources,
      enableWebSearch: s.enableWebSearch,
      inputValue: s.inputValue,
      isAnalyzingPrompt: s.isAnalyzingPrompt,
      isCreatingThread: s.isCreatingThread,
      isStreaming: s.phase === ChatPhases.PRESEARCH
        || s.phase === ChatPhases.PARTICIPANTS
        || s.phase === ChatPhases.MODERATOR,
      modelOrder: s.modelOrder,
      removeParticipant: s.removeParticipant,
      resetToOverview: s.resetToOverview,
      selectedMode: s.selectedMode,
      selectedParticipants: s.selectedParticipants,
      setEnableWebSearch: s.setEnableWebSearch,
      setInputValue: s.setInputValue,
      setModelOrder: s.setModelOrder,
      setSelectedMode: s.setSelectedMode,
      setSelectedParticipants: s.setSelectedParticipants,
      updateParticipant: s.updateParticipant,
      waitingToStartStreaming: deriveWaitingToStartStreaming(s.phase, s.pendingMessage),
    })),
  );

  const modeModal = useBoolean(false);
  const modelModal = useBoolean(false);

  const chatAttachments = useChatAttachments();
  const attachmentClickRef = useRef<(() => void) | null>(null);

  const { data: modelsData, isLoading: isModelsLoading } = useModelsQuery();
  const { data: customRolesData } = useCustomRolesQuery(modelModal.value && !isStreaming);
  const { analyzeAndApply } = useAutoModeAnalysis(false);
  const formActions = useChatFormActions();

  useOverviewActions({ projectId });

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

  const accessibleModelIds = useMemo(() => {
    if (allEnabledModels.length === 0) {
      return [];
    }
    return allEnabledModels
      .filter((m: Model) => m.is_accessible_to_user)
      .map((m: Model) => m.id);
  }, [allEnabledModels]);

  const initialParticipants = useMemo<ParticipantConfig[]>(() => {
    const firstPreset = MODEL_PRESETS[0];
    if (!preferencesHydrated || accessibleModelIds.length === 0) {
      return [];
    }

    if (persistedModelIds.length > 0) {
      const validIds = persistedModelIds.filter(id => accessibleModelIds.includes(id));
      if (validIds.length > 0) {
        return validIds.map((modelId, index) => ({
          id: modelId,
          modelId,
          priority: index,
          role: '',
        }));
      }
    }

    if (firstPreset) {
      const accessibleSet = new Set(accessibleModelIds);
      const presetParticipants = firstPreset.modelRoles
        .filter(mr => accessibleSet.has(mr.modelId))
        .map((mr, index) => ({
          id: mr.modelId,
          modelId: mr.modelId,
          priority: index,
          role: mr.role,
        }));
      if (presetParticipants.length > 0) {
        return presetParticipants;
      }
    }

    const defaultIds = accessibleModelIds.slice(0, 3);
    if (defaultIds.length > 0) {
      return defaultIds.map((modelId: string, index: number) => ({
        id: modelId,
        modelId,
        priority: index,
        role: '',
      }));
    }

    if (defaultModelId) {
      return [{
        id: defaultModelId,
        modelId: defaultModelId,
        priority: 0,
        role: '',
      }];
    }

    return [];
  }, [preferencesHydrated, accessibleModelIds, persistedModelIds, defaultModelId]);

  const orderedModels = useOrderedModels({
    allEnabledModels,
    modelOrder,
    selectedParticipants,
  });

  const { fileIncompatibleModelIds, incompatibleModelIds, visionIncompatibleModelIds } = useMemo(() => {
    const incompatible = new Set<string>();
    const visionIncompatible = new Set<string>();
    const fileIncompatible = new Set<string>();

    for (const model of allEnabledModels) {
      if (!model.is_accessible_to_user) {
        incompatible.add(model.id);
      }
    }

    // Overview screen: no existing thread messages, only check new attachments
    const hasImageFiles = chatAttachments.attachments.some(att => isImageFile(att.file.type));
    const hasDocumentFiles = chatAttachments.attachments.some(att => isDocumentFile(att.file.type));

    const filesToCheck: { mimeType: string }[] = [];
    if (hasImageFiles) {
      filesToCheck.push({ mimeType: 'image/png' });
    }
    if (hasDocumentFiles) {
      filesToCheck.push({ mimeType: 'application/pdf' });
    }

    if (filesToCheck.length > 0) {
      const modelsWithCapabilities = allEnabledModels.map((m: Model) => ({
        capabilities: {
          file: m.supports_file,
          vision: m.supports_vision,
        },
        id: m.id,
      }));
      const detailed = getDetailedIncompatibleModelIds(modelsWithCapabilities, filesToCheck);
      for (const id of detailed.incompatibleIds) {
        incompatible.add(id);
      }
      for (const id of detailed.visionIncompatibleIds) {
        visionIncompatible.add(id);
      }
      for (const id of detailed.fileIncompatibleIds) {
        fileIncompatible.add(id);
      }
    }

    return { fileIncompatibleModelIds: fileIncompatible, incompatibleModelIds: incompatible, visionIncompatibleModelIds: visionIncompatible };
  }, [chatAttachments.attachments, allEnabledModels]);

  useEffect(() => {
    incompatibleModelIdsRef.current = incompatibleModelIds;
  }, [incompatibleModelIds]);

  const formCallbacks = useOverviewFormCallbacks({
    accessibleModelIds,
    fallbackParticipants: initialParticipants,
    incompatibleModelIds,
    incompatibleModelIdsRef,
  });

  // Reset store on mount (once only)
  useEffect(() => {
    if (!initStateRef.current.reset) {
      initStateRef.current.reset = true;
      resetToOverview();
    }
  }, [resetToOverview]);

  // Initialize state progressively as data becomes available
  useEffect(() => {
    const init = initStateRef.current;

    if (
      !init.modelOrder
      && allEnabledModels.length > 0
      && modelOrder.length === 0
      && preferencesHydrated
    ) {
      init.modelOrder = true;
      let fullOrder: string[];
      if (persistedModelOrder.length > 0) {
        const availableIds = new Set(allEnabledModels.map((m: Model) => m.id));
        const validPersistedOrder = persistedModelOrder.filter((id: string) => availableIds.has(id));
        const newModelIds = allEnabledModels
          .filter((m: Model) => !validPersistedOrder.includes(m.id))
          .map((m: Model) => m.id);
        fullOrder = [...validPersistedOrder, ...newModelIds];
      } else {
        fullOrder = allEnabledModels.map((m: Model) => m.id);
      }
      setModelOrder(fullOrder);
    }

    if (
      !init.participants
      && selectedParticipants.length === 0
      && defaultModelId
      && initialParticipants.length > 0
    ) {
      init.participants = true;
      setSelectedParticipants(initialParticipants);
      if (!selectedMode) {
        const modeResult = ChatModeSchema.safeParse(persistedMode);
        const firstPreset = MODEL_PRESETS[0];
        const defaultMode = firstPreset?.mode ?? getDefaultChatMode();
        setSelectedMode(modeResult.success ? modeResult.data : defaultMode);
      }
      const firstPreset = MODEL_PRESETS[0];
      const defaultWebSearch = firstPreset?.searchEnabled === true;
      setEnableWebSearch(persistedWebSearch ?? defaultWebSearch);
    }

    if (
      !init.sync
      && preferencesHydrated
      && accessibleModelIds.length > 0
    ) {
      init.sync = true;
      syncWithAccessibleModels(accessibleModelIds);
    }

    if (!init.threadActions) {
      init.threadActions = true;
      setThreadActions(null);
    }
  }, [
    allEnabledModels,
    modelOrder.length,
    persistedModelOrder,
    setModelOrder,
    preferencesHydrated,
    selectedParticipants.length,
    defaultModelId,
    initialParticipants,
    setSelectedParticipants,
    selectedMode,
    persistedMode,
    setSelectedMode,
    persistedWebSearch,
    setEnableWebSearch,
    accessibleModelIds,
    syncWithAccessibleModels,
    setThreadActions,
  ]);

  const isOperationBlocked = isStreaming || isCreatingThread || waitingToStartStreaming || formActions.isSubmitting || isAnalyzingPrompt;
  const isToggleDisabled = isOperationBlocked;

  const handleAttachmentClick = useCallback(() => {
    attachmentClickRef.current?.();
  }, []);

  const handlePromptSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isOperationBlocked) {
      return;
    }

    if (isThreadLimitReached) {
      setIsThreadLimitDialogOpen(true);
      return;
    }

    if (!chatAttachments.allUploaded) {
      return;
    }

    if (autoMode && inputValue.trim()) {
      const hasImageFiles = chatAttachments.attachments.some(att => isImageFile(att.file.type));
      const hasDocumentFiles = chatAttachments.attachments.some(att => isDocumentFile(att.file.type));
      const accessibleSet = new Set<string>(accessibleModelIds);

      await analyzeAndApply({
        accessibleModelIds: accessibleSet,
        hasDocumentFiles,
        hasImageFiles,
        prompt: inputValue.trim(),
      });
    }

    const currentParticipants = storeApi.getState().selectedParticipants;
    if (currentParticipants.length < MIN_PARTICIPANTS_REQUIRED) {
      return;
    }

    try {
      const attachmentIds = chatAttachments.getUploadIds();
      const attachmentInfos = chatAttachments.attachments
        .filter(att => att.status === UploadStatuses.COMPLETED && att.uploadId)
        .map((att) => {
          if (!att.uploadId) {
            throw new Error('Upload ID required');
          }
          return {
            filename: att.file.name,
            mimeType: att.file.type,
            previewUrl: att.preview?.url,
            uploadId: att.uploadId,
          };
        });

      await formActions.handleCreateThread(attachmentIds, attachmentInfos, projectId);
      chatAttachments.clearAttachments();
    } catch (error) {
      const errorDetails = getApiErrorDetails(error);
      const isLimitError = errorDetails.message.toLowerCase().includes('thread limit')
        || errorDetails.message.toLowerCase().includes('limit reached');
      if (isLimitError) {
        setIsThreadLimitDialogOpen(true);
      } else {
        showApiErrorToast('Error creating thread', error);
      }
    }
  }, [inputValue, isOperationBlocked, isThreadLimitReached, chatAttachments, autoMode, accessibleModelIds, analyzeAndApply, storeApi, formActions, projectId]);

  const handleToggleModel = useCallback((modelId: string) => {
    const orderedModel = orderedModels.find(om => om.model.id === modelId);
    if (!orderedModel) {
      return;
    }

    if (orderedModel.participant) {
      removeParticipant(modelId);
      const currentParticipants = storeApi.getState().selectedParticipants;
      setPersistedModelIds(currentParticipants.map(p => p.modelId));
    } else {
      const latestIncompatible = incompatibleModelIdsRef.current;
      if (latestIncompatible.has(modelId)) {
        toastManager.warning(t('chat.models.cannotSelectModel'), t('chat.models.modelIncompatibleWithFiles'));
        return;
      }

      const newParticipant: ParticipantConfig = {
        id: modelId,
        modelId,
        priority: 0,
        role: '',
      };
      addParticipant(newParticipant);
      const currentParticipants = storeApi.getState().selectedParticipants;
      setPersistedModelIds(currentParticipants.map(p => p.modelId));
    }
  }, [orderedModels, removeParticipant, addParticipant, setPersistedModelIds, storeApi, t]);

  const handleRoleChange = useCallback((modelId: string, role: string, customRoleId?: string) => {
    updateParticipant(modelId, { customRoleId, role });
  }, [updateParticipant]);

  const handleClearRole = useCallback(
    (modelId: string) => updateParticipant(modelId, { customRoleId: undefined, role: '' }),
    [updateParticipant],
  );

  const handleReorderModels = useCallback((newOrder: typeof orderedModels) => {
    const newModelOrder = newOrder.map(om => om.model.id);
    setModelOrder(newModelOrder);

    const reorderedParticipants = newOrder
      .filter(hasNonNullField('participant'))
      .map((om, index) => ({ ...om.participant, priority: index }));
    setSelectedParticipants(reorderedParticipants);

    setPersistedModelOrder(newModelOrder);
    setPersistedModelIds(reorderedParticipants.map(p => p.modelId));
  }, [setSelectedParticipants, setModelOrder, setPersistedModelOrder, setPersistedModelIds]);

  const chatInputToolbar = useMemo(() => (
    <ChatInputToolbarMenu
      selectedParticipants={selectedParticipants}
      allModels={allEnabledModels}
      onOpenModelModal={() => modelModal.onTrue()}
      selectedMode={selectedMode || getDefaultChatMode()}
      onOpenModeModal={() => modeModal.onTrue()}
      enableWebSearch={enableWebSearch}
      onWebSearchToggle={formCallbacks.handleWebSearchToggle}
      dataSources={dataSources}
      onDataSourceToggle={formCallbacks.handleDataSourceToggle}
      onAttachmentClick={handleAttachmentClick}
      attachmentCount={chatAttachments.attachments.length}
      enableAttachments={!isOperationBlocked}
      disabled={isOperationBlocked}
      autoMode={autoMode}
      isModelsLoading={isModelsLoading}
    />
  ), [
    selectedParticipants,
    allEnabledModels,
    modelModal,
    selectedMode,
    modeModal,
    enableWebSearch,
    formCallbacks.handleWebSearchToggle,
    dataSources,
    formCallbacks.handleDataSourceToggle,
    handleAttachmentClick,
    chatAttachments.attachments.length,
    isOperationBlocked,
    isModelsLoading,
    autoMode,
  ]);

  const sharedChatInputProps = useMemo(() => {
    const status: ChatStatus = isOperationBlocked ? 'submitted' : 'ready';
    return {
      attachmentClickRef,
      attachments: chatAttachments.attachments,
      autoMode,
      enableAttachments: !isOperationBlocked,
      isModelsLoading,
      isSubmitting: formActions.isSubmitting,
      isUploading: chatAttachments.isUploading,
      onAddAttachments: chatAttachments.addFiles,
      onChange: setInputValue,
      onRemoveAttachment: chatAttachments.removeAttachment,
      onRemoveParticipant: isOperationBlocked ? undefined : removeParticipant,
      onSubmit: handlePromptSubmit,
      participants: selectedParticipants,
      placeholder: t('chat.input.placeholder'),
      status,
      toolbar: chatInputToolbar,
      value: inputValue,
    };
  }, [
    inputValue,
    setInputValue,
    handlePromptSubmit,
    isOperationBlocked,
    isModelsLoading,
    t,
    selectedParticipants,
    removeParticipant,
    chatAttachments.attachments,
    chatAttachments.addFiles,
    chatAttachments.removeAttachment,
    chatInputToolbar,
    formActions.isSubmitting,
    chatAttachments.isUploading,
    autoMode,
  ]);

  // Clear openSettings search param from URL after initial render
  useEffect(() => {
    if (openSettings && project) {
      navigate({
        params: { projectId },
        replace: true,
        search: {},
        to: '/chat/projects/$projectId',
      });
    }
  }, [openSettings, project, navigate, projectId]);

  if (showSkeleton) {
    return <ProjectDetailSkeleton />;
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">{t('projects.notFound')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('projects.notFoundDescription')}
          </p>
          <Button asChild className="mt-4">
            <Link to="/chat">{t('projects.backToChat')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-5 md:px-6 pt-10 pb-8">
            {/* Centered hero header */}
            <div className="relative flex flex-col items-center gap-3 text-center mb-10">
              {/* Settings button — top right */}
              <Button
                variant={ComponentVariants.GHOST}
                size="icon"
                className="absolute top-0 right-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Icons.slidersHorizontal className="size-4" />
              </Button>

              <ProjectIconBadge
                icon={project.icon ?? DEFAULT_PROJECT_ICON}
                color={project.color ?? DEFAULT_PROJECT_COLOR}
                size="xl"
                className="size-16 sm:size-20 rounded-xl"
                iconClassName="size-8 sm:size-10"
              />

              <div className="flex flex-col items-center gap-1">
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="text-sm text-muted-foreground max-w-2xl px-4">
                    {project.description}
                  </p>
                )}
              </div>
            </div>

            {/* Thread List */}
            <ThreadList
              projectId={projectId}
              initialData={initialThreads}
            />
          </div>
        </div>

        {/* Real composer — sticky bottom */}
        <div className="sticky bottom-0 z-30 bg-gradient-to-t from-background via-background/80 to-transparent pt-4">
          <div className="max-w-4xl mx-auto px-5 md:px-6 pb-4">
            <ChatInputContainer
              participants={selectedParticipants}
              inputValue={inputValue}
              isModelsLoading={isModelsLoading}
              autoMode={autoMode}
            >
              <ChatInputHeader
                autoMode={autoMode}
                onAutoModeChange={formCallbacks.handleAutoModeChange}
                isAnalyzing={isAnalyzingPrompt}
                disabled={isToggleDisabled && !isAnalyzingPrompt}
                className="border-0 rounded-none"
              />
              <ChatInput {...sharedChatInputProps} className="border-0 shadow-none rounded-none" hideInternalAlerts />
            </ChatInputContainer>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {project && (
        <ProjectSettingsModal
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          project={project}
          onDelete={() => {
            setIsSettingsOpen(false);
            setIsDeleteDialogOpen(true);
          }}
        />
      )}

      {/* Delete Dialog */}
      <ProjectDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        project={{ id: project.id, name: project.name }}
      />

      {/* Thread Limit Dialog */}
      <LimitReachedDialog
        open={isThreadLimitDialogOpen}
        onOpenChange={setIsThreadLimitDialogOpen}
        type="thread"
        max={PROJECT_LIMITS.MAX_THREADS_PER_PROJECT}
      />

      {/* Conversation Mode Modal */}
      <ConversationModeModal
        open={modeModal.value}
        onOpenChange={modeModal.setValue}
        selectedMode={selectedMode || getDefaultChatMode()}
        onModeSelect={(mode) => {
          setSelectedMode(mode);
          setPersistedMode(mode);
          modeModal.onFalse();
        }}
      />

      {/* Model Selection Modal */}
      {userTierConfig && (
        <ModelSelectionModal
          open={modelModal.value}
          onOpenChange={modelModal.setValue}
          orderedModels={orderedModels}
          onReorder={handleReorderModels}
          customRoles={customRoles}
          onToggle={handleToggleModel}
          onRoleChange={handleRoleChange}
          onClearRole={handleClearRole}
          onPresetSelect={formCallbacks.handlePresetSelect}
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

function ProjectDetailSkeleton() {
  return (
    <div className="flex flex-col flex-1">
      <div className="max-w-4xl mx-auto px-5 md:px-6 pt-10 pb-8 w-full">
        {/* Centered hero skeleton */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <Skeleton className="size-16 sm:size-20 rounded-xl" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Thread list skeleton */}
        <div className="space-y-1">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ThreadList({
  initialData,
  projectId,
}: {
  projectId: string;
  initialData?: InfiniteData<ListThreadsResponse, string | undefined>;
}) {
  const t = useTranslations();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; slug: string } | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useProjectThreadsQuery(projectId, { initialData });

  const threads = useMemo(() => {
    return data?.pages.flatMap(page => (page.success ? page.data.items : [])) ?? [];
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-1">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-16">
        <Icons.messagesSquare className="size-14 mx-auto text-muted-foreground/30" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          {t('projects.threadsEmpty')}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {t('projects.threadsEmptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        {threads.map((thread, index) => (
          <ThreadListItem
            key={thread.id}
            thread={thread}
            projectId={projectId}
            isLast={index === threads.length - 1}
            onDelete={() => setDeleteTarget({ id: thread.id, slug: thread.slug })}
          />
        ))}

        {hasNextPage && (
          <Button
            variant={ComponentVariants.GHOST}
            size="sm"
            className="w-full mt-2"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? t('actions.loading') : t('actions.loadMore')}
          </Button>
        )}
      </div>

      <ChatDeleteDialog
        isOpen={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        threadId={deleteTarget?.id ?? ''}
        threadSlug={deleteTarget?.slug}
        projectId={projectId}
      />
    </>
  );
}

type ThreadItem = {
  id: string;
  title: string;
  slug: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  preview?: string | null;
};

function ThreadListItem({
  isLast,
  onDelete,
  projectId,
  thread,
}: {
  thread: ThreadItem;
  projectId: string;
  isLast: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations();

  // Format date like ChatGPT: "Jan 6", "Dec 29"
  const formattedDate = useMemo(() => {
    const date = new Date(thread.updatedAt);
    const now = new Date();
    const isCurrentYear = date.getFullYear() === now.getFullYear();

    if (isCurrentYear) {
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    }
    // Show year if different
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [thread.updatedAt]);

  return (
    <div className={cn('group relative', !isLast && 'border-b border-border/[0.06]')}>
      <Link
        to="/chat/projects/$projectId/$slug"
        params={{ projectId, slug: thread.slug }}
        preload={false}
        className={cn(
          'flex items-center gap-4 px-3 md:px-4 py-3 rounded-xl md:rounded-2xl',
          'hover:bg-muted/30 transition-colors',
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] md:text-[15px] font-medium truncate text-left" dir="auto">{thread.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground/60" suppressHydrationWarning>{formattedDate}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className={cn(
              'p-1.5 rounded-md',
              'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
              'opacity-0 group-hover:opacity-100 transition-opacity',
            )}
            title={t('chat.deleteThread')}
          >
            <Icons.trash className="size-4" />
          </button>
        </div>
      </Link>
    </div>
  );
}
