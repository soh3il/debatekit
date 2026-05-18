/**
 * Route Guards
 *
 * Reusable guards for TanStack Router `beforeLoad` hooks.
 * Centralizes access control logic to avoid duplication across route files.
 */

import { redirect } from '@tanstack/react-router';

import type { SessionData } from './types';

/**
 * Redirects anonymous users to /chat.
 * Use in `beforeLoad` for routes that require a signed-in (non-anonymous) user.
 *
 * @example
 * ```ts
 * beforeLoad: ({ context }) => {
 *   requireNonAnonymous(context.session);
 * }
 * ```
 */
export function requireNonAnonymous(session: SessionData | null) {
  if (!session || session.user.isAnonymous) {
    throw redirect({ to: '/chat' });
  }
}
