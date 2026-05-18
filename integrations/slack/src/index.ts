/**
 * DebateKit Slack Bot — Cloudflare Worker
 *
 * Multi-tenant Hono-based worker that handles Slack OAuth installation,
 * events, slash commands, App Home, and interactive components.
 * Calls DebateKit's MCP REST API per workspace using team-scoped tokens.
 *
 * Routes:
 *   GET  /slack/install         — Redirect to Slack OAuth authorization
 *   GET  /slack/oauth/callback  — Handle OAuth code exchange, store team tokens
 *   POST /slack/events          — Slack Events API (url_verification + event callbacks)
 *   POST /slack/commands        — Slash command handler (/debatekit, /debatekit-review)
 *   POST /slack/interactions    — Interactive component handler (buttons, modals)
 *   GET  /health                — Health check
 */

import { Hono } from 'hono';
import { z } from 'zod';

import { buildApiKeyModal, buildHomeView } from './blocks/home-blocks';
import { handleInteraction, type SlackInteractionPayload } from './commands/interactions';
import { handleDebateKitCommand } from './commands/debatekit';
import { handleDebateKitReviewCommand } from './commands/debatekit-review';
import { getBotToken, getApiKey, hasApiKey, saveInstallation, setApiKey } from './lib/team-store';
import { verifySlackRequest } from './lib/verify';

// ---------------------------------------------------------------------------
// Env bindings
// ---------------------------------------------------------------------------

export type Env = {
  KV: KVNamespace;
  /** Fallback API key (used when workspace hasn't configured their own) */
  DEBATEKIT_API_KEY: string;
  DEBATEKIT_API_URL: string;
  DEBATEKIT_APP_URL: string;
  /** OAuth client ID (from Slack app settings) */
  SLACK_CLIENT_ID: string;
  /** OAuth client secret (from Slack app settings) */
  SLACK_CLIENT_SECRET: string;
  /** Fallback bot token (for backward compat with single-tenant setup) */
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
};

// ---------------------------------------------------------------------------
// Multi-tenant token resolution
// ---------------------------------------------------------------------------

async function resolveTokens(env: Env, teamId: string | undefined) {
  if (teamId) {
    const [botToken, apiKey] = await Promise.all([
      getBotToken(env.KV, teamId),
      getApiKey(env.KV, teamId),
    ]);
    return {
      botToken: botToken ?? env.SLACK_BOT_TOKEN,
      apiKey: apiKey ?? env.DEBATEKIT_API_KEY,
    };
  }
  return {
    botToken: env.SLACK_BOT_TOKEN,
    apiKey: env.DEBATEKIT_API_KEY,
  };
}

/**
 * Build an Env overlay with resolved per-team tokens.
 * Lets existing command handlers work unchanged.
 */
async function envForTeam(env: Env, teamId: string | undefined): Promise<Env> {
  const tokens = await resolveTokens(env, teamId);
  return {
    ...env,
    DEBATEKIT_API_KEY: tokens.apiKey,
    SLACK_BOT_TOKEN: tokens.botToken,
  };
}

// ---------------------------------------------------------------------------
// Slack AI Assistant helpers
// ---------------------------------------------------------------------------

async function setAssistantStatus(token: string, channelId: string, threadTs: string) {
  try {
    await fetch('https://slack.com/api/assistant.threads.setStatus', {
      body: JSON.stringify({ channel_id: channelId, status: 'DebateKit is thinking...', thread_ts: threadTs }),
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      method: 'POST',
    });

    await fetch('https://slack.com/api/assistant.threads.setSuggestedPrompts', {
      body: JSON.stringify({
        channel_id: channelId,
        prompts: [
          { message: 'Should we use GraphQL or REST for our new API?', title: 'Architecture Decision' },
          { message: 'Review our authentication flow for security vulnerabilities', title: 'Security Review' },
          { message: 'Brainstorm approaches for improving our CI/CD pipeline', title: 'Brainstorm Ideas' },
        ],
        thread_ts: threadTs,
      }),
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      method: 'POST',
    });
  }
  catch (error) {
    console.error('Failed to set assistant status:', error);
  }
}

// ---------------------------------------------------------------------------
// Publish App Home tab
// ---------------------------------------------------------------------------

