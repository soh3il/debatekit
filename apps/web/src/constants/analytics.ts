/**
 * PostHog Survey Configuration
 * Centralized IDs for PostHog survey integrations
 */
export const POSTHOG_SURVEYS = {
  FEEDBACK: {
    ID: '019432a1-feedback-0000-survey-debatekit',
    NAME: 'DebateKit User Feedback',
    QUESTIONS: {
      MESSAGE: 'd8462827-1575-4e1e-ab1d-b5fddd9f829c',
      TYPE: 'a3071551-d599-4eeb-9ffe-69e93dc647b6',
    },
  },
} as const;

// ============================================================================
// FUNNEL TRACKING EVENTS
// Structured for PostHog funnel analysis and conversion optimization
// ============================================================================

/**
 * Authentication Funnel Events
 * Track signup/login flow to identify drop-off points
 */
export const AUTH_FUNNEL_EVENTS = {
  // Magic link email submitted
  MAGIC_LINK_REQUESTED: 'auth_magic_link_requested',
  // Magic link sent successfully
  MAGIC_LINK_SENT: 'auth_magic_link_sent',
  // OAuth flow started
  OAUTH_STARTED: 'auth_oauth_started',
  // User selected a sign-in method
  SIGN_IN_METHOD_SELECTED: 'auth_sign_in_method_selected',
  // Sign-in page viewed (entry point)
  SIGN_IN_PAGE_VIEWED: 'auth_sign_in_page_viewed',
  // NOTE: signup/login completion tracked SERVER-SIDE only (user_signed_up / user_logged_in)
} as const;

/**
 * Onboarding Funnel Events
 * Track first-time user experience and activation
 */
export const ONBOARDING_FUNNEL_EVENTS = {
  // User landed on chat overview (post-auth)
  CHAT_OVERVIEW_VIEWED: 'onboarding_chat_overview_viewed',
  // User started typing (engagement signal)
  FIRST_INPUT_STARTED: 'onboarding_first_input_started',
  // First round completed (aha moment)
  FIRST_ROUND_COMPLETED: 'onboarding_first_round_completed',
  // First thread created (activation)
  FIRST_THREAD_CREATED: 'onboarding_first_thread_created',
  // User explored models/settings
  MODELS_EXPLORED: 'onboarding_models_explored',
} as const;

/**
 * Billing/Upgrade Funnel Events
 * Track monetization flow and upgrade conversion
 */
export const BILLING_FUNNEL_EVENTS = {
  // Successful payment (returned from Stripe)
  CHECKOUT_COMPLETED: 'billing_checkout_completed',
  // Checkout session created
  CHECKOUT_STARTED: 'billing_checkout_started',
  // Plan selected (clicked subscribe)
  PLAN_SELECTED: 'billing_plan_selected',
  // Customer portal accessed
  PORTAL_ACCESSED: 'billing_portal_accessed',
  // Pricing page viewed
  PRICING_PAGE_VIEWED: 'billing_pricing_page_viewed',
  // Subscription synced and active
  SUBSCRIPTION_ACTIVATED: 'billing_subscription_activated',
  // Subscription cancelled
  SUBSCRIPTION_CANCELLED: 'billing_subscription_cancelled',
  // Upgrade from free to paid
  UPGRADE_COMPLETED: 'billing_upgrade_completed',
} as const;

/**
 * Engagement Events
 * Track ongoing usage and retention signals
 */
export const ENGAGEMENT_EVENTS = {
  // Model configuration changed
  MODELS_CONFIGURED: 'engagement_models_configured',
  // Preset applied
  PRESET_APPLIED: 'engagement_preset_applied',
  // Quick start suggestion clicked
  QUICK_START_CLICKED: 'engagement_quick_start_clicked',
  // Round completed
  ROUND_COMPLETED: 'engagement_round_completed',
  // Thread created (any thread, not just first)
  THREAD_CREATED: 'engagement_thread_created',
  // Thread favorited
  THREAD_FAVORITED: 'engagement_thread_favorited',
  // Thread shared
  THREAD_SHARED: 'engagement_thread_shared',
} as const;

/**
 * Feature Adoption Events
 * Track feature discovery and adoption
 */
export const FEATURE_ADOPTION_EVENTS = {
  // File attachment used
  ATTACHMENT_USED: 'feature_attachment_used',
  // Auto mode used
  AUTO_MODE_USED: 'feature_auto_mode_used',
  // Custom role created
  CUSTOM_ROLE_CREATED: 'feature_custom_role_created',
  // Project created
  PROJECT_CREATED: 'feature_project_created',
  // Web search enabled
  WEB_SEARCH_ENABLED: 'feature_web_search_enabled',
} as const;

// ============================================================================
// CHAT UI INTERACTION EVENTS
// Track user interactions within the chat interface
// ============================================================================

/**
 * Chat UI Interaction Events
 * Track granular user actions in the chat interface for UX optimization
 */
