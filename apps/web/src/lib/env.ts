/**
 * Environment Variable Validation
 *
 * Provides Zod-based validation for frontend environment variables.
 *
 * BUILD-TIME RESOLUTION:
 * Vite loads .env files per --mode flag and statically replaces
 * import.meta.env.VITE_* in both client and SSR bundles at build time.
 *
 * .env           -> base defaults (committed)
 * .env.preview   -> preview overrides (committed, --mode preview)
 * .env.production -> production overrides (committed, default for vite build)
 * .env.local     -> developer overrides (gitignored)
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables
 */

import { WebAppEnvSchema } from '@debatekit/shared/enums';
import { z } from 'zod';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * Required environment variables
 *
 * VITE_WEBAPP_ENV defaults to 'prod' for SAFETY: if somehow missing in a
 * production build (CI misconfiguration, wrong wrangler env), we want
 * production URLs (debatekit.ai), not localhost. Local dev always has
 * this set via .env and wrangler.jsonc.
 */
const RequiredEnvSchema = z.object({
  VITE_WEBAPP_ENV: WebAppEnvSchema.default('prod'),
});

/**
 * Optional environment variables with defaults
 * Missing values are logged as warnings in development
 */
const OptionalEnvSchema = z.object({
  VITE_MAINTENANCE: z
    .string()
    .default('false')
    .transform(val => val === 'true'),
  VITE_POSTHOG_API_KEY: z.string().default(''),
});

/**
 * Combined environment schema
 */
const EnvSchema = RequiredEnvSchema.merge(OptionalEnvSchema);

/**
 * Validated environment type
 */
export type ValidatedEnv = z.infer<typeof EnvSchema>;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Raw environment values using STATIC import.meta.env access
 *
 * CRITICAL: Vite replaces import.meta.env.VITE_* at build time via string
 * replacement. Dynamic access like import.meta.env[key] CANNOT be replaced
 * and will be undefined in the production bundle. Each variable MUST be
 * accessed as a direct static property.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables
 */
function getRawEnv(): Record<string, string | undefined> {
  return {
    VITE_MAINTENANCE: import.meta.env.VITE_MAINTENANCE,
    VITE_POSTHOG_API_KEY: import.meta.env.VITE_POSTHOG_API_KEY,
    VITE_WEBAPP_ENV: import.meta.env.VITE_WEBAPP_ENV,
  };
}

/**
 * Validate environment variables with proper error handling
 *
 * NOTE: During SSR, import.meta.env may not be fully populated.
 * Required vars have defaults to handle this gracefully.
 */
function validateEnv(): ValidatedEnv {
  const rawEnv = getRawEnv();

  const fullResult = EnvSchema.safeParse(rawEnv);
  if (!fullResult.success) {
    // Cannot use rlog here (circular dep: env → dev-logger → base-urls → env).
    // Validation errors are non-fatal — Zod defaults apply.
    return EnvSchema.parse({});
  }

  return fullResult.data;
}

// ============================================================================
// ENVIRONMENT ACCESS
// ============================================================================

/**
 * Get validated environment variables
 *
 * Re-evaluates on every call (no caching) to ensure correct values
 * across SSR and client contexts. import.meta.env values are inlined
 * by Vite at build time so there's no performance cost to re-reading.
 */
export function getEnv(): ValidatedEnv {
  return validateEnv();
}

// ============================================================================
// TYPED GETTERS
// ============================================================================

/**
 * Get the current webapp environment
 *
 * Uses static import.meta.env.VITE_WEBAPP_ENV (Vite build-time replacement).
 * Falls back to process.env and import.meta.env.MODE for safety.
 *
 * Defaults to 'prod' for safety (not 'local') to avoid accidentally
 * disabling analytics, error tracking, etc. in production.
 */
export function getWebappEnvFromEnv() {
  const env = getEnv();

  if (env.VITE_WEBAPP_ENV) {
    return env.VITE_WEBAPP_ENV;
  }

  // Fallback: check process.env (server-side, wrangler.jsonc vars)
  const processEnvResult = WebAppEnvSchema.safeParse(process.env['VITE_WEBAPP_ENV']);
  if (processEnvResult.success) {
    return processEnvResult.data;
  }

  // Fallback: Vite build mode detection
  if (import.meta.env.MODE === 'development') {
    return 'local' as const;
  }

  // Ultimate safety: default to prod
  return 'prod' as const;
}

/**
 * Get the PostHog API key
 */
export function getPostHogApiKey() {
  return getEnv().VITE_POSTHOG_API_KEY;
}

/**
 * Check if maintenance mode is enabled
 */
export function isMaintenanceMode() {
  return getEnv().VITE_MAINTENANCE;
}

// ============================================================================
// FEATURE CHECKS
// ============================================================================

/**
 * Check if analytics is configured
 */
export function isAnalyticsConfigured() {
  return Boolean(getEnv().VITE_POSTHOG_API_KEY);
}
