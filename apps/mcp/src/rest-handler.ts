/**
 * REST API Adapter
 *
 * Provides REST endpoints that mirror MCP tool functionality.
 * Same auth, same schemas, same handlers — just HTTP instead of MCP protocol.
 *
 * Routes:
 *   POST /api/v1/consult
 *   POST /api/v1/architect
 *   POST /api/v1/review-code
 *   POST /api/v1/plan-implementation
 *   POST /api/v1/debug
 *   POST /api/v1/assess-tradeoffs
 *   GET  /api/v1/sessions
 *   GET  /api/v1/sessions/:id
 *   GET  /api/v1/threads/:sessionId/link
 *   PATCH /api/v1/threads/:sessionId/visibility
 */

import { createDb } from '@debatekit/db/factory';
import { findThreadByMcpSessionId, updateThreadVisibility, verifySessionOwnership } from '@debatekit/db/services';
import { DEFAULT_CHAT_MODE, DEFAULT_MCP_OUTPUT_FORMAT, DEFAULT_MCP_THINKING_LEVEL } from '@debatekit/shared/enums';
import { z } from 'zod';

import { authenticateRequest, getHttpStatusForAuthError } from './auth';
import { runDebate } from './engine/debate-engine';
import { THINKING_PRESETS } from './engine/presets';
import { getSession, listSessions, resolveSessionContext } from './engine/session-store';
import { withCredits } from './engine/with-credits';
import { getPublicThreadUrl, getThreadUrl } from './lib/url-resolver';
import {
  ArchitectInputSchema,
  AssessTradeoffsInputSchema,
  DebugInputSchema,
  ListSessionsInputSchema,
  PlanImplementationInputSchema,
  ReviewCodeInputSchema,
  RunDebateInputSchema,
  RunDebateOutputSchema,
} from './schemas/tool-schemas';
import type { Env } from './types';

// ============================================================================
// CORS
// ============================================================================

/** Header name for integration source identification */
const SOURCE_HEADER = 'x-debatekit-source';

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-debatekit-source',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(data: object, status = 200, extraHeaders?: Record<string, string>) {
  return Response.json(data, { headers: { ...CORS_HEADERS, ...extraHeaders }, status });
}

function errorResponse(message: string, status: number, code?: string) {
  return jsonResponse({ error: { code: code ?? 'UNKNOWN', message } }, status);
}

function parseJsonBody<T extends z.ZodType>(request: Request, schema: T) {
  return request.json()
    .then(body => schema.safeParse(body))
    .catch(() => schema.safeParse(undefined));
}

// ============================================================================
// Shared Debate Handler
// ============================================================================

