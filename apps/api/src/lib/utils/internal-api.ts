/**
 * Internal API Utilities
 *
 * Shared utilities for making authenticated internal API calls from queue workers.
 * Used by round orchestration and job orchestration services.
 *
 * @see https://better-auth.com/docs/concepts/cookies - Better Auth cookie configuration
 */

import { BASE_URL_CONFIG, getCookieConfig } from '@debatekit/shared';
import { WebAppEnvs, WebAppEnvSchema } from '@debatekit/shared/enums';

import { BETTER_AUTH_COOKIE_PREFIX, BETTER_AUTH_SESSION_COOKIE_NAME } from '@/lib/auth/utils';

/**
 * Get API base URL for current environment
 *
 * IMPORTANT: Returns the API origin (e.g., api-preview.debatekit.com), NOT the web app URL.
 * Queue consumers need to call the API directly, not through the web frontend proxy.
 * The web frontend proxy can lose/mishandle session cookies, causing 401 errors.
 */
export function getBaseUrl(env: { WEBAPP_ENV?: string }): string {
  const envResult = WebAppEnvSchema.safeParse(env.WEBAPP_ENV);
  const validEnv = envResult.success ? envResult.data : WebAppEnvs.LOCAL;
  return BASE_URL_CONFIG[validEnv].apiOrigin;
}

/**
 * Get the full session cookie name for the given environment.
 *
 * Better Auth cookie naming follows this pattern:
 * - Non-secure (local): `{prefix}.session_token` (e.g., `better-auth.session_token`)
 * - Secure (prod/preview): `__Secure-{prefix}.session_token` (e.g., `__Secure-better-auth.session_token`)
 *
 * The `__Secure-` prefix is added by Better Auth when `useSecureCookies: true` (production mode).
 *
 * @see https://better-auth.com/docs/concepts/cookies
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#cookie_prefixes
 */
function getSessionCookieName(env: { WEBAPP_ENV?: string }): string {
  const envResult = WebAppEnvSchema.safeParse(env.WEBAPP_ENV);
  const validEnv = envResult.success ? envResult.data : WebAppEnvs.LOCAL;

  // Build the base cookie name: {prefix}.session_token
  const baseCookieName = `${BETTER_AUTH_COOKIE_PREFIX}.${BETTER_AUTH_SESSION_COOKIE_NAME}`;

  // In production or preview, Better Auth adds the __Secure- prefix
  const { secure } = getCookieConfig(validEnv);
  return secure ? `__Secure-${baseCookieName}` : baseCookieName;
}

/**
 * Build auth headers using user's session cookie
 *
 * Uses the session token from the original request (passed via queue message)
 * to authenticate with Better Auth - same as browser-based requests.
 *
 * IMPORTANT: In production/preview, the cookie name includes the __Secure- prefix.
 * This matches how Better Auth sets cookies with `useSecureCookies: true`.
 *
 * @see https://better-auth.com/docs/concepts/cookies
 */
export function buildSessionAuthHeaders(sessionToken: string, env: { WEBAPP_ENV?: string } = {}): Record<string, string> {
  const cookieName = getSessionCookieName(env);
  return {
    'Content-Type': 'application/json',
    'Cookie': `${cookieName}=${sessionToken}`,
  };
}

/**
 * Build auth headers using internal API key (for queue workers)
 *
 * Uses BETTER_AUTH_SECRET as a shared secret between queue workers and API handlers.
 * This avoids dependency on session tokens which can expire, causing 401 failures
 * in long-running automated jobs.
 *
 * @see apps/api/src/core/handlers.ts - 'session-or-internal' auth mode
 */
export function buildInternalAuthHeaders(userId: string, env: { BETTER_AUTH_SECRET?: string }): Record<string, string> {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    // Safety net: fall back to content-type only (will fail auth, but won't crash)
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'x-internal-key': secret,
    'x-internal-user-id': userId,
  };
}

/**
 * Drain a response stream (consume all data without processing)
 *
 * Handles "Network connection lost" errors gracefully - these are expected
 * when the stream is already being consumed elsewhere or when the connection
 * closes during streaming. This is not an error condition.
 */
export async function drainStream(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  try {
    while (true) {
      const { done } = await reader.read();
      if (done) {
        break;
      }
    }
  } catch {
    // Expected when stream is already being consumed or connection closes
    // This is not an error - just means the stream is done or unavailable
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader may already be released - this is expected
    }
  }
}
