/**
 * PostHog Server-Side Client
 *
 * Singleton PostHog client for Cloudflare Workers edge environment.
 * Immediate flush (flushAt: 1, flushInterval: 0). Returns null in local env.
 */
import { env as workersEnv } from 'cloudflare:workers';
import { PostHog } from 'posthog-node';
import * as z from 'zod';

import { log } from '@/lib/logger';

const ANONYMOUS_USER_ID = 'anonymous' as const;

let posthogClient: PostHog | null = null;

function getEnvVar(key: 'POSTHOG_API_KEY' | 'POSTHOG_HOST' | 'WEBAPP_ENV'): string | undefined {
  // 1. Try Cloudflare Workers bindings (production/preview)
  try {
    const value = workersEnv[key];
    if (value) {
      return value;
    }
  } catch {
    // Workers env not available - continue to fallback
  }

  // 2. Fall back to process.env (local dev)
  return process.env[key];
}

export function getPostHogClient(): PostHog | null {
  const apiKey = getEnvVar('POSTHOG_API_KEY');
  const apiHost = getEnvVar('POSTHOG_HOST');
  const environment = getEnvVar('WEBAPP_ENV');

  // Disable in local environment, enable in preview and production
  if (environment === 'local' || !apiKey || !apiHost) {
    return null;
  }

  // Return existing client if already initialized
  if (posthogClient) {
    return posthogClient;
  }

  // Create new PostHog client
  posthogClient = new PostHog(apiKey, {
    // Flush immediately for edge environments (Cloudflare Workers)
    flushAt: 1,
    flushInterval: 0,
    host: apiHost,
  });

  return posthogClient;
}

const PostHogCookieSchema = z.object({
  distinct_id: z.string(),
});

/**
 * Extract PostHog distinct ID from ph_<api_key>_posthog cookie
 */
export function getDistinctIdFromCookie(cookieHeader: string | null): string {
  if (!cookieHeader) {
    return ANONYMOUS_USER_ID;
  }

  const apiKey = getEnvVar('POSTHOG_API_KEY');
  if (!apiKey) {
    return ANONYMOUS_USER_ID;
  }

  const cookieName = `ph_${apiKey}_posthog`;

  try {
    // Parse cookies manually into map
    const cookies = cookieHeader.split(';').reduce<Map<string, string>>((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc.set(key, value);
      }
      return acc;
    }, new Map<string, string>());

    const cookieValue = cookies.get(cookieName);
    if (!cookieValue) {
      return ANONYMOUS_USER_ID;
    }

    // Decode and parse cookie value with Zod validation
    const decodedValue = decodeURIComponent(cookieValue);
    const parsed: unknown = JSON.parse(decodedValue);

    const result = PostHogCookieSchema.safeParse(parsed);
    if (!result.success) {
      return ANONYMOUS_USER_ID;
    }

    return result.data.distinct_id;
  } catch (error) {
    log.error('Failed to get PostHog distinct ID from cookie', error instanceof Error ? error : { error: String(error) });
    return ANONYMOUS_USER_ID;
  }
}

// ============================================================================
// Exception Properties Schema
// ============================================================================

const PostHogPropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

const _ExceptionPropertiesSchema = z.object({
  endpoint: z.string().optional(),
  errorCode: z.string().optional(),
  finishReason: z.string().optional(),
  httpStatus: z.number().int().optional(),
  jobId: z.string().optional(),
  jobName: z.string().optional(),
  modelId: z.string().optional(),
  participantId: z.string().optional(),
  queueName: z.string().optional(),
  requestId: z.string().optional(),
  retryCount: z.number().int().optional(),
  service: z.string().optional(),
  source: z.string().optional(),
  threadId: z.string().optional(),
  userId: z.string().optional(),
}).catchall(PostHogPropertyValueSchema);

type ExceptionProperties = z.infer<typeof _ExceptionPropertiesSchema>;

export async function captureServerException(
  error: unknown,
  options?: {
    distinctId?: string;
    cookieHeader?: string | null;
    properties?: ExceptionProperties;
  },
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  const distinctId = options?.distinctId
    ?? (options?.cookieHeader ? getDistinctIdFromCookie(options.cookieHeader) : ANONYMOUS_USER_ID);

  await posthog.captureException(error, distinctId, {
    $exception_source: 'backend',
    ...options?.properties,
  });
}

// Graceful shutdown on process termination
if (typeof process !== 'undefined') {
  const shutdownHandler = async () => {
    if (posthogClient) {
      try {
        await posthogClient.shutdown();
      } catch {
        // Ignore shutdown errors
      }
    }
  };

  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);
  process.on('beforeExit', shutdownHandler);

  process.on('exit', () => {
    if (posthogClient) {
      posthogClient.shutdown();
    }
  });
}
