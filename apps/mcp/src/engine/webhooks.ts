/**
 * MCP Webhook Sender
 *
 * Fire-and-forget POST to user-specified webhook URLs.
 * 10-second timeout, no retries (best-effort delivery).
 */

import { ChatModeSchema, McpOutputFormatSchema, McpThinkingLevelSchema } from '@debatekit/shared/enums';
import { z } from 'zod';

// ============================================================================
// Webhook Payload Schema
// ============================================================================

const _WebhookPayloadSchema = z.object({
  metadata: z.object({
    duration_ms: z.number(),
    format: McpOutputFormatSchema,
    mode: ChatModeSchema,
    prompt_version: z.number().nullable().optional(),
    thinking_level: McpThinkingLevelSchema,
    total_credits_used: z.number(),
  }),
  moderator_summary: z.string(),
  tool_name: z.string(),
});
type WebhookPayload = z.infer<typeof _WebhookPayloadSchema>;

// ============================================================================
// Webhook Sender
// ============================================================================

export function sendWebhook(
  ctx: ExecutionContext,
  url: string,
  payload: WebhookPayload,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  ctx.waitUntil(
    fetch(url, {
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DebateKit-MCP-Webhook/1.0',
      },
      method: 'POST',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`[webhook] HTTP ${response.status} from ${url}`);
        }
        return undefined;
      })
      .catch((err) => {
        console.error(`[webhook] Failed to deliver to ${url}:`, err);
      })
      .finally(() => {
        clearTimeout(timeoutId);
      }),
  );
}
