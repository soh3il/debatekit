/**
 * Podcast Service - Podcast Playback & Status API
 *
 * Service functions for podcast read operations and audio URL generation.
 * Uses authenticatedFetch until backend routes are wired into AppType.
 */

import {
  PodcastScopeSchema,
  PodcastScriptLineRoleSchema,
  PodcastStatusSchema,
} from '@debatekit/shared/enums';
import { z } from 'zod';

import { authenticatedFetch } from '@/lib/api/client';
import { getApiBaseUrl } from '@/lib/config/base-urls';

// ============================================================================
// Response Schemas
// ============================================================================

export const PodcastScriptLineSchema = z.object({
  endMs: z.number().int().nonnegative().optional(),
  role: PodcastScriptLineRoleSchema,
  speakerId: z.string(),
  speakerName: z.string(),
  startMs: z.number().int().nonnegative().optional(),
  text: z.string(),
  voiceId: z.string(),
});

const PodcastScriptSchema = z.object({
  description: z.string().optional(),
  lines: z.array(PodcastScriptLineSchema),
  title: z.string(),
});

const PodcastDataSchema = z.object({
  audioDurationMs: z.number().nullable(),
  audioSizeBytes: z.number().nullable(),
  characterCount: z.number().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  creditsUsed: z.number().nullable(),
  episodeNumber: z.number().nullable(),
  episodeTitle: z.string().nullable(),
  errorMessage: z.string().nullable(),
  id: z.string(),
  progress: z.number().min(0).max(100),
  roundNumber: z.number().nullable(),
  scope: PodcastScopeSchema,
  scriptData: PodcastScriptSchema.nullable(),
  status: PodcastStatusSchema,
  threadId: z.string(),
});

const PodcastResponseSchema = z.object({
  data: PodcastDataSchema.optional(),
  success: z.boolean(),
});

const PodcastEpisodesResponseSchema = z.object({
  data: z.array(PodcastDataSchema).optional(),
  success: z.boolean(),
});

// ============================================================================
// Type Exports - Inferred from Zod schemas
// ============================================================================

export type PodcastScriptLine = z.infer<typeof PodcastScriptLineSchema>;
export type PodcastScript = z.infer<typeof PodcastScriptSchema>;
export type PodcastData = z.infer<typeof PodcastDataSchema>;
export type PodcastResponse = z.infer<typeof PodcastResponseSchema>;
export type PodcastEpisodesResponse = z.infer<typeof PodcastEpisodesResponseSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

const _GetPodcastParamsSchema = z.object({
  roundNumber: z.number().optional(),
  scope: PodcastScopeSchema.optional(),
  status: PodcastStatusSchema.optional(),
  threadId: z.string(),
});
export type GetPodcastParams = z.infer<typeof _GetPodcastParamsSchema>;

const _GetPublicPodcastParamsSchema = z.object({
  slug: z.string(),
});
export type GetPublicPodcastParams = z.infer<typeof _GetPublicPodcastParamsSchema>;

const _GetPodcastEpisodesParamsSchema = z.object({
  threadId: z.string(),
});
export type GetPodcastEpisodesParams = z.infer<typeof _GetPodcastEpisodesParamsSchema>;

// ============================================================================
// Service Functions - Podcast Read Operations
// ============================================================================

/**
 * Get podcast metadata for a thread
 * GET /chat/threads/:id/podcast
 */
export async function getPodcastService(params: GetPodcastParams) {
  const { roundNumber, scope, status, threadId } = params;

  const searchParams: { roundNumber?: string; scope?: string; status?: string } = {};
  if (scope) {
    searchParams.scope = scope;
  }
  if (roundNumber !== undefined) {
    searchParams.roundNumber = String(roundNumber);
  }
  if (status) {
    searchParams.status = status;
  }

  const response = await authenticatedFetch(`/chat/threads/${threadId}/podcast`, {
    method: 'GET',
    searchParams,
  });

  const json = await response.json();
  return PodcastResponseSchema.parse(json);
}

/**
 * Get podcast audio stream URL
 * Returns a URL string that can be used as an audio src
 */
export function getPodcastAudioUrl(
  threadId: string,
  scope: z.infer<typeof PodcastScopeSchema>,
  roundNumber?: number,
) {
  const params = new URLSearchParams({ scope });
  if (roundNumber !== undefined) {
    params.set('roundNumber', String(roundNumber));
  }
  return `/api/v1/chat/threads/${threadId}/podcast/audio?${params.toString()}`;
}

/**
 * Get public podcast metadata
 * GET /chat/public/:slug/podcast
 */
export async function getPublicPodcastService(params: GetPublicPodcastParams) {
  const { slug } = params;
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/chat/public/${slug}/podcast`, {
    credentials: 'include',
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch public podcast: ${response.statusText}`);
  }

  const json = await response.json();
  return PodcastResponseSchema.parse(json);
}

/**
 * Get public podcast audio stream URL
 * Returns a URL string that can be used as an audio src
 */
export function getPublicPodcastAudioUrl(slug: string, roundNumber?: number) {
  const params = new URLSearchParams();
  if (roundNumber !== undefined) {
    params.set('roundNumber', String(roundNumber));
  }
  const qs = params.toString();
  return `/api/v1/chat/public/${slug}/podcast/audio${qs ? `?${qs}` : ''}`;
}

/**
 * Get all podcast episodes for a thread
 * GET /chat/threads/:id/podcast/episodes
 *
 * Returns all completed round-level podcasts for playlist playback.
 */
export async function getPodcastEpisodesService(params: GetPodcastEpisodesParams) {
  const { threadId } = params;

  const response = await authenticatedFetch(`/chat/threads/${threadId}/podcast/episodes`, {
    method: 'GET',
  });

  const json = await response.json();
  return PodcastEpisodesResponseSchema.parse(json);
}

/**
 * Get public podcast episodes for a thread by slug
 * GET /chat/public/:slug/podcast/episodes
 */
export async function getPublicPodcastEpisodesService(params: GetPublicPodcastParams) {
  const { slug } = params;
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/chat/public/${slug}/podcast/episodes`, {
    credentials: 'include',
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch public podcast episodes: ${response.statusText}`);
  }

  const json = await response.json();
  return PodcastEpisodesResponseSchema.parse(json);
}
