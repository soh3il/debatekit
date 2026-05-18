/**
 * DebateKit Telegram Bot -- Cloudflare Worker
 *
 * Hono for non-Telegram routes (health, landing page, setup).
 * grammY for Telegram update handling.
 *
 * ARCHITECTURE: Inline processing with KV-based deduplication by
 * update_id prevents duplicate processing from Telegram retries.
 *
 * Routes:
 *   POST /telegram/webhook  -- grammY webhook handler (inline + dedup)
 *   GET  /telegram/setup    -- Register webhook + set bot commands
 *   GET  /health            -- Health check
 *   GET  /                  -- Landing page with "Add to Telegram" link
 */

import { z } from 'zod'
import { Hono } from 'hono'
import { Bot, InlineKeyboard } from 'grammy'

import { handleAnalyze, handleAnalyzeCallback } from './commands/analyze'
import { handleConsult } from './commands/consult'
import { handleDebug } from './commands/debug-issue'
import { handlePlan } from './commands/plan'
import { handleReview } from './commands/review'
import { handleSetKey } from './commands/setkey'
import { handleStart } from './commands/start'
import { handleTradeoffs } from './commands/tradeoffs'
import { getThreadLink, setThreadVisibility } from '@debatekit/integration-shared'
import { bufferMessage, getApiKey } from './lib/chat-store'

// ---------------------------------------------------------------------------
// Env bindings
// ---------------------------------------------------------------------------

