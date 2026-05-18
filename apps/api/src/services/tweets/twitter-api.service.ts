/**
 * Twitter API v2 Service - Post and delete tweets via twitter-api-v2 SDK
 *
 * Uses twitter-api-v2 package with OAuth 1.0a User Context authentication.
 * Compatible with Cloudflare Workers runtime (nodejs_compat enabled).
 *
 * @see https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference
 */

import { ErrorContextTypes } from '@debatekit/shared/enums';
import { ApiResponseError, TwitterApi } from 'twitter-api-v2';
import { z } from 'zod';

import { ErrorContextBuilders } from '@/common/error-contexts';
import { createError } from '@/common/error-handling';
import type { ErrorContext } from '@/core';
import { isAppError } from '@/core';
import { log } from '@/lib/logger';
import type { ApiEnv } from '@/types';

// ============================================================================
// CONFIG SCHEMA
// ============================================================================

const TwitterApiConfigSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenSecret: z.string().min(1),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

type TwitterApiConfig = z.infer<typeof TwitterApiConfigSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

/** 280 for standard accounts, 25000 for X Premium */
const MAX_TWEET_LENGTH = 280;

/**
 * Twitter wraps all URLs via t.co, which counts as exactly 23 characters
 * regardless of the original URL length.
 */
const TCO_URL_LENGTH = 23;

/** Regex matching http/https URLs in tweet content */
const URL_REGEX = /https?:\/\/\S+/g;

// ============================================================================
// MEDIA HELPERS
// ============================================================================

/** Twitter API v2 media_ids tuple type — supports 1-4 media attachments */
type MediaIdsTuple = [string] | [string, string] | [string, string, string] | [string, string, string, string];

/**
 * Build a typed media_ids tuple from a string array.
 * Twitter API v2 requires a tuple of 1-4 media IDs.
 */
