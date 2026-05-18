/**
 * Authentication Utilities
 *
 * Reusable helper functions for authentication and email domain validation
 *
 * @see https://better-auth.com/docs/concepts/cookies - Better Auth cookie configuration
 */

import { EMAIL_DOMAIN_CONFIG, UserRoles } from '@debatekit/shared';
import { WebAppEnvs, WebAppEnvSchema } from '@debatekit/shared/enums';
import { APIError } from 'better-auth/api';
import { env as workersEnv } from 'cloudflare:workers';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { z } from 'zod';

import type { ApiEnv } from '@/types';

// ============================================================================
// BETTER AUTH COOKIE CONFIGURATION
// ============================================================================

/**
 * Better Auth cookie prefix - must match the auth.ts configuration.
 * Default is 'better-auth' per Better Auth docs.
 *
 * @see https://better-auth.com/docs/concepts/cookies
 */
export const BETTER_AUTH_COOKIE_PREFIX = 'better-auth';

/**
 * Better Auth session cookie name (without prefix).
 * The full cookie name is: `{prefix}.session_token` or `__Secure-{prefix}.session_token` in secure mode.
 */
export const BETTER_AUTH_SESSION_COOKIE_NAME = 'session_token';

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

export function isRestrictedEnvironment(): boolean {
  // 1. Try Cloudflare Workers env
  try {
    const cfEnvResult = WebAppEnvSchema.safeParse(workersEnv.WEBAPP_ENV);
    if (cfEnvResult.success) {
      // Only restrict PREVIEW - LOCAL/localhost should allow any email
      return cfEnvResult.data === WebAppEnvs.PREVIEW;
    }
  } catch {
    // Workers env not available
  }

  // 2. Try process.env
  const processEnvResult = WebAppEnvSchema.safeParse(process.env.WEBAPP_ENV);
  if (processEnvResult.success) {
    // Only restrict PREVIEW - LOCAL/localhost should allow any email
    return processEnvResult.data === WebAppEnvs.PREVIEW;
  }

  // Default: no restriction for local development
  return false;
}

/**
 * Check if email is in the exceptions list
 *
 * @param {string} email - The email address to check
 * @returns {boolean} True if email is in exceptions list
 */
export function isExceptionEmail(email: string): boolean {
  return EMAIL_DOMAIN_CONFIG.ALLOWED_EXCEPTIONS.includes(email.toLowerCase());
}

/**
 * Validate if an email address matches the allowed domain or is an exception
 *
 * @param {string} email - The email address to validate
 * @returns {boolean} True if email ends with allowed domain or is in exceptions list
 */
export function isAllowedEmailDomain(email: string): boolean {
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
export function isProtectedAuthPath(path: string): boolean {
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
export function validateEmailDomain(ctx: AuthContext): void {
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
 * Extract session token from cookie header string.
 * Used when we only have the cookie header string, not a full Request object.
 *
 * IMPORTANT: In production/preview, Better Auth uses `useSecureCookies: true` which
 * adds the `__Secure-` prefix to cookie names. This function looks for both variants
 * to handle all environments.
 *
 * @param {string | undefined} cookieHeader - The Cookie header string
 * @returns {string} The session token value, or empty string if not found
 */
export function extractSessionToken(cookieHeader: string | undefined): string {
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

// ============================================================================
// ADMIN AUTHORIZATION
// ============================================================================

/**
 * User type for admin authorization
 * Using Zod for schema validation
 */
export const AdminUserSchema = z.object({
  id: z.string(),
  role: z.string().nullable().optional(),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;

/**
 * Require admin role for protected operations
 * Throws 403 Forbidden if user is not an admin
 *
 * @param {AdminUser} user - User object with role property
 * @throws {HTTPException} 403 Forbidden if user.role !== 'admin'
 */
export function requireAdmin(user: AdminUser): void {
  if (user.role !== UserRoles.ADMIN) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      res: new Response(JSON.stringify({
        code: HttpStatusCodes.FORBIDDEN,
        details: 'This resource is restricted to admin users',
        message: 'Admin access required',
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: HttpStatusCodes.FORBIDDEN,
      }),
    });
  }
}

// ============================================================================
// ADMIN SESSION MIDDLEWARE
// ============================================================================

// Lazy auth module loading — only resolved when middleware runs for the first time
let authModulePromise: Promise<typeof import('@/lib/auth/server')> | null = null;

function getAuthModule() {
  if (!authModulePromise) {
    authModulePromise = import('@/lib/auth/server');
  }
  return authModulePromise;
}

/**
 * Hono middleware that requires an authenticated session AND admin role.
 *
 * Apply this to a route group with `.use('*', requireAdminSession)` to
 * protect ALL routes in that group. Individual handlers still receive
 * the user/session in context for downstream logic.
 *
 * Rejects non-admin users with 403 Forbidden and unauthenticated
 * requests with 401 Unauthorized.
 */
export const requireAdminSession = createMiddleware<ApiEnv>(async (c, next) => {
  // 1. Authenticate session (lazy-loaded to avoid startup overhead)
  const authModule = await getAuthModule();
  const sessionData = await authModule.auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!sessionData?.user || !sessionData?.session) {
    throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
      res: new Response(JSON.stringify({
        code: HttpStatusCodes.UNAUTHORIZED,
        details: 'Valid session required to access this resource',
        message: 'Authentication required',
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: HttpStatusCodes.UNAUTHORIZED,
      }),
    });
  }

  // 2. Require admin role
  if (sessionData.user.role !== UserRoles.ADMIN) {
    throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
      res: new Response(JSON.stringify({
        code: HttpStatusCodes.FORBIDDEN,
        details: 'This resource is restricted to admin users',
        message: 'Admin access required',
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: HttpStatusCodes.FORBIDDEN,
      }),
    });
  }

  // 3. Populate context for downstream handlers (normalize optional fields to null)
  c.set('session', {
    ...sessionData.session,
    ipAddress: sessionData.session.ipAddress ?? null,
    userAgent: sessionData.session.userAgent ?? null,
  });
  c.set('user', {
    ...sessionData.user,
    image: sessionData.user.image ?? null,
  });
  c.set('requestId', c.req.header('x-request-id') || crypto.randomUUID());

  return next();
});
