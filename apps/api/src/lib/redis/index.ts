import { Redis } from '@upstash/redis';

/**
 * Get Upstash Redis client for resumable stream storage.
 * Used by AI SDK resumable-stream library for pub/sub streaming.
 */
export function getRedis(env: {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}): Redis {
  return new Redis({
    token: env.UPSTASH_REDIS_REST_TOKEN,
    url: env.UPSTASH_REDIS_REST_URL,
  });
}
