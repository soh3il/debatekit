/**
 * Podcast Route Schemas
 *
 * Request/response Zod schemas for podcast API endpoints.
 * All types via z.infer<> - no manual type definitions.
 */

import { z } from '@hono/zod-openapi';
import { PodcastScopeSchema, PodcastStatusSchema } from '@debatekit/shared/enums';

import { DbPodcastScriptSchema } from '@/db/schemas/chat-metadata';

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const PodcastResponseSchema = z.object({
  audioDurationMs: z.number().int().nullable().openapi({
    description: 'Audio duration in milliseconds',
    example: 120000,
  }),
  audioSizeBytes: z.number().int().nullable().openapi({
    description: 'Audio file size in bytes',
    example: 1920000,
  }),
  characterCount: z.number().int().nullable().openapi({
    description: 'Total character count in the script',
    example: 5000,
  }),
  completedAt: z.string().datetime().nullable().openapi({
    description: 'Timestamp when podcast generation completed',
    example: '2026-02-19T12:00:00.000Z',
  }),
  createdAt: z.string().datetime().openapi({
    description: 'Timestamp when podcast was created',
    example: '2026-02-19T11:55:00.000Z',
  }),
  creditsUsed: z.number().int().nullable().openapi({
    description: 'Credits consumed for generation',
    example: 500,
  }),
  episodeNumber: z.number().int().nullable().openapi({
    description: 'Episode order within the thread playlist',
    example: 1,
  }),
  episodeTitle: z.string().nullable().openapi({
    description: 'One-word creative episode title',
    example: 'Genesis',
  }),
  errorMessage: z.string().nullable().openapi({
    description: 'Error message if generation failed',
    example: null,
  }),
  id: z.string().openapi({
    description: 'Podcast ID',
    example: '01JMFG1234567890ABCDEF',
  }),
  progress: z.number().int().min(0).max(100).openapi({
    description: 'Generation progress percentage (0-100)',
    example: 50,
  }),
  roundNumber: z.number().int().nullable().openapi({
    description: 'Round number (when scope is "round")',
    example: null,
  }),
  scope: PodcastScopeSchema,
  scriptData: DbPodcastScriptSchema.nullable().openapi({
    description: 'Podcast script with dialogue lines',
  }),
  status: PodcastStatusSchema,
  threadId: z.string().openapi({
    description: 'Thread ID this podcast belongs to',
    example: '01JMFG1234567890THREAD',
  }),
}).openapi('PodcastResponse');

export type PodcastResponse = z.infer<typeof PodcastResponseSchema>;

export const PodcastDetailResponseSchema = z.object({
  data: PodcastResponseSchema,
  success: z.boolean(),
}).openapi('PodcastDetailResponse');

export const PodcastEpisodeListResponseSchema = z.object({
  data: z.array(PodcastResponseSchema),
  success: z.boolean(),
}).openapi('PodcastEpisodeListResponse');

// ============================================================================
// PUBLIC SCHEMAS (no auth required)
// ============================================================================

export const PublicPodcastDataSchema = z.object({
  audioDurationMs: z.number().int().nullable(),
  characterCount: z.number().int().nullable(),
  completedAt: z.string().datetime().nullable(),
  episodeNumber: z.number().int().nullable(),
  episodeTitle: z.string().nullable(),
  id: z.string(),
  roundNumber: z.number().int().nullable(),
  scope: PodcastScopeSchema,
  scriptData: DbPodcastScriptSchema.nullable(),
  status: PodcastStatusSchema,
  threadId: z.string(),
}).openapi('PublicPodcastData');

export const PublicPodcastMetadataResponseSchema = z.object({
  data: PublicPodcastDataSchema,
  success: z.boolean(),
}).openapi('PublicPodcastMetadataResponse');

export const PublicPodcastEpisodeListResponseSchema = z.object({
  data: z.array(PublicPodcastDataSchema),
  success: z.boolean(),
}).openapi('PublicPodcastEpisodeListResponse');
