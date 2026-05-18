/**
 * Scheduled Tweet Enums
 *
 * Status and source enums for scheduled tweets.
 * Lifecycle: draft -> scheduled -> sent | failed | cancelled
 */

import { z } from '@hono/zod-openapi';

import type { BadgeVariant } from './ui';
import { BadgeVariants } from './ui';

// ============================================================================
// SCHEDULED TWEET STATUS
// ============================================================================

export const SCHEDULED_TWEET_STATUSES = ['draft', 'scheduled', 'sent', 'failed', 'cancelled'] as const;

export const ScheduledTweetStatusSchema = z.enum(SCHEDULED_TWEET_STATUSES).openapi({
  description: 'Scheduled tweet execution status',
  example: 'scheduled',
});

export type ScheduledTweetStatus = z.infer<typeof ScheduledTweetStatusSchema>;

export const ScheduledTweetStatuses = {
  CANCELLED: 'cancelled' as const,
  DRAFT: 'draft' as const,
  FAILED: 'failed' as const,
  SCHEDULED: 'scheduled' as const,
  SENT: 'sent' as const,
} as const;

export const DEFAULT_SCHEDULED_TWEET_STATUS = ScheduledTweetStatuses.DRAFT;

/** Statuses that indicate a tweet is actively pending (polling-worthy) */
export const ACTIVE_SCHEDULED_TWEET_STATUSES = new Set<ScheduledTweetStatus>([
  ScheduledTweetStatuses.DRAFT,
  ScheduledTweetStatuses.SCHEDULED,
]);

// ============================================================================
// TWEET SOURCE
// ============================================================================

export const TWEET_SOURCES = ['automated_job', 'manual'] as const;

export const TweetSourceSchema = z.enum(TWEET_SOURCES).openapi({
  description: 'Source of the tweet creation',
  example: 'manual',
});

export type TweetSource = z.infer<typeof TweetSourceSchema>;

export const TweetSources = {
  AUTOMATED_JOB: 'automated_job' as const,
  MANUAL: 'manual' as const,
} as const;

export const DEFAULT_TWEET_SOURCE = TweetSources.MANUAL;

// ============================================================================
// TWEET POSTING QUEUE MESSAGE TYPE
// ============================================================================

// 1. ARRAY CONSTANT
export const TWEET_POSTING_MESSAGE_TYPES = ['post-tweet', 'generate-tweet'] as const;

// 2. ZOD SCHEMA
export const TweetPostingMessageTypeSchema = z.enum(TWEET_POSTING_MESSAGE_TYPES).openapi({
  description: 'Tweet posting queue message type discriminator',
  example: 'post-tweet',
});

// 3. TYPESCRIPT TYPE
export type TweetPostingMessageType = z.infer<typeof TweetPostingMessageTypeSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_TWEET_POSTING_MESSAGE_TYPE: TweetPostingMessageType = 'post-tweet';

// 5. CONSTANT OBJECT
export const TweetPostingMessageTypes = {
  GENERATE_TWEET: 'generate-tweet' as const,
  POST_TWEET: 'post-tweet' as const,
} as const;

// ============================================================================
// TWEET STATUS TO BADGE VARIANT MAPPING
// ============================================================================

export const TWEET_STATUS_TO_BADGE_VARIANT: Record<ScheduledTweetStatus, BadgeVariant> = {
  cancelled: BadgeVariants.DESTRUCTIVE,
  draft: BadgeVariants.OUTLINE,
  failed: BadgeVariants.DESTRUCTIVE,
  scheduled: BadgeVariants.DEFAULT,
  sent: BadgeVariants.SUCCESS,
};

export function getTweetStatusBadgeVariant(status: ScheduledTweetStatus): BadgeVariant {
  return TWEET_STATUS_TO_BADGE_VARIANT[status];
}
