/**
 * Shared DebateKit MCP REST API Client
 *
 * Used by all integration workers (Telegram, Slack, WhatsApp).
 * API reference: apps/mcp/src/rest-handler.ts
 */

import type { z } from 'zod'

import { API_KEY_HEADER, API_TIMEOUT_MS, API_VERSION, SOURCE_HEADER } from './constants'
import type { ArchitectScale, ChatMode, IntegrationSource, OutputFormat, ThinkingLevel } from './enums'
import {
  type ApiErrorCode,
  ApiErrorResponseSchema,
  ConsultResponseSchema,
  type KnowledgeItem,
  ListSessionsResponseSchema,
  SessionDetailSchema,
  ThreadLinkResponseSchema,
} from './types'

// ============================================================================
// Error class with structured error code
// ============================================================================

export class DebateKitApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | null

  constructor(status: number, code: ApiErrorCode | null, message: string) {
    super(message)
    this.name = 'DebateKitApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Parse an error response body and throw a DebateKitApiError.
 * Falls back to generic error if body doesn't match expected shape.
 */
async function throwApiError(response: Response, context: string): Promise<never> {
  const text = await response.text()

  // Try to parse structured error response from MCP
  try {
    const json: unknown = JSON.parse(text)
    const parsed = ApiErrorResponseSchema.safeParse(json)
    if (parsed.success) {
      throw new DebateKitApiError(response.status, parsed.data.error.code, parsed.data.error.message)
    }
  }
  catch (e) {
    if (e instanceof DebateKitApiError) throw e
    // JSON parse failed — fall through to generic
  }

  throw new DebateKitApiError(response.status, null, `${context} (${response.status}): ${text}`)
}

// ============================================================================
// Body type for callApi
// ============================================================================

/** JSON-serializable value for API request bodies */
type JsonValue = string | number | boolean | null | undefined | JsonValue[] | { [key: string]: JsonValue }

/** Flat record of JSON-serializable values for POST request bodies */
type ApiRequestBody = { [key: string]: JsonValue }

// ============================================================================
// Generic API caller with Zod validation
// ============================================================================

export async function callApi<T extends z.ZodType>(
  apiUrl: string,
  apiKey: string,
  path: string,
  body: ApiRequestBody,
  schema: T,
  source?: IntegrationSource,
): Promise<z.infer<T>> {
  const url = `${apiUrl}/api/${API_VERSION}/${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [API_KEY_HEADER]: apiKey,
  }
  if (source) {
    headers[SOURCE_HEADER] = source
  }

  try {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers,
      method: 'POST',
      signal: controller.signal,
    })

    if (!response.ok) {
      await throwApiError(response, 'DebateKit API error')
    }

    const json: unknown = await response.json()
    return schema.parse(json)
  }
  catch (error) {
    if (error instanceof DebateKitApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`DebateKit API timeout after ${API_TIMEOUT_MS / 1000}s: ${path}`)
    }
    throw error
  }
  finally {
    clearTimeout(timeoutId)
  }
}

async function callApiGet<T extends z.ZodType>(
  apiUrl: string,
  apiKey: string,
  path: string,
  schema: T,
  source?: IntegrationSource,
): Promise<z.infer<T>> {
  const url = `${apiUrl}/api/${API_VERSION}/${path}`
  const headers: Record<string, string> = { [API_KEY_HEADER]: apiKey }
  if (source) {
    headers[SOURCE_HEADER] = source
  }
  const response = await fetch(url, { headers })
  if (!response.ok) {
    await throwApiError(response, 'DebateKit API error')
  }
  const json: unknown = await response.json()
  return schema.parse(json)
}

// ============================================================================
// POST /api/v1/* (debate tools)
// ============================================================================

/** POST /api/v1/consult */
export function consult(apiUrl: string, apiKey: string, prompt: string, options?: {
  auto_route?: boolean
  context?: string
  format?: OutputFormat
  knowledge?: KnowledgeItem[]
  mode?: ChatMode
  models?: string[]
  roles?: string[]
  session_context?: string[]
  source?: IntegrationSource
  thinking_level?: ThinkingLevel
  webhook_url?: string
}) {
  const { source, ...body } = options ?? {}
  return callApi(apiUrl, apiKey, 'consult', { prompt, ...body }, ConsultResponseSchema, source)
}

/** POST /api/v1/architect */
export function architect(apiUrl: string, apiKey: string, description: string, options?: {
  focus_areas?: string[]
  scale?: ArchitectScale
  source?: IntegrationSource
  tech_stack?: string[]
  webhook_url?: string
}) {
  const { source, ...body } = options ?? {}
  return callApi(apiUrl, apiKey, 'architect', { description, ...body }, ConsultResponseSchema, source)
}

/** POST /api/v1/review-code */
export function reviewCode(apiUrl: string, apiKey: string, code: string, options?: {
  focus?: string[]
  language?: string
  source?: IntegrationSource
  thinking_level?: ThinkingLevel
  webhook_url?: string
}) {
  const { source, ...body } = options ?? {}
  return callApi(apiUrl, apiKey, 'review-code', { code, ...body }, ConsultResponseSchema, source)
}

/** POST /api/v1/debug */
export function debugIssue(apiUrl: string, apiKey: string, problem: string, options?: {
  code?: string
  error?: string
  expected_behavior?: string
  knowledge?: KnowledgeItem[]
  session_context?: string[]
  source?: IntegrationSource
  thinking_level?: ThinkingLevel
  webhook_url?: string
}) {
  const { source, ...body } = options ?? {}
  return callApi(apiUrl, apiKey, 'debug', { problem, ...body }, ConsultResponseSchema, source)
}

/** POST /api/v1/plan-implementation */
export function planImplementation(apiUrl: string, apiKey: string, feature: string, options?: {
  codebase_context?: string
  constraints?: string[]
  knowledge?: KnowledgeItem[]
  session_context?: string[]
  source?: IntegrationSource
  tech_stack?: string[]
  thinking_level?: ThinkingLevel
  webhook_url?: string
}) {
  const { source, ...body } = options ?? {}
  return callApi(apiUrl, apiKey, 'plan-implementation', { feature, ...body }, ConsultResponseSchema, source)
}

/** POST /api/v1/assess-tradeoffs */
export function assessTradeoffs(apiUrl: string, apiKey: string, decision: string, options?: {
  context?: string
  options?: string[]
  priorities?: string[]
  session_context?: string[]
  source?: IntegrationSource
  thinking_level?: ThinkingLevel
  webhook_url?: string
}) {
  const { source, ...body } = options ?? {}
  return callApi(apiUrl, apiKey, 'assess-tradeoffs', { decision, ...body }, ConsultResponseSchema, source)
}

// ============================================================================
// GET /api/v1/* (query tools)
// ============================================================================

/** GET /api/v1/sessions */
export function listSessions(apiUrl: string, apiKey: string, options?: {
  limit?: number
  offset?: number
  source?: IntegrationSource
  tool_name?: string
}) {
  const params = new URLSearchParams()
  if (options?.limit !== undefined)
    params.set('limit', String(options.limit))
  if (options?.offset !== undefined)
    params.set('offset', String(options.offset))
  if (options?.tool_name)
    params.set('tool_name', options.tool_name)

  const qs = params.toString()
  const path = qs ? `sessions?${qs}` : 'sessions'
  return callApiGet(apiUrl, apiKey, path, ListSessionsResponseSchema, options?.source)
}

/** GET /api/v1/sessions/:id */
export function getSession(apiUrl: string, apiKey: string, sessionId: string, source?: IntegrationSource) {
  return callApiGet(apiUrl, apiKey, `sessions/${sessionId}`, SessionDetailSchema, source)
}

/** GET /api/v1/threads/:sessionId/link */
export function getThreadLink(apiUrl: string, apiKey: string, sessionId: string, source?: IntegrationSource) {
  return callApiGet(apiUrl, apiKey, `threads/${sessionId}/link`, ThreadLinkResponseSchema, source)
}

// ============================================================================
// PATCH /api/v1/* (mutation tools)
// ============================================================================

/** PATCH /api/v1/threads/:sessionId/visibility */
export async function setThreadVisibility(apiUrl: string, apiKey: string, sessionId: string, isPublic: boolean, source?: IntegrationSource): Promise<void> {
  const url = `${apiUrl}/api/${API_VERSION}/threads/${sessionId}/visibility`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [API_KEY_HEADER]: apiKey,
  }
  if (source) {
    headers[SOURCE_HEADER] = source
  }
  const response = await fetch(url, {
    body: JSON.stringify({ isPublic }),
    headers,
    method: 'PATCH',
  })
  if (!response.ok) {
    await throwApiError(response, 'Set visibility error')
  }
}
