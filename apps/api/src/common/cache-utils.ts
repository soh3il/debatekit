/**
 * Cache Invalidation Utilities
 *
 * Centralized cache management for Cloudflare KV (db.$cache).
 * TanStack Start handles client-side caching via TanStack Query.
 */

import type { getDbAsync } from '@/db';
import {
  CreditCacheTags,
  MessageCacheTags,
  PodcastCacheTags,
  ProjectCacheTags,
  PublicSlugsListCacheTags,
  PublicThreadCacheTags,
  ThreadCacheTags,
} from '@/db/cache/cache-tags';
import { log } from '@/lib/logger';
import { deleteOgImageFromCache } from '@/services/og-cache';

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Simple hash function for cache key generation
 * Produces deterministic, short hash strings for KV key deduplication
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Cache Tag Management
// ============================================================================

export async function invalidateThreadCache(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  userId: string,
  threadId?: string,
  slug?: string,
): Promise<void> {
  const tags = ThreadCacheTags.all(userId, threadId, slug);
  log.db('cache-invalidate', '[Cache] Invalidating thread cache', {
    slug,
    tagCount: tags.length,
    threadId: threadId?.slice(-8),
    userId: userId.slice(-8),
  });

  if (db.$cache?.invalidate) {
    await db.$cache.invalidate({ tags });
    log.db('cache-invalidate', '[Cache] Thread cache invalidated', { tags: tags.join(', ') });
  }
}

// Track message cache invalidations per thread to avoid log spam
const msgCacheInvalidationCount = new Map<string, number>();

export async function invalidateMessagesCache(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  threadId: string,
): Promise<void> {
  const tags = MessageCacheTags.all(threadId);

  // Only log first 2 invalidations per thread, then every 10th
  const count = (msgCacheInvalidationCount.get(threadId) ?? 0) + 1;
  msgCacheInvalidationCount.set(threadId, count);
  const shouldLog = count <= 2 || count % 10 === 0;

  if (shouldLog) {
    log.db('cache-invalidate', '[Cache] Invalidating messages cache', {
      invocationCount: count,
      tagCount: tags.length,
      threadId: threadId.slice(-8),
    });
  }

  if (db.$cache?.invalidate) {
    await db.$cache.invalidate({ tags });
    if (shouldLog) {
      log.db('cache-invalidate', '[Cache] Messages cache invalidated', { tags: tags.join(', ') });
    }
  }
}

export async function invalidatePublicThreadCache(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  slug: string,
  threadId: string,
  r2Bucket?: R2Bucket,
): Promise<void> {
  const tags = [
    ...PublicThreadCacheTags.all(slug, threadId),
    ...PublicSlugsListCacheTags.all(),
    ...MessageCacheTags.all(threadId),
    ...PodcastCacheTags.all(threadId),
    ThreadCacheTags.participants(threadId),
  ];

  log.db('cache-invalidate', '[Cache] Invalidating public thread cache', {
    hasR2Bucket: !!r2Bucket,
    slug,
    tagCount: tags.length,
    threadId: threadId.slice(-8),
  });

  if (db.$cache?.invalidate) {
    await db.$cache.invalidate({ tags });
    log.db('cache-invalidate', '[Cache] Public thread cache invalidated', { tags: tags.join(', ') });
  }

  if (r2Bucket) {
    await deleteOgImageFromCache(r2Bucket, 'public-thread', slug).catch(() => {});
  }
}

export async function invalidateCreditBalanceCache(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  userId: string,
): Promise<void> {
  const tags = CreditCacheTags.all(userId);
  log.db('cache-invalidate', '[Cache] Invalidating credit balance cache', {
    tagCount: tags.length,
    userId: userId.slice(-8),
  });

  if (db.$cache?.invalidate) {
    await db.$cache.invalidate({ tags });
    log.db('cache-invalidate', '[Cache] Credit balance cache invalidated', { tags: tags.join(', ') });
  }
}

export async function invalidateSidebarCache(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  userId: string,
): Promise<void> {
  const tags = [ThreadCacheTags.sidebar(userId)];
  log.db('cache-invalidate', '[Cache] Invalidating sidebar cache', {
    tagCount: tags.length,
    userId: userId.slice(-8),
  });

  if (db.$cache?.invalidate) {
    await db.$cache.invalidate({ tags });
    log.db('cache-invalidate', '[Cache] Sidebar cache invalidated', { tags: tags.join(', ') });
  }
}

export async function invalidateProjectCache(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  projectId: string,
): Promise<void> {
  const tags = ProjectCacheTags.all(projectId);
  log.db('cache-invalidate', '[Cache] Invalidating project cache', {
    projectId: projectId.slice(-8),
    tagCount: tags.length,
  });

  if (db.$cache?.invalidate) {
    await db.$cache.invalidate({ tags });
    log.db('cache-invalidate', '[Cache] Project cache invalidated', { tags: tags.join(', ') });
  }
}

/**
 * Invalidate ALL user-specific caches for impersonation or session switch
 * Clears: threads, credits, subscriptions, sidebar, user tier/usage
 */
export async function invalidateAllUserCaches(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  userId: string,
): Promise<void> {
  log.db('cache-invalidate', '[Cache] Invalidating all user caches', {
    userId: userId.slice(-8),
  });

  if (!db.$cache?.invalidate) {
    log.db('cache-invalidate', '[Cache] No cache available for invalidation', {
      userId: userId.slice(-8),
    });
    return;
  }

  const { CustomerCacheTags, SubscriptionCacheTags, UserCacheTags } = await import('@/db/cache/cache-tags');

  const tags = [
    // Thread-related caches
    ...ThreadCacheTags.all(userId),
    // Credit balance and subscription status
    ...CreditCacheTags.all(userId),
    // User tier and usage
    ...UserCacheTags.all(userId),
    // Subscription data
    ...SubscriptionCacheTags.all(userId),
    // Customer data
    ...CustomerCacheTags.all(userId),
  ];

  await db.$cache.invalidate({ tags });
  log.db('cache-invalidate', '[Cache] All user caches invalidated', {
    tagCount: tags.length,
    tags: tags.join(', '),
    userId: userId.slice(-8),
  });
}
