import {
  ContentPipelineStatuses,
  ContentPipelineStatusSchema,
  ContentPipelineTriggerTypeSchema,
} from '@debatekit/shared/enums';
import { z } from '@hono/zod-openapi';

import {
  DbContentPipelineMetadataSchema,
  DbPipelineDiscoveredTopicSchema,
  DbPipelineSelectedTopicSchema,
} from '@/db/schemas/pipeline-metadata';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Trigger pipeline request body
 */
export const TriggerPipelineRequestSchema = z.object({
  customTopics: z.array(z.string().min(2).max(200)).max(20).optional().openapi({
    description: 'Specific topics to research instead of auto-discovering. Skips the discovery phase.',
    example: ['AI agents in production', 'React Server Components adoption'],
  }),
  maxTopics: z.number().int().min(1).max(20).optional().openapi({
    description: 'Maximum number of topics to discover (default 5)',
    example: 5,
  }),
}).openapi('TriggerPipelineRequest');

export type TriggerPipelineRequest = z.infer<typeof TriggerPipelineRequestSchema>;

/**
 * Pipeline run list query params
 */
export const PipelineRunListQuerySchema = z.object({
  cursor: z.string().optional().openapi({
    description: 'Pagination cursor for next page',
    example: 'abc123',
  }),
  limit: z.coerce.number().min(1).max(50).default(20).optional().openapi({
    description: 'Number of results per page (max 50)',
    example: 20,
  }),
  status: ContentPipelineStatusSchema.optional().openapi({
    description: 'Filter by pipeline run status',
    example: 'running',
  }),
}).openapi('PipelineRunListQuery');

export type PipelineRunListQuery = z.infer<typeof PipelineRunListQuerySchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Single pipeline run response (summary)
 */
export const PipelineRunResponseSchema = z.object({
  completedAt: z.string().nullable().openapi({
    description: 'ISO timestamp when pipeline run completed',
  }),
  createdAt: z.string().openapi({
    description: 'ISO timestamp when pipeline run was created',
  }),
  createdJobIds: z.array(z.string()).nullable().openapi({
    description: 'IDs of automated jobs created by this run',
  }),
  discoveredTopicsCount: z.number().openapi({
    description: 'Number of topics discovered during this run',
  }),
  errorMessage: z.string().nullable().openapi({
    description: 'Error message if pipeline run failed',
  }),
  id: z.string().openapi({
    description: 'Pipeline run ID (ULID)',
    example: '01HZ123ABC',
  }),
  selectedTopicsCount: z.number().openapi({
    description: 'Number of topics selected for job creation',
  }),
  startedAt: z.string().nullable().openapi({
    description: 'ISO timestamp when pipeline run started',
  }),
  status: ContentPipelineStatusSchema.openapi({
    description: 'Pipeline run status',
  }),
  triggerType: ContentPipelineTriggerTypeSchema.openapi({
    description: 'How the pipeline run was triggered',
  }),
  updatedAt: z.string().openapi({
    description: 'ISO timestamp when pipeline run was last updated',
  }),
  viralScores: z.record(z.string(), z.number()).nullable().openapi({
    description: 'Viral scores by topic name',
  }),
}).openapi('PipelineRunResponse');

export type PipelineRunResponse = z.infer<typeof PipelineRunResponseSchema>;

/**
 * Pipeline run detail response (includes full topic data and metadata)
 */
export const PipelineRunDetailResponseSchema = PipelineRunResponseSchema.extend({
  discoveredTopics: z.array(DbPipelineDiscoveredTopicSchema).nullable().openapi({
    description: 'Topics discovered during the pipeline run',
  }),
  metadata: DbContentPipelineMetadataSchema.nullable().openapi({
    description: 'Pipeline run metadata (timing, keywords, etc.)',
  }),
  selectedTopics: z.array(DbPipelineSelectedTopicSchema).nullable().openapi({
    description: 'Topics selected for job creation with viral scores',
  }),
}).openapi('PipelineRunDetailResponse');

export type PipelineRunDetailResponse = z.infer<typeof PipelineRunDetailResponseSchema>;

/**
 * Pipeline run list response
 */
export const PipelineRunListResponseSchema = z.object({
  hasMore: z.boolean().openapi({
    description: 'Whether there are more results',
  }),
  nextCursor: z.string().nullable().openapi({
    description: 'Cursor for next page',
  }),
  runs: z.array(PipelineRunResponseSchema).openapi({
    description: 'List of pipeline runs',
  }),
  total: z.number().openapi({
    description: 'Total number of runs in this page',
  }),
}).openapi('PipelineRunListResponse');

export type PipelineRunListResponse = z.infer<typeof PipelineRunListResponseSchema>;

/**
 * Trigger pipeline response
 */
export const TriggerPipelineResponseSchema = z.object({
  runId: z.string().openapi({
    description: 'ID of the created pipeline run',
    example: '01HZ123ABC',
  }),
  status: ContentPipelineStatusSchema.openapi({
    description: 'Initial status of the pipeline run',
    example: ContentPipelineStatuses.PENDING,
  }),
}).openapi('TriggerPipelineResponse');

export type TriggerPipelineResponse = z.infer<typeof TriggerPipelineResponseSchema>;

// ============================================================================
// FIX DATA SCHEMAS
// ============================================================================

/**
 * Individual title fix result
 */
export const TitleFixResultSchema = z.object({
  generatedTitle: z.string().openapi({
    description: 'AI-generated title for the thread',
  }),
  slug: z.string().openapi({
    description: 'Updated slug for the thread',
  }),
  threadId: z.string().openapi({
    description: 'Thread ID that was fixed',
  }),
}).openapi('TitleFixResult');

export type TitleFixResult = z.infer<typeof TitleFixResultSchema>;

/**
 * Individual tweet URL fix result
 */
export const TweetUrlFixResultSchema = z.object({
  newContent: z.string().openapi({
    description: 'Updated tweet content with corrected URLs',
  }),
  tweetId: z.string().openapi({
    description: 'Tweet ID that was fixed',
  }),
}).openapi('TweetUrlFixResult');

export type TweetUrlFixResult = z.infer<typeof TweetUrlFixResultSchema>;

/**
 * Fix data response
 */
export const FixDataResponseSchema = z.object({
  titleFixes: z.object({
    failed: z.number().openapi({ description: 'Number of title fixes that failed' }),
    results: z.array(TitleFixResultSchema).openapi({ description: 'Details of each title fix' }),
    skipped: z.number().openapi({ description: 'Number of threads skipped (no initialPrompt)' }),
    succeeded: z.number().openapi({ description: 'Number of titles successfully generated' }),
    total: z.number().openapi({ description: 'Total threads with "New Chat" title linked to automated jobs' }),
  }).openapi({ description: 'Title generation fix results' }),
  tweetUrlFixes: z.object({
    results: z.array(TweetUrlFixResultSchema).openapi({ description: 'Details of each tweet URL fix' }),
    total: z.number().openapi({ description: 'Total tweets with /listen/ URLs found' }),
    updated: z.number().openapi({ description: 'Number of tweets updated' }),
  }).openapi({ description: 'Tweet URL fix results' }),
}).openapi('FixDataResponse');

export type FixDataResponse = z.infer<typeof FixDataResponseSchema>;
