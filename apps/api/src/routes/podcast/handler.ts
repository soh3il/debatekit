/**
 * Podcast Route Handlers
 *
 * Business logic for podcast retrieval and audio streaming.
 * Follows createHandler pattern with session authentication.
 */

import { PodcastScopeSchema, PodcastStatuses, PodcastStatusSchema } from '@debatekit/shared/enums';
import type { RouteHandler } from '@hono/zod-openapi';
import { and, asc, desc, eq, or } from 'drizzle-orm';

import { createError } from '@/common/error-handling';
import { createHandler, IdParamSchema, Responses, ThreadSlugParamSchema } from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import { AdminUserSchema, requireAdmin } from '@/lib/auth/utils';
import { getFileStream } from '@/services/uploads/storage.service';
import type { ApiEnv } from '@/types';

import type {
  getPodcastAudioRoute,
  getPodcastRoute,
  getPublicPodcastAudioRoute,
  getPublicPodcastRoute,
  listPodcastEpisodesRoute,
  listPublicPodcastEpisodesRoute,
} from './route';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format a podcast record for API response.
 */
function formatPodcastResponse(podcast: typeof tables.chatPodcast.$inferSelect) {
  return {
    audioDurationMs: podcast.audioDurationMs,
    audioSizeBytes: podcast.audioSizeBytes,
    characterCount: podcast.characterCount,
    completedAt: podcast.completedAt?.toISOString() ?? null,
    createdAt: podcast.createdAt.toISOString(),
    creditsUsed: podcast.creditsUsed,
    episodeNumber: podcast.episodeNumber,
    episodeTitle: podcast.episodeTitle ?? null,
    errorMessage: podcast.errorMessage,
    id: podcast.id,
    progress: podcast.progress,
    roundNumber: podcast.roundNumber,
    scope: podcast.scope,
    scriptData: podcast.scriptData ?? null,
    status: podcast.status,
    threadId: podcast.threadId,
  };
}

/**
 * Look up a public thread by slug. Throws 404 if not found or not public.
 * Checks both current slug and previousSlug to handle renamed threads
 * (matches getPublicThreadHandler behavior).
 */
async function findPublicThreadBySlug(slug: string) {
  const db = await getDbAsync();
  const thread = await db.query.chatThread.findFirst({
    where: and(
      or(
        eq(tables.chatThread.slug, slug),
        eq(tables.chatThread.previousSlug, slug),
      ),
      eq(tables.chatThread.isPublic, true),
    ),
  });

  if (!thread) {
    throw createError.notFound('Thread not found', {
      errorType: 'resource',
      resource: 'thread',
    });
  }

  return thread;
}

/**
 * Stream audio from R2 as an MP3 response with proper headers.
 * Supports Range requests for seeking (required by mobile Safari).
 */
async function streamAudioFromR2(
  env: ApiEnv['Bindings'],
  r2Key: string,
  sizeBytes: number | null,
  rangeHeader?: string,
  isCompleted = true,
) {
  const result = await getFileStream(env.UPLOADS_R2_BUCKET, r2Key, {
    range: rangeHeader ? new Headers({ range: rangeHeader }) : undefined,
  });

  if (!result.found || !result.body) {
    throw createError.notFound('Audio file not found in storage', {
      errorType: 'resource',
      resource: 'podcast_audio',
    });
  }

  const headers = new Headers();
  headers.set('content-type', 'audio/mpeg');
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', isCompleted
    ? 'public, max-age=31536000, immutable'
    : 'no-cache, no-store, must-revalidate');
  if (result.httpEtag) {
    headers.set('etag', result.httpEtag);
  }
  result.writeHttpMetadata(headers);

  // Handle Range request -> 206 Partial Content
  if (rangeHeader && sizeBytes && result.size !== undefined) {
    headers.set('content-length', String(result.size));
    // Parse "bytes=START-END" to build Content-Range
    const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (rangeMatch?.[1]) {
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = rangeMatch[2] ? Number.parseInt(rangeMatch[2], 10) : sizeBytes - 1;
      headers.set('content-range', `bytes ${start}-${end}/${sizeBytes}`);
    }
    return new Response(result.body, { headers, status: 206 });
  }

  if (sizeBytes) {
    headers.set('content-length', String(sizeBytes));
  }

  return new Response(result.body, { headers, status: 200 });
}

// ============================================================================
// GET PODCAST
// ============================================================================

