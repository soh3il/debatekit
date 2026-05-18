/**
 * Overview Screen Actions Hooks
 *
 * Zustand v5 Pattern: Screen-specific action hooks for overview screens
 * Used by: ChatOverviewScreen, ProjectChatScreen, ProjectDetailScreen
 *
 * Consolidates:
 * - Suggestion click handling (useOverviewActions)
 * - Auto mode toggle, preset selection, web search toggle (useOverviewFormCallbacks)
 */

import type { ChatMode } from '@debatekit/shared';
import { DataSourceIdSchema } from '@debatekit/shared';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';

import { useChatStore, useChatStoreApi } from '@/components/providers/chat-store-provider/context';
import { useModelPreferencesStore } from '@/components/providers/preferences-store-provider/context';
import type { ModelPreset } from '@/lib/config/model-presets';
import { filterPresetParticipants, ToastNamespaces } from '@/lib/config/model-presets';
import { useTranslations } from '@/lib/i18n';
import type { ParticipantConfig } from '@/lib/schemas';
import { useShallow } from '@/lib/store';
import { resolveManualModeParticipants, supplementPresetParticipants, useMemoizedReturn } from '@/lib/utils';

// ============================================================================
// SUGGESTION CLICK ACTIONS
// ============================================================================

export type UseOverviewActionsOptions = {
  projectId?: string;
};

export type UseOverviewActionsReturn = {
  handleSuggestionClick: (prompt: string, mode: ChatMode, participants: ParticipantConfig[]) => void;
};

/**
 * Hook for managing overview screen suggestion clicks
 *
 * @example
 * const overviewActions = useOverviewActions()
 * <ChatQuickStart onSuggestionClick={overviewActions.handleSuggestionClick} />
 */
export function useOverviewActions(_options: UseOverviewActionsOptions = {}): UseOverviewActionsReturn {
  const actions = useChatStore(useShallow(s => ({
    setAutoMode: s.setAutoMode,
    setInputValue: s.setInputValue,
    setSelectedMode: s.setSelectedMode,
    setSelectedParticipants: s.setSelectedParticipants,
  })));

  const handleSuggestionClick = useCallback((
    prompt: string,
    mode: ChatMode,
    participants: ParticipantConfig[],
  ) => {
    actions.setAutoMode(false);
    actions.setInputValue(prompt);
    actions.setSelectedMode(mode);
    actions.setSelectedParticipants(participants);
  }, [actions]);

  return useMemoizedReturn({
    handleSuggestionClick,
  }, [handleSuggestionClick]);
}

// ============================================================================
// FORM CALLBACKS (auto mode, preset selection, web search toggle)
// ============================================================================

export type UseOverviewFormCallbacksOptions = {
  accessibleModelIds: string[];
  fallbackParticipants: { modelId: string; role?: string | null }[];
  incompatibleModelIds: Set<string>;
  incompatibleModelIdsRef: MutableRefObject<Set<string>>;
};

export type UseOverviewFormCallbacksReturn = {
  handleAutoModeChange: (enabled: boolean) => void;
  handleDataSourceToggle: (sourceId: string, enabled: boolean) => void;
  handlePresetSelect: (preset: ModelPreset) => Promise<void>;
  handleWebSearchToggle: (enabled: boolean) => void;
};

/**
 * Shared form callbacks for overview screens (ChatOverview, ProjectChat, ProjectDetail).
 *
 * Consolidates identical handleAutoModeChange, handlePresetSelect, handleWebSearchToggle
 * that were copy-pasted across 3 screen files. Each callback updates both the chat store
 * (runtime state) and model preferences store (persisted to localStorage).
 *
 * ChatView has a different variant (thread-aware, no persistence) — uses its own callbacks.
 */
