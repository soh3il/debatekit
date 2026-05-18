# DebateKit Environment Variables Inventory

Exhaustive inventory of every distinct env identifier the application code reads, grouped by worker / app / service. Generated from a static audit of:

- `process.env.X`, `import.meta.env.X`, `c.env.X`, `env.X` references in `.ts` / `.tsx` / `.js`
- `Bindings` / `Env` type declarations (`worker-configuration.d.ts`, `cloudflare-env.d.ts`, `env-augmentation.d.ts`, integration `Env` types)
- `vars` and secret bindings declared in every `wrangler.jsonc`
- Python `os.environ` / `os.getenv` for `dify` / `crewai` / `huggingface`

Column legend for every table:

| Column | Meaning |
|---|---|
| **Var** | Identifier name |
| **Required?** | `yes` = code throws / crashes / wrong-defaults if missing; `optional` = has a fallback or guarded by `if` |
| **Public/Secret** | `public` = browser-exposed `VITE_*` or wrangler `vars` (committed); `secret` = `.dev.vars` / `wrangler secret put` |
| **Issuer** | Where you get a value |
| **Where it's used** | Representative `file:line` (not exhaustive) |
| **Notes** | Format quirks, defaults, etc. |

---

## apps/api — Cloudflare Worker (Hono REST API)

Worker name: `debatekit-api` / `debatekit-api-preview` / `debatekit-api-prod`. Account `67bc7b51…`. Routes: `api-preview.debatekit.ai` / `api.debatekit.ai`. Config: `./apps/api/wrangler.jsonc`. Type bindings: `./apps/api/cloudflare-env.d.ts` + `./apps/api/env-augmentation.d.ts`. Secret template: `./apps/api/.dev.vars.example`.

### Bindings (non-env services — listed for completeness)

| Binding | Type | Notes |
|---|---|---|
| `DB` | D1Database | IDs in `wrangler.jsonc`: local `12ce87b8-…`, preview `ce0a7c86-…`, prod `74073b18-…` |
| `KV` | KVNamespace | local `0ab8201d…`, preview `146b84bc…`, prod `8c335928…` |
| `UPLOADS_R2_BUCKET` | R2Bucket | `debatekit-dashboard-r2-uploads-{local,preview-weur,prod-weur}` |
| `AI` | Cloudflare AI | `remote: true` |
| `UPLOAD_CLEANUP_SCHEDULER` | DurableObjectNamespace | class `UploadCleanupScheduler` (sqlite-backed) |
| `TITLE_GENERATION_QUEUE`, `ROUND_ORCHESTRATION_QUEUE`, `PODCAST_GENERATION_QUEUE`, `TWEET_POSTING_QUEUE`, `EMAIL_SENDING_QUEUE` | Queue | five Cloudflare Queues per env, all with DLQs |

### Public vars (wrangler `vars`)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `WEBAPP_ENV` | yes | public | constant per env | `./apps/api/src/middleware/posthog-api-tracking.ts:68`, `./apps/api/src/lib/auth/utils.ts:74`, `./apps/api/drizzle.config.ts:29` | one of `local` / `preview` / `prod`; drives URL config |
| `APP_NAME` | yes | public | constant | `./apps/api/worker-configuration.d.ts`, OpenAPI doc | hard-coded `"DebateKit API"` |
| `NODE_ENV` | yes | public | constant per env | `./apps/api/src/index.ts:487`, `./apps/api/src/db/index.ts:109`, many | `development` locally, `production` deployed |
| `TURNSTILE_SITE_KEY` | yes | public | Cloudflare → Turnstile widget | `./apps/api/cloudflare-env.d.ts:21` | client-facing site key `0x4AAAAAACN3_OeMcDjErTqV` (same for all envs) |
| `R2_PUBLIC_URL` | yes | public | derived | `./apps/api/src/core/config.ts:273` | `http://localhost:8787/uploads`, `https://api-preview.debatekit.ai/uploads`, `https://api.debatekit.ai/uploads` |
| `AWS_SES_REGION` | yes | public | AWS console | `./apps/api/src/lib/email/ses-service.ts`, wrangler vars | `eu-north-1` |
| `FROM_EMAIL` | yes | public | constant | `./apps/api/.dev.vars.example`, wrangler vars | `noreply@debatekit.ai` |
| `SES_REPLY_TO_EMAIL` | yes | public | constant | wrangler vars | `support@debatekit.ai` |
| `SES_VERIFIED_EMAIL` | yes | public | AWS SES → Verified Identities | wrangler vars | `noreply@debatekit.ai`; must be SES-verified |
| `MARKETING_FROM_EMAIL` | yes | public | constant | `./apps/api/src/lib/email/ses-service.ts:320` | `hello@mail.debatekit.ai` |
| `STRIPE_CUSTOMER_PORTAL_CONFIG_ID` | yes | public | Stripe Dashboard → Customer Portal config | wrangler vars | `bpc_…`; differs between test (preview) and live (prod) |
| `STRIPE_PUBLISHABLE_KEY` | yes | public | Stripe Dashboard → API Keys | wrangler vars | `pk_test_…` (local/preview), `pk_live_…` (prod) |
| `AUTH_GOOGLE_ID` | yes | public | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client | `./apps/api/src/lib/auth/server/index.ts:127,138` | OAuth client ID (`*.apps.googleusercontent.com`) |
| `BETTER_AUTH_URL` | yes | public | derived from environment | `./apps/api/src/lib/auth/server/index.ts:208,209`, `./apps/api/src/index.ts:489` | full base URL of API; `http://localhost:8787` / `https://api-preview.debatekit.ai` / `https://api.debatekit.ai` |
| `POSTHOG_HOST` | yes | public | PostHog → project | wrangler vars | `https://us.i.posthog.com` |

