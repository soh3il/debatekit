/**
 * Unified Skeleton Components Library
 *
 * Server-safe, reusable skeleton components that match actual UI structures.
 * All skeletons use the base Skeleton component from @/components/ui/skeleton.
 *
 * Architecture:
 * - /components/ui/skeleton.tsx → Base Skeleton primitive ONLY
 * - /components/skeletons/ → All composed skeletons (this folder)
 * - /components/loading/ → Full-page loading compositions
 */

// Data Display
export { CardSkeleton } from './card-skeleton';

// Chat & Messaging
export { HeaderSkeleton } from './header-skeleton';
export { MessageCardSkeleton } from './message-card-skeleton';
export { ModeratorCardSkeleton } from './moderator-card-skeleton';
export { NavUserSkeleton } from './nav-user-skeleton';

// Search & Discovery
export {
  PreSearchQuerySkeleton,
  PreSearchResultsSkeleton,
  PreSearchSkeleton,
} from './pre-search-skeleton';

// Configuration & Settings
export { PresetCardSkeleton } from './preset-card-skeleton';

// Navigation & Lists
export { QuickStartSkeleton } from './quick-start-skeleton';

// Utilities (internal use - export for sidebar-loading-fallback)
export { getSkeletonOpacity, getSkeletonWidth, SIDEBAR_SKELETON_WIDTHS } from './skeleton-utils';

// Status Pages (billing success/failure)
export { StatusPageSkeleton } from './status-page-skeleton';
export { StickyInputSkeleton } from './sticky-input-skeleton';
export { ThreadContentSkeleton } from './thread-content-skeleton';
export { ThreadListItemSkeleton } from './thread-list-item-skeleton';
export { ThreadMessagesSkeleton } from './thread-messages-skeleton';
