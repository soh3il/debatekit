/**
 * Per-Chat KV Storage
 *
 * Stores and retrieves per-chat API keys and message buffers.
 * Each Telegram chat (DM or group) can configure its own
 * DebateKit API key. Group messages are buffered for /analyze.
 *
 * KV key patterns:
 *   chat:{chatId}:api_key        — DebateKit API key
 *   chat:{chatId}:registered_at  — Registration timestamp
 *   chat:{chatId}:registered_by  — User who set the key
 *   chat:{chatId}:msg:{messageId} — Individual message (24h TTL)
 *   chat:{chatId}:recent_msgs    — JSON array of recent messages (cap 100)
 */

import { z } from 'zod'

const PREFIX = 'chat'

/** 24 hours in seconds */
const MESSAGE_TTL = 86_400

/** Max messages to keep in the recent buffer */
const MAX_RECENT_MESSAGES = 100

function key(chatId: number | string, field: string) {
  return `${PREFIX}:${chatId}:${field}`
}

// ---------------------------------------------------------------------------
// API Key management
// ---------------------------------------------------------------------------

export async function getApiKey(kv: KVNamespace, chatId: number | string) {
  return kv.get(key(chatId, 'api_key'))
}

export async function setApiKey(
  kv: KVNamespace,
  chatId: number | string,
  apiKey: string,
  userId: number | string,
) {
  await Promise.all([
    kv.put(key(chatId, 'api_key'), apiKey),
    kv.put(key(chatId, 'registered_at'), new Date().toISOString()),
    kv.put(key(chatId, 'registered_by'), String(userId)),
  ])
}

export async function hasApiKey(kv: KVNamespace, chatId: number | string) {
  const val = await kv.get(key(chatId, 'api_key'))
  return val !== null && val.length > 0
}

export async function removeApiKey(kv: KVNamespace, chatId: number | string) {
  await Promise.all([
    kv.delete(key(chatId, 'api_key')),
    kv.delete(key(chatId, 'registered_at')),
    kv.delete(key(chatId, 'registered_by')),
  ])
}

// ---------------------------------------------------------------------------
// Message buffer (for /analyze)
// ---------------------------------------------------------------------------

export const BufferedMessageSchema = z.object({
  date: z.number(),
  from: z.string(),
  messageId: z.number(),
  text: z.string(),
})
export type BufferedMessage = z.infer<typeof BufferedMessageSchema>

const BufferedMessageArraySchema = z.array(BufferedMessageSchema)

/**
 * Safely parse a JSON string as a BufferedMessage array.
 * Returns empty array on invalid input.
 */
function parseBufferedMessages(json: string): BufferedMessage[] {
  try {
    const parsed = BufferedMessageArraySchema.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : []
  }
  catch {
    return []
  }
}

/**
 * Buffer a message for later /analyze retrieval.
 * Stores individual message with 24h TTL and appends to recent list.
 */
export async function bufferMessage(
  kv: KVNamespace,
  chatId: number | string,
  message: BufferedMessage,
) {
  const msgKey = key(chatId, `msg:${message.messageId}`)
  const recentKey = key(chatId, 'recent_msgs')

  // Store individual message with TTL
  await kv.put(msgKey, JSON.stringify(message), { expirationTtl: MESSAGE_TTL })

  // Append to recent messages list
  const existing = await kv.get(recentKey)
  let recent = existing ? parseBufferedMessages(existing) : []

  recent.push(message)

  // Cap at MAX_RECENT_MESSAGES (keep most recent)
  if (recent.length > MAX_RECENT_MESSAGES) {
    recent = recent.slice(-MAX_RECENT_MESSAGES)
  }

  await kv.put(recentKey, JSON.stringify(recent), { expirationTtl: MESSAGE_TTL })
}

/**
 * Retrieve the last N messages from the buffer.
 */
export async function getRecentMessages(
  kv: KVNamespace,
  chatId: number | string,
  count: number,
) {
  const recentKey = key(chatId, 'recent_msgs')
  const existing = await kv.get(recentKey)

  if (!existing) return []

  return parseBufferedMessages(existing).slice(-count)
}