export const getPodcastHandler: RouteHandler<typeof getPodcastRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getPodcast',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(AdminUserSchema.parse(user));
    const { id: threadId } = c.validated.params;
    const db = await getDbAsync();

    // Optional query params for polling/filtering
    const rawScope = c.req.query('scope');
    const rawRoundNumber = c.req.query('roundNumber');
    const rawStatus = c.req.query('status');

    // Verify thread ownership
    const thread = await db.query.chatThread.findFirst({
      where: and(
        eq(tables.chatThread.id, threadId),
        eq(tables.chatThread.userId, user.id),
      ),
    });

    if (!thread) {
      throw createError.notFound('Thread not found', {
        errorType: 'resource',
        resource: 'thread',
        resourceId: threadId,
        userId: user.id,
      });
    }

    // Build where clause with optional filters
    const conditions = [eq(tables.chatPodcast.threadId, threadId)];

    const parsedScope = PodcastScopeSchema.safeParse(rawScope);
    if (parsedScope.success) {
      conditions.push(eq(tables.chatPodcast.scope, parsedScope.data));
    }

    if (rawRoundNumber !== undefined) {
      const parsed = Number.parseInt(rawRoundNumber, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        conditions.push(eq(tables.chatPodcast.roundNumber, parsed));
      }
    }

    const parsedStatus = PodcastStatusSchema.safeParse(rawStatus);
    if (parsedStatus.success) {
      conditions.push(eq(tables.chatPodcast.status, parsedStatus.data));
    }

    const podcast = await db.query.chatPodcast.findFirst({
      orderBy: desc(tables.chatPodcast.createdAt),
      where: and(...conditions),
    });

    if (!podcast) {
      throw createError.notFound('Podcast not found', {
        errorType: 'resource',
        resource: 'podcast',
        resourceId: threadId,
        userId: user.id,
      });
    }

    return Responses.ok(c, formatPodcastResponse(podcast));
  },
);

// ============================================================================
// GET PODCAST AUDIO (streaming)
// ============================================================================

export const getPodcastAudioHandler: RouteHandler<typeof getPodcastAudioRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getPodcastAudio',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(AdminUserSchema.parse(user));
    const { id: threadId } = c.validated.params;
    const db = await getDbAsync();

    // Verify thread ownership
    const thread = await db.query.chatThread.findFirst({
      where: and(
        eq(tables.chatThread.id, threadId),
        eq(tables.chatThread.userId, user.id),
      ),
    });

    if (!thread) {
      throw createError.notFound('Thread not found', {
        errorType: 'resource',
        resource: 'thread',
        resourceId: threadId,
        userId: user.id,
      });
    }

    // Read optional query params for scope/round filtering
    const rawScope = c.req.query('scope');
    const rawRoundNumber = c.req.query('roundNumber');

    const conditions = [
      eq(tables.chatPodcast.threadId, threadId),
      or(
        eq(tables.chatPodcast.status, PodcastStatuses.COMPLETED),
        eq(tables.chatPodcast.status, PodcastStatuses.GENERATING_AUDIO),
      ),
    ];

    const parsedScope = PodcastScopeSchema.safeParse(rawScope);
    if (parsedScope.success) {
      conditions.push(eq(tables.chatPodcast.scope, parsedScope.data));
    }

    if (rawRoundNumber !== undefined) {
      const parsed = Number.parseInt(rawRoundNumber, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        conditions.push(eq(tables.chatPodcast.roundNumber, parsed));
      }
    }

    const podcast = await db.query.chatPodcast.findFirst({
      orderBy: desc(tables.chatPodcast.createdAt),
      where: and(...conditions),
    });

    if (!podcast?.audioR2Key) {
      throw createError.notFound('Podcast audio not found', {
        errorType: 'resource',
        resource: 'podcast_audio',
        resourceId: threadId,
        userId: user.id,
      });
    }

    const isCompleted = podcast.status === PodcastStatuses.COMPLETED;
    return streamAudioFromR2(c.env, podcast.audioR2Key, podcast.audioSizeBytes, c.req.header('range'), isCompleted);
  },
);

// ============================================================================
// PUBLIC PODCAST METADATA
// ============================================================================

