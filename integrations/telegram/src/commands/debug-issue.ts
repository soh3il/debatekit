/**
 * /debug Command Handler
 *
 * Bug diagnosis council -- uses the MCP debug endpoint to analyze
 * bug descriptions with multiple AI models.
 *
 * Uses grammY context for all Telegram API calls.
 * HTML parse_mode for formatting.
 */

import type { Context } from 'grammy'

import type { Env } from '../index'
import { debugIssue } from '@debatekit/integration-shared'
import { executeCommand } from '../lib/command-handler'

export async function handleDebug(ctx: Context, env: Env, apiKey: string, description: string) {
  await executeCommand(
    ctx,
    env,
    apiKey,
    'Debugging... this takes 30-60 seconds.',
    'Bug Diagnosis Council',
    'debug',
    () => debugIssue(env.DEBATEKIT_API_URL, apiKey, description, {
      source: 'telegram',
      thinking_level: 'high',
    }),
  )
}
