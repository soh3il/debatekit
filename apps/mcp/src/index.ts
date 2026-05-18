/**
 * DebateKit MCP Server
 *
 * Standalone Cloudflare Worker exposing MCP tools for AI debate.
 * Uses the agents SDK's createMcpHandler for Streamable HTTP transport.
 * Authentication via bearer token (shared D1 api_key table).
 *
 * New McpServer created per request (MCP SDK 1.26.0 requirement).
 * Auth context passed via createMcpHandler options, readable in tools via getMcpAuthContext().
 *
 * OAuth 2.0 endpoints (/.well-known/oauth-authorization-server, /authorize, /token, /register)
 * enable MCP clients like Claude Code to authenticate via the standard OAuth flow.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';

import { authenticateRequest, getHttpStatusForAuthError } from './auth';
import { handleAuthorize, handleAuthStatus, handleCallback } from './auth-callback';
import { registerChatGPTApp } from './chatgpt';
import { handleOAuthAuthorize, handleOAuthCallbackBridge, handleOAuthMetadata, handleOAuthRegister, handleOAuthToken } from './oauth';
import { registerPrompts } from './prompts';
import { registerResources } from './resources';
import { handleRestRequest } from './rest-handler';
import { registerTools } from './tools';
import type { Env } from './types';

declare const __APP_VERSION__: string;

function createServer(env: Env, ctx: ExecutionContext) {
  const server = new McpServer(
    {
      name: 'DebateKit MCP',
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0',
    },
    {
      capabilities: {
        logging: {},
        prompts: { listChanged: false },
        resources: {},
        tools: {},
      },
      instructions: `DebateKit runs multi-model AI debates — multiple LLMs discuss a topic, then a moderator synthesizes their perspectives into actionable insight.

Use these tools whenever the user wants to brainstorm, debate, get a second opinion, explore tradeoffs, consult experts, review code, or get diverse perspectives on any question.

Tool selection guide:
- consult-council: General questions, brainstorming, open-ended exploration
- design-architecture: System design, architecture decisions, tech stack selection
- review-code: Code review, security audit, performance analysis
- debug-issue: Bug investigation, root cause analysis
- plan-implementation: Feature planning, task breakdown, implementation strategy
- assess-tradeoffs: Compare options, evaluate trade-offs, decision making

Tips:
- Omit models for auto-mode (recommended) — AI picks optimal models and roles
- Use session_context to chain debates — reference prior session IDs for continuity
- Use thinking_level: "high" for complex problems, "low" for quick opinions
- check-usage shows remaining credits and rate limits`,
    },
  );

  registerTools(server, env, ctx);
  registerPrompts(server);
  registerResources(server, env);
  registerChatGPTApp(server, env);
  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // CORS preflight for any route
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version, x-api-key',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'mcp-session-id',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Health check (no auth required)
    if (url.pathname === '/health') {
      return Response.json({
        name: env.APP_NAME,
        ok: true,
        version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0',
      });
    }

    // =========================================================================
    // OAuth 2.0 endpoints (no auth required -- these ARE the auth flow)
    // =========================================================================

    // MCP Registry domain ownership proof
    if (url.pathname === '/.well-known/mcp-registry-auth') {
      return new Response('v=MCPv1; k=ed25519; p=RTKdbRipJlxxIkf7se2gOQQZb2iUcxMGoDFimayTRkg=', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // OAuth metadata discovery
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      return handleOAuthMetadata(env);
    }

    // OAuth authorize (redirect to webapp approve page)
    if (url.pathname === '/authorize' && request.method === 'GET') {
      return handleOAuthAuthorize(request, env);
    }

    // OAuth token exchange
    if (url.pathname === '/token' && request.method === 'POST') {
      return handleOAuthToken(request, env);
    }

    // Dynamic client registration
    if (url.pathname === '/register' && request.method === 'POST') {
      return handleOAuthRegister(request, env);
    }

    // =========================================================================
    // Browser-based auth endpoints (setup guide key creation)
    // =========================================================================

    // Auth authorize (direct key-creation flow)
    if (url.pathname === '/auth/authorize' && request.method === 'GET') {
      return handleAuthorize(request, env);
    }

    // Auth callback -- try OAuth bridge first, then fall back to direct auth handler
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      const oauthResponse = await handleOAuthCallbackBridge(request, env);
      if (oauthResponse) {
        return oauthResponse;
      }
      return handleCallback(request, env);
    }

    // Auth status polling
    if (url.pathname === '/auth/status' && request.method === 'GET') {
      return handleAuthStatus(request, env);
    }

    // =========================================================================
    // REST API endpoints (auth required)
    // =========================================================================

    if (url.pathname.startsWith('/api/v1/')) {
      const restResponse = await handleRestRequest(request, env, ctx, url.pathname);
      if (restResponse) {
        return restResponse;
      }
    }

    // =========================================================================
    // MCP protocol endpoint (auth required)
    // =========================================================================

    if (url.pathname !== '/mcp') {
      return Response.json(
        { error: 'Not Found' },
        { headers: { 'Content-Type': 'application/json' }, status: 404 },
      );
    }

    // Discovery methods that don't require authentication (allows Smithery/scanners to list tools)
    const DISCOVERY_METHODS = new Set([
      'initialize',
      'notifications/initialized',
      'ping',
      'prompts/list',
      'resources/list',
      'resources/templates/list',
      'tools/list',
    ]);

    // Check if this is a discovery-only POST request (no auth needed for tool listing)
    let isDiscoveryRequest = false;
    let clonedBody: string | undefined;
    if (request.method === 'POST') {
      clonedBody = await request.text();
      try {
        const jsonRpc = JSON.parse(clonedBody);
        // Handle both single requests and batched arrays
        const methods = Array.isArray(jsonRpc)
          ? jsonRpc.map((r: { method?: string }) => r.method)
          : [jsonRpc.method];
        isDiscoveryRequest = methods.every((m: string | undefined) => m && DISCOVERY_METHODS.has(m));
      } catch {
        // Not valid JSON — let the MCP handler deal with it
      }
    }

    // Authenticate (skip for discovery-only requests)
    const auth = isDiscoveryRequest ? null : await authenticateRequest(request, env);
    if (auth && !auth.authenticated) {
      return Response.json(
        { error: { code: auth.code, message: auth.error } },
        { status: getHttpStatusForAuthError(auth.code) },
      );
    }

    // Extract IP and apiKeyHash for abuse detection
    const clientIp = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? '';
    const apiKeyHash = auth?.authenticated ? auth.apiKeyHash : '';

    // New McpServer per request (prevents cross-client state leakage)
    const server = createServer(env, ctx);

    // Rebuild request with the already-consumed body for the MCP handler
    const handlerRequest = clonedBody !== undefined
      ? new Request(request.url, {
          body: clonedBody,
          headers: request.headers,
          method: request.method,
        })
      : request;

    // Pass auth context so tools can access via getMcpAuthContext()
    return createMcpHandler(server, {
      authContext: { props: { apiKeyHash, ip: clientIp, userId: auth?.authenticated ? auth.userId : '' } },
      corsOptions: {
        exposeHeaders: 'mcp-session-id',
        headers: 'Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version, x-api-key',
        maxAge: 86400,
        methods: 'GET, POST, DELETE, OPTIONS',
        origin: '*',
      },
      route: '/mcp',
    })(handlerRequest, env, ctx);
  },
} satisfies ExportedHandler<Env>;
