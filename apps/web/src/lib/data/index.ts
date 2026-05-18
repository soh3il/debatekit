/**
 * Data Layer Barrel Export
 *
 * Centralized exports for TanStack Query utilities:
 * - Query client singleton
 * - Query key factories
 * - Stale time configuration
 */

// Query client (singleton pattern for SSR)
export { getQueryClient } from './query-client';

// Stale time configuration
export type { StaleTimeKey } from './stale-times';
export { GC_TIMES, getStaleTime, STALE_TIME_PRESETS, STALE_TIMES } from './stale-times';

// Shared query options (for SSR hydration consistency) — canonical source: keys/ domain files
export {
  adminJobsInfiniteQueryOptions,
  adminJobsQueryOptions,
  modelsQueryOptions,
  productsQueryOptions,
  projectAttachmentsQueryOptions,
  projectMemoryQueryOptions,
  projectQueryOptions,
  projectThreadsQueryOptions,
  sessionQueryOptions,
  sidebarProjectsQueryOptions,
  sidebarThreadsQueryOptions,
  subscriptionsQueryOptions,
  threadBySlugQueryOptions,
  threadChangelogQueryOptions,
  threadPreSearchesQueryOptions,
  usageQueryOptions,
} from './keys';

// Thread loader utilities (shared SSR loader logic for chat routes)
export type { ChatThreadLoaderData, ProjectChatThreadLoaderData } from './thread-loader';
export { createEmptyLoaderData, fetchThreadData } from './thread-loader';