### Secrets (set via `wrangler secret put` / `.dev.vars`)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `BETTER_AUTH_SECRET` | yes | secret | self-generated, min 32 chars | `./apps/api/src/lib/auth/server/index.ts:103-104`, `./apps/api/src/routes/system/handler.ts:116`, `./apps/api/src/routes/email/handler.ts:152,171,205`, `./apps/api/src/services/uploads/signed-url.service.ts:125,181,235`, `./apps/api/src/services/uploads/upload-ticket.service.ts:130,233`, `./apps/api/src/core/handlers.ts:338` | session cookie encryption + signed-URL HMAC; MUST match `apps/mcp` and `apps/web` |
| `AUTH_GOOGLE_SECRET` | yes | secret | Google Cloud Console → OAuth Client | `./apps/api/src/lib/auth/server/index.ts:130,131,139` | paired with `AUTH_GOOGLE_ID` |
| `TURNSTILE_SECRET_KEY` | yes | secret | Cloudflare → Turnstile | `./apps/api/cloudflare-env.d.ts:36` | server-side Turnstile verify |
| `AWS_SES_ACCESS_KEY_ID` | yes | secret | AWS IAM | `./apps/api/.dev.vars.example:11` | IAM user scoped to `ses:SendEmail` |
| `AWS_SES_SECRET_ACCESS_KEY` | yes | secret | AWS IAM | `./apps/api/.dev.vars.example:12` | paired with access key id |
| `STRIPE_SECRET_KEY` | yes | secret | Stripe Dashboard → API Keys | wrangler secret | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | yes | secret | Stripe Dashboard → Webhooks → endpoint signing secret | wrangler secret | `whsec_…`; differs per webhook endpoint |
| `OPENROUTER_API_KEY` | yes | secret | OpenRouter → API Keys | `./apps/api/src/services/search/__tests__/web-search-query.test.ts:14`, `./apps/api/cloudflare-env.d.ts:41` | `sk-or-…`; used by all LLM call paths |
| `POSTHOG_API_KEY` | yes | secret | PostHog → Project Settings → API Keys (server-side) | `./apps/api/src/routes/test/handler.ts:65`, `./apps/api/cloudflare-env.d.ts:42` | distinct from `VITE_POSTHOG_API_KEY` (client) |
| `SERP_API_KEY` | optional | secret | Serper.dev | `./apps/api/src/services/search/serper.service.ts:127,197`, `./apps/api/src/services/search/web-search.service.ts:347,909` | required for web-search feature only |
| `UPSTASH_REDIS_REST_URL` | optional | secret | Upstash → Redis → REST URL | `./apps/api/src/routes/chat/handlers/thread.handler.ts:2411,2415` | guarded by `if (c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN)` |
| `UPSTASH_REDIS_REST_TOKEN` | optional | secret | Upstash → Redis → REST token | `./apps/api/src/routes/chat/handlers/thread.handler.ts:2411,2414` | as above |
| `ELEVENLABS_API_KEY` | yes (for podcast) | secret | ElevenLabs → Profile → API Keys | `./apps/api/env-augmentation.d.ts:30` | podcast generation queue consumer |
| `FINNHUB_API_KEY` | optional | secret | Finnhub → API Tokens | `./apps/api/src/services/streaming/unified-stream-orchestration.service.ts:648,1162,1681`, `./apps/api/src/services/search/domain-sources/registry.ts:20` | domain data source for finance queries |
| `FRED_API_KEY` | optional | secret | FRED (St. Louis Fed) → My Account → API Keys | `./apps/api/src/services/search/domain-sources/fred.service.ts:117,120` | macroeconomic data source |
| `TWITTER_API_KEY` | yes (for tweet posting) | secret | X / Twitter Developer Portal → app → keys & tokens | `./apps/api/env-augmentation.d.ts:26` | OAuth 1.0a consumer key |
| `TWITTER_API_SECRET` | yes (for tweet posting) | secret | as above | `./apps/api/env-augmentation.d.ts:27` | OAuth 1.0a consumer secret |
| `TWITTER_ACCESS_TOKEN` | yes (for tweet posting) | secret | X / Twitter Developer Portal → app → access tokens | `./apps/api/env-augmentation.d.ts:24` | OAuth 1.0a user token |
| `TWITTER_ACCESS_TOKEN_SECRET` | yes (for tweet posting) | secret | as above | `./apps/api/env-augmentation.d.ts:25` | OAuth 1.0a user token secret |

### Legacy / centralized config (`./apps/api/src/core/config.ts`)

`./apps/api/src/core/config.ts` defines a giant Zod-validated schema that *can* read additional vars if present (none are required because all have defaults or are `.optional()`). These are read via `getEnv(key)` against the worker `cloudflare:workers` `env` import with `process.env` fallback:

| Var | Required? | Public/Secret | Notes |
|---|---|---|---|
| `API_BASE_PATH` | optional | public | default `/api` |
| `API_URL` | optional | public | derived from `BETTER_AUTH_URL` if missing |
| `API_VERSION` | optional | public | default `v1` |
| `APP_URL` | optional | public | optional; centralized base-URLs use `WEBAPP_ENV` instead |
| `APP_VERSION` | optional | public | falls back to `package.json` version |
| `CSRF_SECRET` | optional | secret | not currently set by any wrangler config; placeholder |
| `DATABASE_AUTH_TOKEN`, `DATABASE_CONNECTION_LIMIT`, `DATABASE_MIGRATION_DIR`, `DATABASE_SEED_DATA`, `DATABASE_TIMEOUT`, `LOCAL_DATABASE_PATH` | optional | mixed | inert in Cloudflare D1 setup; defaults used |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE` | optional | public | defaults are fine |
| `EMAIL_ENABLED`, `EMAIL_PROVIDER`, `EMAIL_QUEUE_ENABLED`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SMTP_HOST`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER` | optional | mixed | unused in current flow (SES used directly), kept for forward compat |
| `ALLOWED_FILE_TYPES`, `MAX_FILE_SIZE`, `MAX_IMAGE_SIZE`, `USER_STORAGE_QUOTA` | optional | public | upload limit defaults |
| `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_SECRET_ACCESS_KEY` | optional | secret | unused — R2 bound via worker binding instead |
| `ANALYTICS_ENABLED`, `GOOGLE_ANALYTICS_ID`, `LOG_FORMAT`, `LOG_LEVEL`, `LOG_SENSITIVE_DATA`, `METRICS_ENDPOINT`, `PERFORMANCE_MONITORING`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | optional | mixed | monitoring placeholders, mostly unused |
| `DEVTOOLS_ENABLED`, `ENABLE_DEBUG_MODE`, `ENABLE_QUERY_LOGGING`, `FAST_REFRESH`, `STORYBOOK_ENABLED`, `TURBO_MODE` | optional | public | dev flags |

These are tolerated-but-unused unless a future code path starts requiring them. The `parseEnvironment()` call only throws if validation fails on a *required* field — all here are optional.

---

## apps/web — Cloudflare Worker (TanStack Start frontend + SSR)

Worker name: `debatekit-web` / `debatekit-web-preview` / `debatekit-web-prod`. Routes: `web-preview.debatekit.ai` / `debatekit.ai`. Build: Vite + `@cloudflare/vite-plugin`. Config: `./apps/web/wrangler.jsonc`. Type bindings: `./apps/web/src/vite-env.d.ts`. Env validation: `./apps/web/src/lib/env.ts`. Build-time `.env` files: `./apps/web/.env`, `./apps/web/.env.preview`, `./apps/web/.env.production`. Local secret template: `./apps/web/.dev.vars.example`.

### Vite build-time vars (statically replaced in client + SSR bundles)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `VITE_WEBAPP_ENV` | yes | public | constant per env file | `./apps/web/src/lib/env.ts:77`, `./apps/web/src/lib/config/base-urls.ts:75` | `local` / `preview` / `prod`; defaults to `prod` in Zod (safety) |
| `VITE_MAINTENANCE` | optional | public | constant | `./apps/web/src/lib/env.ts:75` | `"true"` / `"false"`; parsed to boolean; default `false` |
| `VITE_POSTHOG_API_KEY` | optional | public | PostHog → project → public API key | `./apps/web/src/lib/env.ts:76` | `phc_…`; designed for client exposure |

Vite built-ins used: `import.meta.env.MODE`, `import.meta.env.PROD`, `import.meta.env.DEV`, `import.meta.env.SSR`, `import.meta.env.BASE_URL` (see `./apps/web/src/vite-env.d.ts`). These are not user-settable.

### Wrangler `vars` (SSR runtime fallback — Cloudflare Workers cannot use Vite static replacement at runtime in SSR mode, so values are duplicated as wrangler vars)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `VITE_WEBAPP_ENV` | yes | public | constant per env | `./apps/web/wrangler.jsonc:22,43,64` | mirrors `.env` file |
| `VITE_MAINTENANCE` | optional | public | constant | `./apps/web/wrangler.jsonc:23,44,65` | mirrors `.env` file |
| `VITE_POSTHOG_API_KEY` | optional | public | PostHog | `./apps/web/wrangler.jsonc:24,45,66` | mirrors `.env` file |

### Secrets

`./apps/web/.dev.vars.example` mentions `BETTER_AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_SES_REGION`, `FROM_EMAIL`, `SES_REPLY_TO_EMAIL` as "secrets the SSR worker needs". These are **not actually read from `apps/web`'s code** — the web worker proxies auth/email through the API. They exist in the example to share dev-machine state.

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `BETTER_AUTH_SECRET` | optional in `apps/web` | secret | self | (template only — no direct reader) | template lists it; runtime calls go through `apps/api` |
| `AUTH_GOOGLE_SECRET` | optional in `apps/web` | secret | Google | (template only) | as above |
| `AWS_SES_*`, `FROM_EMAIL`, `SES_REPLY_TO_EMAIL` | optional in `apps/web` | secret/public | AWS / constant | (template only) | as above |

---

## apps/mcp — Cloudflare Worker (MCP server)

Worker name: `debatekit-mcp` / `debatekit-mcp-preview` / `debatekit-mcp-prod`. Routes: `mcp-preview.debatekit.ai` / `mcp.debatekit.ai`. Shares D1 + KV with `apps/api`. Config: `./apps/mcp/wrangler.jsonc`. Type bindings: `./apps/mcp/worker-configuration.d.ts` + `./apps/mcp/src/types.ts`. Secret template: `./apps/mcp/.dev.vars.example`.

### Bindings

| Binding | Type | Notes |
|---|---|---|
| `DB` | D1Database | **same DB IDs as `apps/api`** (auth + credits) |
| `KV` | KVNamespace | **same KV IDs as `apps/api`** (rate limit + cache) |

### Public vars

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `WEBAPP_ENV` | yes | public | constant per env | `./apps/mcp/src/auth-callback.ts:184,294`, `./apps/mcp/src/oauth.ts:170,235` | `local` / `preview` / `prod` |
| `APP_NAME` | yes | public | constant | `./apps/mcp/src/index.ts:90` | `"DebateKit MCP"` |
| `POSTHOG_HOST` | yes | public | PostHog | `./apps/mcp/src/lib/posthog.ts:20,31` | `https://us.i.posthog.com` |
| `NODE_ENV` | yes | public | constant per env | wrangler vars | `development` / `production` |

