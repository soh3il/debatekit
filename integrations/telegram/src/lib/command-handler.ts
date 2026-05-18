/**
 * Shared Command Handler
 *
 * Extracts the common pattern used by all Telegram command handlers:
 * 1. Send typing + thinking message
 * 2. Keep-alive typing interval during API call
 * 3. Call DebateKit API
 * 4. Format + edit thinking message with result
 * 5. Attach share/dashboard inline keyboard
 * 6. Error handling with fallbacks
 *
 * Each command only needs to provide the API call and label.
 */

import { InlineKeyboard } from 'grammy'
import type { Context } from 'grammy'

import type { ConsultResponse } from '@debatekit/integration-shared'
import { API_ERROR_MESSAGES, getThreadLink, DebateKitApiError } from '@debatekit/integration-shared'
import type { Env } from '../index'
import { formatConsolidatedResult, formatError } from '../formatting/result-formatter'

type RunApiCall = () => Promise<ConsultResponse>

/**
 * Execute a DebateKit command with standard thinking/typing/result/keyboard flow.
 *
 * @param ctx - grammY context
 * @param env - Worker env bindings
 * @param apiKey - DebateKit API key
 * @param thinkingText - Text shown while API call is in progress
 * @param toolLabel - Label for the formatted result (e.g. "Council Discussion")
 * @param commandTag - Log tag (e.g. "consult", "debug")
 * @param runApiCall - Async function that calls the DebateKit API and returns ConsultResponse
 */
export async function executeCommand(
  ctx: Context,
  env: Env,
  apiKey: string,
  thinkingText: string,
  toolLabel: string,
  commandTag: string,
  runApiCall: RunApiCall,
) {
  const chatId = ctx.chat!.id
  let thinkingMsgId: number | undefined
  let typingInterval: ReturnType<typeof setInterval> | undefined

  try {
    // Step 1: Send thinking message
    await ctx.replyWithChatAction('typing')
    const thinkingMsg = await ctx.reply(`<i>${thinkingText}</i>`, {
      parse_mode: 'HTML',
      reply_parameters: { message_id: ctx.message!.message_id },
    })
    thinkingMsgId = thinkingMsg.message_id

    // Step 2: Keep typing indicator alive during API call
    typingInterval = setInterval(() => {
      ctx.replyWithChatAction('typing').catch(() => {})
    }, 5000)

    // Step 3: Call DebateKit API
    console.log(`[${commandTag}] Calling API for chat ${chatId}`)
    const result = await runApiCall()
    clearInterval(typingInterval)
    typingInterval = undefined
    console.log(`[${commandTag}] API returned ${result.participants.length} participants`)

    // Step 4: Format and edit thinking message with result
    const text = formatConsolidatedResult(result, toolLabel)
    try {
      await ctx.api.editMessageText(chatId, thinkingMsgId, text, { parse_mode: 'HTML' })
    }
    catch {
      // Fallback: send as plain text (no HTML parsing issues)
      await ctx.api.sendMessage(chatId, text.replace(/<[^>]+>/g, ''))
        .catch(e => console.error(`[${commandTag}] Final send failed:`, e instanceof Error ? e.message : e))
    }

    // Step 5: Attach share/dashboard inline keyboard
    if (result.sessionId && thinkingMsgId) {
      try {
        let dashboardUrl = result.threadSlug
          ? `${env.DEBATEKIT_APP_URL}/chat/${result.threadSlug}`
          : `${env.DEBATEKIT_APP_URL}/chat/`
        try {
          const link = await getThreadLink(env.DEBATEKIT_API_URL, apiKey, result.sessionId, 'telegram')
          dashboardUrl = link.dashboardUrl
        }
        catch (linkErr) {
          console.error(`[${commandTag}] getThreadLink failed:`, linkErr instanceof Error ? linkErr.message : linkErr)
        }
        const keyboard = new InlineKeyboard()
          .text('Share publicly', `share:${result.sessionId}`)
          .url('View in dashboard', dashboardUrl)
        await ctx.api.editMessageReplyMarkup(chatId, thinkingMsgId, {
          reply_markup: keyboard,
        })
      }
      catch (kbErr) {
        console.error(`[${commandTag}] Keyboard attach failed:`, kbErr instanceof Error ? kbErr.message : kbErr)
      }
    }
  }
  catch (error) {
    if (typingInterval) clearInterval(typingInterval)

    // Use specific user-facing message for known API error codes
    let safeError: string
    if (error instanceof DebateKitApiError && error.code) {
      safeError = API_ERROR_MESSAGES[error.code] ?? error.message
      console.error(`[${commandTag}] API error [${error.code}]:`, error.message)
    }
    else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[${commandTag}] Error:`, errorMessage)
      safeError = errorMessage.slice(0, 500)
    }

    try {
      if (thinkingMsgId) {
        await ctx.api.editMessageText(chatId, thinkingMsgId, formatError(safeError), { parse_mode: 'HTML' })
      }
      else {
        await ctx.reply(formatError(safeError), {
          parse_mode: 'HTML',
          reply_parameters: { message_id: ctx.message!.message_id },
        })
      }
    }
    catch {
      await ctx.api.sendMessage(chatId, `${toolLabel} failed: ${safeError}\n\nPlease try again.`)
        .catch(e => console.error(`[${commandTag}] Error send failed:`, e instanceof Error ? e.message : e))
    }
  }
}
