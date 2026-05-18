/**
 * !review Command
 *
 * Code review or architecture review via the MCP REST API.
 * Detects whether input is code or architecture description
 * and routes to the appropriate endpoint.
 *
 * Flow:
 *   1. React to message with magnifying glass emoji
 *   2. Detect if input is code or architecture description
 *   3. Call DebateKit API: POST /api/v1/review-code or /api/v1/architect
 *   4. Send results as reply messages
 */

import type { Env } from '../index';
import { architect, extractCode, looksLikeCode, reviewCode } from '@debatekit/integration-shared';
import { formatError, formatModeratorSynthesis, formatParticipantResponse } from '../formatting/result-formatter';
import { markAsRead, sendReaction, sendTextMessage } from '../lib/whatsapp-client';

export async function handleReview(
  env: Env,
  apiKey: string,
  to: string,
  messageId: string,
  input: string,
) {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneId } = env;
  const isCode = looksLikeCode(input);

  try {
    // Step 1: React and mark as read
    await Promise.all([
      sendReaction(token, phoneId, to, messageId, '\u{1F50D}'),
      markAsRead(token, phoneId, messageId),
    ]);

    // Step 2: Call appropriate API
    const result = isCode
      ? await reviewCode(env.DEBATEKIT_API_URL, apiKey, extractCode(input), {
          focus: ['security', 'performance', 'maintainability'],
          source: 'whatsapp',
        })
      : await architect(env.DEBATEKIT_API_URL, apiKey, input, {
          scale: 'startup',
          source: 'whatsapp',
        });

    // Step 3: Send moderator synthesis
    const synthesis = formatModeratorSynthesis(result, input);
    await sendTextMessage(token, phoneId, to, synthesis, messageId);

    // Step 4: Send participant responses
    for (const [i, participant] of result.participants.entries()) {
      const formatted = formatParticipantResponse(participant, i);
      await sendTextMessage(token, phoneId, to, formatted, messageId);
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Review command error:', errorMessage);

    await sendTextMessage(
      token,
      phoneId,
      to,
      formatError(errorMessage),
      messageId,
    );
  }
}
