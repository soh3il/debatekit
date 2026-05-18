# Reference: aiapplyd-webapp deployment pattern

Audit of `/Users/ava/Desktop/projects/aiapplyd-webapp` (Ava's other Cloudflare + TanStack Start monorepo). Each section documents how aiapplyd does it, then a one-line **Apply to debatekit** note. Adoption recommendations are at the bottom.

This doc is read-only context — no code changes follow from it directly.

---

## 1. Top-level layout

Bun + Turbo monorepo, workspaces under `apps/*`, `packages/*`, plus a small `infra/` directory:

```
aiapplyd-webapp/
  apps/{api,web,extension,mobile,video}
  packages/{shared,eslint-config,typescript-config,mcp-server,test-shim}
  infra/www-redirect/         # tiny www-apex redirect worker
  scripts/                    # repo-level scripts (memcap, marketing, migrations)
  tools/                      # internal tooling, scratch
```

Root `package.json`:
```json
"workspaces": ["apps/*", "packages/*"],
"packageManager": "bun@1.2.9"
```

**Apply to debatekit:** debatekit already follows the same shape — `apps/{api,web,mcp}` + `packages/{db,shared,...}` + `integrations/{slack,telegram,whatsapp,...}`. The `integrations/*` workspace globbing is debatekit-only and is the right call (aiapplyd has nothing equivalent because it doesn't ship Slack/Telegram bots). Consider adopting an `infra/` dir if debatekit ever needs a tiny apex/www redirect worker.

---

## 2. TanStack Start specifics

apps/web uses TanStack Start with `vite.config.ts` (no `app.config.ts` — Start's plugin replaces it). Key plugin order is documented as "official order per Cloudflare + TanStack docs":

```ts
plugins: [
  cloudflare({ viteEnvironment: { name: 'ssr' } }),  // MUST run first
  tanstackStart({ prerender: { enabled: false } }),
  react(),
  babel({ presets: [reactCompilerPreset()] }),        // React Compiler v1.0
  tailwindcss(),
  tsconfigPaths(),
],
```

Notable extras:
- `esbuild.drop: ['console','debugger']` only on `vite build` (dev keeps logs)
- Hand-rolled `manualChunks` carving `vendor-react`, `vendor-tanstack`, `vendor-ui`, `vendor-posthog`, `vendor-motion`, `vendor-forms`
- `ssr.optimizeDeps.exclude: ['vaul', 'nuqs']` plus `ssr.noExternal: ['posthog-js']`
- Dev proxy `/api → http://localhost:8787` with SSE-streaming-safe header rewrites (forces `Accept-Encoding: identity`, strips `content-length`/`content-encoding`, sets `x-accel-buffering: no`)
- `server.watch.ignored: ['**/routeTree.gen.ts']` so router codegen doesn't trigger reloads

`wrangler.jsonc` declares `main: "@tanstack/react-start/server-entry"` — Start owns the SSR worker entry point.

**Apply to debatekit:** debatekit's `apps/web/vite.config.ts` already mirrors this (cloudflare plugin first, tanstackStart, react, tailwind, tsconfigPaths) but is missing several real-world hardenings: React Compiler, esbuild console drop, manualChunks, the SSE proxy fix, and `ssr.optimizeDeps.exclude: ['vaul','nuqs']` (debatekit already has the last one — good). React Compiler addition is high-leverage given the codebase already runs React 19.

---

## 3. Cloudflare Workers integration (wrangler.jsonc)

Two apps (`apps/api`, `apps/web`) each have their own `wrangler.jsonc`. Pattern is **explicit per-env blocks under `env.preview` and `env.production`**, with the top level acting as "local". Naming convention:

```
top-level name:        aiapplyd-api          (local)
env.preview.name:      aiapplyd-preview-api
env.production.name:   aiapplyd-prod-api
```

Web mirrors the pattern: `aiapplyd-web` / `aiapplyd-preview-web` / `aiapplyd-prod-web`.

Shared across every env block:
```jsonc
"compatibility_date": "2026-01-30",
"compatibility_flags": ["nodejs_compat"],
"workers_dev": false,
"placement": { "mode": "smart" },
"observability": { "enabled": true, "head_sampling_rate": <env-tuned> },
"limits": { "cpu_ms": 300000 },
"minify": true,
```

Observability sampling is deliberately tuned per env:
- local: `head_sampling_rate: 1` (full)
- preview: `0.1` (10%)
- production: `0.05` (5%) — quota-conscious, with PostHog covering the gap

Bindings declared:
- `d1_databases` (DB) — different `database_id` per env, all point at the same `migrations_dir: ./src/db/migrations`
- `kv_namespaces` — one shared `KV` plus purpose-specific (`LOCATION_CACHE`, `OG_CACHE`)
- `r2_buckets` — `UPLOADS_BUCKET`, `COMPANY_ASSETS` (split for differing public-read rules + lifecycle)
- `ai: { binding: "AI" }` (Workers AI) — note: aiapplyd does NOT set `remote: true`
- `browser: { binding: "BROWSER" }` — Browser Rendering, prod-only by policy
- `vectorize` — per-env index
- `durable_objects` + `migrations` (sqlite-backed DOs, each new class adds a numbered tag)
- `queues.producers` + `queues.consumers` with per-queue `max_batch_size`, `max_batch_timeout`, `max_concurrency`, `max_retries`, `dead_letter_queue`

Routes are declared per env via `custom_domain: true`:
```jsonc
"routes": [{ "pattern": "api-preview.aiapplyd.com", "custom_domain": true }]
"routes": [{ "pattern": "api.aiapplyd.com",         "custom_domain": true }]
```

Vars-vs-secrets split is explicit:
- `vars` block — public-ish (Google OAuth client ID, PostHog public key, MAIL_FROM, feature flags)
- secrets — `wrangler secret put NAME --env <preview|production>`, documented in `.dev.vars.example`

Preview deliberately overrides `triggers.crons: []` to disable scheduled compute outside prod (cost policy).

**Apply to debatekit:** debatekit already follows essentially the same pattern (apps/api wrangler.jsonc has matching env blocks, the same per-env queue naming `*-local|preview|prod`, same custom_domain routes). Diverges:
- debatekit's `ai: { binding: "AI", remote: true }` — `remote: true` forces remote AI binding even from local dev, which costs real money. aiapplyd omits it. Worth reviewing.
- debatekit doesn't tune `observability.head_sampling_rate` per env (all at 0.1) — fine, but consider production at 0.05 to save quota at scale.
- debatekit has no `limits.cpu_ms` on the top-level local block, only on preview/prod. Harmless but inconsistent.
- debatekit does NOT split secrets-vs-vars in a `.dev.vars.example` with the level of inline commentary aiapplyd has. Worth borrowing.

---

## 4. Cloudflare Pages / Workers git integration

**aiapplyd is CLI-only.** There is no Pages project, no `pages_build_output_dir`, no `[build]` section beyond `build.watch_dir: ./src` (which only affects dev). All deploys go through `wrangler deploy`. The git-integrated CF Pages dashboard is not used.

apps/web has a quirky two-step deploy because TanStack Start generates a flat `dist/server/wrangler.json` that ignores wrangler env blocks:
```jsonc
"deploy:preview":   "bun run build:preview && bun run scripts/patch-wrangler-env.ts preview && bun run scripts/upload-sourcemaps.ts preview && bunx wrangler deploy -c dist/server/wrangler.json --old-asset-ttl 300",
"deploy:production":"bun run build:production && bun run scripts/patch-wrangler-env.ts production && bun run scripts/upload-sourcemaps.ts production && bunx wrangler deploy -c dist/server/wrangler.json --old-asset-ttl 300"
```

The `patch-wrangler-env.ts` script reads `wrangler.jsonc`, strips comments/trailing commas with a hand-rolled state machine, then patches `name`, `routes`, `vars`, `upload_source_maps`, `observability`, `workers_dev`, `placement` into the generated `dist/server/wrangler.json`. This is the workaround for Start's flat config.

apps/api's deploy is simpler (no Start codegen):
```jsonc
"deploy:preview":   "bunx wrangler deploy --env=preview    --keep-vars --define __APP_VERSION__:... --define process.env.NODE_ENV:..."
"deploy:production":"bunx wrangler deploy --env=production --keep-vars --define __APP_VERSION__:... --define process.env.NODE_ENV:..."
```

`--keep-vars` is important: it preserves any `wrangler secret put` values across deploys. Without it, secrets get wiped on each deploy.

**Apply to debatekit:** debatekit's apps/web/package.json runs `bunx wrangler deploy --env=preview` directly after `vite build`. This works today because debatekit doesn't appear to hit the Start-generates-flat-wrangler problem (no `patch-wrangler-env.ts` exists). Verify by inspecting `apps/web/.output/server/wrangler.json` after a build — if env blocks are missing, adopt aiapplyd's patcher script. debatekit's API deploy is missing `--keep-vars` and `--define __APP_VERSION__`, both of which are worth adopting.

---

## 5. GitHub Actions

aiapplyd has **two workflows**, both manual-only:

`.github/workflows/ci.yml`:
- Trigger: `workflow_dispatch` only ("disabled automatic triggers to save compute")
- Matrix lint+test across `apps/{api,web,video}` + `packages/{shared,mcp-server}`
- Separate `check-types` job runs `bunx turbo run check-types --filter=…` per workspace with `NODE_OPTIONS: --max-old-space-size=8192` (apps/api type graph OOMs on default 2GB)
- Bun setup pinned to `1.2.9`, Node `22`, caches `~/.bun/install/cache` keyed on `bun.lock`
- `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`
- **No deploy job in CI** — deploys are manual via `bun run deploy:preview/production` from a dev machine

`.github/workflows/e2e.yml`:
- Hard-disabled (`if: false`), exists as a placeholder with comments explaining what secrets need provisioning before enabling

There is no GitHub-Actions-driven deploy. No `secrets.CF_API_TOKEN` usage anywhere in the workflows.

**Apply to debatekit:** debatekit only has `.github/workflows/release.yml` (Changesets versioning bot). It has no CI lint/test job and no deploy job. Worth adopting aiapplyd's matrix lint+test pattern + the `NODE_OPTIONS --max-old-space-size=8192` workaround for typecheck OOMs — but keep both manual-trigger only to match the cost-conscious pattern. The "deploys are CLI-only from dev machine" decision is intentional in aiapplyd and probably right for debatekit too at this stage.

---

## 6. Bun / Turbo

Root scripts pattern (consistent across both projects):
```json
"dev":               "turbo run dev --filter=!@aiapplyd/mobile --filter=!@aiapplyd/video",
"build":             "turbo run build",
"lint":              "bun scripts/run-with-memcap.mjs bunx turbo run lint --concurrency=2",
"check-types":       "bun scripts/run-with-memcap.mjs bunx turbo run check-types --concurrency=2",
"deploy:preview":    "turbo run deploy:preview",
"deploy:production": "turbo run deploy:production"
```

The `run-with-memcap.mjs` wrapper sizes `--max-old-space-size` from real system memory:
```
per_process_mb = clamp(2 GB, total / (concurrency * 2.5), 8 GB)
```
This stops two parallel `tsc --noEmit` runs from pushing a 16 GB MacBook into swap.

`turbo.json` task graph:
```jsonc
"build":        { "dependsOn": ["^build"], "inputs": ["src/**","*.config.*","*.json","*.d.ts","wrangler.jsonc"], "outputs": [".output/**","dist/**",".next/**",".open-next/**"] },
"check-types":  { "dependsOn": ["^check-types","^build:types","generate:routes"], "inputs": [...,"*.d.ts"], "outputs": ["node_modules/.cache/tsc/**"] },
"cf-typegen":   { "inputs": ["wrangler.jsonc"], "outputs": ["cloudflare-env.d.ts","worker-configuration.d.ts"] },
"generate:routes": { "inputs": ["src/routes/**","tsr.config.json","vite.config.ts"], "outputs": ["src/routeTree.gen.ts"] },
"dev":          { "dependsOn": ["^build"], "cache": false, "persistent": true },
"deploy:preview":    { "dependsOn": ["build"], "inputs": ["src/**","wrangler.jsonc"] },
"deploy:production": { "dependsOn": ["build"], "inputs": ["src/**","wrangler.jsonc"] }
```

Key: `check-types` depends on `generate:routes` so the TanStack router codegen is always fresh before typecheck.

**Apply to debatekit:** debatekit's `turbo.json` is similar but missing `generate:routes` task (debatekit's route tree codegen happens implicitly through vite — fine but worth declaring for cache correctness), missing `build:types` (forces full build for downstream type consumers), and missing the memcap wrapper. The memcap wrapper is the highest-leverage borrow — debatekit's `check-types` script lacks any heap guardrail and will eventually OOM as the codebase grows.

---

## 7. Drizzle / D1

Schema lives at `apps/api/src/db/schema/*.ts`, migrations generated to `apps/api/src/db/migrations/`. drizzle config:

```ts
// apps/api/drizzle.config.ts
const isLocal   = process.env.WEBAPP_ENV === 'local';
const isPreview = process.env.WEBAPP_ENV === 'preview';

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  ...(isLocal
    ? { dbCredentials: { url: findLocalDbFile() } }   // walks .wrangler/state/v3/d1/miniflare-D1DatabaseObject for the *.sqlite
    : {
        driver: 'd1-http',
        dbCredentials: {
          accountId:  requireEnv('CLOUDFLARE_ACCOUNT_ID'),
          token:      requireEnv('D1_TOKEN'),
          databaseId: isPreview ? requireEnv('PREVIEW_DATABASE_ID') : requireEnv('PROD_DATABASE_ID'),
        },
      }),
});
```

Migration commands route through wrangler so the same `migrations_dir` in `wrangler.jsonc` is the single source of truth:
```json
"db:migrate:local":   "cd apps/api && bunx wrangler d1 migrations apply DB --local",
"db:migrate:preview": "cd apps/api && bunx wrangler d1 migrations apply DB --remote --env=preview",
"db:migrate:prod":    "cd apps/api && bunx wrangler d1 migrations apply DB --remote --env=production",
"db:studio:local":    "cd apps/api && WEBAPP_ENV=local    bunx drizzle-kit studio",
"db:studio:preview":  "cd apps/api && WEBAPP_ENV=preview  bunx drizzle-kit studio",
"db:studio:prod":     "cd apps/api && WEBAPP_ENV=prod     bunx drizzle-kit studio",
```

Local reset utilities (worth copying verbatim):
```json
"local:wipe-state":      "rm -rf .wrangler/state apps/api/.wrangler/state apps/web/.wrangler/state",
"db:full-reset:local":   "bun run local:wipe-state && bun run db:migrate:local && bun run db:seed:local",
"local:nuclear-reset":   "bun run clean && bun run local:wipe-state && bun run db:migrate:local && bun run db:seed:local"
```

Seed file layout under `apps/api/src/db/`:
```
seed-local.sql        # reference data + plans, test Stripe IDs
seed-prod.sql         # same shape, live Stripe IDs
seed-blog.sql         # shared scaffold (authors + categories)
seed-blog.sh          # runner: applies scaffold + every blog-posts/*.sql
blog-posts/001-*.sql  # one SQL file per post, sequentially numbered
```

**Apply to debatekit:** debatekit's `drizzle.config.ts` is BYTE-IDENTICAL to aiapplyd's except for `schema: './src/db/tables/*.ts'` (debatekit uses `tables/`, aiapplyd uses `schema/`). Migration commands match. debatekit already has `local:wipe-state`, `db:full-reset:local`, and `local:nuclear-reset` — good. Seed-file layout is simpler in debatekit (just `seed-local.sql`, `seed-preview.sql`, `seed-prod.sql`, `seed-admin-settings.sql`) — fine, the per-post split is aiapplyd-specific because of its blog volume.

---

## 8. Secrets / env

aiapplyd's secret-loading hierarchy:
1. `apps/api/.dev.vars` — wrangler auto-loads for `wrangler dev`, gitignored
2. `apps/api/.dev.vars.example` — committed, fully-documented template with `your-key-here` placeholders, inline comments explaining each var
3. `apps/web/.env` + `apps/web/.env.example` — Vite-loaded `VITE_*` only (browser-public)
4. Production: `wrangler secret put NAME --env <preview|production>` for each secret. No script automation in aiapplyd; comments in `.dev.vars.example` instruct operators per-secret.

The `.dev.vars.example` has rich inline commentary — e.g. each secret has 3-10 lines explaining what it does, where to mint it, what scopes are needed, and how to rotate.

Public/private split is explicit in `wrangler.jsonc` `vars` blocks: `AUTH_GOOGLE_ID` (public client ID) lives in `vars`; `AUTH_GOOGLE_SECRET` lives in `.dev.vars` → wrangler secrets.

**Apply to debatekit:** debatekit has `.dev.vars.example` files for `apps/{api,web,mcp}` + integrations, plus the `scripts/bootstrap-cf-secrets.sh` script (documented in `docs/DEPLOY_SECRETS.md`). debatekit is **more automated** here than aiapplyd — the bootstrap script reads `.dev.vars`, skips `<PENDING:*>` markers, and bulk-pushes secrets per worker per env. This is strictly better than aiapplyd's manual approach. Keep debatekit's pattern; consider adding aiapplyd-style rich per-secret commentary to debatekit's `.dev.vars.example` files for operator clarity.

---

## 9. Auth integration (Better Auth)

aiapplyd uses `better-auth` (v1.6.0) configured for Workers. Auth code under `apps/api/src/lib/auth/server/`:
```
auth.ts
email-handlers.ts
env.ts
index.ts
providers.ts
session-callbacks.ts
signup-hook-steps.ts
trusted-origins.ts
```

The auth instance is built lazily per-request using bindings from `env` (CF Worker env) — no module-level singleton because Worker isolates need per-request env access. Drizzle adapter wraps the D1 binding.

Public Google OAuth client ID is published in `wrangler.jsonc` `vars` (it's literally in the browser-facing OAuth flow). The OAuth secret is in `.dev.vars`/secrets only. Same `AUTH_GOOGLE_*` pattern across local/preview/prod.

Trusted origins is dynamic — `EXTENSION_IDS=dev-id,prod-id` env var feeds into Better Auth so the Chrome extension can hit the API without CORS rejection.

**Apply to debatekit:** debatekit also uses Better Auth 1.5.3 with `@better-auth/drizzle-adapter` and `@better-auth/api-key`. The setup is essentially the same. Both share the public `AUTH_GOOGLE_ID` in vars, secret in `.dev.vars` pattern. No divergence requiring action.

---

## 10. Quirks worth knowing

These are the gotchas that bit aiapplyd and would bite debatekit identically:

1. **TanStack Start generates a flat `dist/server/wrangler.json`** that ignores env blocks. aiapplyd's `apps/web/scripts/patch-wrangler-env.ts` is the fix. **If debatekit's web app ever needs per-env routes/vars to apply correctly after `vite build`, this script is the answer.**

2. **`wrangler.jsonc` parsing in scripts requires a hand-rolled comment stripper.** aiapplyd's `stripJsoncComments` is a 50-line state machine that handles strings, line comments, block comments, trailing commas. Reuse it.

3. **Source-map upload via PostHog CLI** is wired into the web deploy: `bun run scripts/upload-sourcemaps.ts <env>` runs between build and `wrangler deploy`. Requires `POSTHOG_CLI_API_KEY` (or falls back to `POSTHOG_PERSONAL_API_KEY`). Missing key → step warns and skips, build continues.

4. **Wrangler dev watcher reloads on Miniflare state writes** unless you scope it. aiapplyd sets `"build": { "watch_dir": "./src" }` in `wrangler.jsonc` to whitelist (the schema has no `watch.ignore`). Observed 28 reloads / 5 min idle before this fix.

5. **`--keep-vars` on `wrangler deploy`** preserves secrets across deploys. Without it, every deploy wipes secrets set via `wrangler secret put`.

6. **`compatibility_flags: ["nodejs_compat"]` is required everywhere** for Better Auth, Drizzle, and most npm packages on Workers. aiapplyd has it on every wrangler env block including the top-level local.

7. **D1 `database_id` for the top-level (local) block** is a placeholder string like `"local-db-placeholder"` in aiapplyd's api wrangler. wrangler only needs a real ID for `--remote` operations; local uses miniflare's sqlite file at `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`.

8. **Durable Object `migrations` array is append-only and order-sensitive.** Each new DO class gets a numbered tag (`v1`, `v2`, `v3`). aiapplyd's pattern: `{ "tag": "v1", "new_sqlite_classes": ["RateLimiterDO"] }`. Mirror the array verbatim across every env block.

9. **Queue binding names must match across all envs**, only the underlying queue name changes (`scrape-local` / `scrape-preview` / `scrape-prod` all bind to `SCRAPE_QUEUE`). DLQ names follow the same suffix.

10. **R2 bucket names need a region suffix in CF EU jurisdictions.** aiapplyd uses `aiapplyd-uploads-prod`; debatekit uses `debatekit-dashboard-r2-uploads-prod-weur` (the `-weur` is `WEUR`/Western Europe). Both work — just keep the suffix consistent.

11. **`upload_source_maps: false` in prod for size**, `true` in preview/local for debuggability. aiapplyd's api ships source maps to prod (`upload_source_maps: true`) explicitly for PostHog stack traces — see comment in `wrangler.jsonc`. Decide per worker whether stack traces are worth the bundle size.

12. **`POSTHOG_LOGS_ENABLED=true` everywhere** is a deliberate aiapplyd policy ("always max free tier in all envs"). Free tier is 50 GB/mo logs. Worst case is data loss, never a bill.

13. **Cron triggers are prod-only by policy.** aiapplyd's preview env block has `"triggers": { "crons": [] }` to override the inherited top-level cron list. Local + preview never burn scheduled compute.

14. **Browser Rendering (`browser` binding) is prod-only by policy.** Free tier is 10 browser-minutes/day, enforced at the call site via a KV-backed counter.

15. **`@cloudflare/vite-plugin` MUST be the first plugin** in `vite.config.ts` so it can resolve `cloudflare:workers` virtual modules before TanStack Start tries to walk workspace TS sources.

---

## Adoption recommendation

Concrete diffs debatekit should consider (in roughly priority order — do NOT apply automatically):

1. **Audit `apps/api/wrangler.jsonc`'s `ai: { binding: "AI", remote: true }`.** `remote: true` means local dev hits real Workers AI and bills. aiapplyd omits it (`ai: { binding: "AI" }`). Confirm this is intentional; if not, drop `remote: true`.
2. **Add `--keep-vars` to debatekit's api `deploy:preview` and `deploy:production` scripts.** Without it, every deploy wipes manually-set secrets.
3. **Add `--define __APP_VERSION__:"$(...)"` to debatekit's deploy commands** to bake the root package.json version into every deployed worker (useful for sentry/posthog stack-trace grouping).
4. **Borrow `scripts/run-with-memcap.mjs`** as a turbo wrapper for `lint` and `check-types`. Prevents OOM-induced swap thrashing as the type graph grows.
5. **Add `generate:routes` (and ideally `build:types`) tasks to `turbo.json`** so check-types has the right cache keys and depends on fresh router codegen.
6. **Add a manual-trigger `ci.yml` workflow** matching aiapplyd's pattern: matrix lint+test across workspaces + separate check-types job with `NODE_OPTIONS=--max-old-space-size=8192`. Manual-only is the right cost trade-off at debatekit's current scale.
7. **Enrich `.dev.vars.example` files with aiapplyd-style inline commentary** (where to mint each key, required scopes, rotation procedure). debatekit's bootstrap script is already better than aiapplyd's manual approach — keep the script, just upgrade the docs.
8. **Add React Compiler to `apps/web/vite.config.ts`** via `@rolldown/plugin-babel` + `reactCompilerPreset()`. Pure perf win on React 19.
9. **Add `esbuild: command === 'build' ? { drop: ['console','debugger'] } : {}`** to debatekit's vite config so prod bundles never leak console logs / PII.
10. **Add SSE-streaming proxy fix** (`Accept-Encoding: identity` + strip `content-length`/`content-encoding`) to debatekit's dev proxy so AI streaming responses don't buffer in dev.
11. **Add `build.watch_dir: "./src"` to debatekit's api `wrangler.jsonc`** to stop Miniflare state writes from triggering dev reloads.
12. **Tune `observability.head_sampling_rate`** per env: 1.0 local, 0.1 preview, 0.05 prod. Current debatekit is 0.1 across the board.
13. **After running `bun run build:preview` in apps/web, inspect `.output/server/wrangler.json`.** If env-specific `name`/`routes`/`vars` are missing, port aiapplyd's `apps/web/scripts/patch-wrangler-env.ts` verbatim. If they're present, skip — TanStack Start may have fixed this since aiapplyd's workaround was written.
14. **Consider a tiny `infra/www-redirect/` worker** if debatekit ever needs `www.debatekit.ai → debatekit.ai` apex redirect. aiapplyd's is ~15 lines.
15. **Manual chunks for vendor splitting** (`vendor-react`, `vendor-tanstack`, `vendor-ui`, etc.) in vite.config — only worth adopting once debatekit's bundle is large enough to measure.

Items 1, 2, and 4 are the lowest-effort / highest-impact. Item 13 is the riskiest divergence and worth verifying before it bites a production deploy.
