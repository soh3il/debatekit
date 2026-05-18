/**
 * Config Barrel Export
 *
 * Single import point for all configuration utilities.
 *
 * NOTE: Hono context-dependent utilities (getWebappEnvFromContext, getAllowedOriginsFromContext,
 * isDevelopmentFromContext) are NOT exported here. Import directly from '@/lib/config/base-urls'
 * for those utilities that require Context<ApiEnv>.
 */

// Base URLs configuration (non-context-dependent utilities only)
// For WebAppEnv types/schemas, import directly from @debatekit/shared/enums
export {
  getApiBaseUrl,
  getApiOriginUrl,
  getApiOriginWithFallback,
  getApiUrlAsync,
  getAppBaseUrl,
  getBaseUrls,
  getProductionApiUrl,
  getWebappEnv,
  getWebappEnvAsync,
  isPrerender,
} from './base-urls';

// Chat modes UI configuration
export type { ChatModeConfig, ChatModeMetadata, ChatModeOption } from './chat-modes';
export {
  CHAT_MODE_CONFIGS,
  getChatModeById,
  getChatModeIcon,
  getChatModeLabel,
  getChatModeOptions,
  getDefaultChatMode,
  getEnabledChatModes,
} from './chat-modes';

// Model presets configuration
export type {
  ModelPreset,
  ModelPresetId,
  PresetFilterResult,
  PresetModelRole,
  PresetSelectionResult,
  PresetWithLockStatus,
  ToastNamespace,
} from './model-presets';
export {
  canAccessPreset,
  DEFAULT_MODEL_PRESET_ID,
  DEFAULT_TOAST_NAMESPACE,
  filterPresetParticipants,
  getModelIdsForPreset,
  getPresetById,
  getPresetsForTier,
  MODEL_PRESET_IDS,
  MODEL_PRESETS,
  ModelPresetIds,
  ModelPresetIdSchema,
  ModelPresetSchema,
  PresetFilterResultSchema,
  PresetModelRoleSchema,
  PresetSelectionResultSchema,
  PresetWithLockStatusSchema,
  TOAST_NAMESPACES,
  ToastNamespaces,
  ToastNamespaceSchema,
} from './model-presets';

// Participant limits configuration
export {
  EXAMPLE_PARTICIPANT_COUNTS,
  getExampleParticipantCount,
  MAX_PARTICIPANTS_LIMIT,
  MIN_PARTICIPANTS_REQUIRED,
  MIN_PARTICIPANTS_TO_SEND,
} from './participant-limits';

// Participant settings configuration
export type { ParticipantSettings } from './participant-settings';
export {
  DEFAULT_PARTICIPANT_SETTINGS,
  normalizeParticipantSettings,
  ParticipantSettingsSchema,
} from './participant-settings';

// Quick start suggestions configuration
export type { PromptTemplate, QuickStartData } from './quick-start-config';
export {
  getPresetQuickStarts,
  getPromptsByIndices,
  getServerQuickStartData,
  PROMPT_POOL,
} from './quick-start-config';

// Environment validation and feature checks
// For direct env access, import from '@/lib/env'
export type { ValidatedEnv } from '@/lib/env';
export {
  getEnv,
  getPostHogApiKey,
  isAnalyticsConfigured,
  isMaintenanceMode,
} from '@/lib/env';

// Role prompts, credit configuration, and tier names: import directly from @debatekit/shared
