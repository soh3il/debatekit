# DebateKit Distribution Plan: Connectors, Apps & Marketplace Strategy

> Generated: 2026-03-09 | Status: Active

## Executive Summary

DebateKit already has a **production MCP server** (`mcp.debatekit.com`) with 14 tools, OAuth 2.0, and 126 API endpoints. This plan leverages that foundation to distribute DebateKit across **20 platforms** reaching **1.5B+ combined users**.

---

## Current Assets

| Asset | Status | Location |
|-------|--------|----------|
| MCP Server (14 tools) | Production | `apps/mcp/` → `mcp.debatekit.com` |
| REST API (126 endpoints) | Production | `apps/api/` → `api.debatekit.com` |
| OpenAPI Spec | Live | `GET /api/v1/doc` |
| OAuth 2.0 | Live | MCP server endpoints |
| API Key Auth | Live | `x-api-key` header |
| Web App | Production | `debatekit.com` |

---

## Platform Opportunities (Ranked by Priority)

### PHASE 1 — Highest Impact (Weeks 1-4)

#### 1. OpenAI ChatGPT App Directory
| | |
|-|-|
| **Reach** | ~900M weekly active users |
| **Tech** | MCP server (already have one), OAuth 2.0, UI widget (iframe) |
| **Effort** | Medium — adapt existing MCP, add ChatGPT-specific tool annotations + widget |
| **Monetization** | Links to external billing; future rev-share TBD |
| **Status** | Open for submissions |
| **Submit** | [platform.openai.com/apps-manage](https://platform.openai.com/apps-manage) |
| **Docs** | [developers.openai.com/apps-sdk](https://developers.openai.com/apps-sdk/) |

**What to build:**
- [ ] Adapt MCP server for ChatGPT's HTTP transport (stateless mode)
- [ ] Add tool annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`)
- [ ] Build HTML widget showing DebateKit UI in iframe
- [ ] Register tools: `start_debatekit`, `add_participants`, `view_results`, `get_summary`
- [ ] Add `structuredContent` / `_meta` separation to tool responses
- [ ] CSP headers for widget domains
- [ ] Submit to App Directory

**Key constraint:** EU data residency projects cannot submit currently.

---

#### 2. Anthropic Claude Connectors Directory
| | |
|-|-|
| **Reach** | ~300M total users, 18.9M MAU on claude.ai |
| **Tech** | MCP server with Streamable HTTP (not SSE) |
| **Effort** | Low — existing MCP server is already Claude-compatible |
| **Monetization** | None yet; Claude Marketplace (enterprise) separate |
| **Status** | Open via Google Form |
| **Submit** | [Connectors Directory Review Form](https://docs.google.com/forms/d/e/1FAIpQLSeafJF2NDI7oYx1r8o0ycivCSVLNq92Mpc1FPxMKSw1CzDkqA/viewform) |
| **Docs** | [Connectors Directory FAQ](https://support.claude.com/en/articles/11596036-anthropic-connectors-directory-faq) |

**What to build:**
- [ ] Verify MCP server uses Streamable HTTP transport (not legacy SSE)
- [ ] Add `readOnlyHint` / `destructiveHint` annotations to all tools
- [ ] Ensure tool results stay under 25K token limit
- [ ] Provide test account for Anthropic review
- [ ] Submit via Google Form

**Existing MCP server should work with minimal changes.**

---

#### 3. Custom GPT (ChatGPT GPT Store)
| | |
|-|-|
| **Reach** | ~900M WAU (same ChatGPT user base) |
| **Tech** | No-code: instructions + knowledge files |
| **Effort** | Very Low — configure in ChatGPT builder |
| **Monetization** | Rev-share (~$0.03/conversation) |
| **Status** | Open |
| **Submit** | [chatgpt.com/create](https://chatgpt.com/create) |

**What to build:**
- [ ] Write system prompt for "DebateKit Brainstorm" GPT
- [ ] Define 6 persona instructions (Devil's Advocate, Optimist, Pragmatist, etc.)
- [ ] Upload DebateKit docs as knowledge files
- [ ] Create prompt starters: "Start a brainstorm about...", "Debate the pros and cons of..."
- [ ] Enable web search + code interpreter
- [ ] Publish to GPT Store
- [ ] Create additional specialized GPTs: "DebateKit Code Review", "DebateKit Product Strategy"

**Quick win — can be done in hours, not days.**

---

#### 4. Product Hunt Launch
| | |
|-|-|
| **Reach** | ~3M monthly visitors (tech-savvy, early adopters) |
| **Tech** | None — product must be live |
| **Effort** | Low — prepare assets + launch |
| **Monetization** | N/A (awareness/traffic driver) |
| **Status** | Always open |
| **Submit** | [producthunt.com/launch](https://www.producthunt.com/launch) |

**What to prepare:**
- [ ] Compelling tagline (under 60 chars)
- [ ] 3-5 product screenshots / GIF demo
- [ ] Maker comment (800 chars, explain why you built it)
- [ ] Launch day: Tue/Wed/Thu for max visibility
- [ ] 30-day post-launch conversion plan
- [ ] Coordinate with community for authentic engagement

---

### PHASE 2 — Strong Distribution (Weeks 5-10)

#### 5. Slack App Directory
| | |
|-|-|
| **Reach** | ~47M DAU, 215K+ organizations |
| **Tech** | Slack Bolt SDK, Events API, Block Kit, OAuth 2.0 |
| **Effort** | High — full Slack bot + slash commands |
| **Monetization** | External billing |
| **Status** | Open (need 10 active workspace installs first) |
| **Submit** | [api.slack.com/developer-program](https://api.slack.com/developer-program) |
| **Docs** | [Slack Marketplace Guidelines](https://docs.slack.dev/slack-marketplace/) |

**What to build:**
- [ ] Slack bot: `/debatekit` slash command to start a brainstorm
- [ ] Thread-based discussion flow (bot posts each participant's response)
- [ ] Interactive Block Kit messages for configuring participants
- [ ] OAuth flow linking Slack workspace to DebateKit account
- [ ] Webhook handler for Slack events
- [ ] Deploy as Cloudflare Worker or separate service
- [ ] Get 10+ workspace installs before submission

---

#### 6. Microsoft Copilot Plugin
| | |
|-|-|
| **Reach** | ~33M active Copilot users |
| **Tech** | OpenAPI spec + Teams app manifest |
| **Effort** | Medium — existing OpenAPI spec needs adaptation |
| **Monetization** | Microsoft Commercial Marketplace |
| **Status** | Open via Partner Center |
| **Submit** | [partner.microsoft.com](https://partner.microsoft.com/) |
| **Docs** | [Copilot Extensibility](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/) |

**What to build:**
- [ ] Adapt OpenAPI spec for Copilot plugin format
- [ ] Create Teams app manifest (JSON)
- [ ] Implement Copilot-specific auth flow
- [ ] Register as Microsoft Partner
- [ ] Submit through Partner Center

---

#### 7. Microsoft Teams App Store
| | |
|-|-|
| **Reach** | ~320M DAU, ~500M MAU |
| **Tech** | Teams SDK, Azure Bot Framework, tabs/messaging extensions |
| **Effort** | High — full Teams app with tabs + bot |
| **Monetization** | Commercial Marketplace SaaS offers |
| **Status** | Open via Partner Center |
| **Submit** | [partner.microsoft.com](https://partner.microsoft.com/) |
| **Docs** | [Teams Platform](https://learn.microsoft.com/en-us/microsoftteams/platform/) |

**What to build:**
- [ ] Teams tab embedding DebateKit web app
- [ ] Teams bot for starting/viewing debatekits
- [ ] Messaging extension for quick brainstorm summaries
- [ ] Azure Bot Framework integration
- [ ] Microsoft Partner Center account setup

**Can share work with Copilot plugin (same Partner Center, similar manifest).**

---

#### 8. Zapier Integration
| | |
|-|-|
| **Reach** | 3M+ users, 100K+ paying customers, 8K+ apps |
| **Tech** | REST API + Zapier Developer Platform |
| **Effort** | Medium — define triggers/actions/searches |
| **Monetization** | External billing |
| **Status** | Open (need 50 active users post-publication) |
| **Submit** | [zapier.com/developer-platform](https://zapier.com/developer-platform) |
| **Docs** | [Publishing Requirements](https://docs.zapier.com/platform/publish/) |

**What to build:**
- [ ] **Triggers:** New debatekit completed, New message in thread, Round finished
- [ ] **Actions:** Create thread, Start debatekit, Add participant, Get summary
- [ ] **Searches:** Find thread by topic, List recent debatekits
- [ ] API key auth integration
- [ ] 10+ Zap templates (e.g., "Slack message → DebateKit brainstorm → Notion page")
- [ ] Test account for Zapier review

---

#### 9. Notion Integration
| | |
|-|-|
| **Reach** | 100M+ users, 4M+ paying |
| **Tech** | Notion REST API, OAuth 2.0 |
| **Effort** | Medium — bidirectional sync |
| **Monetization** | External billing |
| **Status** | Open (self-serve submissions) |
| **Submit** | [developers.notion.com](https://developers.notion.com) |
| **Docs** | [Integration Gallery Publishing](https://developers.notion.com/docs/publishing-integrations-to-notions-integration-gallery) |

**What to build:**
- [ ] Export debatekit results as Notion pages (structured blocks)
- [ ] Import Notion pages as debatekit context/knowledge
- [ ] OAuth flow for Notion workspace connection
- [ ] Page template for debatekit summaries

---

#### 10. Google Gemini CLI Extensions
| | |
|-|-|
| **Reach** | Growing developer audience; 70+ extensions live |
| **Tech** | MCP server + `gemini-extension.json` manifest |
| **Effort** | Low — existing MCP server + manifest file |
| **Monetization** | None |
| **Status** | Open (GitHub-based) |
| **Submit** | [geminicli.com/extensions](https://geminicli.com/extensions/) |
| **Docs** | [Gemini CLI Extensions Guide](https://codelabs.developers.google.com/getting-started-gemini-cli-extensions) |

**What to build:**
- [ ] Create `gemini-extension.json` manifest pointing to MCP server
- [ ] Sanitize tool names for Gemini API compatibility
- [ ] Submit to extensions gallery
- [ ] GitHub repo with docs + stars for ranking

---

### PHASE 3 — Developer & Niche Audiences (Weeks 11-16)

#### 11. VS Code / Cursor MCP Extension
| | |
|-|-|
| **Reach** | 50M+ VS Code MAU, 1M+ Cursor users |
| **Tech** | VS Code Extension API + MCP server config |
| **Effort** | Medium — VS Code extension wrapper |
| **Monetization** | External billing |
| **Submit** | [marketplace.visualstudio.com](https://marketplace.visualstudio.com/) |

**What to build:**
- [ ] VS Code extension that registers DebateKit MCP server
- [ ] Configuration UI for API key setup
- [ ] Commands: "Start DebateKit", "Review Code with DebateKit"
- [ ] Sidebar panel showing recent debatekits
- [ ] Publish to VS Marketplace + Open VSX (for Cursor)

---

#### 12. Vercel Marketplace
| | |
|-|-|
| **Reach** | 6M+ developers |
| **Tech** | Vercel Marketplace API |
| **Effort** | Medium |
| **Submit** | [vercel.com/marketplace/program](https://vercel.com/marketplace/program) |

**What to build:**
- [ ] Apply to marketplace program
- [ ] Resource provisioning API integration
- [ ] Vercel project integration (add DebateKit to any project)

---

#### 13. n8n Community Node
| | |
|-|-|
| **Reach** | 230K+ active users |
| **Tech** | npm package (`n8n-nodes-debatekit`) |
| **Effort** | Medium |
| **Submit** | [n8n Creator Portal](https://docs.n8n.io/integrations/creating-nodes/) |

**What to build:**
- [ ] npm package with DebateKit triggers + actions
- [ ] GitHub Action with provenance statement (required May 2026+)
- [ ] Submit for verification

---

#### 14. Make (Integromat) App
| | |
|-|-|
| **Reach** | 3.1M+ users |
| **Tech** | Make Developer Hub, REST API modules |
| **Effort** | Medium |
| **Submit** | [docs.integromat.com/apps](https://docs.integromat.com/apps) |

**What to build:**
- [ ] Triggers, actions, searches via Make's module framework
- [ ] Authentication module (API key)
- [ ] Submit for review

---

#### 15. Replit MCP Connector
| | |
|-|-|
| **Reach** | Millions of developers |
| **Tech** | MCP server (already have) |
| **Effort** | Very Low — existing MCP server works |
| **Status** | Partner-driven |

**What to build:**
- [ ] Verify MCP server passes Replit security scanner
- [ ] Contact Replit partnerships for featured listing
- [ ] Document setup instructions for Replit users

---

#### 16. HuggingFace Space
| | |
|-|-|
| **Reach** | 18M+ monthly visitors |
| **Tech** | Gradio/Streamlit or Docker |
| **Effort** | Low — demo app |
| **Monetization** | None |
| **Submit** | [huggingface.co/spaces/launch](https://huggingface.co/spaces/launch) |

**What to build:**
- [ ] Gradio demo app showcasing DebateKit brainstorming
- [ ] Connect to DebateKit API for live demos
- [ ] Embed in HF model cards for related AI models

---

### PHASE 4 — Exploratory (Weeks 17+)

#### 17. CrewAI Marketplace
| | |
|-|-|
| **Reach** | 100K+ certified developers |
| **Tech** | Python, CrewAI framework |
| **Effort** | Medium |
| **Submit** | [marketplace.crewai.com](https://marketplace.crewai.com/) |

#### 18. Pipedream Integration
| | |
|-|-|
| **Reach** | 1M+ developers |
| **Tech** | Node.js components |
| **Effort** | Low-Medium |
| **Submit** | [GitHub: PipedreamHQ/pipedream](https://github.com/PipedreamHQ/pipedream) |

#### 19. LangChain Hub
| | |
|-|-|
| **Reach** | Large developer community |
| **Tech** | LangChain/LangGraph |
| **Effort** | Low |
| **Submit** | [smith.langchain.com/hub](https://smith.langchain.com/hub) |

#### 20. Cloudflare Showcase
| | |
|-|-|
| **Reach** | Cloudflare developer community |
| **Tech** | Already on Workers |
| **Effort** | Very Low — blog post / case study |

---

## Implementation Architecture

### Shared MCP Layer

All MCP-based platforms (ChatGPT, Claude, Gemini, VS Code, Cursor, Replit) share the same core:

```
apps/mcp/src/
├── tools/           # 14 existing tools
├── auth/            # OAuth 2.0 + API key
├── adapters/        # Platform-specific adapters
│   ├── chatgpt.ts   # ChatGPT widget + annotations
│   ├── claude.ts    # Streamable HTTP transport
│   ├── gemini.ts    # Tool name sanitization
│   └── generic.ts   # Default MCP transport
└── index.ts         # Route to correct adapter
```

### Platform-Specific Apps

```
apps/
├── mcp/             # Core MCP server (exists)
├── slack/           # Slack bot (new)
├── teams/           # Teams app (new)
├── zapier/          # Zapier integration (new)
├── n8n/             # n8n community node (new)
└── chatgpt-widget/  # ChatGPT iframe widget (new)
```

### Shared API Client

All integrations use the existing REST API via `api.debatekit.com`:

```typescript
// packages/api-client/src/index.ts
// Type-safe Hono RPC client (already exists via hc<AppType>)
```

---

## Timeline & Milestones

| Week | Deliverable | Platform |
|------|-------------|----------|
| 1 | Custom GPTs published to GPT Store | ChatGPT GPT Store |
| 1-2 | Claude Connectors submission | Claude Directory |
| 2-3 | ChatGPT App (MCP + widget) submitted | ChatGPT App Directory |
| 3 | Product Hunt launch prep | Product Hunt |
| 4 | Product Hunt launch day | Product Hunt |
| 4 | Gemini CLI extension submitted | Gemini Extensions |
| 5-7 | Slack bot MVP + 10 installs | Slack App Directory |
| 6-8 | Zapier integration published | Zapier |
| 8-10 | Notion integration | Notion Gallery |
| 8-10 | Microsoft Partner setup + Copilot plugin | Copilot + Teams |
| 11-13 | VS Code extension | VS Marketplace |
| 11-13 | n8n + Make modules | Automation platforms |
| 14-16 | Vercel Marketplace application | Vercel |
| 14-16 | HuggingFace Space demo | HuggingFace |
| 17+ | CrewAI, Pipedream, LangChain | Exploratory |

---

## Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Platforms live | 10+ |
| Monthly installs/connections | 5,000+ |
| API calls from integrations | 50,000+/month |
| Revenue from integrations | Track separately per platform |
| ChatGPT App DAU | 1,000+ |
| Slack workspace installs | 100+ |
| Zapier active users | 500+ |

---

## Risk Factors

| Risk | Mitigation |
|------|------------|
| Review rejection (any platform) | Follow guidelines exactly; provide test accounts; iterate on feedback |
| Rate limiting under load | Existing KV cache + queue system; per-platform rate limits |
| Auth complexity across platforms | Centralize OAuth in MCP server; API keys as fallback |
| Maintenance burden (20 platforms) | Shared MCP core; platform adapters are thin layers |
| Low adoption on niche platforms | Focus on Tier 1-2 first; sunset underperformers |

---

## Quick Reference: Submission URLs

| Platform | URL |
|----------|-----|
| ChatGPT App Directory | [platform.openai.com/apps-manage](https://platform.openai.com/apps-manage) |
| ChatGPT GPT Store | [chatgpt.com/create](https://chatgpt.com/create) |
| Claude Connectors | [Google Form](https://docs.google.com/forms/d/e/1FAIpQLSeafJF2NDI7oYx1r8o0ycivCSVLNq92Mpc1FPxMKSw1CzDkqA/viewform) |
| Slack Developer Program | [api.slack.com/developer-program](https://api.slack.com/developer-program) |
| Microsoft Partner Center | [partner.microsoft.com](https://partner.microsoft.com/) |
| Zapier Developer Platform | [zapier.com/developer-platform](https://zapier.com/developer-platform) |
| Notion Developer Portal | [developers.notion.com](https://developers.notion.com) |
| Gemini CLI Extensions | [geminicli.com/extensions](https://geminicli.com/extensions/) |
| VS Code Marketplace | [marketplace.visualstudio.com](https://marketplace.visualstudio.com/) |
| Vercel Marketplace | [vercel.com/marketplace/program](https://vercel.com/marketplace/program) |
| n8n Creator Portal | [n8n Submission Guide](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/) |
| Make Developer Hub | [docs.integromat.com/apps](https://docs.integromat.com/apps) |
| Product Hunt | [producthunt.com/launch](https://www.producthunt.com/launch) |
| HuggingFace Spaces | [huggingface.co/spaces/launch](https://huggingface.co/spaces/launch) |
| CrewAI Marketplace | [marketplace.crewai.com](https://marketplace.crewai.com/) |
| Replit MCP | [docs.replit.com/replitai/mcp](https://docs.replit.com/replitai/mcp/overview) |
| Pipedream | [github.com/PipedreamHQ/pipedream](https://github.com/PipedreamHQ/pipedream) |
| LangChain Hub | [smith.langchain.com/hub](https://smith.langchain.com/hub) |
