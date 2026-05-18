/**
 * Abuse Detection for MCP Usage Patterns
 *
 * Detects and scores abusive usage patterns using KV-backed counters.
 * Patterns detected:
 *   - rapid_requests: >5 requests in 10 seconds
 *   - limit_gaming: hitting rate limit >5 times per hour
 *   - token_anomaly: actual tokens >3x preset max for thinking level
 *   - key_cycling: multiple API keys from same IP in short window
 *   - burst_at_reset: >10 requests in first minute after limit reset
 *
 * Scoring: each pattern adds points; score decays -5/hour of clean activity.
 * Auto-ban at score >= 80 (1h ban). Warning at score >= 50 (logged to PostHog).
 *
 * KV keys:
 *   mcp:abuse:score:{userId}        - current score + last updated (TTL: 24h)
 *   mcp:abuse:activity:{userId}:{m} - activity counter per minute (TTL: 1h)
 *   mcp:abuse:ip:{ip}:{m}           - IP activity counter (TTL: 1h)
 *   mcp:abuse:ban:{userId}          - temporary ban flag (TTL: 1h when set)
 */

import { z } from 'zod';

import type { Env } from '../types';

// ============================================================================
// Abuse Pattern Enum (5-part pattern)
// ============================================================================

const ABUSE_PATTERNS = [
  'rapid_requests',
  'limit_gaming',
  'token_anomaly',
  'key_cycling',
  'burst_at_reset',
] as const;
const _AbusePatternSchema = z.enum(ABUSE_PATTERNS);
type AbusePattern = z.infer<typeof _AbusePatternSchema>;

// ============================================================================
// Constants
// ============================================================================

const PATTERN_SCORES: Readonly<Record<AbusePattern, number>> = {
  burst_at_reset: 10,
  key_cycling: 30,
  limit_gaming: 15,
  rapid_requests: 20,
  token_anomaly: 25,
};

const AUTO_BAN_THRESHOLD = 80;
const MAX_SCORE = 100;
const SCORE_DECAY_PER_HOUR = 5;
const BAN_TTL_SECONDS = 3600; // 1 hour
const SCORE_TTL_SECONDS = 86400; // 24 hours
const ACTIVITY_TTL_SECONDS = 3600; // 1 hour

// Rapid request detection
const RAPID_REQUEST_WINDOW_SECONDS = 10;
const RAPID_REQUEST_THRESHOLD = 5;

// Limit gaming detection
const LIMIT_GAMING_THRESHOLD = 5;

// Key cycling detection
const KEY_CYCLING_WINDOW_MINUTES = 5;
const KEY_CYCLING_THRESHOLD = 3;

// Burst at reset detection
const BURST_AT_RESET_THRESHOLD = 10;

// ============================================================================
// Stored Score Shape
// ============================================================================

const AbuseScoreDataSchema = z.object({
  lastUpdated: z.number(),
  score: z.number(),
});

type AbuseScoreData = z.infer<typeof AbuseScoreDataSchema>;

// ============================================================================
// Result Types
// ============================================================================

const _AbuseCheckResultSchema = z.object({
  blocked: z.boolean(),
  reason: z.string().optional(),
  score: z.number(),
});

type AbuseCheckResult = z.infer<typeof _AbuseCheckResultSchema>;

// ============================================================================
// Activity Context (passed per-request for pattern analysis)
// ============================================================================

const _ActivityContextSchema = z.object({
  apiKeyHash: z.string(),
  maxTokensForLevel: z.number().optional(),
  rateLimitHit: z.boolean().optional(),
  thinkingLevel: z.string().optional(),
  tokensUsed: z.number().optional(),
});

type ActivityContext = z.infer<typeof _ActivityContextSchema>;

// ============================================================================
// KV Key Helpers
// ============================================================================

function scoreKey(userId: string) {
  return `mcp:abuse:score:${userId}`;
}

function banKey(userId: string) {
  return `mcp:abuse:ban:${userId}`;
}

function activityKey(userId: string, minute: number) {
  return `mcp:abuse:activity:${userId}:${minute}`;
}

function ipActivityKey(ip: string, minute: number) {
  return `mcp:abuse:ip:${ip}:${minute}`;
}

function ipKeysKey(ip: string, minute: number) {
  return `mcp:abuse:ipkeys:${ip}:${minute}`;
}

