# DebateKit as LLM Harness Infrastructure

## The Thesis

"2025 was agents. 2026 is agent harnesses." — emerging consensus across Anthropic, OpenAI, Martin Fowler, Mitchell Hashimoto.

**The model is approaching commodity status.** Claude, GPT, Gemini perform similarly at the frontier. The harness — the infrastructure that wraps around the LLM — determines success or failure.

DebateKit already is a harness. It wraps multiple LLMs, orchestrates their interaction, manages credits/abuse/auth, and synthesizes results. But it's a **debate-only harness**. The opportunity: evolve it into a **general-purpose developer harness** — the control plane for multi-model engineering workflows.

---

## What DebateKit Has Today (Strengths)

| Capability | Status | Notes |
|---|---|---|
| Multi-model orchestration | Strong | Sequential debate with CEBR protocol |
| Model routing via OpenRouter | Strong | 300+ models, 3 thinking tiers |
| Credit system | Excellent | Per-model multipliers, optimistic locking, transaction ledger |
| Abuse detection | Excellent | 5 behavioral patterns, score decay, auto-ban |
| Usage limits | Strong | 3 time windows, per-plan limits, cooldowns |
| Auth | Strong | Bearer token + OAuth 2.0 + API keys |
| Analytics | Good | PostHog events, client detection, milestones |
| MCP protocol | Strong | Full MCP server, 7 developer tools |
| Moderator synthesis | Good | 4 output formats (discussion, ADR, comparison, pros-cons) |

**Key insight**: DebateKit's operational infrastructure (credits, abuse, limits, auth) is more mature than most harness platforms. The gap is in **breadth of orchestration patterns** beyond debate.

---

## Gap Analysis: What's Missing

### Critical Gaps

| Gap | Impact | Difficulty |
|---|---|---|
| **Debate results are transient** — not persisted | Can't learn, replay, or analyze | Medium |
| **Sequential-only execution** — no parallel mode | 3x slower than necessary for independent participants | Low |
| **No evaluation framework** — can't score output quality | No feedback loop for improvement | High |
| **Prompts are hardcoded** — no versioning or A/B testing | Can't iterate on prompt quality | Medium |
| **Single provider (OpenRouter)** — no direct provider support | Vendor lock-in, no local models | Medium |
| **No workflow engine** — fixed 2-phase debate | Can't compose multi-step pipelines | High |
| **No context carryover** — each debate is isolated | Can't build on prior work | Medium |

### Secondary Gaps

| Gap | Impact | Difficulty |
|---|---|---|
| No model registry (just string IDs) | Hard to track versions, capabilities | Low |
| No content filtering / output validation | Safety risk at scale | Medium |
| Pre-flight cost estimation is naive (assumes 500 tokens) | Inaccurate billing warnings | Low |
| No vector embeddings / RAG | Can't augment with knowledge | High |
| No structured logging (only PostHog events) | Can't query/replay | Medium |

---

## Vision: DebateKit as "The Developer's LLM Harness"

### Positioning

**Not** a general agent framework (LangChain, CrewAI territory).
**Not** a model gateway (OpenRouter, LiteLLM territory).
**Not** an evaluation benchmark (HELM, Inspect AI territory).

**DebateKit = the multi-model council harness for engineering decisions.**

The unique value: when you need **multiple expert perspectives on an engineering problem**, DebateKit orchestrates the conversation, synthesizes the result, and learns from the outcome.

### Core Differentiator: Council-as-a-Service

Every tool is a "council" — a structured multi-model conversation with:
- **Roles** — defined expert perspectives
- **Protocol** — how models interact (CEBR: Challenge, Extend, Build, Reframe)
- **Synthesis** — moderator distills into actionable output
- **Memory** — learns from prior councils to improve over time

---

## Phased Roadmap

### Phase 1: Foundation (Weeks 1-3)
**Theme: Make the existing engine smarter and persistent**

#### 1.1 Debate Persistence Layer
Store every council result for replay, analysis, and learning.

