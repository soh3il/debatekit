/**
 * /debatekit-review Slash Command Handler
 *
 * Code review mode — calls the architect endpoint for architecture
 * reviews or review-code for code analysis.
 *
 * Detects whether input is code (contains backticks, braces, etc.)
 * and routes to the appropriate API endpoint.
 *
 * Flow:
 *   1. Post "Starting code review..." message
 *   2. Detect if input is code or architecture description
 *   3. Call DebateKit API: POST /api/v1/review-code or /api/v1/architect
 *   4. Post results as threaded messages
 */

import type { Env } from '../index';
import { architect, extractCode, looksLikeCode, reviewCode } from '@debatekit/integration-shared';
import { buildErrorBlocks, buildLoadingBlocks, buildResultBlocks } from '../blocks/result-blocks';
import { postMessage, respondToUrl, updateMessage } from '../lib/slack-client';

type ReviewCommandOptions = {
  channelId: string;
  env: Env;
  input: string;
  responseUrl?: string;
  userId: string;
};

export async function handleDebateKitReviewCommand(options: ReviewCommandOptions) {
  const { channelId, env, input, responseUrl } = options;
  const token = env.SLACK_BOT_TOKEN;
  const isCode = looksLikeCode(input);

  const toolLabel = isCode ? 'Code Review Council' : 'Architecture Council';

  try {
    // Step 1: Post loading message
    const loadingBlocks = buildLoadingBlocks(input, toolLabel);
    const loadingMsg = await postMessage(token, {
      blocks: loadingBlocks,
      channel: channelId,
      text: `Starting DebateKit ${isCode ? 'code review' : 'architecture review'}...`,
    });

    const parentTs = loadingMsg.ts;

    // Step 2: Call appropriate API
    const result = isCode
      ? await reviewCode(env.DEBATEKIT_API_URL, env.DEBATEKIT_API_KEY, extractCode(input), {
          focus: ['security', 'performance', 'maintainability'],
          source: 'slack',
        })
      : await architect(env.DEBATEKIT_API_URL, env.DEBATEKIT_API_KEY, input, {
          scale: 'startup',
          source: 'slack',
        });

    // Step 3: Update loading message with results
    const resultBlocks = buildResultBlocks(result, {
      appUrl: env.DEBATEKIT_APP_URL,
      prompt: input,
      toolLabel,
    });

    await updateMessage(token, {
      blocks: resultBlocks,
      channel: channelId,
      text: `DebateKit ${toolLabel}: ${input.slice(0, 100)}`,
      ts: parentTs,
    });

    // Step 4: Post participant responses as thread replies
    for (const [i, participant] of result.participants.entries()) {
      const name = participant.model_name || participant.model_id.split('/').pop() || 'Reviewer';
      const roleLabel = participant.role ? ` -- ${participant.role}` : '';
      const header = `*${i + 1}. ${name}*${roleLabel}`;

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
    console.error('DebateKit review error:', errorMessage);

    const errorBlocks = buildErrorBlocks(errorMessage, input);

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
        text: `DebateKit review error: ${errorMessage}`,
      });
    }
  }
}
