/**
 * /analyze Command Handler
 *
 * Analyzes recent chat messages using DebateKit's multi-model brainstorm.
 * Works in both DMs and groups. Shows an interactive inline keyboard when
 * called without arguments.
 *
 * Usage: /analyze [N] [question]
 *   N -- number of messages to analyze (default 10, max 50)
 *   question -- what to analyze about the messages
 *
 * Uses grammY context for all Telegram API calls.
 * HTML parse_mode for formatting.
 */

import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'

import type { Env } from '../index'
import { API_ERROR_MESSAGES, consult, DebateKitApiError } from '@debatekit/integration-shared'
import { getRecentMessages } from '../lib/chat-store'
import { executeCommand } from '../lib/command-handler'
import { formatConsolidatedResult, formatError } from '../formatting/result-formatter'

const DEFAULT_COUNT = 10
const MAX_COUNT = 50

function parseArgs(args: string): { count: number; question: string } | null {
  const trimmed = args.trim()
  if (!trimmed) return null // No args = show interactive menu

  const parts = trimmed.split(/\s+/)
  const maybeNumber = Number.parseInt(parts[0], 10)

  if (!Number.isNaN(maybeNumber) && maybeNumber > 0) {
    const count = Math.min(maybeNumber, MAX_COUNT)
    const question = parts.slice(1).join(' ') || 'Summarize the key points and themes from these messages.'
    return { count, question }
  }

  return { count: DEFAULT_COUNT, question: trimmed }
}

function buildMessagesPrompt(messages: { date: number; from: string; text: string }[], question: string) {
  const contextLines = messages.map(msg =>
    `[${new Date(msg.date * 1000).toLocaleString()}] ${msg.from}: ${msg.text}`,
  )
  return `${question}\n\nHere are the chat messages to analyze:\n\n${contextLines.join('\n')}`
}

export async function handleAnalyze(ctx: Context, env: Env, apiKey: string, args: string) {
  const chatId = ctx.chat!.id
  const parsed = parseArgs(args)

  if (!parsed) {
    // Interactive mode: show inline keyboard with options
    const messages = await getRecentMessages(env.KV, chatId, MAX_COUNT)
    const available = messages.length

    if (available === 0) {
      const chatType = ctx.chat!.type
      if (chatType === 'private') {
        await ctx.reply(
          'No messages to analyze yet.\n\n'
          + 'Keep chatting with me and your messages will be buffered. '
          + 'Then use /analyze to analyze our conversation.\n\n'
          + 'Or type: /analyze [your question] to analyze with a specific focus.',
          { reply_parameters: { message_id: ctx.message!.message_id } },
        )
      }
      else {
        await ctx.reply(
          'No recent messages found to analyze.\n\n'
          + 'Messages are buffered automatically in this chat. '
          + 'Keep chatting, then use /analyze later.',
          { reply_parameters: { message_id: ctx.message!.message_id } },
        )
      }
      return
    }

    // Show interactive options
    const keyboard = new InlineKeyboard()
    if (available >= 5) keyboard.text('Last 5 messages', 'analyze:5')
    if (available >= 10) keyboard.text('Last 10 messages', 'analyze:10')
    if (available >= 20) keyboard.row().text('Last 20 messages', 'analyze:20')
    if (available > 20) keyboard.text(`All ${Math.min(available, 50)} messages`, `analyze:${Math.min(available, 50)}`)
    keyboard.row().text('Cancel', 'analyze:cancel')

    await ctx.reply(
      `I have ${available} recent messages available.\n\nHow many would you like me to analyze? Or type /analyze [question] for a specific focus.`,
      {
        reply_markup: keyboard,
        reply_parameters: { message_id: ctx.message!.message_id },
      },
    )
    return
  }

  // Direct execution with args
  await runAnalysis(ctx, env, apiKey, parsed.count, parsed.question)
}

/**
 * Handle callback queries from analyze inline keyboard
 */
export async function handleAnalyzeCallback(ctx: Context, env: Env, apiKey: string, data: string) {
  const chatId = ctx.chat!.id

  if (data === 'analyze:cancel') {
    await ctx.answerCallbackQuery({ text: 'Cancelled' })
    await ctx.editMessageText('Analysis cancelled.')
    return
  }

  const match = data.match(/^analyze:(\d+)$/)
  if (!match) return

  const count = Number.parseInt(match[1], 10)
  await ctx.answerCallbackQuery({ text: `Analyzing ${count} messages...` })

  // Edit the keyboard message to show progress
  await ctx.editMessageText(`<i>Analyzing ${count} messages... this takes 30-60 seconds.</i>`, { parse_mode: 'HTML' })

  // Keep typing indicator alive during API call
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction('typing').catch(() => {})
  }, 5000)

  // Run analysis (reuse the same message ID for result)
  const messages = await getRecentMessages(env.KV, chatId, count)
  if (messages.length === 0) {
    clearInterval(typingInterval)
    await ctx.editMessageText('No messages found to analyze.')
    return
  }

  try {
    const prompt = buildMessagesPrompt(messages, 'Summarize the key points and themes from these messages.')

    console.log(`[analyze] Calling API for chat ${chatId}, ${messages.length} messages`)
    const result = await consult(env.DEBATEKIT_API_URL, apiKey, prompt, { source: 'telegram' })
    clearInterval(typingInterval)
    console.log(`[analyze] API returned ${result.participants.length} participants`)

    const text = formatConsolidatedResult(result, 'Chat Analysis')
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML' })
    }
    catch {
      // Fallback: send as plain text
      await ctx.api.sendMessage(chatId, text.replace(/<[^>]+>/g, ''))
        .catch(e => console.error('[analyze] Final send failed:', e instanceof Error ? e.message : e))
    }
  }
  catch (error) {
    clearInterval(typingInterval)

    let safeError: string
    if (error instanceof DebateKitApiError && error.code) {
      safeError = API_ERROR_MESSAGES[error.code] ?? error.message
      console.error(`[analyze callback] API error [${error.code}]:`, error.message)
    }
    else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[analyze callback] Error:', errorMessage)
      safeError = errorMessage.slice(0, 500)
    }

    try {
      await ctx.editMessageText(formatError(safeError), { parse_mode: 'HTML' })
    }
    catch {
      await ctx.api.sendMessage(chatId, `Analysis failed: ${safeError}\n\nPlease try again.`)
        .catch(e => console.error('[analyze] Error send failed:', e instanceof Error ? e.message : e))
    }
  }
}

async function runAnalysis(ctx: Context, env: Env, apiKey: string, count: number, question: string) {
  const chatId = ctx.chat!.id
  const messages = await getRecentMessages(env.KV, chatId, count)

  if (messages.length === 0) {
    const chatType = ctx.chat!.type
    if (chatType === 'private') {
      await ctx.reply(
        'No messages to analyze yet. Keep chatting and your messages will be buffered for analysis.',
        { reply_parameters: { message_id: ctx.message!.message_id } },
      )
    }
    else {
      await ctx.reply(
        'No recent messages found. Messages are buffered automatically for 24 hours.',
        { reply_parameters: { message_id: ctx.message!.message_id } },
      )
    }
    return
  }

  const prompt = buildMessagesPrompt(messages, question)

  await executeCommand(
    ctx,
    env,
    apiKey,
    `Analyzing ${messages.length} messages... this takes 30-60 seconds.`,
    'Chat Analysis',
    'analyze',
    () => consult(env.DEBATEKIT_API_URL, apiKey, prompt, { source: 'telegram' }),
  )
}
