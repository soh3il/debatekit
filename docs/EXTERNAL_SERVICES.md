# DebateKit External Services Provisioning Runbook

Step-by-step provisioning guide for every third-party account, project, and API key DebateKit depends on. Read this end-to-end the first time you set the app up from scratch. After that, use the table of contents to jump to one service.

This doc is the "where do I click" companion to:

- `docs/ENV_VARS.md` — exhaustive var inventory (source of truth for var names, who reads them, defaults).
- `docs/DEPLOY_SECRETS.md` — `wrangler secret put` recipes for preview/prod.
- `docs/DOMAIN_MIGRATION.md` — what happens on the Cloudflare zone.
- `apps/api/.dev.vars.example`, `apps/mcp/.dev.vars.example`, `apps/web/.dev.vars.example` — local secret templates.

If anything in this file disagrees with one of those, **trust the code / `.dev.vars.example` first** and update this doc.

---

## Conventions

- **Identity.** All third-party accounts use `ava@deadpixel.ai` via Google SSO unless noted otherwise. After signing in, switch to Soheil's team / org / workspace (`deadpixel` / `DebateKit`) so resources are owned by the company, not by your personal user. If a service does not support orgs, create the account from `ava@deadpixel.ai` and document who else has the password in 1Password.
- **Project / account naming.** Every resource we provision in third parties is named or prefixed with `debatekit` (e.g. `debatekit-server`, `debatekit-tts`, `debatekit-ses-sender`, `debatekit-prod`). One project per service, three environments (`local` / `preview` / `prod`) typically share that project but use separate keys / DBs / webhooks where supported.
- **Never commit real secrets.** All secrets land in `.dev.vars` (gitignored) and `wrangler secret put` for deployed envs. Public values (`AUTH_GOOGLE_ID`, `STRIPE_PUBLISHABLE_KEY`, `TURNSTILE_SITE_KEY`, `STRIPE_CUSTOMER_PORTAL_CONFIG_ID`, etc.) go in the worker's `wrangler.jsonc` under `vars`.
- **Three envs.** Wherever a service distinguishes test vs live or has per-env keys (Stripe, Telegram, OAuth redirects), provision separately for `preview` and `prod`. `local` shares the `preview` (test) keys.
- **Redirect / webhook URLs** are based on the canonical hosts:
  - Web (frontend): `http://localhost:5173` / `https://web-preview.debatekit.com` / `https://debatekit.com`
  - API (Hono): `http://localhost:8787` / `https://api-preview.debatekit.com` / `https://api.debatekit.com`
  - MCP: `http://localhost:8788` / `https://mcp-preview.debatekit.com` / `https://mcp.debatekit.com`
  - Telegram bot: `https://telegram.debatekit.com` (prod only)
  - Slack bot: `https://slack.debatekit.com` (prod only)
  - WhatsApp bot: `https://whatsapp.debatekit.com` (prod only)

---

## Table of Contents

