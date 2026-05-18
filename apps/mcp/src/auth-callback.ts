/**
 * OAuth Callback Authentication for MCP
 *
 * Implements a browser-based auth flow for MCP clients that cannot
 * manually copy API keys. The flow:
 *
 * 1. Client -> GET /auth/authorize -> redirect to webapp authorize page
 * 2. User approves in webapp -> webapp POST creates API key via main API
 * 3. Webapp -> GET /auth/callback?session_id=...&api_key_token=...&state=...
 * 4. MCP server validates session, returns key to client (redirect or HTML page)
 *
 * KV key pattern: mcp:auth:session:{sessionId}
 * TTL: 10 minutes (600 seconds)
 */

import { getAppUrl, getMcpUrl } from '@debatekit/shared';
import { z } from 'zod';

import type { Env } from './types';

// ============================================================================
// Auth Session Schema & Types
// ============================================================================

const AUTH_SESSION_STATUSES = ['pending', 'completed'] as const;

const AuthSessionStatusSchema = z.enum(AUTH_SESSION_STATUSES);

const AuthSessionSchema = z.object({
  apiKeyPrefix: z.string().optional(),
  createdAt: z.number(),
  redirectUri: z.string().nullable(),
  state: z.string(),
  status: AuthSessionStatusSchema,
});
type AuthSession = z.infer<typeof AuthSessionSchema>;

// ============================================================================
// Constants
// ============================================================================

const AUTH_SESSION_TTL_SECONDS = 600; // 10 minutes
const KV_PREFIX = 'mcp:auth:session:';

/** Rate limit: max authorize requests per IP per window */
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Allowed redirect URI patterns.
 * Localhost on any port is always allowed for local MCP clients.
 * Production clients can be added here as explicit origins.
 */
/**
 * Check whether a redirect URI points to a loopback address.
 * Accepts localhost, 127.0.0.1, and [::1] on any port with any path.
 */
function isLoopbackUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'http:') {
      return false;
    }
    const host = url.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

function isRedirectUriAllowed(uri: string): boolean {
  return isLoopbackUri(uri);
}

async function checkAuthRateLimit(env: Env, ip: string): Promise<boolean> {
  const kvKey = `mcp:auth:ratelimit:${ip}`;
  const current = await env.KV.get(kvKey);
  const count = current ? Number.parseInt(current, 10) : 0;

  if (count >= AUTH_RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  await env.KV.put(kvKey, String(count + 1), {
    expirationTtl: AUTH_RATE_LIMIT_WINDOW_SECONDS,
  });

  return true;
}

function getClientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '0.0.0.0';
}

// ============================================================================
// KV Helpers
// ============================================================================

function sessionKey(sessionId: string): string {
  return `${KV_PREFIX}${sessionId}`;
}

async function getSession(env: Env, sessionId: string): Promise<AuthSession | null> {
  const raw = await env.KV.get(sessionKey(sessionId));
  if (!raw) {
    return null;
  }

  const parsed = AuthSessionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

async function putSession(env: Env, sessionId: string, session: AuthSession): Promise<void> {
  await env.KV.put(
    sessionKey(sessionId),
    JSON.stringify(session),
    { expirationTtl: AUTH_SESSION_TTL_SECONDS },
  );
}

async function deleteSession(env: Env, sessionId: string): Promise<void> {
  await env.KV.delete(sessionKey(sessionId));
}

// ============================================================================
// GET /auth/authorize
// ============================================================================

export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  // Rate limit
  const ip = getClientIp(request);
  const withinLimit = await checkAuthRateLimit(env, ip);
  if (!withinLimit) {
    return Response.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      { status: 429 },
    );
  }

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');

  // state is required for CSRF protection
  if (!state || state.length < 8 || state.length > 256) {
    return Response.json(
      { error: 'Missing or invalid state parameter. Provide a random string (8-256 chars) for CSRF protection.' },
      { status: 400 },
    );
  }

  // Validate redirect_uri if provided
  if (redirectUri && !isRedirectUriAllowed(redirectUri)) {
    return Response.json(
      { error: 'Invalid redirect_uri. Only localhost and approved MCP client origins are allowed.' },
      { status: 400 },
    );
  }

  // Generate unique session ID
  const sessionId = crypto.randomUUID();

  // Store session in KV
  const session: AuthSession = {
    createdAt: Date.now(),
    redirectUri: redirectUri || null,
    state,
    status: 'pending',
  };

  await putSession(env, sessionId, session);

  // Build webapp authorize URL
  const webappUrl = getAppUrl(env.WEBAPP_ENV);
  const authorizeUrl = new URL('/mcp/authorize', webappUrl);
  authorizeUrl.searchParams.set('session_id', sessionId);
  authorizeUrl.searchParams.set('state', state);
  if (redirectUri) {
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  }

  // Redirect user to webapp
  return Response.redirect(authorizeUrl.toString(), 302);
}

