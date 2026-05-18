/**
 * UX Quality Tracker
 *
 * Centralized service for tracking UX quality signals to PostHog.
 * Provides type-safe event tracking with proper error handling.
 *
 * Usage:
 * ```typescript
 * import { uxQualityTracker } from '@/lib/analytics';
 *
 * // Track API error
 * uxQualityTracker.trackApiError({
 *   error_type: 'network',
 *   error_message: 'Failed to fetch data',
 *   page: '/chat',
 *   severity: 'medium',
 * });
 *
 * // Track slow page load
 * uxQualityTracker.trackSlowPageLoad({
 *   load_time_ms: 4500,
 *   page: '/chat/thread-123',
 * });
 * ```
 */

import { WebAppEnvs } from '@debatekit/shared/enums';

import { getWebappEnv } from '@/lib/config/base-urls';

import type { PostHogProperties } from './use-analytics';
import type {
  EmptyStateProperties,
  ErrorEventProperties,
  FormErrorProperties,
  FrustrationEventProperties,
  LoadingEventProperties,
  RetryEventProperties,
} from './ux-quality-events';
import { UX_QUALITY_THRESHOLDS, UxQualityEvents } from './ux-quality-events';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if PostHog is available (not in local env or SSR)
 */
function isPostHogAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return getWebappEnv() !== WebAppEnvs.LOCAL;
}

/**
 * Get current page URL safely
 */
function getCurrentPage(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.pathname;
}

/**
 * Lazy-load PostHog and capture event
 * Uses dynamic import to avoid bundling PostHog in components that don't need it
 */
async function captureEvent(
  eventName: string,
  properties?: PostHogProperties,
): Promise<void> {
  if (!isPostHogAvailable()) {
    return;
  }

  try {
    const posthog = (await import('posthog-js')).default;
    posthog.capture(eventName, {
      ...properties,
      $current_url: typeof window !== 'undefined' ? window.location.href : undefined,
      captured_at: new Date().toISOString(),
    });
  } catch {
    // Silently ignore PostHog import failures - analytics is non-critical
  }
}

// ============================================================================
// UX QUALITY TRACKER
// ============================================================================