```
New D1 table: mcp_sessions
- id (TEXT PK)
- user_id (TEXT FK)
- tool_name (TEXT) — which tool was used
- input_hash (TEXT) — dedup similar queries
- input (TEXT JSON) — full input params
- result (TEXT JSON) — full debate output
- duration_ms (INTEGER)
- total_credits (REAL)
- thinking_level (TEXT)
- format (TEXT)
- mode (TEXT)
- model_ids (TEXT JSON) — which models participated
- quality_score (REAL NULL) — from evaluation (Phase 2)
- created_at (TEXT)
```

New MCP tool: **`list_sessions`** — browse past council results
New MCP tool: **`get_session`** — retrieve a specific past result

#### 1.2 Parallel Execution Mode
Currently participants respond sequentially (each sees prior responses). Add a `parallel` option:

```typescript
// In debate engine
execution: z.enum(['sequential', 'parallel']).default('sequential')
```

- **Sequential** (current): Models build on each other. Better for debates.
- **Parallel**: All models respond simultaneously. Faster for independent analysis. ~3x speed improvement.

Add to `consult` tool schema. Specialized tools keep their defaults.

#### 1.3 Smarter Cost Estimation
Replace naive 500-token assumption with historical data:

```typescript
// After Phase 1.1 ships, use actual data
const avgTokens = await getAvgInputTokens(env, thinkingLevel, modelId);
```

Fall back to preset estimates when no history exists.

#### 1.4 Model Registry
Replace hardcoded model ID strings with a structured registry:

```
New KV namespace or D1 table: mcp_models
- id (TEXT) — OpenRouter model ID
- display_name (TEXT)
- provider (TEXT) — 'openrouter' | 'anthropic' | 'openai' | 'local'
- tier (TEXT) — budget/standard/pro/flagship/ultimate
- capabilities (TEXT JSON) — ['code', 'reasoning', 'creative', 'vision']
- max_context (INTEGER)
- cost_per_m_input (REAL)
- cost_per_m_output (REAL)
- enabled (BOOLEAN)
- last_verified (TEXT)
```

Benefits: version tracking, capability-based routing, multi-provider support foundation.

---

### Phase 2: Intelligence (Weeks 4-6)
**Theme: Add feedback loops and evaluation**

#### 2.1 Output Evaluation Framework
After each council, optionally run an evaluator:

```typescript
// New engine module: evaluator.ts
evaluateCouncilOutput(params: {
  prompt: string,
  participantResponses: ParticipantResponse[],
  moderatorSummary: string,
  format: OutputFormat,
}) => {
  scores: {
    relevance: number,      // 0-1: did it answer the question?
    actionability: number,  // 0-1: can you act on this?
    consensus: number,      // 0-1: how much agreement?
    diversity: number,      // 0-1: did perspectives differ meaningfully?
    depth: number,          // 0-1: thoroughness of analysis
  },
  overall: number,          // weighted composite
  evaluator_model: string,
}
```

Use a separate, cheap model (e.g., Gemini Flash) as evaluator — it's judging structure, not generating content.

Store score in `mcp_sessions.quality_score`. Use for:
- Surfacing best results
- A/B testing prompt variations
- Identifying which model combos perform best

#### 2.2 Prompt Template System
Extract hardcoded prompts into versioned templates:

```
New D1 table: mcp_prompt_templates
- id (TEXT PK)
- tool_name (TEXT)
- template_type (TEXT) — 'participant_system' | 'moderator_synthesis' | 'evaluator'
- version (INTEGER)
- template (TEXT) — Handlebars-style with {{variables}}
- is_active (BOOLEAN)
- created_at (TEXT)
```

Benefits:
- A/B test prompt variations without code deploys
- Track which prompts produce highest quality_score
- User-contributed prompt improvements

#### 2.3 Session Context (Follow-up Councils)
Allow referencing prior council results:

```typescript
// New field on consult tool
session_context: z.array(z.string()).optional()
  .describe('Session IDs from prior councils to include as context')
```

The engine injects prior results into the context field, enabling multi-step workflows:
1. `architect` a system → get session ID
2. `plan_implementation` with `session_context: [architect_session_id]`
3. `review_code` with `session_context: [plan_session_id]`

#### 2.4 Structured Logging
Add queryable logs beyond PostHog fire-and-forget:

```
New D1 table: mcp_logs
- id (TEXT PK)
- session_id (TEXT FK NULL)
- user_id (TEXT)
- level (TEXT) — 'info' | 'warn' | 'error'
- event (TEXT)
- data (TEXT JSON)
- created_at (TEXT)
```

