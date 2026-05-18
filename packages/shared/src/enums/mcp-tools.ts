/**
 * MCP (Model Context Protocol) Tool Method Enums
 *
 * Enums for MCP tool names and configuration.
 * Following the 5-part enum pattern for type safety and consistency.
 *
 * NOTE: MCP_TOOL_METHODS includes both legacy internal API tools (used by
 * apps/api/src/routes/mcp/handler.ts) and new standalone MCP server tools
 * (used by apps/mcp/). Both sets coexist for backward compatibility.
 */

import { z } from '@hono/zod-openapi';

// ============================================================================
// MCP TOOL METHODS
// Includes both legacy internal API tools and new standalone MCP server tools.
// ============================================================================

export const MCP_TOOL_METHODS = [
  // Legacy internal API tools (apps/api handler.ts)
  'create_thread',
  'get_thread',
  'list_threads',
  'delete_thread',
  'create_project',
  'get_project',
  'list_projects',
  'update_project',
  'delete_project',
  'list_project_threads',
  'list_knowledge_files',
  'delete_knowledge_file',
  'send_message',
  'generate_responses',
  'list_rounds',
  'regenerate_round',
  'round_feedback',
  'generate_analysis',
  'get_round_analysis',
  'add_participant',
  'update_participant',
  'remove_participant',
  // Shared between legacy and standalone
  'list_models',
  // New standalone MCP server tools (apps/mcp)
  'assess_tradeoffs',
  'architect',
  'consult',
  'debug',
  'get_logs',
  'get_session',
  'list_sessions',
  'plan_implementation',
  'review_code',
] as const;

export const MCPToolMethodSchema = z.enum(MCP_TOOL_METHODS).openapi({
  description: 'MCP tool method name',
  example: 'consult',
});

export type MCPToolMethod = z.infer<typeof MCPToolMethodSchema>;

// ============================================================================
// MCP OVERALL STATUS (5-part pattern)
// Derived status combining MCP usage + credit status for dashboard display.
// Superset of McpLimitStatus — adds 'critical' from credit status.
// ============================================================================

export const MCP_OVERALL_STATUSES = ['ok', 'warning', 'critical', 'exceeded', 'cooldown'] as const;
export const DEFAULT_MCP_OVERALL_STATUS: McpOverallStatus = 'ok';
export const McpOverallStatusSchema = z.enum(MCP_OVERALL_STATUSES);
export type McpOverallStatus = z.infer<typeof McpOverallStatusSchema>;
export const McpOverallStatuses = { COOLDOWN: 'cooldown', CRITICAL: 'critical', EXCEEDED: 'exceeded', OK: 'ok', WARNING: 'warning' } as const;

// ============================================================================
// MCP THINKING LEVEL (5-part pattern)
// ============================================================================

export const MCP_THINKING_LEVELS = ['low', 'medium', 'high'] as const;
export const DEFAULT_MCP_THINKING_LEVEL: McpThinkingLevel = 'medium';
export const McpThinkingLevelSchema = z.enum(MCP_THINKING_LEVELS);
export type McpThinkingLevel = z.infer<typeof McpThinkingLevelSchema>;
export const McpThinkingLevels = { HIGH: 'high', LOW: 'low', MEDIUM: 'medium' } as const;

// ============================================================================
// MCP OUTPUT FORMAT (5-part pattern)
// ============================================================================

export const MCP_OUTPUT_FORMATS = ['discussion', 'adr', 'comparison', 'pros-cons'] as const;
export const DEFAULT_MCP_OUTPUT_FORMAT: McpOutputFormat = 'discussion';
export const McpOutputFormatSchema = z.enum(MCP_OUTPUT_FORMATS);
export type McpOutputFormat = z.infer<typeof McpOutputFormatSchema>;
export const McpOutputFormats = { ADR: 'adr', COMPARISON: 'comparison', DISCUSSION: 'discussion', PROS_CONS: 'pros-cons' } as const;

// ============================================================================
// MCP PROMPT TEMPLATE TYPE (5-part pattern)
// ============================================================================

export const MCP_PROMPT_TEMPLATE_TYPES = ['participant_system', 'moderator_synthesis', 'evaluator'] as const;
export const DEFAULT_MCP_PROMPT_TEMPLATE_TYPE: McpPromptTemplateType = 'participant_system';
export const McpPromptTemplateTypeSchema = z.enum(MCP_PROMPT_TEMPLATE_TYPES);
export type McpPromptTemplateType = z.infer<typeof McpPromptTemplateTypeSchema>;
export const McpPromptTemplateTypes = { EVALUATOR: 'evaluator', MODERATOR_SYNTHESIS: 'moderator_synthesis', PARTICIPANT_SYSTEM: 'participant_system' } as const;

// ============================================================================
// MCP LOG LEVEL (5-part pattern)
// ============================================================================

export const MCP_LOG_LEVELS = ['info', 'warn', 'error'] as const;
export const DEFAULT_MCP_LOG_LEVEL: McpLogLevel = 'info';
export const McpLogLevelSchema = z.enum(MCP_LOG_LEVELS);
export type McpLogLevel = z.infer<typeof McpLogLevelSchema>;
export const McpLogLevels = { ERROR: 'error', INFO: 'info', WARN: 'warn' } as const;

// ============================================================================
// MCP EVALUATION STATUS (5-part pattern)
// ============================================================================

export const MCP_EVALUATION_STATUSES = ['pending', 'completed', 'failed'] as const;
export const DEFAULT_MCP_EVALUATION_STATUS: McpEvaluationStatus = 'pending';
export const McpEvaluationStatusSchema = z.enum(MCP_EVALUATION_STATUSES);
export type McpEvaluationStatus = z.infer<typeof McpEvaluationStatusSchema>;
export const McpEvaluationStatuses = { COMPLETED: 'completed', FAILED: 'failed', PENDING: 'pending' } as const;