### Secrets (set via `wrangler secret put` / `.dev.vars`)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `OPENROUTER_API_KEY` | yes | secret | OpenRouter | `./apps/mcp/src/engine/evaluator.ts:145`, `./apps/mcp/src/engine/providers/openrouter.ts:49` | LLM calls for all MCP tools |
| `BETTER_AUTH_SECRET` | yes | secret | self (must match `apps/api`) | `./apps/mcp/src/types.ts:18`, OAuth code paths | shared session secret with API |
| `POSTHOG_API_KEY` | optional | secret | PostHog | `./apps/mcp/src/lib/posthog.ts:20,28` | analytics disabled if missing or `WEBAPP_ENV === 'local'` |

---

## integrations/slack — Cloudflare Worker

Worker name: `debatekit-slack-bot[-preview|-prod]`. Route: `slack.debatekit.ai` (prod). Config: `./integrations/slack/wrangler.jsonc`. Env type: `./integrations/slack/src/index.ts:33-46`. Secret template: `./integrations/slack/.dev.vars.example`.

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `DEBATEKIT_API_URL` | yes | public | constant per env | wrangler `vars` | `http://localhost:8788` / `https://mcp-preview.debatekit.ai` / `https://mcp.debatekit.ai` |
| `DEBATEKIT_APP_URL` | yes | public | constant per env | wrangler `vars` | `http://localhost:3000` / `https://preview.debatekit.ai` / `https://debatekit.ai` |
| `DEBATEKIT_API_KEY` | yes | secret | DebateKit dashboard → Settings → API Keys | `./integrations/slack/src/index.ts:36`, used as fallback when workspace has no per-team key | `rpnd_…` prefix |
| `SLACK_CLIENT_ID` | yes | secret | Slack app settings → Basic Information | `./integrations/slack/src/index.ts:38` | OAuth |
| `SLACK_CLIENT_SECRET` | yes | secret | Slack app settings → Basic Information | `./integrations/slack/src/index.ts:40` | OAuth |
| `SLACK_BOT_TOKEN` | yes (fallback) | secret | Slack app → OAuth & Permissions → Install | `./integrations/slack/src/index.ts:42` | `xoxb-…`; fallback used when no per-team token is in KV |
| `SLACK_SIGNING_SECRET` | yes | secret | Slack app → Basic Information → Signing Secret | `./integrations/slack/src/index.ts:43` | request signature verification |

(KV binding name: `KV`; per-env IDs in wrangler.jsonc.)

---

## integrations/telegram — Cloudflare Worker

Worker: `debatekit-telegram-bot[-preview|-prod]`. Route: `telegram.debatekit.ai` (prod). Config: `./integrations/telegram/wrangler.jsonc`. Env type: `./integrations/telegram/src/index.ts:36-49`. Secret template: `./integrations/telegram/.dev.vars.example`.

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `DEBATEKIT_API_URL` | yes | public | constant per env | wrangler `vars` | as Slack |
| `DEBATEKIT_APP_URL` | yes | public | constant per env | wrangler `vars` | as Slack |
| `TELEGRAM_BOT_USERNAME` | yes | public | Telegram BotFather | wrangler `vars` | `debatekitnowbot`; used for `@mention` detection in groups |
| `BOT_INFO` | optional | public | output of grammY `getMe` | `./integrations/telegram/src/index.ts:40` | cached `getMe` JSON to avoid runtime calls |
| `DEBATEKIT_API_KEY` | yes | secret | DebateKit dashboard | `./integrations/telegram/src/index.ts:42` | fallback when chat has no own key in KV |
| `TELEGRAM_BOT_TOKEN` | yes | secret | Telegram BotFather | `./integrations/telegram/src/index.ts:46` | `123456:abc…` |
| `TELEGRAM_WEBHOOK_SECRET` | yes | secret | self-generated | `./integrations/telegram/src/index.ts:48` | passed to Telegram on `setWebhook`; verified on inbound |

