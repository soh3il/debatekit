/**
 * MCP OAuth 2.0 Endpoints
 *
 * Implements the OAuth 2.0 endpoints required by the MCP spec for Claude Code
 * and other MCP clients that use OAuth-based "Re-authenticate" flows.
 *
 * Endpoints:
 *   GET  /.well-known/oauth-authorization-server  -> metadata discovery
 *   GET  /authorize                               -> redirect to webapp approve page
 *   POST /token                                   -> exchange auth code for API key
 *   POST /register                                -> dynamic client registration
 *
 * The bridge between OAuth and our API-key system works via KV:
 *   1. /authorize stores PKCE + client data in KV, generates an auth code,
 *      stores code->session mapping, and redirects to the webapp approve page.
 *   2. The webapp creates an API key and redirects to /auth/callback with the key.
 *   3. /auth/callback (updated in auth-callback.ts) detects the OAuth session,
 *      stores the API key against the session, and redirects to the client's
 *      redirect_uri with the auth code + state.
 *   4. /token exchanges the auth code for the stored API key (verifying PKCE).
 */

import { createDb } from '@debatekit/db/factory';
import { apiKey } from '@debatekit/db/tables';
import { getAppUrl, getMcpOrigin } from '@debatekit/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { hashApiKey } from './auth';
import type { Env } from './types';

// ============================================================================
// Constants
// ============================================================================

const OAUTH_SESSION_TTL_SECONDS = 600; // 10 minutes
const OAUTH_CODE_TTL_SECONDS = 300; // 5 minutes
const OAUTH_CLIENT_TTL_SECONDS = 365 * 24 * 60 * 60; // 365 days

/** Fallback expires_in for non-expiring API keys (~10 years in seconds) */
const NON_EXPIRING_TOKEN_SECONDS = 10 * 365 * 24 * 60 * 60;

// ============================================================================
// CORS Helpers
// ============================================================================

function corsHeaders() {
  return {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
  };
}

function jsonResponse<T extends object>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
    status,
  });
}

// ============================================================================
// KV Schemas & Helpers
// ============================================================================

const OAuthSessionSchema = z.object({
  apiKeyToken: z.string().optional(),
  clientId: z.string(),
  codeChallenge: z.string().optional(),
  codeChallengeMethod: z.string().optional(),
  createdAt: z.number(),
  redirectUri: z.string(),
  scope: z.string(),
  state: z.string(),
});
type OAuthSession = z.infer<typeof OAuthSessionSchema>;

