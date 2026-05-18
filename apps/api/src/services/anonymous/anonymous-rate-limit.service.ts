/**
 * Anonymous Rate Limiting Service
 *
 * IP-based rate limiting for anonymous sign-in via Better Auth anonymous plugin.
 */

import { ANONYMOUS_CONFIG } from '@debatekit/shared';
import { and, eq, gt } from 'drizzle-orm';

import { createError } from '@/common/error-handling';
import { getDbAsync } from '@/db';
import * as tables from '@/db';

/**
 * Check rate limits for anonymous sign-in.
 * Limits by IP address per day using a single JOIN query
 * (sessions from this IP that belong to anonymous users).
 */
export async function checkAnonymousRateLimit(ipAddress: string) {
  const db = await getDbAsync();

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const anonymousSessions = await db
    .select()
    .from(tables.session)
    .innerJoin(tables.user, eq(tables.session.userId, tables.user.id))
    .where(
      and(
        eq(tables.user.isAnonymous, true),
        eq(tables.session.ipAddress, ipAddress),
        gt(tables.session.createdAt, oneDayAgo),
      ),
    )
    .all();

  if (anonymousSessions.length >= ANONYMOUS_CONFIG.MAX_PER_IP_PER_DAY) {
    throw createError.rateLimit('Too many anonymous sessions from this IP address');
  }
}
