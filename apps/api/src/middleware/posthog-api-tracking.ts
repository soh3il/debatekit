/**
 * PostHog API Tracking Middleware
 *
 * Captures api_request, api_slow_request, api_error, rate_limit_hit events.
 * Samples normal requests at 10%, always tracks errors and high-value endpoints.
 */

import { WebAppEnvs } from '@debatekit/shared';
import { env as workersEnv } from 'cloudflare:workers';
import { createMiddleware } from 'hono/factory';
import * as z from 'zod';

import { getDistinctIdFromCookie, getPostHogClient } from '@/lib/analytics';
import type { ApiEnv } from '@/types';

const SLOW_REQUEST_THRESHOLD_MS = 3000;
const NORMAL_REQUEST_SAMPLE_RATE = 0.1;

const SKIP_TRACKING_PATHS = [
  '/health',
  '/system',
  '/doc',
  '/openapi.json',
  '/scalar',
  '/llms.txt',
  '/ingest',
  '/debug',
] as const;

const HIGH_VALUE_PATTERNS = [
  { event: 'thread_created', method: 'POST', pattern: /^\/chat\/threads$/ },
  { event: 'message_sent', method: 'POST', pattern: /^\/chat\/threads\/[^/]+\/rounds\/\d+\/stream$/ },
  { event: 'participant_added', method: 'POST', pattern: /^\/chat\/threads\/[^/]+\/participants$/ },
  { event: 'project_created', method: 'POST', pattern: /^\/projects$/ },
  { event: 'file_uploaded', method: 'POST', pattern: /^\/uploads$/ },
  { event: 'subscription_checkout', method: 'POST', pattern: /^\/billing\/checkout$/ },
] as const;

const _ApiRequestPropertiesSchema = z.object({
  cf_colo: z.string().optional(),
  cf_country: z.string().optional(),
  cf_ray: z.string().optional(),
  content_type: z.string().optional(),
  endpoint_category: z.string().optional(),
  is_error: z.boolean(),
  is_high_value: z.boolean(),
  is_slow: z.boolean(),
  latency_ms: z.number(),
  method: z.string(),
  path: z.string(),
  session_id: z.string().optional(),
  status: z.number(),
  user_agent: z.string().optional(),
  user_id: z.string().optional(),
});

type ApiRequestProperties = z.infer<typeof _ApiRequestPropertiesSchema>;

function getWebappEnv(): string {
  try {
    const value = workersEnv.WEBAPP_ENV;
    if (value) {
      return value;
    }
  } catch {
    // Workers env not available
  }
  return process.env.WEBAPP_ENV || WebAppEnvs.LOCAL;
}

function isTrackingEnabled(): boolean {
  const env = getWebappEnv();
  return env === WebAppEnvs.PREVIEW || env === WebAppEnvs.PROD;
}

function shouldSkipPath(path: string): boolean {
  return SKIP_TRACKING_PATHS.some(skipPath => path.startsWith(skipPath));
}

function shouldSample(isError: boolean, isSlow: boolean, isHighValue: boolean): boolean {
  if (isError || isSlow || isHighValue) {
    return true;
  }
  return Math.random() < NORMAL_REQUEST_SAMPLE_RATE;
}

function matchHighValueEndpoint(method: string, path: string): string | null {
  for (const { event, method: m, pattern } of HIGH_VALUE_PATTERNS) {
    if (method === m && pattern.test(path)) {
      return event;
    }
  }
  return null;
}

function categorizeEndpoint(path: string): string {
  if (path.startsWith('/chat')) {
    return 'chat';
  }
  if (path.startsWith('/billing')) {
    return 'billing';
  }
  if (path.startsWith('/projects')) {
    return 'projects';
  }
  if (path.startsWith('/uploads')) {
    return 'uploads';
  }
  if (path.startsWith('/auth') || path.startsWith('/api/auth')) {
    return 'auth';
  }
  if (path.startsWith('/admin')) {
    return 'admin';
  }
  if (path.startsWith('/models')) {
    return 'models';
  }
  if (path.startsWith('/mcp')) {
    return 'mcp';
  }
  if (path.startsWith('/usage')) {
    return 'usage';
  }
  if (path.startsWith('/api-keys')) {
    return 'api-keys';
  }
  return 'other';
}