async function runDebateTool(
  env: Env,
  ctx: ExecutionContext,
  userId: string,
  toolName: string,
  prompt: string,
  inputJson: string,
  options: {
    apiKeyHash?: string;
    context?: string;
    format?: 'adr' | 'comparison' | 'discussion' | 'pros-cons';
    integrationSource?: string;
    ip?: string;
    mode?: 'analyzing' | 'brainstorming' | 'debating' | 'solving';
    models?: string[];
    roles?: string[];
    sessionContext?: string[];
    thinkingLevel?: 'high' | 'low' | 'medium';
  },
) {
  const thinkingLevel = options.thinkingLevel ?? DEFAULT_MCP_THINKING_LEVEL;
  const preset = THINKING_PRESETS[thinkingLevel];
  const modelIds = options.models && options.models.length >= 3 ? options.models : preset.defaultModels;

  // Resolve prior session context
  let priorContext = '';
  if (options.sessionContext?.length) {
    const sessions = await resolveSessionContext(env, userId, options.sessionContext);
    if (sessions.length > 0) {
      priorContext = `${sessions.map((s) => {
        const parsed = RunDebateOutputSchema.safeParse(JSON.parse(s.resultJson));
        const summary = parsed.success ? parsed.data.moderator.summary : 'N/A';
        return `## Prior Session: ${s.toolName}\n**Question:** ${s.prompt}\n**Summary:** ${summary}`;
      }).join('\n\n')}\n\n---\n\n`;
    }
  }

  const combinedContext = priorContext + (options.context ?? '') || undefined;

  const { result, sessionId, threadSlug } = await withCredits(env, userId, {
    apiKeyHash: options.apiKeyHash,
    ctx,
    inputJson,
    integrationSource: options.integrationSource,
    ip: options.ip,
    modelIds,
    moderatorModelId: preset.moderatorModel,
    participantCount: modelIds.length,
    prompt,
    thinkingLevel,
    toolName,
  }, () =>
    runDebate({
      context: combinedContext,
      format: options.format ?? DEFAULT_MCP_OUTPUT_FORMAT,
      mode: options.mode ?? DEFAULT_CHAT_MODE,
      models: options.models,
      prompt,
      roles: options.roles,
      thinkingLevel,
      toolName,
      userId,
    }, env));

  return { ...result, sessionId, threadSlug };
}

// ============================================================================
// Route Handlers
// ============================================================================

type AuthOpts = { apiKeyHash: string; integrationSource?: string; ip: string };

async function handleConsult(request: Request, env: Env, ctx: ExecutionContext, userId: string, authOpts?: AuthOpts) {
  const parsed = await parseJsonBody(request, RunDebateInputSchema);
  if (!parsed.success) {
    return errorResponse(parsed.error.message, 400);
  }

  const args = parsed.data;
  const result = await runDebateTool(env, ctx, userId, 'consult-council', args.prompt, JSON.stringify(args), {
    ...authOpts,
    context: args.context,
    format: args.format,
    mode: args.mode,
    models: args.models,
    roles: args.roles,
    thinkingLevel: args.thinking_level,
  });

  return jsonResponse(result);
}

async function handleArchitect(request: Request, env: Env, ctx: ExecutionContext, userId: string, authOpts?: AuthOpts) {
  const parsed = await parseJsonBody(request, ArchitectInputSchema);
  if (!parsed.success) {
    return errorResponse(parsed.error.message, 400);
  }

  const args = parsed.data;
  const prompt = `Design a system architecture for: ${args.description}${args.scale ? `\nScale: ${args.scale}` : ''}${args.tech_stack?.length ? `\nTech stack: ${args.tech_stack.join(', ')}` : ''}${args.focus_areas?.length ? `\nFocus areas: ${args.focus_areas.join(', ')}` : ''}`;

  const result = await runDebateTool(env, ctx, userId, 'design-architecture', prompt, JSON.stringify(args), {
    ...authOpts,
    format: 'adr',
    mode: 'analyzing',
    roles: ['System Architect', 'Security Engineer', 'DevOps Engineer'],
  });

  return jsonResponse(result);
}

async function handleReviewCode(request: Request, env: Env, ctx: ExecutionContext, userId: string, authOpts?: AuthOpts) {
  const parsed = await parseJsonBody(request, ReviewCodeInputSchema);
  if (!parsed.success) {
    return errorResponse(parsed.error.message, 400);
  }

  const args = parsed.data;
  const prompt = `Review this ${args.language ?? 'code'}:\n\`\`\`\n${args.code}\n\`\`\`${args.focus?.length ? `\nFocus on: ${args.focus.join(', ')}` : ''}`;

  const result = await runDebateTool(env, ctx, userId, 'review-code', prompt, JSON.stringify(args), {
    ...authOpts,
    mode: 'analyzing',
    roles: ['Code Quality Expert', 'Security Reviewer', 'Performance Engineer'],
    thinkingLevel: args.thinking_level,
  });

  return jsonResponse(result);
}

