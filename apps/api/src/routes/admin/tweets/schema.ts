import { z } from '@hono/zod-openapi';
import {
  ScheduledTweetStatuses,
  ScheduledTweetStatusSchema,
  TweetSources,
  TweetSourceSchema,
} from '@debatekit/shared/enums';

import { DbScheduledTweetMetadataSchema } from '@/db';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Tweet list query params
 */
export const TweetListQuerySchema = z.object({
  cursor: z.string().optional().openapi({
    description: 'Pagination cursor for next page',
    example: 'abc123',
  }),
  limit: z.coerce.number().min(1).max(50).default(20).optional().openapi({
    description: 'Number of results per page (max 50)',
    example: 20,
  }),
  status: ScheduledTweetStatusSchema.optional().openapi({
    description: 'Filter by tweet status',
    example: ScheduledTweetStatuses.SCHEDULED,
  }),
}).openapi('TweetListQuery');

export type TweetListQuery = z.infer<typeof TweetListQuerySchema>;

/**
 * Create tweet request
 */
export const CreateTweetRequestSchema = z.object({
  content: z.string().min(1).max(25000).openapi({
    description: 'Tweet content (1-25000 characters, X Premium)',
    example: 'Check out our latest AI debatekit discussion!',
  }),
  scheduledAt: z.string().datetime().optional().openapi({
    description: 'ISO datetime to schedule the tweet',
    example: '2026-03-01T12:00:00Z',
  }),
  source: TweetSourceSchema.default(TweetSources.MANUAL).openapi({
    description: 'Source of the tweet',
    example: TweetSources.MANUAL,
  }),
  threadId: z.string().optional().openapi({
    description: 'Associated thread ID',
    example: '01HZ123ABC',
  }),
}).openapi('CreateTweetRequest');

export type CreateTweetRequest = z.infer<typeof CreateTweetRequestSchema>;

/**
 * Update tweet request
 *
 * Supports:
 * - Update content/scheduledAt for draft/scheduled tweets
 * - Cancel draft/scheduled tweets (status: 'cancelled')
 *
 * At least one field required.
 */
export const UpdateTweetRequestSchema = z.object({
  content: z.string().min(1).max(25000).optional().openapi({
    description: 'Updated tweet content (1-25000 characters, X Premium)',
    example: 'Updated tweet content here',
  }),
  scheduledAt: z.string().datetime().optional().openapi({
    description: 'Updated schedule datetime',
    example: '2026-03-01T14:00:00Z',
  }),
  status: z.enum([ScheduledTweetStatuses.DRAFT, ScheduledTweetStatuses.CANCELLED]).optional().openapi({
    description: 'Move to draft or cancel a tweet',
    example: ScheduledTweetStatuses.CANCELLED,
  }),
}).refine(
  data => Object.values(data).some(v => v !== undefined),
  { message: 'At least one field required' },
).openapi('UpdateTweetRequest');

export type UpdateTweetRequest = z.infer<typeof UpdateTweetRequestSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Tweet metadata schema - extends DbScheduledTweetMetadataSchema with OpenAPI metadata
 * Single source of truth: /apps/api/src/db/schemas/tweet-metadata.ts
 */
export const TweetMetadataSchema = DbScheduledTweetMetadataSchema.openapi('TweetMetadata');

export type TweetMetadata = z.infer<typeof TweetMetadataSchema>;

/**
 * Single tweet response
 */
export const TweetResponseSchema = z.object({
  content: z.string().openapi({
    description: 'Tweet content',
  }),
  createdAt: z.string().openapi({
    description: 'ISO timestamp when tweet was created',
  }),
  id: z.string().openapi({
    description: 'Tweet ID (ULID)',
    example: '01HZ123ABC',
  }),
  jobId: z.string().nullable().openapi({
    description: 'Associated automated job ID (null if manual)',
  }),
  metadata: TweetMetadataSchema.nullable().openapi({
    description: 'Additional tweet metadata',
  }),
  scheduledAt: z.string().nullable().openapi({
    description: 'ISO timestamp when tweet is scheduled to be sent',
  }),
  sentAt: z.string().nullable().openapi({
    description: 'ISO timestamp when tweet was sent',
  }),
  source: TweetSourceSchema.openapi({
    description: 'Source of the tweet',
  }),
  status: ScheduledTweetStatusSchema.openapi({
    description: 'Tweet status',
  }),
  threadId: z.string().nullable().openapi({
    description: 'Associated thread ID',
  }),
  threadSlug: z.string().nullable().optional().openapi({
    description: 'Thread slug for navigation',
  }),
  twitterPostId: z.string().nullable().openapi({
    description: 'Twitter/X post ID after sending',
  }),
  updatedAt: z.string().openapi({
    description: 'ISO timestamp when tweet was last updated',
  }),
  userId: z.string().openapi({
    description: 'User who created the tweet',
  }),
  viralScore: z.number().nullable().openapi({
    description: 'Viral score (0-100) if scored',
  }),
}).openapi('TweetResponse');

export type TweetResponse = z.infer<typeof TweetResponseSchema>;

/**
 * Tweet list response
 */
export const TweetListResponseSchema = z.object({
  hasMore: z.boolean().openapi({
    description: 'Whether there are more results',
  }),
  nextCursor: z.string().nullable().openapi({
    description: 'Cursor for next page',
  }),
  total: z.number().openapi({
    description: 'Total number of tweets matching filter',
  }),
  tweets: z.array(TweetResponseSchema).openapi({
    description: 'List of tweets',
  }),
}).openapi('TweetListResponse');

export type TweetListResponse = z.infer<typeof TweetListResponseSchema>;

/**
 * Send tweet response
 */
export const SendTweetResponseSchema = z.object({
  sent: z.boolean().openapi({
    description: 'Whether the tweet was queued for sending',
  }),
  twitterPostId: z.string().nullable().optional().openapi({
    description: 'Twitter post ID (populated after async posting)',
  }),
}).openapi('SendTweetResponse');

export type SendTweetResponse = z.infer<typeof SendTweetResponseSchema>;

/**
 * Delete tweet response
 */
export const DeleteTweetResponseSchema = z.object({
  deleted: z.boolean().openapi({
    description: 'Whether the tweet was deleted',
  }),
}).openapi('DeleteTweetResponse');

export type DeleteTweetResponse = z.infer<typeof DeleteTweetResponseSchema>;
