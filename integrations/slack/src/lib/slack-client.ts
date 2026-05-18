/**
 * Slack Web API Client (minimal)
 *
 * Lightweight fetch-based Slack API wrapper. Avoids pulling in
 * @slack/web-api which has Node.js dependencies incompatible
 * with Cloudflare Workers.
 */

import { z } from 'zod';

const SLACK_API_BASE = 'https://slack.com/api';

// Slack Block Kit JSON — recursive type representing valid Slack API JSON values.
// Intentionally broad since Block Kit has many block shapes.
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type SlackBlockRecord = { [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// Zod schemas for Slack API responses
// ---------------------------------------------------------------------------

const SlackApiBaseSchema = z.object({
  error: z.string().optional(),
  ok: z.boolean(),
});

const PostMessageResponseSchema = SlackApiBaseSchema.extend({
  channel: z.string(),
  ts: z.string(),
});

export type PostMessageResult = z.infer<typeof PostMessageResponseSchema>;

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

async function slackApiRequest(
  method: string,
  token: string,
  body: SlackBlockRecord,
): Promise<unknown> {
  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Slack HTTP error (${response.status}): ${method}`);
  }

  return response.json();
}

function assertOk(data: z.infer<typeof SlackApiBaseSchema>, method: string) {
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error ?? 'unknown'} (${method})`);
  }
}

// ---------------------------------------------------------------------------
// Chat methods
// ---------------------------------------------------------------------------

export type PostMessageOptions = {
  blocks?: SlackBlockRecord[];
  channel: string;
  text: string;
  thread_ts?: string;
  unfurl_links?: boolean;
};

export async function postMessage(token: string, options: PostMessageOptions) {
  const json = await slackApiRequest('chat.postMessage', token, options);
  const result = PostMessageResponseSchema.parse(json);
  assertOk(result, 'chat.postMessage');
  return result;
}

export type UpdateMessageOptions = {
  blocks?: SlackBlockRecord[];
  channel: string;
  text: string;
  ts: string;
};

export async function updateMessage(token: string, options: UpdateMessageOptions) {
  const json = await slackApiRequest('chat.update', token, options);
  const result = SlackApiBaseSchema.parse(json);
  assertOk(result, 'chat.update');
}

// ---------------------------------------------------------------------------
// Response URL (for slash command follow-ups)
// ---------------------------------------------------------------------------

export async function respondToUrl(
  responseUrl: string,
  body: {
    blocks?: SlackBlockRecord[];
    replace_original?: boolean;
    response_type?: 'ephemeral' | 'in_channel';
    text: string;
  },
) {
  const response = await fetch(responseUrl, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    console.error(`Slack response_url error (${response.status}):`, await response.text());
  }
}
