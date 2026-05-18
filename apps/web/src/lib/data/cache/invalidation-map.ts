/**
 * Invalidation Patterns & Billing Helpers
 *
 * Maps mutation operations to the query keys that should be invalidated.
 */

import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/data/keys';
import { rlog } from '@/lib/utils/dev-logger';
import { getUserUsageStatsService, listModelsService } from '@/services/api';

/**
 * Invalidation patterns for common operations
 * Use these to invalidate related queries after mutations
 *
 * IMPORTANT: Always use these patterns instead of direct invalidateQueries calls
 * This ensures consistent cache behavior across the app
 */
export const invalidationPatterns = {
  // ============================================================================
  // Admin Operations
  // ============================================================================

  adminJobDetail: (jobId: string) => [
    queryKeys.adminJobs.detail(jobId),
    queryKeys.adminJobs.lists(),
  ],

  adminJobs: [
    queryKeys.adminJobs.lists(),
  ],

  adminPipeline: [
    queryKeys.adminPipeline.lists(),
  ],

  adminSettings: [
    queryKeys.adminSettings.current(),
  ],

  adminTweets: [
    queryKeys.adminTweets.lists(),
  ],

  // ============================================================================
  // API Key Operations
  // ============================================================================

  apiKeyDetail: (keyId: string) => [
    queryKeys.apiKeys.detail(keyId),
    queryKeys.apiKeys.lists(),
  ],

  apiKeys: [
    queryKeys.apiKeys.all,
  ],

  // ============================================================================
  // Email Preference Operations
  // ============================================================================

  emailPreferences: [
    queryKeys.emailPreferences.all,
  ],

  // ============================================================================
  // Billing & Subscription Operations
  // ============================================================================

  /** After checkout session creation - prepare for post-checkout data */
  checkoutSession: [
    queryKeys.subscriptions.all,
    queryKeys.usage.all,
  ],

  /** After successful checkout sync - full billing state refresh */
  afterCheckout: [
    queryKeys.subscriptions.all,
    queryKeys.products.all,
    queryKeys.usage.all,
    queryKeys.models.all,
  ],

  /** After subscription change (switch/cancel) - same as afterCheckout */
  subscriptionChange: [
    queryKeys.subscriptions.all,
    queryKeys.products.all,
    queryKeys.usage.all,
    queryKeys.models.all,
  ],

  // ============================================================================
  // Custom Role Operations
  // ============================================================================

  customRoleDetail: (roleId: string) => [
    queryKeys.customRoles.detail(roleId),
    queryKeys.customRoles.lists(),
    queryKeys.userPresets.all, // Presets reference roles
  ],

  customRoles: [
    queryKeys.customRoles.lists(),
    queryKeys.usage.stats(),
    queryKeys.userPresets.all, // Presets reference roles and become stale when roles change
  ],

  // ============================================================================
  // Thread & Chat Operations
  // ============================================================================

  /** After chat operations - invalidate usage stats */
  afterChatOperation: [
    queryKeys.usage.stats(),
  ],

  /** After podcast generation - invalidate podcast + usage queries */
  podcastGenerate: (_threadId: string) => [
    queryKeys.podcast.all,
    queryKeys.usage.stats(),
  ],

  /** After thread message - invalidate thread detail and usage stats */
  afterThreadMessage: (threadId: string) => [
    queryKeys.threads.detail(threadId),
    queryKeys.threads.lists(),
    queryKeys.threads.sidebar(),
    queryKeys.usage.stats(),
  ],

  // ============================================================================
  // Upload Operations
  // ============================================================================

  /** After upload completion - invalidate upload list */
  afterUpload: () => [
    queryKeys.uploads.lists(),
  ],

  /** After any upload mutation (complete, abort, delete) */
  uploads: [
    queryKeys.uploads.all,
  ],

  productDetail: (productId: string) => [
    queryKeys.products.detail(productId),
    queryKeys.products.lists(),
  ],

  // Product operations
  products: [queryKeys.products.all],

  // Project attachment operations
  projectAttachments: (projectId: string) => [
    queryKeys.projects.attachments(projectId),
    queryKeys.projects.detail(projectId), // Update attachment counts
  ],

  projectDetail: (projectId: string) => [
    queryKeys.projects.detail(projectId),
    queryKeys.projects.lists(),
    queryKeys.projects.sidebar(),
    queryKeys.projects.attachments(projectId),
    queryKeys.projects.memories(projectId),
  ],

  // Project memory operations
  projectMemories: (projectId: string) => [
    queryKeys.projects.memories(projectId),
    queryKeys.projects.detail(projectId),
  ],

  // Project operations
  projects: [
    queryKeys.projects.lists(),
    queryKeys.projects.sidebar(),
    queryKeys.projects.limits(),
  ],

  // Project thread operations - invalidate threads list and project detail
  projectThreads: (projectId: string) => [
    queryKeys.projects.threads(projectId),
    queryKeys.projects.detail(projectId), // Update thread counts
    queryKeys.projects.sidebar(), // Update sidebar thread counts
  ],

  // Auth state change - invalidate ALL user-specific data
  // Used on logout, impersonation start/stop to ensure fresh data
  sessionChange: [
    queryKeys.threads.all,
    queryKeys.subscriptions.all,
    queryKeys.usage.all,
    queryKeys.models.all,
    queryKeys.customRoles.all,
    queryKeys.userPresets.all,
    queryKeys.apiKeys.all,
    queryKeys.emailPreferences.all,
    queryKeys.projects.all,
    queryKeys.uploads.all,
    queryKeys.adminJobs.all,
    queryKeys.adminSettings.all,
  ],

  subscriptionDetail: (subscriptionId: string) => [
    queryKeys.subscriptions.detail(subscriptionId),
    queryKeys.subscriptions.lists(),
    queryKeys.subscriptions.current(),
    queryKeys.usage.all,
    queryKeys.models.all,
  ],

  // Subscription operations
  // IMPORTANT: Always invalidate usage queries with subscriptions since quotas are tied to subscription tier
  subscriptions: [
    queryKeys.subscriptions.lists(),
    queryKeys.subscriptions.current(),
    queryKeys.usage.all,
    queryKeys.models.all,
  ],

  threadDetail: (threadId: string) => [
    queryKeys.threads.detail(threadId),
    queryKeys.threads.lists(),
    queryKeys.threads.sidebar(),
    queryKeys.threads.changelog(threadId),
  ],

  // Thread operations - only invalidate thread list and stats
  // Stats are only updated when messages are sent (actual usage), not when threads are created/deleted
  threads: [
    queryKeys.threads.lists(),
    queryKeys.threads.sidebar(),
    queryKeys.usage.stats(), // Invalidate stats to refresh quota
  ],

  uploadDetail: (uploadId: string) => [
    queryKeys.uploads.detail(uploadId),
    queryKeys.uploads.lists(),
  ],

  // Usage operations - invalidate after chat operations
  usage: [
    queryKeys.usage.stats(),
    queryKeys.usage.quotas(),
  ],

  userPresetDetail: (presetId: string) => [
    queryKeys.userPresets.detail(presetId),
    queryKeys.userPresets.lists(),
  ],

  // User preset operations
  userPresets: [
    queryKeys.userPresets.lists(),
  ],
} as const;

