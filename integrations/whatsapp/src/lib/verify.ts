/**
 * WhatsApp Webhook Verification
 *
 * Two verification mechanisms:
 *   1. GET — Meta webhook subscription challenge (verify_token match)
 *   2. POST — HMAC-SHA256 signature verification of incoming payloads
 *
 * Reference: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */

// ---------------------------------------------------------------------------
// GET verification — webhook subscription challenge
// ---------------------------------------------------------------------------

type ChallengeQuery = {
  'hub.challenge'?: string;
  'hub.mode'?: string;
  'hub.verify_token'?: string;
};

export type ChallengeResult =
  | { ok: true; challenge: string }
  | { ok: false; error: string };

/**
 * Verify Meta's GET webhook subscription challenge.
 * Returns the hub.challenge value if the verify token matches.
 */
export function verifyWebhookChallenge(query: ChallengeQuery, verifyToken: string): ChallengeResult {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  if (mode !== 'subscribe') {
    return { ok: false, error: 'Invalid hub.mode — expected "subscribe"' };
  }

  if (!token || token !== verifyToken) {
    return { ok: false, error: 'Verify token mismatch' };
  }

  if (!challenge) {
    return { ok: false, error: 'Missing hub.challenge' };
  }

  return { ok: true, challenge };
}

// ---------------------------------------------------------------------------
// POST verification — HMAC-SHA256 signature
// ---------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify the X-Hub-Signature-256 header on incoming webhook POSTs.
 * Uses Web Crypto API (Cloudflare Workers compatible).
 */
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signatureHeader.slice('sha256='.length);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(rawBody),
  );

  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(computedSignature, expectedSignature);
}
