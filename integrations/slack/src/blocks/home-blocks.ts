/**
 * App Home Tab Blocks
 *
 * Renders the DebateKit App Home tab with:
 *   - Welcome message and product description
 *   - API key configuration status
 *   - Setup button (opens modal to enter API key)
 *   - Usage instructions
 */

import type { SlackBlock, SlackModal } from './block-types';

function headerBlock(text: string): SlackBlock {
  return {
    text: { text, type: 'plain_text' },
    type: 'header',
  };
}

function sectionBlock(markdown: string, accessory?: SlackBlock): SlackBlock {
  return {
    text: { text: markdown, type: 'mrkdwn' },
    type: 'section',
    ...(accessory ? { accessory } : {}),
  };
}

function dividerBlock(): SlackBlock {
  return { type: 'divider' };
}

function actionsBlock(elements: SlackBlock[]): SlackBlock {
  return { elements, type: 'actions' };
}

function button(text: string, actionId: string, style?: 'danger' | 'primary'): SlackBlock {
  return {
    action_id: actionId,
    text: { text, type: 'plain_text' },
    type: 'button',
    ...(style ? { style } : {}),
  };
}

function contextBlock(elements: string[]): SlackBlock {
  return {
    elements: elements.map(text => ({ text, type: 'mrkdwn' as const })),
    type: 'context',
  };
}

// ---------------------------------------------------------------------------
// Home view
// ---------------------------------------------------------------------------

export function buildHomeView(options: {
  hasApiKey: boolean;
  isAdmin?: boolean;
  maskedKey?: string;
}): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Welcome header
  blocks.push(headerBlock('Welcome to DebateKit'));
  blocks.push(sectionBlock(
    'Your AI Board of Directors — multi-model AI brainstorming directly in Slack.\n\n'
    + 'DebateKit consults GPT-4o, Claude, Gemini, and 200+ models on your questions. '
    + 'Each model shares its perspective, then a moderator synthesizes everything into actionable insight.',
  ));

  blocks.push(dividerBlock());

  // API key status
  blocks.push(headerBlock('Setup'));

  if (options.hasApiKey) {
    blocks.push(sectionBlock(
      `:white_check_mark: *API Key Configured*\nKey: \`${options.maskedKey ?? '••••••'}\`\n\nDebateKit is ready to use in this workspace.`,
    ));
    blocks.push(actionsBlock([
      button('Update API Key', 'configure_api_key'),
      button('Remove API Key', 'remove_api_key', 'danger'),
    ]));
  }
  else {
    blocks.push(sectionBlock(
      ':warning: *API Key Required*\n\n'
      + 'To use DebateKit, a workspace admin needs to connect a DebateKit API key.\n\n'
      + '1. Sign up at <https://debatekit.com|debatekit.com>\n'
      + '2. Go to *Settings → API Keys*\n'
      + '3. Generate a new key (starts with `rpnd_`)\n'
      + '4. Click the button below to enter it',
    ));
    blocks.push(actionsBlock([
      button('Configure API Key', 'configure_api_key', 'primary'),
    ]));
  }

  blocks.push(dividerBlock());

  // Commands reference
  blocks.push(headerBlock('Commands'));
  blocks.push(sectionBlock(
    '*`/debatekit [question]`*\n'
    + 'Consult the AI council on any question. Multiple models discuss, then synthesize.\n\n'
    + '*`/debatekit-review [code or description]`*\n'
    + 'Get expert code reviews or architecture assessments. Auto-detects code vs. descriptions.\n\n'
    + '*`@DebateKit [question]`*\n'
    + 'Mention the bot in any channel to start a discussion.\n\n'
    + '*Direct Message*\n'
    + 'DM the bot directly for private brainstorming.',
  ));

  blocks.push(dividerBlock());

  // Footer
  blocks.push(contextBlock([
    '<https://debatekit.com|debatekit.com> · Powered by 200+ AI models',
  ]));

  return blocks;
}

// ---------------------------------------------------------------------------
// API Key modal
// ---------------------------------------------------------------------------

export function buildApiKeyModal(currentKey?: string): SlackModal {
  return {
    callback_id: 'api_key_modal',
    submit: { text: 'Save', type: 'plain_text' },
    title: { text: 'Configure API Key', type: 'plain_text' },
    type: 'modal',
    blocks: [
      sectionBlock(
        'Enter your DebateKit API key. Get one at <https://debatekit.com/chat/settings/api-keys|debatekit.com/chat/settings/api-keys>.',
      ),
      {
        block_id: 'api_key_block',
        element: {
          action_id: 'api_key_input',
          ...(currentKey ? { initial_value: currentKey } : {}),
          placeholder: { text: 'rpnd_...', type: 'plain_text' },
          type: 'plain_text_input' as const,
        },
        label: { text: 'API Key', type: 'plain_text' as const },
        type: 'input' as const,
      },
    ],
  };
}

