# DebateKit MCP Server

Multi-model AI debates inside your editor. Multiple LLMs discuss your question sequentially, then a moderator synthesizes their perspectives into actionable insight.

**Endpoint:** `https://mcp.debatekit.com/mcp`
**Transport:** Streamable HTTP

## Get an API Key

1. Sign up at [debatekit.com](https://debatekit.com)
2. Go to **Settings** > **API Keys**
3. Click **Create API Key**
4. Copy the key (you won't see it again)

## Connect from Your Editor

### Claude Code

```bash
claude mcp add debatekit \
  --transport streamable-http \
  https://mcp.debatekit.com/mcp \
  --header "x-api-key: YOUR_API_KEY"
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "debatekit": {
      "url": "https://mcp.debatekit.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` in your project (or user settings under `mcp.servers`):

```json
{
  "servers": {
    "debatekit": {
      "url": "https://mcp.debatekit.com/mcp",
      "type": "http",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "debatekit": {
      "url": "https://mcp.debatekit.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

### Windsurf

Open **Settings** > **MCP** > **Add Server**, then add:

```json
{
  "mcpServers": {
    "debatekit": {
      "serverUrl": "https://mcp.debatekit.com/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

### Gemini CLI

Add to your Gemini extensions config (`~/.gemini/settings.json`):

```json
{
  "mcpServers": {
    "debatekit": {
      "url": "https://mcp.debatekit.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

### ChatGPT

1. Open [ChatGPT](https://chatgpt.com) (Plus/Team/Enterprise required)
2. Go to **Settings** > **Connectors** (developer mode)
3. Click **Add Connector**
4. Enter the MCP endpoint: `https://mcp.debatekit.com/mcp`
5. Set the `x-api-key` header with your API key

### Replit

1. Open your Repl's **Tools** panel
2. Select **MCP Connectors** > **Add Custom**
3. Set the URL to `https://mcp.debatekit.com/mcp`
4. Add the `x-api-key: YOUR_API_KEY` header

## Available Tools

### Debate Tools

| Tool | Description |
|------|-------------|
| `consult` | General-purpose AI council. Multiple models discuss your question, then a moderator synthesizes. Auto-mode picks optimal models and roles from your prompt. |
| `architect` | Architecture design council. Systems Architect, Infrastructure Engineer, and DX Advocate evaluate system design. Always uses high thinking. |
| `review_code` | Code review council. Senior Engineer, Security Reviewer, and Performance Analyst analyze your code. |
| `debug` | Debugging council. Root Cause Analyst, Systems Engineer, and Edge Case Investigator diagnose bugs and propose fixes. |
| `plan_implementation` | Implementation planning council. Tech Lead, Senior Engineer, and QA Strategist break down features into actionable steps. |
| `assess_tradeoffs` | Tradeoff assessment council. Pragmatist, Skeptic, and Futurist evaluate options from different angles. |

### Utility Tools

| Tool | Description |
|------|-------------|
| `list_models` | List available AI models and their capabilities per thinking level. |
| `list_sessions` | List your previous debate sessions with metadata. |
| `get_session` | Get full details of a previous session by ID. |
| `get_logs` | Query structured logs from your tool executions. |
| `get_thread_link` | Get the dashboard URL for a debate session. |
| `set_thread_visibility` | Set a thread as public or private for sharing. |
| `check_usage` | Check remaining credits, usage limits, and plan info. |

## Example Usage

In Claude Code or any MCP-compatible agent:

```
Use the consult tool to brainstorm approaches for building a real-time notification system
```

```
Use architect to evaluate whether we should use microservices or a modular monolith for our payments platform
```

```
Use review_code to review this function for security issues: <paste code>
```

```
Use debug to help diagnose why our WebSocket connections drop after 30 seconds
```

## Tips

- **Omit models** for auto-mode (recommended) -- the AI picks optimal models and roles based on your prompt.
- **Use `session_context`** to chain debates -- reference prior session IDs for continuity.
- **Use `thinking_level: "high"`** for complex problems, `"low"` for quick opinions.
- **Use `check_usage`** to see remaining credits and rate limits.

## Documentation

Full docs: [debatekit.com/docs](https://debatekit.com/docs)