async function handlePlanImplementation(request: Request, env: Env, ctx: ExecutionContext, userId: string, authOpts?: AuthOpts) {
  const parsed = await parseJsonBody(request, PlanImplementationInputSchema);
  if (!parsed.success) {
    return errorResponse(parsed.error.message, 400);
  }

  const args = parsed.data;
  const prompt = `Plan the implementation for: ${args.feature}${args.constraints?.length ? `\nConstraints: ${args.constraints.join(', ')}` : ''}${args.tech_stack?.length ? `\nTech stack: ${args.tech_stack.join(', ')}` : ''}`;

  const result = await runDebateTool(env, ctx, userId, 'plan-implementation', prompt, JSON.stringify(args), {
    ...authOpts,
    context: args.codebase_context,
    mode: 'solving',
    roles: ['Tech Lead', 'Senior Engineer', 'QA Architect'],
    thinkingLevel: args.thinking_level,
  });

  return jsonResponse(result);
}

async function handleDebugTool(request: Request, env: Env, ctx: ExecutionContext, userId: string, authOpts?: AuthOpts) {
  const parsed = await parseJsonBody(request, DebugInputSchema);
  if (!parsed.success) {
    return errorResponse(parsed.error.message, 400);
  }

  const args = parsed.data;
  const prompt = `Debug: ${args.problem}${args.error ? `\nError: ${args.error}` : ''}${args.expected_behavior ? `\nExpected: ${args.expected_behavior}` : ''}`;

  const result = await runDebateTool(env, ctx, userId, 'debug-issue', prompt, JSON.stringify(args), {
    ...authOpts,
    context: args.code,
    mode: 'solving',
    roles: ['Debugger', 'Root Cause Analyst', 'Fix Strategist'],
    thinkingLevel: args.thinking_level,
  });

  return jsonResponse(result);
}

async function handleAssessTradeoffs(request: Request, env: Env, ctx: ExecutionContext, userId: string, authOpts?: AuthOpts) {
  const parsed = await parseJsonBody(request, AssessTradeoffsInputSchema);
  if (!parsed.success) {
    return errorResponse(parsed.error.message, 400);
  }

  const args = parsed.data;
  const prompt = `Assess tradeoffs: ${args.decision}${args.options?.length ? `\nOptions: ${args.options.join(', ')}` : ''}${args.priorities?.length ? `\nPriorities: ${args.priorities.join(', ')}` : ''}`;

  const result = await runDebateTool(env, ctx, userId, 'assess-tradeoffs', prompt, JSON.stringify(args), {
    ...authOpts,
    context: args.context,
    format: 'comparison',
    mode: 'debating',
    thinkingLevel: args.thinking_level,
  });

  return jsonResponse(result);
}

async function handleListSessions(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const params = ListSessionsInputSchema.safeParse({
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    tool_name: url.searchParams.get('tool_name') ?? undefined,
  });

  if (!params.success) {
    return errorResponse(params.error.message, 400);
  }

  const sessions = await listSessions(env, userId, {
    limit: params.data.limit,
    offset: params.data.offset,
    toolName: params.data.tool_name,
  });

  return jsonResponse({ count: sessions.length, sessions });
}

async function handleGetSession(env: Env, userId: string, sessionId: string) {
  const session = await getSession(env, userId, sessionId);
  if (!session) {
    return errorResponse('Session not found', 404);
  }

  return jsonResponse(session);
}

async function handleGetThreadLink(env: Env, userId: string, sessionId: string) {
  const db = createDb(env.DB);

  const sessionExists = await verifySessionOwnership(db, sessionId, userId);
  if (!sessionExists) {
    return errorResponse('Session not found', 404);
  }

  const thread = await findThreadByMcpSessionId(db, userId, sessionId);
  if (!thread) {
    return errorResponse('No thread associated with this session', 404);
  }

  const dashboardUrl = getThreadUrl(env, thread.slug);
  const publicUrl = thread.isPublic ? getPublicThreadUrl(env, thread.slug) : null;

  return jsonResponse({ dashboardUrl, isPublic: thread.isPublic, publicUrl });
}

