/**
 * /debatekit Slash Command Handler
 *
 * Starts a debatekit brainstorm via the MCP REST API.
 * Posts results back to Slack as a threaded message with Block Kit formatting.
 *
 * Flow:
 *   1. Post "Starting brainstorm..." message to channel
 *   2. Call DebateKit API: POST /api/v1/consult
 *   3. Update original message with moderator synthesis
 *   4. Post each participant response as a threaded reply
 */

import type { Env } from '../index';
import { buildErrorBlocks, buildLoadingBlocks, buildResultBlocks } from '../blocks/result-blocks';
import { consult } from '@debatekit/integration-shared';
import { postMessage, respondToUrl, updateMessage } from '../lib/slack-client';

type DebateKitCommandOptions = {
  channelId: string;
  env: Env;
  prompt: string;
  /** Slack response_url for slash command follow-ups */
  responseUrl?: string;
  /** Thread timestamp to reply in (for app_mention events) */
  threadTs?: string;
  userId: string;
};

export async function handleDebateKitCommand(options: DebateKitCommandOptions) {
  const { channelId, env, prompt, responseUrl, threadTs, userId } = options;
  const token = env.SLACK_BOT_TOKEN;

  try {
    // Step 1: Post loading message
    const loadingBlocks = buildLoadingBlocks(prompt, 'Council Discussion');
    const loadingMsg = await postMessage(token, {
      blocks: loadingBlocks,
      channel: channelId,
      text: `Starting DebateKit brainstorm: ${prompt}`,
      thread_ts: threadTs,
    });

    const parentTs = loadingMsg.ts;

    // Step 2: Call DebateKit API
    const result = await consult(env.DEBATEKIT_API_URL, env.DEBATEKIT_API_KEY, prompt, { source: 'slack' });

    // Step 3: Update loading message with full results
    const resultBlocks = buildResultBlocks(result, {
      appUrl: env.DEBATEKIT_APP_URL,
      prompt,
      toolLabel: 'Council Discussion',
    });

    await updateMessage(token, {
      blocks: resultBlocks,
      channel: channelId,
      text: `DebateKit: ${prompt}`,
      ts: parentTs,
    });

    // Step 4: Post each participant as a threaded reply
    for (const [i, participant] of result.participants.entries()) {
      const name = participant.model_name || participant.model_id.split('/').pop() || 'Participant';
      const roleLabel = participant.role ? ` -- ${participant.role}` : '';
      const header = `*${i + 1}. ${name}*${roleLabel}`;

      // Truncate long responses for Slack (4000 char limit per message)
      const response = participant.response.length > 3500
        ? `${participant.response.slice(0, 3500)}\n\n_... response truncated. View full discussion in DebateKit._`
        : participant.response;

      await postMessage(token, {
        channel: channelId,
        text: `${header}\n\n${response}`,
        thread_ts: parentTs,
        unfurl_links: false,
      });
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('DebateKit command error:', errorMessage);

    const errorBlocks = buildErrorBlocks(errorMessage, prompt);

    // Try to respond via response_url (slash commands) or post to channel
    if (responseUrl) {
      await respondToUrl(responseUrl, {
        blocks: errorBlocks,
        replace_original: true,
        text: `Error: ${errorMessage}`,
      });
    }
    else {
      await postMessage(token, {
        blocks: errorBlocks,
        channel: channelId,
        text: `DebateKit error: ${errorMessage}`,
        thread_ts: threadTs,
      });
    }
  }
}
