/**
 * !analyze Command
 *
 * Analyzes the last N buffered messages using a DebateKit brainstorm.
 * Passes message history as context to the consult endpoint.
 *
 * Usage: !analyze [N] [question]
 *   N defaults to 10 if not specified.
 *   Question defaults to "Analyze and summarize this conversation."
 */

import type { Env } from '../index';
import { consult } from '@debatekit/integration-shared';
import { getBufferedMessages } from '../lib/chat-store';
import { formatAnalyzeContext, formatError, formatModeratorSynthesis, formatParticipantResponse } from '../formatting/result-formatter';
import { markAsRead, sendReaction, sendTextMessage } from '../lib/whatsapp-client';

const DEFAULT_COUNT = 10;
const DEFAULT_QUESTION = 'Analyze and summarize this conversation. Highlight key themes, decisions, and action items.';

function parseArgs(args: string): { count: number; question: string } {
  const trimmed = args.trim();
  if (!trimmed) {
    return { count: DEFAULT_COUNT, question: DEFAULT_QUESTION };
  }

  // Check if first word is a number
  const parts = trimmed.split(/\s+/);
  const maybeCount = Number.parseInt(parts[0], 10);

  if (!Number.isNaN(maybeCount) && maybeCount > 0) {
    const question = parts.slice(1).join(' ').trim() || DEFAULT_QUESTION;
    return { count: Math.min(maybeCount, 50), question };
  }

  return { count: DEFAULT_COUNT, question: trimmed };
}

export async function handleAnalyze(
  env: Env,
  apiKey: string,
  chatId: string,
  to: string,
  messageId: string,
  args: string,
) {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneId } = env;
  const { count, question } = parseArgs(args);

  try {
    // React and mark as read
    await Promise.all([
      sendReaction(token, phoneId, to, messageId, '\u{1F4CA}'),
      markAsRead(token, phoneId, messageId),
    ]);

    // Get buffered messages
    const messages = await getBufferedMessages(env.KV, chatId);

    if (messages.length === 0) {
      await sendTextMessage(
        token,
        phoneId,
        to,
        '*No messages buffered yet.*\n\nI need to see some conversation first before I can analyze it. Send some messages and try again.',
        messageId,
      );
      return;
    }

    // Show context preview
    const contextPreview = formatAnalyzeContext(messages, count);
    await sendTextMessage(token, phoneId, to, contextPreview, messageId);

    // Build context from buffered messages
    const recentMessages = messages.slice(-count);
    const context = recentMessages
      .map(m => `[${m.from}]: ${m.text}`)
      .join('\n');

    // Call DebateKit API with context
    const result = await consult(env.DEBATEKIT_API_URL, apiKey, question, {
      context: `Here is the conversation to analyze:\n\n${context}`,
      source: 'whatsapp',
    });

    // Send synthesis
    const synthesis = formatModeratorSynthesis(result, question);
    await sendTextMessage(token, phoneId, to, synthesis, messageId);

    // Send participant responses
    for (const [i, participant] of result.participants.entries()) {
      const formatted = formatParticipantResponse(participant, i);
      await sendTextMessage(token, phoneId, to, formatted, messageId);
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analyze command error:', errorMessage);

    await sendTextMessage(
      token,
      phoneId,
      to,
      formatError(errorMessage),
      messageId,
    );
  }
}
