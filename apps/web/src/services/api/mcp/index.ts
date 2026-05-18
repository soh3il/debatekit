/**
 * MCP Services - Domain Barrel Export
 *
 * Single source of truth for all MCP-related API services
 * Matches backend route structure: /api/v1/mcp/*
 */

export {
  type GetMcpCreditsResponse,
  getMcpCreditsService,
  type GetMcpHistoryResponse,
  getMcpHistoryService,
  type GetMcpUsageResponse,
  getMcpUsageService,
  type McpCreditsData,
} from './mcp';