function buildMediaIdsTuple(ids: string[]): MediaIdsTuple | undefined {
  const [a, b, c, d] = ids;

  if (!a) {
    return undefined;
  }

  if (!b) {
    return [a];
  }

  if (!c) {
    return [a, b];
  }

  if (!d) {
    return [a, b, c];
  }

  return [a, b, c, d];
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

function twitterErrorContext(operation: string): ErrorContext {
  return ErrorContextBuilders.externalService('twitter', operation);
}

/**
 * Extract a human-readable message from a twitter-api-v2 SDK error.
 *
 * The SDK's `ApiResponseError` has a `.data` property with the full
 * Twitter API error payload (title, detail, errors array). Without this,
 * we only get the generic "Request failed with code 403" message.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiResponseError) {
    const parts: string[] = [`HTTP ${error.code}`];

    if (error.data.title) {
      parts.push(error.data.title);
    }

    if (error.data.detail) {
      parts.push(error.data.detail);
    }

    // V2 errors array
    if (error.data.errors && error.data.errors.length > 0) {
      const msgs = error.data.errors.map(e =>
        'message' in e ? e.message : ('detail' in e ? e.detail : ''),
      ).filter(Boolean);
      if (msgs.length > 0) {
        parts.push(msgs.join('; '));
      }
    }

    // V1-style single error field
    if (error.data.error) {
      parts.push(error.data.error);
    }

    return parts.join(' — ');
  }

  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// ============================================================================
// CHARACTER COUNT
// ============================================================================

/**
 * Calculate the effective tweet length as Twitter sees it.
 * Replaces all URLs with 23-character t.co placeholders before measuring.
 *
 * @param content - Raw tweet text
 * @returns Character count Twitter will use for length validation
 */
export function calculateTweetLength(content: string) {
  const normalized = content.replace(URL_REGEX, 'x'.repeat(TCO_URL_LENGTH));
  return normalized.length;
}

// ============================================================================
// CLIENT FACTORY
// ============================================================================

export function createTwitterClient(config: TwitterApiConfig) {
  return new TwitterApi({
    accessSecret: config.accessTokenSecret,
    accessToken: config.accessToken,
    appKey: config.apiKey,
    appSecret: config.apiSecret,
  }, {
    compression: 'identity',
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Post a tweet via Twitter API v2.
 *
 * @param config - OAuth 1.0a credentials
 * @param content - Tweet text (max 4000 characters for X Premium)
 * @param mediaIds - Optional array of Twitter media IDs to attach
 * @returns Object containing the created tweet ID
 */
export async function postTweet(
  config: TwitterApiConfig,
  content: string,
  mediaIds?: string[],
): Promise<{ tweetId: string }> {
  if (content.length === 0) {
    throw createError.badRequest(
      'Tweet content cannot be empty',
      twitterErrorContext('post_tweet'),
    );
  }

  const effectiveLength = calculateTweetLength(content);

  if (effectiveLength > MAX_TWEET_LENGTH) {
    throw createError.badRequest(
      `Tweet exceeds ${MAX_TWEET_LENGTH} characters (effective length: ${effectiveLength}, raw: ${content.length})`,
      twitterErrorContext('post_tweet'),
    );
  }

  try {
    const client = createTwitterClient(config);

    // Use the overload: tweet(status: string, payload?: Partial<SendTweetV2Params>)
    const hasMedia = mediaIds && mediaIds.length > 0;

    // Build media_ids tuple — Twitter API v2 accepts 1-4 media IDs
    const mediaIdsTuple = hasMedia
      ? buildMediaIdsTuple(mediaIds)
      : undefined;

    const result = mediaIdsTuple
      ? await client.v2.tweet(content, { media: { media_ids: mediaIdsTuple } })
      : await client.v2.tweet(content);

    log.info(`[Twitter] Tweet posted successfully: ${result.data.id}${hasMedia ? ` (with ${mediaIds.length} media)` : ''}`);

    return { tweetId: result.data.id };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    const errMsg = extractErrorMessage(error);
    log.error(`[Twitter] Post tweet failed: ${errMsg}`);
    throw createError.internal(
      `Twitter post tweet failed: ${errMsg}`,
      twitterErrorContext('post_tweet'),
    );
  }
}

/**
 * Delete a tweet via Twitter API v2.
 *
 * @param config - OAuth 1.0a credentials
 * @param tweetId - ID of the tweet to delete
 */
export async function deleteTweet(
  config: TwitterApiConfig,
  tweetId: string,
): Promise<void> {
  if (!tweetId) {
    throw createError.badRequest(
      'Tweet ID is required',
      twitterErrorContext('delete_tweet'),
    );
  }

  try {
    const client = createTwitterClient(config);
    const result = await client.v2.deleteTweet(tweetId);

    if (!result.data.deleted) {
      log.warn(`[Twitter] Tweet ${tweetId} delete returned deleted=false`);
    }

    log.info(`[Twitter] Tweet deleted: ${tweetId}`);
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    const errMsg = extractErrorMessage(error);
    log.error(`[Twitter] Delete tweet failed: ${errMsg}`);
    throw createError.internal(
      `Twitter delete tweet failed: ${errMsg}`,
      twitterErrorContext('delete_tweet'),
    );
  }
}

/**
 * Extract and validate Twitter API config from Cloudflare environment bindings.
 *
 * Expects the following secrets in CloudflareEnv:
 * - TWITTER_ACCESS_TOKEN
 * - TWITTER_ACCESS_TOKEN_SECRET
 * - TWITTER_API_KEY
 * - TWITTER_API_SECRET
 *
 * @param env - Cloudflare environment bindings
 * @returns Validated TwitterApiConfig
 * @throws AppError if any required env var is missing
 */
export function getTwitterConfig(env: ApiEnv['Bindings']) {
  const result = TwitterApiConfigSchema.safeParse({
    accessToken: env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: env.TWITTER_ACCESS_TOKEN_SECRET,
    apiKey: env.TWITTER_API_KEY,
    apiSecret: env.TWITTER_API_SECRET,
  });

  if (!result.success) {
    const missingKeys = result.error.issues.map(i => i.path.join('.')).join(', ');
    const context: ErrorContext = {
      configKey: missingKeys,
      errorType: ErrorContextTypes.CONFIGURATION,
      service: 'twitter',
    };
    throw createError.internal(
      `Twitter API configuration invalid: ${missingKeys}`,
      context,
    );
  }

  return result.data;
}

export type { TwitterApiConfig };
export { TwitterApiConfigSchema };
