/**
 * Tweet Metadata Schemas - Single Source of Truth
 *
 * Zod schemas for scheduled tweet metadata stored in database.
 * Follows the same pattern as job-metadata.ts for type safety.
 */

import * as z from 'zod';

// ============================================================================
// SCHEDULED TWEET METADATA SCHEMA
// ============================================================================

/**
 * Scheduled Tweet Metadata
 * Stores AI generation details, engagement metrics, error info, and API response
 */
export const DbScheduledTweetMetadataSchema = z.object({
  aiGenerationDetails: z.object({
    completionTokens: z.number().optional(),
    generatedAt: z.string(),
    model: z.string(),
    promptTokens: z.number().optional(),
  }).strict().optional(),
  engagementMetrics: z.object({
    collectedAt: z.string().optional(),
    engagementRate: z.number().optional(),
    impressions: z.number().optional(),
    likes: z.number().optional(),
    replies: z.number().optional(),
    retweets: z.number().optional(),
  }).strict().optional(),
  errorMessage: z.string().optional(),
  /** ISO timestamp of last time this tweet was queued for posting (dedup guard) */
  lastQueuedAt: z.string().optional(),
  retryCount: z.number().optional(),
  tweetStyle: z.string().optional(),
  twitterApiResponse: z.string().optional(),
}).strict();

export type DbScheduledTweetMetadata = z.infer<typeof DbScheduledTweetMetadataSchema>;