// ============================================================================
// Billing Invalidation Helpers
// ============================================================================

/**
 * Shared billing invalidation helpers
 *
 * Consolidates the duplicated cache invalidation logic used across:
 * - useSyncAfterCheckoutMutation
 * - useSwitchSubscriptionMutation
 * - useCancelSubscriptionMutation
 * - BillingSuccessClient
 *
 * These mutations all need to:
 * 1. Invalidate subscription queries
 * 2. Bypass HTTP cache for usage stats (quota limits tied to tier)
 * 3. Bypass HTTP cache for models (tier-based access restrictions)
 */
export const billingInvalidationHelpers = {
  /**
   * Full billing state refresh after subscription changes
   *
   * Use this after:
   * - Checkout completion (sync)
   * - Plan switch (upgrade/downgrade)
   * - Subscription cancellation
   *
   * Bypasses HTTP cache for usage/models to ensure fresh tier data
   */
  invalidateAfterBillingChange: async (queryClient: QueryClient) => {
    // Invalidate subscriptions first
    billingInvalidationHelpers.invalidateSubscriptions(queryClient);

    // Refresh usage and models in parallel with cache bypass
    await Promise.all([
      billingInvalidationHelpers.refreshUsageStats(queryClient),
      billingInvalidationHelpers.refreshModels(queryClient),
    ]);
  },

  /**
   * Invalidate subscription queries after billing changes
   */
  invalidateSubscriptions: (queryClient: QueryClient) => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.subscriptions.all,
      refetchType: 'all',
    });
  },

  /**
   * Refresh models with HTTP cache bypass
   * Falls back to invalidation if direct fetch fails
   */
  refreshModels: async (queryClient: QueryClient) => {
    try {
      const freshModelsData = await listModelsService({ bypassCache: true });
      queryClient.setQueryData(queryKeys.models.list(), freshModelsData);
    } catch (error) {
      rlog.stuck('billing-refresh', `models: ${error instanceof Error ? error.message : String(error)}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.all });
    }
  },

  /**
   * Refresh usage stats with HTTP cache bypass
   * Falls back to invalidation if direct fetch fails
   */
  refreshUsageStats: async (queryClient: QueryClient) => {
    try {
      const freshUsageData = await getUserUsageStatsService({ bypassCache: true });
      queryClient.setQueryData(queryKeys.usage.stats(), freshUsageData);
    } catch (error) {
      rlog.stuck('billing-refresh', `usage-stats: ${error instanceof Error ? error.message : String(error)}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.usage.all });
    }
  },
} as const;