export type Env = {
  /** Cached bot info JSON from getMe (avoids calling getMe on every request) */
  BOT_INFO: string
  KV: KVNamespace
  /** Fallback API key (used when chat hasn't configured their own) */
  DEBATEKIT_API_KEY: string
  DEBATEKIT_API_URL: string
  DEBATEKIT_APP_URL: string
  TELEGRAM_BOT_TOKEN: string
  /** Bot username without @ (e.g. debatekitnowbot) -- used for mention detection in groups */
  TELEGRAM_BOT_USERNAME: string
  TELEGRAM_WEBHOOK_SECRET: string
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

/** Minimal schema for Telegram update -- only validates the fields we use */
const TelegramUpdateSchema = z.object({
  update_id: z.number(),
})

/** Schema for grammY bot info (UserFromGetMe) -- all fields from @grammyjs/types */
const BotInfoSchema = z.object({
  added_to_attachment_menu: z.literal(true).optional(),
  allows_users_to_create_topics: z.boolean(),
  can_connect_to_business: z.boolean(),
  can_join_groups: z.boolean(),
  can_read_all_group_messages: z.boolean(),
  first_name: z.string(),
  has_main_web_app: z.boolean(),
  has_topics_enabled: z.boolean(),
  id: z.number(),
  is_bot: z.literal(true),
  is_premium: z.literal(true).optional(),
  language_code: z.string().optional(),
  last_name: z.string().optional(),
  supports_inline_queries: z.boolean(),
  username: z.string(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the API key for a chat -- per-chat key or fallback.
 */
async function resolveApiKey(kv: KVNamespace, chatId: number, fallbackKey: string) {
  const chatKey = await getApiKey(kv, chatId)
  return chatKey ?? fallbackKey
}


// ---------------------------------------------------------------------------
// grammY bot handler registration
// ---------------------------------------------------------------------------

function registerHandlers(bot: Bot, env: Env) {
  // /start -- always handle, no API key needed
  bot.command('start', async ctx => {
    await handleStart(ctx)
  })

  // /setkey -- manage API key
  bot.command('setkey', async ctx => {
    await handleSetKey(ctx, env, ctx.match)
  })

  // /consult -- multi-model brainstorming
  bot.command('consult', async ctx => {
    const args = ctx.match
    if (!args) {
      await ctx.reply('Usage: /consult [your question]\n\nExample: /consult Should we use GraphQL or REST for our new API?')
      return
    }

    const apiKey = await resolveApiKey(env.KV, ctx.chat.id, env.DEBATEKIT_API_KEY)
    if (!apiKey) {
      await ctx.reply('No API key configured. Run /setkey rpnd_your_key to get started.\n\nGet a key at debatekit.com/chat/settings/api-keys')
      return
    }

    await handleConsult(ctx, env, apiKey, args)
  })

  // /review -- code review & architecture
  bot.command('review', async ctx => {
    const args = ctx.match
    if (!args) {
      await ctx.reply('Usage: /review [code or description]\n\nExample: /review Review our authentication middleware for security issues')
      return
    }

    const apiKey = await resolveApiKey(env.KV, ctx.chat.id, env.DEBATEKIT_API_KEY)
    if (!apiKey) {
      await ctx.reply('No API key configured. Run /setkey rpnd_your_key to get started.\n\nGet a key at debatekit.com/chat/settings/api-keys')
      return
    }

    await handleReview(ctx, env, apiKey, args)
  })

  // /analyze -- analyze recent chat messages
  bot.command('analyze', async ctx => {
    const apiKey = await resolveApiKey(env.KV, ctx.chat.id, env.DEBATEKIT_API_KEY)
    if (!apiKey) {
      await ctx.reply('No API key configured. Run /setkey rpnd_your_key to get started.\n\nGet a key at debatekit.com/chat/settings/api-keys')
      return
    }

    await handleAnalyze(ctx, env, apiKey, ctx.match)
  })

  // /debug -- bug diagnosis council
  bot.command('debug', async ctx => {
    const args = ctx.match
    if (!args) {
      await ctx.reply('Usage: /debug [bug description]\n\nExample: /debug Users getting 500 errors on login page')
      return
    }

    const apiKey = await resolveApiKey(env.KV, ctx.chat.id, env.DEBATEKIT_API_KEY)
    if (!apiKey) {
      await ctx.reply('No API key configured. Run /setkey rpnd_your_key to get started.\n\nGet a key at debatekit.com/chat/settings/api-keys')
      return
    }

    await handleDebug(ctx, env, apiKey, args)
  })

  // /plan -- implementation planning
  bot.command('plan', async ctx => {
    const args = ctx.match
    if (!args) {
      await ctx.reply('Usage: /plan [feature description]\n\nExample: /plan Add OAuth2 login with Google and GitHub')
      return
    }

    const apiKey = await resolveApiKey(env.KV, ctx.chat.id, env.DEBATEKIT_API_KEY)
    if (!apiKey) {
      await ctx.reply('No API key configured. Run /setkey rpnd_your_key to get started.\n\nGet a key at debatekit.com/chat/settings/api-keys')
      return
    }

    await handlePlan(ctx, env, apiKey, args)
  })

  // /tradeoffs -- compare options & tradeoffs
  bot.command('tradeoffs', async ctx => {
    const args = ctx.match
    if (!args) {
      await ctx.reply('Usage: /tradeoffs [decision to evaluate]\n\nExample: /tradeoffs PostgreSQL vs MongoDB for our user data')
      return
    }

    const apiKey = await resolveApiKey(env.KV, ctx.chat.id, env.DEBATEKIT_API_KEY)
    if (!apiKey) {
      await ctx.reply('No API key configured. Run /setkey rpnd_your_key to get started.\n\nGet a key at debatekit.com/chat/settings/api-keys')
      return
    }

    await handleTradeoffs(ctx, env, apiKey, args)
  })

  // Callback queries for /analyze inline keyboard
  bot.callbackQuery(/^analyze:/, async ctx => {
    const apiKey = await resolveApiKey(env.KV, ctx.chat!.id, env.DEBATEKIT_API_KEY)
    if (!apiKey) {
      await ctx.answerCallbackQuery({ text: 'No API key configured' })
      return
    }
    await handleAnalyzeCallback(ctx, env, apiKey, ctx.callbackQuery.data)
  })

  // Share thread publicly
  bot.callbackQuery(/^share:/, async ctx => {
    const sessionId = ctx.callbackQuery.data.replace('share:', '')
    const apiKey = await resolveApiKey(env.KV, ctx.chat!.id, env.DEBATEKIT_API_KEY)
    if (!apiKey) {
      await ctx.answerCallbackQuery({ text: 'No API key configured' })
      return
    }
    try {
      await setThreadVisibility(env.DEBATEKIT_API_URL, apiKey, sessionId, true, 'telegram')
      const link = await getThreadLink(env.DEBATEKIT_API_URL, apiKey, sessionId, 'telegram')
      await ctx.answerCallbackQuery({ text: 'Thread is now public!' })
      const keyboard = new InlineKeyboard()
        .url('Open public link', link.publicUrl)
        .url('Open dashboard', link.dashboardUrl)
      await ctx.editMessageReplyMarkup({ reply_markup: keyboard })
    }
    catch (err) {
      console.error('[share] Failed:', err instanceof Error ? err.message : err)
      await ctx.answerCallbackQuery({ text: 'Failed to share thread' })
    }
  })

  // Message buffering for /analyze -- only buffer, never auto-trigger commands.
  // The bot only responds to explicit slash commands (/consult, /review, etc.)
  bot.on('message:text', async ctx => {
    const text = ctx.message.text

    // Buffer non-command messages for /analyze
    if (!text.startsWith('/')) {
      bufferMessage(env.KV, ctx.chat.id, {
        date: ctx.message.date,
        from: ctx.from.username ?? ctx.from.first_name,
        messageId: ctx.message.message_id,
        text,
      }).catch(err => console.error('[buffer] Failed:', err instanceof Error ? err.message : err))
    }
  })
}

// ---------------------------------------------------------------------------
// Hono App
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>()

// Error handling
app.onError((error, c) => {
  console.error('Unhandled error:', error.message)
  return c.json({ error: 'Internal server error' }, 500)
})

// Health check
app.get('/health', c => c.json({ ok: true, service: 'debatekit-telegram-bot', version: '1.0.0' }))

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

app.get('/', (c) => {
  const appUrl = c.env.DEBATEKIT_APP_URL
  const botUsername = c.env.TELEGRAM_BOT_USERNAME

  return c.html(
    `<html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>DebateKit for Telegram</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#fff}
      .card{background:#16213e;padding:3rem;border-radius:16px;text-align:center;max-width:520px}
      h1{margin:0 0 0.5rem;font-size:2rem}
      .subtitle{color:#a0a0b0;margin-bottom:2rem;line-height:1.6}
      .btn{display:inline-block;background:#0088cc;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1.1rem;transition:background 0.2s}
      .btn:hover{background:#006da3}
      .features{text-align:left;margin:2rem 0;color:#c0c0d0;line-height:1.8}
      .footer{color:#606080;margin-top:2rem;font-size:0.85rem}
      .footer a{color:#0088cc;text-decoration:none}</style></head>
      <body><div class="card">
        <h1>DebateKit</h1>
        <p class="subtitle">Official Telegram bot for <a href="${appUrl}" style="color:#0088cc">debatekit.com</a> &mdash; multi-model AI brainstorming</p>
        <a href="https://t.me/${botUsername}" class="btn">Open in Telegram</a>
        <div class="features">
          <strong>What you get:</strong><br>
          &#8226; <code>/consult</code> &mdash; Consult GPT-4o, Claude, Gemini &amp; 200+ models<br>
          &#8226; <code>/review</code> &mdash; Expert code reviews &amp; architecture assessments<br>
          &#8226; <code>/analyze</code> &mdash; Analyze recent group chat messages<br>
          &#8226; Direct Messages &mdash; Just type your question, no command needed
        </div>
        <div class="footer"><a href="${appUrl}">debatekit.com</a></div>
      </div></body></html>`,
  )
})

// ---------------------------------------------------------------------------
// Webhook setup -- register webhook URL + set bot commands (uses grammY's bot.api)
// ---------------------------------------------------------------------------

app.get('/telegram/setup', async (c) => {
  const origin = new URL(c.req.url).origin
  const webhookUrl = `${origin}/telegram/webhook`

  try {
    const bot = new Bot(c.env.TELEGRAM_BOT_TOKEN)

    // Register webhook with secret token
    await bot.api.setWebhook(webhookUrl, {
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
      secret_token: c.env.TELEGRAM_WEBHOOK_SECRET,
    })

    // Set bot commands
    await bot.api.setMyCommands([
      { command: 'consult', description: 'Multi-model AI brainstorming' },
      { command: 'review', description: 'Code review & architecture' },
      { command: 'analyze', description: 'Analyze recent chat messages' },
      { command: 'debug', description: 'Bug diagnosis council' },
      { command: 'plan', description: 'Implementation planning' },
      { command: 'tradeoffs', description: 'Compare options & tradeoffs' },
      { command: 'setkey', description: 'Set your DebateKit API key' },
      { command: 'start', description: 'Show help & commands' },
    ])

    return c.json({
      commands: 'registered',
      ok: true,
      webhook: webhookUrl,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Setup error:', message)
    return c.json({ error: message, ok: false }, 500)
  }
})

// ---------------------------------------------------------------------------
// Telegram Webhook -- inline processing with KV dedup
//
// Processes updates inline (not via waitUntil) so the worker stays alive
// for the full API call duration. KV dedup prevents Telegram retries from
// double-processing if the response takes longer than Telegram's timeout.
// ---------------------------------------------------------------------------

app.post('/telegram/webhook', async (c) => {
  const start = Date.now()

  // Manual secret verification
  const secret = c.req.header('x-telegram-bot-api-secret-token')
  if (secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401)
  }

  const updateBody = await c.req.json()
  const update = TelegramUpdateSchema.safeParse(updateBody)
  if (!update.success) {
    console.error('[webhook] Invalid update payload:', update.error.message)
    return c.text('OK')
  }
  const updateId = update.data.update_id
  console.log(`[webhook] Received update ${updateId}`)

  // Dedup: prevent Telegram retry from processing same update twice
  const dedupKey = `dedup:${updateId}`
  const seen = await c.env.KV.get(dedupKey)
  if (seen) {
    console.log(`[webhook] Skipping duplicate update ${updateId}`)
    return c.text('OK')
  }
  await c.env.KV.put(dedupKey, '1', { expirationTtl: 300 })

  const botInfo = BotInfoSchema.parse(JSON.parse(c.env.BOT_INFO))
  const bot = new Bot(c.env.TELEGRAM_BOT_TOKEN, { botInfo })
  registerHandlers(bot, c.env)

  // Process inline -- worker stays alive for the full API call
  try {
    await bot.handleUpdate(updateBody)
    console.log(`[webhook] Done update ${updateId} in ${Date.now() - start}ms`)
  }
  catch (err) {
    console.error(`[webhook] Handler error for ${updateId}:`, err instanceof Error ? err.message : err)
  }

  return c.text('OK')
})

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default app
