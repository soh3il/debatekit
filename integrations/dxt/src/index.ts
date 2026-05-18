#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

// ── Shared constants ──
// DXT is distributed as a standalone packed extension and cannot use
// workspace dependencies. These values are inlined from:
//   - integrations/shared/src/constants.ts
//   - integrations/shared/src/enums.ts
//   - packages/shared/src/enums/chat.ts
//   - packages/shared/src/enums/mcp-tools.ts
// Keep them in sync when the canonical definitions change.

// Source of truth: DEBATEKIT_DEFAULT_URL in integrations/shared/src/constants.ts
const DEFAULT_BASE_URL = 'https://mcp.debatekit.ai'
// Source of truth: DEBATEKIT_APP_URL in integrations/shared/src/constants.ts
const APP_URL = 'https://debatekit.ai'

// ChatModeSchema values from packages/shared/src/enums/chat.ts
const CHAT_MODES = ['analyzing', 'brainstorming', 'debating', 'solving'] as const
// McpThinkingLevelSchema values from packages/shared/src/enums/mcp-tools.ts
const THINKING_LEVELS = ['low', 'medium', 'high'] as const
// ArchitectScaleSchema values from integrations/shared/src/enums.ts
const ARCHITECT_SCALES = ['startup', 'growth', 'enterprise'] as const
// ThreadVisibilitySchema values from packages/shared/src/enums/mcp-tools.ts
const THREAD_VISIBILITIES = ['public', 'private'] as const

const API_KEY = process.env.DEBATEKIT_API_KEY ?? ''
const BASE_URL = (process.env.DEBATEKIT_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')

// ── Types ──
// Inlined from integrations/shared/src/types.ts (source of truth).
// DXT runs as a standalone Node process without workspace deps,
// so types must be local. Verify against the shared package when updating.

// Source: TokenUsageSchema in integrations/shared/src/types.ts
interface TokenUsage {
  input: number
  output: number
}

// Source: ParticipantResponseSchema in integrations/shared/src/types.ts
interface ParticipantResponse {
  model_id: string
  model_name: string
  response: string
  role: string | null
  token_usage: TokenUsage
}

// Source: ModeratorResultSchema in integrations/shared/src/types.ts
interface ModeratorResult {
  model_id: string
  summary: string
  token_usage: TokenUsage
}

// Source: DebateMetadataSchema in integrations/shared/src/types.ts
interface DebateMetadata {
  duration_ms: number
  format: string
  mode: string
  prompt_version?: number | null
  thinking_level: string
  total_credits_used: number
}

// Source: ConsultResponseSchema in integrations/shared/src/types.ts
interface ConsultResponse {
  metadata: DebateMetadata
  moderator: ModeratorResult
  participants: ParticipantResponse[]
  sessionId?: string
  threadSlug?: string
}

// Typed error shape for JSON error responses from the API
interface ApiErrorBody {
  error?: string
  message?: string
}

// Allowed tool argument value types
type ToolArgValue = string | number | boolean | string[] | undefined
interface ToolArgs {
  [key: string]: ToolArgValue
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// ── HTTP helper ──

async function apiRequest<T>(method: string, path: string, body?: ToolArgs): Promise<T> {
  const url = `${BASE_URL}${path}`
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-debatekit-source': 'dxt',
    },
  }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    let msg: string
    try {
      const json: ApiErrorBody = JSON.parse(text)
      msg = json.error ?? json.message ?? `Request failed (${res.status})`
    } catch {
      msg = `Request failed (${res.status}): ${text.slice(0, 300)}`
    }
    throw new Error(msg)
  }
  // Standard fetch pattern -- Response.json() returns Promise<any>
  return res.json() as Promise<T>
}

// ── Format debate result as markdown ──

