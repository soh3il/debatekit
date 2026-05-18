# Cloudflare Workers Builds ↔ GitHub git-integration

DebateKit ships via 6 Cloudflare Workers (`api`, `web`, `mcp`, `slack-bot`, `telegram-bot`, `whatsapp-bot`). Each can either be deployed via the canonical **GitHub Actions** path (see `.github/workflows/deploy-*.yml`) or via Cloudflare's built-in **Workers Builds** (formerly Pages Builds), which auto-deploys on every push to `soh3il/debatekit`.

## Decision: which deploy path?

| Concern | GitHub Actions (`deploy-*.yml`) | Workers Builds (CF dashboard) |
|---|---|---|
| Pre-deploy checks (typecheck, lint, tests) | yes — gates the deploy | no — runs build only |
| Build minutes | counted against your GH Actions quota | free up to a generous CF tier |
| Per-PR preview URLs | not built-in | automatic (`<sha>.debatekit-web-preview.workers.dev`) |
| Custom build commands | full bash, any tools | restricted to the build image |
| Best for | mainline deploys, prod | preview URLs on PRs |

**Recommended setup:**
- **Mainline / prod / preview env**: GitHub Actions (already wired in `.github/workflows/`).
- **Per-PR ephemeral previews**: Workers Builds, optionally, to get a shareable URL per PR without running the full Actions pipeline.
- **Do not enable both pointing at the same env** — they will race, deploy twice, and either succeed-then-overwrite or deadlock.

## Setup via Cloudflare dashboard (one-time, per worker)

For each of the 6 workers in `https://dash.cloudflare.com/67bc7b518b92a0c406ac9b8526ddbb6d/workers-and-pages`:

1. Click into the worker (or create it via `wrangler deploy` first).
2. **Settings → Build → Connect**.
3. Pick "GitHub", authorize the Cloudflare app on `soh3il/debatekit` if not already.
4. **Repository**: `soh3il/debatekit`.
5. **Production branch**: `main`.
6. **Root directory**: the worker's dir, e.g. `apps/api`, `apps/web`, `apps/mcp`, `integrations/slack`, `integrations/telegram`, `integrations/whatsapp`.
7. **Build command**:
   ```
   cd ../.. && bun install --frozen-lockfile && cd <ROOT_DIR> && bunx wrangler deploy --env=production --keep-vars
   ```
   For preview branches, the worker uses `--env=preview --keep-vars`. CF Workers Builds runs this automatically based on the branch (production branch = `main` → production env; any other branch → preview env).
8. **Build env vars** (optional, mostly empty for us — Vite picks up build-time `VITE_*` from `apps/web/.env*` which is committed):
   - `CI=true`
   - Anything else only if a `VITE_*` differs between CI and dev.
9. **Deploy**.

Repeat per worker. One-time but tedious — 6 workers × 2 envs entries.

## Setup via script (`scripts/setup-cf-git-integration.sh`)

The script reads each worker's `wrangler.jsonc`, then calls the Cloudflare API to attach the GitHub repo + branch config for all 6 workers in one pass.

```bash
export CLOUDFLARE_API_TOKEN="<token with Workers Builds Edit scope>"
./scripts/setup-cf-git-integration.sh --dry-run        # preview the plan
./scripts/setup-cf-git-integration.sh                  # actually attach
./scripts/setup-cf-git-integration.sh --app api        # one worker only
./scripts/setup-cf-git-integration.sh --env preview    # one env only
```

The script is idempotent — re-running just logs "exists" for already-attached workers.

## Coordinating GitHub Actions + Workers Builds

If you enable both for the same env, every push deploys twice and the later one wins. Pick:

- **Option A** (recommended): GitHub Actions for `preview` + `production`, Workers Builds disabled.
- **Option B**: GitHub Actions for `production` only, Workers Builds for `preview` (you get per-PR URLs automatically).
- **Option C**: Workers Builds for both; remove `.github/workflows/deploy-preview.yml` and `deploy-prod.yml`. You lose pre-deploy typecheck/lint gating.

To disable Workers Builds for a worker once attached: dashboard → Settings → Build → Disconnect.

## Secrets

Workers Builds has its own "Build env vars" panel — separate from the runtime env vars and secrets the worker reads.

- **Build-time public vars** (`apps/web/.env*` — committed `VITE_*` values): no panel entry needed; Vite reads them from the committed files.
- **Build-time secrets**: none in this repo today. If a future `BUILD_TIME_*` secret appears, set it in the Workers Builds env panel (separately per worker, per env).
- **Runtime secrets** (`apps/api/.dev.vars`, etc.): use `wrangler secret put` or `./scripts/bootstrap-cf-secrets.sh` — NOT the Workers Builds panel. CF Builds inherits the existing runtime secrets via `--keep-vars` in the deploy command.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `bun: command not found` in build log | CF build image lacks bun | Pick the "latest Ubuntu" image with bun preinstalled, or add `curl -fsSL https://bun.sh/install \| bash` as a pre-build step |
| Routes attaching to old worker | Custom Domain still points at the prior script | Worker → Settings → Triggers → Custom Domains → Disconnect old, attach new |
| Migrations not applied | Workers Builds doesn't run `wrangler d1 migrations apply` | Run migrations in a separate GH Actions workflow (`.github/workflows/db-migrate.yml`) before merging to `main` |
| Build fails with `account_id` mismatch | The CF account that owns the Worker isn't Soheil's | Re-attach from Soheil's account (`67bc7b51…`), not Ava's personal |
| Preview branch doesn't get a deploy | Build is "skip ci" or branch name has unusual chars | Check the Builds tab in the worker for the build attempt and its log |

## Verification

After attaching:

1. Push a small change (whitespace) on a feature branch → confirm a preview build runs and you get a shareable URL.
2. Open a PR → CF posts a comment with the preview link.
3. Merge to `main` → confirm production build runs and `https://api.debatekit.com` (or the relevant subdomain) updates.

## Related docs

- `docs/BOOTSTRAP.md` — the full zero-to-deployed flow.
- `docs/DEPLOY_SECRETS.md` — how `wrangler secret put` flows from `.dev.vars` to each env.
- `docs/REFERENCE_AIAPPLYD_PATTERN.md` — aiapplyd is currently CLI-deploy only; CF Builds is new infra in this repo.
