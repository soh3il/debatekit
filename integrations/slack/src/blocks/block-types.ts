/**
 * Slack Block Kit Types
 *
 * Shared type definitions for Slack Block Kit elements.
 * Used by both home-blocks.ts and result-blocks.ts.
 */

export type SlackTextObject = {
  text: string;
  type: 'mrkdwn' | 'plain_text';
};

export type SlackInputElement = {
  action_id: string;
  initial_value?: string;
  placeholder: SlackTextObject;
  type: 'plain_text_input';
};

export type SlackBlock =
  | { type: 'actions'; elements: SlackBlock[] }
  | { type: 'button'; action_id: string; text: SlackTextObject; style?: 'danger' | 'primary' }
  | { type: 'button'; text: SlackTextObject; url: string }
  | { type: 'context'; elements: SlackTextObject[] }
  | { type: 'divider' }
  | { type: 'header'; text: SlackTextObject }
  | { type: 'input'; block_id: string; element: SlackInputElement; label: SlackTextObject }
  | { type: 'section'; text: SlackTextObject; accessory?: SlackBlock };

export type SlackModal = {
  blocks: SlackBlock[];
  callback_id: string;
  submit: SlackTextObject;
  title: SlackTextObject;
  type: 'modal';
};