function formatDebate(result: ConsultResponse): string {
  const lines: string[] = []

  if (result.moderator?.summary) {
    lines.push('# Moderator Summary', '', result.moderator.summary, '')
  }

  if (result.participants?.length) {
    lines.push('---', '', '## Participant Responses', '')
    for (const p of result.participants) {
      const role = p.role ? ` (${p.role})` : ''
      lines.push(`### ${p.model_name}${role}`, '', p.response, '')
    }
  }

  if (result.metadata) {
    const dur = (result.metadata.duration_ms / 1000).toFixed(1)
    lines.push('---', '', '## Metadata', '')
    lines.push(`- **Duration:** ${dur}s`)
    lines.push(`- **Mode:** ${result.metadata.mode}`)
    lines.push(`- **Thinking Level:** ${result.metadata.thinking_level}`)
    lines.push(`- **Credits Used:** ${result.metadata.total_credits_used}`)
  }

  if (result.sessionId) {
    lines.push(`- **Session ID:** \`${result.sessionId}\``)
  }
  if (result.threadSlug) {
    // NOTE: Threads are private by default. This link only works if the
    // user has set the thread to public via set_thread_visibility.
    lines.push(`- **Thread:** ${APP_URL}/public/chat/${result.threadSlug}`)
  }

  return lines.join('\n')
}

// ── Tool definitions ──

const TOOLS = [
  {
    name: 'consult_council',
    description: 'Consult the AI council — multiple models debate your question, then a moderator synthesizes the best answer. Auto-mode picks optimal models by default.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string' as const, description: 'Your question or topic' },
        context: { type: 'string' as const, description: 'Additional context' },
        mode: { type: 'string' as const, enum: [...CHAT_MODES], description: 'Conversation mode: analyzing (research), brainstorming (ideas), debating (tradeoffs), solving (action plans)' },
        thinking_level: { type: 'string' as const, enum: [...THINKING_LEVELS], description: 'Depth of analysis: low (fast/cheap), medium (balanced), high (maximum reasoning)' },
        models: { type: 'array' as const, items: { type: 'string' as const }, description: 'Specific models to use (omit for auto)' },
        roles: { type: 'array' as const, items: { type: 'string' as const }, description: 'Roles for each participant' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'review_code',
    description: 'Multi-model code review with security, performance, and quality analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' as const, description: 'Code to review' },
        language: { type: 'string' as const, description: 'Programming language' },
        focus: { type: 'array' as const, items: { type: 'string' as const }, description: 'Focus areas (security, performance, readability)' },
        thinking_level: { type: 'string' as const, enum: [...THINKING_LEVELS] },
      },
      required: ['code'],
    },
  },
  {
    name: 'debug_issue',
    description: 'Debug a problem with multiple AI models collaborating on root cause analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        problem: { type: 'string' as const, description: 'Problem description' },
        error: { type: 'string' as const, description: 'Error message or stack trace' },
        code: { type: 'string' as const, description: 'Relevant code' },
        expected_behavior: { type: 'string' as const, description: 'Expected vs actual behavior' },
        thinking_level: { type: 'string' as const, enum: [...THINKING_LEVELS] },
      },
      required: ['problem'],
    },
  },
  {
    name: 'design_architecture',
    description: 'Design system architecture with multiple AI perspectives.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string' as const, description: 'System description' },
        tech_stack: { type: 'array' as const, items: { type: 'string' as const }, description: 'Technologies' },
        focus_areas: { type: 'array' as const, items: { type: 'string' as const }, description: 'Focus areas' },
        scale: { type: 'string' as const, enum: [...ARCHITECT_SCALES], description: 'Target scale: startup (small team), growth (scaling), enterprise (large org)' },
      },
      required: ['description'],
    },
  },
  {
    name: 'plan_implementation',
    description: 'Create step-by-step implementation plans with multi-model input.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        feature: { type: 'string' as const, description: 'Feature to implement' },
        codebase_context: { type: 'string' as const, description: 'Codebase context' },
        constraints: { type: 'array' as const, items: { type: 'string' as const }, description: 'Constraints' },
        thinking_level: { type: 'string' as const, enum: [...THINKING_LEVELS] },
      },
      required: ['feature'],
    },
  },
  {
    name: 'assess_tradeoffs',
    description: 'Evaluate options and trade-offs with structured multi-model analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        decision: { type: 'string' as const, description: 'Decision to evaluate' },
        options: { type: 'array' as const, items: { type: 'string' as const }, description: 'Options to compare' },
        priorities: { type: 'array' as const, items: { type: 'string' as const }, description: 'Priorities to consider' },
        thinking_level: { type: 'string' as const, enum: [...THINKING_LEVELS] },
      },
      required: ['decision', 'options'],
    },
  },
  {
    name: 'check_usage',
    description: 'Check your DebateKit credit balance and usage.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_models',
    description: 'List available AI models.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_sessions',
    description: 'Browse your recent DebateKit sessions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number' as const, description: 'Max results (default 20)' },
        offset: { type: 'number' as const, description: 'Offset for pagination' },
        tool_name: { type: 'string' as const, description: 'Filter by tool name' },
      },
    },
  },
  {
    name: 'get_session',
    description: 'Get details of a specific session.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string' as const, description: 'Session ID' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'get_logs',
    description: 'Get session logs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string' as const, description: 'Session ID' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'get_thread_link',
    description: 'Get a shareable link to a session thread.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string' as const, description: 'Session ID' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'set_thread_visibility',
    description: 'Set thread visibility (public or private).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string' as const, description: 'Session ID' },
        visibility: { type: 'string' as const, enum: [...THREAD_VISIBILITIES], description: 'Visibility setting' },
      },
      required: ['session_id', 'visibility'],
    },
  },
] as const