function limitHitKey(userId: string, hour: number) {
  return `mcp:abuse:limithit:${userId}:${hour}`;
}

function currentMinute() {
  return Math.floor(Date.now() / 60_000);
}

function currentHour() {
  return Math.floor(Date.now() / 3_600_000);
}

function current10sWindow() {
  return Math.floor(Date.now() / 10_000);
}

function rapidKey(userId: string, window: number) {
  return `mcp:abuse:rapid:${userId}:${window}`;
}

// ============================================================================
// Score Management
// ============================================================================

async function getStoredScore(env: Env, userId: string): Promise<AbuseScoreData> {
  const raw = await env.KV.get(scoreKey(userId));
  if (!raw) {
    return { lastUpdated: Date.now(), score: 0 };
  }

  const parsed = AbuseScoreDataSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return { lastUpdated: Date.now(), score: 0 };
  }

  return parsed.data;
}

function applyDecay(data: AbuseScoreData): number {
  const hoursElapsed = (Date.now() - data.lastUpdated) / 3_600_000;
  const decayed = data.score - Math.floor(hoursElapsed * SCORE_DECAY_PER_HOUR);
  return Math.max(0, decayed);
}

async function saveScore(env: Env, userId: string, score: number): Promise<void> {
  const clamped = Math.min(MAX_SCORE, Math.max(0, score));
  const data: AbuseScoreData = { lastUpdated: Date.now(), score: clamped };
  await env.KV.put(scoreKey(userId), JSON.stringify(data), {
    expirationTtl: SCORE_TTL_SECONDS,
  });
}

async function applyBan(env: Env, userId: string): Promise<void> {
  await env.KV.put(banKey(userId), String(Date.now()), {
    expirationTtl: BAN_TTL_SECONDS,
  });
}

// ============================================================================
// Pattern Detection Helpers
// ============================================================================

async function detectRapidRequests(env: Env, userId: string): Promise<boolean> {
  const window = current10sWindow();
  const key = rapidKey(userId, window);
  const raw = await env.KV.get(key);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  return count > RAPID_REQUEST_THRESHOLD;
}

async function incrementRapidCounter(env: Env, userId: string): Promise<void> {
  const window = current10sWindow();
  const key = rapidKey(userId, window);
  const raw = await env.KV.get(key);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  await env.KV.put(key, String(count + 1), {
    expirationTtl: RAPID_REQUEST_WINDOW_SECONDS + 5,
  });
}

async function detectLimitGaming(env: Env, userId: string): Promise<boolean> {
  const hour = currentHour();
  const key = limitHitKey(userId, hour);
  const raw = await env.KV.get(key);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  return count > LIMIT_GAMING_THRESHOLD;
}

async function incrementLimitHitCounter(env: Env, userId: string): Promise<void> {
  const hour = currentHour();
  const key = limitHitKey(userId, hour);
  const raw = await env.KV.get(key);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  await env.KV.put(key, String(count + 1), {
    expirationTtl: ACTIVITY_TTL_SECONDS,
  });
}

function detectTokenAnomaly(tokensUsed: number | undefined, maxTokensForLevel: number | undefined): boolean {
  if (tokensUsed === undefined || maxTokensForLevel === undefined || maxTokensForLevel <= 0) {
    return false;
  }
  return tokensUsed > maxTokensForLevel * 3;
}

async function detectKeyCycling(env: Env, ip: string, apiKeyHash: string): Promise<boolean> {
  const minute = currentMinute();
  // Check across the window (multiple minutes)
  const uniqueKeys = new Set<string>();
  for (let m = minute - KEY_CYCLING_WINDOW_MINUTES; m <= minute; m++) {
    const raw = await env.KV.get(ipKeysKey(ip, m));
    if (raw) {
      for (const k of raw.split(',')) {
        if (k) {
          uniqueKeys.add(k);
        }
      }
    }
  }
  uniqueKeys.add(apiKeyHash);
  return uniqueKeys.size >= KEY_CYCLING_THRESHOLD;
}

async function recordIpKeyUsage(env: Env, ip: string, apiKeyHash: string): Promise<void> {
  const minute = currentMinute();
  const key = ipKeysKey(ip, minute);
  const raw = await env.KV.get(key);
  const existing = raw ? raw.split(',').filter(Boolean) : [];
  if (!existing.includes(apiKeyHash)) {
    existing.push(apiKeyHash);
  }
  await env.KV.put(key, existing.join(','), {
    expirationTtl: ACTIVITY_TTL_SECONDS,
  });
}