New MCP tool: **`get_logs`** — query logs by session, user, level, time range.

---

### Phase 3: Orchestration (Weeks 7-10)
**Theme: Beyond debate — composable workflows**

#### 3.1 Workflow Engine
Allow chaining tools into multi-step workflows:

```typescript
// New MCP tool: run_workflow
WorkflowInputSchema = z.object({
  steps: z.array(z.object({
    tool: z.string(),           // 'architect', 'review_code', etc.
    input: z.record(z.unknown()), // tool-specific input
    depends_on: z.array(z.number()).optional(), // step indices
    condition: z.string().optional(), // e.g., "quality_score > 0.7"
  })),
  name: z.string().optional(),
})
```

Example workflow: "Full Feature Pipeline"
```json
{
  "steps": [
    { "tool": "architect", "input": { "description": "..." } },
    { "tool": "plan_implementation", "input": { "feature": "..." }, "depends_on": [0] },
    { "tool": "assess_tradeoffs", "input": { "decision": "..." }, "depends_on": [0] }
  ]
}
```

Steps with no dependencies run in parallel. `depends_on` steps wait and receive prior results as `session_context`.

#### 3.2 Conditional Routing
Route to different models based on query characteristics:

```typescript
// New engine module: router.ts
routeModels(params: {
  prompt: string,
  context?: string,
  thinkingLevel: ThinkingLevel,
  domain?: string, // auto-detected or user-specified
}) => ModelId[]
```

Domain detection:
- Code-heavy queries → models with strong coding benchmarks
- Architecture queries → models with strong reasoning
- Security queries → models known for safety analysis

Use the evaluation data from Phase 2 to learn which models perform best for which domains.

#### 3.3 Multi-Provider Support
Abstract OpenRouter into a provider interface:

```typescript
interface LLMProvider {
  id: string;
  call(params: {
    model: string,
    messages: Message[],
    maxTokens: number,
  }): Promise<ProviderResponse>;
  listModels(): Promise<ModelInfo[]>;
  estimateCost(model: string, tokens: number): number;
}
```

Implementations:
- `OpenRouterProvider` (current, default)
- `AnthropicProvider` (direct API, lower latency for Claude models)
- `OpenAIProvider` (direct API for GPT models)

Benefits: cost optimization (direct APIs are cheaper than OpenRouter markup), latency reduction, fallback chains.

#### 3.4 Context Augmentation (Light RAG)
Allow attaching knowledge sources to councils:

```typescript
// New field on consult tool
knowledge: z.array(z.object({
  type: z.enum(['url', 'text', 'file_content']),
  content: z.string(),
  label: z.string().optional(),
})).optional()
```

The engine chunks and includes relevant knowledge in participant context. Not full vector RAG — just structured context injection. Vector search can come later with Cloudflare Vectorize.

---

### Phase 4: Platform (Weeks 11-16)
**Theme: Ecosystem and extensibility**

#### 4.1 Custom Tool Definitions
Allow users to define their own council tools via the MCP server:

```
New D1 table: mcp_custom_tools
- id (TEXT PK)
- user_id (TEXT FK)
- name (TEXT UNIQUE per user)
- description (TEXT)
- roles (TEXT JSON)
- mode (TEXT)
- format (TEXT)
- thinking_level (TEXT)
- prompt_template (TEXT) — how to transform user input into debate prompt
- input_schema (TEXT JSON) — Zod-compatible schema definition
- is_public (BOOLEAN)
- created_at (TEXT)
```

New MCP tools:
- **`create_tool`** — define a custom council tool
- **`list_custom_tools`** — browse available custom tools
- **`run_custom_tool`** — execute a user-defined tool

Example: A security team creates a `security_review` tool with roles ["OWASP Specialist", "Penetration Tester", "Compliance Officer"], mode "analyzing", format "comparison".

#### 4.2 Team/Org Workspaces
Share tools, sessions, and credits across a team:

```
New D1 tables:
- mcp_workspaces (id, name, owner_id, settings JSON)
- mcp_workspace_members (workspace_id, user_id, role)
```

Benefits: shared custom tools, pooled credits, team analytics.

#### 4.3 Webhooks & Integrations
Notify external systems when councils complete:

```typescript
// New field on consult tool
webhook_url: z.string().url().optional()
  .describe('URL to POST results to when council completes')
```

Enables: Slack notifications, CI/CD integration, automated pipelines.

#### 4.4 Public API (REST)
Expose council functionality via REST API (not just MCP):

```
POST /api/v1/consult
POST /api/v1/architect
POST /api/v1/review-code
...
```

Same auth, same credit system, same engine. Just a different transport. Broadens access beyond MCP-compatible clients.

---

## New MCP Tools Summary

### Phase 1
| Tool | Purpose |
|---|---|
| `list_sessions` | Browse past council results |
| `get_session` | Retrieve a specific past result |

### Phase 2
| Tool | Purpose |
|---|---|
| `get_logs` | Query structured logs |

### Phase 3
| Tool | Purpose |
|---|---|
| `run_workflow` | Execute multi-step tool pipelines |

### Phase 4
| Tool | Purpose |
|---|---|
| `create_tool` | Define custom council tools |
| `list_custom_tools` | Browse custom tools |
| `run_custom_tool` | Execute user-defined tools |

---

## Architecture Evolution

```
TODAY:
  MCP Client → MCP Server → Debate Engine → OpenRouter → Models
                                ↓
                          Credits/Abuse/Limits

PHASE 1-2:
  MCP Client → MCP Server → Debate Engine → OpenRouter → Models
                    ↓              ↓
              Session Store    Evaluator
                    ↓              ↓
              Model Registry  Prompt Templates

PHASE 3-4:
  MCP Client → MCP Server → Workflow Engine → Debate Engine → Provider Layer → Models
       ↓            ↓             ↓                ↓                ↓
   Webhooks   Custom Tools   Conditional      Evaluator      OpenRouter
                              Router              ↓          Anthropic
                                ↓            Session Store    OpenAI
                          Domain Detection        ↓           Local
                                            Knowledge/RAG
```

---

## Key Design Principles

1. **Council-first**: Every tool is a structured multi-model conversation. This is the moat — not just model routing, but expert perspective orchestration.

2. **Persist everything**: Every council, every evaluation, every log. Data compounds. Without persistence, there's no learning.

3. **Composability**: Tools should chain. A workflow is just tools connected by their outputs. Keep tools small and focused.

4. **Provider-agnostic**: Don't be locked to OpenRouter. Abstract the provider layer. Support direct APIs for cost/latency optimization.

5. **Evaluation-driven**: Every output gets scored. Use scores to improve prompts, model selection, and routing. Close the feedback loop.

6. **Developer-first**: Every feature should make a developer's life easier. No enterprise bloat. Simple APIs, clear docs, fast iteration.

---

## Competitive Landscape

| Platform | What They Do | DebateKit's Edge |
|---|---|---|
| **OpenRouter** | Model routing/gateway | DebateKit adds orchestration + synthesis on top |
| **LangChain/CrewAI** | Agent frameworks | DebateKit is simpler — no agents to build, just ask a question |
| **Karpathy's LLM Council** | Multi-model voting | DebateKit adds credits, auth, persistence, evaluation |
| **HELM/Inspect AI** | Model evaluation | DebateKit evaluates real-world usage, not benchmarks |
| **ChatGPT/Claude** | Single-model chat | DebateKit gives multiple perspectives, not one |

**The pitch**: "Don't ask one AI. Convene a council."

---

## Success Metrics

| Metric | Phase 1 Target | Phase 4 Target |
|---|---|---|
| Tools available | 9 (7 + 2 session tools) | 13+ (+ custom tools) |
| Avg council quality score | Baseline | +20% from prompt optimization |
| Session replay rate | >0% (any persistence) | >15% of sessions referenced |
| Multi-step workflows | N/A | >10% of usage |
| Custom tools created | N/A | >50 public tools |
| Provider diversity | 1 (OpenRouter) | 3+ |

---

## Immediate Next Steps (This Week)

1. **Design `mcp_sessions` schema** — D1 migration for persistence
2. **Add parallel execution option** — to debate engine
3. **Create `list_sessions` + `get_session` tools** — basic persistence UI
4. **Update `withCredits` wrapper** — to store session after execution
5. **Model registry KV structure** — replace hardcoded presets

These five items unblock everything in Phase 2+.
