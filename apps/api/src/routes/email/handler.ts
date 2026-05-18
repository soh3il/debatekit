/**
 * Email Route Handlers
 *
 * Handlers for email preferences, unsubscribe flows, and tracking pixels.
 * Reuses existing email service functions from @/services/email.
 */

import type { RouteHandler } from '@hono/zod-openapi';

import { createHandler, Responses } from '@/core';
import { getDbAsync } from '@/db';
import { emailTracking } from '@/lib/analytics/posthog-email';
import { getPostHogClient } from '@/lib/analytics/posthog-server';
import { log } from '@/lib/logger';
import {
  getUserPreferences,
  trackEmailClick,
  trackEmailOpen,
  updatePreference,
  validateUnsubscribeToken,
} from '@/services/email';
import type { ApiEnv } from '@/types';

import type {
  confirmResubscribeRoute,
  confirmUnsubscribeRoute,
  getPreferencesRoute,
  trackClickRoute,
  trackOpenRoute,
  updatePreferencesRoute,
  validateUnsubscribeRoute,
} from './route';
import {
  ResubscribeRequestSchema,
  SendLogIdParamSchema,
  UnsubscribeQuerySchema,
  UnsubscribeRequestSchema,
  UpdatePreferencesRequestSchema,
} from './schema';

// ============================================================================
// 1x1 transparent GIF (43 bytes)
// ============================================================================

const TRANSPARENT_GIF = new Uint8Array([
  0x47,
  0x49,
  0x46,
  0x38,
  0x39,
  0x61,
  0x01,
  0x00,
  0x01,
  0x00,
  0x80,
  0x00,
  0x00,
  0xFF,
  0xFF,
  0xFF,
  0x00,
  0x00,
  0x00,
  0x21,
  0xF9,
  0x04,
  0x01,
  0x00,
  0x00,
  0x00,
  0x00,
  0x2C,
  0x00,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x01,
  0x00,
  0x00,
  0x02,
  0x02,
  0x44,
  0x01,
  0x00,
  0x3B,
]);

// ============================================================================
// Authenticated Preference Handlers
// ============================================================================

/**
 * Get email preferences for the authenticated user
 */
export const getPreferencesHandler: RouteHandler<typeof getPreferencesRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getEmailPreferences',
  },
  async (c) => {
    const { user } = c.auth();
    const db = await getDbAsync();

    const preferences = await getUserPreferences(db, user.id);

    return Responses.ok(c, { preferences });
  },
);

/**
 * Update email preferences for the authenticated user
 */
export const updatePreferencesHandler: RouteHandler<typeof updatePreferencesRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'updateEmailPreferences',
    validateBody: UpdatePreferencesRequestSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { preferences } = c.validated.body;
    const db = await getDbAsync();

    for (const pref of preferences) {
      await updatePreference(db, user.id, pref.category, pref.subscribed);
    }

    const updated = await getUserPreferences(db, user.id);

    return Responses.ok(c, { preferences: updated });
  },
);

// ============================================================================
// Public Unsubscribe / Resubscribe Handlers
// ============================================================================

/**
 * Validate unsubscribe token (GET - landing page)
 */
export const validateUnsubscribeHandler: RouteHandler<typeof validateUnsubscribeRoute, ApiEnv> = createHandler(
  {
    auth: 'public',
    operationName: 'validateUnsubscribeToken',
    validateQuery: UnsubscribeQuerySchema,
  },
  async (c) => {
    const { category, token, userId } = c.validated.query;
    const secret = c.env.BETTER_AUTH_SECRET;

    const valid = await validateUnsubscribeToken(token, userId, category, secret);

    return Responses.ok(c, { category, valid });
  },
);

/**
 * Confirm unsubscribe (POST - form submission)
 */