---

## integrations/whatsapp — Cloudflare Worker

Worker: `debatekit-whatsapp-bot[-preview|-prod]`. Route: `whatsapp.debatekit.ai` (prod). Config: `./integrations/whatsapp/wrangler.jsonc`. Env type: `./integrations/whatsapp/src/index.ts:32-46`. Secret template: `./integrations/whatsapp/.dev.vars.example`.

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `DEBATEKIT_API_URL` | yes | public | constant per env | wrangler `vars` | as Slack |
| `DEBATEKIT_APP_URL` | yes | public | constant per env | wrangler `vars` | as Slack |
| `DEBATEKIT_API_KEY` | yes | secret | DebateKit dashboard | `./integrations/whatsapp/src/index.ts:35` | fallback when chat has no own key |
| `WHATSAPP_ACCESS_TOKEN` | yes | secret | Meta → WhatsApp Business → System Users → Access Token | `./integrations/whatsapp/src/index.ts:38` | "system user" token (never-expiring) |
| `WHATSAPP_APP_SECRET` | yes | secret | Meta → App Dashboard → App Secret | `./integrations/whatsapp/src/index.ts:40` | webhook signature verification |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | secret | Meta → WhatsApp → Phone Numbers | `./integrations/whatsapp/src/index.ts:42` | sender phone ID |
| `WHATSAPP_VERIFY_TOKEN` | yes | secret | self-generated | `./integrations/whatsapp/src/index.ts:44` | echoed back on Meta webhook challenge |

---

## integrations/zapier — Zapier Platform package

Distributed as a Zapier app. Env is bundled via Zapier's `bundle.authData` system, not `process.env`.

| Var (Zapier auth field) | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `api_key` | yes | secret | DebateKit dashboard | `./integrations/zapier/src/authentication.ts` | end-user enters at install; `rpnd_…` prefix |

`./integrations/zapier/.env.example` only lists `DEBATEKIT_API_KEY` for local CLI testing (`zapier test`).

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `DEBATEKIT_API_KEY` | optional (CLI only) | secret | DebateKit dashboard | `./integrations/zapier/.env.example` | only used by `zapier test` / `zapier validate` |

---

## integrations/n8n — n8n community node package

Distributed as `n8n-nodes-debatekit`. End-user supplies credentials via n8n UI (`./integrations/n8n/credentials/DebateKitApi.credentials.ts`); no `process.env` reads in node code itself.

| n8n credential field | Required? | Public/Secret | Issuer | Notes |
|---|---|---|---|---|
| `apiKey` | yes | secret | DebateKit dashboard | `rpnd_…` |
| `baseUrl` | optional | public | DebateKit URL | default `https://mcp.debatekit.ai` |

Dev-time only:

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `N8N_CUSTOM_EXTENSIONS` | yes (dev only) | public | local path | `./integrations/n8n/.env.example` | path to compiled `n8n-nodes-debatekit` so n8n loads it |

---

## integrations/dify — Dify plugin (Python)

`./integrations/dify/manifest.yaml` declares a credentials block for end-user-supplied values. No `os.environ` reads in tool code.

| Dify credential field | Required? | Public/Secret | Issuer | Notes |
|---|---|---|---|---|
| `api_key` | yes | secret | DebateKit dashboard | `rpnd_…`; read in `./integrations/dify/tools/_base.py:31` via `self.runtime.credentials.get('api_key')` |
| `base_url` | optional | public | DebateKit URL | default `https://mcp.debatekit.ai`; read in `./integrations/dify/tools/_base.py:27` |

---

## integrations/crewai — Python package (PyPI: `crewai-debatekit`)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `DEBATEKIT_API_KEY` | yes (if not passed to `DebateKitClient(api_key=…)`) | secret | DebateKit dashboard | `./integrations/crewai/src/crewai_debatekit/api.py:78` | must start with `rpnd_`; raises `ValueError` otherwise |

Base URL is a constructor arg (default `https://mcp.debatekit.ai/api/v1`), not env-driven.

---

## integrations/huggingface — Gradio app (Python, deployed to HF Spaces)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `DEBATEKIT_API_KEY` | yes | secret | DebateKit dashboard | `./integrations/huggingface/app.py:70` | set via HF Spaces → Settings → Repository Secrets |

`API_BASE` and `APP_URL` are hard-coded constants in `app.py` (not env vars).

---

## integrations/dxt — Desktop Extension (MCP, distributed as `.dxt`)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `DEBATEKIT_API_KEY` | yes | secret | DebateKit dashboard | `./integrations/dxt/src/index.ts:33`, `./integrations/dxt/server/index.js:24` | end user sets via Claude Desktop settings panel exposed by `manifest.json` |
| `DEBATEKIT_BASE_URL` | optional | public | DebateKit URL | `./integrations/dxt/src/index.ts:34`, `./integrations/dxt/server/index.js:25` | defaults to MCP base URL; trailing slash stripped |

---

## integrations/raycast — Raycast extension

Preferences UI provides values at runtime — no `process.env`.