async function publishHomeTab(token: string, kv: KVNamespace, userId: string, teamId: string) {
  const configured = await hasApiKey(kv, teamId);
  let maskedKey: string | undefined;
  if (configured) {
    const key = await getApiKey(kv, teamId);
    if (key) {
      maskedKey = `${key.slice(0, 8)}...${key.slice(-4)}`;
    }
  }

  const blocks = buildHomeView({ hasApiKey: configured, maskedKey });

  await fetch('https://slack.com/api/views.publish', {
    body: JSON.stringify({ user_id: userId, view: { blocks, type: 'home' } }),
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });
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
app.get('/health', c => c.json({ ok: true, service: 'debatekit-slack-bot', version: '1.0.0' }));

// ---------------------------------------------------------------------------
// OAuth Installation Flow
// ---------------------------------------------------------------------------

app.get('/slack/install', (c) => {
  const clientId = c.env.SLACK_CLIENT_ID;
  const scopes = 'assistant:write,chat:write,chat:write.public,commands,app_mentions:read,im:history';
  const redirectUri = `${new URL(c.req.url).origin}/slack/oauth/callback`;

  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('redirect_uri', redirectUri);

  return c.redirect(url.toString());
});

app.get('/slack/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    return c.html(`<html><body><h1>Installation Cancelled</h1><p>${error}</p><p><a href="/slack/install">Try again</a></p></body></html>`);
  }

  if (!code) {
    return c.html('<html><body><h1>Error</h1><p>No authorization code received.</p></body></html>', 400);
  }

  const redirectUri = `${new URL(c.req.url).origin}/slack/oauth/callback`;

  // Exchange code for access token
  const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
    body: new URLSearchParams({
      client_id: c.env.SLACK_CLIENT_ID,
      client_secret: c.env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  const rawTokenJson: unknown = await tokenResponse.json();

  const OAuthResponseSchema = z.object({
    access_token: z.string().optional(),
    authed_user: z.object({ id: z.string() }).optional(),
    error: z.string().optional(),
    ok: z.boolean(),
    team: z.object({ id: z.string(), name: z.string() }).optional(),
  });

  const tokenParse = OAuthResponseSchema.safeParse(rawTokenJson);

  if (!tokenParse.success) {
    console.error('OAuth response parse error:', tokenParse.error.message);
    return c.html('<html><body><h1>Installation Failed</h1><p>Invalid OAuth response</p><p><a href="/slack/install">Try again</a></p></body></html>', 400);
  }

  const tokenData = tokenParse.data;

  if (!tokenData.ok || !tokenData.access_token || !tokenData.team) {
    console.error('OAuth error:', tokenData.error);
    return c.html(`<html><body><h1>Installation Failed</h1><p>${tokenData.error ?? 'Unknown error'}</p><p><a href="/slack/install">Try again</a></p></body></html>`, 400);
  }

  // Store team installation in KV
  await saveInstallation(c.env.KV, {
    botToken: tokenData.access_token,
    installedAt: new Date().toISOString(),
    installedBy: tokenData.authed_user?.id ?? 'unknown',
    teamId: tokenData.team.id,
    teamName: tokenData.team.name,
  });

  console.log(`Installed for team ${tokenData.team.name} (${tokenData.team.id})`);

  return c.html(
    `<html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#fff}
      .card{background:#16213e;padding:3rem;border-radius:16px;text-align:center;max-width:480px}
      h1{margin:0 0 1rem}p{color:#a0a0b0;line-height:1.6}
      a{color:#6c63ff;text-decoration:none}a:hover{text-decoration:underline}
      .check{font-size:3rem;margin-bottom:1rem}</style></head>
      <body><div class="card">
        <div class="check">&#10003;</div>
        <h1>DebateKit Installed!</h1>
        <p>DebateKit has been added to <strong>${tokenData.team.name}</strong>.</p>
        <p>Next step: Open the <strong>DebateKit</strong> app in Slack and configure your API key in the <strong>Home</strong> tab.</p>
        <p><a href="https://debatekit.ai/chat/settings/api-keys">Get an API key &rarr;</a></p>
      </div></body></html>`,
  );
});

// ---------------------------------------------------------------------------
// Root page — install CTA
// ---------------------------------------------------------------------------

app.get('/', (c) => {
  return c.html(
    `<html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>DebateKit for Slack</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#fff}
      .card{background:#16213e;padding:3rem;border-radius:16px;text-align:center;max-width:520px}
      h1{margin:0 0 0.5rem;font-size:2rem}
      .subtitle{color:#a0a0b0;margin-bottom:2rem;line-height:1.6}
      .btn{display:inline-block;background:#6c63ff;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1.1rem;transition:background 0.2s}
      .btn:hover{background:#5a52d5}
      .features{text-align:left;margin:2rem 0;color:#c0c0d0;line-height:1.8}
      .footer{color:#606080;margin-top:2rem;font-size:0.85rem}
      .footer a{color:#6c63ff;text-decoration:none}</style></head>
      <body><div class="card">
        <h1>DebateKit</h1>
        <p class="subtitle">Your AI Board of Directors — multi-model brainstorming in Slack</p>
        <a href="/slack/install" class="btn">Add to Slack</a>
        <div class="features">
          <strong>What you get:</strong><br>
          &#8226; <code>/debatekit</code> — Consult GPT-4o, Claude, Gemini &amp; 200+ models<br>
          &#8226; <code>/debatekit-review</code> — Expert code reviews &amp; architecture assessments<br>
          &#8226; <code>@DebateKit</code> — Mention in any channel for instant brainstorming<br>
          &#8226; Direct Messages — Private AI council sessions
        </div>
        <div class="footer"><a href="https://debatekit.ai">debatekit.ai</a> &middot; <a href="https://debatekit.ai">Docs</a></div>
      </div></body></html>`,
  );
});

// ---------------------------------------------------------------------------
// Slack Events API — Payload schemas
// ---------------------------------------------------------------------------

const SlackEventSchema = z.object({
  assistant_thread: z.object({ channel_id: z.string().optional(), thread_ts: z.string().optional() }).optional(),
  bot_id: z.string().optional(),
  channel: z.string().optional(),
  channel_type: z.string().optional(),
  subtype: z.string().optional(),
  tab: z.string().optional(),
  text: z.string().optional(),
  thread_ts: z.string().optional(),
  ts: z.string().optional(),
  type: z.string().optional(),
  user: z.string().optional(),
});

type SlackEvent = z.infer<typeof SlackEventSchema>;

const SlackEventPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('url_verification'), challenge: z.string() }),
  z.object({ type: z.literal('event_callback'), event: SlackEventSchema.optional(), team_id: z.string().optional() }),
]);

