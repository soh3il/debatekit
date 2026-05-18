/**
 * PostHog Analytics Events - Type-Safe Event Definitions
 *
 * Follows the 5-part enum pattern from type-inference-patterns.md
 * All analytics events MUST be defined here for type safety and consistency.
 *
 * Location: /src/lib/analytics/events.ts
 */

import { z } from 'zod';

// ============================================================================
// ANALYTICS EVENT NAMES (5-Part Enum Pattern)
// ============================================================================

// 1. ARRAY CONSTANT - Source of truth for event names
// Format: [object]_[action] in snake_case, past tense
export const ANALYTICS_EVENT_NAMES = [
  // === ENGAGEMENT ===
  'session_started',
  'feature_discovered',
  'scroll_depth_reached',

  // === CHAT ACTIONS ===
  'message_sent',
  'thread_created',
  'thread_deleted',
  'thread_renamed',
  'thread_shared',
  'thread_visibility_changed',
  'round_completed',
  'stream_stopped',

  // === FEATURE USAGE ===
  'model_selected',
  'mode_changed',
  'participant_added',
  'participant_removed',
  'web_search_enabled',
  'web_search_disabled',
  'auto_mode_enabled',
  'auto_mode_disabled',
  'voice_input_used',
  'attachment_added',
  'copy_action_used',

  // === NAVIGATION ===
  'sidebar_toggled',
  'quick_start_clicked',
  'command_search_opened',
  'command_search_used',
  'settings_opened',
  'pricing_viewed',

  // === BILLING ===
  'checkout_started',
  'subscription_upgraded',
  'subscription_cancelled',
  'trial_started',

  // === AUTH ===
  'sign_in_started',
  'sign_in_completed',
  'sign_in_failed',
  'sign_out_completed',
  'delete_account_initiated',
  'delete_account_confirmed',

  // === SETTINGS & PREFERENCES ===
  'preset_applied',
  'preset_created',
  'preset_updated',
  'preset_deleted',
  'custom_role_created',
  'custom_role_deleted',
  'manage_billing_clicked',
  'profile_opened',
  'profile_updated',

  // === ANONYMOUS FUNNEL ===
  'anonymous_session_init',
  'anonymous_trial_completed',
  'anonymous_signup_cta_clicked',

  // === PODCAST ===
  'podcast_auto_disabled',
  'podcast_auto_enabled',
  'podcast_generation_started',
  'podcast_created',
  'podcast_generation_error',
  'podcast_played',
  'podcast_paused',
  'podcast_completed',
  'podcast_playback_rate_changed',
  'podcast_downloaded',

  // === MCP ===
  'mcp_api_key_created',
  'mcp_api_key_deleted',
  'mcp_config_copied',
  'mcp_connection_tested',
  'mcp_history_viewed',
  'mcp_limit_exceeded_shown',
  'mcp_plan_banner_viewed',
  'mcp_setup_guide_viewed',
  'mcp_upgrade_cta_clicked',
  'mcp_usage_panel_viewed',

  // === ERRORS ===
  'error_displayed',
  'error_retry_clicked',
] as const;

// 2. DEFAULT VALUE (not applicable for event names)

// 3. ZOD SCHEMA - Runtime validation
export const AnalyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES);

// 4. TYPESCRIPT TYPE - Inferred from Zod schema
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;