// ── Tool routing ──

// Tool names that map to debate POST endpoints
const DEBATE_TOOL_NAMES = [
  'consult_council',
  'review_code',
  'debug_issue',
  'design_architecture',
  'plan_implementation',
  'assess_tradeoffs',
] as const
type DebateToolName = (typeof DEBATE_TOOL_NAMES)[number]

const DEBATE_ENDPOINTS: Record<DebateToolName, string> = {
  assess_tradeoffs: '/api/v1/assess-tradeoffs',
  consult_council: '/api/v1/consult',
  debug_issue: '/api/v1/debug',
  design_architecture: '/api/v1/architect',
  plan_implementation: '/api/v1/plan-implementation',
  review_code: '/api/v1/review-code',
}

function isDebateToolName(name: string): name is DebateToolName {
  return (DEBATE_TOOL_NAMES as readonly string[]).includes(name)
}

async function handleToolCall(name: string, args: ToolArgs): Promise<string> {
  // Debate tools -- POST to REST API, format as markdown
  if (isDebateToolName(name)) {
    const result = await apiRequest<ConsultResponse>('POST', DEBATE_ENDPOINTS[name], args)
    return formatDebate(result)
  }

  // Utility tools
  switch (name) {
    case 'check_usage': {
      const data = await apiRequest<JsonValue>('GET', '/api/v1/usage')
      return JSON.stringify(data, null, 2)
    }
    case 'list_models': {
      const data = await apiRequest<JsonValue>('GET', '/api/v1/models')
      return JSON.stringify(data, null, 2)
    }
    case 'list_sessions': {
      const params = new URLSearchParams()
      if (args.limit) params.set('limit', String(args.limit))
      if (args.offset) params.set('offset', String(args.offset))
      if (args.tool_name) params.set('tool_name', String(args.tool_name))
      const qs = params.toString()
      const data = await apiRequest<JsonValue>('GET', `/api/v1/sessions${qs ? `?${qs}` : ''}`)
      return JSON.stringify(data, null, 2)
    }
    case 'get_session': {
      const data = await apiRequest<JsonValue>('GET', `/api/v1/sessions/${args.session_id}`)
      return JSON.stringify(data, null, 2)
    }
    case 'get_logs': {
      const data = await apiRequest<JsonValue>('GET', `/api/v1/sessions/${args.session_id}/logs`)
      return JSON.stringify(data, null, 2)
    }
    case 'get_thread_link': {
      const data = await apiRequest<JsonValue>('GET', `/api/v1/sessions/${args.session_id}/thread-link`)
      return JSON.stringify(data, null, 2)
    }
    case 'set_thread_visibility': {
      const data = await apiRequest<JsonValue>('POST', `/api/v1/sessions/${args.session_id}/visibility`, {
        visibility: args.visibility,
      })
      return JSON.stringify(data, null, 2)
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ── MCP Server ──

const server = new Server(
  { name: 'debatekit', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params
  try {
    const toolArgs: ToolArgs = {}
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        if (v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          toolArgs[k] = v
        }
        else if (Array.isArray(v)) {
          // MCP schema defines arrays as string[] -- coerce elements
          toolArgs[k] = v.map(String)
        }
      }
    }
    const text = await handleToolCall(name, toolArgs)
    return { content: [{ type: 'text' as const, text }] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
server.connect(transport)
console.error('DebateKit MCP server running...')
