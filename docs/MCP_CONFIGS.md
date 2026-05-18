# DebateKit MCP Server - Editor Configuration

Connect your AI coding assistant to DebateKit's MCP server for collaborative AI brainstorming directly in your editor.

**Server URL:** `https://mcp.debatekit.ai/mcp`
**Transport:** Streamable HTTP
**Get your API key:** [debatekit.ai/chat/settings/api-keys](https://debatekit.ai/chat/settings/api-keys)

---

## VS Code (GitHub Copilot)

Create `.vscode/mcp.json` in your project root:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "debatekit-api-key",
      "description": "DebateKit API Key (from https://debatekit.ai/chat/settings/api-keys)",
      "password": true
    }
  ],
  "servers": {
    "debatekit": {
      "type": "http",
      "url": "https://mcp.debatekit.ai/mcp",
      "headers": {
        "Authorization": "Bearer ${input:debatekit-api-key}"
      }
    }
  }
}
```

VS Code will prompt you for the API key on first use. To use an environment variable instead, replace the headers with:

```json
"headers": {
  "Authorization": "Bearer ${env:DEBATEKIT_API_KEY}"
}
```

After adding, open Copilot Chat in **Agent mode** to access DebateKit tools.

---

## Cursor

Create `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` for global access):

```json
{
  "mcpServers": {
    "debatekit": {
      "url": "https://mcp.debatekit.ai/mcp",
      "type": "streamableHttp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Replace `YOUR_API_KEY` with your key from [debatekit.ai/chat/settings/api-keys](https://debatekit.ai/chat/settings/api-keys). After saving, restart Cursor or reload the MCP servers from Settings > MCP.

---

## Windsurf

Edit `~/.codeium/windsurf/mcp_config.json` (or open it via the MCP icon in the Cascade panel > Configure):

```json
{
  "mcpServers": {
    "debatekit": {
      "serverUrl": "https://mcp.debatekit.ai/mcp",
      "headers": {
        "Authorization": "Bearer ${env:DEBATEKIT_API_KEY}"
      }
    }
  }
}
```

Set your API key as an environment variable:

```bash
export DEBATEKIT_API_KEY="your-api-key-here"
```

Or hardcode the key directly in the `Authorization` header value.

---

## Claude Code

### Option A: CLI command

```bash
claude mcp add --transport http --scope user debatekit https://mcp.debatekit.ai/mcp --header "Authorization: Bearer YOUR_API_KEY"
```

### Option B: Project config

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "debatekit": {
      "type": "http",
      "url": "https://mcp.debatekit.ai/mcp",
      "headers": {
        "Authorization": "Bearer ${DEBATEKIT_API_KEY}"
      }
    }
  }
}
```

Set the environment variable:

```bash
export DEBATEKIT_API_KEY="your-api-key-here"
```

### Option C: JSON via CLI

```bash
claude mcp add-json debatekit '{"type":"http","url":"https://mcp.debatekit.ai/mcp","headers":{"Authorization":"Bearer YOUR_API_KEY"}}' --scope user
```

Use `--scope user` for global access or `--scope project` to share via `.mcp.json`.

---

## Claude Desktop

Claude Desktop does not natively connect to remote HTTP servers via `claude_desktop_config.json`. Use the `mcp-remote` proxy instead.

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "debatekit": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.debatekit.ai/mcp",
        "--header",
        "Authorization: Bearer YOUR_API_KEY"
      ]
    }
  }
}
```

Replace `YOUR_API_KEY` with your key from [debatekit.ai/chat/settings/api-keys](https://debatekit.ai/chat/settings/api-keys). Restart Claude Desktop after saving.

> **Note:** Requires Node.js installed. The `mcp-remote` package bridges Streamable HTTP servers to Claude Desktop's stdio transport.

---

## Using `x-api-key` Header

All configs above use `Authorization: Bearer <key>`. If you prefer the `x-api-key` header, replace the headers block:

```json
"headers": {
  "x-api-key": "YOUR_API_KEY"
}
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Tools not appearing | Restart the editor or reload MCP servers |
| Authentication errors | Verify your API key at [debatekit.ai/chat/settings/api-keys](https://debatekit.ai/chat/settings/api-keys) |
| Connection timeout | Check that `https://mcp.debatekit.ai/mcp` is reachable |
| Claude Desktop not connecting | Ensure Node.js is installed for `npx mcp-remote` |