export const uxQualityTracker = {
  // ========================================================================
  // ERROR TRACKING
  // ========================================================================

  /**
   * Get UX quality thresholds for external use
   */
  getThresholds(): typeof UX_QUALITY_THRESHOLDS {
    return UX_QUALITY_THRESHOLDS;
  },

  /**
   * Track API error shown to user
   * Call this when displaying an API error to the user via toast or inline error
   */
  trackApiError(properties: Partial<ErrorEventProperties>): void {
    void captureEvent(UxQualityEvents.API_ERROR_SHOWN, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  /**
   * Track dead click (click on non-interactive element)
   * Indicates confusing UI where user expected something to happen
   */
  trackDeadClick(properties: FrustrationEventProperties): void {
    void captureEvent(UxQualityEvents.DEAD_CLICK_DETECTED, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  /**
   * Track empty state shown
   * Helps identify areas where users frequently encounter empty states
   */
  trackEmptyState(properties: EmptyStateProperties): void {
    void captureEvent(UxQualityEvents.EMPTY_STATE_SHOWN, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  // ========================================================================
  // RETRY TRACKING
  // ========================================================================

  /**
   * Track error boundary triggered
   * This is typically called from error boundary componentDidCatch
   */
  trackErrorBoundary(properties: Partial<ErrorEventProperties>): void {
    void captureEvent(UxQualityEvents.ERROR_BOUNDARY_TRIGGERED, {
      page: getCurrentPage(),
      severity: 'high',
      ...properties,
    });
  },

  /**
   * Track form abandonment (user navigates away with unsaved changes)
   */
  trackFormAbandoned(properties: Partial<FormErrorProperties>): void {
    void captureEvent(UxQualityEvents.FORM_ABANDONED, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  /**
   * Track form submission failure (after validation passes but API fails)
   */
  trackFormSubmissionFailed(properties: FormErrorProperties): void {
    void captureEvent(UxQualityEvents.FORM_SUBMISSION_FAILED, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  // ========================================================================
  // FORM TRACKING
  // ========================================================================

  /**
   * Track form validation error
   * Call when form validation fails and error is shown to user
   */
  trackFormValidationError(properties: FormErrorProperties): void {
    void captureEvent(UxQualityEvents.FORM_VALIDATION_ERROR, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  /**
   * Track loading timeout (loading indicator shown for too long)
   */
  trackLoadingTimeout(properties: LoadingEventProperties): void {
    void captureEvent(UxQualityEvents.LOADING_TIMEOUT, {
      page: getCurrentPage(),
      threshold_ms: UX_QUALITY_THRESHOLDS.LOADING_TIMEOUT_MS,
      ...properties,
    });
  },

  /**
   * Track network error (offline, connection refused, etc.)
   */
  trackNetworkError(properties: Partial<ErrorEventProperties>): void {
    void captureEvent(UxQualityEvents.NETWORK_ERROR_OCCURRED, {
      error_type: 'network',
      page: getCurrentPage(),
      ...properties,
    });
  },

  // ========================================================================
  // LOADING/PERFORMANCE TRACKING
  // ========================================================================

  /**
   * Track no results shown (after search/filter)
   */
  trackNoResults(properties: EmptyStateProperties): void {
    void captureEvent(UxQualityEvents.NO_RESULTS_SHOWN, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  /**
   * Track rage click (multiple rapid clicks on same element)
   * Indicates user frustration with unresponsive UI
   */
  trackRageClick(properties: FrustrationEventProperties): void {
    void captureEvent(UxQualityEvents.RAGE_CLICK_DETECTED, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  /**
   * Track rapid navigation (user navigating back and forth quickly)
   * Indicates confusion or inability to find what they're looking for
   */
  trackRapidNavigation(properties: FrustrationEventProperties): void {
    void captureEvent(UxQualityEvents.RAPID_NAVIGATION, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  // ========================================================================
  // USER FRUSTRATION TRACKING
  // ========================================================================

  /**
   * Track when user attempts to retry a failed operation
   */
  trackRetryAttempted(properties: RetryEventProperties): void {
    void captureEvent(UxQualityEvents.RETRY_ATTEMPTED, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  /**
   * Track when retry fails (after all retries exhausted)
   */
  trackRetryFailed(properties: RetryEventProperties): void {
    void captureEvent(UxQualityEvents.RETRY_FAILED, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  /**
   * Track when retry succeeds
   */
  trackRetrySucceeded(properties: RetryEventProperties): void {
    void captureEvent(UxQualityEvents.RETRY_SUCCEEDED, {
      page: getCurrentPage(),
      ...properties,
    });
  },

  // ========================================================================
  // EMPTY STATE TRACKING
  // ========================================================================

  /**
   * Track slow API response (> 5 seconds by default)
   */
  trackSlowApiResponse(properties: LoadingEventProperties): void {
    if (properties.load_time_ms < UX_QUALITY_THRESHOLDS.SLOW_API_RESPONSE_MS) {
      return; // Don't track if under threshold
    }
    void captureEvent(UxQualityEvents.SLOW_API_RESPONSE, {
      page: getCurrentPage(),
      threshold_ms: UX_QUALITY_THRESHOLDS.SLOW_API_RESPONSE_MS,
      ...properties,
    });
  },

  /**
   * Track slow page load (> 3 seconds by default)
   * Threshold can be customized via UX_QUALITY_THRESHOLDS.SLOW_PAGE_LOAD_MS
   */
  trackSlowPageLoad(properties: LoadingEventProperties): void {
    if (properties.load_time_ms < UX_QUALITY_THRESHOLDS.SLOW_PAGE_LOAD_MS) {
      return; // Don't track if under threshold
    }
    void captureEvent(UxQualityEvents.SLOW_PAGE_LOAD, {
      page: getCurrentPage(),
      threshold_ms: UX_QUALITY_THRESHOLDS.SLOW_PAGE_LOAD_MS,
      ...properties,
    });
  },

  // ========================================================================
  // UTILITIES
  // ========================================================================

  /**
   * Track timeout error
   */
  trackTimeoutError(properties: Partial<ErrorEventProperties>): void {
    void captureEvent(UxQualityEvents.TIMEOUT_ERROR_OCCURRED, {
      error_type: 'timeout',
      page: getCurrentPage(),
      ...properties,
    });
  },
};