const SetVisibilityBodySchema = z.object({
  isPublic: z.boolean(),
});

async function handleSetThreadVisibility(request: Request, env: Env, userId: string, sessionId: string) {
  const parsed = await parseJsonBody(request, SetVisibilityBodySchema);
  if (!parsed.success) {
    return errorResponse('Request body must include { isPublic: boolean }', 400);
  }

  const { isPublic } = parsed.data;
  const db = createDb(env.DB);

  const sessionExists = await verifySessionOwnership(db, sessionId, userId);
  if (!sessionExists) {
    return errorResponse('Session not found', 404);
  }

  const thread = await findThreadByMcpSessionId(db, userId, sessionId);
  if (!thread) {
    return errorResponse('No thread associated with this session', 404);
  }

  const updated = await updateThreadVisibility(db, thread.id, userId, isPublic);
  if (!updated) {
    return errorResponse('Thread not found or permission denied', 404);
  }

  const publicUrl = isPublic ? getPublicThreadUrl(env, thread.slug) : null;
  return jsonResponse({ isPublic, publicUrl });
}

// ============================================================================
// Main Router
// ============================================================================

export async function handleRestRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pathname: string,
): Promise<Response | null> {
  // Only handle /api/v1/* routes
  if (!pathname.startsWith('/api/v1/')) {
    return null;
  }

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error, getHttpStatusForAuthError(auth.code), auth.code);
  }
  const { apiKeyHash, userId } = auth;

  // Proactive expiry warning headers
  const expiryHeaders: Record<string, string> = {};
  if (auth.expiresSoon && auth.expiresAt) {
    expiryHeaders['X-Key-Expires-Soon'] = 'true';
    expiryHeaders['X-Key-Expires-At'] = auth.expiresAt.toISOString();
  }
  const clientIp = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? '';
  const integrationSource = request.headers.get(SOURCE_HEADER) ?? undefined;

  const route = pathname.replace('/api/v1/', '');

  // GET endpoints
  if (request.method === 'GET') {
    if (route === 'sessions') {
      return handleListSessions(request, env, userId);
    }
    if (route.startsWith('sessions/')) {
      const sessionId = route.replace('sessions/', '');
      return handleGetSession(env, userId, sessionId);
    }
    // GET /api/v1/threads/:sessionId/link
    const threadLinkMatch = route.match(/^threads\/([^/]+)\/link$/);
    if (threadLinkMatch?.[1]) {
      return handleGetThreadLink(env, userId, threadLinkMatch[1]);
    }
    return errorResponse('Not Found', 404);
  }

  // PATCH endpoints
  if (request.method === 'PATCH') {
    // PATCH /api/v1/threads/:sessionId/visibility
    const visibilityMatch = route.match(/^threads\/([^/]+)\/visibility$/);
    if (visibilityMatch?.[1]) {
      return handleSetThreadVisibility(request, env, userId, visibilityMatch[1]);
    }
    return errorResponse('Not Found', 404);
  }

  // POST endpoints
  if (request.method === 'POST') {
    const authOpts = { apiKeyHash, integrationSource, ip: clientIp };
    switch (route) {
      case 'consult':
        return handleConsult(request, env, ctx, userId, authOpts);
      case 'architect':
        return handleArchitect(request, env, ctx, userId, authOpts);
      case 'review-code':
        return handleReviewCode(request, env, ctx, userId, authOpts);
      case 'plan-implementation':
        return handlePlanImplementation(request, env, ctx, userId, authOpts);
      case 'debug':
        return handleDebugTool(request, env, ctx, userId, authOpts);
      case 'assess-tradeoffs':
        return handleAssessTradeoffs(request, env, ctx, userId, authOpts);
      default:
        return errorResponse('Not Found', 404);
    }
  }

  return errorResponse('Method Not Allowed', 405);
}
