/**
 * !consult Command
 *
 * Starts a debatekit brainstorm via the MCP REST API.
 * Also handles implicit consult (non-command DMs).
 *
 * Flow:
 *   1. React to message with brain emoji
 *   2. Mark as read
 *   3. Call DebateKit API: POST /api/v1/consult
 *   4. Send moderator synthesis as reply
 *   5. Send participant responses (truncated)
 */

import type { Env } from '../index';
import { consult } from '@debatekit/integration-shared';
import { formatError, formatModeratorSynthesis, formatParticipantResponse } from '../formatting/result-formatter';
import { markAsRead, sendReaction, sendTextMessage } from '../lib/whatsapp-client';

export async function handleConsult(
  env: Env,
  apiKey: string,
  to: string,
  messageId: string,
  prompt: string,
) {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneId } = env;

  try {
    // Step 1 & 2: React and mark as read
    await Promise.all([
      sendReaction(token, phoneId, to, messageId, '\u{1F9E0}'),
      markAsRead(token, phoneId, messageId),
    ]);

    // Step 3: Call DebateKit API
    const result = await consult(env.DEBATEKIT_API_URL, apiKey, prompt, { source: 'whatsapp' });

    // Step 4: Send moderator synthesis
    const synthesis = formatModeratorSynthesis(result, prompt);
    await sendTextMessage(token, phoneId, to, synthesis, messageId);

    // Step 5: Send participant responses (limit to avoid spam)
    for (const [i, participant] of result.participants.entries()) {
      const formatted = formatParticipantResponse(participant, i);
      await sendTextMessage(token, phoneId, to, formatted, messageId);
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Consult command error:', errorMessage);

    await sendTextMessage(
      token,
      phoneId,
      to,
      formatError(errorMessage),
      messageId,
    );
  }
}
