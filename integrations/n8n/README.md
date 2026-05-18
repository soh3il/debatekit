# n8n-nodes-debatekit

n8n community node for [DebateKit](https://debatekit.com) — multi-model AI brainstorming.

Run consultations with multiple AI models that debate, analyze, and synthesize answers, all from your n8n workflows.

## Installation

In your n8n instance:

1. Go to **Settings > Community Nodes**
2. Select **Install a community node**
3. Enter `n8n-nodes-debatekit`
4. Agree to the risks and click **Install**

## Credentials

You need a DebateKit API key:

1. Sign in at [debatekit.com](https://debatekit.com)
2. Go to **Settings > API Keys**
3. Generate a new key
4. In n8n, create a **DebateKit API** credential and paste the key

## Resources & Operations

### DebateKit

- **Consult** — Run a multi-model brainstorming session on any topic. Choose mode (analyzing, brainstorming, debating, solving), thinking level, and output format.
- **Architect** — Get system architecture recommendations from a panel of AI models (System Architect, Security Engineer, DevOps Engineer).
- **Review Code** — Multi-perspective code review covering quality, security, and performance.
- **Debug** — Collaborative debugging analysis from multiple AI models (Debugger, Root Cause Analyst, Fix Strategist).

### Session

- **Get Many** — List past consultation sessions with filtering by tool name.
- **Get** — Retrieve full details for a single session.

### Usage

- **Check Balance** — Verify your credit balance and usage.

## Thinking Levels

| Level | Description |
|-------|-------------|
| Low | Fast and cheap. Good for simple queries. |
| Medium | Balanced quality and cost. Default. |
| High | Maximum reasoning. Best for complex problems. |

## Development

```bash
npm install
npm run build
npm run dev     # Link to local n8n for testing
npm run lint
```

## License

MIT