export const CHAT_UI_EVENTS = {
  // Citation interactions
  CITATION_FOOTER_OPENED: 'chat_citation_footer_opened',
  CITATION_SOURCE_CLICKED: 'chat_citation_source_clicked',
  // Thread settings
  CONVERSATION_MODE_CHANGED: 'chat_conversation_mode_changed',
  MESSAGE_COPIED: 'chat_message_copied',

  // Message interactions
  MESSAGE_SENT: 'chat_message_sent',
  // Participant configuration
  PARTICIPANT_ADDED: 'chat_participant_added',
  PARTICIPANT_MODEL_CHANGED: 'chat_participant_model_changed',
  PARTICIPANT_REMOVED: 'chat_participant_removed',

  PARTICIPANT_ROLE_EDITED: 'chat_participant_role_edited',
  ROUND_COPIED: 'chat_round_copied',

  // Share/export actions
  SHARE_DIALOG_OPENED: 'chat_share_dialog_opened',
  SHARE_LINK_COPIED: 'chat_share_link_copied',
  THREAD_DELETED: 'chat_thread_deleted',
  THREAD_MADE_PRIVATE: 'chat_thread_made_private',

  THREAD_MADE_PUBLIC: 'chat_thread_made_public',
  // Other interactions
  THREAD_RENAMED: 'chat_thread_renamed',

  THREAD_SUMMARY_COPIED: 'chat_thread_summary_copied',
  WEB_SEARCH_TOGGLED: 'chat_web_search_toggled',
} as const;

/**
 * Podcast Events
 * Track podcast generation, playback, and engagement
 */
export const PODCAST_EVENTS = {
  AUTO_DISABLED: 'podcast_auto_disabled',
  AUTO_ENABLED: 'podcast_auto_enabled',
  COMPLETED: 'podcast_completed',
  CREATED: 'podcast_created',
  GENERATION_ERROR: 'podcast_generation_error',
  GENERATION_STARTED: 'podcast_generation_started',
  PAUSED: 'podcast_paused',
  PLAYBACK_RATE_CHANGED: 'podcast_playback_rate_changed',
  PLAYED: 'podcast_played',
} as const;

export type PodcastEvent = typeof PODCAST_EVENTS[keyof typeof PODCAST_EVENTS];

/**
 * MCP Funnel Events
 * Track MCP feature adoption, API key lifecycle, and usage patterns
 */
export const MCP_FUNNEL_EVENTS = {
  // API key created
  API_KEY_CREATED: 'mcp_api_key_created',
  // API key deleted
  API_KEY_DELETED: 'mcp_api_key_deleted',
  // Config copied to clipboard
  CONFIG_COPIED: 'mcp_config_copied',
  // Connection test performed
  CONNECTION_TESTED: 'mcp_connection_tested',
  // Usage history section viewed
  HISTORY_VIEWED: 'mcp_history_viewed',
  // Limit exceeded banner shown
  LIMIT_EXCEEDED_SHOWN: 'mcp_limit_exceeded_shown',
  // Plan info banner viewed (free or pro)
  PLAN_BANNER_VIEWED: 'mcp_plan_banner_viewed',
  // Setup guide viewed (entry point)
  SETUP_GUIDE_VIEWED: 'mcp_setup_guide_viewed',
  // Upgrade CTA clicked from MCP context
  UPGRADE_CTA_CLICKED: 'mcp_upgrade_cta_clicked',
  // Usage panel viewed with data
  USAGE_PANEL_VIEWED: 'mcp_usage_panel_viewed',
} as const;

export type McpFunnelEvent = typeof MCP_FUNNEL_EVENTS[keyof typeof MCP_FUNNEL_EVENTS];

// Combined export for easy access
export const POSTHOG_FUNNEL_EVENTS = {
  AUTH: AUTH_FUNNEL_EVENTS,
  BILLING: BILLING_FUNNEL_EVENTS,
  CHAT_UI: CHAT_UI_EVENTS,
  ENGAGEMENT: ENGAGEMENT_EVENTS,
  FEATURE: FEATURE_ADOPTION_EVENTS,
  MCP: MCP_FUNNEL_EVENTS,
  ONBOARDING: ONBOARDING_FUNNEL_EVENTS,
  PODCAST: PODCAST_EVENTS,
} as const;

// Type exports for type-safe event tracking
export type AuthFunnelEvent = typeof AUTH_FUNNEL_EVENTS[keyof typeof AUTH_FUNNEL_EVENTS];
export type OnboardingFunnelEvent = typeof ONBOARDING_FUNNEL_EVENTS[keyof typeof ONBOARDING_FUNNEL_EVENTS];
export type BillingFunnelEvent = typeof BILLING_FUNNEL_EVENTS[keyof typeof BILLING_FUNNEL_EVENTS];
export type EngagementEvent = typeof ENGAGEMENT_EVENTS[keyof typeof ENGAGEMENT_EVENTS];
export type FeatureAdoptionEvent = typeof FEATURE_ADOPTION_EVENTS[keyof typeof FEATURE_ADOPTION_EVENTS];
export type ChatUIEvent = typeof CHAT_UI_EVENTS[keyof typeof CHAT_UI_EVENTS];
