/**
 * MCP Worker Environment — Secret Bindings
 *
 * Wrangler-declared bindings (DB, KV, vars) are auto-generated in
 * worker-configuration.d.ts via `bun run cf-typegen`.
 *
 * Secrets set via `wrangler secret put` are NOT in wrangler.jsonc,
 * so we augment the ambient Env interface here.
 *
 * Re-export the global Env so files can `import type { Env } from './types'`.
 */
declare global {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Env {
    /** OpenRouter API key for model generation */
    OPENROUTER_API_KEY: string;
    /** Better Auth secret for future session validation */
    BETTER_AUTH_SECRET: string;
    /** PostHog API key for analytics (set via wrangler secrets) */
    POSTHOG_API_KEY: string;
    /** PostHog host URL for analytics (set via wrangler secrets) */
    POSTHOG_HOST: string;
  }
}

/** Re-export global Env so files can `import type { Env } from './types'` */
export type Env = globalThis.Env;