| Raycast preference | Required? | Public/Secret | Issuer | Notes |
|---|---|---|---|---|
| `apiKey` | yes | secret | DebateKit dashboard | `rpnd_…`; see `./integrations/raycast/raycast-env.d.ts:12` |
| `baseUrl` | optional | public | DebateKit URL | `./integrations/raycast/raycast-env.d.ts:14` |

Read via `getPreferenceValues<Preferences>()` in `./integrations/raycast/src/api.ts`.

---

## integrations/pipedream — Pipedream component package

End-user-supplied credentials, no `process.env` reads. Auth structure mirrors Zapier/n8n (`apiKey` + `baseUrl`).

---

## integrations/shared — Internal TS package

No env reads. Pure HTTP client / formatters.

---

## packages/google-ads-mcp — Standalone MCP server (Node stdio)

Loads `.env` from package dir at startup, then reads via `process.env`. Template: `./packages/google-ads-mcp/.env.example`.

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `GOOGLE_ADS_CLIENT_ID` | yes | secret | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client | `./packages/google-ads-mcp/src/google-ads-client.ts:43`, `./packages/google-ads-mcp/scripts/setup-oauth.ts:66` | OAuth desktop / web client |
| `GOOGLE_ADS_CLIENT_SECRET` | yes | secret | same | `./packages/google-ads-mcp/src/google-ads-client.ts:44` | OAuth client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | yes | secret | generated by `bun run setup` (`./packages/google-ads-mcp/scripts/setup-oauth.ts:142`) | `./packages/google-ads-mcp/src/google-ads-client.ts:45` | long-lived OAuth refresh token |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | yes | secret | <https://ads.google.com/aw/apicenter> | `./packages/google-ads-mcp/src/google-ads-client.ts:70` | sent as `developer-token` header |
| `GOOGLE_ADS_CUSTOMER_ID` | yes | public | Google Ads → account selector (10 digits) | `./packages/google-ads-mcp/src/google-ads-client.ts:30` | hyphens stripped on use |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | optional | public | manager (MCC) account ID | `./packages/google-ads-mcp/src/google-ads-client.ts:73` | only when operating via manager account |

---

## packages/db, packages/shared, packages/eslint-config, packages/typescript-config — no runtime env

The shared `create-logger.ts` only mentions `process.env.NODE_ENV` in a JSDoc example, never reads it.

---

## packages/vitest-config — test runner config

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `CI` | optional | public | CI runner (GitHub Actions etc.) | `./packages/vitest-config/base.ts:37,38`, `./packages/vitest-config/react.ts:17,23` | truthy in CI → reporters change, workers reduced |

---

## scripts/ — repo-level bash/ts scripts

Run from the host shell, not inside workers. Read from `.env` at repo root (`./.env`).

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | yes (for that script) | secret | Cloudflare → My Profile → API Tokens (scopes: Workers + D1 + R2) | `./scripts/clear-r2-cache.ts:137` | repo `.env` (see `./.env.example`) |
| `BASE_URL` | optional | public | dev URL | `./scripts/setup-e2e-auth.ts:16` | defaults to `http://localhost:3000` for E2E auth setup |
| `CLOUDFLARE_ACCOUNT_ID` | yes | public | Cloudflare account ID | `./apps/api/drizzle.config.ts:43` | hard-coded value `67bc7b51…` in `.env.example`; used by `db:studio:preview/prod` |
| `D1_TOKEN` | yes (for remote D1 studio) | secret | Cloudflare API token scoped to D1:Edit | `./apps/api/drizzle.config.ts:44` | can be same as `CLOUDFLARE_API_TOKEN` if scoped right |
| `PREVIEW_DATABASE_ID` | yes (for `db:studio:preview`) | public | wrangler.jsonc | `./apps/api/drizzle.config.ts:46` | `ce0a7c86-…` |
| `PROD_DATABASE_ID` | yes (for `db:studio:prod`) | public | wrangler.jsonc | `./apps/api/drizzle.config.ts:47` | `74073b18-…` |
| `NODE_ENV` | optional | public | runner | many test/build scripts | `development` / `production` / `test` |
| `NODE_VERSION` | optional | public | constant | `./.env.example:37` | engines pin |
| `PNPM_VERSION` | optional | public | constant | `./.env.example:38` | engines pin |
| `VERBOSE` | optional | public | user | `./.env.example:41` | unused but documented |
| `LOG_LEVEL` | optional | public | user | `./.env.example:44` | unused but documented |
| `MINIFLARE_LOG_LEVEL` | optional | public | user | `./.env.example:47` | passed to wrangler when set |
| `WRANGLER_BUILD_CONDITIONS`, `WRANGLER_BUILD_PLATFORM` | optional | public | bundler debug | `./.env.example:50-51` | rarely needed |
| `BETTER_AUTH_URL` | optional | public | constant | `./.env.example:84` | runtime fallback for off-worker auth calls |
| `POSTHOG_HOST` | optional | public | PostHog | `./.env.example:87` | reporting tooling |

### Vitest setup files (test-only)

