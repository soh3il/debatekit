/**
 * Shared MCP progress notification helper.
 * Fire-and-forget logging to MCP clients during long-running operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function createProgressNotifier(server: McpServer) {
  return (message: string) => {
    // Fire-and-forget: MCP logging is best-effort, don't block debate execution
    server.sendLoggingMessage({ data: message, level: 'info' }).catch(() => {});
  };
}