// ============================================================================
// GET /auth/callback
// ============================================================================

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const apiKeyToken = url.searchParams.get('api_key_token');
  const state = url.searchParams.get('state');

  // Validate required params
  if (!sessionId || !apiKeyToken || !state) {
    return Response.json(
      { error: 'Missing required parameters: session_id, api_key_token, state.' },
      { status: 400 },
    );
  }

  // Look up session
  const session = await getSession(env, sessionId);
  if (!session) {
    return Response.json(
      { error: 'Invalid or expired session. Auth sessions expire after 10 minutes.' },
      { status: 400 },
    );
  }

  // CSRF: validate state matches
  if (session.state !== state) {
    // Delete session on CSRF failure to prevent reuse
    await deleteSession(env, sessionId);
    return Response.json(
      { error: 'State mismatch. Possible CSRF attack.' },
      { status: 403 },
    );
  }

  // Prevent reuse: session must be pending
  if (session.status !== 'pending') {
    await deleteSession(env, sessionId);
    return Response.json(
      { error: 'Session already used.' },
      { status: 400 },
    );
  }

  // Delete session (one-time use)
  await deleteSession(env, sessionId);

  // If redirect_uri was provided, redirect with token
  if (session.redirectUri) {
    const redirectUrl = new URL(session.redirectUri);
    redirectUrl.searchParams.set('api_key_token', apiKeyToken);
    redirectUrl.searchParams.set('state', state);
    return Response.redirect(redirectUrl.toString(), 302);
  }

  // No redirect_uri: render success page with copy instructions
  return new Response(renderSuccessPage(apiKeyToken, env), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ============================================================================
// GET /auth/status
// ============================================================================

export async function handleAuthStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return Response.json(
      { error: 'Missing session_id parameter.' },
      { status: 400 },
    );
  }

  const session = await getSession(env, sessionId);
  if (!session) {
    return Response.json(
      { completed: false, error: 'Session not found or expired.' },
      { status: 404 },
    );
  }

  return Response.json({
    completed: session.status === 'completed',
    createdAt: session.createdAt,
    status: session.status,
  });
}

// ============================================================================
// Success Page HTML
// ============================================================================