/** PostHog API tracking middleware */
export const posthogApiTracking = createMiddleware<ApiEnv>(async (c, next) => {
  if (!isTrackingEnabled() || shouldSkipPath(c.req.path)) {
    await next();
    return;
  }

  const startTime = Date.now();

  await next();

  const latencyMs = Date.now() - startTime;
  const status = c.res?.status || 0;
  const isError = status >= 400;
  const isSlow = latencyMs > SLOW_REQUEST_THRESHOLD_MS;
  const method = c.req.method;
  const path = c.req.path;
  const highValueEvent = matchHighValueEndpoint(method, path);
  const isHighValue = highValueEvent !== null;

  if (!shouldSample(isError, isSlow, isHighValue)) {
    return;
  }

  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  const cf = c.req.raw.cf;
  const cfRay = c.req.header('cf-ray');
  const user = c.get('user');
  const session = c.get('session');
  const cookieHeader = c.req.header('cookie');

  const distinctId = user?.id
    || session?.userId
    || getDistinctIdFromCookie(cookieHeader || null)
    || 'anonymous';

  const properties: ApiRequestProperties = {
    cf_colo: cf && 'colo' in cf && typeof cf.colo === 'string' ? cf.colo : undefined,
    cf_country: cf && 'country' in cf && typeof cf.country === 'string' ? cf.country : undefined,
    cf_ray: cfRay,
    content_type: c.req.header('content-type'),
    endpoint_category: categorizeEndpoint(path),
    is_error: isError,
    is_high_value: isHighValue,
    is_slow: isSlow,
    latency_ms: latencyMs,
    method,
    path,
    session_id: session?.id,
    status,
    user_agent: c.req.header('user-agent'),
    user_id: user?.id || session?.userId,
  };

  try {
    posthog.capture({
      distinctId,
      event: 'api_request',
      properties: {
        ...properties,
        ...(session?.id && { $session_id: session.id }),
      },
    });

    if (isSlow) {
      posthog.capture({
        distinctId,
        event: 'api_slow_request',
        properties: {
          ...properties,
          exceeded_by_ms: latencyMs - SLOW_REQUEST_THRESHOLD_MS,
          threshold_ms: SLOW_REQUEST_THRESHOLD_MS,
          ...(session?.id && { $session_id: session.id }),
        },
      });
    }

    if (isError) {
      posthog.capture({
        distinctId,
        event: 'api_error',
        properties: {
          ...properties,
          error_category: status >= 500 ? 'server_error' : 'client_error',
          ...(session?.id && { $session_id: session.id }),
        },
      });
    }

    if (highValueEvent) {
      posthog.capture({
        distinctId,
        event: highValueEvent,
        properties: {
          ...properties,
          ...(session?.id && { $session_id: session.id }),
        },
      });
    }

    // Flush in background — NEVER await flush() in middleware.
    // Awaiting blocks the HTTP response until PostHog's API responds,
    // which hangs the entire request if PostHog is slow/unreachable.
    c.executionCtx.waitUntil(posthog.flush());
  } catch {
    // Silently fail
  }
});
export function trackRateLimitHit(
  distinctId: string,
  rateLimitType: string,
  path: string,
  method: string,
  retryAfterSeconds: number,
  sessionId?: string,
): void {
  if (!isTrackingEnabled()) {
    return;
  }

  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId,
      event: 'rate_limit_hit',
      properties: {
        endpoint_category: categorizeEndpoint(path),
        method,
        path,
        rate_limit_type: rateLimitType,
        retry_after_seconds: retryAfterSeconds,
        ...(sessionId && { $session_id: sessionId }),
      },
    });

    // Don't await — fire and forget. PostHog SDK batches internally.
    posthog.flush().catch(() => {});
  } catch {
    // Silently fail
  }
}
