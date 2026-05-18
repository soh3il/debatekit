/**
 * Slack Request Signature Verification
 *
 * Verifies that incoming requests are genuinely from Slack using
 * HMAC-SHA256 signature verification with the Web Crypto API
 * (compatible with Cloudflare Workers / edge runtimes).
 *
 * Reference: https://api.slack.com/authentication/verifying-requests-from-slack
 */

const FIVE_MINUTES_IN_SECONDS = 300;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifySlackRequest(
  rawBody: string,
  headers: Headers,
  signingSecret: string,
): Promise<boolean> {
  const timestamp = headers.get('x-slack-request-timestamp');
  const signature = headers.get('x-slack-signature');

  if (!timestamp || !signature) {
    return false;
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > FIVE_MINUTES_IN_SECONDS) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${rawBody}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(sigBasestring),
  );

  const computedSignature = `v0=${Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')}`;

  return timingSafeEqual(computedSignature, signature);
}
