/**
 * Shared result formatters for integrations.
 * Platform-specific formatting (Slack blocks, Telegram HTML)
 * should extend these base formatters.
 */

import type { ConsultResponse, ParticipantResponse } from './types'

/** Maximum message length for most platforms */
export const MAX_MESSAGE_LENGTH = 4096

/**
 * Format result as plain text (base formatter).
 * Platform integrations can use this or build their own.
 */
export function formatResultPlainText(result: ConsultResponse, toolLabel: string): string {
  const duration = (result.metadata.duration_ms / 1000).toFixed(1)
  const count = result.participants.length

  let text = `${toolLabel}\n\n`
  text += result.moderator.summary

  if (count > 0) {
    text += '\n\n---\nParticipant Highlights:'
    for (const [i, p] of result.participants.entries()) {
      const name = getParticipantName(p)
      const roleLabel = p.role ? ` (${p.role})` : ''
      const firstLine = p.response.split('\n')[0].slice(0, 120)
      text += `\n${i + 1}. ${name}${roleLabel}: ${firstLine}`
    }
  }

  text += `\n\n${count} models | ${duration}s | ${result.metadata.total_credits_used} credits`

  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_MESSAGE_LENGTH - 30) + '\n\n... truncated.'
  }

  return text
}

/**
 * Format error as plain text.
 */
export function formatErrorPlainText(errorMessage: string): string {
  return `Something went wrong:\n\n${errorMessage}\n\nPlease try again or check your API key.`
}

/**
 * Get participant display name.
 */
export function getParticipantName(participant: ParticipantResponse): string {
  return participant.model_name || participant.model_id.split('/').pop() || 'Participant'
}

// ============================================================================
// Code detection helpers (used by review commands across integrations)
// ============================================================================

/** Common code patterns for heuristic detection */
const CODE_PATTERNS = [
  /```/,              // markdown code blocks
  /[{};]/,            // braces / semicolons
  /=>/,               // arrow functions
  /function\s+\w+/,   // function declarations
  /import\s+/,        // import statements
  /const\s+|let\s+|var\s+/, // variable declarations
  /class\s+\w+/,      // class declarations
  /def\s+\w+/,        // python functions
  /\)\s*{/,           // function bodies
]

/**
 * Heuristic: does the input look like code?
 * Check for common code patterns: braces, semicolons, backticks, arrows, etc.
 */
export function looksLikeCode(input: string): boolean {
  return CODE_PATTERNS.some(pattern => pattern.test(input))
}

/**
 * Extract code from triple-backtick formatting.
 * Works with both Slack and WhatsApp message formatting.
 */
export function extractCode(input: string): string {
  const codeBlockMatch = input.match(/```(?:\w+\n)?([\s\S]+?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  return input
}