function renderSuccessPage(apiKey: string, env: Env): string {
  const mcpUrl = getMcpUrl(env.WEBAPP_ENV);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DebateKit MCP — Authentication Complete</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: #09090b;
      color: #a1a1aa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }

    /* ── Glass card ─────────────────────────────────── */
    .card {
      width: 100%;
      max-width: 28rem;
      border-radius: 1rem;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(9,9,11,0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      overflow: hidden;
    }

    /* ── Header ─────────────────────────────────────── */
    .card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2rem 1.5rem 0;
      gap: 0.75rem;
    }
    .icon-ring {
      width: 3rem;
      height: 3rem;
      border-radius: 9999px;
      background: rgba(16,185,129,0.10);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-ring svg {
      width: 1.5rem;
      height: 1.5rem;
      color: #10b981;
    }
    .card-header h1 {
      font-size: 1.125rem;
      font-weight: 600;
      color: #fafafa;
      line-height: 1.4;
    }
    .card-header p {
      font-size: 0.875rem;
      color: #71717a;
      line-height: 1.5;
    }

    /* ── Content ────────────────────────────────────── */
    .card-content {
      padding: 1.25rem 1.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* ── App identity badge row (matches authorize page) */
    .app-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border-radius: 0.5rem;
      background: rgba(255,255,255,0.04);
      padding: 0.75rem 1rem;
    }
    .app-badge svg {
      width: 1rem;
      height: 1rem;
      color: #71717a;
    }
    .app-badge span {
      font-size: 0.875rem;
      font-weight: 500;
      color: #fafafa;
    }
    .mcp-tag {
      font-size: 0.6875rem;
      font-weight: 500;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      background: rgba(255,255,255,0.06);
      color: #a1a1aa;
      letter-spacing: 0.02em;
    }

    .separator {
      height: 1px;
      background: rgba(255,255,255,0.06);
    }

    /* ── Permission-style rows ──────────────────────── */
    .perm-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .perm-item {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      font-size: 0.875rem;
      color: #a1a1aa;
    }
    .perm-item svg {
      width: 1rem;
      height: 1rem;
      color: #10b981;
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    /* ── Key field ──────────────────────────────────── */
    .key-section { display: flex; flex-direction: column; gap: 0.375rem; }
    .key-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .key-row {
      position: relative;
    }
    .key-input {
      width: 100%;
      padding: 0.625rem 4.5rem 0.625rem 0.75rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 0.5rem;
      color: #fafafa;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
      font-size: 0.8125rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .key-input:focus { border-color: rgba(255,255,255,0.25); }
    .copy-btn {
      position: absolute;
      right: 0.25rem;
      top: 50%;
      transform: translateY(-50%);
      padding: 0.375rem 0.75rem;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 0.375rem;
      color: #e4e4e7;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .copy-btn:hover { background: rgba(255,255,255,0.10); }
    .copy-btn.copied {
      background: rgba(16,185,129,0.15);
      border-color: rgba(16,185,129,0.3);
      color: #6ee7b7;
    }

    /* ── Config block ──────────────────────────────── */
    .config-section { display: flex; flex-direction: column; gap: 0.375rem; }
    pre {
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
      color: #d4d4d8;
    }

    /* ── Footer note ───────────────────────────────── */
    .note {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #52525b;
      line-height: 1.5;
      padding-top: 0.25rem;
    }
    .note svg {
      width: 0.875rem;
      height: 0.875rem;
      flex-shrink: 0;
      margin-top: 0.125rem;
      color: #52525b;
    }

    /* ── Close button (matches authorize page footer) ── */
    .card-footer {
      padding: 0 1.5rem 1.5rem;
    }
    .close-btn {
      width: 100%;
      padding: 0.625rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #fafafa;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .close-btn:hover {
      background: rgba(255,255,255,0.10);
      border-color: rgba(255,255,255,0.15);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="icon-ring">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
      </div>
      <h1>Authentication Complete</h1>
      <p>Your DebateKit MCP API key has been created. Add it to your client configuration below.</p>
    </div>

    <div class="card-content">
      <!-- App badge (mirrors authorize page) -->
      <div class="app-badge">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>DebateKit MCP</span>
        <span class="mcp-tag">MCP</span>
      </div>

      <div class="separator"></div>

      <!-- Granted permissions -->
      <div class="perm-list">
        <div class="perm-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Access AI brainstorming tools</span>
        </div>
        <div class="perm-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Use credits from your account balance</span>
        </div>
      </div>

      <div class="separator"></div>

      <!-- API Key -->
      <div class="key-section">
        <span class="key-label">API Key</span>
        <div class="key-row">
          <input id="api-key" class="key-input" type="text" value="${escapeHtml(apiKey)}" readonly>
          <button class="copy-btn" id="copy-key-btn" onclick="copyText('api-key','copy-key-btn')">Copy</button>
        </div>
      </div>

      <!-- Config snippet -->
      <div class="config-section">
        <span class="key-label">Client Configuration</span>
        <pre id="config-text">{
  "mcpServers": {
    "debatekit": {
      "url": "${escapeHtml(mcpUrl)}",
      "headers": {
        "Authorization": "Bearer ${escapeHtml(apiKey)}"
      }
    }
  }
}</pre>
      </div>

      <div class="note">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Save this key now — it will not be shown again. You can manage keys in the DebateKit dashboard.</span>
      </div>
    </div>

    <div class="card-footer">
      <button class="close-btn" onclick="window.close()">Close this page</button>
    </div>
  </div>

  <script>
    function copyText(inputId, btnId) {
      var el = document.getElementById(inputId);
      var text = el.tagName === 'INPUT' ? el.value : el.textContent;
      navigator.clipboard.writeText(text).then(function() {
        var btn = document.getElementById(btnId);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function() {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
