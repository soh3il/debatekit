import { ScheduledTweetStatuses, TweetPostingMessageTypes, WebAppEnvs } from '@debatekit/shared/enums';
import type { RouteHandler } from '@hono/zod-openapi';
import { and, desc, eq, lt } from 'drizzle-orm';
import { ulid } from 'ulid';

import { createError } from '@/common/error-handling';
import { createHandler, IdParamSchema, Responses } from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db/tables';
import { requireAdmin } from '@/lib/auth';
import { log } from '@/lib/logger';
import type { ApiEnv } from '@/types';
import type { PostTweetQueueMessage } from '@/types/queues';

import type {
  createTweetRoute,
  deleteTweetRoute,
  listTweetsRoute,
  sendTweetRoute,
  updateTweetRoute,
} from './route';
import {
  CreateTweetRequestSchema,
  TweetListQuerySchema,
  UpdateTweetRequestSchema,
} from './schema';

/**
 * Helper: Transform DB tweet to response format
 */
function transformTweet(
  tweet: typeof tables.scheduledTweet.$inferSelect,
  threadSlug?: string | null,
) {
  return {
    content: tweet.content,
    createdAt: tweet.createdAt.toISOString(),
    id: tweet.id,
    jobId: tweet.jobId ?? null,
    metadata: tweet.metadata ?? null,
    scheduledAt: tweet.scheduledAt?.toISOString() ?? null,
    sentAt: tweet.sentAt?.toISOString() ?? null,
    source: tweet.source,
    status: tweet.status,
    threadId: tweet.threadId ?? null,
    threadSlug: threadSlug ?? null,
    twitterPostId: tweet.twitterPostId ?? null,
    updatedAt: tweet.updatedAt.toISOString(),
    userId: tweet.userId,
    viralScore: tweet.viralScore ?? null,
  };
}

/**
 * List scheduled tweets (admin only)
 */
export const listTweetsHandler: RouteHandler<typeof listTweetsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'listTweets',
    validateQuery: TweetListQuerySchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { cursor, limit = 20, status } = c.validated.query;
    const db = await getDbAsync();

    // Build where conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(tables.scheduledTweet.status, status));
    }
    if (cursor) {
      conditions.push(lt(tables.scheduledTweet.createdAt, new Date(cursor)));
    }

    const tweets = await db
      .select()
      .from(tables.scheduledTweet)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tables.scheduledTweet.createdAt))
      .limit(limit + 1);

    const hasMore = tweets.length > limit;
    const results = hasMore ? tweets.slice(0, limit) : tweets;

    // Get thread slugs for tweets with threadId
    const threadIds = results
      .map(t => t.threadId)
      .filter((id): id is string => id !== null);

    const threadMap = new Map<string, string>();
    if (threadIds.length > 0) {
      const threads = await db.query.chatThread.findMany({
        columns: { id: true, slug: true },
        where: (t, { inArray }) => inArray(t.id, threadIds),
      });
      for (const t of threads) {
        threadMap.set(t.id, t.slug);
      }
    }

    const transformedTweets = results.map((tweet) => {
      const slug = tweet.threadId ? threadMap.get(tweet.threadId) : null;
      return transformTweet(tweet, slug ?? null);
    });

    const lastResult = results.at(-1);
    const nextCursor = hasMore && lastResult
      ? lastResult.createdAt.toISOString()
      : null;

    return Responses.ok(c, {
      hasMore,
      nextCursor,
      total: results.length,
      tweets: transformedTweets,
    });
  },
);

/**
 * Create scheduled tweet (admin only)
 */
export const createTweetHandler: RouteHandler<typeof createTweetRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'createTweet',
    validateBody: CreateTweetRequestSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const body = c.validated.body;
    const db = await getDbAsync();

    const tweetId = ulid();
    const now = new Date();
    const status = body.scheduledAt
      ? ScheduledTweetStatuses.SCHEDULED
      : ScheduledTweetStatuses.DRAFT;

    const [tweet] = await db
      .insert(tables.scheduledTweet)
      .values({
        content: body.content,
        createdAt: now,
        id: tweetId,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        source: body.source,
        status,
        threadId: body.threadId,
        updatedAt: now,
        userId: user.id,
      })
      .returning();

    if (!tweet) {
      throw createError.internal('Failed to create tweet', {
        errorType: 'database',
        operation: 'insert',
        table: 'scheduledTweet',
      });
    }

    // Get thread slug if threadId provided
    let threadSlug: string | null = null;
    if (tweet.threadId) {
      const thread = await db.query.chatThread.findFirst({
        columns: { slug: true },
        where: eq(tables.chatThread.id, tweet.threadId),
      });
      threadSlug = thread?.slug ?? null;
    }

    return Responses.created(c, transformTweet(tweet, threadSlug));
  },
);

/**
 * Update scheduled tweet (admin only)
 *
 * Only draft/scheduled tweets can be updated.
 */
