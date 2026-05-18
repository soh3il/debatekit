/**
 * Integration-scoped enums following the 5-part pattern.
 *
 * Only enums relevant to MCP REST API integrations are included here.
 * For the full set of enums, see packages/shared/src/enums/.
 */

import { z } from 'zod'

// ============================================================================
// THINKING LEVEL
// ============================================================================

export const THINKING_LEVELS = ['low', 'medium', 'high'] as const
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'medium'
export const ThinkingLevelSchema = z.enum(THINKING_LEVELS)
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>
export const ThinkingLevels = { HIGH: 'high', LOW: 'low', MEDIUM: 'medium' } as const

// ============================================================================
// CHAT MODE
// ============================================================================

export const CHAT_MODES = ['analyzing', 'brainstorming', 'debating', 'solving'] as const
export const DEFAULT_CHAT_MODE: ChatMode = 'debating'
export const ChatModeSchema = z.enum(CHAT_MODES)
export type ChatMode = z.infer<typeof ChatModeSchema>
export const ChatModes = {
  ANALYZING: 'analyzing',
  BRAINSTORMING: 'brainstorming',
  DEBATING: 'debating',
  SOLVING: 'solving',
} as const

// ============================================================================
// OUTPUT FORMAT
// ============================================================================

export const OUTPUT_FORMATS = ['discussion', 'adr', 'comparison', 'pros-cons'] as const
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'discussion'
export const OutputFormatSchema = z.enum(OUTPUT_FORMATS)
export type OutputFormat = z.infer<typeof OutputFormatSchema>
export const OutputFormats = {
  ADR: 'adr',
  COMPARISON: 'comparison',
  DISCUSSION: 'discussion',
  PROS_CONS: 'pros-cons',
} as const

// ============================================================================
// ARCHITECT SCALE
// ============================================================================

export const ARCHITECT_SCALES = ['startup', 'growth', 'enterprise'] as const
export const DEFAULT_ARCHITECT_SCALE: ArchitectScale = 'startup'
export const ArchitectScaleSchema = z.enum(ARCHITECT_SCALES)
export type ArchitectScale = z.infer<typeof ArchitectScaleSchema>
export const ArchitectScales = {
  ENTERPRISE: 'enterprise',
  GROWTH: 'growth',
  STARTUP: 'startup',
} as const

// ============================================================================
// API TOOL NAMES (REST POST endpoints)
// ============================================================================

export const API_TOOL_NAMES = [
  'assess-tradeoffs',
  'architect',
  'consult',
  'debug',
  'plan-implementation',
  'review-code',
] as const
export const ApiToolNameSchema = z.enum(API_TOOL_NAMES)
export type ApiToolName = z.infer<typeof ApiToolNameSchema>

// ============================================================================
// INTEGRATION SOURCE (identifies which integration is calling the API)
// ============================================================================

export const INTEGRATION_SOURCES = [
  'crewai',
  'dify',
  'dxt',
  'huggingface',
  'mcp',
  'n8n',
  'pipedream',
  'raycast',
  'slack',
  'telegram',
  'web',
  'whatsapp',
  'zapier',
] as const
export const DEFAULT_INTEGRATION_SOURCE: IntegrationSource = 'mcp'
export const IntegrationSourceSchema = z.enum(INTEGRATION_SOURCES)
export type IntegrationSource = z.infer<typeof IntegrationSourceSchema>
export const IntegrationSources = {
  CREWAI: 'crewai',
  DIFY: 'dify',
  DXT: 'dxt',
  HUGGINGFACE: 'huggingface',
  MCP: 'mcp',
  N8N: 'n8n',
  PIPEDREAM: 'pipedream',
  RAYCAST: 'raycast',
  SLACK: 'slack',
  TELEGRAM: 'telegram',
  WEB: 'web',
  WHATSAPP: 'whatsapp',
  ZAPIER: 'zapier',
} as const

// ============================================================================
// API QUERY TOOL NAMES (REST GET endpoints + non-debate endpoints)
// ============================================================================

export const API_QUERY_TOOL_NAMES = [
  'get-session',
  'get-thread-link',
  'list-sessions',
  'set-thread-visibility',
] as const
export const ApiQueryToolNameSchema = z.enum(API_QUERY_TOOL_NAMES)
export type ApiQueryToolName = z.infer<typeof ApiQueryToolNameSchema>
