import { getPreferenceValues } from "@raycast/api";
import {
  API_KEY_HEADER,
  API_TIMEOUT_MS,
  API_VERSION,
  DEBATEKIT_DEFAULT_URL,
  SOURCE_HEADER,
} from "@debatekit/integration-shared";
import { z } from "zod";
import {
  DebateResultSchema,
  type Preferences,
  SessionSchema,
  SessionsResponseSchema,
} from "./types";

function getConfig() {
  const { apiKey, baseUrl } = getPreferenceValues<Preferences>();
  return {
    apiKey,
    baseUrl: (baseUrl || DEBATEKIT_DEFAULT_URL).replace(/\/$/, ""),
  };
}

const ApiErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

function extractErrorMessage(status: number, body: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { parsed = undefined; }
  const result = ApiErrorSchema.safeParse(parsed);
  return result.success
    ? (result.data.error || result.data.message || `Request failed (${status})`)
    : `Request failed (${status}): ${body.slice(0, 200)}`;
}

async function postApi<T extends z.ZodType>(
  path: string,
  body: { [key: string]: string | string[] | number | boolean | undefined },
  schema: T,
): Promise<z.infer<T>> {
  const { apiKey, baseUrl } = getConfig();
  const url = `${baseUrl}/api/${API_VERSION}/${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [API_KEY_HEADER]: apiKey,
        [SOURCE_HEADER]: "raycast",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(extractErrorMessage(response.status, await response.text()));
    }

    const json: unknown = await response.json();
    return schema.parse(json);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`DebateKit API timeout after ${API_TIMEOUT_MS / 1000}s: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getApi<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.infer<T>> {
  const { apiKey, baseUrl } = getConfig();
  const url = `${baseUrl}/api/${API_VERSION}/${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { [API_KEY_HEADER]: apiKey, [SOURCE_HEADER]: "raycast" },
  });

  if (!response.ok) {
    throw new Error(extractErrorMessage(response.status, await response.text()));
  }

  const json: unknown = await response.json();
  return schema.parse(json);
}

// ============================================================================
// POST /api/v1/* (debate tools)
// ============================================================================

/** POST /api/v1/consult */
export function consult(body: {
  context?: string;
  mode?: string;
  prompt: string;
  thinking_level?: string;
}) {
  return postApi("consult", body, DebateResultSchema);
}

/** POST /api/v1/review-code */
export function reviewCode(body: {
  code: string;
  focus?: string[];
  language?: string;
  thinking_level?: string;
}) {
  return postApi("review-code", body, DebateResultSchema);
}

/** POST /api/v1/debug */
export function debugIssue(body: {
  code?: string;
  error?: string;
  expected_behavior?: string;
  problem: string;
  thinking_level?: string;
}) {
  return postApi("debug", body, DebateResultSchema);
}

/** POST /api/v1/architect */
export function architect(body: {
  description: string;
  focus_areas?: string[];
  scale?: string;
  tech_stack?: string[];
}) {
  return postApi("architect", body, DebateResultSchema);
}

/** POST /api/v1/plan-implementation */
export function planImplementation(body: {
  codebase_context?: string;
  constraints?: string[];
  feature: string;
  thinking_level?: string;
}) {
  return postApi("plan-implementation", body, DebateResultSchema);
}

/** POST /api/v1/assess-tradeoffs */
export function assessTradeoffs(body: {
  decision: string;
  options: string[];
  priorities?: string[];
  thinking_level?: string;
}) {
  return postApi("assess-tradeoffs", body, DebateResultSchema);
}

// ============================================================================
// GET /api/v1/* (query tools)
// ============================================================================

/** GET /api/v1/sessions */
export function listSessions(params?: {
  limit?: number;
  offset?: number;
  tool_name?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.tool_name) searchParams.set("tool_name", params.tool_name);

  const qs = searchParams.toString();
  const path = qs ? `sessions?${qs}` : "sessions";
  return getApi(path, SessionsResponseSchema);
}

/** GET /api/v1/sessions/:id */
export function getSession(sessionId: string) {
  return getApi(`sessions/${sessionId}`, SessionSchema);
}
