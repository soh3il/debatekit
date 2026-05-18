import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';

import type { Session, User } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import type { ApiEnv } from '@/types';

// Lazy load auth to reduce worker startup CPU time
// Uses Promise caching to avoid race condition (ESLint require-atomic-updates)
let authModulePromise: Promise<typeof import('@/lib/auth/server')> | null = null;

function getAuthModule() {
  if (!authModulePromise) {
    authModulePromise = import('@/lib/auth/server');
  }
  return authModulePromise;
}

async function getAuth() {
  const authModule = await getAuthModule();
  return authModule.auth;
}

/**
 * Shared authentication helper - extracts session from request headers
 * and sets context variables.
 *
 * Supports two authentication methods:
 * 1. Session cookies (browser/web app authentication + queue consumers via forwarded cookies)
 * 2. API keys via x-api-key header (programmatic access)
 *
 * Queue consumers now pass the user's session cookie in the Cookie header,
 * so they're authenticated through the standard Better Auth flow.
 *
 * With sessionForAPIKeys enabled, Better Auth automatically validates API keys
 * and creates sessions when getSession() is called with x-api-key header.
 * @see https://www.better-auth.com/docs/plugins/api-key#sessions-from-api-keys
 */
async function authenticateSession(c: Context<ApiEnv>) {
  // Lazy load auth module to reduce worker startup CPU time
  const auth = await getAuth();

  // Better Auth's getSession() automatically handles:
  // - Session cookies (standard web authentication + queue consumers)
  // - API keys (when sessionForAPIKeys: true is enabled)
  const sessionData = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  // Better Auth inferred types (Session, User from auth.$Infer.Session) provide
  // direct type compatibility. Nullish coalescing ensures optional fields
  // are normalized to null for consistent downstream handling.
  const session: Session | null = sessionData?.session
    ? {
        ...sessionData.session,
        ipAddress: sessionData.session.ipAddress ?? null,
        userAgent: sessionData.session.userAgent ?? null,
      }
    : null;

  const user: User | null = sessionData?.user
    ? {
        ...sessionData.user,
        image: sessionData.user.image ?? null,
      }
    : null;

  c.set('session', session);
  c.set('user', user);
  c.set('requestId', c.req.header('x-request-id') || crypto.randomUUID());

  return { session, user };
}

// Attach session if present; does not enforce authentication
// Following Better Auth best practices for middleware integration
export const attachSession = createMiddleware<ApiEnv>(async (c, next) => {
  try {
    // Use shared helper to authenticate session
    await authenticateSession(c);
  } catch (error) {
    log.auth('warn', 'Session extraction failed, proceeding as unauthenticated', {
      errorMessage: error instanceof Error ? error.message : String(error),
      path: c.req.path,
    });
    c.set('session', null);
    c.set('user', null);
    c.set('requestId', c.req.header('x-request-id') || crypto.randomUUID());
  }
  return await next();
});