| Var | Required? | Public/Secret | Issuer | Where it's used | Notes |
|---|---|---|---|---|---|
| `VITE_APP_URL`, `VITE_WEBAPP_ENV` | optional | public | hard-coded in `./apps/web/vitest.setup.ts:25,26` | test-time override | `http://localhost:5173`, `local` |
| `APP_URL`, `WEBAPP_ENV`, `BETTER_AUTH_URL` | optional | public | hard-coded in `./apps/api/vitest.setup.ts:24,25,26` | test-time override | `http://localhost:8787`, `local`, `http://localhost:8787` |
| `OPENROUTER_API_KEY` | optional | secret | OpenRouter | `./apps/api/src/services/search/__tests__/web-search-query.test.ts:14` | integration test skips if empty |

---

## Cross-cutting vars (shared across multiple workers)

Same string, used by 2+ workers. When you rotate or regenerate one of these, update **everywhere**:

| Var | Workers it appears in | Sync requirement |
|---|---|---|
| `BETTER_AUTH_SECRET` | `apps/api`, `apps/mcp`, optionally `apps/web` (.dev.vars only) | **must be byte-identical** across api + mcp — sessions and signed URLs are HMAC'd with it |
| `OPENROUTER_API_KEY` | `apps/api`, `apps/mcp` | can be the same key; tracked spend lumps together |
| `POSTHOG_API_KEY` | `apps/api`, `apps/mcp` | server-side ingest key; distinct from `VITE_POSTHOG_API_KEY` (client) |
| `POSTHOG_HOST` | `apps/api`, `apps/mcp`, repo `.env` | always `https://us.i.posthog.com` for DebateKit |
| `DEBATEKIT_API_KEY` (fallback) | `integrations/slack`, `integrations/telegram`, `integrations/whatsapp` | fallback when no per-tenant key in KV |
| `DEBATEKIT_API_URL` | `integrations/slack`, `integrations/telegram`, `integrations/whatsapp` | per env: localhost / `mcp-preview.debatekit.ai` / `mcp.debatekit.ai` |
| `DEBATEKIT_APP_URL` | `integrations/slack`, `integrations/telegram`, `integrations/whatsapp` | per env: localhost / `preview.debatekit.ai` / `debatekit.ai` |
| `WEBAPP_ENV` | `apps/api`, `apps/mcp`, `apps/web` (as `VITE_WEBAPP_ENV`), repo scripts | drives all base-URL resolution |
| `NODE_ENV` | every worker + scripts | `development` locally, `production` deployed |
| `CLOUDFLARE_ACCOUNT_ID` | every wrangler.jsonc, repo `.env` | `67bc7b518b92a0c406ac9b8526ddbb6d` |

---

## Provisioning order (from scratch)

For a brand new contributor or a brand new account, do this in order:

### 1. Cloudflare account + domain

1. Register `debatekit.ai` (Cloudflare Registrar or transferred in).
2. Add the zone to Soheil's Cloudflare account `67bc7b518b92a0c406ac9b8526ddbb6d`.
3. Create a Cloudflare API token (`CLOUDFLARE_API_TOKEN`) with these scopes:
   - Account → Workers Scripts: Edit
   - Account → Workers KV Storage: Edit
   - Account → Workers R2 Storage: Edit
   - Account → D1: Edit
   - Account → Cloudflare AI: Edit
   - Zone → DNS: Edit (for custom domains)
4. Create a scoped `D1_TOKEN` (can reuse `CLOUDFLARE_API_TOKEN` if scoped right). Used only by `drizzle-kit` studio.

### 2. Cloudflare resources

D1 databases (capture IDs and put in `apps/api/wrangler.jsonc` + `apps/mcp/wrangler.jsonc`):

```
debatekit-dashboard-db-local     -> 12ce87b8-9d6d-4c54-a9d4-7c59ceb3ef8e
debatekit-dashboard-db-preview   -> ce0a7c86-7ac5-46c8-bf25-3df0a2345f9c
debatekit-dashboard-db-prod      -> 74073b18-b9ef-4801-8176-4159905047d1
```

KV namespaces (capture IDs):

```
KV (api+mcp shared) local   -> 0ab8201d8a9d43b7ab8e4236026e4811
KV (api+mcp shared) preview -> 146b84bc30474873a73161b779c19b81
KV (api+mcp shared) prod    -> 8c335928a67d4d5db3de6e52f685296f
KV (slack)   preview -> fcaa64e7…  prod -> 349cd174…
KV (telegram) prod -> 078a524…
KV (whatsapp) prod -> ed3faca0…
```

R2 buckets:

```
debatekit-dashboard-r2-uploads-local
debatekit-dashboard-r2-uploads-preview-weur
debatekit-dashboard-r2-uploads-prod-weur
```

Cloudflare Queues (five per env, each with `-dlq` deadletter):

```
title-generation-queue-{local,preview,prod}
round-orchestration-queue-{local,preview,prod}
podcast-generation-queue-{local,preview,prod}
tweet-posting-queue-{local,preview,prod}
email-sending-queue-{local,preview,prod}
```

Turnstile widget → site key (currently `0x4AAAAAACN3_OeMcDjErTqV`) + secret (`TURNSTILE_SECRET_KEY`).

### 3. External services (one-time provisioning)

