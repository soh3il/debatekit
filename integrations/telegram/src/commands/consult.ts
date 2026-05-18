/**
 * /consult Command Handler
 *
 * Runs a debatekit brainstorm via the MCP REST API.
 * Shows a "thinking" message, then edits it with a consolidated result
 * (moderator synthesis + participant highlights in ONE message).
 *
 * Uses grammY context for all Telegram API calls.
 * HTML parse_mode for formatting.
 */

import type { Context } from 'grammy'

import type { Env } from '../index'
import { consult } from '@debatekit/integration-shared'
import { executeCommand } from '../lib/command-handler'

export async function handleConsult(ctx: Context, env: Env, apiKey: string, prompt: string) {
  await executeCommand(
    ctx,
    env,
    apiKey,
    'Consulting the council... this takes 30-60 seconds.',
    'Council Discussion',
    'consult',
    () => consult(env.DEBATEKIT_API_URL, apiKey, prompt, { source: 'telegram' }),
  )
}
