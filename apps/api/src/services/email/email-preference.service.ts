/**
 * Email Preference Service
 *
 * CRUD preferences, HMAC unsubscribe tokens, check subscribed.
 * Uses SubtleCrypto (Web Crypto API) for HMAC since this runs on Cloudflare Workers.
 */

import type { EmailCategory } from '@debatekit/shared/enums';
import { EMAIL_CATEGORIES } from '@debatekit/shared/enums';
import { and, eq } from 'drizzle-orm';
import { ulid } from 'ulid';

import type { AppDb } from '@/db';
import { emailPreference } from '@/db/tables';
import { log } from '@/lib/logger';

// ============================================================================
// HMAC UTILITIES (SubtleCrypto for Cloudflare Workers)
// ============================================================================

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.byteLength !== bBytes.byteLength) {
    return false;
  }

  // Use SubtleCrypto to derive same-length buffers for constant-time comparison
  const key = await crypto.subtle.importKey(
    'raw',
    aBytes,
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );

  const sigA = await crypto.subtle.sign('HMAC', key, aBytes);
  const sigB = await crypto.subtle.sign('HMAC', key, bBytes);

  const viewA = new Uint8Array(sigA);
  const viewB = new Uint8Array(sigB);

  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= (viewA[i] ?? 0) ^ (viewB[i] ?? 0);
  }
  return diff === 0;
}

// ============================================================================
// PREFERENCE CRUD
// ============================================================================

/**
 * Creates default preferences for all categories (all subscribed).
 */
export async function createDefaultPreferences(db: AppDb, userId: string) {
  const now = new Date();

  const values = EMAIL_CATEGORIES.map(category => ({
    category,
    createdAt: now,
    globalUnsubscribe: false,
    id: ulid(),
    subscribed: true,
    updatedAt: now,
    userId,
  }));

  await db.insert(emailPreference).values(values).onConflictDoNothing();

  log.info('Created default email preferences', { categories: EMAIL_CATEGORIES.length, userId });
}

/**
 * Returns all preferences for a user.
 */
export async function getUserPreferences(db: AppDb, userId: string) {
  return db
    .select()
    .from(emailPreference)
    .where(eq(emailPreference.userId, userId));
}

/**
 * Toggle a category subscription.
 */
export async function updatePreference(
  db: AppDb,
  userId: string,
  category: EmailCategory,
  subscribed: boolean,
) {
  const now = new Date();

  const existing = await db
    .select()
    .from(emailPreference)
    .where(
      and(
        eq(emailPreference.userId, userId),
        eq(emailPreference.category, category),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(emailPreference).values({
      category,
      createdAt: now,
      globalUnsubscribe: false,
      id: ulid(),
      subscribed,
      updatedAt: now,
      userId,
    });
    return;
  }

  await db
    .update(emailPreference)
    .set({ subscribed, updatedAt: now })
    .where(
      and(
        eq(emailPreference.userId, userId),
        eq(emailPreference.category, category),
      ),
    );
}

/**
 * Toggle global unsubscribe for a user.
 * Sets globalUnsubscribe on ALL category rows.
 */
export async function setGlobalUnsubscribe(
  db: AppDb,
  userId: string,
  unsubscribed: boolean,
) {
  const now = new Date();

  await db
    .update(emailPreference)
    .set({ globalUnsubscribe: unsubscribed, updatedAt: now })
    .where(eq(emailPreference.userId, userId));

  log.info('Set global unsubscribe', { unsubscribed, userId });
}

/**
 * Check if user is subscribed to category (respects global unsubscribe).
 */
export async function isUserSubscribed(
  db: AppDb,
  userId: string,
  category: EmailCategory,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(emailPreference)
    .where(
      and(
        eq(emailPreference.userId, userId),
        eq(emailPreference.category, category),
      ),
    )
    .limit(1);

  // No preference row = subscribed by default
  const pref = rows[0];
  if (!pref) {
    return true;
  }

  // Global unsubscribe overrides category-level setting
  if (pref.globalUnsubscribe) {
    return false;
  }

  return pref.subscribed;
}

// ============================================================================
// UNSUBSCRIBE TOKENS
// ============================================================================

/**
 * Generate HMAC-SHA256 unsubscribe token: base64url(HMAC(userId + ':' + category, secret))
 */
export async function generateUnsubscribeToken(
  userId: string,
  category: string,
  secret: string,
): Promise<string> {
  return hmacSign(`${userId}:${category}`, secret);
}

/**
 * Validate unsubscribe token via timing-safe HMAC comparison.
 */
export async function validateUnsubscribeToken(
  token: string,
  userId: string,
  category: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacSign(`${userId}:${category}`, secret);
  return timingSafeCompare(token, expected);
}

/**
 * Build full unsubscribe URL for inclusion in email headers and body.
 */
export async function buildUnsubscribeUrl(
  webappUrl: string,
  userId: string,
  category: string,
  secret: string,
): Promise<string> {
  const token = await generateUnsubscribeToken(userId, category, secret);
  const params = new URLSearchParams({
    cat: category,
    token,
    uid: userId,
  });
  return `${webappUrl}/email/unsubscribe?${params.toString()}`;
}