export const updateTweetHandler: RouteHandler<typeof updateTweetRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'updateTweet',
    validateBody: UpdateTweetRequestSchema,
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { id } = c.validated.params;
    const body = c.validated.body;
    const db = await getDbAsync();

    const tweet = await db.query.scheduledTweet.findFirst({
      where: eq(tables.scheduledTweet.id, id),
    });

    if (!tweet) {
      throw createError.notFound('Tweet not found', {
        errorType: 'resource',
        resource: 'scheduledTweet',
        resourceId: id,
      });
    }

    if (tweet.status === ScheduledTweetStatuses.SENT || tweet.status === ScheduledTweetStatuses.FAILED || tweet.status === ScheduledTweetStatuses.CANCELLED) {
      throw createError.badRequest('Cannot update sent, failed, or cancelled tweets', {
        errorType: 'validation',
      });
    }

    // Build update set - typed to Drizzle's inferred columns
    const updateSet: Partial<typeof tables.scheduledTweet.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Handle cancel
    if (body.status === ScheduledTweetStatuses.CANCELLED) {
      updateSet.status = ScheduledTweetStatuses.CANCELLED;
    }

    // Handle move to draft — clears scheduledAt
    if (body.status === ScheduledTweetStatuses.DRAFT) {
      updateSet.status = ScheduledTweetStatuses.DRAFT;
      updateSet.scheduledAt = null;
    }

    if (body.content !== undefined) {
      updateSet.content = body.content;
    }
    if (body.scheduledAt !== undefined) {
      updateSet.scheduledAt = new Date(body.scheduledAt);
      updateSet.status = ScheduledTweetStatuses.SCHEDULED;
    }

    await db
      .update(tables.scheduledTweet)
      .set(updateSet)
      .where(eq(tables.scheduledTweet.id, id));

    // Reload tweet
    const updatedTweet = await db.query.scheduledTweet.findFirst({
      where: eq(tables.scheduledTweet.id, id),
    });

    if (!updatedTweet) {
      throw createError.internal('Failed to reload tweet', {
        errorType: 'database',
        operation: 'select',
        table: 'scheduledTweet',
      });
    }

    // Get thread slug
    let threadSlug: string | null = null;
    if (updatedTweet.threadId) {
      const thread = await db.query.chatThread.findFirst({
        columns: { slug: true },
        where: eq(tables.chatThread.id, updatedTweet.threadId),
      });
      threadSlug = thread?.slug ?? null;
    }

    return Responses.ok(c, transformTweet(updatedTweet, threadSlug));
  },
);

/**
 * Send tweet immediately (admin only)
 *
 * Queues the tweet for immediate posting via TWEET_POSTING_QUEUE.
 * Actual posting happens async in the tweet-posting-queue worker.
 */
export const sendTweetHandler: RouteHandler<typeof sendTweetRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'sendTweet',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { id } = c.validated.params;
    const db = await getDbAsync();

    const tweet = await db.query.scheduledTweet.findFirst({
      where: eq(tables.scheduledTweet.id, id),
    });

    if (!tweet) {
      throw createError.notFound('Tweet not found', {
        errorType: 'resource',
        resource: 'scheduledTweet',
        resourceId: id,
      });
    }

    if (tweet.status === ScheduledTweetStatuses.SENT) {
      throw createError.badRequest('Tweet has already been sent', {
        errorType: 'validation',
      });
    }

    if (tweet.status === ScheduledTweetStatuses.CANCELLED) {
      throw createError.badRequest('Cannot send a cancelled tweet. Create a new one instead.', {
        errorType: 'validation',
      });
    }

    // SAFETY: Only allow tweet posting in production
    if (c.env.WEBAPP_ENV !== WebAppEnvs.PROD) {
      throw createError.badRequest('Tweet posting is only available in production', {
        errorType: 'validation',
      });
    }

    // Queue the tweet for immediate posting
    try {
      const message: PostTweetQueueMessage = {
        messageId: `send-${id}-${Date.now()}`,
        queuedAt: new Date().toISOString(),
        tweetId: id,
        type: TweetPostingMessageTypes.POST_TWEET,
      };

      await c.env.TWEET_POSTING_QUEUE.send(message);

      // Mark as scheduled for immediate sending
      await db
        .update(tables.scheduledTweet)
        .set({
          scheduledAt: new Date(),
          status: ScheduledTweetStatuses.SCHEDULED,
          updatedAt: new Date(),
        })
        .where(eq(tables.scheduledTweet.id, id));
    } catch (err) {
      log.queue('error', '[sendTweet] Failed to queue tweet', { error: err instanceof Error ? err.message : String(err) });
      throw createError.internal('Failed to queue tweet for posting', {
        errorType: 'queue',
        operation: 'send',
        queueName: 'TWEET_POSTING_QUEUE',
      });
    }

    return Responses.ok(c, { sent: true, twitterPostId: null });
  },
);

/**
 * Delete scheduled tweet (admin only)
 *
 * Only draft/scheduled tweets can be deleted.
 */
export const deleteTweetHandler: RouteHandler<typeof deleteTweetRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'deleteTweet',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const { id } = c.validated.params;
    const db = await getDbAsync();

    const tweet = await db.query.scheduledTweet.findFirst({
      where: eq(tables.scheduledTweet.id, id),
    });

    if (!tweet) {
      throw createError.notFound('Tweet not found', {
        errorType: 'resource',
        resource: 'scheduledTweet',
        resourceId: id,
      });
    }

    if (tweet.status === ScheduledTweetStatuses.SENT) {
      throw createError.badRequest('Cannot delete a tweet that has already been sent', {
        errorType: 'validation',
      });
    }

    await db.delete(tables.scheduledTweet).where(eq(tables.scheduledTweet.id, id));

    return Responses.ok(c, { deleted: true });
  },
);
