/**
 * WhatsApp Result Formatter
 *
 * Formats DebateKit API responses for WhatsApp messages.
 * Uses WhatsApp-compatible markdown:
 *   *bold*, _italic_, ~strikethrough~, `monospace`, ```code block```
 *
 * WhatsApp message limit: 4096 characters.
 */

import type { ConsultResponse, ParticipantResponse } from '@debatekit/integration-shared';

const MAX_MESSAGE_LENGTH = 4096;

const TRUNCATION_NOTICE = '\n\n_... truncated. View full discussion at debatekit.com_';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate text to fit within WhatsApp's message limit,
 * leaving room for a truncation notice.
 */
function truncate(text: string, maxLength = MAX_MESSAGE_LENGTH): string {
  if (text.length <= maxLength) return text;
  const cutoff = maxLength - TRUNCATION_NOTICE.length;
  return text.slice(0, cutoff) + TRUNCATION_NOTICE;
}

/**
 * Convert common markdown to WhatsApp-compatible format.
 * WhatsApp uses *bold*, _italic_, ~strikethrough~, ```code```.
 * Standard markdown **bold** and __italic__ need converting.
 */
function toWhatsAppMarkdown(text: string): string {
  return text
    // **bold** → *bold*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // __italic__ → _italic_
    .replace(/__(.+?)__/g, '_$1_')
    // ## Headers → *HEADER* with newlines
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
}

// ---------------------------------------------------------------------------
// Public formatters
// ---------------------------------------------------------------------------

/**
 * Format the moderator synthesis as the main response message.
 */
export function formatModeratorSynthesis(result: ConsultResponse, prompt: string): string {
  const { moderator, metadata, participants } = result;

  const header = `*DebateKit Discussion*\n_"${prompt.slice(0, 200)}${prompt.length > 200 ? '...' : ''}"_`;
  const participantNames = participants
    .map(p => p.model_name || p.model_id.split('/').pop())
    .join(', ');

  const meta = `\n\n_${participants.length} models consulted (${participantNames}) in ${(metadata.duration_ms / 1000).toFixed(1)}s | ${metadata.total_credits_used} credits used_`;

  const synthesis = toWhatsAppMarkdown(moderator.summary);
  const body = `\n\n*Synthesis:*\n${synthesis}`;

  return truncate(`${header}${meta}${body}`);
}

/**
 * Format a single participant's response.
 */
export function formatParticipantResponse(participant: ParticipantResponse, index: number): string {
  const name = participant.model_name || participant.model_id.split('/').pop() || 'Participant';
  const roleLabel = participant.role ? ` — ${participant.role}` : '';
  const header = `*${index + 1}. ${name}*${roleLabel}`;

  const response = toWhatsAppMarkdown(participant.response);

  return truncate(`${header}\n\n${response}`);
}

/**
 * Format an error message.
 */
export function formatError(error: string): string {
  return `*DebateKit Error*\n\n${error}\n\n_Need help? Send !help_`;
}

/**
 * Format the help message.
 */
export function formatHelp(appUrl: string): string {
  return [
    '*DebateKit — AI Board of Directors*',
    '',
    'Consult multiple AI models simultaneously and get a synthesized answer.',
    '',
    '*Commands:*',
    '!consult [question] — Start a brainstorm',
    '!review [code/description] — Code or architecture review',
    '!analyze [N] [question] — Analyze last N messages',
    '!setkey rpnd_xxx — Set your DebateKit API key',
    '!help — Show this message',
    '',
    '_In DMs, you can skip !consult and just type your question directly._',
    '',
    `Get an API key at ${appUrl}/chat/settings/api-keys`,
  ].join('\n');
}

/**
 * Format the analyze result header.
 */
export function formatAnalyzeContext(messages: Array<{ from: string; text: string }>, count: number): string {
  const context = messages
    .slice(-count)
    .map(m => `[${m.from}]: ${m.text}`)
    .join('\n');

  return `_Analyzing ${Math.min(count, messages.length)} recent messages..._\n\n\`\`\`\n${context.slice(0, 1500)}\n\`\`\``;
}