export const confirmUnsubscribeHandler: RouteHandler<typeof confirmUnsubscribeRoute, ApiEnv> = createHandler(
  {
    auth: 'public',
    operationName: 'confirmUnsubscribe',
    validateBody: UnsubscribeRequestSchema,
  },
  async (c) => {
    const { category, token, userId } = c.validated.body;
    const secret = c.env.BETTER_AUTH_SECRET;

    const valid = await validateUnsubscribeToken(token, userId, category, secret);
    if (!valid) {
      return Responses.badRequest(c, 'Invalid or expired unsubscribe token');
    }

    const db = await getDbAsync();
    await updatePreference(db, userId, category, false);

    // Capture PostHog event (fire-and-forget)
    c.executionCtx.waitUntil(
      emailTracking.emailUnsubscribed({ category, userId }).catch(err =>
        log.error('Failed to capture unsubscribe event', { error: err instanceof Error ? err.message : String(err), userId }),
      ),
    );

    log.info('User unsubscribed via email link', { category, userId });

    return Responses.ok(c, { category, unsubscribed: true });
  },
);

/**
 * Confirm resubscribe (POST - form submission)
 */
export const confirmResubscribeHandler: RouteHandler<typeof confirmResubscribeRoute, ApiEnv> = createHandler(
  {
    auth: 'public',
    operationName: 'confirmResubscribe',
    validateBody: ResubscribeRequestSchema,
  },
  async (c) => {
    const { category, token, userId } = c.validated.body;
    const secret = c.env.BETTER_AUTH_SECRET;

    const valid = await validateUnsubscribeToken(token, userId, category, secret);
    if (!valid) {
      return Responses.badRequest(c, 'Invalid or expired resubscribe token');
    }

    const db = await getDbAsync();
    await updatePreference(db, userId, category, true);

    // Capture PostHog event (fire-and-forget)
    c.executionCtx.waitUntil(
      emailTracking.emailResubscribed({ category, userId }).catch(err =>
        log.error('Failed to capture resubscribe event', { error: err instanceof Error ? err.message : String(err), userId }),
      ),
    );

    log.info('User resubscribed via email link', { category, userId });

    return Responses.ok(c, { category, resubscribed: true });
  },
);

// ============================================================================
// Tracking Pixel Handlers
// ============================================================================

/**
 * Track email open via 1x1 transparent GIF
 */
export const trackOpenHandler: RouteHandler<typeof trackOpenRoute, ApiEnv> = createHandler(
  {
    auth: 'public',
    operationName: 'trackEmailOpen',
    validateParams: SendLogIdParamSchema,
  },
  async (c) => {
    const { logId } = c.validated.params;
    const db = await getDbAsync();

    // Fire-and-forget: do not block GIF response on DB write
    const posthogClient = getPostHogClient();
    c.executionCtx.waitUntil(
      trackEmailOpen(db, logId, posthogClient).catch(err =>
        log.error('Failed to track email open', { error: err instanceof Error ? err.message : String(err), logId }),
      ),
    );

    return new Response(TRANSPARENT_GIF, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Content-Type': 'image/gif',
        'Expires': '0',
        'Pragma': 'no-cache',
      },
      status: 200,
    });
  },
);

/**
 * Track email click via 302 redirect
 */
export const trackClickHandler: RouteHandler<typeof trackClickRoute, ApiEnv> = createHandler(
  {
    auth: 'public',
    operationName: 'trackEmailClick',
    validateParams: SendLogIdParamSchema,
  },
  async (c) => {
    const { logId } = c.validated.params;
    const url = new URL(c.req.url);
    const destination = url.searchParams.get('url');
    const db = await getDbAsync();

    // Fire-and-forget: do not block redirect on DB write
    const posthogClient = getPostHogClient();
    c.executionCtx.waitUntil(
      trackEmailClick(db, logId, posthogClient).catch(err =>
        log.error('Failed to track email click', { error: err instanceof Error ? err.message : String(err), logId }),
      ),
    );

    // Redirect to destination or fallback to homepage
    const redirectUrl = destination || 'https://debatekit.com';

    return Responses.redirect(c, redirectUrl);
  },
);
