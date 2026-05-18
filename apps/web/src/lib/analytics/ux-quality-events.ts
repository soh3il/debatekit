/**
 * UX Quality Analytics Events
 *
 * Centralized event definitions for tracking UX quality signals.
 * These events help identify user frustration and product issues.
 */

import type { ApiErrorSeverity } from '@debatekit/shared';

// ============================================================================
// UX QUALITY EVENT TYPES
// ============================================================================

// CONSTANT OBJECT - For usage in code (prevents typos)
export const UxQualityEvents = {
  // Error Events
  API_ERROR_SHOWN: 'api_error_shown',
  // User Frustration Signals
  DEAD_CLICK_DETECTED: 'dead_click_detected',
  // Empty State Events
  EMPTY_STATE_SHOWN: 'empty_state_shown',
  ERROR_BOUNDARY_TRIGGERED: 'error_boundary_triggered',

  // Form Events
  FORM_ABANDONED: 'form_abandoned',
  FORM_SUBMISSION_FAILED: 'form_submission_failed',
  FORM_VALIDATION_ERROR: 'form_validation_error',

  // Loading Events
  LOADING_TIMEOUT: 'loading_timeout',
  NETWORK_ERROR_OCCURRED: 'network_error_occurred',
  NO_RESULTS_SHOWN: 'no_results_shown',

  RAGE_CLICK_DETECTED: 'rage_click_detected',
  RAPID_NAVIGATION: 'rapid_navigation',
  // Retry Events
  RETRY_ATTEMPTED: 'retry_attempted',

  RETRY_FAILED: 'retry_failed',
  RETRY_SUCCEEDED: 'retry_succeeded',
  SLOW_API_RESPONSE: 'slow_api_response',

  SLOW_PAGE_LOAD: 'slow_page_load',
  TIMEOUT_ERROR_OCCURRED: 'timeout_error_occurred',
} as const;

// ============================================================================
// EVENT PROPERTY TYPES
// ============================================================================

/**
 * Base properties for all UX quality events
 */
type BaseUxEventProperties = {
  action_attempted?: string;
  component?: string;
  page?: string;
  session_duration_ms?: number;
  timestamp?: string;
};

/**
 * Error event properties
 */
export type ErrorEventProperties = BaseUxEventProperties & {
  error_code?: string;
  error_message?: string;
  error_source?: string;
  error_type?: string;
  http_status?: number;
  is_retryable?: boolean;
  severity?: ApiErrorSeverity;
  stack_trace?: string;
};

/**
 * Retry event properties
 */
export type RetryEventProperties = BaseUxEventProperties & {
  max_retries?: number;
  operation_type?: string;
  original_error?: string;
  retry_count: number;
  retry_delay_ms?: number;
};

/**
 * Form validation error properties
 */
export type FormErrorProperties = BaseUxEventProperties & {
  error_count?: number;
  error_message?: string;
  field_count?: number;
  field_name?: string;
  form_name: string;
  validation_type?: string;
};

/**
 * Loading/Performance event properties
 */
export type LoadingEventProperties = BaseUxEventProperties & {
  is_cached?: boolean;
  load_time_ms: number;
  resource_type?: string;
  resource_url?: string;
  threshold_ms?: number;
};

/**
 * User frustration event properties
 */
export type FrustrationEventProperties = BaseUxEventProperties & {
  click_count?: number;
  navigation_count?: number;
  target_element?: string;
  time_window_ms?: number;
};

/**
 * Empty state event properties
 */
export type EmptyStateProperties = BaseUxEventProperties & {
  context?: string;
  filter_applied?: boolean;
  search_query?: string;
  state_type: string;
};

// ============================================================================
// THRESHOLDS
// ============================================================================

/**
 * Performance thresholds for UX quality signals
 */
export const UX_QUALITY_THRESHOLDS = {
  LOADING_TIMEOUT_MS: 30000,
  // Rage click detection
  RAGE_CLICK_COUNT: 3,
  RAGE_CLICK_WINDOW_MS: 1000,

  // Rapid navigation (potential confusion/frustration)
  RAPID_NAV_COUNT: 5,
  RAPID_NAV_WINDOW_MS: 10000,

  SLOW_API_RESPONSE_MS: 5000,
  // Slow load thresholds (ms)
  SLOW_PAGE_LOAD_MS: 3000,
} as const;