// 5. CONSTANT OBJECT - For usage in code (prevents typos)
export const AnalyticsEvents = {
  // Anonymous Funnel
  ANONYMOUS_SESSION_INIT: 'anonymous_session_init',
  ANONYMOUS_SIGNUP_CTA_CLICKED: 'anonymous_signup_cta_clicked',
  ANONYMOUS_TRIAL_COMPLETED: 'anonymous_trial_completed',
  ATTACHMENT_ADDED: 'attachment_added',
  AUTO_MODE_DISABLED: 'auto_mode_disabled',
  AUTO_MODE_ENABLED: 'auto_mode_enabled',

  // Billing
  CHECKOUT_STARTED: 'checkout_started',
  COMMAND_SEARCH_OPENED: 'command_search_opened',
  COMMAND_SEARCH_USED: 'command_search_used',
  COPY_ACTION_USED: 'copy_action_used',
  CUSTOM_ROLE_CREATED: 'custom_role_created',
  CUSTOM_ROLE_DELETED: 'custom_role_deleted',
  DELETE_ACCOUNT_CONFIRMED: 'delete_account_confirmed',
  DELETE_ACCOUNT_INITIATED: 'delete_account_initiated',

  // Errors
  ERROR_DISPLAYED: 'error_displayed',
  ERROR_RETRY_CLICKED: 'error_retry_clicked',
  FEATURE_DISCOVERED: 'feature_discovered',
  MANAGE_BILLING_CLICKED: 'manage_billing_clicked',
  // MCP
  MCP_API_KEY_CREATED: 'mcp_api_key_created',
  MCP_API_KEY_DELETED: 'mcp_api_key_deleted',
  MCP_CONFIG_COPIED: 'mcp_config_copied',
  MCP_CONNECTION_TESTED: 'mcp_connection_tested',
  MCP_HISTORY_VIEWED: 'mcp_history_viewed',
  MCP_LIMIT_EXCEEDED_SHOWN: 'mcp_limit_exceeded_shown',
  MCP_PLAN_BANNER_VIEWED: 'mcp_plan_banner_viewed',
  MCP_SETUP_GUIDE_VIEWED: 'mcp_setup_guide_viewed',
  MCP_UPGRADE_CTA_CLICKED: 'mcp_upgrade_cta_clicked',
  MCP_USAGE_PANEL_VIEWED: 'mcp_usage_panel_viewed',
  // Chat Actions
  MESSAGE_SENT: 'message_sent',
  MODE_CHANGED: 'mode_changed',
  // Feature Usage
  MODEL_SELECTED: 'model_selected',
  PARTICIPANT_ADDED: 'participant_added',
  PARTICIPANT_REMOVED: 'participant_removed',
  // Podcast
  PODCAST_AUTO_DISABLED: 'podcast_auto_disabled',
  PODCAST_AUTO_ENABLED: 'podcast_auto_enabled',
  PODCAST_COMPLETED: 'podcast_completed',
  PODCAST_CREATED: 'podcast_created',
  PODCAST_DOWNLOADED: 'podcast_downloaded',
  PODCAST_GENERATION_ERROR: 'podcast_generation_error',
  PODCAST_GENERATION_STARTED: 'podcast_generation_started',
  PODCAST_PAUSED: 'podcast_paused',
  PODCAST_PLAYBACK_RATE_CHANGED: 'podcast_playback_rate_changed',
  PODCAST_PLAYED: 'podcast_played',
  // Settings & Preferences
  PRESET_APPLIED: 'preset_applied',
  PRESET_CREATED: 'preset_created',

  PRESET_DELETED: 'preset_deleted',
  PRESET_UPDATED: 'preset_updated',
  PRICING_VIEWED: 'pricing_viewed',
  PROFILE_OPENED: 'profile_opened',
  PROFILE_UPDATED: 'profile_updated',
  QUICK_START_CLICKED: 'quick_start_clicked',
  ROUND_COMPLETED: 'round_completed',
  SCROLL_DEPTH_REACHED: 'scroll_depth_reached',

  // Engagement
  SESSION_STARTED: 'session_started',
  SETTINGS_OPENED: 'settings_opened',
  // Navigation
  SIDEBAR_TOGGLED: 'sidebar_toggled',
  SIGN_IN_COMPLETED: 'sign_in_completed',

  SIGN_IN_FAILED: 'sign_in_failed',
  // Auth
  SIGN_IN_STARTED: 'sign_in_started',
  SIGN_OUT_COMPLETED: 'sign_out_completed',
  STREAM_STOPPED: 'stream_stopped',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',

  THREAD_CREATED: 'thread_created',
  THREAD_DELETED: 'thread_deleted',
  THREAD_RENAMED: 'thread_renamed',
  THREAD_SHARED: 'thread_shared',
  THREAD_VISIBILITY_CHANGED: 'thread_visibility_changed',
  TRIAL_STARTED: 'trial_started',
  VOICE_INPUT_USED: 'voice_input_used',

  WEB_SEARCH_DISABLED: 'web_search_disabled',
  WEB_SEARCH_ENABLED: 'web_search_enabled',
} as const;

// ============================================================================
// FEATURE DISCOVERY TRACKING (5-Part Enum Pattern)
// ============================================================================

/**
 * Features that should trigger first-time discovery tracking
 */
export const DISCOVERABLE_FEATURES = [
  'voice_input',
  'attachment_upload',
  'web_search',
  'auto_mode',
  'thread_sharing',
  'command_search',
  'mcp_api_keys',
  'mcp_setup',
  'model_selection',
  'mode_selection',
  'copy_to_clipboard',
  'preset_creation',
  'custom_role',
  'billing_management',
  'podcast_generation',
  'podcast_playback',
] as const;

export const DiscoverableFeatureSchema = z.enum(DISCOVERABLE_FEATURES);
export type DiscoverableFeature = z.infer<typeof DiscoverableFeatureSchema>;

export const DiscoverableFeatures = {
  ATTACHMENT_UPLOAD: 'attachment_upload',
  AUTO_MODE: 'auto_mode',
  BILLING_MANAGEMENT: 'billing_management',
  COMMAND_SEARCH: 'command_search',
  COPY_TO_CLIPBOARD: 'copy_to_clipboard',
  CUSTOM_ROLE: 'custom_role',
  MCP_API_KEYS: 'mcp_api_keys',
  MCP_SETUP: 'mcp_setup',
  MODE_SELECTION: 'mode_selection',
  MODEL_SELECTION: 'model_selection',
  PODCAST_GENERATION: 'podcast_generation',
  PODCAST_PLAYBACK: 'podcast_playback',
  PRESET_CREATION: 'preset_creation',
  THREAD_SHARING: 'thread_sharing',
  VOICE_INPUT: 'voice_input',
  WEB_SEARCH: 'web_search',
} as const;
