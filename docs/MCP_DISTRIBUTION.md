# DebateKit MCP — Distribution Tracker

Last updated: 2026-03-10 (session 7b)

---

## Quick Links — All Live & Publicly Accessible

### Directories & Marketplaces
1. **Official MCP Registry** — https://registry.modelcontextprotocol.io/v0.1/servers/now.debatekit.mcp%2Fdebatekit/versions/latest (API/JSON — browsers may 404 due to `%2F` decoding; MCP clients consume this correctly)
2. **Cursor.directory** — https://cursor.directory/mcp/debatekit
3. **Smithery** — https://smithery.ai/servers/debatekit/debatekit
4. **ChatGPT Custom GPT** — https://chatgpt.com/g/g-69af4ee48f388191a0e92a24151e788e-debatekit

### Integrations (Install/Invite)
5. **Slack App** — https://slack.debatekit.com/slack/install (OAuth install — any workspace)
6. **n8n Community Node** — https://www.npmjs.com/package/n8n-nodes-debatekit-ai (`npm i n8n-nodes-debatekit-ai`)
7. **Zapier Integration** — https://zapier.com/developer/public-invite/237707/e5c297aeb14dc886a0c491b2e609954c/ (accept invite → build Zap)

### Bots
8. **Telegram Bot** — https://t.me/debatekitnowbot (LIVE — production deployed, webhook active, profile photo + commands + description configured)
9. **WhatsApp Bot** — SKIPPED (code-complete in preview, not pursuing Meta Business setup for now)

### Infrastructure
10. **MCP Server** — https://mcp.debatekit.com/mcp
11. **REST API** — https://mcp.debatekit.com/api/v1/health
12. **OAuth Discovery** — https://mcp.debatekit.com/.well-known/oauth-authorization-server
13. **Registry Domain Proof** — https://mcp.debatekit.com/.well-known/mcp-registry-auth
14. **Website** — https://debatekit.com

---

## LIVE — Verified Accessible Listings (8)

