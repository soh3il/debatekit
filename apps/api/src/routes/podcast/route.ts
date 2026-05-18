/**
 * Podcast Route Definitions
 *
 * OpenAPI route definitions for podcast generation endpoints.
 * Follows 3-file pattern: route.ts + handler.ts + schema.ts
 */

import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import {
  createProtectedRouteResponses,
  createPublicRouteResponses,
  IdParamSchema,
  ThreadSlugParamSchema,
} from '@/core';

import {
  PodcastDetailResponseSchema,
  PodcastEpisodeListResponseSchema,
  PublicPodcastMetadataResponseSchema,
} from './schema';

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

/**
 * GET /chat/threads/{id}/podcast - Get podcast for thread
 */
export const getPodcastRoute = createRoute({
  description: 'Get the podcast record for a thread (latest by scope)',
  method: 'get',
  path: '/chat/threads/{id}/podcast',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: PodcastDetailResponseSchema },
      },
      description: 'Podcast retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get thread podcast',
  tags: ['podcast'],
});

/**
 * GET /chat/threads/{id}/podcast/audio - Stream podcast audio
 */
export const getPodcastAudioRoute = createRoute({
  description: 'Stream the podcast audio file (MP3) from R2 storage',
  method: 'get',
  path: '/chat/threads/{id}/podcast/audio',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'audio/mpeg': {
          schema: z.string().openapi({
            description: 'MP3 audio binary stream',
          }),
        },
      },
      description: 'Audio stream (MP3)',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Stream podcast audio',
  tags: ['podcast'],
});

/**
 * GET /chat/threads/{id}/podcast/episodes - List all podcast episodes for thread
 */
export const listPodcastEpisodesRoute = createRoute({
  description: 'List all podcast episodes for a thread, ordered by episode number and round number',
  method: 'get',
  path: '/chat/threads/{id}/podcast/episodes',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: PodcastEpisodeListResponseSchema },
      },
      description: 'Podcast episodes retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'List podcast episodes',
  tags: ['podcast'],
});

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

/**
 * GET /chat/public/{slug}/podcast - Public podcast metadata
 */
export const getPublicPodcastRoute = createRoute({
  description: 'Get podcast metadata for a publicly shared thread (no auth required)',
  method: 'get',
  path: '/chat/public/{slug}/podcast',
  request: {
    params: ThreadSlugParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: PublicPodcastMetadataResponseSchema },
      },
      description: 'Public podcast metadata retrieved',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Get public podcast metadata',
  tags: ['podcast'],
});

/**
 * GET /chat/public/{slug}/podcast/audio - Public podcast audio stream
 */
export const getPublicPodcastAudioRoute = createRoute({
  description: 'Stream podcast audio for a publicly shared thread (no auth required)',
  method: 'get',
  path: '/chat/public/{slug}/podcast/audio',
  request: {
    params: ThreadSlugParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'audio/mpeg': {
          schema: z.string().openapi({
            description: 'MP3 audio binary stream',
          }),
        },
      },
      description: 'Audio stream (MP3)',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Stream public podcast audio',
  tags: ['podcast'],
});

/**
 * GET /chat/public/{slug}/podcast/episodes - List public podcast episodes
 */
export const listPublicPodcastEpisodesRoute = createRoute({
  description: 'List all completed podcast episodes for a publicly shared thread (no auth required)',
  method: 'get',
  path: '/chat/public/{slug}/podcast/episodes',
  request: {
    params: ThreadSlugParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: PodcastEpisodeListResponseSchema },
      },
      description: 'Public podcast episodes retrieved successfully',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'List public podcast episodes',
  tags: ['podcast'],
});