| Service | What to provision | Captures |
|---|---|---|
| Google Cloud Console | OAuth 2.0 client (web app); add redirect URIs for localhost + preview + prod | `AUTH_GOOGLE_ID` (public), `AUTH_GOOGLE_SECRET` (secret) |
| PostHog | new project | `VITE_POSTHOG_API_KEY` (`phc_…` for client), `POSTHOG_API_KEY` (server), `POSTHOG_HOST` |
| Stripe | new account; configure Customer Portal | `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CUSTOMER_PORTAL_CONFIG_ID` (one per test + live) |
| OpenRouter | account → API keys | `OPENROUTER_API_KEY` (single key, used by api + mcp) |
| AWS SES | verify `noreply@debatekit.ai`, `hello@mail.debatekit.ai`; create IAM user scoped to `ses:SendEmail` | `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_SES_REGION=eu-north-1`, `SES_VERIFIED_EMAIL`, `MARKETING_FROM_EMAIL` |
| Serper.dev | optional, for web-search feature | `SERP_API_KEY` |
| Upstash | optional Redis instance | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| ElevenLabs | account → API keys | `ELEVENLABS_API_KEY` |
| X/Twitter Developer Portal | app with read+write; OAuth 1.0a user tokens | `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET` |
| Finnhub | optional, finance data | `FINNHUB_API_KEY` |
| FRED (St. Louis Fed) | optional, macro data | `FRED_API_KEY` |
| Slack | new Slack app for each env (or test workspace) | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` |
| Telegram BotFather | new bot per env | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, plus self-generated `TELEGRAM_WEBHOOK_SECRET` |
| Meta WhatsApp Business | app + phone number + system user | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, self-generated `WHATSAPP_VERIFY_TOKEN` |
| Self-generated | `BETTER_AUTH_SECRET` (32+ chars, e.g. `openssl rand -hex 32`) — same value for api + mcp | one secret per env, identical across api/mcp/web in that env |

### 4. Local `.dev.vars` files

For each app/integration, copy `.dev.vars.example` → `.dev.vars` and fill in the values you collected:

```
apps/api/.dev.vars
apps/web/.dev.vars
apps/mcp/.dev.vars
integrations/slack/.dev.vars
integrations/telegram/.dev.vars
integrations/whatsapp/.dev.vars
```

Plus repo-root:

```
cp .env.example .env
# fill in CLOUDFLARE_API_TOKEN, D1_TOKEN
```

And for `packages/google-ads-mcp` (only if running the Google Ads MCP):

```
cp packages/google-ads-mcp/.env.example packages/google-ads-mcp/.env
bun run --filter=google-ads-mcp setup     # generates GOOGLE_ADS_REFRESH_TOKEN interactively
```

### 5. Push secrets to preview + prod

For each worker, push every secret in its `.dev.vars` to the deployed environment:

```bash
# apps/api — preview
cd apps/api
for var in BETTER_AUTH_SECRET AUTH_GOOGLE_SECRET TURNSTILE_SECRET_KEY \
           AWS_SES_ACCESS_KEY_ID AWS_SES_SECRET_ACCESS_KEY \
           STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
           OPENROUTER_API_KEY POSTHOG_API_KEY \
           SERP_API_KEY UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN \
           ELEVENLABS_API_KEY \
           TWITTER_API_KEY TWITTER_API_SECRET TWITTER_ACCESS_TOKEN TWITTER_ACCESS_TOKEN_SECRET \
           FINNHUB_API_KEY FRED_API_KEY; do
  wrangler secret put "$var" --env preview
done
# repeat with --env production

# apps/mcp — both envs
cd ../mcp
for var in OPENROUTER_API_KEY BETTER_AUTH_SECRET POSTHOG_API_KEY; do
  wrangler secret put "$var" --env preview
  wrangler secret put "$var" --env production
done

# integrations/slack — both envs
cd ../../integrations/slack
for var in DEBATEKIT_API_KEY SLACK_CLIENT_ID SLACK_CLIENT_SECRET SLACK_BOT_TOKEN SLACK_SIGNING_SECRET; do
  wrangler secret put "$var" --env preview
  wrangler secret put "$var" --env production
done

# integrations/telegram
cd ../telegram
for var in DEBATEKIT_API_KEY TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET BOT_INFO; do
  wrangler secret put "$var" --env preview
  wrangler secret put "$var" --env production
done

# integrations/whatsapp
cd ../whatsapp
for var in DEBATEKIT_API_KEY WHATSAPP_ACCESS_TOKEN WHATSAPP_APP_SECRET WHATSAPP_PHONE_NUMBER_ID WHATSAPP_VERIFY_TOKEN; do
  wrangler secret put "$var" --env preview
  wrangler secret put "$var" --env production
done
```

After secrets are pushed, regenerate types: `bun run cf-typegen` from each app to refresh `worker-configuration.d.ts` / `cloudflare-env.d.ts`.

### 6. Sanity-check after provisioning

- `bun run check-types` — every worker compiles with bindings present.
- `wrangler tail --env preview` on each worker and exercise the smoke flow.
- `GET /api/v1/test/posthog` in `apps/api` returns `{ hasApiKey: true, host: 'https://us.i.posthog.com', environment: '<env>' }` (per `./apps/api/src/routes/test/handler.ts:65`).
- `GET /system/health` in `apps/api` returns `200` (per `./apps/api/src/routes/system/handler.ts:116` — checks `BETTER_AUTH_SECRET` + `WEBAPP_ENV`).
