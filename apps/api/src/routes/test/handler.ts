/**
 * Test Route Handlers
 *
 * ONLY available in development/test environments.
 */

import type { RouteHandler } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';

import { createHandler, Responses } from '@/core';
import { getDbAsync, userCreditBalance } from '@/db';
import { getPostHogClient } from '@/lib/analytics';
import { getUserCreditBalance } from '@/services/billing';
import type { ApiEnv } from '@/types';

import type { postHogDiagnosticRoute, setUserCreditsRoute } from './route';
import { SetCreditsRequestSchema } from './schema';

/**
 * Set user credits for testing
 */
export const setUserCreditsHandler: RouteHandler<typeof setUserCreditsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'setUserCredits',
    validateBody: SetCreditsRequestSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { credits } = c.validated.body;

    const db = await getDbAsync();

    await db
      .update(userCreditBalance)
      .set({
        balance: credits,
        updatedAt: new Date(),
      })
      .where(eq(userCreditBalance.userId, user.id));

    const balance = await getUserCreditBalance(user.id);

    return Responses.ok(c, {
      available: balance.available,
      balance: balance.balance,
      planType: balance.planType,
    });
  },
);

/**
 * PostHog Diagnostic Handler
 * Tests PostHog connectivity and returns diagnostic info
 */
export const postHogDiagnosticHandler: RouteHandler<typeof postHogDiagnosticRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'postHogDiagnostic',
  },
  async (c) => {
    const { user } = c.auth();

    // Get environment info from CloudflareEnv bindings
    const hasApiKey = Boolean(c.env.POSTHOG_API_KEY);
    const host = c.env.POSTHOG_HOST ?? null;
    const environment = c.env.WEBAPP_ENV ?? null;

    // Try to get PostHog client
    const posthog = getPostHogClient();
    const clientInitialized = posthog !== null;

    if (!clientInitialized) {
      return Responses.ok(c, {
        clientInitialized: false,
        config: {
          environment,
          hasApiKey,
          host,
        },
        error: 'PostHog client not initialized - check POSTHOG_API_KEY secret and POSTHOG_HOST env var',
        eventCaptured: false,
        eventFlushed: false,
        eventName: 'test_diagnostic',
      });
    }

    // Try to capture and flush a test event
    const testEventName = 'test_diagnostic';
    let eventCaptured = false;
    let eventFlushed = false;
    let error: string | null = null;

    try {
      posthog.capture({
        distinctId: user.id,
        event: testEventName,
        properties: {
          $set: {
            test_diagnostic_at: new Date().toISOString(),
          },
          diagnostic: true,
          source: 'api_diagnostic_endpoint',
          timestamp: new Date().toISOString(),
          user_email: user.email,
        },
      });
      eventCaptured = true;

      // Explicitly flush
      await posthog.flush();
      eventFlushed = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return Responses.ok(c, {
      clientInitialized,
      config: {
        environment,
        hasApiKey,
        host,
      },
      error,
      eventCaptured,
      eventFlushed,
      eventName: testEventName,
    });
  },
);
