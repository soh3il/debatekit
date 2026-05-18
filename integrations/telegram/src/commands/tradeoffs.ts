/**
 * /tradeoffs Command Handler
 *
 * Tradeoff assessment council -- uses the MCP assess-tradeoffs
 * endpoint to compare options with multiple AI models.
 *
 * Uses grammY context for all Telegram API calls.
 * HTML parse_mode for formatting.
 */

import type { Context } from 'grammy'

import type { Env } from '../index'
import { assessTradeoffs } from '@debatekit/integration-shared'
import { executeCommand } from '../lib/command-handler'

export async function handleTradeoffs(ctx: Context, env: Env, apiKey: string, description: string) {
  await executeCommand(
    ctx,
    env,
    apiKey,
    'Assessing tradeoffs... this takes 30-60 seconds.',
    'Tradeoff Assessment',
    'tradeoffs',
    () => assessTradeoffs(env.DEBATEKIT_API_URL, apiKey, description, { source: 'telegram' }),
  )
}
