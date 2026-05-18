# crewai-debatekit

CrewAI tools for [DebateKit](https://debatekit.com) — a multi-model AI brainstorming platform.

Give your CrewAI agents access to DebateKit's AI council: multiple models debate, review, and collaborate on your prompts.

## Installation

```bash
pip install crewai-debatekit
```

## Authentication

Get an API key from [debatekit.com](https://debatekit.com) (prefixed with `rpnd_`).

```bash
export DEBATEKIT_API_KEY="rpnd_your_key_here"
```

## Tools

| Tool | Description |
|------|-------------|
| `DebateKitConsultTool` | General consultation — brainstorm, research, get diverse perspectives |
| `DebateKitCodeReviewTool` | Multi-model code review with focus areas |
| `DebateKitDebugTool` | Collaborative debugging with root-cause analysis |
| `DebateKitArchitectTool` | System architecture design at any scale |
| `DebateKitAssessTradeoffsTool` | Evaluate options and trade-offs with structured multi-model analysis |
| `DebateKitGetThreadLinkTool` | Get the dashboard URL for a previous debate session |
| `DebateKitPlanImplementationTool` | Create step-by-step implementation plans with multi-model input |

## Usage

### Add tools to an agent

```python
from crewai import Agent
from crewai_debatekit import (
    DebateKitConsultTool,
    DebateKitCodeReviewTool,
    DebateKitDebugTool,
    DebateKitArchitectTool,
    DebateKitAssessTradeoffsTool,
    DebateKitGetThreadLinkTool,
    DebateKitPlanImplementationTool,
)

researcher = Agent(
    role="Senior Researcher",
    goal="Produce well-rounded analysis by consulting multiple AI perspectives",
    backstory="You leverage DebateKit's AI council for deeper insights.",
    tools=[DebateKitConsultTool()],
)

developer = Agent(
    role="Senior Developer",
    goal="Write high-quality, reviewed code",
    backstory="You use multi-model code review to catch issues early.",
    tools=[
        DebateKitCodeReviewTool(),
        DebateKitDebugTool(),
    ],
)

architect = Agent(
    role="Solutions Architect",
    goal="Design scalable, robust system architectures",
    backstory="You consult an AI council for architecture decisions.",
    tools=[DebateKitArchitectTool()],
)
```

### Use in a crew

```python
from crewai import Crew, Task

task = Task(
    description="Review this Python function for security issues:\n\n```python\ndef login(user, pw):\n    query = f\"SELECT * FROM users WHERE name='{user}' AND pass='{pw}'\"\n    return db.execute(query)\n```",
    expected_output="A detailed code review with security findings and fixes.",
    agent=developer,
)

crew = Crew(agents=[developer], tasks=[task])
result = crew.kickoff()
print(result)
```

### Tool parameters

#### DebateKitConsultTool

- `prompt` (required) — the question or topic
- `context` — additional background information
- `models` — comma-separated model IDs (e.g. `"gpt-4o,claude-sonnet"`)
- `roles` — comma-separated roles (e.g. `"backend-engineer,security-auditor"`)
- `mode` — `"debate"`, `"collaborate"`, or `"review"`
- `thinking_level` — `"low"`, `"medium"`, or `"high"`

#### DebateKitCodeReviewTool

- `code` (required) — source code to review
- `focus` — e.g. `"security"`, `"performance"`, `"readability"`
- `language` — e.g. `"python"`, `"typescript"`

#### DebateKitDebugTool

- `problem` (required) — description of the bug
- `error` — error message or stack trace
- `code` — relevant source code
- `expected_behavior` — what should happen instead

#### DebateKitArchitectTool

- `description` (required) — what you're building
- `scale` — target scale: `"startup"`, `"growth"`, or `"enterprise"` (defaults to `"startup"`)
- `tech_stack` — comma-separated technologies
- `focus_areas` — comma-separated areas (e.g. `"scalability,cost,security"`)

#### DebateKitPlanImplementationTool

- `feature` (required) — the feature or change to plan
- `codebase_context` — relevant existing code, file structure, or architecture notes
- `constraints` — comma-separated constraints (e.g. `"no breaking changes,must support offline"`)
- `tech_stack` — comma-separated current tech stack
- `thinking_level` — `"low"`, `"medium"`, or `"high"`

#### DebateKitAssessTradeoffsTool

- `decision` (required) — the decision or question to evaluate
- `options` — comma-separated options to compare (e.g. `"REST,GraphQL,gRPC"`)
- `priorities` — comma-separated priorities (e.g. `"performance,dx,cost"`)
- `context` — background context (codebase, team, timeline, constraints)
- `thinking_level` — `"low"`, `"medium"`, or `"high"`

#### DebateKitGetThreadLinkTool

- `session_id` (required) — the session ID to get the thread link for

## Custom API key or base URL

```python
from crewai_debatekit import DebateKitClient, DebateKitConsultTool

# The client reads DEBATEKIT_API_KEY by default.
# To override:
client = DebateKitClient(
    api_key="rpnd_custom_key",
    base_url="https://custom.endpoint/api/v1",
)
```

## License

MIT
