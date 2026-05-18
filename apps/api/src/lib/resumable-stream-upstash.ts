/**
 * Upstash Adapter for resumable-stream
 *
 * Implements the Publisher and Subscriber interfaces from resumable-stream/generic
 * for use with Upstash Redis REST API in Cloudflare Workers.
 *
 * CRITICAL: Upstash REST does NOT support persistent pub/sub subscriptions.
 * Standard Redis pub/sub requires a long-lived TCP connection that Upstash REST
 * (HTTP-based) cannot maintain. Instead, this adapter uses Redis lists (RPUSH/LRANGE)
 * as message queues, with the subscriber continuously polling for new messages.
 *
 * Publisher.publish(channel, msg) → RPUSH to a list keyed by channel
 * Subscriber.subscribe(channel, cb) → Polls the list for new entries
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
 * @module api/lib/resumable-stream-upstash
 */

import type { Publisher, Subscriber } from 'resumable-stream/generic';

import type { RedisEnv } from '@/services/streaming/stream-utils';

import { getRedis } from './redis';

export type { RedisEnv } from '@/services/streaming/stream-utils';

/** TTL for message list keys (24 hours, matching resumable-stream sentinel TTL) */
const MESSAGE_LIST_TTL_SECONDS = 24 * 60 * 60;

/** Polling interval for subscriber (ms) */
const POLL_INTERVAL_MS = 50;

/**
 * Max polling duration before giving up (ms) - 25 seconds.
 *
 * Cloudflare Workers has a ~30s idle timeout. The `resumable-stream` package's
 * `resumeStream()` wraps the subscriber in a Promise that only resolves when the
 * first message arrives. If the producer's `waitUntil` has already expired and
 * the sentinel isn't "DONE", no message ever arrives and the Promise hangs forever.
 * Keeping this well under 30s ensures the polling loop self-terminates before the
 * Worker is killed, allowing the 1-second internal timeout in `resumeStream` to
 * fire and either resolve(null) or controller.error().
 */
const MAX_POLL_DURATION_MS = 25 * 1000;

// ============================================================================
// UPSTASH PUBLISHER
// ============================================================================

/**
 * Upstash-compatible Publisher for resumable-stream.
 *
 * Uses Redis lists (RPUSH) for message delivery instead of pub/sub.
 * Each channel maps to a Redis list key `{channel}:msgs`.
 */
export class UpstashPublisher implements Publisher {
  private env: RedisEnv;

  constructor(env: RedisEnv) {
    this.env = env;
  }

  async connect(): Promise<void> {
    // Upstash REST is connectionless - no connection needed
  }

  async publish(channel: string, message: string): Promise<void> {
    const redis = getRedis(this.env);
    const listKey = `${channel}:msgs`;
    // Use pipeline for atomic RPUSH + EXPIRE
    await redis.rpush(listKey, message);
    await redis.expire(listKey, MESSAGE_LIST_TTL_SECONDS);
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    const redis = getRedis(this.env);
    if (options?.EX) {
      await redis.set(key, value, { ex: options.EX });
    } else {
      await redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    const redis = getRedis(this.env);
    return redis.get(key);
  }

  async incr(key: string): Promise<number> {
    const redis = getRedis(this.env);
    return redis.incr(key);
  }
}

// ============================================================================
// UPSTASH SUBSCRIBER (LIST-POLLING)
// ============================================================================

type SubscriptionCallback = (message: string) => void;

type SubscriptionEntry = {
  active: boolean;
  callback: SubscriptionCallback;
  lastIndex: number;
};

/**
 * Upstash-compatible Subscriber for resumable-stream.
 *
 * Since Upstash REST API doesn't support persistent pub/sub subscriptions,
 * this implements continuous polling of Redis lists:
 * - Publisher writes messages to `{channel}:msgs` via RPUSH
 * - Subscriber polls `{channel}:msgs` via LRANGE for new entries
 * - Polling runs at POLL_INTERVAL_MS intervals until unsubscribed or timeout
 */
export class UpstashSubscriber implements Subscriber {
  private env: RedisEnv;
  private subscriptions: Map<string, SubscriptionEntry>;

  constructor(env: RedisEnv) {
    this.env = env;
    this.subscriptions = new Map();
  }

  async connect(): Promise<void> {
    // Upstash REST is connectionless - no connection needed
  }

  async subscribe(channel: string, callback: SubscriptionCallback): Promise<void> {
    const entry: SubscriptionEntry = { active: true, callback, lastIndex: 0 };
    this.subscriptions.set(channel, entry);

    // Start continuous polling (non-blocking - runs in background)
    this.pollLoop(channel, entry);
  }

  async unsubscribe(channel: string): Promise<void> {
    const sub = this.subscriptions.get(channel);
    if (sub) {
      sub.active = false;
      this.subscriptions.delete(channel);
    }
  }

  /**
   * Continuously poll a Redis list for new messages.
   *
   * Reads new entries since lastIndex using LRANGE and delivers each
   * to the subscription callback. Runs until unsubscribed or timeout.
   *
   * Non-blocking: uses setTimeout-based scheduling to avoid blocking
   * the event loop in Cloudflare Workers.
   */
  private pollLoop(channel: string, entry: SubscriptionEntry): void {
    const redis = getRedis(this.env);
    const listKey = `${channel}:msgs`;
    const startTime = Date.now();

    const poll = async () => {
      // Stop if unsubscribed or timed out
      if (!entry.active || Date.now() - startTime > MAX_POLL_DURATION_MS) {
        // Auto-cleanup on timeout so `resumable-stream` internal Promise
        // eventually rejects via its own 1-second timeout guard.
        entry.active = false;
        this.subscriptions.delete(channel);
        return;
      }

      try {
        // Read new messages since lastIndex
        const messages = await redis.lrange<string>(listKey, entry.lastIndex, -1);

        if (messages && messages.length > 0) {
          for (const msg of messages) {
            if (!entry.active) {
              break;
            }
            entry.callback(msg);
          }
          entry.lastIndex += messages.length;
        }
      } catch {
        // Swallow polling errors - will retry on next interval
      }

      // Schedule next poll if still active (re-check after async work)
      if (entry.active) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // Start first poll immediately (non-blocking via microtask)
    setTimeout(poll, 0);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Get resumable stream context for Cloudflare Workers with Upstash Redis.
 *
 * Uses Redis list-based pub/sub (RPUSH/LRANGE polling) instead of native
 * Redis pub/sub, which requires persistent TCP connections incompatible
 * with Upstash REST API.
 *
 * @param env - Upstash Redis environment variables
 * @param waitUntil - Cloudflare Workers ctx.waitUntil function
 * @returns ResumableStreamContext for creating/resuming streams
 */
export async function getResumableStreamContext(
  env: RedisEnv,
  waitUntil: (promise: Promise<unknown>) => void,
) {
  // Dynamic import to avoid bundling issues
  const { createResumableStreamContext } = await import('resumable-stream/generic');

  return createResumableStreamContext({
    publisher: new UpstashPublisher(env),
    subscriber: new UpstashSubscriber(env),
    waitUntil,
  });
}