export const getPublicPodcastHandler: RouteHandler<typeof getPublicPodcastRoute, ApiEnv> = createHandler(
  {
    auth: 'public',
    operationName: 'getPublicPodcast',
    validateParams: ThreadSlugParamSchema,
  },
  async (c) => {
    const { slug } = c.validated.params;
    const thread = await findPublicThreadBySlug(slug);
    const db = await getDbAsync();

    const podcast = await db.query.chatPodcast.findFirst({
      orderBy: desc(tables.chatPodcast.createdAt),
      where: and(
        eq(tables.chatPodcast.threadId, thread.id),
        eq(tables.chatPodcast.status, PodcastStatuses.COMPLETED),
      ),
    });

    if (!podcast) {
      throw createError.notFound('Podcast not found', {
        errorType: 'resource',
        resource: 'podcast',
      });
    }

    // Podcast metadata changes when new episodes complete; prevent stale cache
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.header('CDN-Cache-Control', 'no-store');

    return Responses.ok(c, formatPodcastResponse(podcast));
  },
);

// ============================================================================
// PUBLIC PODCAST AUDIO (streaming)
// ============================================================================

export const getPublicPodcastAudioHandler: RouteHandler<typeof getPublicPodcastAudioRoute, ApiEnv> = createHandler(
  {
    auth: 'public',
    operationName: 'getPublicPodcastAudio',
    validateParams: ThreadSlugParamSchema,
  },
  async (c) => {
    const { slug } = c.validated.params;
    const thread = await findPublicThreadBySlug(slug);
    const db = await getDbAsync();

    // Read optional query params for scope/round filtering
    const rawScope = c.req.query('scope');
    const rawRoundNumber = c.req.query('roundNumber');

    const conditions = [
      eq(tables.chatPodcast.threadId, thread.id),
      eq(tables.chatPodcast.status, PodcastStatuses.COMPLETED),
    ];

    const parsedScope = PodcastScopeSchema.safeParse(rawScope);
    if (parsedScope.success) {
      conditions.push(eq(tables.chatPodcast.scope, parsedScope.data));
    }

    if (rawRoundNumber !== undefined) {
      const parsed = Number.parseInt(rawRoundNumber, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        conditions.push(eq(tables.chatPodcast.roundNumber, parsed));
      }
    }

    const podcast = await db.query.chatPodcast.findFirst({
      orderBy: desc(tables.chatPodcast.createdAt),
      where: and(...conditions),
    });

    if (!podcast?.audioR2Key) {
      throw createError.notFound('Podcast audio not found', {
        errorType: 'resource',
        resource: 'podcast_audio',
      });
    }

    return streamAudioFromR2(c.env, podcast.audioR2Key, podcast.audioSizeBytes, c.req.header('range'), true);
  },
);

// ============================================================================
// LIST PODCAST EPISODES
// ============================================================================

export const listPodcastEpisodesHandler: RouteHandler<typeof listPodcastEpisodesRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'listPodcastEpisodes',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(AdminUserSchema.parse(user));
    const { id: threadId } = c.validated.params;
    const db = await getDbAsync();

    // Verify thread ownership
    const thread = await db.query.chatThread.findFirst({
      where: and(
        eq(tables.chatThread.id, threadId),
        eq(tables.chatThread.userId, user.id),
      ),
    });

    if (!thread) {
      throw createError.notFound('Thread not found', {
        errorType: 'resource',
        resource: 'thread',
        resourceId: threadId,
        userId: user.id,
      });
    }

    // Get all podcast episodes for this thread, ordered by episodeNumber then roundNumber
    const episodes = await db.query.chatPodcast.findMany({
      orderBy: [asc(tables.chatPodcast.roundNumber), asc(tables.chatPodcast.createdAt)],
      where: eq(tables.chatPodcast.threadId, threadId),
    });

    return Responses.ok(c, episodes.map(formatPodcastResponse));
  },
);

// ============================================================================
// LIST PUBLIC PODCAST EPISODES
// ============================================================================

export const listPublicPodcastEpisodesHandler: RouteHandler<typeof listPublicPodcastEpisodesRoute, ApiEnv> = createHandler(
  {
    auth: 'public',
    operationName: 'listPublicPodcastEpisodes',
    validateParams: ThreadSlugParamSchema,
  },
  async (c) => {
    const { slug } = c.validated.params;
    const thread = await findPublicThreadBySlug(slug);
    const db = await getDbAsync();

    // Only return completed episodes for public access
    const episodes = await db.query.chatPodcast.findMany({
      orderBy: [asc(tables.chatPodcast.roundNumber), asc(tables.chatPodcast.createdAt)],
      where: and(
        eq(tables.chatPodcast.threadId, thread.id),
        eq(tables.chatPodcast.status, PodcastStatuses.COMPLETED),
      ),
    });

    // Episode list changes when new podcasts complete; prevent stale cache
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.header('CDN-Cache-Control', 'no-store');

    return Responses.ok(c, episodes.map(formatPodcastResponse));
  },
);
