# DebateKit Slack Bot

Cloudflare Worker-based Slack bot that brings DebateKit's multi-AI brainstorming to Slack channels.

## Features

- `/debatekit [prompt]` — Start a debatekit brainstorm with multiple AI models
- `/debatekit-review [code or description]` — Code review or architecture review mode
- `@DebateKit [prompt]` — Mention the bot to start a discussion
- Threaded replies with moderator synthesis + individual participant responses
- Block Kit formatted results with metadata and "View in DebateKit" link

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From an app manifest** or **From scratch**
3. Name it "DebateKit" and select your workspace

### 2. Configure Bot Permissions

Under **OAuth & Permissions**, add these Bot Token Scopes:

- `chat:write` — Post messages
- `chat:write.public` — Post in channels the bot hasn't joined
- `commands` — Register slash commands
- `app_mentions:read` — Respond to @mentions

### 3. Register Slash Commands

Under **Slash Commands**, create:

| Command | Request URL | Description |
|---------|------------|-------------|
| `/debatekit` | `https://your-worker.your-domain/slack/commands` | Start a debatekit brainstorm |
| `/debatekit-review` | `https://your-worker.your-domain/slack/commands` | Code or architecture review |

### 4. Enable Events

Under **Event Subscriptions**:

1. Enable Events
2. Set Request URL to `https://your-worker.your-domain/slack/events`
3. Subscribe to bot events: `app_mention`

### 5. Enable Interactivity

Under **Interactivity & Shortcuts**:

1. Enable Interactivity
2. Set Request URL to `https://your-worker.your-domain/slack/interactions`

### 6. Install to Workspace

Under **Install App**, click **Install to Workspace** and authorize.

Copy the **Bot User OAuth Token** (`xoxb-...`).

### 7. Set Environment Variables

```bash
# Slack credentials (from your Slack app settings)
wrangler secret put SLACK_BOT_TOKEN        # xoxb-... from Install App page
wrangler secret put SLACK_SIGNING_SECRET   # From Basic Information > App Credentials

# DebateKit API credentials
wrangler secret put DEBATEKIT_API_KEY     # Your DebateKit API key
```

The following are set in `wrangler.jsonc` as vars (not secrets):

- `DEBATEKIT_API_URL` — MCP REST API base URL
- `DEBATEKIT_APP_URL` — Web app URL (for "View in DebateKit" links)

### 8. Create KV Namespace

```bash
wrangler kv namespace create SLACK_KV
```

Update the KV namespace ID in `wrangler.jsonc`.

### 9. Deploy

```bash
bun install
bun run deploy            # default environment
bun run deploy:preview    # preview
bun run deploy:production # production
```

## Development

```bash
bun install
bun run dev
```

Use [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) to expose your local dev server to Slack:

```bash
ngrok http 8790
```

Update your Slack app's Request URLs to point to the ngrok URL.

## Architecture

```
src/
  index.ts                    # Hono worker entry point (routes)
  commands/
    debatekit.ts             # /debatekit command handler
    debatekit-review.ts      # /debatekit-review command handler
    interactions.ts           # Button/modal interaction handler
  blocks/
    result-blocks.ts          # Block Kit builder for formatting results
  lib/
    api-client.ts             # DebateKit MCP REST API client
    slack-client.ts           # Minimal Slack Web API wrapper
    verify.ts                 # Slack request signature verification
```

## API Endpoints Called

This bot calls DebateKit's MCP REST API (defined in `apps/mcp/src/rest-handler.ts`):

| Endpoint | Used By |
|----------|---------|
| `POST /api/v1/consult` | `/debatekit` command |
| `POST /api/v1/review-code` | `/debatekit-review` (code input) |
| `POST /api/v1/architect` | `/debatekit-review` (description input) |