1. [PostHog](#1-posthog) — analytics, feature flags, server ingest
2. [Stripe](#2-stripe) — payments, customer portal, webhooks
3. [Google OAuth (Google Cloud Console)](#3-google-oauth-google-cloud-console) — sign-in
4. [OpenRouter](#4-openrouter) — multi-model LLM router
5. [AWS SES](#5-aws-ses) — transactional + marketing email
6. [Telegram BotFather](#6-telegram-botfather) — Telegram bot integration
7. [Cloudflare Turnstile](#7-cloudflare-turnstile) — bot protection on sign-in / forms
8. [Twitter / X Developer Portal](#8-twitter--x-developer-portal) — tweet posting from app
9. [ElevenLabs](#9-elevenlabs) — text-to-speech for podcasts
10. [Upstash Redis](#10-upstash-redis) — rate limiting + cache
11. [Serper.dev](#11-serperdev) — Google search results for web-search tool
12. [Finnhub](#12-finnhub) — financial market data tool
13. [FRED (St. Louis Fed)](#13-fred-st-louis-fed) — macroeconomic data tool
14. [Better-Auth shared secret](#14-better-auth-shared-secret) — self-generated, not a vendor
15. [Order of operations](#order-of-operations) — recommended sequence

---

## 1. PostHog

- **Why we use it.** Server-side product analytics + feature flags from `apps/api` and `apps/mcp` workers, plus client-side autocapture from `apps/web`.
- **Login URL.** <https://us.posthog.com/login>
- **Identity.** `ava@deadpixel.ai` via Google SSO. After login, top-left org switcher → `DebateKit` (or create the org first time and invite Soheil with Admin role).

### Steps

1. Sign in. If `DebateKit` org doesn't exist yet: top-left → "+ New organization" → name `DebateKit`.
2. Inside the `DebateKit` org → "+ New project" → name `DebateKit`. Pick **US Cloud** (host `us.i.posthog.com`).
3. Project settings → General → confirm the project name and timezone (UTC is fine; we already query in UTC).
4. Project settings → Project API Key → copy the `phc_…` value. This is the **public client / server ingest key**.
5. (Optional, for the server worker if you want server-side feature-flag evaluation with private results.) Top-right user menu → Personal API keys → "+ Create personal API key" → name `debatekit-server` → scope `feature_flag:read` + `project:read` → copy the `phx_…` value.

### Keys to capture

| Var | UI location | Example shape |
|---|---|---|
| `POSTHOG_API_KEY` (server-side, `apps/api` + `apps/mcp`) | Project settings → Project API Key | `phc_abc…` |
| `VITE_POSTHOG_API_KEY` (client, `apps/web/.env*`) | same as above — same key | `phc_abc…` |
| `POSTHOG_HOST` (already in wrangler `vars` for all workers) | constant | `https://us.i.posthog.com` |
| Personal API key (optional) | User menu → Personal API keys | `phx_abc…` |

The client and server ingest keys are intentionally the same string — PostHog's `phc_` keys are designed for client exposure. The personal `phx_` key is **only** for server-side feature-flag evaluation and admin API calls and must never ship to the browser.

### Cost / free tier

Free up to 1M events/month and 5k session recordings; debate-heavy usage may push you past that — set a billing limit in Billing → Manage spend.

### Sanity test

After deploying with the key set:

```
curl https://api-preview.debatekit.com/api/v1/test/posthog
# => { "hasApiKey": true, "host": "https://us.i.posthog.com", "environment": "preview" }
```

Then in PostHog → Activity → confirm test events arrive within a few seconds.

---

## 2. Stripe

- **Why we use it.** Subscriptions, one-off credit purchases, customer self-serve portal. Webhooks drive entitlement updates inside `apps/api`.
- **Login URL.** <https://dashboard.stripe.com/apikeys>
- **Identity.** Stripe account is owned by `ava@deadpixel.ai`. After sign-in, top-left account picker → switch to **DebateKit** account (create it on first login: "+ New account" → name `DebateKit`, country, currency `USD`).

### Steps

1. Top-right toggle → **Test mode** (orange badge). All preview + local work uses test mode.
2. Developers → API keys → reveal **Secret key** → copy `sk_test_…`. Copy the **Publishable key** `pk_test_…` too.
3. Settings → Billing → Customer portal → configure the portal (enable subscription cancellation, payment method updates, invoice history). Click **Save**. Copy the **Configuration ID** shown at the top: `bpc_…`.
4. Developers → Webhooks → "+ Add endpoint":
   - URL: `https://api-preview.debatekit.com/webhooks/stripe`
   - Events: at minimum `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`. (Cross-check against `apps/api/src/routes/webhooks/stripe.handler.ts` for the full list.)
   - After creation → reveal **Signing secret** → copy `whsec_…`.
5. Repeat steps 2–4 in **Live mode** with:
   - Webhook URL: `https://api.debatekit.com/webhooks/stripe`
   - Customer portal: re-save in live mode → gives a different `bpc_…` ID
   - Use `sk_live_…` / `pk_live_…`
6. For local development, install the Stripe CLI and run `stripe listen --forward-to http://localhost:8787/webhooks/stripe` — the CLI prints a `whsec_…` for the tunnel. Use that as `STRIPE_WEBHOOK_SECRET` in `apps/api/.dev.vars`.

### Keys to capture

| Var | Env | UI location | Example shape | Notes |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | local + preview | Developers → API keys (test mode) | `sk_test_51…` | secret |
| `STRIPE_SECRET_KEY` | prod | Developers → API keys (live mode) | `sk_live_51…` | secret |
| `STRIPE_PUBLISHABLE_KEY` | local + preview | Developers → API keys (test mode) | `pk_test_51…` | public, wrangler `vars` |
| `STRIPE_PUBLISHABLE_KEY` | prod | Developers → API keys (live mode) | `pk_live_51…` | public, wrangler `vars` |
| `STRIPE_WEBHOOK_SECRET` | local | `stripe listen` CLI output | `whsec_…` | secret, ephemeral per CLI session |
| `STRIPE_WEBHOOK_SECRET` | preview / prod | Webhook endpoint → Signing secret | `whsec_…` | secret, different per endpoint |
| `STRIPE_CUSTOMER_PORTAL_CONFIG_ID` | preview | Settings → Billing → Customer portal (test) | `bpc_…` | public, wrangler `vars` |
| `STRIPE_CUSTOMER_PORTAL_CONFIG_ID` | prod | Settings → Billing → Customer portal (live) | `bpc_…` | public, wrangler `vars`; different from test |

### Cost / free tier

No fixed cost; Stripe takes a percentage per successful charge. Test mode is free.

### Sanity test

In test mode: `stripe trigger checkout.session.completed` then watch `wrangler tail --env preview --format pretty` for the handler firing.

---

## 3. Google OAuth (Google Cloud Console)

- **Why we use it.** Google sign-in via Better-Auth's `social` provider in `apps/api`.
- **Login URL.** <https://console.cloud.google.com/apis/credentials>
- **Identity.** `ava@deadpixel.ai`. Top bar org picker → switch to **deadpixel.ai** org → project picker → create or select **DebateKit**.

### Steps

1. Project picker → "+ New project" → name `DebateKit`, org `deadpixel.ai`, no parent folder → Create.
2. Wait for the project to be created, then switch to it.
3. APIs & Services → OAuth consent screen → set User Type **External** → Create. Fill in:
   - App name: `DebateKit`
   - User support email: `support@debatekit.com`
   - App logo: optional (square PNG ≥ 120px)
   - App domain: `debatekit.com`; authorized domain `debatekit.com`
   - Developer contact: `ava@deadpixel.ai`
4. Scopes step → "Add or remove scopes" → check `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Save.
5. Test users → add `ava@deadpixel.ai`, `soheil@deadpixel.ai`, and anyone else who needs preview access while the app is in test mode.
6. Submit for verification when you're ready to allow public users (required to leave test mode; takes 1–4 weeks).
7. APIs & Services → Credentials → "+ Create credentials" → "OAuth client ID" → Application type **Web application** → name `DebateKit Web`.
8. Add **Authorized redirect URIs** — note these point at the API worker (`/api/auth/callback/google`), not the frontend, because Better-Auth is mounted on `apps/api`:
   - `http://localhost:8787/api/auth/callback/google`
   - `https://api-preview.debatekit.com/api/auth/callback/google`
   - `https://api.debatekit.com/api/auth/callback/google`
9. Authorized JavaScript origins (used by the One Tap widget if you ever enable it; harmless to add now):
   - `http://localhost:5173`
   - `https://web-preview.debatekit.com`
   - `https://debatekit.com`
10. Create → modal shows **Client ID** and **Client secret**. Copy both.

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `AUTH_GOOGLE_ID` | Credentials → OAuth client → Client ID | `8155…-….apps.googleusercontent.com` | public, wrangler `vars`; same value across all envs (single client) |
| `AUTH_GOOGLE_SECRET` | Credentials → OAuth client → Client secret | `GOCSPX-…` | secret, per-env in `.dev.vars` / `wrangler secret put` |

Because all three envs share one OAuth client, the `AUTH_GOOGLE_ID` value is identical across local / preview / prod. Only the redirect URI registered per env differs.

### Cost / free tier

Free.

### Sanity test

Open `https://web-preview.debatekit.com/sign-in` → click "Continue with Google" → consent screen shows app name "DebateKit" and the right redirect host → bounces back signed in.

---

## 4. OpenRouter

- **Why we use it.** Single API for all LLM calls (debate orchestration, evaluations, MCP tool LLM calls). Routes to Anthropic, OpenAI, Google, Mistral, etc. by model ID.
- **Login URL.** <https://openrouter.ai/keys>
- **Identity.** `ava@deadpixel.ai` via Google. Top-right account → switch to team `DebateKit` (create the team first time: Settings → Teams → New team → invite Soheil).

### Steps

1. In the team context, top-up credits: Settings → Credits → Add credits ($100 to start; auto-refill on at $20).
2. Keys page → "+ Create Key":
   - Name: `debatekit-server`
   - Credit limit: $50/month (raise as needed; revisit monthly)
   - Provider preferences: leave default (all providers enabled)
3. Copy the `sk-or-v1-…` key — **shown once**, can't be recovered.
4. (Optional) Create a second key `debatekit-mcp` if you want separate spend tracking for the MCP worker. Both workers can share one key without functional issues.

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `OPENROUTER_API_KEY` (`apps/api`) | Keys → debatekit-server | `sk-or-v1-…` | secret |
| `OPENROUTER_API_KEY` (`apps/mcp`) | Keys → debatekit-server or debatekit-mcp | `sk-or-v1-…` | secret; can match `apps/api` |

### Cost / free tier

Pay-per-token, marked up ~5% over upstream pricing. No free tier of meaningful size. Use the per-key monthly limit to cap blast radius.

### Sanity test

```
curl https://openrouter.ai/api/v1/auth/key \
  -H "Authorization: Bearer sk-or-v1-…"
# => 200 with usage + limit metadata
```

---

## 5. AWS SES

- **Why we use it.** All transactional email (magic links, password resets, debate-finished notifications) and marketing email (digests). Region is `eu-north-1` — confirmed in `apps/api/wrangler.jsonc`. Do **not** use `us-east-1`.
- **Login URL.** <https://eu-north-1.console.aws.amazon.com/ses/home?region=eu-north-1#/verified-identities>
- **Identity.** AWS root account `ava@deadpixel.ai`. After sign-in, top-right region picker → `Europe (Stockholm) eu-north-1`. If the account uses AWS Organizations, switch to the `DebateKit` member account via the account switcher.

See `docs/DOMAIN_MIGRATION.md` and `docs/ENV_VARS.md` for domain DNS specifics — when you verify the domain, AWS gives you DKIM CNAMEs you have to add to Cloudflare DNS.

### Steps

1. SES console → Verified identities → "Create identity":
   - Type: **Domain**
   - Domain: `debatekit.com`
   - **Use a custom MAIL FROM domain**: `mail.debatekit.com`
   - Easy DKIM, RSA 2048
   - Create
2. SES shows three CNAME records — copy them into Cloudflare DNS for `debatekit.com` (the migration doc covers this). Wait for status to flip to **Verified** (usually < 15 min).
3. Verified identities → "Create identity" (single email — for sandbox sender):
   - Type: **Email address**
   - Email: `noreply@debatekit.com`
   - Create → AWS sends a confirmation email → forward to whoever owns the mailbox (Cloudflare Email Routing → forwards to a real inbox).
4. Verified identities → "Create identity" again:
   - Type: **Email address**
   - Email: `hello@mail.debatekit.com`
   - Confirm.
5. Account dashboard → "Request production access" → fill out the form. Use case: "Transactional + opt-in marketing for DebateKit users (sign-in magic links, debate notifications, weekly digests). Bounce/complaint rate handled via SES suppression list + app-side double opt-in." Takes ~24 hours.
6. IAM → Users → Add users → name `debatekit-ses-sender` → "Access key — Programmatic access".
7. Permissions → Attach policies directly → create custom inline policy (more restricted than `AmazonSESFullAccess`):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["ses:SendEmail", "ses:SendRawEmail"],
         "Resource": "*"
       }
     ]
   }
   ```
8. Finish user creation → on the "Retrieve access keys" screen, copy the access key ID and secret access key. AWS shows the secret **once**.

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `AWS_SES_ACCESS_KEY_ID` | IAM → debatekit-ses-sender → Security credentials → Access keys | `AKIA…` | secret |
| `AWS_SES_SECRET_ACCESS_KEY` | same screen, shown once | 40-char base64-ish | secret; reset by deactivating + creating a new key if lost |
| `AWS_SES_REGION` | constant | `eu-north-1` | public, already in wrangler `vars` |
| `SES_VERIFIED_EMAIL` | matches the verified single email | `noreply@debatekit.com` | public, already in wrangler `vars` |
| `FROM_EMAIL` | same as above | `noreply@debatekit.com` | public, already in wrangler `vars` |
| `MARKETING_FROM_EMAIL` | second verified email | `hello@mail.debatekit.com` | public, already in wrangler `vars` |
| `SES_REPLY_TO_EMAIL` | constant | `support@debatekit.com` | public, already in wrangler `vars` |

### Cost / free tier

$0.10 per 1,000 emails; first 62k/month free **if** sent from Lambda/EC2 in the same region (Cloudflare Workers don't qualify — assume paid from email 1, still cheap).

### Sanity test

```
aws ses send-email --region eu-north-1 \
  --from noreply@debatekit.com \
  --to your-real-inbox@somewhere \
  --subject "SES sanity" \
  --text "hi"
```

In the app: trigger a magic-link sign-in from `https://web-preview.debatekit.com/sign-in` → email arrives in seconds. Check SES → Reputation metrics dashboard for delivery + bounce rate.

---

## 6. Telegram BotFather

- **Why we use it.** Telegram bot integration in `integrations/telegram`, exposing DebateKit tools to Telegram chats.
- **Login URL.** Open Telegram (desktop or mobile) → search `@BotFather` → start chat. Or web: <https://t.me/BotFather>.
- **Identity.** Telegram account on Ava's phone number. Each env gets its own bot so prod messages don't leak to preview.

### Steps (do this twice: once for preview, once for prod)

1. `/newbot` → BotFather prompts for the display name → for preview enter `DebateKit (preview)`, for prod `DebateKit`.
2. Then it asks for a username (must end in `bot`):
   - preview: `debatekit_preview_bot` (or whatever is available)
   - prod: `debatekitnowbot` (the public-facing one; falls back to a variant if taken)
3. BotFather replies with the bot token — copy it (format `1234567:AAAA…`).
4. `/setdescription` → pick the bot → paste DebateKit description.
5. `/setuserpic` → pick the bot → upload logo (square PNG 512×512).
6. `/setcommands` → pick the bot → paste:
   ```
   start - Start a new debate
   help - Show help
   account - Link your DebateKit account
   ```
7. Self-generate a webhook secret (any 32+ char random string): `openssl rand -hex 32`. Save it — this is `TELEGRAM_WEBHOOK_SECRET`, not from BotFather.
8. After `integrations/telegram` is deployed to prod, register the webhook (replace `<TOKEN>` and `<SECRET>`):
   ```
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://telegram.debatekit.com/webhook" \
     -d "secret_token=<SECRET>"
   ```

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather message after `/newbot` | `1234567:AAA…` | secret; per env |
| `TELEGRAM_BOT_USERNAME` | the username you picked | `debatekitnowbot` | public, wrangler `vars`; used to detect `@mentions` in groups |
| `TELEGRAM_WEBHOOK_SECRET` | self-generated, `openssl rand -hex 32` | hex string | secret; you choose this, Telegram echoes it back on each webhook |

### Cost / free tier

Free, unlimited.

### Sanity test

```
curl "https://api.telegram.org/bot<TOKEN>/getMe"
# => { "ok": true, "result": { "username": "debatekitnowbot", ... } }
```

Then DM the bot `/start` → integration replies.

---

## 7. Cloudflare Turnstile

- **Why we use it.** Bot protection on sign-in, sign-up, and password reset flows. Client renders the widget; `apps/api` verifies the token server-side.
- **Login URL.** <https://dash.cloudflare.com/> → pick the deadpixel account → left nav → **Turnstile**.
- **Identity.** Cloudflare account `c21c4d074e34a8b1b9d335a41c2f69e3` (Soheil's). Access via SSO or shared 1Password login.

### Steps

1. Turnstile → "Add Site":
   - Site name: `debatekit-web`
   - Domains: `debatekit.com`, `web-preview.debatekit.com`, `localhost`
   - Widget mode: **Managed** (best UX; falls back to interactive challenge for suspicious traffic)
2. Create → Cloudflare reveals the **Site key** and **Secret key**. Copy both.
3. We currently re-use **one widget across all three envs** (its site key `0x4AAAAAACN3_OeMcDjErTqV` is already in `wrangler.jsonc`). If you ever want isolation, create three widgets (`debatekit-web-local`, `…-preview`, `…-prod`) and swap per env.

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `TURNSTILE_SITE_KEY` | Turnstile → debatekit-web → Site key | `0x4AAAAA…` | public, wrangler `vars` |
| `TURNSTILE_SECRET_KEY` | Turnstile → debatekit-web → Secret key | `0x4AAAAA…` (longer) | secret |

### Cost / free tier

Free (no documented cap as of writing — they bill abusive volumes).

### Sanity test

Open sign-in page → widget renders → no console errors. Server log: `wrangler tail --env preview | grep turnstile` while submitting the form — `"success": true` on the verify response.

---

## 8. Twitter / X Developer Portal

- **Why we use it.** App posts tweets from a single canonical DebateKit Twitter account (`@DebateKitApp` or similar) via OAuth 1.0a user context. Used by the tweet-posting queue in `apps/api`.
- **Login URL.** <https://developer.twitter.com/en/portal/dashboard>
- **Identity.** Sign in with the **Twitter account that will own the tweets** (the DebateKit company account, **not** Ava's personal). If that account doesn't exist yet: create at twitter.com first, then sign into the developer portal with it.

### Steps

1. Apply for the Free tier (or Basic if higher volume needed — $100/month, 10k tweets/month write). Wait for approval (instant for Free, hours for Basic).
2. Developer portal → Projects & Apps → "+ New Project" → name `DebateKit` → use case "Building a B2B tool".
3. Inside the project → "+ Create App" → name `DebateKit Posting`.
4. App settings → User authentication settings → Set up:
   - App permissions: **Read and write** (we post tweets; don't need DM access)
   - Type of App: **Web App, Automated App or Bot**
   - App info → Callback URI: `https://api.debatekit.com/api/v1/social/twitter/callback` (placeholder; we use OAuth 1.0a PIN flow today, so this is rarely hit but required to save)
   - Website URL: `https://debatekit.com`
   - Save
5. Keys and tokens tab:
   - **API Key and Secret** (= consumer key/secret): "Regenerate" → copy both immediately. Once dismissed they can be regenerated but never re-shown.
   - **Access Token and Secret**: "Generate" — this issues a user access token for the **currently-signed-in Twitter account** (the DebateKit company account). Copy both.

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `TWITTER_API_KEY` | Keys and tokens → API Key and Secret → Key | 25-char alnum | secret (consumer key) |
| `TWITTER_API_SECRET` | same → Secret | 50-char alnum | secret (consumer secret) |
| `TWITTER_ACCESS_TOKEN` | Keys and tokens → Access Token and Secret → Token | starts with numeric user ID, e.g. `12345-AB…` | secret; tied to the signed-in user |
| `TWITTER_ACCESS_TOKEN_SECRET` | same → Secret | 45-char alnum | secret |

If you regenerate the consumer key/secret you must also regenerate the access token (the old token is invalidated).

### Cost / free tier

Free tier: 1.5k tweet writes/month, 100 reads. Basic ($100/mo) for production usage. Pro ($5,000/mo) for enterprise volumes — not needed.

### Sanity test

```
curl -X GET "https://api.twitter.com/2/users/me" \
  -H "Authorization: OAuth oauth_consumer_key=…, oauth_token=…, ..." # use a helper like `twurl`
```

Easier: `wrangler tail --env preview` while triggering a "Post to Twitter" action from the app → response is `201 Created` with the tweet ID.

---

## 9. ElevenLabs

- **Why we use it.** TTS for podcast-style audio renders of completed debates. Consumed by the `podcast-generation-queue` in `apps/api`.
- **Login URL.** <https://elevenlabs.io/app/settings/api-keys>
- **Identity.** `ava@deadpixel.ai` via Google. Top-left workspace picker → switch to / create `DebateKit` workspace and invite Soheil.

### Steps

1. Settings → API Keys → "+ Create API Key":
   - Name: `debatekit-tts`
   - Permissions: text_to_speech, voices.read (the minimum; expand if you add features)
   - Workspace credit limit: 100k credits/month (raise as needed)
2. Copy the key (`sk_…` or 32-char hex; UI shows it once).
3. Settings → Voices → confirm the voice IDs the app uses are present in the `DebateKit` workspace (clone from "Voice Library" if not).

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `ELEVENLABS_API_KEY` | Settings → API Keys → debatekit-tts | `sk_…` | secret |

### Cost / free tier

Free: 10k chars/month, no commercial use. Starter ($5/mo) for ~30k. Creator ($22/mo) for 100k + commercial. Use Creator+ for prod.

### Sanity test

```
curl https://api.elevenlabs.io/v1/user \
  -H "xi-api-key: $ELEVENLABS_API_KEY"
# => 200 with subscription + character_count info
```

---

## 10. Upstash Redis

- **Why we use it.** Optional cache + rate limit store for `apps/api` chat threads (`UPSTASH_REDIS_REST_URL`/`_TOKEN` guarded by `if (env.UPSTASH_REDIS_REST_URL && ...)`). App functions without it but loses caching.
- **Login URL.** <https://console.upstash.com/redis>
- **Identity.** `ava@deadpixel.ai` via Google. Team picker (top-left) → switch to `DebateKit` team (create on first login, invite Soheil).

### Steps

1. "+ Create Database":
   - Name: `debatekit-prod` (and a separate `debatekit-preview` if you want isolation; otherwise share)
   - Type: **Regional** (cheaper, ~5ms from CF edge in same region)
   - Region: `us-east-1` (Virginia) — closest to our Cloudflare US edge cluster
   - TLS: **Enabled** (default)
   - Eviction: **allkeys-lru**
2. After creation → REST API tab → copy:
   - **UPSTASH_REDIS_REST_URL** (`https://<id>.upstash.io`)
   - **UPSTASH_REDIS_REST_TOKEN** (long base64 string)

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | DB → REST API → URL | `https://us1-foo-bar-12345.upstash.io` | secret-ish; treat as secret |
| `UPSTASH_REDIS_REST_TOKEN` | DB → REST API → Token | long base64 | secret |

### Cost / free tier

Free: 10k commands/day, 256 MB. Pay-as-you-go: $0.20 per 100k commands. Cheap.

### Sanity test

```
curl https://<id>.upstash.io/set/sanity/ok \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
# => { "result": "OK" }
```

---

## 11. Serper.dev

- **Why we use it.** Google search-results API used by the web-search tool in `apps/api`. The var is named `SERP_API_KEY` for historical reasons — the **provider is Serper.dev**, not serpapi.com.
- **Login URL.** <https://serper.dev/api-key>
- **Identity.** `ava@deadpixel.ai` via Google.

### Steps

1. Sign in → dashboard → API Key tab → "+ Generate new API key":
   - Name: `debatekit-server`
   - Monthly budget: 2,500 queries to start (Free tier)
2. Copy the key.

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `SERP_API_KEY` | Dashboard → API Key | 40-char alnum | secret |

### Cost / free tier

Free: 2,500 queries lifetime (not per month). Then $50 / 50k queries. Cheap relative to SerpAPI.com.

### Sanity test

```
curl https://google.serper.dev/search \
  -H "X-API-KEY: $SERP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q":"debatekit"}'
# => 200 with organic results array
```

---

## 12. Finnhub

- **Why we use it.** Optional financial-market data tool used when a debate touches stocks / public companies. Required for finance-domain debates; app degrades gracefully otherwise.
- **Login URL.** <https://finnhub.io/dashboard>
- **Identity.** `ava@deadpixel.ai` via Google.

### Steps

1. Sign in → dashboard auto-shows your free-tier API key on top.
2. (Optional) "+ Create new key" if you want a separate key per env. Single shared key is fine.

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `FINNHUB_API_KEY` | Dashboard top banner | 20-char alnum | secret |

### Cost / free tier

Free: 60 calls/min, US stocks + forex. Starter ($59/mo) for more endpoints + higher rate.

### Sanity test

```
curl "https://finnhub.io/api/v1/quote?symbol=AAPL&token=$FINNHUB_API_KEY"
# => { "c": <current price>, ... }
```

---

## 13. FRED (St. Louis Fed)

- **Why we use it.** Optional macroeconomic time-series data tool (GDP, CPI, etc.) used in economics debates. Free, instant signup.
- **Login URL.** <https://fred.stlouisfed.org/docs/api/api_key.html>
- **Identity.** Create a research.stlouisfed.org account with `ava@deadpixel.ai` if you don't have one (separate from Google SSO; email + password).

### Steps

1. Click "Request API Key" → fill out the short form:
   - Application name: `DebateKit`
   - Application URL: `https://debatekit.com`
   - Description: "AI-assisted debate platform; FRED data used in economics-themed debates."
2. Key is issued instantly — copy it.

### Keys to capture

| Var | UI location | Example shape | Notes |
|---|---|---|---|
| `FRED_API_KEY` | "My Account" → API Keys | 32-char lowercase hex | secret |

### Cost / free tier

Free, 120 calls/min, no quota.

### Sanity test

```
curl "https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=$FRED_API_KEY&file_type=json&limit=1"
# => 200 with observations array
```

---

## 14. Better-Auth shared secret

- **Why we have it.** Not a third-party service. `BETTER_AUTH_SECRET` is a self-generated symmetric key. Better-Auth uses it to (a) encrypt/sign session cookies in `apps/api`, (b) HMAC signed upload URLs, and (c) let `apps/mcp` verify the same sessions the API issued.
- **It is byte-identical across `apps/api` and `apps/mcp` in each env.** If they ever drift, sessions issued by the API stop validating in the MCP worker.

### Generate

```
openssl rand -base64 48
# => 64-char base64 string, e.g. "xQ8z…"
```

### Keys to capture

| Var | Used by | Notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | `apps/api`, `apps/mcp`, (`apps/web` template only) | secret; **same value in api + mcp per env**; different per env |

### Cost

Free. It's `/dev/urandom`.

### Sanity test

After deploy, sign in via the web app, then call an MCP tool that requires auth (`curl https://mcp-preview.debatekit.com/sse` with the session cookie). MCP returns user identity → secret matches.

If you ever rotate `BETTER_AUTH_SECRET`, all existing sessions are immediately invalid (users get signed out) — do it during a maintenance window and update **both** workers in the same deploy.

---

## Order of operations

Provisioning has dependencies — the wrong order means rework. Recommended sequence:

1. **Cloudflare account access.** Confirm `ava@deadpixel.ai` has access to Soheil's Cloudflare account `c21c4d074e34a8b1b9d335a41c2f69e3` (SSO or shared password). Without this you can't add the domain or provision workers / KV / D1 / R2 / Queues / Turnstile.
2. **Register `debatekit.com`** at Cloudflare Registrar (or transfer in), and add the zone to the account above.
3. **Provision Cloudflare resources** — run `scripts/provision-cf-resources.sh` (or follow `docs/ENV_VARS.md` § 1–2) to create D1, KV, R2, Queues, AI binding, Durable Object. Capture all resource IDs into the wrangler.jsonc files.
4. **Cloudflare Turnstile widget** (§7) — needs the zone to exist for domain whitelisting. The site key already in the repo is fine to reuse.
5. **Google OAuth client** (§3) — needs the canonical hostnames (`api-preview.debatekit.com`, `api.debatekit.com`) registered as redirect URIs, which requires steps 2–3 done first.
6. **In parallel (no inter-deps):** PostHog (§1), Stripe (§2), OpenRouter (§4), Upstash (§10), ElevenLabs (§9), Serper.dev (§11), Finnhub (§12), FRED (§13), Better-Auth secret (§14).
7. **AWS SES** (§5) — start the production-access request **early**; approval takes ~24 h and we can't send to non-verified addresses until it's done. The domain DKIM verification requires Cloudflare DNS (step 2).
8. **Twitter / X Developer Portal** (§8) — Basic tier review can take several days; start the application as soon as the company Twitter account exists. Free tier is enough for preview.
9. **Telegram BotFather** (§6) — last, because the prod webhook (`https://telegram.debatekit.com/webhook`) needs the integrations/telegram worker deployed to prod first. Create the bots earlier so you have the tokens; defer the `setWebhook` call until after deploy.
10. **Push everything to preview + prod** via `wrangler secret put` per `docs/DEPLOY_SECRETS.md`, then re-run `bun run cf-typegen` in each app so worker types pick up the new bindings.
11. **Sanity-check every service** using the per-service test commands above, plus `GET /system/health` on `apps/api` (returns 200 only when `BETTER_AUTH_SECRET` + `WEBAPP_ENV` are set) and `GET /api/v1/test/posthog` (returns `{ hasApiKey: true }`).

If you find yourself blocked waiting on AWS production access or Twitter Basic-tier approval, the rest of the app still works — magic-link email simply can't reach unverified inboxes and the tweet-posting queue will retry without progressing. Everything else is independent.
