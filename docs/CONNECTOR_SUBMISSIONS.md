# Connector Submission Preparation

Ready-to-paste copy and configuration for submitting DebateKit to platform directories.

**Product:** DebateKit
**Website:** https://debatekit.com
**MCP Server:** https://mcp.debatekit.com/mcp
**Company:** Deadpixel

---

## Table of Contents

1. [Anthropic Claude Connectors Directory](#1-anthropic-claude-connectors-directory)
2. [OpenAI ChatGPT App Directory](#2-openai-chatgpt-app-directory)
3. [Google Gemini CLI Extensions](#3-google-gemini-cli-extensions)
4. [Product Hunt Launch](#4-product-hunt-launch)
5. [Slack App Directory (Future)](#5-slack-app-directory-future)
6. [Zapier Integration (Future)](#6-zapier-integration-future)
7. [n8n Community Node (Future)](#7-n8n-community-node-future)
8. [Vercel Marketplace (Future)](#8-vercel-marketplace-future)
9. [Appendix: Tool Reference](#appendix-tool-reference)

---

## 1. Anthropic Claude Connectors Directory

**Submission form:** https://docs.google.com/forms/d/e/1FAIpQLSeafJF2NDI7oYx1r8o0ycivCSVLNq92Mpc1FPxMKSw1CzDkqA/viewform

### Form Fields

| Field | Value |
|-------|-------|
| Company name | Deadpixel |
| Connector name | DebateKit |
| Website URL | https://debatekit.com |
| MCP server URL | `https://mcp.debatekit.com/mcp` |

**Description:**

```
Multi-model AI brainstorming -- consult a council of AI models that discuss your question sequentially (each sees prior responses), then a moderator synthesizes diverse perspectives into actionable insight. Supports specialized councils for architecture design, code review, debugging, implementation planning, and tradeoff assessment. Auto-mode selects optimal models and roles from your prompt. Fully configurable: thinking level, output format, conversation mode, and model selection.
```

**Category:** Productivity / AI Tools

**Auth type:** Bearer token (API key) + OAuth 2.0 with PKCE

**Auth details:**

```
- Bearer token: API keys with `rpnd_` prefix, sent via `Authorization: Bearer <key>` or `x-api-key` header
- OAuth 2.0: Authorization Code Grant with PKCE (S256)
  - Authorization endpoint: https://mcp.debatekit.com/authorize
  - Token endpoint: https://mcp.debatekit.com/token
  - Registration endpoint: https://mcp.debatekit.com/register
  - Discovery: https://mcp.debatekit.com/.well-known/oauth-authorization-server
  - Scopes: mcp:tools
  - Dynamic client registration supported
```

**Available tools (13):**

```
1.  consult           - Consult the AI coding council. Multiple models discuss your engineering question sequentially (each sees prior responses), then a moderator synthesizes. Auto-mode by default -- AI picks optimal models, roles, and conversation mode from your prompt. Provide explicit models to override (manual mode). Fully configurable: mode, format, roles, models, thinking level.

2.  architect         - Architecture design council. Systems Architect, Infrastructure Engineer, and DX Advocate evaluate your system design. Always uses high thinking for maximum depth. Output as ADR.

3.  review_code       - Code review council. Senior Engineer, Security Reviewer, and Performance Analyst analyze your code and a moderator synthesizes their findings.

4.  debug             - Debugging council. Root Cause Analyst, Systems Engineer, and Edge Case Investigator collaboratively diagnose bugs, analyze errors, and propose fixes.

5.  plan_implementation - Implementation planning council. Tech Lead, Senior Engineer, and QA Strategist break down a feature into actionable steps, identify risks, and define acceptance criteria. Output as ADR.

6.  assess_tradeoffs  - Tradeoff assessment council. Pragmatist, Skeptic, and Futurist evaluate options from different angles -- short-term vs long-term, risk vs reward, simplicity vs flexibility. Output as pros-cons.

7.  check_usage       - Check your remaining credits, usage limits, and plan info.

8.  list_models       - List available AI models grouped by thinking level (low/medium/high). Shows default models, credit costs, capabilities for each tier.

9.  list_sessions     - List your previous MCP tool sessions. Returns session metadata including prompt, tool used, quality score, and credits consumed.

10. get_session       - Get full details of a previous MCP session by ID. Returns the complete result including participant responses and moderator synthesis.

11. get_thread_link   - Get the dashboard URL for a previous debate session. Returns the thread link and public URL if the thread is public.

12. set_thread_visibility - Set a thread as public or private. Public threads can be shared via URL.

13. get_logs          - Query structured logs from your MCP tool executions. Filter by session, severity level, event type, and time range.
```

**Available prompts (3):**

```
1. quick-consult        - Fast, cheap AI council opinion on a question (uses low thinking)
2. deep-review          - High-thinking code review with security + performance focus
3. architecture-decision - Full architecture council for design decisions
```

**Available resources (2):**

```
1. debatekit://usage  - Current credit balance, plan type, and rate limit status (application/json)
2. debatekit://models - Available AI models grouped by thinking level with credit multipliers (application/json)
```

**Test account requirements:**

```
To test the DebateKit MCP connector:
1. Create an account at https://debatekit.com
2. Navigate to Settings > API Keys
3. Generate an API key (prefix: rpnd_)
4. Free tier includes credits for testing all tools
5. Alternatively, use OAuth 2.0 flow -- the connector supports dynamic client registration at /register

Test commands to verify:
- list_models (no input required, verifies auth)
- check_usage (no input required, verifies credit system)
- consult with prompt "What are the tradeoffs of microservices vs monolith?" (verifies debate engine)
```

**Contact info:**

```
Name: Soheil
Email: soheil@deadpixel.ai
Company: Deadpixel
Website: https://deadpixel.ai
```

---

## 2. OpenAI ChatGPT App Directory

**Submission URL:** https://platform.openai.com/apps-manage

### Application Draft

| Field | Value |
|-------|-------|
| App name | DebateKit |
| Category | Productivity |
| MCP Server URL | `https://mcp.debatekit.com/mcp` |
| Auth type | OAuth 2.0 (Authorization Code with PKCE) |
| Privacy policy URL | `https://debatekit.com/legal/privacy` |
| Terms of service URL | `https://debatekit.com/legal/terms` |
| Support email | soheil@deadpixel.ai |

**Short description (80 chars max):**

```
Consult a council of AI models that debate your question and synthesize insight.
```

**Long description (500 chars max):**

```
DebateKit convenes a council of AI models to discuss your question. Each model responds sequentially, seeing prior responses, then a moderator synthesizes everything into actionable insight. Specialized councils for architecture design, code review, debugging, implementation planning, and tradeoff assessment. Three thinking tiers (quick/deep/ultra) balance speed and cost. Auto-mode selects optimal models and roles from your prompt. Every session creates a shareable thread at debatekit.com.
```

**Key tools:**

```
- consult: General-purpose AI council discussion with auto-mode model selection
- architect: Systems design council (Systems Architect, Infra Engineer, DX Advocate)
- review_code: Code review council (Senior Engineer, Security Reviewer, Perf Analyst)
- debug: Debugging council (Root Cause Analyst, Systems Engineer, Edge Case Investigator)
- plan_implementation: Implementation planning (Tech Lead, Senior Engineer, QA Strategist)
- assess_tradeoffs: Decision analysis (Pragmatist, Skeptic, Futurist)
- check_usage: View credits, plan, and rate limits
- list_models: Browse available models by thinking tier
- list_sessions / get_session: Review past council discussions
- get_thread_link / set_thread_visibility: Share sessions via URL
- get_logs: Query execution logs for debugging
```

**OAuth 2.0 Configuration:**

```
Authorization URL: https://mcp.debatekit.com/authorize
Token URL: https://mcp.debatekit.com/token
Registration URL: https://mcp.debatekit.com/register
Scopes: mcp:tools
PKCE: Required (S256)
Token endpoint auth: none (public client)
```

---

## 3. Google Gemini CLI Extensions

### Manifest: `gemini-extension.json`

```json
{
  "name": "debatekit",
  "display_name": "DebateKit",
  "description": "Consult a council of AI models that discuss your question sequentially and synthesize diverse perspectives into actionable insight. Specialized councils for architecture, code review, debugging, planning, and tradeoff assessment.",
  "version": "1.0.0",
  "publisher": "Deadpixel",
  "homepage": "https://debatekit.com",
  "mcp_server_url": "https://mcp.debatekit.com/mcp",
  "auth": {
    "type": "bearer",
    "token_label": "DebateKit API Key",
    "token_description": "Generate at https://debatekit.com/chat/settings/api-keys > API Keys (prefix: rpnd_)",
    "oauth": {
      "authorization_url": "https://mcp.debatekit.com/authorize",
      "token_url": "https://mcp.debatekit.com/token",
      "registration_url": "https://mcp.debatekit.com/register",
      "scopes": ["mcp:tools"],
      "pkce_required": true,
      "pkce_method": "S256"
    }
  },
  "tools": [
    {
      "name": "consult",
      "title": "Consult Council",
      "description": "Multi-model AI council discussion with auto-mode model selection",
      "category": "debate"
    },
    {
      "name": "architect",
      "title": "Architecture Council",
      "description": "Systems Architect, Infra Engineer, and DX Advocate evaluate your system design",
      "category": "debate"
    },
    {
      "name": "review_code",
      "title": "Code Review Council",
      "description": "Senior Engineer, Security Reviewer, and Performance Analyst review your code",
      "category": "debate"
    },
    {
      "name": "debug",
      "title": "Debugging Council",
      "description": "Root Cause Analyst, Systems Engineer, and Edge Case Investigator diagnose bugs",
      "category": "debate"
    },
    {
      "name": "plan_implementation",
      "title": "Implementation Planning",
      "description": "Tech Lead, Senior Engineer, and QA Strategist break down features into steps",
      "category": "debate"
    },
    {
      "name": "assess_tradeoffs",
      "title": "Tradeoff Assessment",
      "description": "Pragmatist, Skeptic, and Futurist evaluate options from different angles",
      "category": "debate"
    },
    {
      "name": "check_usage",
      "title": "Check Usage",
      "description": "View remaining credits, plan info, and rate limits",
      "category": "utility"
    },
    {
      "name": "list_models",
      "title": "List Models",
      "description": "Browse available AI models by thinking tier with credit costs",
      "category": "utility"
    },
    {
      "name": "list_sessions",
      "title": "List Sessions",
      "description": "List previous MCP tool sessions with metadata",
      "category": "utility"
    },
    {
      "name": "get_session",
      "title": "Get Session",
      "description": "Retrieve full details of a previous session by ID",
      "category": "utility"
    },
    {
      "name": "get_thread_link",
      "title": "Get Thread Link",
      "description": "Get dashboard URL and public share link for a session",
      "category": "utility"
    },
    {
      "name": "set_thread_visibility",
      "title": "Set Thread Visibility",
      "description": "Toggle public/private visibility for a session thread",
      "category": "utility"
    },
    {
      "name": "get_logs",
      "title": "Get Logs",
      "description": "Query structured execution logs filtered by session, level, event, and time",
      "category": "utility"
    }
  ],
  "categories": ["productivity", "ai-tools", "developer-tools"],
  "icons": {
    "light": "https://debatekit.com/icon-light.svg",
    "dark": "https://debatekit.com/icon-dark.svg"
  }
}
```

---

## 4. Product Hunt Launch

**Tagline (under 60 chars):**

```
A council of AI models debates your toughest questions
```

**Short description (260 chars):**

```
DebateKit convenes 3-6 AI models to discuss your question. Each sees prior responses, building on each other's ideas. A moderator synthesizes everything into actionable insight. Built-in councils for architecture, code review, debugging, and planning.
```

**First comment / Maker story (800 chars):**

```
Hey Product Hunt! I'm Soheil from Deadpixel.

I built DebateKit because I was tired of getting one perspective from one AI model. When I ask Claude for architecture advice, I get Claude's opinion. When I ask GPT, I get GPT's opinion. Neither tells me what the other would say.

DebateKit fixes this. Ask a question, and 3-6 AI models discuss it sequentially -- each reading what came before. A moderator synthesizes the discussion into a clear recommendation with attributed insights.

It works inside Claude Code, ChatGPT, and any MCP-compatible tool via our MCP server. Or use the web app at debatekit.com for a visual experience with streaming responses.

Specialized councils auto-assign expert roles: Systems Architect + Infra Engineer + DX Advocate for architecture, Senior Engineer + Security Reviewer + Perf Analyst for code review, and more.

Free tier included. Would love your feedback!
```

**Categories:** AI, Productivity, Developer Tools

**Topics:** Artificial Intelligence, Collaboration, Brainstorming, Developer Tools, Code Review

**Suggested launch day:** Tuesday or Wednesday (highest traffic, avoid Monday launches competing with weekend backlog)

**Visual assets checklist:**

```
[ ] Hero image (1270x760px) - Show the council discussion UI with multiple model responses streaming
[ ] Screenshot 1 - Web app: active debatekit discussion with participant cards
[ ] Screenshot 2 - Web app: moderator synthesis with attributed insights
[ ] Screenshot 3 - Claude Code: consult tool in action inside terminal
[ ] Screenshot 4 - Model selection / thinking tier picker
[ ] Screenshot 5 - Session history with thread links
[ ] GIF demo (15-30 sec) - Full flow: ask question -> models respond -> moderator synthesizes
[ ] Logo (240x240px) - DebateKit logo on transparent background
[ ] App icon (80x80px) - Square icon for directory listing
[ ] Thumbnail (640x360px) - Condensed hero for social shares
```

**Social copy for launch day:**

```
Twitter/X: We just launched DebateKit on @ProductHunt! Ask a question, and a council of AI models debates it -- each building on the last response. A moderator synthesizes everything into actionable insight. Works inside Claude Code, ChatGPT, and any MCP client. https://www.producthunt.com/posts/debatekit

LinkedIn: Excited to launch DebateKit -- a multi-model AI brainstorming platform. Instead of getting one AI's opinion, convene a council of 3-6 models that discuss your question and synthesize diverse perspectives. Specialized councils for architecture, code review, debugging, and planning. Available as an MCP connector for Claude, ChatGPT, Gemini, and more.
```

---

## 5. Slack App Directory (Future)

### Application Details

| Field | Value |
|-------|-------|
| App name | DebateKit |
| Bot user display name | DebateKit |
| Short description | Convene a council of AI models to discuss questions and synthesize insights |
| Long description | See below |
| App icon | DebateKit logo (512x512px, min 96x96px) |
| Background color | Match brand primary |
| Category | Productivity |
| Slash command | `/debatekit` |

**Long description (4000 chars max):**

```
DebateKit brings multi-model AI brainstorming directly into Slack. Ask a question with /debatekit and a council of AI models will discuss it -- each model reads prior responses and builds on them. A moderator then synthesizes the discussion into clear, actionable insight with attributed perspectives.

How it works:
1. Use /debatekit followed by your question
2. 3-6 AI models discuss your question sequentially
3. Each model sees and responds to what came before
4. A moderator synthesizes everything into a recommendation
5. Results are posted in-thread with a link to the full discussion on debatekit.com

Specialized councils:
- Architecture: Systems Architect, Infrastructure Engineer, DX Advocate
- Code Review: Senior Engineer, Security Reviewer, Performance Analyst
- Debugging: Root Cause Analyst, Systems Engineer, Edge Case Investigator
- Planning: Tech Lead, Senior Engineer, QA Strategist
- Tradeoffs: Pragmatist, Skeptic, Futurist

Three thinking tiers let you balance speed and depth:
- Quick Think: Fast models for simple questions (~10 sec)
- Deep Think: Balanced models for moderate complexity (~20 sec)
- Ultra Think: Maximum reasoning for critical decisions (~40 sec)

Every discussion creates a shareable thread at debatekit.com with the full conversation.
```

**OAuth scopes needed:**

```
- chat:write       - Post council results to channels
- commands         - Register /debatekit slash command
- users:read       - Map Slack users to DebateKit accounts
- app_mentions:read - Respond when @DebateKit is mentioned (optional)
```

**Slash command configuration:**

```
Command: /debatekit
Request URL: https://api.debatekit.com/integrations/slack/command
Short description: Consult a council of AI models
Usage hint: [question] --mode [analyzing|brainstorming|debating|solving] --thinking [low|medium|high]
```

**Event subscriptions:**

```
- app_mention (for @DebateKit mentions in channels)
- message.im (for direct messages to the bot)
```

---

## 6. Zapier Integration (Future)

### Application Details

| Field | Value |
|-------|-------|
| App name | DebateKit |
| App ID | debatekit |
| Description | Multi-model AI brainstorming platform |
| Category | AI Tools |
| Logo | DebateKit logo (256x256px PNG, transparent background) |
| Auth type | API Key |

**Auth configuration:**

```
Auth type: API Key
Key field label: API Key
Key field help text: Generate at debatekit.com/chat/settings/api-keys > API Keys. Keys start with rpnd_ prefix.
Header: Authorization: Bearer {{api_key}}
Test endpoint: GET https://api.debatekit.com/mcp/usage
```

**Triggers:**

```
1. New DebateKit Completed
   - Key: new_debatekit
   - Description: Triggers when a debatekit discussion completes
   - Polling URL: GET https://api.debatekit.com/mcp/history?limit=10
   - Dedup field: session_id
   - Output fields: session_id, tool_name, prompt, moderator_summary, credits_used, duration_ms, thread_url, created_at

2. New Session Created
   - Key: new_session
   - Description: Triggers when any MCP tool session is created
   - Polling URL: GET https://api.debatekit.com/mcp/history?limit=10
   - Dedup field: session_id
   - Output fields: session_id, tool_name, prompt, thinking_level, created_at
```

**Actions:**

```
1. Start DebateKit (Consult)
   - Key: start_debatekit
   - Description: Consult a council of AI models on a question
   - Endpoint: POST https://mcp.debatekit.com/mcp (MCP tool call: consult)
   - Input fields:
     - prompt (required, string): The question to discuss
     - thinking_level (optional, dropdown: low/medium/high, default: medium)
     - mode (optional, dropdown: analyzing/brainstorming/debating/solving)
     - format (optional, dropdown: discussion/adr/comparison/pros-cons)
   - Output fields: session_id, moderator_summary, participant_count, credits_used, thread_url

2. Get Session Details
   - Key: get_session
   - Description: Retrieve full details of a previous session
   - Endpoint: POST https://mcp.debatekit.com/mcp (MCP tool call: get_session)
   - Input fields:
     - session_id (required, string)
   - Output fields: session_id, tool_name, prompt, moderator_summary, participants, credits, duration_ms

3. Check Usage
   - Key: check_usage
   - Description: Check remaining credits and plan info
   - Endpoint: POST https://mcp.debatekit.com/mcp (MCP tool call: check_usage)
   - Output fields: plan, credits, status, daily_used, daily_limit, weekly_used, weekly_limit
```

**Searches:**

```
1. Find Session by ID
   - Key: find_session
   - Description: Look up a specific session by its ID
   - Endpoint: POST https://mcp.debatekit.com/mcp (MCP tool call: get_session)
   - Input fields: session_id (required)
   - Output fields: Same as Get Session action

2. List Recent Sessions
   - Key: list_sessions
   - Description: List recent MCP tool sessions
   - Endpoint: POST https://mcp.debatekit.com/mcp (MCP tool call: list_sessions)
   - Input fields:
     - limit (optional, integer, default: 20, max: 100)
     - tool_name (optional, dropdown: consult/architect/review_code/debug/plan_implementation/assess_tradeoffs)
   - Output fields: sessions[] (id, tool_name, prompt, thinking_level, credits, duration_ms)
```

---

## 7. n8n Community Node (Future)

### Package Details

| Field | Value |
|-------|-------|
| npm package name | `n8n-nodes-debatekit` |
| Node display name | DebateKit |
| Node description | Multi-model AI brainstorming -- consult a council of AI models |
| npm keywords | n8n, n8n-community-node-package, debatekit, ai, mcp, brainstorming |
| License | MIT |
| Author | Deadpixel <soheil@deadpixel.ai> |

**Credential type:**

```
Name: DebateKit API
Type: API Key
Properties:
  - apiKey:
      displayName: API Key
      type: string
      placeholder: rpnd_xxxxxxxxxxxx
      description: Generate at debatekit.com/chat/settings/api-keys > API Keys
Authentication:
  header: Authorization
  value: Bearer {{apiKey}}
Test request: GET https://api.debatekit.com/mcp/usage
```

**Node operations:**

```
Resource: DebateKit
Operations:
  1. Consult
     - Description: Consult a council of AI models on a question
     - Fields: prompt, thinking_level, mode, format, models[], roles[], context

  2. Architect
     - Description: Architecture design council for system design
     - Fields: description, scale, tech_stack[], focus_areas[]

  3. Review Code
     - Description: Code review council for code analysis
     - Fields: code, language, focus[], thinking_level

  4. Debug
     - Description: Debugging council for bug diagnosis
     - Fields: problem, error, code, expected_behavior, thinking_level

  5. Plan Implementation
     - Description: Implementation planning council
     - Fields: feature, tech_stack[], constraints[], codebase_context, thinking_level

  6. Assess Tradeoffs
     - Description: Tradeoff assessment for decision analysis
     - Fields: decision, options[], priorities[], context, thinking_level

Resource: Session
Operations:
  1. List Sessions
     - Fields: limit, offset, tool_name

  2. Get Session
     - Fields: session_id

  3. Get Thread Link
     - Fields: session_id

  4. Set Thread Visibility
     - Fields: session_id, is_public

Resource: Account
Operations:
  1. Check Usage
     - No fields required

  2. List Models
     - Fields: thinking_level (optional)

  3. Get Logs
     - Fields: session_id, level, event, limit, start_time, end_time
```

**package.json excerpt:**

```json
{
  "name": "n8n-nodes-debatekit",
  "version": "1.0.0",
  "description": "n8n community node for DebateKit -- multi-model AI brainstorming platform",
  "keywords": [
    "n8n-community-node-package",
    "n8n",
    "debatekit",
    "ai",
    "brainstorming",
    "mcp",
    "multi-model"
  ],
  "license": "MIT",
  "author": {
    "name": "Deadpixel",
    "email": "soheil@deadpixel.ai"
  },
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": ["dist/credentials/DebateKitApi.credentials.js"],
    "nodes": ["dist/nodes/DebateKit/DebateKit.node.js"]
  }
}
```

---

## 8. Vercel Marketplace (Future)

### Application Letter Draft

```
Subject: DebateKit Integration -- Multi-Model AI Brainstorming for Vercel Developers

Hi Vercel Marketplace Team,

We'd like to submit DebateKit as a Vercel Marketplace integration.

DebateKit is a multi-model AI brainstorming platform that convenes a council of
AI models to discuss engineering questions. Each model responds sequentially,
building on prior responses, and a moderator synthesizes the discussion into
actionable recommendations.

Why Vercel developers need this:

1. Architecture decisions: Before building on Vercel, consult the Architecture
   Council (Systems Architect + Infra Engineer + DX Advocate) to validate your
   design. Get an ADR-formatted recommendation.

2. Code review: Submit your Next.js components or API routes to the Code Review
   Council for multi-perspective analysis covering security, performance, and
   engineering quality.

3. Debugging: When your Vercel deployment fails, the Debugging Council provides
   root cause analysis from three angles -- causality, systems, and edge cases.

4. Implementation planning: Before starting a feature, get a breakdown from
   Tech Lead + Senior Engineer + QA Strategist with risks and acceptance criteria.

Integration approach:

- MCP-native: Works with any MCP-compatible tool (Claude Code, ChatGPT, Cursor)
- REST API: Direct HTTP integration for custom workflows
- Webhook support: Send results to any endpoint for CI/CD integration
- Session threads: Every discussion creates a shareable page at debatekit.com

Technical details:
- Hosted on Cloudflare Workers (global edge, low latency)
- OAuth 2.0 with PKCE for secure auth
- Credit-based billing with free tier
- 3 thinking tiers: Quick ($), Deep ($$), Ultra ($$$)

We're built on Vercel-adjacent technology (TanStack Start for our web app) and
serve the same developer audience. Happy to discuss integration details.

Best,
Soheil
Deadpixel
soheil@deadpixel.ai
```

### Integration Description (for marketplace listing)

```
DebateKit brings multi-model AI brainstorming to your development workflow.
Instead of getting one AI's opinion, convene a council of 3-6 AI models that
discuss your question and synthesize diverse perspectives into actionable insight.

Features:
- Specialized councils for architecture, code review, debugging, and planning
- Three thinking tiers: Quick (fast/cheap), Deep (balanced), Ultra (max reasoning)
- Auto-mode selects optimal models and roles from your prompt
- Every session creates a shareable thread
- MCP-compatible: works inside Claude Code, ChatGPT, Cursor, and more
- Webhook support for CI/CD integration

Use cases for Vercel developers:
- Validate architecture decisions before deploying to Vercel
- Get multi-perspective code reviews on Next.js components
- Debug deployment failures with root cause analysis
- Plan feature implementations with risk assessment
```

### Use Case for Vercel Developers

```
1. Pre-deploy architecture review
   "Design the architecture for a Next.js e-commerce app with ISR, edge functions,
   and Vercel KV for sessions" -> Architecture Council produces an ADR

2. PR code review augmentation
   Pipe changed files to review_code -> get security, performance, and quality
   analysis from three expert perspectives

3. Build failure debugging
   Paste build error + relevant code into debug -> Root Cause Analyst,
   Systems Engineer, and Edge Case Investigator collaborate on diagnosis

4. Sprint planning
   "Plan implementation for adding Vercel Analytics with custom events and
   server-side tracking" -> Tech Lead + Senior Engineer + QA Strategist
   produce a phased plan with acceptance criteria
```

---

## Appendix: Tool Reference

Complete tool specifications extracted from the codebase for use in any submission.

### Debate Tools (consume credits, call external LLM APIs)

#### `consult`
- **Title:** Consult Council
- **Description:** Consult the AI coding council. Multiple models discuss your engineering question sequentially (each sees prior responses), then a moderator synthesizes. Auto-mode by default.
- **Input:**
  - `prompt` (string, required, max 10000): The question, topic, or problem to debate
  - `context` (string, optional, max 50000): Additional background context (code, docs, requirements)
  - `mode` (enum, optional): analyzing, brainstorming, debating, solving
  - `format` (enum, optional): discussion, adr, comparison, pros-cons
  - `thinking_level` (enum, optional): low, medium, high
  - `models` (string[], optional, min 3, max 6): Override specific model IDs
  - `roles` (string[], optional): Inline role names for participants
  - `auto_route` (boolean, optional): Auto-select optimal models based on prompt analysis
  - `session_context` (string[], optional, max 3): Session IDs to use as context
  - `knowledge` (object[], optional, max 5): Reference knowledge to inject
  - `webhook_url` (string, optional): Webhook URL to POST results to

#### `architect`
- **Title:** Architecture Council
- **Description:** Systems Architect, Infrastructure Engineer, and DX Advocate evaluate your system design. Always uses high thinking. Output as ADR.
- **Roles:** Systems Architect, Infrastructure Engineer, DX Advocate
- **Input:**
  - `description` (string, required, max 10000): What the system should do
  - `scale` (enum, optional): startup, growth, enterprise (default: startup)
  - `tech_stack` (string[], optional): Preferred technologies
  - `focus_areas` (string[], optional): Priority areas (e.g., security, performance)
  - `webhook_url` (string, optional)

#### `review_code`
- **Title:** Code Review Council
- **Description:** Senior Engineer, Security Reviewer, and Performance Analyst analyze your code.
- **Roles:** Senior Engineer, Security Reviewer, Performance Analyst
- **Input:**
  - `code` (string, required, max 100000): The code to review
  - `language` (string, optional): Programming language
  - `focus` (string[], optional): Review focus areas
  - `thinking_level` (enum, optional): low, medium, high
  - `webhook_url` (string, optional)

#### `debug`
- **Title:** Debugging Council
- **Description:** Root Cause Analyst, Systems Engineer, and Edge Case Investigator diagnose bugs.
- **Roles:** Root Cause Analyst, Systems Engineer, Edge Case Investigator
- **Input:**
  - `problem` (string, required, max 10000): Describe the bug or failure
  - `error` (string, optional, max 10000): Error message or stack trace
  - `code` (string, optional, max 100000): Relevant code
  - `expected_behavior` (string, optional, max 5000): What should happen vs what actually happens
  - `thinking_level` (enum, optional): low, medium, high
  - `session_context` (string[], optional, max 3)
  - `knowledge` (object[], optional, max 5)
  - `webhook_url` (string, optional)

#### `plan_implementation`
- **Title:** Implementation Planning
- **Description:** Tech Lead, Senior Engineer, and QA Strategist break down a feature into actionable steps. Output as ADR.
- **Roles:** Tech Lead, Senior Engineer, QA Strategist
- **Input:**
  - `feature` (string, required, max 10000): The feature or change to plan
  - `tech_stack` (string[], optional): Current tech stack
  - `constraints` (string[], optional): Constraints (e.g., no breaking changes)
  - `codebase_context` (string, optional, max 50000): Relevant existing code or architecture notes
  - `thinking_level` (enum, optional): low, medium, high
  - `session_context` (string[], optional, max 3)
  - `knowledge` (object[], optional, max 5)
  - `webhook_url` (string, optional)

#### `assess_tradeoffs`
- **Title:** Tradeoff Assessment
- **Description:** Pragmatist, Skeptic, and Futurist evaluate options from different angles. Output as pros-cons.
- **Roles:** Pragmatist, Skeptic, Futurist
- **Input:**
  - `decision` (string, required, max 10000): The decision to evaluate
  - `options` (string[], optional, min 2): Specific options to compare
  - `priorities` (string[], optional): What matters most (e.g., performance, dx, cost)
  - `context` (string, optional, max 50000): Background context
  - `thinking_level` (enum, optional): low, medium, high (default: medium)
  - `session_context` (string[], optional, max 3)
  - `webhook_url` (string, optional)

### Utility Tools (read-only, no credits consumed)

#### `check_usage`
- **Title:** Check Usage
- **Description:** Check remaining credits, usage limits, and plan info
- **Input:** None
- **Output:** plan, credits, status, rate limits (5-hour, daily, weekly)

#### `list_models`
- **Title:** List Models
- **Description:** List available AI models grouped by thinking level with credit costs and capabilities
- **Input:**
  - `thinking_level` (enum, optional): Filter to a specific thinking level
- **Output:** Models per tier with credit multipliers and capabilities

#### `list_sessions`
- **Title:** List Sessions
- **Description:** List previous MCP tool sessions with metadata
- **Input:**
  - `limit` (integer, optional, 1-100, default: 20)
  - `offset` (integer, optional, default: 0)
  - `tool_name` (string, optional): Filter by tool name
- **Output:** Sessions with id, tool_name, prompt, thinking_level, credits, duration

#### `get_session`
- **Title:** Get Session
- **Description:** Get full details of a previous session by ID
- **Input:**
  - `session_id` (string, required)
- **Output:** Full session with participant responses and moderator synthesis

#### `get_thread_link`
- **Title:** Get Thread Link
- **Description:** Get dashboard URL and public share link for a session
- **Input:**
  - `session_id` (string, required)
- **Output:** dashboard URL, public URL, visibility status

### Mutating Tools

#### `set_thread_visibility`
- **Title:** Set Thread Visibility
- **Description:** Set a thread as public or private for URL sharing
- **Input:**
  - `session_id` (string, required)
  - `is_public` (boolean, required)
- **Output:** Updated visibility status, public URL if public

#### `get_logs`
- **Title:** Get Logs
- **Description:** Query structured execution logs filtered by session, level, event, and time range
- **Input:**
  - `session_id` (string, optional)
  - `level` (enum, optional): Filter by log level
  - `event` (string, optional): Filter by event name
  - `limit` (integer, optional, 1-200, default: 50)
  - `offset` (integer, optional, default: 0)
  - `start_time` (number, optional): Start timestamp (ms)
  - `end_time` (number, optional): End timestamp (ms)
- **Output:** Logs with time, level, event, session_id, data

### Default Models by Thinking Tier

| Tier | Label | Participants | Moderator |
|------|-------|-------------|-----------|
| Low | Quick Think | gemini-2.5-flash, gpt-4o-mini, deepseek-v3.2 | gemini-2.5-flash |
| Medium | Deep Think | claude-sonnet-4, gpt-4.1, gemini-2.5-pro | claude-sonnet-4 |
| High | Ultra Think | claude-opus-4.6, o3, gemini-2.5-pro | claude-opus-4.6 |
