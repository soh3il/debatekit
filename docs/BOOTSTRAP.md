# DebateKit Bootstrap

From `git clone` to a live `https://debatekit.com` in one sitting.

This is the master "from zero to deployed" runbook. Other docs go deep on individual steps — this one stitches them together in order. If a section feels thin, follow the linked doc.

---

## 0. TL;DR

Already have `.dev.vars` populated, Cloudflare auth done, and resources provisioned? Skip to deploy:

```bash
./scripts/preflight-check.sh --env prod
./scripts/bootstrap-cf-secrets.sh --env prod --yes
bun run deploy:production
```

Otherwise: do sections **1 → 8** in order. First-time setup is ~60–90 min, almost all of it waiting on DNS and external service onboarding.

---

## 1. Prerequisites

| Tool                 | Why                                                    | Install                                                         |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| macOS / Linux        | Cloudflare Workers tooling assumes a Unix shell        | Native. **Windows users: use WSL2.**                            |
| `bun >= 1.3`         | Package manager + runtime + script runner              | `curl -fsSL https://bun.sh/install \| bash`                     |
| `wrangler` (CLI)     | Cloudflare deploys, D1 migrations, secret management   | Comes via `bun install`. Optional global: `bun add -g wrangler` |
| Git + SSH key on GH  | Clone + push                                           | Standard setup                                                  |
| Node `>= 22.14.0`    | Some tooling (Drizzle, Remotion) shells out to Node    | `nvm install 22 && nvm use 22`                                  |

### Account access checklist

- [ ] **Cloudflare**: Soheil's account ID `67bc7b518b92a0c406ac9b8526ddbb6d`. Team members log in via Google SSO using their `@deadpixel.ai` email, then switch to Soheil's account from the dashboard chooser.
- [ ] **GitHub**: Push access to `soh3il/debatekit`.
- [ ] **GoDaddy** (optional, only for DNS swap): registrar login is `firstexhotic@gmail.com`. Needed only the first time `debatekit.com` is pointed at Cloudflare.
- [ ] **1Password / shared vault**: where production secrets and seed values live. Ask Soheil if you don't have access.

Verify the toolchain in one shot:

```bash
bun --version          # >= 1.3
node --version         # >= 22.14
wrangler --version     # any 4.x
git --version
```

---

## 2. Clone and install

```bash
git clone git@github.com:soh3il/debatekit.git
cd debatekit
bun install
```

`bun install` installs the workspace root plus every app under `apps/*`, `packages/*`, and `integrations/*`. Expect ~30s on a warm cache.

If you'll be deploying, log in to Cloudflare now:

```bash
bunx wrangler login         # opens browser
bunx wrangler whoami        # confirm you landed on Soheil's account
```

If `whoami` shows the wrong account, run `bunx wrangler logout` and log back in with the right Google identity.

---

## 3. Cloudflare setup (one-time per environment)

This is the heaviest section, and the only one you do exactly once per environment (preview, prod).

### 3a. Domain

Follow **`docs/DOMAIN_MIGRATION.md`** end to end:

1. Register `debatekit.com` on the registrar (already done — listed under `firstexhotic@gmail.com`).
2. Add the zone to Cloudflare under Soheil's account.
3. Swap nameservers at the registrar to the Cloudflare-issued pair.
4. Wait for the zone to flip to **Active** in the Cloudflare dashboard (usually < 1 hour, occasionally up to 24).

Until the zone is Active, you can still deploy workers — they'll just live on `*.workers.dev` URLs. Custom domain routing won't bind.

### 3b. Resources (D1, R2, KV)

Once the zone is Active:

```bash
./scripts/provision-cf-resources.sh --dry-run     # preview what it'll create
./scripts/provision-cf-resources.sh               # actually create
```

The script:

- Creates the D1 database, R2 buckets, and KV namespaces for every environment (`local`/`preview`/`production`).
- Writes the generated IDs back into `wrangler.jsonc` in the right `[env.X]` block.
- Skips anything that already exists, so it's safe to re-run.

After it finishes, commit the updated `wrangler.jsonc` (the IDs are not secret).

---

## 4. External services (one-time)

DebateKit depends on a handful of third-party services. Each needs an account, a project/app, and one or more API keys.

Follow **`docs/EXTERNAL_SERVICES.md`** for the full provisioning checklist. The short version:

| Service           | What you need                                              | Where it goes                                |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------- |
| PostHog           | Project API key + personal API key                         | `POSTHOG_API_KEY`, `POSTHOG_PERSONAL_KEY`    |
| Stripe            | Test + live secret keys, webhook signing secrets           | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Google OAuth      | Client ID + secret per env, redirect URIs configured       | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`   |
| OpenRouter        | API key with model allowlist                               | `OPENROUTER_API_KEY`                         |
| AWS SES           | Verified sender + SMTP credentials, region `eu-central-1`  | `AWS_SES_*`                                  |
| Telegram          | BotFather token per env (separate bot for preview/prod)    | `TELEGRAM_BOT_TOKEN`                         |
| Slack             | App credentials (only if Slack integration is enabled)     | `SLACK_*`                                    |

For every env file (`apps/api/.dev.vars`, `apps/web/.dev.vars`, `apps/mcp/.dev.vars`):

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.dev.vars.example apps/web/.dev.vars
cp apps/mcp/.dev.vars.example apps/mcp/.dev.vars
```

Then fill in the real values you collected above. **Every key in the example file must be present** — `wrangler dev` does not tolerate missing or `<PENDING:…>` placeholders, and the preflight check will fail loudly later if any remain.

See **`docs/ENV_VARS.md`** for the canonical list of every variable, what it does, and which env it belongs in.

---

## 5. Email (one-time)

DebateKit uses Cloudflare Email Routing for inbound (`reply@debatekit.com`, `support@debatekit.com`, …) and AWS SES for outbound transactional mail.

Follow **`docs/EMAIL_SETUP.md`** to:

1. Verify the SES sender domain (DKIM + SPF + DMARC records, all added in Cloudflare DNS).
2. Move SES out of sandbox if you'll be sending to non-verified addresses.
3. Configure Cloudflare Email Routing rules.

Then bind the routing rules to the API worker:

```bash
./scripts/setup-email-routing.sh
```

Re-run anytime you add a new inbound address.

---

## 6. Local dev

Migrate the local D1 schema and start every worker:

```bash
bun run db:migrate:local        # apply Drizzle migrations to the local D1
bun run dev                     # turbo spins up api / web / mcp on separate ports
```

Default ports:

| App   | URL                       |
| ----- | ------------------------- |
| `web` | `http://localhost:3000`   |
| `api` | `http://localhost:8787`   |
| `mcp` | `http://localhost:8788`   |

`.dev.vars` is the runtime secret source for `wrangler dev` — there is no `.env`. If you change a value, restart `bun run dev`; wrangler does not hot-reload secrets.

Useful local commands:

```bash
bun run db:studio:local              # Drizzle Studio UI for local D1
bun run db:full-reset:local          # wipe + re-migrate + re-seed
bun run local:nuclear-reset          # clean + wipe + re-migrate + re-seed (when things are wedged)
bun run check-types                  # full repo type check
bun run lint                         # ESLint
bun run test                         # vitest, all packages
```

---

## 7. Preview deploy

Preview is the safety net for prod. Every change should land here first.

```bash
./scripts/preflight-check.sh --env preview
./scripts/bootstrap-cf-secrets.sh --env preview --dry-run    # review the diff
./scripts/bootstrap-cf-secrets.sh --env preview --yes        # actually push
bun run db:migrate:preview                                   # apply pending migrations
bun run deploy:preview
```

What each step does:

- **`preflight-check.sh`** — confirms wrangler is logged in to the right account, every required secret has a value, every resource ID in `wrangler.jsonc` resolves, no `<PENDING>` placeholders remain.
- **`bootstrap-cf-secrets.sh`** — diffs your local `.dev.vars` against the secrets currently set on each worker, then bulk-uploads anything missing or changed. Always run with `--dry-run` first.
- **`db:migrate:preview`** — applies pending Drizzle migrations to the remote preview D1.
- **`deploy:preview`** — `turbo run deploy:preview`, which deploys `api`, `web`, `mcp` in parallel.

Verify the result:

- `https://web-preview.debatekit.com` — landing + app
- `https://api-preview.debatekit.com/health` — should return `{ "ok": true }`

---

## 8. Production deploy

Same shape as preview. Confirm preview is healthy first.

```bash
./scripts/preflight-check.sh --env prod
./scripts/bootstrap-cf-secrets.sh --env prod --dry-run
./scripts/bootstrap-cf-secrets.sh --env prod --yes
bun run db:migrate:prod
bun run deploy:production
```

Verify:

- `https://debatekit.com` — landing + app
- `https://api.debatekit.com/health` — `{ "ok": true }`
- One real end-to-end flow: sign up, start a debate, confirm a transactional email arrives.

See **`docs/DEPLOY_SECRETS.md`** for the secret rotation policy and emergency-revoke procedures.

---

## 9. Rollback

Cloudflare auto-pins the previous version of each worker for **7 days**. To revert:

```bash
bunx wrangler rollback --env=production --name=debatekit-api
bunx wrangler rollback --env=production --name=debatekit-web
bunx wrangler rollback --env=production --name=debatekit-mcp
```

Rolling back code does **not** roll back D1 migrations. If you shipped a destructive migration, recover from the most recent D1 backup (Cloudflare → D1 → your DB → **Time Travel**). See **`docs/DEPLOY_SECRETS.md`** for the incident playbook.

---

## 10. Day-2 ops

### Add a new env var

1. Add to `apps/<app>/.dev.vars.example` with a short comment.
2. Add the real value to your local `apps/<app>/.dev.vars`.
3. Document it in **`docs/ENV_VARS.md`**.
4. Push to each remote env:

   ```bash
   ./scripts/bootstrap-cf-secrets.sh --env preview --yes
   ./scripts/bootstrap-cf-secrets.sh --env prod --yes
   ```
5. Redeploy.

### Add a new D1 column

```bash
bun run db:generate              # generates migration SQL from Drizzle schema
bun run db:migrate:local         # apply locally first
bun run db:migrate:preview       # apply to preview, smoke test
bun run db:migrate:prod          # apply to prod
```

Migrations are forward-only. Never edit a migration that's already been applied to a remote DB.

### Rotate a secret

```bash
bunx wrangler secret put SECRET_NAME --env preview
bunx wrangler secret put SECRET_NAME --env production
```

For bulk rotation, update `.dev.vars` and re-run `bootstrap-cf-secrets.sh`.

### Add a new worker app

1. `cp -r apps/api apps/<new>` as a starting template.
2. Update `apps/<new>/wrangler.jsonc` (name, routes, bindings).
3. Add `apps/<new>` to the root `package.json` workspaces array.
4. Add deploy scripts to `apps/<new>/package.json` (`deploy:preview`, `deploy:production`) so turbo picks them up.
5. Run `bun install` from the repo root to wire it in.
6. `./scripts/provision-cf-resources.sh` to create any new bindings.

---

## 11. Troubleshooting

| Symptom                                                | Likely cause                                       | Fix                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `wrangler deploy` fails with `Authentication error`    | Wrong Cloudflare account or expired session        | `bunx wrangler logout && bunx wrangler login`, verify with `bunx wrangler whoami`    |
| `D1 binding "DB" not found`                            | Resource never provisioned for this env            | `./scripts/provision-cf-resources.sh`, then redeploy                                 |
| TypeScript errors right after `git pull`               | `cloudflare-env.d.ts` out of sync                  | `bun install && bun run cf-typegen`                                                  |
| OAuth `redirect_uri_mismatch`                          | Google OAuth client missing the env's callback URL | Add `https://<env>.debatekit.com/api/auth/callback/google` to the OAuth client        |
| `bun run dev` exits with "missing required env var X"  | `.dev.vars` is incomplete                          | Diff against `.dev.vars.example`, populate the missing key                           |
| Preview deploy succeeds but page 404s                  | Custom domain route not bound                      | Check the `routes` block in `apps/web/wrangler.jsonc`; zone must be Active           |
| `db:migrate:prod` says "no migrations to apply" but schema is stale | Drizzle metadata table out of sync     | Open Drizzle Studio against prod, inspect `__drizzle_migrations`, escalate to Soheil |
| Outbound email silently drops                          | SES still in sandbox, or destination not verified  | Move SES out of sandbox; see **`docs/EMAIL_SETUP.md`** §5                            |

For anything not listed here, check **`docs/FLOW_DOCUMENTATION.md`** for the architectural map of how requests flow through the system.

---

## Related docs

| Doc                                | What it covers                                     |
| ---------------------------------- | -------------------------------------------------- |
| `docs/DOMAIN_MIGRATION.md`         | Registering and pointing `debatekit.com` at Cloudflare |
| `docs/EXTERNAL_SERVICES.md`        | PostHog, Stripe, Google OAuth, OpenRouter, SES, Telegram setup |
| `docs/EMAIL_SETUP.md`              | Cloudflare Email Routing + AWS SES                 |
| `docs/ENV_VARS.md`                 | Every env var, what it does, which env             |
| `docs/DEPLOY_SECRETS.md`           | Secret rotation, incident response                 |
| `docs/FLOW_DOCUMENTATION.md`       | End-to-end request flow + service map              |
| `docs/backend-patterns.md`         | Backend code conventions                           |
| `docs/frontend-patterns.md`        | Frontend code conventions                          |
| `docs/type-inference-patterns.md`  | Mandatory type-safety rules                        |
