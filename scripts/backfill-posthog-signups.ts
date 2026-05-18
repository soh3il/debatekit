/* eslint-disable no-console, security/detect-non-literal-fs-filename, no-promise-executor-return */
/**
 * Backfill PostHog signup events from D1 database export.
 *
 * Pushes historical `user_signed_up` events with original timestamps
 * for all signups missed since Feb 17, 2026 due to the waitUntil bug.
 *
 * Usage: bun run scripts/backfill-posthog-signups.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const POSTHOG_API_KEY = 'phc_j7kkGT8YavyO3VHZMqubY5LXkTk5Y6LqocZn09B9f5O';
const POSTHOG_HOST = 'https://us.i.posthog.com';
const BATCH_SIZE = 50;

type SignupRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  provider_id: string | null;
};

type PostHogEvent = {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
  distinct_id: string;
};

function parseBackfillData(): SignupRow[] {
  const filePath = resolve(import.meta.dir, '..', 'signup-backfill.json');
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  // D1 output wraps results in an array with a `results` key
  const results: SignupRow[] = Array.isArray(parsed)
    ? (parsed[0]?.results ?? parsed)
    : (parsed.results ?? []);
  return results;
}

function toISOTimestamp(createdAt: string): string {
  // D1 returns "2026-02-17 01:54:16" — convert to ISO 8601
  return `${createdAt.replace(' ', 'T')}Z`;
}

function buildEvent(row: SignupRow): PostHogEvent {
  const authMethod = row.provider_id === 'google' ? 'google' : 'email';
  const emailDomain = row.email.split('@')[1] ?? '';
  const timestamp = toISOTimestamp(row.created_at);

  return {
    event: 'user_signed_up',
    distinct_id: row.id,
    timestamp,
    properties: {
      // Event properties
      auth_method: authMethod,
      email_domain: emailDomain,
      backfilled: true,
      backfill_source: 'waituntil_fix_2026_03',
      timestamp,

      // Person properties — set on the person profile
      $set: {
        email: row.email,
        name: row.name,
        auth_method: authMethod,
        signup_completed: true,
        last_seen: timestamp,
      },
      $set_once: {
        created_at: timestamp,
        signup_date: timestamp,
        signup_method: authMethod,
        email_domain: emailDomain,
      },
    },
  };
}

async function sendBatch(events: PostHogEvent[]): Promise<{ status: number; ok: boolean }> {
  const response = await fetch(`${POSTHOG_HOST}/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: POSTHOG_API_KEY,
      batch: events,
    }),
  });

  return { status: response.status, ok: response.ok };
}

async function main() {
  const rows = parseBackfillData();
  console.log(`Loaded ${rows.length} signups to backfill`);

  if (rows.length === 0) {
    console.log('No rows to process');
    return;
  }

  // Show date range
  const firstDate = rows[0].created_at;
  const lastDate = rows[rows.length - 1].created_at;
  console.log(`Date range: ${firstDate} → ${lastDate}`);

  const events = rows.map(buildEvent);
  let totalSent = 0;
  let totalFailed = 0;

  // Send in batches
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(events.length / BATCH_SIZE);

    try {
      const result = await sendBatch(batch);
      if (result.ok) {
        totalSent += batch.length;
        console.log(`Batch ${batchNum}/${totalBatches}: sent ${batch.length} events (${totalSent}/${events.length} total)`);
      } else {
        totalFailed += batch.length;
        console.error(`Batch ${batchNum}/${totalBatches}: FAILED with status ${result.status}`);
      }
    } catch (error) {
      totalFailed += batch.length;
      console.error(`Batch ${batchNum}/${totalBatches}: ERROR`, error instanceof Error ? error.message : error);
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < events.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Sent: ${totalSent}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Total: ${events.length}`);
}

main().catch(console.error);
