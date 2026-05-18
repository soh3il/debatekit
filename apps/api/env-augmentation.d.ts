/**
 * CloudflareEnv Augmentation
 *
 * Extends the auto-generated CloudflareEnv interface with bindings
 * that are not yet in the wrangler-generated types (secrets added
 * via `wrangler secret put`, newly added queue bindings, etc.).
 *
 * We augment BOTH Cloudflare.Env (used by `import { env } from 'cloudflare:workers'`)
 * and CloudflareEnv (used by Hono bindings via ApiEnv).
 *
 * These will be included in the auto-generated file after the next
 * `wrangler types` run with the deployed secrets. Until then, this
 * file provides the missing type definitions.
 *
 * NOTE: Uses `interface` (not `type`) for declaration merging.
 * eslint-disable ts/consistent-type-definitions -- Required for ambient declaration merging
 */

/* eslint-disable ts/consistent-type-definitions */

declare namespace Cloudflare {
  interface Env {
    // Twitter API OAuth 1.0a secrets (set via `wrangler secret put`)
    TWITTER_ACCESS_TOKEN: string;
    TWITTER_ACCESS_TOKEN_SECRET: string;
    TWITTER_API_KEY: string;
    TWITTER_API_SECRET: string;

    // ElevenLabs API secret (set via `wrangler secret put`)
    ELEVENLABS_API_KEY: string;

    // Tweet posting queue binding (added to wrangler.jsonc)
    TWEET_POSTING_QUEUE: Queue;
  }
}

// CloudflareEnv extends Cloudflare.Env, so it inherits the above.
// Explicit redeclaration ensures direct usage of CloudflareEnv also works.
interface CloudflareEnv {
  TWITTER_ACCESS_TOKEN: string;
  TWITTER_ACCESS_TOKEN_SECRET: string;
  TWITTER_API_KEY: string;
  TWITTER_API_SECRET: string;
  ELEVENLABS_API_KEY: string;
  TWEET_POSTING_QUEUE: Queue;
}
