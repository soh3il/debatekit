/**
 * DebateKit WhatsApp Bot — Cloudflare Worker
 *
 * Hono-based worker that handles WhatsApp Cloud API webhooks.
 * Supports both DMs and groups with !command-based interaction.
 * Requires API key authentication via !setkey.
 *
 * Routes:
 *   GET  /whatsapp/webhook  — Meta webhook verification challenge
 *   POST /whatsapp/webhook  — Incoming message webhook handler
 *   GET  /health            — Health check
 *   GET  /                  — Landing page with wa.me link
 */

import { Hono } from 'hono';
import { z } from 'zod';

import { handleAnalyze } from './commands/analyze';
import { handleConsult } from './commands/consult';
import { handleHelp } from './commands/help';
import { handleReview } from './commands/review';
import { handleSetKey } from './commands/setkey';
import { bufferMessage, getApiKey, isDuplicate } from './lib/chat-store';
import { verifySignature, verifyWebhookChallenge } from './lib/verify';
import { sendTextMessage } from './lib/whatsapp-client';

// ---------------------------------------------------------------------------
// Env bindings
// ---------------------------------------------------------------------------

export type Env = {
  KV: KVNamespace;
  /** Fallback API key (used when chat hasn't configured their own) */
  DEBATEKIT_API_KEY: string;
  DEBATEKIT_API_URL: string;
  DEBATEKIT_APP_URL: string;
  /** WhatsApp Cloud API system user access token */
  WHATSAPP_ACCESS_TOKEN: string;
  /** WhatsApp app secret for webhook signature verification */
  WHATSAPP_APP_SECRET: string;
  /** WhatsApp Business phone number ID */
  WHATSAPP_PHONE_NUMBER_ID: string;
  /** Token for webhook subscription verification */
  WHATSAPP_VERIFY_TOKEN: string;
};

// ---------------------------------------------------------------------------
// WhatsApp webhook payload schemas (Zod-validated external data)
// ---------------------------------------------------------------------------

const WhatsAppMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  text: z.object({ body: z.string() }).optional(),
  timestamp: z.string(),
  type: z.string(),
});
type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;

const WhatsAppContactSchema = z.object({
  profile: z.object({ name: z.string() }),
  wa_id: z.string(),
});

const WhatsAppChangeSchema = z.object({
  field: z.string(),
  value: z.object({
    contacts: z.array(WhatsAppContactSchema).optional(),
    messages: z.array(WhatsAppMessageSchema).optional(),
    messaging_product: z.string(),
    metadata: z.object({
      display_phone_number: z.string(),
      phone_number_id: z.string(),
    }),
    statuses: z.array(z.object({
      id: z.string(),
      recipient_id: z.string(),
      status: z.string(),
      timestamp: z.string(),
    })).optional(),
  }),
});

const WhatsAppWebhookPayloadSchema = z.object({
  entry: z.array(z.object({
    changes: z.array(WhatsAppChangeSchema),
    id: z.string(),
  })),
  object: z.string(),
});

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

type ParsedCommand = {
  command: string;
  args: string;
};

function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('!')) return null;

  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) {
    return { command: trimmed.slice(1).toLowerCase(), args: '' };
  }

  return {
    command: trimmed.slice(1, spaceIndex).toLowerCase(),
    args: trimmed.slice(spaceIndex + 1),
  };
}

/**
 * Resolve the API key for a chat — per-chat key takes priority over env fallback.
 */
async function resolveApiKey(kv: KVNamespace, chatId: string, fallback: string): Promise<string | null> {
  const chatKey = await getApiKey(kv, chatId);
  if (chatKey) return chatKey;
  if (fallback) return fallback;
  return null;
}

/**
 * Determine the chat ID for storage purposes.
 * For DMs this is the sender's phone number.
 * For groups this could be extracted from metadata if available.
 */
function getChatId(message: WhatsAppMessage): string {
  return message.from;
}

/**
 * Check if this message is in a group context.
 * WhatsApp Cloud API delivers group messages with a group_id in context.
 */
function isGroupMessage(_message: WhatsAppMessage): boolean {
  // WhatsApp Cloud API currently delivers group messages
  // with additional context. For now, treat all as direct.
  // Group detection can be enhanced when group messaging is configured.
  return false;
}

// ---------------------------------------------------------------------------
// Process a single incoming message
// ---------------------------------------------------------------------------

