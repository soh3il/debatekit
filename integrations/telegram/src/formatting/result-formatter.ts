/**
 * Telegram Result Formatter (HTML)
 *
 * Formats DebateKit API responses for Telegram HTML parse_mode.
 * Handles escaping, truncation at 4096 chars, and structured output
 * with moderator synthesis + participant highlights.
 *
 * Telegram HTML supports: <b>, <i>, <code>, <pre>, <a href="">, <blockquote>
 * Only need to escape: < > &
 * Reference: https://core.telegram.org/bots/api#html-style
 */

import type { ConsultResponse } from '@debatekit/integration-shared'

/** Telegram message length limit */
const MAX_MESSAGE_LENGTH = 4096

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

/**
 * Escape text for Telegram HTML format.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Format the complete result as a single consolidated HTML message.
 * Shows moderator synthesis + brief participant highlights + metadata.
 * Thread URLs are NOT included -- the inline keyboard handles share/dashboard links.
 * ALWAYS ensures output is <= 4096 chars (Telegram limit).
 */
export function formatConsolidatedResult(result: ConsultResponse, toolLabel: string): string {
  const duration = (result.metadata.duration_ms / 1000).toFixed(1)
  const participantCount = result.participants.length

  let text = `<b>${escapeHtml(toolLabel)}</b>\n\n`
  text += escapeHtml(result.moderator.summary)

  // Participant highlights
  if (result.participants.length > 0) {
    text += '\n\n<b>Participant Highlights</b>'
    for (const [i, p] of result.participants.entries()) {
      const name = p.model_name || p.model_id.split('/').pop() || 'Participant'
      const roleLabel = p.role ? ` <i>(${escapeHtml(p.role)})</i>` : ''
      const firstLine = escapeHtml(p.response.split('\n')[0].slice(0, 120))
      const line = `\n${i + 1}. <b>${escapeHtml(name)}</b>${roleLabel}: ${firstLine}`

      if (text.length + line.length < MAX_MESSAGE_LENGTH - 100) {
        text += line
      }
    }
  }

  text += `\n\n<i>${participantCount} models | ${duration}s | ${result.metadata.total_credits_used} credits</i>`

  // Ensure under 4096 chars
  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_MESSAGE_LENGTH - 40) + '\n\n<i>... truncated</i>'
  }

  return text
}

/**
 * Format an error message in HTML.
 */
export function formatError(msg: string): string {
  return `<b>Something went wrong</b>\n\n${escapeHtml(msg)}\n\nPlease try again or check your API key with /setkey.`
}