type SlackEventPayload = z.infer<typeof SlackEventPayloadSchema>;

// ---------------------------------------------------------------------------
// Slack Events API
// ---------------------------------------------------------------------------

app.post('/slack/events', async (c) => {
  const rawBody = await c.req.text();

  if (!await verifySlackRequest(rawBody, c.req.raw.headers, c.env.SLACK_SIGNING_SECRET)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const parseResult = SlackEventPayloadSchema.safeParse((() => {
    try { return JSON.parse(rawBody); }
    catch { return null; }
  })());

  if (!parseResult.success) {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const body = parseResult.data;

  // Slack URL verification challenge
  if (body.type === 'url_verification') {
    return c.json({ challenge: body.challenge });
  }

  // Event callbacks
  if (body.type === 'event_callback') {
    const event = body.event;
    const teamId = body.team_id;

    // App Home opened — render the home tab
    if (event && event.type === 'app_home_opened' && event.tab === 'home') {
      const userId = event.user;
      if (teamId && userId) {
        c.executionCtx.waitUntil((async () => {
          const teamEnv = await envForTeam(c.env, teamId);
          await publishHomeTab(teamEnv.SLACK_BOT_TOKEN, c.env.KV, userId, teamId);
        })());
      }
    }

    // app_mention: respond when @DebateKit is mentioned
    if (event && event.type === 'app_mention') {
      const rawText = typeof event.text === 'string' ? event.text : '';
      const prompt = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();

      if (prompt && teamId) {
        c.executionCtx.waitUntil((async () => {
          const teamEnv = await envForTeam(c.env, teamId);
          await handleDebateKitCommand({
            channelId: event.channel ?? '',
            env: teamEnv,
            prompt,
            threadTs: event.ts ?? '',
            userId: event.user ?? '',
          });
        })());
      }
    }

    // Slack AI Assistant: thread started
    if (event && event.type === 'assistant_thread_started') {
      const threadContext = event.assistant_thread;
      const channelId = threadContext?.channel_id ?? '';
      const threadTs = threadContext?.thread_ts ?? '';

      if (channelId && threadTs && teamId) {
        c.executionCtx.waitUntil((async () => {
          const teamEnv = await envForTeam(c.env, teamId);
          await setAssistantStatus(teamEnv.SLACK_BOT_TOKEN, channelId, threadTs);
        })());
      }
    }

    // DM message — treat as brainstorm prompt
    if (event && event.type === 'message' && event.channel_type === 'im') {
      if (event.bot_id || event.subtype) {
        return c.json({ ok: true });
      }

      const prompt = typeof event.text === 'string' ? event.text.trim() : '';
      if (prompt && teamId) {
        c.executionCtx.waitUntil((async () => {
          const teamEnv = await envForTeam(c.env, teamId);
          await handleDebateKitCommand({
            channelId: event.channel ?? '',
            env: teamEnv,
            prompt,
            threadTs: event.thread_ts ?? event.ts ?? '',
            userId: event.user ?? '',
          });
        })());
      }
    }
  }

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Slash Commands
//
// Current:
//   /debatekit       → consult (general brainstorm)
//   /debatekit-review → architect | review-code (auto-detected)
//
// Future: /debatekit-debug, /debatekit-plan, /debatekit-tradeoffs
// See: POST /api/v1/debug, /api/v1/plan-implementation, /api/v1/assess-tradeoffs
// ---------------------------------------------------------------------------

app.post('/slack/commands', async (c) => {
  const rawBody = await c.req.text();

  if (!await verifySlackRequest(rawBody, c.req.raw.headers, c.env.SLACK_SIGNING_SECRET)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const params = new URLSearchParams(rawBody);
  const command = params.get('command') ?? '';
  const text = params.get('text') ?? '';
  const channelId = params.get('channel_id') ?? '';
  const userId = params.get('user_id') ?? '';
  const responseUrl = params.get('response_url') ?? '';
  const teamId = params.get('team_id') ?? undefined;

  // Resolve per-team env
  const teamEnv = await envForTeam(c.env, teamId);

  // Check if API key is configured
  if (teamId && !await hasApiKey(c.env.KV, teamId) && !c.env.DEBATEKIT_API_KEY) {
    return c.json({
      response_type: 'ephemeral',
      text: ':warning: DebateKit is not configured yet.\n\nA workspace admin needs to set up an API key. Open the *DebateKit* app Home tab to configure it.\n\nGet a key at <https://debatekit.ai/chat/settings/api-keys|debatekit.ai/chat/settings/api-keys>.',
    });
  }

  if (command === '/debatekit') {
    if (!text.trim()) {
      return c.json({
        response_type: 'ephemeral',
        text: 'Usage: `/debatekit [your question or topic]`\nExample: `/debatekit Should we use GraphQL or REST for our new API?`',
      });
    }

    c.executionCtx.waitUntil(
      handleDebateKitCommand({
        channelId,
        env: teamEnv,
        prompt: text.trim(),
        responseUrl,
        userId,
      }),
    );

    return c.json({
      response_type: 'in_channel',
      text: `:brain: Starting DebateKit brainstorm...\n> ${text.trim()}`,
    });
  }

  if (command === '/debatekit-review') {
    if (!text.trim()) {
      return c.json({
        response_type: 'ephemeral',
        text: 'Usage: `/debatekit-review [code or description]`\nExample: `/debatekit-review Review our authentication middleware for security issues`',
      });
    }

    c.executionCtx.waitUntil(
      handleDebateKitReviewCommand({
        channelId,
        env: teamEnv,
        input: text.trim(),
        responseUrl,
        userId,
      }),
    );

    return c.json({
      response_type: 'in_channel',
      text: `:mag: Starting DebateKit review...\n> ${text.trim().slice(0, 200)}${text.length > 200 ? '...' : ''}`,
    });
  }

  return c.json({
    response_type: 'ephemeral',
    text: `Unknown command: ${command}`,
  });
});

// ---------------------------------------------------------------------------
// Interactive Components (buttons, modals, App Home actions)
// ---------------------------------------------------------------------------

const SlackInteractivePayloadSchema = z.object({
  actions: z.array(z.object({
    action_id: z.string().optional(),
  })).optional(),
  team: z.object({ id: z.string().optional() }).optional(),
  trigger_id: z.string().optional(),
  type: z.string().optional(),
  user: z.object({
    id: z.string().optional(),
    team_id: z.string().optional(),
  }).optional(),
  view: z.object({
    callback_id: z.string().optional(),
    state: z.object({
      values: z.record(z.string(), z.record(z.string(), z.object({ value: z.string().optional() }))).optional(),
    }).optional(),
  }).optional(),
});

app.post('/slack/interactions', async (c) => {
  const rawBody = await c.req.text();

  if (!await verifySlackRequest(rawBody, c.req.raw.headers, c.env.SLACK_SIGNING_SECRET)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get('payload');
  if (!payloadStr) {
    return c.json({ error: 'Missing payload' }, 400);
  }

  const interactiveParseResult = SlackInteractivePayloadSchema.safeParse((() => {
    try { return JSON.parse(payloadStr); }
    catch { return null; }
  })());

  if (!interactiveParseResult.success) {
    return c.json({ error: 'Invalid payload JSON' }, 400);
  }

  const payload = interactiveParseResult.data;

  const payloadType = payload.type ?? '';
  const userId = payload.user?.id ?? '';
  const teamObj = payload.user?.team_id ?? payload.team?.id ?? '';

  // Handle App Home button clicks
  if (payloadType === 'block_actions') {
    for (const action of payload.actions ?? []) {
      const actionId = action.action_id ?? '';

      if (actionId === 'configure_api_key') {
        // Open modal for API key entry
        const triggerId = payload.trigger_id ?? '';
        const teamEnv = await envForTeam(c.env, teamObj);

        await fetch('https://slack.com/api/views.open', {
          body: JSON.stringify({
            trigger_id: triggerId,
            view: buildApiKeyModal(),
          }),
          headers: { 'Authorization': `Bearer ${teamEnv.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
          method: 'POST',
        });
        return c.json({ ok: true });
      }

      if (actionId === 'remove_api_key') {
        // Remove the API key
        await c.env.KV.delete(`team:${teamObj}:api_key`);
        const teamEnv = await envForTeam(c.env, teamObj);
        // Refresh home tab
        c.executionCtx.waitUntil(
          publishHomeTab(teamEnv.SLACK_BOT_TOKEN, c.env.KV, userId, teamObj),
        );
        return c.json({ ok: true });
      }
    }
  }

  // Handle modal submissions
  if (payloadType === 'view_submission') {
    const view = payload.view;
    const callbackId = view?.callback_id ?? '';

    if (callbackId === 'api_key_modal') {
      const apiKeyValue = view?.state?.values?.api_key_block?.api_key_input?.value;

      if (!apiKeyValue?.trim()) {
        return c.json({
          response_action: 'errors',
          errors: { api_key_block: 'Please enter a valid API key.' },
        });
      }

      const trimmedKey = apiKeyValue.trim();

      // Validate key format
      if (!trimmedKey.startsWith('rpnd_')) {
        return c.json({
          response_action: 'errors',
          errors: { api_key_block: 'API key must start with rpnd_. Get one at debatekit.ai/chat/settings/api-keys.' },
        });
      }

      // Save key
      await setApiKey(c.env.KV, teamObj, trimmedKey);

      // Refresh home tab in background
      c.executionCtx.waitUntil((async () => {
        const teamEnv = await envForTeam(c.env, teamObj);
        await publishHomeTab(teamEnv.SLACK_BOT_TOKEN, c.env.KV, userId, teamObj);
      })());

      return c.json({ response_action: 'clear' });
    }
  }

  // Delegate other interactions to existing handler.
  // Build a properly typed SlackInteractionPayload from the validated fields.
  const interactionPayload: SlackInteractionPayload = {
    actions: (payload.actions ?? []).map(a => ({
      action_id: a.action_id ?? '',
      block_id: '',
      type: '',
    })),
    type: payload.type ?? '',
    user: { id: payload.user?.id ?? '' },
  };
  c.executionCtx.waitUntil(handleInteraction(interactionPayload, c.env));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default app;
