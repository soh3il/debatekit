# Deploying secrets to Cloudflare

How `.dev.vars` becomes preview/prod secrets, and the order to do it in.

See also: `docs/ENV_VARS.md` (variable catalog + provisioning order for D1 / R2 / KV / queues).

## 1. Prerequisites

- **Wrangler auth**: either
  - `wrangler login` (browser OAuth, picks up the Cloudflare account), or
  - export `CLOUDFLARE_API_TOKEN=...` with `Account:Workers Scripts:Edit` + `Account:D1:Edit` + `Account:R2:Edit` + `Account:Workers KV Storage:Edit`.
  Confirm with `wrangler whoami`. The bootstrap script also checks this.
- **Account ID** must be `67bc7b518b92a0c406ac9b8526ddbb6d` (Soheil's account). The script warns if it sees a different one.
- **Zone**: `debatekit.ai` configured in the Cloudflare account, with the routes referenced in each `wrangler.jsonc` (`api.`, `api-preview.`, `mcp.`, `mcp-preview.`, `web-preview.`, `slack.`, `telegram.`, `whatsapp.` + apex).
- **Provisioned resources** must exist before any deploy — D1 dbs, R2 buckets, KV namespaces, and queues. IDs are hard-coded in each `wrangler.jsonc`; create matching resources or update the IDs. Detailed list in `docs/ENV_VARS.md` → "Provisioning order".

## 2. How `.dev.vars` maps to deployed secrets

Each worker has a `.dev.vars` file (gitignored, local-only) that wrangler auto-loads in `wrangler dev`. The same keys are what we want as Cloudflare secrets in preview + prod.

Wrangler has `secret bulk`, but our multi-env `wrangler.jsonc` setup means we'd still loop per env. The bootstrap script does that:

```
parse apps/<x>/.dev.vars
  → for each KEY=value (skip blanks, comments, <PENDING:*>, empty)
  → cd apps/<x> && echo -n "$value" | wrangler secret put KEY --env <preview|production>
```

Targeted worker dirs:

| Key        | Dir                     | Workers (local / preview / prod)                                                  |
| ---------- | ----------------------- | --------------------------------------------------------------------------------- |
| `api`      | `apps/api`              | `debatekit-api` / `debatekit-api-preview` / `debatekit-api-prod`                   |
| `web`      | `apps/web`              | `debatekit-web` / `debatekit-web-preview` / `debatekit-web-prod`                   |
| `mcp`      | `apps/mcp`              | `debatekit-mcp` / `debatekit-mcp-preview` / `debatekit-mcp-prod`                   |
| `slack`    | `integrations/slack`    | `debatekit-slack-bot` / `debatekit-slack-bot-preview` / `debatekit-slack-bot-prod` |
| `telegram` | `integrations/telegram` | `debatekit-telegram-bot{,-preview,-prod}`                                          |
| `whatsapp` | `integrations/whatsapp` | `debatekit-whatsapp-bot{,-preview,-prod}`                                          |

The wrangler env names are `preview` and `production` (script flag is `--env preview|prod|both`).

## 3. Run order

```bash
# 1. Install
bun install

# 2. Fill in .dev.vars for each worker (copy from .dev.vars.example, replace
#    placeholders). Anything left as <PENDING:...> is skipped by the script.
cp apps/api/.dev.vars.example apps/api/.dev.vars                # etc.

# 3. Migrate D1 (preview + prod). Per package.json:
bun run db:migrate:preview
bun run db:migrate:prod

# 4. Push secrets — dry-run first, then apply.
./scripts/bootstrap-cf-secrets.sh --env preview --dry-run
./scripts/bootstrap-cf-secrets.sh --env preview --yes

./scripts/bootstrap-cf-secrets.sh --env prod --dry-run
./scripts/bootstrap-cf-secrets.sh --env prod --yes

# Scope to one worker with --app <api|web|mcp|slack|telegram|whatsapp>:
./scripts/bootstrap-cf-secrets.sh --app api --env prod --yes

# 5. Deploy the workers.
bun run deploy:preview       # turbo → each app's deploy:preview
bun run deploy:production    # turbo → each app's deploy:production
```

For single-app deploys, the per-app scripts live in each `package.json`:
`apps/api/package.json`, `apps/web/package.json`, `apps/mcp/package.json`,
and `integrations/{slack,telegram,whatsapp}/package.json` all expose
`deploy:preview` and `deploy:production` (using `wrangler deploy --env=...`).

## 4. Rollback

If a deploy goes wrong:

```bash
cd apps/<app>
bunx wrangler rollback --env=preview        # or production
# pick an older version interactively, or pass --message + --version-id
```

Rollback only rolls back the worker bundle, **not** secrets. If you uploaded a
broken secret, fix the value in `.dev.vars` and re-run the bootstrap script — `wrangler secret put` overwrites.

## 5. Common errors

- **`Account ID mismatch`** — `wrangler whoami` shows a different account. Either re-`wrangler login`, or set `CLOUDFLARE_ACCOUNT_ID=67bc7b518b92a0c406ac9b8526ddbb6d`, or pick the right account in the API token.
- **`R2 bucket "..." does not exist`** — bucket missing in the account. Create it (`wrangler r2 bucket create debatekit-dashboard-r2-uploads-preview-weur` etc.) before deploying. See `docs/ENV_VARS.md`.
- **`KV namespace not found` / `D1 database not found`** — the IDs in `wrangler.jsonc` reference resources in a specific account. Either you're on the wrong account or the resources weren't created.
- **`Authentication error [code: 10000]`** — API token expired or missing scopes. Regenerate with the scopes listed in §1.
- **`secret put` hangs** — usually a TTY prompt waiting for input. The script pipes the value on stdin; if you run `wrangler secret put` manually you'll be prompted interactively.
- **Queue producer/consumer missing** — `wrangler deploy --env=production` will fail if the queues (`title-generation-queue-prod`, `round-orchestration-queue-prod`, etc.) and their DLQs don't exist. Create them with `wrangler queues create <name>`.
- **`<PENDING:*> values silently skipped`** — that's intentional. The script summary shows the skip count per app; fill them in and re-run.
- **Web worker has no secrets** — `apps/web` only needs `VITE_*` vars which are build-time (Vite). `bootstrap-cf-secrets.sh` will report 0 uploads for `web` unless you actually put runtime secrets in `apps/web/.dev.vars`.
