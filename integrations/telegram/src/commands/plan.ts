/**
 * /plan Command Handler
 *
 * Implementation planning council -- uses the MCP plan-implementation
 * endpoint to create detailed implementation plans with multiple AI models.
 *
 * Uses grammY context for all Telegram API calls.
 * HTML parse_mode for formatting.
 */

import type { Context } from 'grammy'

import type { Env } from '../index'
import { planImplementation } from '@debatekit/integration-shared'
import { executeCommand } from '../lib/command-handler'

export async function handlePlan(ctx: Context, env: Env, apiKey: string, description: string) {
  await executeCommand(
    ctx,
    env,
    apiKey,
    'Planning... this takes 30-60 seconds.',
    'Implementation Plan',
    'plan',
    () => planImplementation(env.DEBATEKIT_API_URL, apiKey, description, { source: 'telegram' }),
  )
}