export function useOverviewFormCallbacks({
  accessibleModelIds,
  fallbackParticipants,
  incompatibleModelIds,
  incompatibleModelIdsRef,
}: UseOverviewFormCallbacksOptions): UseOverviewFormCallbacksReturn {
  const storeApi = useChatStoreApi();
  const t = useTranslations();

  const storeActions = useChatStore(useShallow(s => ({
    setActivePresetId: s.setActivePresetId,
    setAutoMode: s.setAutoMode,
    setDataSources: s.setDataSources,
    setEnableWebSearch: s.setEnableWebSearch,
    setModelOrder: s.setModelOrder,
    setModeratorFormat: s.setModeratorFormat,
    setSelectedMode: s.setSelectedMode,
    setSelectedParticipants: s.setSelectedParticipants,
  })));

  const persistActions = useModelPreferencesStore(useShallow(s => ({
    setEnableWebSearch: s.setEnableWebSearch,
    setModelOrder: s.setModelOrder,
    setSelectedMode: s.setSelectedMode,
    setSelectedModelIds: s.setSelectedModelIds,
  })));

  const handleAutoModeChange = useCallback((enabled: boolean) => {
    if (enabled) {
      storeActions.setAutoMode(true);
      storeActions.setActivePresetId(undefined);
      return;
    }

    const resolved = resolveManualModeParticipants({
      accessibleModelIds,
      currentParticipants: storeApi.getState().selectedParticipants,
      fallbackParticipants,
      incompatibleModelIds,
    });

    storeApi.setState({ autoMode: false, selectedParticipants: resolved });
    persistActions.setSelectedModelIds(resolved.map(p => p.modelId));
  }, [storeApi, fallbackParticipants, incompatibleModelIds, accessibleModelIds, storeActions, persistActions]);

  const handleWebSearchToggle = useCallback((enabled: boolean) => {
    storeActions.setEnableWebSearch(enabled);
    persistActions.setEnableWebSearch(enabled);
  }, [storeActions, persistActions]);

  const handleDataSourceToggle = useCallback((sourceId: string, enabled: boolean) => {
    const parsed = DataSourceIdSchema.safeParse(sourceId);
    if (!parsed.success) {
      return;
    }
    const validId = parsed.data;
    const current = storeApi.getState().dataSources ?? [];
    if (enabled) {
      if (!current.some(ds => ds.id === validId)) {
        storeActions.setDataSources([...current, { id: validId }]);
      }
    } else {
      const filtered = current.filter(ds => ds.id !== validId);
      storeActions.setDataSources(filtered.length > 0 ? filtered : undefined);
    }
  }, [storeApi, storeActions]);

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

    const participants = supplementPresetParticipants({
      accessibleModelIds,
      incompatibleModelIds: incompatibleModelIdsRef.current,
      participants: result.participants,
    });

    storeActions.setSelectedParticipants(participants);
    const modelIds = participants.map(p => p.modelId);
    persistActions.setSelectedModelIds(modelIds);
    storeActions.setModelOrder(modelIds);
    persistActions.setModelOrder(modelIds);

    storeActions.setSelectedMode(preset.mode);
    persistActions.setSelectedMode(preset.mode);

    const searchEnabled = preset.searchEnabled === 'conditional' ? true : preset.searchEnabled;
    storeActions.setEnableWebSearch(searchEnabled);
    persistActions.setEnableWebSearch(searchEnabled);

    // Store preset data for thread metadata (dataSources, moderatorFormat, activePresetId)
    storeActions.setDataSources(preset.dataSources);
    storeActions.setModeratorFormat(preset.moderatorFormat);
    storeActions.setActivePresetId(preset.id);
  }, [storeActions, persistActions, t, accessibleModelIds, incompatibleModelIdsRef]);

  return useMemoizedReturn({
    handleAutoModeChange,
    handleDataSourceToggle,
    handlePresetSelect,
    handleWebSearchToggle,
  }, [handleAutoModeChange, handleDataSourceToggle, handlePresetSelect, handleWebSearchToggle]);
}
