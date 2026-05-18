/**
 * Block Kit Builder for DebateKit Results
 *
 * Formats debate/consult results as Slack Block Kit JSON.
 * Reference: https://api.slack.com/reference/block-kit/blocks
 *
 * Structure:
 *   - Header block with debatekit title
 *   - Section block for moderator synthesis
 *   - Divider
 *   - Section blocks for each participant (model name bold, role as context)
 *   - Actions block with "View in DebateKit" button
 */

import type { ConsultResponse, ParticipantResponse } from '@debatekit/integration-shared';

import type { SlackBlock } from './block-types';

// Slack limits block text to 3000 chars
const MAX_TEXT_LENGTH = 2900;

function truncate(text: string, max = MAX_TEXT_LENGTH): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

// ---------------------------------------------------------------------------
// Local model name extraction for Slack display formatting
// ---------------------------------------------------------------------------

function extractModelName(modelId: string): string {
  // "openai/gpt-4o" → "GPT-4o", "anthropic/claude-3.5-sonnet" → "Claude 3.5 Sonnet"
  const name = modelId.split('/').pop() ?? modelId;
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

function headerBlock(text: string): SlackBlock {
  return {
    text: { text: truncate(text, 150), type: 'plain_text' },
    type: 'header',
  };
}

function sectionBlock(markdown: string): SlackBlock {
  return {
    text: { text: truncate(markdown), type: 'mrkdwn' },
    type: 'section',
  };
}

function contextBlock(elements: string[]): SlackBlock {
  return {
    elements: elements.map(text => ({ text, type: 'mrkdwn' })),
    type: 'context',
  };
}

function dividerBlock(): SlackBlock {
  return { type: 'divider' };
}

function actionsBlock(buttons: SlackBlock[]): SlackBlock {
  return {
    elements: buttons,
    type: 'actions',
  };
}

function linkButton(text: string, url: string): SlackBlock {
  return {
    text: { text, type: 'plain_text' },
    type: 'button',
    url,
  };
}

// ---------------------------------------------------------------------------
// Participant block
// ---------------------------------------------------------------------------

function participantBlock(participant: ParticipantResponse, index: number): SlackBlock[] {
  const name = participant.model_name || extractModelName(participant.model_id);
  const roleLabel = participant.role ? ` -- _${participant.role}_` : '';
  const header = `*${index + 1}. ${name}*${roleLabel}`;

  return [
    sectionBlock(`${header}\n\n${truncate(participant.response)}`),
  ];
}

// ---------------------------------------------------------------------------
// Full result blocks
// ---------------------------------------------------------------------------

export function buildResultBlocks(
  result: ConsultResponse,
  options: {
    appUrl: string;
    prompt: string;
    toolLabel?: string;
  },
): SlackBlock[] {
  const { moderator, participants, metadata, threadSlug } = result;
  const toolLabel = options.toolLabel ?? 'Council Discussion';
  const moderatorName = moderator.model_id
    ? extractModelName(moderator.model_id)
    : 'Moderator';

  const blocks: SlackBlock[] = [];

  // Header
  blocks.push(headerBlock(`DebateKit: ${toolLabel}`));

  // Prompt context
  blocks.push(contextBlock([
    `Asked: _${truncate(options.prompt, 200)}_`,
  ]));

  blocks.push(dividerBlock());

  // Moderator synthesis
  blocks.push(sectionBlock(
    `:brain: *Synthesis* (_${moderatorName}_)\n\n${truncate(moderator.summary)}`,
  ));

  blocks.push(dividerBlock());

  // Participant responses
  for (const [i, participant] of participants.entries()) {
    blocks.push(...participantBlock(participant, i));
    if (i < participants.length - 1) {
      blocks.push(dividerBlock());
    }
  }

  blocks.push(dividerBlock());

  // Metadata footer
  const durationSec = (metadata.duration_ms / 1000).toFixed(1);
  blocks.push(contextBlock([
    `:stopwatch: ${durationSec}s`,
    `:busts_in_silhouette: ${participants.length} participants`,
    `:zap: ${metadata.thinking_level} thinking`,
    `:bar_chart: ${metadata.total_credits_used} credits`,
  ]));

  // Action buttons
  const actionButtons: SlackBlock[] = [];

  if (threadSlug) {
    const threadUrl = `${options.appUrl}/chat/${threadSlug}`;
    actionButtons.push(linkButton('View in DebateKit', threadUrl));
  }

  if (actionButtons.length > 0) {
    blocks.push(actionsBlock(actionButtons));
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Error block
// ---------------------------------------------------------------------------

export function buildErrorBlocks(error: string, prompt: string): SlackBlock[] {
  return [
    headerBlock('DebateKit: Error'),
    sectionBlock(`:warning: Something went wrong while processing your request.\n\n> ${truncate(prompt, 200)}\n\n\`${truncate(error, 500)}\``),
    contextBlock(['Try again or check your DebateKit API key configuration.']),
  ];
}

// ---------------------------------------------------------------------------
// Loading block (for initial response before results)
// ---------------------------------------------------------------------------

export function buildLoadingBlocks(prompt: string, toolLabel?: string): SlackBlock[] {
  const label = toolLabel ?? 'Council Discussion';
  return [
    headerBlock(`DebateKit: ${label}`),
    sectionBlock(`:hourglass_flowing_sand: *Processing your request...*\n\n> ${truncate(prompt, 200)}\n\nMultiple AI models are discussing your question. This usually takes 15-60 seconds.`),
  ];
}