async function processMessage(env: Env, message: WhatsAppMessage, contactName: string) {
  // Only handle text messages
  if (message.type !== 'text' || !message.text?.body) return;

  const text = message.text.body;
  const chatId = getChatId(message);
  const from = message.from;
  const messageId = message.id;
  const isGroup = isGroupMessage(message);

  // Buffer message for !analyze (all messages, including commands)
  await bufferMessage(env.KV, chatId, {
    from: contactName || from,
    text,
    timestamp: Number.parseInt(message.timestamp, 10) * 1000,
  });

  // Parse command
  const parsed = parseCommand(text);

  // Handle commands
  if (parsed) {
    switch (parsed.command) {
      case 'help': {
        await handleHelp(env, from, messageId);
        return;
      }
      case 'setkey': {
        await handleSetKey(env, chatId, from, messageId, parsed.args);
        return;
      }
      case 'consult': {
        if (!parsed.args.trim()) {
          await sendTextMessage(
            env.WHATSAPP_ACCESS_TOKEN,
            env.WHATSAPP_PHONE_NUMBER_ID,
            from,
            '*Usage:* !consult [your question]\n\nExample: !consult Should we use GraphQL or REST for our new API?',
            messageId,
          );
          return;
        }

        const apiKey = await resolveApiKey(env.KV, chatId, env.DEBATEKIT_API_KEY);
        if (!apiKey) {
          await sendTextMessage(
            env.WHATSAPP_ACCESS_TOKEN,
            env.WHATSAPP_PHONE_NUMBER_ID,
            from,
            `*API key required.*\n\nSet your key with:\n!setkey rpnd_your_key\n\nGet a key at ${env.DEBATEKIT_APP_URL}/chat/settings/api-keys`,
            messageId,
          );
          return;
        }

        await handleConsult(env, apiKey, from, messageId, parsed.args.trim());
        return;
      }
      case 'review': {
        if (!parsed.args.trim()) {
          await sendTextMessage(
            env.WHATSAPP_ACCESS_TOKEN,
            env.WHATSAPP_PHONE_NUMBER_ID,
            from,
            '*Usage:* !review [code or description]\n\nExample: !review Review our authentication middleware for security issues',
            messageId,
          );
          return;
        }

        const apiKey = await resolveApiKey(env.KV, chatId, env.DEBATEKIT_API_KEY);
        if (!apiKey) {
          await sendTextMessage(
            env.WHATSAPP_ACCESS_TOKEN,
            env.WHATSAPP_PHONE_NUMBER_ID,
            from,
            `*API key required.*\n\nSet your key with:\n!setkey rpnd_your_key\n\nGet a key at ${env.DEBATEKIT_APP_URL}/chat/settings/api-keys`,
            messageId,
          );
          return;
        }

        await handleReview(env, apiKey, from, messageId, parsed.args.trim());
        return;
      }
      case 'analyze': {
        const apiKey = await resolveApiKey(env.KV, chatId, env.DEBATEKIT_API_KEY);
        if (!apiKey) {
          await sendTextMessage(
            env.WHATSAPP_ACCESS_TOKEN,
            env.WHATSAPP_PHONE_NUMBER_ID,
            from,
            `*API key required.*\n\nSet your key with:\n!setkey rpnd_your_key\n\nGet a key at ${env.DEBATEKIT_APP_URL}/chat/settings/api-keys`,
            messageId,
          );
          return;
        }

        await handleAnalyze(env, apiKey, chatId, from, messageId, parsed.args);
        return;
      }
      default: {
        await sendTextMessage(
          env.WHATSAPP_ACCESS_TOKEN,
          env.WHATSAPP_PHONE_NUMBER_ID,
          from,
          `Unknown command: !${parsed.command}\n\nSend !help for available commands.`,
          messageId,
        );
        return;
      }
    }
  }

  // Non-command messages in DMs → implicit !consult
  if (!isGroup) {
    const apiKey = await resolveApiKey(env.KV, chatId, env.DEBATEKIT_API_KEY);
    if (!apiKey) {
      await sendTextMessage(
        env.WHATSAPP_ACCESS_TOKEN,
        env.WHATSAPP_PHONE_NUMBER_ID,
        from,
        `*Welcome to DebateKit!*\n\nTo get started, set your API key:\n!setkey rpnd_your_key\n\nGet a key at ${env.DEBATEKIT_APP_URL}/chat/settings/api-keys\n\nSend !help for all commands.`,
        messageId,
      );
      return;
    }

    await handleConsult(env, apiKey, from, messageId, text.trim());
  }

  // Non-command messages in groups → buffer only (no response)
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>();

// Error handling
app.onError((error, c) => {
  console.error('Unhandled error:', error.message);
  return c.json({ error: 'Internal server error' }, 500);
});

// Health check
app.get('/health', c => c.json({ ok: true, service: 'debatekit-whatsapp-bot', version: '1.0.0' }));

// ---------------------------------------------------------------------------
// Root page — landing with wa.me link
// ---------------------------------------------------------------------------

app.get('/', (c) => {
  const phoneNumberId = c.env.WHATSAPP_PHONE_NUMBER_ID;
  return c.html(
    `<html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>DebateKit for WhatsApp</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#fff}
      .card{background:#16213e;padding:3rem;border-radius:16px;text-align:center;max-width:520px}
      h1{margin:0 0 0.5rem;font-size:2rem}
      .subtitle{color:#a0a0b0;margin-bottom:2rem;line-height:1.6}
      .btn{display:inline-block;background:#25D366;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1.1rem;transition:background 0.2s}
      .btn:hover{background:#1da851}
      .features{text-align:left;margin:2rem 0;color:#c0c0d0;line-height:1.8}
      .footer{color:#606080;margin-top:2rem;font-size:0.85rem}
      .footer a{color:#25D366;text-decoration:none}</style></head>
      <body><div class="card">
        <h1>DebateKit</h1>
        <p class="subtitle">Your AI Board of Directors — multi-model brainstorming in WhatsApp</p>
        <a href="https://wa.me/${phoneNumberId}?text=!help" class="btn">Chat on WhatsApp</a>
        <div class="features">
          <strong>What you get:</strong><br>
          &#8226; <code>!consult</code> — Consult GPT-4o, Claude, Gemini &amp; 200+ models<br>
          &#8226; <code>!review</code> — Expert code reviews &amp; architecture assessments<br>
          &#8226; <code>!analyze</code> — Analyze recent conversation messages<br>
          &#8226; Direct messages — Just type your question, no command needed
        </div>
        <div class="footer"><a href="${c.env.DEBATEKIT_APP_URL}">debatekit.com</a> &middot; <a href="${c.env.DEBATEKIT_APP_URL}/chat/settings/api-keys">Get API Key</a></div>
      </div></body></html>`,
  );
});

// ---------------------------------------------------------------------------
// WhatsApp Webhook — GET verification
// ---------------------------------------------------------------------------

app.get('/whatsapp/webhook', (c) => {
  const query = {
    'hub.challenge': c.req.query('hub.challenge'),
    'hub.mode': c.req.query('hub.mode'),
    'hub.verify_token': c.req.query('hub.verify_token'),
  };

  const result = verifyWebhookChallenge(query, c.env.WHATSAPP_VERIFY_TOKEN);

  if (!result.ok) {
    console.error('Webhook verification failed:', result.error);
    return c.text('Forbidden', 403);
  }

  // Meta expects the challenge echoed back as plain text
  return c.text(result.challenge);
});

// ---------------------------------------------------------------------------
// WhatsApp Webhook — POST message handler
// ---------------------------------------------------------------------------

app.post('/whatsapp/webhook', async (c) => {
  const rawBody = await c.req.text();

  // Verify signature
  const signature = c.req.header('x-hub-signature-256') ?? null;
  if (!await verifySignature(rawBody, signature, c.env.WHATSAPP_APP_SECRET)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawBody);
  }
  catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const parseResult = WhatsAppWebhookPayloadSchema.safeParse(rawJson);
  if (!parseResult.success) {
    return c.json({ error: 'Invalid webhook payload' }, 400);
  }

  const payload = parseResult.data;

  // Only process WhatsApp messages
  if (payload.object !== 'whatsapp_business_account') {
    return c.json({ ok: true });
  }

  // Process each entry and change
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const { messages, contacts } = change.value;
      if (!messages || messages.length === 0) continue;

      for (const message of messages) {
        // Deduplicate — Meta can send the same webhook multiple times
        const duplicate = await isDuplicate(c.env.KV, message.id);
        if (duplicate) continue;

        // Resolve contact name
        const contact = contacts?.find(ct => ct.wa_id === message.from);
        const contactName = contact?.profile?.name ?? message.from;

        // Process in background to respond quickly
        c.executionCtx.waitUntil(
          processMessage(c.env, message, contactName),
        );
      }
    }
  }

  // Always return 200 quickly to acknowledge receipt
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default app;