| # | Platform | Link | Status |
|---|----------|------|--------|
| 1 | **Official MCP Registry** | `now.debatekit.mcp/debatekit` | Live — domain-authenticated via Ed25519. Auto-consumed by Claude Code, Cursor, Windsurf. |
| 2 | **Cursor.directory** | [cursor.directory/mcp/debatekit](https://cursor.directory/mcp/debatekit) | Live — publicly visible |
| 3 | **Smithery** | [smithery.ai/servers/debatekit/debatekit](https://smithery.ai/servers/debatekit/debatekit) | Live (98/100 quality) |
| 4 | **ChatGPT Custom GPT** | [Open in ChatGPT](https://chatgpt.com/g/g-69af4ee48f388191a0e92a24151e788e-debatekit) | Live — all ChatGPT users |
| 5 | **Slack App** | [Install to Slack](https://slack.debatekit.com/slack/install) | Live — direct OAuth install. Marketplace listing pending Slack review (5 installs needed). |
| 6 | **n8n Community Node** | [npm v0.1.1](https://www.npmjs.com/package/n8n-nodes-debatekit-ai) | Live on npm. Gravatar logo updated. |
| 7 | **Zapier Integration** | [Accept Invite](https://zapier.com/developer/public-invite/237707/e5c297aeb14dc886a0c491b2e609954c/) | Live — any Zapier user. Full marketplace pending 3+ users with live Zaps. |
| 8 | **Telegram Bot** | [Open @debatekitnowbot](https://t.me/debatekitnowbot) | Live — production deployed, webhook active, profile photo + commands + description configured. Works in DMs + groups. |

### Platform Gates (cannot be bypassed — require real users)
- **Slack App Directory**: Requires 5 workspace installs → then submit for Slack review
- **Zapier Public Listing**: Requires 3 users with live Zaps → then `zapier promote`

---

## Submitted / Pending Review

### GitHub PRs (27 — all OPEN, none merged yet)

| # | Repo | PR Link | Status |
|---|------|---------|--------|
| 1 | punkpeye/awesome-mcp-servers | https://github.com/punkpeye/awesome-mcp-servers/pull/3019 | Labels: `missing-glama`, `has-emoji`, `valid-name` — needs Glama link |
| 2 | cnych/claude-mcp | https://github.com/cnych/claude-mcp/pull/47 | CI FAILED: Vercel deployment needs repo owner authorization |
| 3 | jaw9c/awesome-remote-mcp-servers | https://github.com/jaw9c/awesome-remote-mcp-servers/pull/145 | Waiting on review |
| 4 | ever-works/awesome-mcp-servers | https://github.com/ever-works/awesome-mcp-servers/pull/39 | Waiting on review |
| 5 | TensorBlock/awesome-mcp-servers | https://github.com/TensorBlock/awesome-mcp-servers/pull/162 | Waiting on review |
| 6 | habitoai/awesome-mcp-servers | https://github.com/habitoai/awesome-mcp-servers/pull/24 | CodeRabbit reviewed (3 reviews) — repo URL + tool names already fixed |
| 7 | toolsdk-ai/toolsdk-mcp-registry | https://github.com/toolsdk-ai/toolsdk-mcp-registry/pull/198 | CI passed (Biome + Integration Tests) — waiting on review |
| 8 | appcypher/awesome-mcp-servers | https://github.com/appcypher/awesome-mcp-servers/pull/555 | Waiting on review |
| 9 | collabnix/awesome-mcp-lists | https://github.com/collabnix/awesome-mcp-lists/pull/30 | Waiting on review |
| 10 | apappascs/mcp-servers-hub | https://github.com/apappascs/mcp-servers-hub/pull/8 | Fixed: tool names + timestamp corrected per Gemini review |
| 11 | MobinX/awesome-mcp-list | https://github.com/MobinX/awesome-mcp-list/pull/86 | Waiting on review |
| 12 | aimcp/awesome-mcp | https://github.com/aimcp/awesome-mcp/pull/13 | Waiting on review |
| 13 | rodert/awesome-mcp | https://github.com/rodert/awesome-mcp/pull/3 | Waiting on review |
| 14 | bh-rat/awesome-mcp-enterprise | https://github.com/bh-rat/awesome-mcp-enterprise/pull/29 | Waiting on review |
| 15 | **docker/mcp-registry** | https://github.com/docker/mcp-registry/pull/1567 | Waiting on review |
| 16 | **PipedreamHQ/pipedream** | https://github.com/PipedreamHQ/pipedream/pull/20232 | CI passed — CodeRabbit flagged import paths + $summary (commit 599f2e2 applied) |
| 17 | hireblackout/awesome-mcp-servers | https://github.com/hireblackout/awesome-mcp-servers/pull/1 | Waiting on review |
| 18 | patriksimek/awesome-mcp-servers-2 | https://github.com/patriksimek/awesome-mcp-servers-2/pull/3 | Waiting on review |
| 19 | PipedreamHQ/awesome-mcp-servers | https://github.com/PipedreamHQ/awesome-mcp-servers/pull/28 | Waiting on review |
| 20 | shaneholloman/awesome-mcp | https://github.com/shaneholloman/awesome-mcp/pull/1 | Waiting on review |
| 21 | raoufchebri/awesome-mcp | https://github.com/raoufchebri/awesome-mcp/pull/4 | Waiting on review |
| 22 | sylviangth/awesome-remote-mcp-servers | https://github.com/sylviangth/awesome-remote-mcp-servers/pull/10 | Waiting on review |
| 23 | mctrinh/awesome-mcp-servers | https://github.com/mctrinh/awesome-mcp-servers/pull/11 | Waiting on review |
| 24 | AlexMili/Awesome-MCP | https://github.com/AlexMili/Awesome-MCP/pull/38 | Waiting on review |
| 25 | AIAnytime/Awesome-MCP-Server | https://github.com/AIAnytime/Awesome-MCP-Server/pull/4 | CI passed (GitGuardian) — waiting on review |
| 26 | sagarjethi/awesome-mcp-servers | https://github.com/sagarjethi/awesome-mcp-servers/pull/1 | Waiting on review |
| 27 | gauravfs-14/awesome-mcp | https://github.com/gauravfs-14/awesome-mcp/pull/2 | CI passed (GitGuardian) — waiting on review |

### Web Form / Email / Directory Submissions (14)

| # | Platform | Evidence |
|---|----------|---------|
| 28 | **Anthropic Connectors Directory** | Google Form submitted — "Thank you for indicating your interest" confirmation |
| 29 | **Glama.ai** | Server + Connector both submitted — pending review (email conversation with Frank Fiegel) |
| 30 | **mcp.so** | GitHub Issues #359 + #753 |
| 31 | **mcpservers.org** | Web form submitted |
| 32 | **mcpmarket.com** | Web form submitted |
| 33 | **LobeHub** | "Submit MCP" button |
| 34 | **mcpserverfinder.com** | Email to info@mcpserverfinder.com |
| 35 | **PulseMCP / MCPServe** | Auto-syncs from Official Registry; manual form also submitted |
| 36 | **mcpserver.cc** | mcpserver.cc/submit |
| 37 | **MCPServers.com** | Form — Ref: `38fa1603-2218-4496-8158-e0b30d373563` |
| 38 | **mcpserver.dev** | "Submission successful" |
| 39 | **MCPStack (mcpstack.org)** | Google Form submitted — "Your response has been recorded" |
| 40 | **market-mcp.com** | Form filled — mailto: triggered (email needs manual send) |
| 41 | **mcphub.com** | Form filled — requires Google/GitHub sign-in to complete |

### Marketplace / Issue Submissions

| # | Platform | Status |
|---|----------|--------|
| 42 | **Cursor Marketplace** | Application submitted — pending review |
| 43 | **Cline MCP Marketplace** | GitHub issue submitted (pending) |

---

## Auto-Sync Platforms (8 — will pick up once PRs merge / registry publishes)

| Platform | Source |
|----------|--------|
| PulseMCP | Auto-syncs from Official MCP Registry |
| mcp-get | Auto-syncs from Official MCP Registry |
| OpenTools | Auto-indexes from GitHub/npm |
| mcphub.tools | Automatic listing |
| tolkonepiu/best-of-mcp-servers | Auto-updated weekly ranking |
| sunnamed434/awesome-mcp-registry | AI-curated, auto-updates weekly |
| Mastra MCP Registry | Meta-registry, aggregates automatically |
| Raycast MCP Registry | Auto-pulls from Smithery + Official MCP Registry |

---

## Official MCP Registry — Pending Auth

- `mcp-publisher` CLI installed via Homebrew
- `apps/mcp/server.json` configured and validated: namespace `io.github.deadpixel/debatekit`
- **Needs:** Run `mcp-publisher login github` → authorize at github.com/login/device → `mcp-publisher publish server.json`
- **Cascading effect**: Publishing here auto-populates PulseMCP, mcp-get, Raycast MCP Registry, VS Code MCP Gallery

---

## Apps/Integrations — Code Complete

| # | Integration | Path | Lang | Status | Next Step |
|---|-------------|------|------|--------|-----------|
| ~~A1~~ | ~~Slack App~~ | `integrations/slack/` | TS | **LIVE** | https://slack.com/apps/A0AKJRQ6ZTP — public distribution, OAuth, API key auth, multi-tenant KV |
| A2 | Raycast Extension | `integrations/raycast/` | TS | Code complete + branded icons | `npm run publish` + PR to `raycast/extensions` |
| ~~A3~~ | ~~n8n Community Node~~ | `integrations/n8n/` | TS | **LIVE** | https://www.npmjs.com/package/n8n-nodes-debatekit-ai — v0.1.0, API key auth, npm account: `debatekit-ai` |
| A4 | Pipedream Component | `integrations/pipedream/` | JS | PR submitted | https://github.com/PipedreamHQ/pipedream/pull/20232 |
| A5 | CrewAI Tool Package | `integrations/crewai/` | PY | Code complete + branded icon | `pip install build && python -m build` + PyPI publish |
| A6 | Dify.ai Plugin | `integrations/dify/` | PY | Code complete (5 tools) + branded icon | `.difypkg` packaging + PR to `langgenius/dify-plugins` |
| ~~A7~~ | ~~Zapier Integration~~ | `integrations/zapier/` | TS | **LIVE** | https://zapier.com/developer/public-invite/237707/e5c297aeb14dc886a0c491b2e609954c/ — v1.0.0, API key auth, App ID 237707, invite link active |
| A8 | ChatGPT Custom GPTs | `docs/CUSTOM_GPT_CONFIG.md` | — | **LIVE** | https://chatgpt.com/g/g-69af4ee48f388191a0e92a24151e788e-debatekit |
| A9 | Gemini CLI Extension | `apps/mcp/gemini-extension.json` | — | Config ready | Manual setup |
| A10 | DXT Desktop Extension | `integrations/dxt/` | TS | Code complete + packed (3.0MB) | Needs dxt.services sign-in (Google/GitHub OAuth) |
| A11 | Telegram Bot | `integrations/telegram/` | TS | Code complete, type-checked | Needs: @BotFather registration, KV namespace creation, deploy to CF Workers (`telegram.debatekit.com`) |
| A12 | WhatsApp Bot | `integrations/whatsapp/` | TS | Code complete, type-checked | Needs: Meta Business account, WhatsApp Cloud API setup, phone number, deploy to CF Workers (`whatsapp.debatekit.com`) |

### DXT Extension Details
- **Source:** `integrations/dxt/src/index.ts` — TypeScript, compiled to `server/index.js`
- **Manifest:** `integrations/dxt/manifest.json` — manifest_version 0.3, 13 tools declared
- **Package:** `integrations/dxt/dxt.mcpb` — 3.0MB packed, validated by `@anthropic-ai/mcpb`
- **User config:** API key (sensitive, stored in OS keychain) + optional base URL override
- **Platforms:** macOS, Windows, Linux (Node.js >= 18)

---

## High Priority — Not Yet Submitted

| # | Platform | Method | Reach | Notes |
|---|----------|--------|-------|-------|
| H1 | **DXT Directory (dxt.services)** | Upload DXT package | Claude Desktop | Requires Google/GitHub OAuth sign-in |
| H2 | **Windsurf Marketplace** | Contact Codeium | AI IDE users | https://windsurf.run/mcp |
| H3 | **Product Hunt** | Launch | Massive developer audience | Free, schedule a launch |
| H4 | **ClaudeMCP.org** | GitHub issue/PR | Claude users | Curated directory, needs PR to their repo |
| H5 | **apitracker.io** | Email | API users | Email apitracker@apideck.com |

---

## Not Yet Built

| # | Platform | Reach | Notes |
|---|----------|-------|-------|
| B1 | Poe Bot | Millions of users | Needs phone verification (+4917685572797) |
| B2 | Microsoft Copilot Studio | Enterprise M365 | Users add MCP URL directly — no submission needed |

---

## Skipped / Broken / Not Applicable

| Platform | Reason |
|----------|--------|
| MCPServerDirectory.org | Form non-functional (SEO farm) |
| mcp-server-directory.com | Supabase DNS failure |
| mcp-servers-hub.net | Supabase DNS failure |
| mcpdb.org | SSL certificate error (526) |
| wong2/awesome-mcp-servers | No PRs accepted (use mcpservers.org form instead) |
| VladonSD/MCP-Archive.com | No PR submission — website-only |
| code-agents/mcpverified | Curated only — no community submissions |
| OpenTools | Curated only |
| Mintlify mcpt | Sunsetted |
| MACH Alliance MCP Registry | Enterprise-only (requires member company) |
| rohitg00/awesome-devops-mcp-servers | DevOps-only — not a fit |
| mcpserver.directory | 503 — service unavailable |
| aixploria.com | Paid listings only ($79+) |
| Zed Editor Extensions | Requires Rust/WASM — not a fit |
| mcpstack.com | Domain expired — moved to mcpstack.org (submitted) |
| mcp-archive.com | 503 database connection error |
| mcphub.ai | Not a directory — MCP gateway service, no submission mechanism |
| hubmcp.dev | Not a directory — self-hosted MCP hub platform |
| eliteai.tools | Paid listings only ($10+) |

---

## Branding Assets

All integrations use consistent DebateKit branding:

| Asset | Source | Used In |
|-------|--------|---------|
| Icon (512×512 PNG) | `apps/web/public/icons/icon-512x512.png` | DXT, Raycast, n8n, CrewAI, Dify, Zapier, Pipedream |
| Logo (SVG) | `apps/web/public/static/logo.svg` | All integrations |
| Logo (PNG) | `apps/web/public/static/logo.png` | OG image, social |
| OG Image | `apps/web/public/static/og-image.png` | Social sharing |
| Brand Color | `#1a1a2e` (dark navy) | Slack app `background_color` |

---

## Critical Fix Applied

**GitHub repo URL**: Multiple PRs referenced `deadpixel/debatekit-dashboard` which returns 404. Fixed to `deadpixel/debatekit-dashboard` in PRs #24, #8, #20232, and n8n package.json. Tool names also fixed across PRs (consult→consult_council, debug→debug_issue, architect→design_architecture).

---

## Session 4 Progress Summary

### Verified Smithery Listing
- **Smithery is LIVE** at https://smithery.ai/servers/debatekit/debatekit (namespace `debatekit/debatekit`)
- **Quality Score: 98/100** — Tool Quality 35/35, Server Capabilities 10/10, Server Metadata 30/30, Configuration UX 22/25
- Remaining 2pt ("Tool names" sub-criterion) uses proprietary scoring — no MCP server has achieved 100/100 (highest known: Context7 at 99/100)
- Previously reported as 404 due to wrong URL (`@deadpixel/debatekit`) — correct URL found in session history

### Anthropic Connectors Directory Submitted
- Google Form completed across all 6 pages with full details
- Confirmation: "Thank you for indicating your interest in being included in the Anthropic MCP Directory"
- Details: 13 tools listed, OAuth 2.0, Streamable HTTP, all compliance checklists checked

### 6 New GitHub PRs Created (Session 4)
- sylviangth/awesome-remote-mcp-servers #10
- mctrinh/awesome-mcp-servers #11
- AlexMili/Awesome-MCP #38
- AIAnytime/Awesome-MCP-Server #4
- sagarjethi/awesome-mcp-servers #1
- gauravfs-14/awesome-mcp #2

### PR Review Update (Session 4)
- All 27 PRs verified OPEN — none merged or closed
- **#24 (habitoai)** — repo URL + tool names already fixed in prior commits
- **#8 (apappascs)** — tool names + timestamp fixed and pushed
- **#7 (toolsdk-ai)** — CI passed (Biome + Integration Tests)
- **#16 (PipedreamHQ)** — CI passed (Vercel + CodeRabbit)
- **#25 (AIAnytime)** + **#27 (gauravfs-14)** — GitGuardian CI passed

### Fixed
- n8n package.json repo URL: `deadpixel/debatekit-dashboard` → `deadpixel/debatekit-dashboard`

### New Platforms Investigated (Session 4)
- **mcphub.ai** — not a directory (MCP gateway), no submission mechanism
- **hubmcp.dev** — not a directory (self-hosted hub platform)
- **eliteai.tools** — paid only ($10+), skipped
- **market-mcp.com** — form filled, but submission triggers mailto: (needs manual email send)
- **mcphub.com** — form available, but requires Google/GitHub sign-in to submit

---

## Totals

- **6 verified LIVE listings** (Cursor.directory, Smithery, ChatGPT GPT, Slack Bot, n8n npm, Zapier)
- **4 LIVE infrastructure endpoints** (MCP Server, REST API, OAuth, Website)
- **27 open GitHub PRs** across awesome-list repos + platform repos
- **14 web form/email/directory submissions** pending review
- **2 marketplace applications** (Cursor + Cline)
- **8 auto-sync platforms** waiting on upstream
- **12 built integrations** (4 live, 8 code-complete + verified)

### Session 6 Progress

**Integrations Published:**
- **n8n published** to npm as `n8n-nodes-debatekit-ai@0.1.0` (npm account: `debatekit-ai`, email: `ava@deadpixel.ai`)
- **Zapier registered** (App ID 237707), v1.0.0 pushed, settings updated (logo, description, category: AI Assistants), ToS accepted
- **Zapier invite link** active for public access. Full marketplace promotion requires 3+ users with live Zaps.
- All integrations require DebateKit API key authentication — no free usage.

**PR Follow-Ups (Session 6):**
- **#20232 (PipedreamHQ/pipedream)** — CHANGES REQUESTED by `luancazarine` (Pipedream collaborator). Fixed: added `annotations` block to all 4 action files, updated `@pipedream/platform` to `^3.2.5`, bumped version to `0.1.0`. Changes pushed, review reply posted.
- **#24 (habitoai/awesome-mcp-servers)** — CodeRabbit flagged broken repo URL + outdated tool names. Fixed: repo URL changed to `whateverneveranywhere/debatekit-dashboard`, tool names updated (`consult_council`→`consult`, `debug_issue`→`debug`, `design_architecture`→`architect`). Commit `4377acf` pushed, replied to all 3 review comments.
- **#3019 (punkpeye/awesome-mcp-servers)** — `missing-glama` label blocks merge. Glama listing NOT yet live (submitted, in contact with Frank Fiegel at frank@glama.ai). Comment posted on PR explaining pending status. Will update once Glama listing goes live.
- **All 27 PRs verified OPEN** — none merged or closed as of session 6.

**New Integrations Built:**
- **Telegram Bot** — `integrations/telegram/`, 16 files, CF Workers + Hono, webhook-based, per-chat API keys in KV, message history buffering for `/analyze`, KV namespaces created (prod: `078a524871e84bb4bf92ac56b7b36379`, preview: `406a26952491480d96f06f85f8492cfd`). Type-checks clean.
- **WhatsApp Bot** — `integrations/whatsapp/`, 16 files, CF Workers + Hono, WhatsApp Cloud API (Meta), per-chat API keys in KV, message history buffering for `!analyze`, webhook dedup, KV namespaces created (prod: `ed3faca01e5147608a9c51f345560213`, preview: `c632e427d332431e87a80e920da87958`). Type-checks clean.

**Security Audit (Session 6):**
- **All 6 integrations audited** for authentication enforcement
- **Zapier auth fix applied**: Changed conditional auth header to throw `HaltedError` if API key missing (was silently proceeding without auth). Rebuilt + pushed v1.0.0.
- **Telegram bot username fix**: Removed hardcoded `'debatekit_ai_bot'` — now uses `TELEGRAM_BOT_USERNAME` env var across all references.
- **Branding**: Icon (512x512 PNG) copied to Telegram + WhatsApp integrations.
- **Auth enforcement verified across all integrations:**
  - Slack: ✅ Per-team KV keys + fallback, `hasApiKey()` check on commands
  - Zapier: ✅ `HaltedError` thrown if key missing (FIXED), `Authorization: Bearer` on all requests
  - n8n: ✅ Framework-level credential injection, `required: true`, auth test endpoint
  - Telegram: ✅ Per-chat KV keys + fallback, all commands reject if no key
  - WhatsApp: ✅ Per-chat KV keys + fallback, all commands reject if no key, webhook dedup
  - ChatGPT GPT: ✅ Uses MCP API with required API key

### Remaining Action Items
1. **Authorize MCP Registry** → `mcp-publisher login github` + authorize at github.com/login/device. Cascading: auto-populates 4+ platforms
2. **Submit DXT to dxt.services** — needs Google/GitHub sign-in (package ready)
3. **Sign into mcphub.com** (Google/GitHub) to complete server submission
4. **Send market-mcp.com email** — mailto: was triggered but email needs manual send
5. **Glama link for PR #3019** — once Glama listing approved, update punkpeye PR
6. **Publish CrewAI package** — `pip install build && python -m build` + PyPI
7. **Publish Raycast extension** — `npm run publish` in integrations/raycast/
8. **Windsurf Marketplace** — contact Codeium for listing
9. **Product Hunt launch** — schedule at producthunt.com
10. **Zapier: Get 3 users with live Zaps** to unlock full public promotion
11. **Slack: Get 5 workspace installs** to submit for marketplace review
12. **Build Telegram Bot** — `integrations/telegram/`, register via @BotFather, deploy to Cloudflare Workers
13. **Build WhatsApp Bot** — `integrations/whatsapp/`, Meta Business account + WhatsApp Cloud API, deploy to Cloudflare Workers