async function getOAuthSession(env: Env, sessionId: string): Promise<OAuthSession | null> {
  try {
    const raw = await env.KV.get(`mcp:oauth:${sessionId}`);
    if (!raw) {
      return null;
    }
    const parsed = OAuthSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function putOAuthSession(env: Env, sessionId: string, session: OAuthSession): Promise<void> {
  await env.KV.put(
    `mcp:oauth:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: OAUTH_SESSION_TTL_SECONDS },
  );
}

async function deleteOAuthSession(env: Env, sessionId: string): Promise<void> {
  await env.KV.delete(`mcp:oauth:${sessionId}`);
}

async function getOAuthCode(env: Env, code: string): Promise<string | null> {
  try {
    return await env.KV.get(`mcp:oauth:code:${code}`);
  } catch {
    return null;
  }
}

async function putOAuthCode(env: Env, code: string, sessionId: string): Promise<void> {
  await env.KV.put(
    `mcp:oauth:code:${code}`,
    sessionId,
    { expirationTtl: OAUTH_CODE_TTL_SECONDS },
  );
}

async function deleteOAuthCode(env: Env, code: string): Promise<void> {
  await env.KV.delete(`mcp:oauth:code:${code}`);
}

// ============================================================================
// PKCE Verification
// ============================================================================

async function verifyPkce(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const computed = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return computed === codeChallenge;
}

// ============================================================================
// API Key Expiration Lookup
// ============================================================================

/**
 * Look up the API key's expiresAt from D1 and compute expires_in seconds.
 * Returns NON_EXPIRING_TOKEN_SECONDS for keys with no expiration.
 */
async function resolveExpiresIn(env: Env, rawApiKey: string): Promise<number> {
  const hashed = await hashApiKey(rawApiKey);
  const db = createDb(env.DB);

  const rows = await db.select({ expiresAt: apiKey.expiresAt })
    .from(apiKey)
    .where(eq(apiKey.key, hashed))
    .limit(1);

  const row = rows[0];

  if (!row?.expiresAt) {
    return NON_EXPIRING_TOKEN_SECONDS;
  }

  return Math.max(0, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000));
}

// ============================================================================
// GET /.well-known/oauth-authorization-server
// ============================================================================

export function handleOAuthMetadata(env: Env): Response {
  const origin = getMcpOrigin(env.WEBAPP_ENV);

  return jsonResponse({
    authorization_endpoint: `${origin}/authorize`,
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    issuer: origin,
    registration_endpoint: `${origin}/register`,
    response_types_supported: ['code'],
    scopes_supported: ['mcp:tools'],
    token_endpoint: `${origin}/token`,
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
  });
}

// ============================================================================
// GET /authorize
// ============================================================================

export async function handleOAuthAuthorize(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  const clientId = url.searchParams.get('client_id');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') || 'S256';
  const redirectUri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');
  const scope = url.searchParams.get('scope') || 'mcp:tools';

  if (!clientId || !redirectUri || !state) {
    return jsonResponse(
      { error: 'invalid_request', error_description: 'Missing required parameters: client_id, redirect_uri, state' },
      400,
    );
  }

  if (codeChallenge && codeChallengeMethod !== 'S256') {
    return jsonResponse(
      { error: 'invalid_request', error_description: 'Only S256 code_challenge_method is supported' },
      400,
    );
  }

  // Generate session ID and auth code
  const sessionId = crypto.randomUUID();
  const authCode = crypto.randomUUID();

  // Store OAuth session in KV
  const session: OAuthSession = {
    clientId,
    ...(codeChallenge && { codeChallenge }),
    ...(codeChallenge && { codeChallengeMethod }),
    createdAt: Date.now(),
    redirectUri,
    scope,
    state,
  };

  await putOAuthSession(env, sessionId, session);

  // Store code -> session mapping
  await putOAuthCode(env, authCode, sessionId);

  // Redirect to webapp authorize page
  // The webapp will create an API key and redirect back to /auth/callback
  const webappUrl = getAppUrl(env.WEBAPP_ENV);
  const authorizeUrl = new URL('/mcp/authorize', webappUrl);
  authorizeUrl.searchParams.set('session_id', sessionId);
  authorizeUrl.searchParams.set('state', state);
  // Pass oauth_code so the callback handler knows to bridge to OAuth
  authorizeUrl.searchParams.set('oauth_code', authCode);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);

  return Response.redirect(authorizeUrl.toString(), 302);
}

// ============================================================================
// POST /token
// ============================================================================

const AuthCodeRequestSchema = z.object({
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  code: z.string(),
  code_verifier: z.string().optional(),
  grant_type: z.literal('authorization_code'),
  redirect_uri: z.string().optional(),
});

const RefreshTokenRequestSchema = z.object({
  client_id: z.string().optional(),
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string(),
});

function parseTokenBody(rawBody: Record<string, string>) {
  const grantType = rawBody.grant_type;
  if (grantType === 'refresh_token') {
    return { kind: 'refresh' as const, parsed: RefreshTokenRequestSchema.safeParse(rawBody) };
  }
  return { kind: 'auth_code' as const, parsed: AuthCodeRequestSchema.safeParse(rawBody) };
}

export async function handleOAuthToken(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get('content-type') || '';

  let rawBody: Record<string, string>;
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    rawBody = Object.fromEntries(new URLSearchParams(text));
  } else if (contentType.includes('application/json')) {
    rawBody = await request.json();
  } else {
    const text = await request.text();
    rawBody = Object.fromEntries(new URLSearchParams(text));
  }

  // Extract client_id/client_secret from Authorization: Basic header (RFC 6749 §2.3.1)
  // MCP clients like Claude Code may use client_secret_basic instead of sending in the body
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6));
      const colonIdx = decoded.indexOf(':');
      if (colonIdx !== -1) {
        const headerClientId = decodeURIComponent(decoded.slice(0, colonIdx));
        const headerClientSecret = decodeURIComponent(decoded.slice(colonIdx + 1));
        if (headerClientId && !rawBody.client_id) {
          rawBody.client_id = headerClientId;
        }
        if (headerClientSecret && !rawBody.client_secret) {
          rawBody.client_secret = headerClientSecret;
        }
      }
    } catch {
      // Malformed Basic header — ignore and let body values take precedence
    }
  }

  const { kind, parsed } = parseTokenBody(rawBody);

  if (!parsed.success) {
    const fields = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    return jsonResponse(
      { error: 'invalid_request', error_description: `Missing or invalid parameters: ${fields}` },
      400,
    );
  }

  // ── Refresh Token Grant ──────────────────────────────────────────────
  if (kind === 'refresh') {
    const { refresh_token: refreshToken } = parsed.data as z.infer<typeof RefreshTokenRequestSchema>;
    return handleRefreshGrant(env, refreshToken);
  }

  // ── Authorization Code Grant ─────────────────────────────────────────
  const { client_id: clientId, client_secret: clientSecret, code, code_verifier: codeVerifier, redirect_uri: redirectUri } = parsed.data as z.infer<typeof AuthCodeRequestSchema>;

  // Look up code -> session
  const sessionId = await getOAuthCode(env, code);
  if (!sessionId) {
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
      400,
    );
  }

  // Look up session
  const session = await getOAuthSession(env, sessionId);
  if (!session) {
    await deleteOAuthCode(env, code);
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'OAuth session expired' },
      400,
    );
  }

  // Verify authorization: either PKCE or client_secret
  if (session.codeChallenge && codeVerifier) {
    // PKCE flow (MCP clients)
    const pkceValid = await verifyPkce(codeVerifier, session.codeChallenge);
    if (!pkceValid) {
      return jsonResponse(
        { error: 'invalid_grant', error_description: 'PKCE verification failed' },
        400,
      );
    }
  } else if (clientSecret) {
    // Client secret flow (GPT Actions, third-party apps)
    const storedClient = await env.KV.get(`mcp:oauth:client:${clientId}`);
    if (!storedClient) {
      return jsonResponse(
        { error: 'invalid_client', error_description: 'Unknown client_id' },
        401,
      );
    }
    const clientData = JSON.parse(storedClient);
    if (clientData.client_secret !== clientSecret) {
      return jsonResponse(
        { error: 'invalid_client', error_description: 'Invalid client_secret' },
        401,
      );
    }
  } else if (session.codeChallenge) {
    // PKCE was set up but no verifier provided
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'code_verifier required for PKCE flow' },
      400,
    );
  }

  // Verify redirect_uri matches (only if provided — optional per RFC 6749 §4.1.3)
  if (redirectUri && redirectUri !== session.redirectUri) {
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'redirect_uri mismatch' },
      400,
    );
  }

  // Verify client_id matches (skip if client didn't send one — public PKCE clients may omit it)
  if (clientId && clientId !== session.clientId) {
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'client_id mismatch' },
      400,
    );
  }

  // Get the API key stored by the callback handler
  const apiKeyToken = session.apiKeyToken;
  if (!apiKeyToken) {
    return jsonResponse(
      { error: 'authorization_pending', error_description: 'User has not yet approved the authorization request' },
      400,
    );
  }

  // Delete code and session (one-time use)
  await deleteOAuthCode(env, code);
  await deleteOAuthSession(env, sessionId);

  // Look up the API key's actual expiration from D1
  const expiresIn = await resolveExpiresIn(env, apiKeyToken);

  // Return the API key as both access_token and refresh_token.
  // The refresh_token allows clients to re-validate without full re-auth.
  return jsonResponse({
    access_token: apiKeyToken,
    expires_in: expiresIn,
    refresh_token: apiKeyToken,
    scope: session.scope,
    token_type: 'Bearer',
  });
}

// ============================================================================
// Refresh Token Handler
// ============================================================================

/**
 * Validates the refresh token (which is the API key itself) and returns
 * a fresh token response with an updated expires_in derived from the
 * API key's actual expiresAt in D1.
 */
async function handleRefreshGrant(env: Env, refreshToken: string): Promise<Response> {
  if (!refreshToken.startsWith('rpnd_')) {
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'Invalid refresh token format' },
      400,
    );
  }

  const hashed = await hashApiKey(refreshToken);
  const db = createDb(env.DB);

  const rows = await db.select({
    enabled: apiKey.enabled,
    expiresAt: apiKey.expiresAt,
  }).from(apiKey).where(eq(apiKey.key, hashed)).limit(1);

  const row = rows[0];

  if (!row) {
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'Refresh token is invalid' },
      400,
    );
  }

  if (!row.enabled) {
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'API key has been disabled' },
      400,
    );
  }

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return jsonResponse(
      { error: 'invalid_grant', error_description: 'API key has expired' },
      400,
    );
  }

  const expiresIn = row.expiresAt
    ? Math.max(0, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000))
    : NON_EXPIRING_TOKEN_SECONDS;

  return jsonResponse({
    access_token: refreshToken,
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: 'mcp:tools',
    token_type: 'Bearer',
  });
}

// ============================================================================
// POST /register (Dynamic Client Registration)
// ============================================================================

const ClientRegistrationSchema = z.object({
  client_name: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  redirect_uris: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
});

export async function handleOAuthRegister(request: Request, env: Env): Promise<Response> {
  const parseResult = await request.json()
    .then(json => ClientRegistrationSchema.safeParse(json))
    .catch(() => null);

  if (!parseResult) {
    return jsonResponse(
      { error: 'invalid_request', error_description: 'Request body must be valid JSON' },
      400,
    );
  }

  const parsed = parseResult;
  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_client_metadata', error_description: 'Invalid client registration data' },
      400,
    );
  }

  const { client_name: clientName, grant_types: grantTypes, redirect_uris: redirectUris, response_types: responseTypes, token_endpoint_auth_method: authMethod } = parsed.data;

  const clientId = crypto.randomUUID();
  const clientSecret = `rtsec_${crypto.randomUUID().replace(/-/g, '')}`;

  // Store client registration in KV (365 days TTL -- matches max API key lifetime)
  const clientData = {
    client_id: clientId,
    client_name: clientName || 'MCP Client',
    client_secret: clientSecret,
    created_at: Date.now(),
    grant_types: grantTypes || ['authorization_code', 'refresh_token'],
    redirect_uris: redirectUris || [],
    response_types: responseTypes || ['code'],
    token_endpoint_auth_method: authMethod || 'none',
  };

  try {
    await env.KV.put(
      `mcp:oauth:client:${clientId}`,
      JSON.stringify(clientData),
      { expirationTtl: OAUTH_CLIENT_TTL_SECONDS },
    );
  } catch {
    return jsonResponse(
      { error: 'server_error', error_description: 'Failed to register client' },
      500,
    );
  }

  return jsonResponse(clientData, 201);
}

// ============================================================================
// OAuth Callback Bridge
// ============================================================================

/**
 * When the webapp redirects back to /auth/callback with an API key,
 * and the session has an associated OAuth flow, this function:
 * 1. Stores the API key in the OAuth session
 * 2. Redirects to the OAuth client's redirect_uri with the auth code + state
 *
 * Returns null if this is not an OAuth-bridged callback (fall through to direct auth handler).
 */
export async function handleOAuthCallbackBridge(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const apiKeyToken = url.searchParams.get('api_key_token');
  const state = url.searchParams.get('state');
  const oauthCode = url.searchParams.get('oauth_code');

  // If no oauth_code, this is not an OAuth flow -- fall through to direct auth handler
  if (!oauthCode) {
    return null;
  }

  if (!sessionId || !apiKeyToken || !state) {
    return jsonResponse(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      400,
    );
  }

  // Look up the OAuth session
  const session = await getOAuthSession(env, sessionId);
  if (!session) {
    return jsonResponse(
      { error: 'invalid_request', error_description: 'OAuth session expired or not found' },
      400,
    );
  }

  // Verify state matches
  if (session.state !== state) {
    await deleteOAuthSession(env, sessionId);
    return jsonResponse(
      { error: 'invalid_request', error_description: 'State mismatch' },
      403,
    );
  }

  // Store the API key in the session so /token can retrieve it
  const updatedSession: OAuthSession = {
    ...session,
    apiKeyToken,
  };
  await putOAuthSession(env, sessionId, updatedSession);

  // Redirect back to the OAuth client's redirect_uri with the auth code + state
  const clientRedirect = new URL(session.redirectUri);
  clientRedirect.searchParams.set('code', oauthCode);
  clientRedirect.searchParams.set('state', state);

  return Response.redirect(clientRedirect.toString(), 302);
}
