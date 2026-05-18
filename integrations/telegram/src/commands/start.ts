/**
 * /start Command Handler
 *
 * Sends a welcome message with usage instructions in HTML format.
 * This is the first command users see when they open the bot.
 */

import type { Context } from 'grammy'

const WELCOME_HTML = `<b>Welcome to DebateKit</b> — the official bot for <a href="https://debatekit.com">debatekit.com</a>

Multi-model AI brainstorming with GPT-4o, Claude, Gemini &amp; 200+ models.

<b>Commands:</b>
/consult — Multi-model brainstorming
/review — Code review &amp; architecture
/analyze — Analyze chat messages
/debug — Bug diagnosis council
/plan — Implementation planning
/tradeoffs — Compare options &amp; tradeoffs
/setkey — Set your API key

<b>In DMs:</b> Just type your question, no command needed.
<b>In groups:</b> @mention me or use commands.

Get your API key at <a href="https://debatekit.com/chat/settings/api-keys">debatekit.com</a>`

export async function handleStart(ctx: Context) {
  await ctx.reply(WELCOME_HTML, { parse_mode: 'HTML' })
}
