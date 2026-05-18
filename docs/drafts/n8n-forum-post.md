# n8n Community Forum Post

**Category:** Share
**Title:** New Community Node: DebateKit — Multi-AI Brainstorming & Code Review

---

Hey everyone!

I just published **n8n-nodes-debatekit-ai**, a community node that brings [DebateKit](https://debatekit.ai) into your n8n workflows.

## What is DebateKit?

DebateKit is a multi-model AI brainstorming platform. Instead of asking one model, you consult a *panel* of AI models (GPT-4o, Claude, Gemini, DeepSeek, Llama, Mistral, and 200+ more). Each model sees the prior responses, creating a structured debate. A moderator then synthesizes the best answer.

Think of it as a virtual debatekit discussion between AI experts -- you get diverse perspectives instead of a single opinion.

## Install

```
npm install n8n-nodes-debatekit-ai
```

Or in the n8n UI: **Settings > Community Nodes > Install** and enter `n8n-nodes-debatekit-ai`.

## Available Operations

### DebateKit (Core)
- **Consult** -- Run a multi-model brainstorming session on any topic. Choose mode (analyzing, brainstorming, debating, solving), thinking level, and output format.
- **Architect** -- Get system architecture recommendations from a panel of AI models (System Architect, Security Engineer, DevOps Engineer).
- **Review Code** -- Multi-perspective code review covering quality, security, and performance.
- **Debug** -- Collaborative debugging analysis from multiple AI models (Debugger, Root Cause Analyst, Fix Strategist).
- **Plan Implementation** -- Step-by-step implementation plans with multi-model input. Specify your feature, codebase context, and constraints.
- **Assess Tradeoffs** -- Evaluate options and trade-offs with structured multi-model analysis. Great for architecture decisions, tech stack choices, etc.

### Sessions
- **Get Many** -- List past consultation sessions with filtering by tool name.
- **Get** -- Retrieve full details for a single session.

### Usage
- **Check Balance** -- Verify your credit balance and usage.

## Thinking Levels

Each operation supports a `thinking_level` parameter:

| Level | Description |
|-------|-------------|
| Low | Fast and cheap. Good for simple queries. |
| Medium | Balanced quality and cost. Default. |
| High | Maximum reasoning. Best for complex problems. |

## Setup

1. Sign up at [debatekit.ai](https://debatekit.ai)
2. Go to **Settings > API Keys** and generate a key
3. In n8n, create a **DebateKit API** credential and paste your key
4. Drag in the DebateKit node and start building

## Use Case Ideas

- **PR review pipeline**: Trigger on GitHub webhook, send code diff to Review Code, post results back as a comment.
- **Architecture decision records**: Feed a design proposal through Architect and Assess Tradeoffs, save the output to Notion.
- **Bug triage**: Pipe error logs from Sentry into Debug, auto-create Jira tickets with root cause analysis.
- **Brainstorming automation**: Schedule weekly brainstorming sessions on product ideas, send synthesized results to Slack.

## Links

- **npm**: [npmjs.com/package/n8n-nodes-debatekit-ai](https://www.npmjs.com/package/n8n-nodes-debatekit-ai)
- **Website**: [debatekit.ai](https://debatekit.ai)
- **MCP Server**: [mcp.debatekit.ai](https://mcp.debatekit.ai)

<!-- TODO: Add screenshots showing:
  1. The DebateKit node in the n8n canvas
  2. Node configuration panel with operation selection
  3. Example workflow output showing a multi-model debate result
-->

Would love to hear your feedback! Happy to answer any questions.
