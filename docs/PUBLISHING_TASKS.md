# DebateKit: Platform Publishing Tasks (Granular)

> Generated: 2026-03-09 | Updated: 2026-03-13 | Status: Active
> Each task is atomic and actionable. Check off as completed.
>
> ## Integration Code Status (as of 2026-03-13)
>
> All integrations bumped to **v1.0.0**. All 8 TS integrations pass `tsc --noEmit`. Zero anti-pattern violations.
>
> | Integration | Version | Tools | Status | Key Changes |
> |-------------|---------|-------|--------|-------------|
> | **Shared** | 1.0.0 | — | **Complete** | `@debatekit/integration-shared` — Zod types, enum 5-part pattern, API client, formatters, URL helpers |
> | Telegram | 1.0.0 | 7/13 | **LIVE (prod)** | `telegram.debatekit.ai` — inline processing, typing keep-alive, slash-only (no implicit consult) |
> | Slack | 1.0.0 | 2/13 | Code complete | Needs api.slack.com app creation + secrets + deploy |
> | WhatsApp | 1.0.0 | 2/13 | Code complete | Zod safeParse for webhooks (was `as` cast), barrel deleted, zod dep added |
> | n8n | 1.0.0 | 11/13 | **LIVE (npm)** | `n8n-nodes-debatekit-ai@1.0.0` — 56 files on npmjs.com, published 2026-03-11 |
> | Zapier | 1.0.0 | 10/13 | **Push ready** | App ID 237707, validates clean, `zapier push` ready, needs 3+ beta users for App Directory |
> | Pipedream | 1.0.0 | 9/13 | **PR submitted** | [PipedreamHQ/pipedream#20232](https://github.com/PipedreamHQ/pipedream/pull/20232) — in backlog, checklist acknowledged |
> | Raycast | 1.0.0 | 7/13 | **Lint passing** | URLs now use shared constants; needs valid Raycast Store username to publish |
> | DXT | 1.0.0 | 13/13 | **Binary packed** | Rebuilt server/index.js from source, fixed stale enums + URL constants |
> | CrewAI | 1.0.0 | 6/13 | **Built** | `crewai_debatekit-1.0.0` wheel + tarball built, twine check passed, ready for `twine upload` |
> | Dify | 1.0.0 | 6/13 | **Marketplace ready** | Added main.py, requirements.txt, _assets/icon.svg, fixed manifest for marketplace PR |
> | Smithery | — | 13/13 | **LIVE** | smithery.ai/servers/debatekit/debatekit — all tools discovered |
> | HuggingFace | — | 3/13 | **Space ready** | Gradio app with Consult, Code Review, Tradeoffs tabs |
> | VS Code | — | 13/13 | **Config ready** | `.vscode/mcp.json` + Cursor + Windsurf configs created |
>
> ### MCP REST API (updated 2026-03-12):
> - Added `GET /api/v1/threads/:sessionId/link` — returns `{ dashboardUrl, isPublic, publicUrl }`
> - Added `PATCH /api/v1/threads/:sessionId/visibility` — set thread public/private
> - Both deployed to production at `mcp.debatekit.ai`
>
> ### Anti-patterns fixed globally (final sweep):
> - Zero `any`, `unknown` (except JSON parse boundary), `Record<string, unknown>`, `@ts-ignore`, `.passthrough()`
> - All `as` casts removed except `response.json() as Promise<T>` (unavoidable) and `as const`
> - n8n + Zapier auth: `Authorization: Bearer` → `x-api-key`
> - Pipedream assess-tradeoffs: `constraints` → `priorities`, added `context` field
> - Dify: hardcoded URLs → `base_url` credential
> - Zapier: all types centralized in types.ts, typed request bodies replace `Record<string, string>`
> - Slack: `JSON.parse() as` → Zod `safeParse()` for webhook payloads
> - WhatsApp: `JSON.parse() as` → Zod `safeParse()` for webhook payloads
> - Raycast: `JSON.parse() as DebateResult` → type annotation, `Record<string,string>` → Map
> - Telegram + WhatsApp: dead barrel re-export files deleted
> - Zapier: stale dist/ directory deleted, .gitignore updated

---

## PHASE 1: Highest Impact Platforms

---

### 1. OpenAI ChatGPT — Custom GPT (GPT Store)

**Goal:** 4 Custom GPTs published and discoverable in the GPT Store.

#### Prerequisites
- [x] ChatGPT Go/Plus plan active (required for GPT creation)
- [x] GPT configurations written (`docs/CUSTOM_GPT_CONFIG.md`)

#### GPT 1: "DebateKit" (Primary — with real API Actions + OAuth)
- [x] Write system instructions with CEBR protocol + 5 personas
- [x] Define 5 conversation starters
- [x] Navigate to chatgpt.com/gpts/editor
- [x] Fill Name, Description, System Instructions
- [x] Enable Web Search + Code Interpreter
- [x] Select GPT-5.3 recommended model
- [x] Configure OAuth 2.0 authentication (client_id + client_secret flow)
- [x] Add OpenAPI Actions pointing to `mcp.debatekit.ai/api/v1/` (6 endpoints)
- [x] Select "GPT Store" visibility → Category: Research & Analysis
- [x] Click Update → confirmed published
- [x] GPT Store URL: `https://chatgpt.com/g/g-69af4ee48f388191a0e92a24151e788e-debatekit`
- [x] Verified OAuth flow end-to-end: GPT → Sign in → DebateKit consent → API key created → token returned → API call works
- [x] Verified real multi-model council debate (Claude Opus 4.6 + O3 + Gemini 2.5 Pro) via GPT Actions
- [ ] Upload DebateKit logo as profile picture (use `apps/web/public/icons/icon-512x512.png`)

#### GPT 2: "DebateKit: Code Review"
- [ ] Navigate to chatgpt.com/gpts/editor
- [ ] Fill Name: "DebateKit: Code Review"
- [ ] Fill Description from `docs/CUSTOM_GPT_CONFIG.md` Section 2
- [ ] Paste system instructions (Security Expert, Performance Analyst, Clean Code, Architecture personas)
- [ ] Add 4 conversation starters from config
- [ ] Upload DebateKit logo as profile picture
- [ ] Enable Web Search + Code Interpreter
- [ ] Set visibility to "GPT Store"
- [ ] Save and copy URL

#### GPT 3: "DebateKit: Product Strategy"
- [ ] Navigate to chatgpt.com/gpts/editor
- [ ] Fill from `docs/CUSTOM_GPT_CONFIG.md` Section 3
- [ ] Market Analyst, User Researcher, Technical Advisor, Business Strategist personas
- [ ] Upload logo, enable capabilities
- [ ] Publish to GPT Store

#### GPT 4: "DebateKit: Writing Editor"
- [ ] Navigate to chatgpt.com/gpts/editor
- [ ] Fill from `docs/CUSTOM_GPT_CONFIG.md` Section 4
- [ ] Copywriter, Content Strategist, SEO Specialist, Audience Analyst personas
- [ ] Upload logo, enable capabilities
- [ ] Publish to GPT Store

#### Post-Publish (All GPTs)
- [ ] Add cross-links between GPTs in descriptions
- [ ] Create landing page at debatekit.ai/chatgpt listing all 4 GPTs
- [ ] Add GPT Store links to docs/CONNECTOR_SUBMISSIONS.md

---

### 2. OpenAI ChatGPT App Directory (MCP App)

**Goal:** DebateKit listed as an official ChatGPT App with rich widget rendering.

#### Code (Already Done)
- [x] `apps/mcp/src/chatgpt/widget.ts` — HTML widget for iframe rendering
- [x] `apps/mcp/src/chatgpt/index.ts` — App resource registration via ext-apps
- [x] `apps/mcp/src/lib/content-builder.ts` — `buildDebateContentWithStructured()`
- [x] All 6 debate tools updated to return `structuredContent`
- [x] `@modelcontextprotocol/ext-apps` v1.2.0 added

#### Submission Steps
- [ ] Go to platform.openai.com → sign in with DebateKit account
- [ ] Navigate to Apps section (platform.openai.com/apps-manage)
- [ ] Click "Create new app" or "Register app"
- [ ] Fill app name: "DebateKit"
- [ ] Fill short description (120 chars): "Multi-AI brainstorming — consult a council of AI models that debate your question and synthesize insights."
- [ ] Fill long description from `docs/CONNECTOR_SUBMISSIONS.md` Section 2
- [ ] Upload app icon: `apps/web/public/icons/icon-512x512.png` (512x512 PNG)
- [ ] Set MCP server URL: `https://mcp.debatekit.ai/mcp`
- [ ] Configure OAuth 2.0:
  - Authorization URL: `https://mcp.debatekit.ai/authorize`
  - Token URL: `https://mcp.debatekit.ai/token`
  - Scopes: `mcp:tools`
- [ ] Set widget domain: `debatekit.ai`
- [ ] Select category: "Productivity" or "AI Tools"
- [ ] Add privacy policy URL: `https://debatekit.ai/legal/privacy`
- [ ] Add terms of service URL: `https://debatekit.ai/legal/terms`
- [ ] Submit for review
- [ ] Monitor review status
- [ ] After approval, verify widget renders in ChatGPT

---

### 3. Anthropic Claude Connectors Directory

**Goal:** DebateKit listed in Claude's official Connectors directory.

#### Prerequisites
- [x] MCP server live at `mcp.debatekit.ai/mcp`
- [x] Streamable HTTP transport (not legacy SSE)
- [x] OAuth 2.0 with PKCE + Dynamic Client Registration
- [x] Tool annotations (`readOnlyHint`) on all tools
- [x] `.well-known/oauth-authorization-server` endpoint live

#### Pre-Submission Testing
- [ ] Test with Claude Desktop: add server config, verify all 14 tools load
- [ ] Test OAuth flow end-to-end in Claude Desktop
- [ ] Test API key auth as fallback
- [ ] Verify tool responses stay under 25K token limit
- [ ] Test `consult` tool with a real debate
- [ ] Test `check_usage` tool
- [ ] Test `list_models` tool
- [ ] Screenshot working tools in Claude Desktop

#### Submission (Google Form)
- [x] Open: https://docs.google.com/forms/d/e/1FAIpQLSeafJF2NDI7oYx1r8o0ycivCSVLNq92Mpc1FPxMKSw1CzDkqA/viewform
- [x] Company name: Deadpixel
- [x] Connector name: DebateKit
- [x] Website: https://debatekit.ai
- [x] MCP server URL: https://mcp.debatekit.ai/mcp
- [x] Description: paste from `docs/CONNECTOR_SUBMISSIONS.md` Section 1
- [x] Category: Productivity / AI Tools
- [x] Auth type: Bearer token + OAuth 2.0 with PKCE
- [x] Paste auth details (authorization, token, registration endpoints)
- [x] List all 13 tools with descriptions
- [x] List 3 prompts
- [x] List 2 resources
- [x] Provide test API key for Anthropic review team
- [x] Contact email: soheil@deadpixel.ai
- [x] Submit form
- [x] Confirmed: "Thank you for indicating your interest in being included in the Anthropic MCP Directory."

#### Post-Submission
- [ ] Monitor email for review feedback
- [ ] Prepare test account with credits for review team
- [ ] Be ready to make quick fixes if Anthropic requests changes

---

### 4. Product Hunt Launch

**Goal:** Successful PH launch with 200+ upvotes.

#### Asset Preparation
- [ ] Create 240x240 logo (square, PNG) — crop from `icon-512x512.png`
- [ ] Create 5 gallery images (1270x760 each):
  1. Hero shot: DebateKit debate in action
  2. Multiple AI models collaborating
  3. Moderator synthesis view
  4. MCP integration across editors
  5. Results/analytics dashboard
- [ ] Record 1-2 min demo video showing a full debate
- [ ] Write tagline (60 chars max): "Your AI Board of Directors"
- [ ] Write description (260 chars): "ChatGPT, Claude, Gemini & Grok debate your questions together. Each model sees prior responses, then a moderator synthesizes. Works in any MCP client — ChatGPT, Claude, VS Code, Cursor."
- [ ] Write detailed description from `docs/CONNECTOR_SUBMISSIONS.md` Section 4

#### Product Hunt Setup
- [ ] Create Maker account at producthunt.com/my/settings
- [ ] Link Twitter @debatekitnow
- [ ] Find a hunter (or self-hunt)
- [ ] Schedule launch date (Tuesday or Wednesday)
- [ ] Pre-write first comment (team story, why we built this)
- [ ] Prepare launch-day tweet thread

#### Launch Day
- [ ] Submit at 12:01 AM PT
- [ ] Post first comment within 5 minutes
- [ ] Tweet announcement + tag @ProductHunt
- [ ] Post in relevant communities (Reddit r/artificial, r/ChatGPT, HN)
- [ ] Respond to every comment on PH
- [ ] Share with network for upvotes

---

## PHASE 2: Platform Integrations

---

### 5. Smithery MCP Marketplace

**Goal:** DebateKit discoverable on smithery.ai.

#### Setup
- [x] `apps/mcp/smithery.yaml` created with `x-from: header` + `x-header-name: x-api-key`
- [x] Verify smithery.yaml schema matches latest spec
- [x] Go to smithery.ai
- [x] Create account / sign in (Google OAuth as Ava Bagherzadeh)
- [x] Submit MCP server:
  - Namespace: debatekit / Server ID: debatekit
  - Server URL: https://mcp.debatekit.ai/mcp
  - API key parameter configured (header: x-api-key, required)
  - Description: "Your AI Board of Directors. Run multi-model debates..."
  - Homepage: https://debatekit.ai
- [x] Server registered: https://smithery.ai/servers/debatekit/debatekit
- [x] Made listing public (unlisted unchecked)
- [x] Tool discovery scan SUCCESS — 13 tools, 3 prompts, 3 resources discovered
- [x] Score: 75/100 (up from 38/100)
- [x] Gateway URL live: https://debatekit--debatekit.run.tools
- [x] Connection instructions generated (CLI, AI SDK, TypeScript)
- [x] GitHub badge available: `[![smithery badge](https://smithery.ai/badge/debatekit/debatekit)](https://smithery.ai/servers/debatekit/debatekit)`
- [x] MCP server updated: unauthenticated discovery (initialize, tools/list) for scanners
- [ ] Upload custom logo/icon (currently using favicon from homepage)
- [ ] Test connecting via Smithery CLI: `smithery mcp add debatekit/debatekit`
- [ ] Improve score toward 100/100 (may need usage/performance metrics over time)

---

### 6. Gemini CLI Extension

**Goal:** Installable as Gemini CLI extension.

#### Setup
- [x] `apps/mcp/gemini-extension.json` created
- [x] `apps/mcp/GEMINI.md` context file created
- [x] URL fixed to debatekit.ai (was .ai)

#### Publishing
- [x] Research: No formal marketplace — auto-indexed at geminicli.com/extensions via GitHub topic
- [x] Manifest validated — JSON format correct, `sensitive: true` for API key
- [x] Install instructions added to `apps/mcp/README.md`
- [ ] Add `gemini-cli-extension` GitHub topic to repo for auto-discovery (CRITICAL for listing)
- [ ] Test locally: `gemini --extension apps/mcp/gemini-extension.json`
- [ ] Verify all tools load in Gemini CLI
- [ ] Monitor geminicli.com/extensions for listing (1-24h after topic added)

---

### 7. Slack App Directory

**Goal:** DebateKit Slack bot listed in Slack App Directory.

#### Code (Already Done)
- [x] `integrations/slack/` — Full Hono + Workers implementation
- [x] Slash commands: `/debatekit`, `/debatekit-review`
- [x] Block Kit formatting
- [x] Request signature verification
- [x] `.dev.vars.example` with proper placeholders
- [x] 5 new API client tools: debugIssue, planImplementation, assessTradeoffs, getThreadLink, setThreadVisibility
- [x] Version bumped to 1.0.0

#### Slack App Configuration
- [ ] Go to api.slack.com/apps → Create New App
- [ ] Choose "From scratch"
- [ ] App Name: "DebateKit"
- [ ] Select development workspace
- [ ] Upload app icon: `apps/web/public/icons/icon-512x512.png`
- [ ] Under Basic Information:
  - Short description: "Multi-AI brainstorming in Slack"
  - Long description: Multi-model AI debates directly in channels
  - App icon (512x512): upload
  - Background color: #0f172a

#### OAuth & Permissions
- [ ] Add Bot Token Scopes:
  - `chat:write`
  - `chat:write.public`
  - `commands`
  - `app_mentions:read`
- [ ] Set redirect URL to Worker URL

#### Slash Commands
- [ ] Create `/debatekit` command
  - Request URL: `https://debatekit-slack-bot-prod.workers.dev/slack/commands`
  - Short description: "Start a debatekit brainstorm"
  - Usage hint: "[your question or topic]"
- [ ] Create `/debatekit-review` command
  - Request URL: same
  - Short description: "Code or architecture review"
  - Usage hint: "[paste code or describe system]"

#### Event Subscriptions
- [ ] Enable Events
- [ ] Request URL: `https://debatekit-slack-bot-prod.workers.dev/slack/events`
- [ ] Subscribe: `app_mention`

#### Interactivity
- [ ] Enable Interactivity
- [ ] Request URL: `https://debatekit-slack-bot-prod.workers.dev/slack/interactions`

#### Infrastructure
- [ ] Create KV namespaces:
  ```bash
  wrangler kv namespace create SLACK_KV
  wrangler kv namespace create SLACK_KV --preview
  ```
- [ ] Update `wrangler.jsonc` with actual KV namespace IDs (replace 6 placeholders)
- [ ] Set secrets:
  ```bash
  wrangler secret put SLACK_BOT_TOKEN --env production
  wrangler secret put SLACK_SIGNING_SECRET --env production
  wrangler secret put DEBATEKIT_API_KEY --env production
  ```
- [ ] Deploy: `bun run deploy:production`
- [ ] Test commands in Slack workspace

#### App Directory Submission
- [ ] Prepare landing page at debatekit.ai/slack
- [ ] Add privacy policy URL
- [ ] Add support URL
- [ ] Under "Manage Distribution" → Activate Public Distribution
- [ ] Submit for Slack App Review
- [ ] Respond to review feedback

---

### 8. Zapier Integration

**Goal:** Published on Zapier marketplace.

#### Code
- [x] Integration at `integrations/zapier/`
- [x] Converted from JS to TypeScript (all files in `src/`, typed interfaces)
- [x] `tsconfig.json` + build pipeline configured
- [x] `.env.example` created
- [x] 5 new create actions: debug-issue, review-code, design-architecture, plan-implementation, assess-tradeoffs
- [x] 1 new search: get-thread-link
- [x] Auth fixed from `Authorization: Bearer` to `x-api-key`
- [x] Version bumped to 1.0.0
- [ ] Verify all operations work: trigger, 6 actions, 2 searches

#### Zapier Developer Setup
- [x] Go to developer.zapier.com
- [x] Create developer account
- [x] Register app: `zapier register` — App ID 237707
- [x] Update `.zapierapprc` with real app ID

#### Testing
- [x] `zapier validate` — "No structural errors found" (0 errors, 4 warnings, 24 publishing tasks)
- [ ] `zapier test` — run integration tests
- [ ] Test auth flow with real API key
- [ ] Test "New Session" trigger with real data
- [ ] Test "Start DebateKit" action with real prompt
- [ ] Test "Find Session" search with real session ID
- [ ] Verify sample data matches actual API responses

#### Publishing
- [ ] Upload app icon (256x256 PNG, **transparent** background, no text) — use `integrations/shared/icons/icon-256x256.png`
- [ ] Set app title: "DebateKit"
- [ ] Set description from brand constants
- [ ] Set categories: "AI Tools", "Productivity"
- [ ] Push to Zapier: `zapier push`
- [ ] Create 3 invite-only test users
- [ ] Test with invite users
- [ ] Promote to public: `zapier promote [version] public`
- [ ] Submit for Zapier review
- [ ] Respond to review feedback

---

### 9. n8n Community Node

**Goal:** Published on npm as `n8n-nodes-debatekit`.

#### Code
- [x] Integration at `integrations/n8n/`
- [x] TypeScript implementation
- [x] Logo updated to brand-aligned SVG (uses #0f172a, #3b82f6, #2563eb, #FFD700)
- [x] 2 new debatekit operations: planImplementation, assessTradeoffs
- [x] Thread resource added: getLink, setVisibility
- [x] Auth fixed from `Authorization: Bearer` to `x-api-key`
- [x] MCP schema reference comments on all resources
- [x] Version bumped to 1.0.0

#### Pre-Publish Checks
- [ ] `cd integrations/n8n && bun install`
- [ ] `bun run build` — verify TypeScript compiles
- [ ] `bun run lint` — fix any lint errors
- [ ] Verify `dist/` output has correct files:
  - `dist/nodes/DebateKit/DebateKit.node.js`
  - `dist/credentials/DebateKitApi.credentials.js`
- [ ] Test locally with n8n:
  ```bash
  export N8N_CUSTOM_EXTENSIONS=/path/to/integrations/n8n
  npx n8n start
  ```
- [ ] Verify node appears in n8n node panel
- [ ] Test credential setup with real API key
- [ ] Test each operation:
  - DebateKit > Consult
  - DebateKit > Architect
  - DebateKit > Debug
  - DebateKit > Review Code
  - Session > Get
  - Session > Get All
  - Usage > Check

#### npm Publishing
- [x] npm account created (`debatekit-ai`)
- [x] Published as `n8n-nodes-debatekit-ai@1.0.0` (name `n8n-nodes-debatekit` was taken)
- [x] Package live: [npmjs.com/package/n8n-nodes-debatekit-ai](https://www.npmjs.com/package/n8n-nodes-debatekit-ai)
- [x] 452 KB unpacked, MIT license, 3 versions published

#### Community Submission
- [ ] Post on n8n Community Forum (draft ready at `docs/drafts/n8n-forum-post.md`):
  - Title: "New Community Node: DebateKit — Multi-AI Brainstorming"
  - Category: "Share" or "Community Nodes"
  - Include: description, screenshots, install command, link to npm
- [ ] Submit to n8n's official community nodes list (if applicable)

---

## PHASE 3: Editor & Developer Platforms

---

### 10. VS Code / Copilot MCP

**Goal:** Easy install config for VS Code users.

- [x] `apps/mcp/mcp-config.json` — Universal MCP config template
- [x] Create VS Code-specific settings snippet — `.vscode/mcp.json`
- [x] Create Cursor-specific MCP config — `apps/mcp/cursor-mcp-config.json`
- [x] Create Windsurf-specific MCP config — `apps/mcp/windsurf-mcp-config.json`
- [x] Add all editor configs to `apps/mcp/README.md` (Claude Desktop, VS Code, Cursor, Windsurf, Gemini CLI)
- [ ] Consider VS Code extension wrapper (optional):
  - [ ] Create `vsc-extension/` scaffold
  - [ ] package.json with `contributes.configuration` for MCP
  - [ ] Set up Azure DevOps publisher account
  - [ ] Package with `vsce package`
  - [ ] Publish with `vsce publish`

---

### 11. Make.com (Integromat)

**Goal:** DebateKit available as a Make.com app.

#### Setup
- [ ] Go to make.com/en/partner → register as Partner
- [ ] Access Make App development environment
- [ ] Create new app "DebateKit"
- [ ] Upload icon (256x256, transparent background, no text)
- [ ] Configure base URL: `https://mcp.debatekit.ai`

#### API Modules
- [ ] Create "Consult" action module
  - Map to POST /api/v1/consult
  - Input fields: prompt, thinking_level, mode, context
  - Output mapping for participants, moderator, metadata
- [ ] Create "Get Session" search module
  - Map to GET /api/v1/sessions/{id}
- [ ] Create "List Sessions" search module
  - Map to GET /api/v1/sessions
- [ ] Create "Architecture Review" action module
  - Map to POST /api/v1/architect
- [ ] Create "Code Review" action module
  - Map to POST /api/v1/review-code

#### Authentication
- [ ] Configure API key authentication
  - Header: `x-api-key: {{apiKey}}`
  - Test URL: GET /api/v1/sessions?limit=1

#### Publish
- [ ] Test all modules
- [ ] Write documentation
- [ ] Submit for Make review
- [ ] Monitor review status

---

### 12. Pipedream

**Goal:** DebateKit available on Pipedream.

- [x] Create Pipedream component source (ES modules):
  ```
  integrations/pipedream/
    actions/
      consult-council/consult-council.mjs
      debug-issue/debug-issue.mjs
      design-architecture/design-architecture.mjs
      review-code/review-code.mjs
      plan-implementation/plan-implementation.mjs
      assess-tradeoffs/assess-tradeoffs.mjs
      get-thread-link/get-thread-link.mjs
    debatekit.app/debatekit.app.mjs
  ```
- [x] Implement auth (API key via x-api-key header)
- [x] 7 actions implemented (all v1.0.0)
- [x] App component with `getThreadLink()` helper
- [ ] Implement "New Session" source (polling trigger)
- [ ] Test on Pipedream
- [x] Submit PR to github.com/PipedreamHQ/pipedream — [#20232](https://github.com/PipedreamHQ/pipedream/pull/20232) (in backlog)
- [ ] Respond to reviewer feedback when assigned
- [ ] Publish via `pd publish` after PR merged

---

## PHASE 4: AI Platform Ecosystems

---

### 13. Vercel Marketplace

- [ ] Check if Vercel Marketplace accepts MCP integrations
- [ ] If yes: create Vercel integration at vercel.com/integrations
- [ ] Configure OAuth flow
- [ ] Build dashboard panel (optional)
- [ ] Submit for review

### 14. Replit Extensions

- [ ] Check Replit extension/MCP support
- [ ] Create MCP config for Replit
- [ ] Submit to Replit Extensions directory

### 15. HuggingFace Spaces

**Goal:** Interactive DebateKit demo on HuggingFace. No review process — instant publish.

- [x] Create Gradio app at `integrations/huggingface/app.py` (Consult, Code Review, Tradeoffs tabs)
- [x] `requirements.txt` with gradio + httpx
- [x] README.md with HuggingFace Space metadata header
- [ ] Create Space at huggingface.co/new-space (Gradio SDK)
- [ ] Clone repo, push `integrations/huggingface/` files
- [ ] Set `DEBATEKIT_API_KEY` as Secret in Space Settings
- [ ] Verify Space is live and all 3 tabs work
- [ ] Enable "Duplicate this Space" for users to clone with own API key

### 16. LangChain Hub / LangSmith

**Goal:** `langchain-debatekit` pip package + community listing.

**Path 1 — Standalone package (faster, no approval):**
- [ ] Create `integrations/langchain/` with `BaseTool` subclasses for each DebateKit tool
- [ ] Publish `langchain-debatekit` to PyPI
- [ ] Request listing on LangChain integrations docs page

**Path 2 — Community integration (broader reach):**
- [ ] Open discussion on `langchain-ai/langchain-community` proposing integration
- [ ] After approval, submit PR to `libs/community/langchain_community/tools/debatekit/`
- [ ] Write integration guide

### 17. CrewAI Tools

- [x] Create CrewAI tool classes at `integrations/crewai/` (v1.0.0)
- [x] 7 tools: consult, code-review, debug, architect, plan-implementation, assess-tradeoffs, get-thread-link
- [x] `api.py` supports GET + POST methods
- [x] Python classifier: Production/Stable
- [x] Built pip package: `crewai_debatekit-1.0.0` wheel + tarball in `integrations/crewai/dist/`
- [x] `twine check` passed on both artifacts
- [ ] Upload to PyPI: `python3 -m twine upload integrations/crewai/dist/*` (needs PyPI API token)
- [ ] Submit to CrewAI Marketplace

### 18. Dify Marketplace

**Goal:** DebateKit listed on marketplace.dify.ai.

#### Code
- [x] 6 tool implementations at `integrations/dify/`
- [x] Shared `DebateKitBaseTool` base class
- [x] `base_url` from credentials (not hardcoded)
- [x] `main.py` entrypoint created
- [x] `requirements.txt` created (dify-plugin + httpx)
- [x] `_assets/icon.svg` created
- [x] `manifest.yaml` updated (meta section, plugins section, icon path)
- [x] `README.md` for marketplace listing

#### Submission
- [ ] Install Dify plugin CLI: `pip install dify-plugin`
- [ ] Package plugin: `dify plugin package ./integrations/dify/`
- [ ] Fork `langgenius/dify-plugins` on GitHub
- [ ] Add `debatekit/` directory with source + `.difypkg`
- [ ] Open PR following their template
- [ ] Wait for Dify team review

---

## Cross-Cutting Tasks

### Branding Assets Package
- [x] Created `integrations/shared/icons/` with all required sizes:
  - [x] `icon-64x64.png` (Smithery, small displays)
  - [x] `icon-128x128.png` (VS Code extension) — also at `apps/web/public/icons/`
  - [x] `icon-240x240.png` (Product Hunt)
  - [x] `icon-256x256.png` (Zapier, Make.com)
  - [x] `icon-512x512.png` (Slack, ChatGPT)
  - [x] `icon-1024x1024.png` (App Store, high-res)
  - [ ] `banner-1270x760.png` (Product Hunt gallery) — needs design
  - [x] `og-image-1200x630.png` — already at `apps/web/public/static/`
- [x] All icons use actual DebateKit holographic sphere logo
- [x] Created `integrations/shared/debatekit-icon.svg` — brand-aligned SVG icon

### Landing Pages
- [ ] Create debatekit.ai/integrations hub page
- [ ] Create debatekit.ai/chatgpt — GPT Store links
- [ ] Create debatekit.ai/slack — Slack bot install
- [ ] Create debatekit.ai/docs/mcp-setup — Universal MCP setup guide
- [ ] Create debatekit.ai/docs/api — API documentation

### Documentation
- [ ] Keep docs/DISTRIBUTION_PLAN.md updated with status
- [ ] Keep docs/CONNECTOR_SUBMISSIONS.md updated with submitted/approved status
- [ ] Track all platform URLs in a single reference table
- [ ] Create integration changelog

### Analytics & Tracking
- [ ] Add PostHog events for each platform's installation/usage
- [ ] Track MCP tool invocations by client (ChatGPT, Claude, VS Code, etc.)
- [ ] Set up alerts for integration errors

---

## Priority Execution Order

1. **NOW**: Custom GPTs (4x) — minutes each, immediate reach
2. **NOW**: Claude Connectors submission — just fill the form
3. **NOW**: Smithery registration — quick registry listing
4. **THIS WEEK**: ChatGPT App Directory submission
5. **THIS WEEK**: Zapier push + n8n npm publish
6. **NEXT WEEK**: Slack App Directory
7. **NEXT WEEK**: Product Hunt launch prep
8. **WEEK 3**: Make.com + Pipedream
9. **WEEK 4**: VS Code extension + Gemini CLI
10. **MONTH 2**: Vercel, Replit, HuggingFace, LangChain, CrewAI

---

## Appendix: Platform-Specific Requirements (from Research)

### ChatGPT App Directory
- Icon: **64x64px PNG** (128x128 for retina), under 5KB, transparent
- OAuth 2.1 with PKCE + Dynamic Client Registration required
- Tool annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) mandatory
- App name max 30 chars, no generic dictionary terms
- Privacy policy + Terms of Service URLs required
- Must test on **both web AND mobile**
- No estimated review timeline (beta process)

### Claude Connectors Directory
- Submit via Google Form (link in CONNECTOR_SUBMISSIONS.md)
- ~2 weeks average review time
- Tool annotations mandatory: each tool needs exactly one primary annotation
- README must have privacy section
- Manifest must have `privacy_policies` array
- 3+ working examples demonstrating core functionality
- Provide test account with dummy data for QA team
- Icon auto-detected from favicon at MCP server URL

### Smithery MCP Marketplace
- Self-service: `smithery mcp publish "https://mcp.debatekit.ai/mcp" -n @debatekit/debatekit`
- Or web UI at smithery.ai/new
- Icon max 1MB (PNG/JPG)
- Ranked by usage (leaderboard at smithery.ai/leaderboard)
- No formal review process — instant listing
- Auto-discovers tools from server

### Gemini CLI Extension
- **No formal marketplace** — auto-indexed gallery at geminicli.com/extensions
- Add `gemini-cli-extension` topic to GitHub repo for auto-discovery
- No icon field in manifest (gallery pulls from GitHub)
- `settings` array with `sensitive: true` for API keys (stored in system keychain)
- No review process — fully self-service via GitHub

### Zapier
- Logo: **256x256px PNG, transparent background**, min 72 DPI, no text
- Primary brand color hex (cannot be #FFFFFF)
- Need **3+ test users with live Zaps** before submission
- Admin email must match app domain
- Description: 40-140 chars, must start with "[Name] is a..."
- Category: "Artificial Intelligence > MCP" or "Artificial Intelligence > AI Agents"
- ~1 week initial review, then 90-day beta, then public
- Create test account for `integration-testing@zapier.com`

### n8n Community Node
- npm package name must be `n8n-nodes-*`
- `keywords` must contain `"n8n-community-node-package"`
- License must be MIT for verified status
- **Zero runtime dependencies** for verified nodes
- SVG icon preferred (60x60 square canvas)
- Verified status at creators.n8n.io
- Provenance required after May 2026 (`npm publish --provenance`)

### Slack App Directory
- Icon: **512x512px minimum**
- Landing page, privacy policy, support URL all required (on your domain)
- Bot Token Scopes: principle of least privilege
- TLS 1.2+ on all endpoints
- Review: ~1 week preliminary + up to 8 weeks functional
- Must have external users/customers (not internal-only)

### Make.com
- Logo: **512x512px PNG**, max 2048x2048, max 512KB
- Technology Partner Program registration required
- 3-phase review: form → automated → manual QA
- REST API modules only (Action, Search, Trigger, Webhook)

### Pipedream
- Open source PR to github.com/PipedreamHQ/pipedream
- ES modules (.mjs files)
- Components in `components/debatekit/` directory
- No revenue sharing (open source)

### Product Hunt
- Logo: **240x240px**, under 3MB
- Gallery images: **1270x760px**, 2-8 images
- Tagline: 60 chars max, no emojis
- Short description: 260 chars max
- Launch at 12:01 AM PT, Tuesday/Wednesday recommended
- Pre-write first comment (300-400 words)
- Reply to every comment within 9 minutes

### VS Code / GitHub MCP Registry
- Two paths: VS Code extension (128x128+ PNG icon, `vsce publish`) OR GitHub MCP Registry
- GitHub MCP Registry: namespace `io.github.<org>/<server>`, auto-appears in VS Code @mcp gallery
- Cursor: Plugin format with `plugin.json`, submit at cursor.com/marketplace/publish
- Windsurf: No public self-service submission yet
- Zed: Rust extension wrapper, PR to zed-industries/extensions
