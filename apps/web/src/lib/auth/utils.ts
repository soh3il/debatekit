/**
 * Authentication Utilities
 *
 * Reusable helper functions for authentication and email domain validation
 *
 * @see https://better-auth.com/docs/concepts/cookies - Better Auth cookie configuration
 */

import { EMAIL_DOMAIN_CONFIG } from '@debatekit/shared';
import { WebAppEnvs } from '@debatekit/shared/enums';
import { APIError } from 'better-auth/api';
import { z } from 'zod';

import { getWebappEnvFromEnv } from '@/lib/env';

// ============================================================================
// BETTER AUTH COOKIE CONFIGURATION
// ============================================================================

/**
 * Better Auth cookie prefix - must match the auth server configuration.
 * Default is 'better-auth' per Better Auth docs.
 *
 * @see https://better-auth.com/docs/concepts/cookies
 */
const BETTER_AUTH_COOKIE_PREFIX = 'better-auth';

/**
 * Better Auth session cookie name (without prefix).
 * The full cookie name is: `{prefix}.session_token` or `__Secure-{prefix}.session_token` in secure mode.
 */
const BETTER_AUTH_SESSION_COOKIE_NAME = 'session_token';

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Schema for auth request body with optional email field
 * Used by Better Auth middleware for email-based operations
 */
const AuthRequestBodySchema = z.object({
  email: z.string().email().optional(),
});

type AuthRequestBody = z.infer<typeof AuthRequestBodySchema>;

/**
 * Better-auth middleware context type
 * Represents the context passed to auth hooks
 */
type AuthContext = {
  path: string;
  body?: AuthRequestBody;
};

export function isRestrictedEnvironment() {
  // Only restrict PREVIEW - LOCAL/localhost should allow any email
  return getWebappEnvFromEnv() === WebAppEnvs.PREVIEW;
}

/**
 * Check if email is in the exceptions list
 *
 * @param {string} email - The email address to check
 * @returns {boolean} True if email is in exceptions list
 */
export function isExceptionEmail(email: string) {
  return EMAIL_DOMAIN_CONFIG.ALLOWED_EXCEPTIONS.includes(email.toLowerCase());
}

/**
 * Validate if an email address matches the allowed domain or is an exception
 *
 * @param {string} email - The email address to validate
 * @returns {boolean} True if email ends with allowed domain or is in exceptions list
 */
export function isAllowedEmailDomain(email: string) {
  // Check if email matches the allowed domain
  if (email.endsWith(EMAIL_DOMAIN_CONFIG.ALLOWED_DOMAIN)) {
    return true;
  }

  // Check if email is in the exceptions list
  return isExceptionEmail(email);
}

/**
 * Check if the request path requires email domain validation
 *
 * @param {string} path - The request path from better-auth context
 * @returns {boolean} True if path requires validation
 */
export function isProtectedAuthPath(path: string) {
  return EMAIL_DOMAIN_CONFIG.PROTECTED_PATHS.includes(path);
}

/**
 * Validate email domain for protected auth paths in restricted environments
 * Throws APIError if validation fails
 *
 * Following official better-auth pattern:
 * @see https://better-auth.com/docs/concepts/hooks
 *
 * @param {AuthContext} ctx - Better-auth context object
 * @throws {APIError} BAD_REQUEST if email domain is not allowed
 */
export function validateEmailDomain(ctx: AuthContext) {
  // Skip validation in production environment
  if (!isRestrictedEnvironment()) {
    return;
  }

  // Only validate protected auth paths
  if (!isProtectedAuthPath(ctx.path)) {
    return;
  }

  // Validate and extract email from request body using Zod
  const bodyParse = AuthRequestBodySchema.safeParse(ctx.body);
  if (!bodyParse.success || !bodyParse.data.email) {
    return; // Let better-auth handle missing/invalid email
  }

  // Validate email domain
  if (!isAllowedEmailDomain(bodyParse.data.email)) {
    throw new APIError('BAD_REQUEST', {
      message: EMAIL_DOMAIN_CONFIG.ERROR_MESSAGE,
    });
  }
}

/**
 * Extract session token from cookie header
 * Used for queue-based operations that need to authenticate with Better Auth
 *
 * IMPORTANT: In production/preview, Better Auth uses `useSecureCookies: true` which
 * adds the `__Secure-` prefix to cookie names. This function looks for both variants
 * to handle all environments.
 *
 * @see https://better-auth.com/docs/concepts/cookies
 *
 * @param {string | undefined} cookieHeader - The Cookie header string
 * @returns {string} The session token value, or empty string if not found
 */
// Re-export cache utilities (moved to @/lib/data/cache, kept here for barrel compatibility)
export { clearServiceWorkerCache, invalidateUserQueries } from '@/lib/data/cache';

export function extractSessionToken(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return '';
  }

  // Build full cookie names with prefix
  const baseCookieName = `${BETTER_AUTH_COOKIE_PREFIX}.${BETTER_AUTH_SESSION_COOKIE_NAME}`;

  // First try the secure cookie name (production/preview: __Secure-better-auth.session_token)
  const secureCookieName = `__Secure-${baseCookieName}`;
  const secureMatch = cookieHeader.match(new RegExp(`${secureCookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]+)`));
  if (secureMatch?.[1]) {
    return secureMatch[1];
  }

  // Fall back to non-secure cookie name (local development: better-auth.session_token)
  const nonSecureMatch = cookieHeader.match(new RegExp(`${baseCookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]+)`));
  return nonSecureMatch?.[1] || '';
}
