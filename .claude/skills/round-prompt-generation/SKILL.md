# Round Prompt Generation Skill

Help developers write effective system prompts and topic guidance for the DebateKit content pipeline.

## How the Prompt Injection Chain Works

The admin configures two text fields in **Admin > Automation Settings**:

1. **System Prompt** (`systemPrompt`) — Persona/voice for all AI calls in the pipeline
2. **Topic Guidance** (`topicGuidance`) — Steers keyword generation toward specific domains

### Injection Points

```
systemPrompt ──┬── trend-discovery.service.ts   (prepended to trend extraction prompt)
               ├── prompt-generation.service.ts  (prepended to follow-up prompt generation)
               └── (future) any new AI call in the pipeline

topicGuidance ──── auto-discover.service.ts      (appended to keyword generation prompt)
```

### Flow

```
Admin Settings DB
       │
       ▼
getPipelineConfig(db)  ← content-pipeline.service.ts fetches once per run
       │
       ├─► autoDiscoverTrends(env, maxTopics, { systemPrompt, topicGuidance })
       │       │
       │       ├─► generateTrendingKeywords(env, topicGuidance)
       │       │     └─ topicGuidance appended to KEYWORD_SYSTEM_PROMPT
       │       │
       │       └─► discoverTrends(keyword, platforms, max, env, systemPrompt)
       │             └─ systemPrompt prepended to extraction system prompt
       │
       └─► (custom topics skip discovery, use config.defaultRoundCount)

continueAutomatedJob()
       │
       ├─► getAdminSetting(db, 'systemPrompt')
       └─► generateNextRoundPrompt(..., systemPrompt)
             └─ systemPrompt prepended to PROMPT_GENERATION_SYSTEM
```

## Writing Effective System Prompts

### Good Patterns

```
You are a tech industry analyst specializing in AI/ML infrastructure.
Prioritize topics with measurable business impact.
Favor contrarian, evidence-based takes over surface-level consensus.
When generating debate prompts, frame them as decisions (build vs buy, open vs closed).
```

```
You are a healthcare policy researcher.
Focus on clinical AI, drug discovery, and regulatory compliance.
Debates should surface real trade-offs between innovation speed and patient safety.
Avoid hypothetical scenarios — ground discussions in recent events.
```

### Anti-Patterns

- Too vague: "Be smart and interesting" (no domain focus)
- Too restrictive: "Only discuss X and nothing else" (pipeline finds nothing)
- Contradictory: "Be brief" + "Provide deep analysis" in same prompt
- Prompt injection: Never include "ignore previous instructions" patterns

## Writing Effective Topic Guidance

### Good Patterns

```
Focus on: AI regulation (EU AI Act, US executive orders), open-source LLM releases,
startup funding rounds > $50M, developer tool launches.
Avoid: cryptocurrency, Web3, NFTs, celebrity tech drama.
Prefer topics where reasonable people disagree.
```

### Anti-Patterns

- Just listing keywords without context ("AI, ML, crypto, startups")
- Negative-only guidance ("Don't do X, Y, Z") without saying what to do
- Guidance that conflicts with systemPrompt persona

## Generating Initial Debate Prompts for Verticals

When an admin wants to seed custom topics for a specific vertical:

### Tech/AI Vertical
```
Should companies build or buy their AI infrastructure in 2026?
Is open-source AI a viable enterprise strategy or a hidden cost center?
Will AI code assistants make junior developers more productive or less skilled?
```

### Healthcare Vertical
```
Should FDA fast-track AI diagnostic tools at the expense of traditional clinical trials?
Is AI-powered drug discovery living up to its promises, or is it just cheaper screening?
```

### Finance Vertical
```
Are AI trading algorithms making markets more efficient or more fragile?
Should robo-advisors be held to the same fiduciary standards as human advisors?
```

## Key Files

| File | Role |
|------|------|
| `apps/api/src/services/admin-settings.service.ts` | `getPipelineConfig()` reads all settings |
| `apps/api/src/services/pipeline/content-pipeline.service.ts` | Orchestrator — fetches config, threads values |
| `apps/api/src/services/pipeline/auto-discover.service.ts` | Keyword gen (topicGuidance) + trend discovery (systemPrompt) |
| `apps/api/src/services/jobs/trend-discovery.service.ts` | `discoverTrends()` — systemPrompt prepended |
| `apps/api/src/services/jobs/prompt-generation.service.ts` | `generateNextRoundPrompt()` — systemPrompt prepended |
| `apps/api/src/services/jobs/job-orchestration.service.ts` | `continueAutomatedJob()` — fetches systemPrompt |
| `apps/api/src/routes/admin/settings/schema.ts` | Setting keys, defaults, validation schemas |
