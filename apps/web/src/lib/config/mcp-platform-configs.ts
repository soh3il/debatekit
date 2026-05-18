/**
 * MCP Platform Configuration
 *
 * Platform definitions and config generators for MCP integration setup.
 * Each platform has its own config format for connecting to the DebateKit MCP server.
 */

// ============================================================================
// TYPES
// ============================================================================

type McpPlatform = {
  configFileName: string;
  configFilePath: string;
  description: string;
  iconId?: 'claude' | 'cursor' | 'vscode' | 'windsurf';
  id: string;
  isCliCommand?: boolean;
  isConnector?: boolean;
  name: string;
};

// ============================================================================
// PLATFORM DEFINITIONS
// ============================================================================

const MCP_PLATFORMS: McpPlatform[] = [
  {
    configFileName: 'Terminal',
    configFilePath: 'Run in your terminal',
    description: 'Anthropic\'s AI coding CLI',
    iconId: 'claude',
    id: 'claude-code',
    isCliCommand: true,
    name: 'Claude Code',
  },
  {
    configFileName: 'Connectors',
    configFilePath: 'Settings > Connectors > Add custom connector',
    description: 'Anthropic\'s desktop app',
    iconId: 'claude',
    id: 'claude-desktop',
    isConnector: true,
    name: 'Claude Desktop',
  },
  {
    configFileName: 'mcp.json',
    configFilePath: '.cursor/mcp.json',
    description: 'AI-first code editor',
    iconId: 'cursor',
    id: 'cursor',
    name: 'Cursor',
  },
  {
    configFileName: 'mcp_config.json',
    configFilePath: '~/.codeium/windsurf/mcp_config.json',
    description: 'Codeium\'s AI IDE',
    iconId: 'windsurf',
    id: 'windsurf',
    name: 'Windsurf',
  },
  {
    configFileName: 'mcp.json',
    configFilePath: '.vscode/mcp.json',
    description: 'GitHub Copilot MCP',
    iconId: 'vscode',
    id: 'vscode',
    name: 'VS Code',
  },
  {
    configFileName: 'cline_mcp_settings.json',
    configFilePath: 'Cline extension > MCP Servers > Configure',
    description: 'AI coding assistant (VS Code)',
    id: 'cline',
    name: 'Cline',
  },
  {
    configFileName: 'config.yaml',
    configFilePath: '~/.continue/config.yaml',
    description: 'Open-source AI assistant',
    id: 'continue',
    name: 'Continue',
  },
  {
    configFileName: 'settings.json',
    configFilePath: '~/.config/zed/settings.json',
    description: 'High-performance editor (via mcp-remote)',
    id: 'zed',
    name: 'Zed',
  },
];

// ============================================================================
// CONFIG GENERATORS
// ============================================================================

function generateConfig(platformId: string, mcpUrl: string, apiKey: string): string {
  switch (platformId) {
    case 'claude-code': {
      // Use add-json for reliability — avoids arg parsing issues with --header
      const config = JSON.stringify({
        headers: { Authorization: `Bearer ${apiKey}` },
        type: 'http',
        url: mcpUrl,
      });
      return `claude mcp add-json debatekit '${config}'`;
    }

    case 'claude-desktop': {
      // Claude Desktop uses Connectors for remote servers (Settings > Connectors).
      // Auth is handled via OAuth — no API key needed in config.
      return mcpUrl;
    }

    case 'cline': {
      return JSON.stringify({
        mcpServers: {
          debatekit: {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            url: mcpUrl,
          },
        },
      }, null, 2);
    }

    case 'cursor': {
      return JSON.stringify({
        mcpServers: {
          debatekit: {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            type: 'http',
            url: mcpUrl,
          },
        },
      }, null, 2);
    }

    case 'continue': {
      return [
        'mcpServers:',
        '  - name: debatekit',
        '    type: streamable-http',
        `    url: "${mcpUrl}"`,
        '    requestOptions:',
        '      headers:',
        `        Authorization: "Bearer ${apiKey}"`,
      ].join('\n');
    }

    case 'vscode': {
      return JSON.stringify({
        servers: {
          debatekit: {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            type: 'http',
            url: mcpUrl,
          },
        },
      }, null, 2);
    }

    case 'windsurf': {
      return JSON.stringify({
        mcpServers: {
          debatekit: {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            serverUrl: mcpUrl,
          },
        },
      }, null, 2);
    }

    case 'zed': {
      return JSON.stringify({
        context_servers: {
          debatekit: {
            args: [
              '-y',
              'mcp-remote@latest',
              mcpUrl,
              '--header',
              `Authorization: Bearer ${apiKey}`,
            ],
            command: 'npx',
          },
        },
      }, null, 2);
    }

    default: {
      return JSON.stringify({
        mcpServers: {
          debatekit: {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            url: mcpUrl,
          },
        },
      }, null, 2);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { McpPlatform };
export { generateConfig, MCP_PLATFORMS };
