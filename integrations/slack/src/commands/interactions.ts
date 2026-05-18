/**
 * Interactive Component Handler
 *
 * Handles button clicks, modal submissions, and other interactive
 * components from Slack's Block Kit.
 *
 * Currently supports:
 *   - block_actions: Button clicks (e.g., "View in DebateKit")
 *   - view_submission: Modal form submissions (future)
 */

import { z } from 'zod';

import type { Env } from '../index';

const SlackInteractionPayloadSchema = z.object({
  actions: z.array(z.object({
    action_id: z.string(),
    block_id: z.string(),
    type: z.string(),
    value: z.string().optional(),
  })).optional(),
  channel: z.object({ id: z.string() }).optional(),
  message: z.object({ ts: z.string() }).optional(),
  response_url: z.string().optional(),
  type: z.string(),
  user: z.object({ id: z.string() }),
});

export type SlackInteractionPayload = z.infer<typeof SlackInteractionPayloadSchema>;

export async function handleInteraction(
  payload: SlackInteractionPayload,
  _env: Env,
) {
  switch (payload.type) {
    case 'block_actions': {
      // Button clicks are handled client-side by Slack (url buttons open links).
      // This handler is for custom action_id buttons that need server-side logic.
      for (const action of payload.actions ?? []) {
        console.log(`Interactive action: ${action.action_id}`, {
          blockId: action.block_id,
          userId: payload.user.id,
        });
      }
      break;
    }

    case 'view_submission': {
      console.log('Modal submission from user:', payload.user.id);
      break;
    }

    default:
      console.log('Unknown interaction type:', payload.type);
  }
}
