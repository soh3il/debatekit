/**
 * /setkey Command Handler
 *
 * Configures the DebateKit API key for a chat.
 * Validates the key format (must start with rpnd_), verifies it against the API,
 * and stores it in KV.
 */

import type { Context } from 'grammy'

import { API_ERROR_MESSAGES, listSessions, DebateKitApiError } from '@debatekit/integration-shared'
import type { Env } from '../index'
import { hasApiKey, removeApiKey, setApiKey } from '../lib/chat-store'

export async function handleSetKey(ctx: Context, env: Env, args: string) {
  const chatId = ctx.chat!.id
  const userId = ctx.from!.id
  const trimmed = args.trim()

  // No args — show current status
  if (!trimmed) {
    const configured = await hasApiKey(env.KV, chatId)
    if (configured) {
      await ctx.reply('API key is configured. To update, run:\n/setkey rpnd_your_new_key\n\nTo remove, run:\n/setkey remove')
    }
    else {
      await ctx.reply('No API key configured.\n\nGet one at debatekit.com/chat/settings/api-keys, then run:\n/setkey rpnd_your_key_here')
    }
    return
  }

  // Remove key
  if (trimmed === 'remove') {
    await removeApiKey(env.KV, chatId)
    await ctx.reply('API key removed. The bot will use the default key if available.')
    return
  }

  // Validate format
  if (!trimmed.startsWith('rpnd_')) {
    await ctx.reply('Invalid API key format. Keys must start with rpnd_.\n\nGet one at debatekit.com/chat/settings/api-keys')
    return
  }

  // Validate key against the API before storing
  try {
    await listSessions(env.DEBATEKIT_API_URL, trimmed, { limit: 1, source: 'telegram' })
  }
  catch (error) {
    if (error instanceof DebateKitApiError && error.code) {
      const msg = API_ERROR_MESSAGES[error.code]
      await ctx.reply(`API key validation failed: ${msg}`)
    }
    else {
      await ctx.reply('Could not validate API key. Please check that it\'s correct and try again.')
    }
    return
  }

  // Store the verified key
  await setApiKey(env.KV, chatId, trimmed, userId)

  const masked = `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`
  await ctx.reply(`API key verified and configured: ${masked}\n\nYou can now use /consult, /review, and /analyze.`)
}
