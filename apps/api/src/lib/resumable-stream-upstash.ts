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
 * Overall ceiling on any subscription's lifetime (ms) - 5 minutes.
 *
 * This matches the orchestrator's worst-case work budget: the moderator runs
 * under `AbortSignal.timeout(300000)` (unified-stream-orchestration.service.ts)
 * and the producing request is kept alive across the whole round via
 * `ctx.waitUntil` + a 10s SSE heartbeat. A subscription must be allowed to live
 * that long so a debate round that takes minutes can keep filling the Redis
 * buffer and a reconnecting client can follow it to the end. This is a hard
 * safety net only — normal termination happens via the DONE sentinel (request
 * channel) or the idle timeout (chunk channel), NOT this cap.
 */
const MAX_SUBSCRIPTION_DURATION_MS = 300 * 1000;

/**
 * Idle timeout for chunk (resumer) subscriptions (ms).
 *
 * The resumer's `chunk:{listenerId}` subscription receives every delta plus a
 * heartbeat every ~10s for as long as the producer is alive. We reset the idle
 * timer on every delivered message, so an actively-fed subscription survives a
 * full multi-minute round. Only a genuinely silent (producer-gone) subscription
 * self-terminates after this window — preserving the original anti-hang
 * behavior: a still-pending resumer with zero messages reaps here, letting
 * `resumeStream`'s own 1s ack timeout resolve(null)/error as before. Set well
 * above the 10s heartbeat interval so heartbeats always keep it alive.
 */
const CHUNK_IDLE_TIMEOUT_MS = 25 * 1000;

/**
 * How often to check the DONE sentinel for request (producer) subscriptions (ms).
 *
 * The producer's `request:{streamId}` subscription carries no traffic except
 * new-listener handshakes, so an idle timeout would wrongly reap it during long
 * silent phases (e.g. a 30s+ presearch with no resumers). Instead we poll the
 * stream's completion sentinel and stop only once it flips to DONE. Done at a
 * coarse interval to bound Upstash REST calls.
 */
const SENTINEL_CHECK_INTERVAL_MS = 3 * 1000;

/** Resumable-stream sentinel value written when a stream completes. */
const DONE_SENTINEL_VALUE = 'DONE';

/**
 * Detect the producer's request channel.
 *
 * `resumable-stream/generic` builds channels as `{keyPrefix}:request:{streamId}`
 * for the producer (subscribed once for the whole round) and
 * `{keyPrefix}:chunk:{listenerId}` for each resumer. Lifetimes are opposite:
 * the request channel must live until the stream is DONE; the chunk channel
 * terminates on idle. We branch on the channel substring.
 */
const isRequestChannel = (channel: string) => channel.includes(':request:');

/**
 * Extract the streamId from a request channel so we can locate its sentinel.
 *
 * Request channel format: `{keyPrefix}:request:{streamId}`.
 * Sentinel key format:    `{keyPrefix}:sentinel:{streamId}`.
 */
function sentinelKeyForRequestChannel(channel: string) {
  return channel.replace(':request:', ':sentinel:');
}

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
   * Reads new entries since lastIndex using LRANGE and delivers each to the
   * subscription callback. The termination policy is channel-aware so the
   * subscriber honors `resumable-stream/generic`'s contract (a subscription
   * stays live until the library calls unsubscribe()) for the whole round:
   *
   * - Producer `request:{streamId}` channel: keep polling until the stream's
   *   DONE sentinel is set (or unsubscribe()), bounded by an overall ceiling.
   *   It carries no regular traffic, so an idle cap would wrongly reap it and
   *   break resumers that connect after the first heartbeat gap.
   * - Resumer `chunk:{listenerId}` channel: idle-based cap reset on every
   *   delivered message. The 10s producer heartbeat keeps a live stream alive
   *   for a full multi-minute round; only a gone-producer (silent) subscription
   *   self-terminates, preserving resumeStream's 1s ack semantics.
   *
   * Non-blocking: uses setTimeout-based scheduling to avoid blocking the event
   * loop in Cloudflare Workers, and stays within the orchestrator's 300s budget.
   */
  private pollLoop(channel: string, entry: SubscriptionEntry): void {
    const redis = getRedis(this.env);
    const listKey = `${channel}:msgs`;
    const startTime = Date.now();
    const isRequest = isRequestChannel(channel);
    const sentinelKey = isRequest ? sentinelKeyForRequestChannel(channel) : null;

    // Idle timer (chunk channels): reset on each delivered message.
    let lastActivity = Date.now();
    // Throttle sentinel checks (request channels) to bound REST calls.
    let lastSentinelCheck = 0;
    let sentinelDone = false;

    const terminate = () => {
      entry.active = false;
      this.subscriptions.delete(channel);
    };

    const poll = async () => {
      // Stop if unsubscribed, or past the overall safety ceiling.
      if (!entry.active || Date.now() - startTime > MAX_SUBSCRIPTION_DURATION_MS) {
        terminate();
        return;
      }

      // Request channel: terminate only once the stream is actually DONE.
      if (isRequest) {
        if (sentinelDone) {
          terminate();
          return;
        }
      } else if (Date.now() - lastActivity > CHUNK_IDLE_TIMEOUT_MS) {
        // Chunk channel: idle reap so a gone-producer subscription self-cleans,
        // letting resumable-stream's own 1s ack timeout resolve(null)/error.
        terminate();
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
          // Activity resets the chunk idle timer (no effect on request loop).
          lastActivity = Date.now();
        }

        // For the producer request channel, follow the real completion marker:
        // poll the DONE sentinel periodically so we stop when the round ends
        // rather than on a fixed wall-clock budget.
        if (isRequest && sentinelKey && Date.now() - lastSentinelCheck > SENTINEL_CHECK_INTERVAL_MS) {
          lastSentinelCheck = Date.now();
          const sentinel = await redis.get<string>(sentinelKey);
          if (sentinel === DONE_SENTINEL_VALUE) {
            sentinelDone = true;
          }
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
