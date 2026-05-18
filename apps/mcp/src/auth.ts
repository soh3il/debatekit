/**
 * Bearer Token Authentication
 *
 * Validates API keys against the D1 database (shared with main API).
 * Better Auth stores SHA-256 hashed keys in the `api_key` table.
 * Includes KV-based rate limiting per API key.
 */

import { createDb } from '@debatekit/db/factory';
import { apiKey } from '@debatekit/db/tables';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { Env } from './types';

// ============================================================================
// Auth Error Code
// ============================================================================

export const AUTH_ERROR_CODES = ['MISSING_KEY', 'INVALID_FORMAT', 'INVALID_KEY', 'KEY_DISABLED', 'KEY_EXPIRED', 'RATE_LIMITED'] as const;
export const AuthErrorCodeSchema = z.enum(AUTH_ERROR_CODES);
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;

// ============================================================================
// Auth Result -- discriminated union schemas
// ============================================================================

const AuthSuccessSchema = z.object({
  apiKeyHash: z.string(),
  authenticated: z.literal(true),
  expiresAt: z.date().nullable().optional(),
  expiresSoon: z.boolean().optional(),
  userId: z.string(),
});

const AuthFailureSchema = z.object({
  authenticated: z.literal(false),
  code: AuthErrorCodeSchema,
  error: z.string(),
});

const _AuthResultSchema = z.discriminatedUnion('authenticated', [AuthSuccessSchema, AuthFailureSchema]);
export type AuthResult = z.infer<typeof _AuthResultSchema>;

// ============================================================================
// HTTP Status Mapping
// ============================================================================

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Map auth error codes to appropriate HTTP status codes. */
export function getHttpStatusForAuthError(code: AuthErrorCode): number {
  switch (code) {
    case 'KEY_DISABLED':
    case 'KEY_EXPIRED':
      return 403;
    case 'RATE_LIMITED':
      return 429;
    default:
      return 401;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Hash an API key using SHA-256 + base64url (no padding).
 * Must match Better Auth's defaultKeyHasher exactly:
 *   base64Url.encode(new Uint8Array(await createHash("SHA-256").digest(key)), { padding: false })
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  const data = new TextEncoder().encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // base64url without padding -- matches Better Auth's encoding
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return request.headers.get('x-api-key');
}

// ============================================================================
// Rate Limiting (KV-based)
// ============================================================================

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 30;

async function checkRateLimit(env: Env, keyHash: string): Promise<boolean> {
  const kvKey = `mcp:ratelimit:${keyHash}`;
  const current = await env.KV.get(kvKey);
  const count = current ? Number.parseInt(current, 10) : 0;

  if (count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  // Increment counter with TTL for automatic cleanup
  await env.KV.put(kvKey, String(count + 1), {
    expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
  });

  return true;
}

// ============================================================================
// Authentication
// ============================================================================

export async function authenticateRequest(
  request: Request,
  env: Env,
): Promise<AuthResult> {
  const token = extractToken(request);

  if (!token) {
    return { authenticated: false, code: 'MISSING_KEY', error: 'Missing API key. Provide via Authorization: Bearer <key> or x-api-key header.' };
  }

  if (!token.startsWith('rpnd_')) {
    return { authenticated: false, code: 'INVALID_FORMAT', error: 'Invalid API key format. Keys must start with rpnd_ prefix.' };
  }

  const hashedKey = await hashApiKey(token);

  // Rate limit check (before DB lookup to reduce load)
  const withinLimit = await checkRateLimit(env, hashedKey);
  if (!withinLimit) {
    return { authenticated: false, code: 'RATE_LIMITED', error: 'Rate limit exceeded. Try again in 60 seconds.' };
  }

  const db = createDb(env.DB);

  const rows = await db.select({
    enabled: apiKey.enabled,
    expiresAt: apiKey.expiresAt,
    id: apiKey.id,
    referenceId: apiKey.referenceId,
  }).from(apiKey).where(eq(apiKey.key, hashedKey)).limit(1);

  const row = rows[0];

  if (!row) {
    return { authenticated: false, code: 'INVALID_KEY', error: 'Invalid API key.' };
  }

  if (!row.enabled) {
    return { authenticated: false, code: 'KEY_DISABLED', error: 'API key is disabled.' };
  }

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { authenticated: false, code: 'KEY_EXPIRED', error: 'API key has expired.' };
  }

  // Update last_request timestamp (fire-and-forget)
  db.update(apiKey)
    .set({
      lastRequest: new Date(),
      requestCount: sql`${apiKey.requestCount} + 1`,
    })
    .where(eq(apiKey.id, row.id))
    .then(() => {})
    .catch(() => {});

  // Check if key expires within 7 days (proactive warning)
  const expiresSoon = row.expiresAt
    ? (row.expiresAt.getTime() - Date.now()) < SEVEN_DAYS_MS
    : false;

  return {
    apiKeyHash: hashedKey,
    authenticated: true,
    expiresAt: row.expiresAt ?? null,
    expiresSoon,
    userId: row.referenceId,
  };
}
