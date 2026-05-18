/**
 * Per-Chat KV Storage
 *
 * Stores and retrieves per-chat API keys and message buffers.
 * Keyed by WhatsApp phone number (DMs) or group JID (groups).
 *
 * KV key patterns:
 *   chat:{chatId}:api_key       — DebateKit API key
 *   chat:{chatId}:messages      — Buffered messages (JSON array, 24h TTL)
 *   dedup:{messageId}           — Webhook deduplication (5min TTL)
 */

import { z } from 'zod';

const PREFIX = 'chat';

/** 24 hours in seconds */
const MESSAGE_BUFFER_TTL = 86_400;

/** 5 minutes in seconds — Meta can retry webhooks within this window */
const DEDUP_TTL = 300;

/** Maximum messages to buffer per chat */
const MAX_BUFFERED_MESSAGES = 50;

function chatKey(chatId: string, field: string) {
  return `${PREFIX}:${chatId}:${field}`;
}

// ---------------------------------------------------------------------------
// API Key storage
// ---------------------------------------------------------------------------

/**
 * Save or update the DebateKit API key for a chat
 */
export async function setApiKey(kv: KVNamespace, chatId: string, apiKey: string) {
  await kv.put(chatKey(chatId, 'api_key'), apiKey);
}

/**
 * Get the DebateKit API key for a chat (if set)
 */
export async function getApiKey(kv: KVNamespace, chatId: string) {
  return kv.get(chatKey(chatId, 'api_key'));
}

/**
 * Check if a chat has a DebateKit API key configured
 */
export async function hasApiKey(kv: KVNamespace, chatId: string) {
  const val = await kv.get(chatKey(chatId, 'api_key'));
  return val !== null && val.length > 0;
}

/**
 * Remove the API key for a chat
 */
export async function removeApiKey(kv: KVNamespace, chatId: string) {
  await kv.delete(chatKey(chatId, 'api_key'));
}

// ---------------------------------------------------------------------------
// Message buffer — stores recent messages for !analyze
// ---------------------------------------------------------------------------

const BufferedMessageSchema = z.object({
  from: z.string(),
  text: z.string(),
  timestamp: z.number(),
});

export type BufferedMessage = z.infer<typeof BufferedMessageSchema>;

const BufferedMessagesSchema = z.array(BufferedMessageSchema);

/**
 * Append a message to the buffer for a chat.
 * Keeps only the most recent MAX_BUFFERED_MESSAGES entries.
 */
export async function bufferMessage(kv: KVNamespace, chatId: string, message: BufferedMessage) {
  const existing = await getBufferedMessages(kv, chatId);
  existing.push(message);

  // Keep only the most recent messages
  const trimmed = existing.slice(-MAX_BUFFERED_MESSAGES);

  await kv.put(chatKey(chatId, 'messages'), JSON.stringify(trimmed), {
    expirationTtl: MESSAGE_BUFFER_TTL,
  });
}

/**
 * Get buffered messages for a chat.
 */
export async function getBufferedMessages(kv: KVNamespace, chatId: string): Promise<BufferedMessage[]> {
  const raw = await kv.get(chatKey(chatId, 'messages'));
  if (!raw) return [];

  try {
    const json: unknown = JSON.parse(raw);
    const result = BufferedMessagesSchema.safeParse(json);
    return result.success ? result.data : [];
  }
  catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Webhook deduplication
// ---------------------------------------------------------------------------

/**
 * Check if a webhook message has already been processed.
 * Returns true if this is a duplicate (already seen).
 */
export async function isDuplicate(kv: KVNamespace, messageId: string): Promise<boolean> {
  const existing = await kv.get(`dedup:${messageId}`);
  if (existing) return true;

  // Mark as seen
  await kv.put(`dedup:${messageId}`, '1', { expirationTtl: DEDUP_TTL });
  return false;
}