async function detectBurstAtReset(env: Env, userId: string): Promise<boolean> {
  const minute = currentMinute();
  const key = activityKey(userId, minute);
  const raw = await env.KV.get(key);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  return count > BURST_AT_RESET_THRESHOLD;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a user is currently banned or at risk of abuse.
 * Fast path: single KV read for ban check. Only does pattern analysis if not banned.
 */
export async function checkAbuse(
  env: Env,
  userId: string,
  ip: string,
  context: ActivityContext,
): Promise<AbuseCheckResult> {
  // Fast ban check (single KV read)
  const banned = await env.KV.get(banKey(userId));
  if (banned) {
    return { blocked: true, reason: 'Temporarily banned due to abuse detection. Try again later.', score: MAX_SCORE };
  }

  // Compute current score with decay
  const stored = await getStoredScore(env, userId);
  let currentScore = applyDecay(stored);

  // Detect patterns and accumulate score
  const detectedPatterns: AbusePattern[] = [];

  if (await detectRapidRequests(env, userId)) {
    detectedPatterns.push('rapid_requests');
    currentScore += PATTERN_SCORES.rapid_requests;
  }

  if (context.rateLimitHit) {
    if (await detectLimitGaming(env, userId)) {
      detectedPatterns.push('limit_gaming');
      currentScore += PATTERN_SCORES.limit_gaming;
    }
  }

  if (detectTokenAnomaly(context.tokensUsed, context.maxTokensForLevel)) {
    detectedPatterns.push('token_anomaly');
    currentScore += PATTERN_SCORES.token_anomaly;
  }

  if (ip && await detectKeyCycling(env, ip, context.apiKeyHash)) {
    detectedPatterns.push('key_cycling');
    currentScore += PATTERN_SCORES.key_cycling;
  }

  if (await detectBurstAtReset(env, userId)) {
    detectedPatterns.push('burst_at_reset');
    currentScore += PATTERN_SCORES.burst_at_reset;
  }

  const clampedScore = Math.min(MAX_SCORE, currentScore);

  // Save updated score (fire-and-forget safe because caller handles blocking)
  await saveScore(env, userId, clampedScore);

  // Auto-ban if threshold exceeded
  if (clampedScore >= AUTO_BAN_THRESHOLD) {
    await applyBan(env, userId);
    return {
      blocked: true,
      reason: `Abuse score ${clampedScore} exceeded threshold. Patterns: ${detectedPatterns.join(', ')}. Temporarily banned for 1 hour.`,
      score: clampedScore,
    };
  }

  return { blocked: false, score: clampedScore };
}

/**
 * Record activity for pattern analysis. Call after processing a request (fire-and-forget).
 * Increments per-minute counters for the user and IP.
 */
export async function recordActivity(
  env: Env,
  userId: string,
  ip: string,
  context: ActivityContext,
): Promise<void> {
  const minute = currentMinute();

  // Increment per-minute activity counter
  const userKey = activityKey(userId, minute);
  const raw = await env.KV.get(userKey);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  await env.KV.put(userKey, String(count + 1), {
    expirationTtl: ACTIVITY_TTL_SECONDS,
  });

  // Increment IP activity counter
  if (ip) {
    const ipKey = ipActivityKey(ip, minute);
    const ipRaw = await env.KV.get(ipKey);
    const ipCount = ipRaw ? Number.parseInt(ipRaw, 10) : 0;
    await env.KV.put(ipKey, String(ipCount + 1), {
      expirationTtl: ACTIVITY_TTL_SECONDS,
    });

    // Record IP-to-key mapping for key cycling detection
    await recordIpKeyUsage(env, ip, context.apiKeyHash);
  }

  // Increment rapid request counter
  await incrementRapidCounter(env, userId);

  // If this was a rate-limit hit, increment the limit-hit counter
  if (context.rateLimitHit) {
    await incrementLimitHitCounter(env, userId);
  }

  // Post-request token anomaly score update
  if (detectTokenAnomaly(context.tokensUsed, context.maxTokensForLevel)) {
    const stored = await getStoredScore(env, userId);
    const currentScore = applyDecay(stored);
    const newScore = Math.min(MAX_SCORE, currentScore + PATTERN_SCORES.token_anomaly);
    await saveScore(env, userId, newScore);
  }
}
