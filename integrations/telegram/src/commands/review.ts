/**
 * /review Command Handler
 *
 * Code review mode -- detects whether input is code or architecture
 * description and routes to the appropriate API endpoint.
 * Sends a single consolidated message with moderator + participant highlights.
 *
 * Uses grammY context for all Telegram API calls.
 * HTML parse_mode for formatting.
 */

import type { Context } from 'grammy'

import type { Env } from '../index'
import { architect, reviewCode } from '@debatekit/integration-shared'
import { executeCommand } from '../lib/command-handler'

/**
 * Heuristic: does the input look like code?
 */
function looksLikeCode(input: string) {
  const codePatterns = [
    /```/,
    /[{};]/,
    /=>/,
    /function\s+\w+/,
    /import\s+/,
    /const\s+|let\s+|var\s+/,
    /class\s+\w+/,
    /def\s+\w+/,
    /\)\s*{/,
  ]

  return codePatterns.some(pattern => pattern.test(input))
}

/**
 * Extract code from markdown-formatted messages.
 */
function extractCode(input: string) {
  const codeBlockMatch = input.match(/```(?:\w+\n)?([\s\S]+?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  return input
}

export async function handleReview(ctx: Context, env: Env, apiKey: string, input: string) {
  const isCode = looksLikeCode(input)
  const toolLabel = isCode ? 'Code Review Council' : 'Architecture Council'

  await executeCommand(
    ctx,
    env,
    apiKey,
    'Reviewing... this takes 30-60 seconds.',
    toolLabel,
    'review',
    () => isCode
      ? reviewCode(env.DEBATEKIT_API_URL, apiKey, extractCode(input), {
          focus: ['security', 'performance', 'maintainability'],
          source: 'telegram',
        })
      : architect(env.DEBATEKIT_API_URL, apiKey, input, {
          scale: 'startup',
          source: 'telegram',
        }),
  )
}
