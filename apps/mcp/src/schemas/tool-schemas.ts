import {
  ChatModeSchema,
  DEFAULT_CHAT_MODE,
  DEFAULT_MCP_OUTPUT_FORMAT,
  DEFAULT_MCP_THINKING_LEVEL,
  McpLogLevelSchema,
  McpOutputFormatSchema,
  McpThinkingLevelSchema,
} from '@debatekit/shared/enums';
import { z } from 'zod';

import { KnowledgeItemSchema } from '../engine/context-augmentor';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS } from '../engine/presets';

// ============================================================================
// OPENROUTER API RESPONSE
// ============================================================================

export const OpenRouterResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string().nullable(),
      reasoning_content: z.string().nullish(),
    }),
  })),
  usage: z.object({
    completion_tokens: z.number(),
    prompt_tokens: z.number(),
  }).optional(),
});

// ============================================================================
// SHARED TOOL INPUT EXTENSIONS
// ============================================================================

/** Common fields for debate tools that support webhooks */
const WebhookSchema = z.object({
  webhook_url: z.string().url().optional().describe('Webhook URL to POST results to after completion'),
});

/** Common fields for debate tools that support session context chaining */
const SessionContextSchema = z.object({
  session_context: z.array(z.string()).max(3).optional().describe('Session IDs to use as context (max 3). Prior moderator summaries will be prepended.'),
});

/** Common fields for debate tools that support knowledge injection */
const KnowledgeSchema = z.object({
  knowledge: z.array(KnowledgeItemSchema).max(5).optional().describe('Reference knowledge to inject as context'),
});

// ============================================================================
// RUN DEBATE (core engine schema)
// ============================================================================

export const RunDebateInputSchema = z.object({
  context: z.string().max(50000).optional().describe(
    'Additional background context for the debate (code, docs, requirements)',
  ),
  format: McpOutputFormatSchema.default(DEFAULT_MCP_OUTPUT_FORMAT).describe(
    'Moderator output format: discussion (narrative), adr (architecture decision), comparison (table), pros-cons',
  ),
  mode: ChatModeSchema.default(DEFAULT_CHAT_MODE).describe(
    'Conversation mode: analyzing (research), brainstorming (ideas), debating (tradeoffs), solving (action plans)',
  ),
  models: z.array(z.string()).min(MIN_PARTICIPANTS).max(MAX_PARTICIPANTS).optional().describe(
    'Override specific model IDs. Min 3 models. Use list-models to see available options',
  ),
  prompt: z.string().min(1).max(10000).describe(
    'The question, topic, or problem to debate',
  ),
  roles: z.array(z.string()).optional().describe(
    'Inline role names for participants (e.g., ["Security Architect", "Backend Engineer"])',
  ),
  thinking_level: McpThinkingLevelSchema.default(DEFAULT_MCP_THINKING_LEVEL).describe(
    'Controls model quality and cost: low (fast/cheap), medium (balanced), high (maximum reasoning)',
  ),
});

const TokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
});

export const ParticipantResponseSchema = z.object({
  model_id: z.string(),
  model_name: z.string(),
  response: z.string(),
  role: z.string().nullable(),
  token_usage: TokenUsageSchema,
});

const ModeratorResultSchema = z.object({
  model_id: z.string(),
  summary: z.string(),
  token_usage: TokenUsageSchema,
});
export const RunDebateOutputSchema = z.object({
  metadata: z.object({
    duration_ms: z.number(),
    format: McpOutputFormatSchema,
    mode: ChatModeSchema,
    prompt_version: z.number().nullable().optional(),
    thinking_level: McpThinkingLevelSchema,
    total_credits_used: z.number(),
  }),
  moderator: ModeratorResultSchema,
  participants: z.array(ParticipantResponseSchema),
});
export type RunDebateOutput = z.infer<typeof RunDebateOutputSchema>;

// ============================================================================
// CONSULT (full-featured debate tool)
// ============================================================================

export const ConsultInputSchema = RunDebateInputSchema.pick({
  context: true,
  format: true,
  mode: true,
  models: true,
  prompt: true,
  roles: true,
  thinking_level: true,
}).extend({
  ...WebhookSchema.shape,
  ...SessionContextSchema.shape,
  ...KnowledgeSchema.shape,
  auto_route: z.boolean().default(false).describe('Auto-select optimal models based on prompt analysis and historical performance'),
});

// ============================================================================
// ARCHITECTURE SCALE (5-part enum)
// ============================================================================

const ARCHITECTURE_SCALE_VALUES = ['startup', 'growth', 'enterprise'] as const;
const ArchitectureScaleSchema = z.enum(ARCHITECTURE_SCALE_VALUES);
type ArchitectureScale = z.infer<typeof ArchitectureScaleSchema>;
const ArchitectureScales = { ENTERPRISE: 'enterprise', GROWTH: 'growth', STARTUP: 'startup' } as const;
const DEFAULT_ARCHITECTURE_SCALE: ArchitectureScale = ArchitectureScales.STARTUP;

// ============================================================================
// ARCHITECT
// ============================================================================

export const ArchitectInputSchema = z.object({
  description: z.string().min(1).max(10000).describe('What the system should do'),
  focus_areas: z.array(z.string()).optional().describe('Priority areas (e.g., ["security", "performance"])'),
  scale: ArchitectureScaleSchema.default(DEFAULT_ARCHITECTURE_SCALE).describe('Target scale: startup (small team), growth (scaling), enterprise (large org)'),
  tech_stack: z.array(z.string()).optional().describe('Preferred technologies'),
}).extend(WebhookSchema.shape);

// ============================================================================
// REVIEW CODE
// ============================================================================

export const ReviewCodeInputSchema = z.object({
  code: z.string().min(1).max(100000).describe('The code to review'),
  focus: z.array(z.string()).optional().describe('Review focus areas (e.g., ["security", "performance"])'),
  language: z.string().optional().describe('Programming language (auto-detected if not specified)'),
  thinking_level: McpThinkingLevelSchema.default(DEFAULT_MCP_THINKING_LEVEL).describe('Review depth: low (quick scan), medium (balanced), high (thorough)'),
}).extend(WebhookSchema.shape);

// ============================================================================
// PLAN IMPLEMENTATION
// ============================================================================

export const PlanImplementationInputSchema = z.object({
  codebase_context: z.string().max(50000).optional().describe('Relevant existing code, file structure, or architecture notes'),
  constraints: z.array(z.string()).optional().describe('Constraints (e.g., ["no breaking changes", "must support offline"])'),
  feature: z.string().min(1).max(10000).describe('The feature or change to plan'),
  tech_stack: z.array(z.string()).optional().describe('Current tech stack'),
  thinking_level: McpThinkingLevelSchema.default(DEFAULT_MCP_THINKING_LEVEL).describe('Planning depth'),
}).extend({ ...WebhookSchema.shape, ...SessionContextSchema.shape, ...KnowledgeSchema.shape });

// ============================================================================
// DEBUG
// ============================================================================

export const DebugInputSchema = z.object({
  code: z.string().max(100000).optional().describe('The relevant code where the bug occurs'),
  error: z.string().max(10000).optional().describe('Error message, stack trace, or unexpected output'),
  expected_behavior: z.string().max(5000).optional().describe('What should happen vs what actually happens'),
  problem: z.string().min(1).max(10000).describe('Describe the bug, failure, or unexpected behavior'),
  thinking_level: McpThinkingLevelSchema.default(DEFAULT_MCP_THINKING_LEVEL).describe('Analysis depth'),
}).extend({ ...WebhookSchema.shape, ...SessionContextSchema.shape, ...KnowledgeSchema.shape });

// ============================================================================
// ASSESS TRADEOFFS
// ============================================================================

export const AssessTradeoffsInputSchema = z.object({
  context: z.string().max(50000).optional().describe('Background context — codebase, team, timeline, constraints'),
  decision: z.string().min(1).max(10000).describe('The decision or question to evaluate'),
  options: z.array(z.string()).min(2).optional().describe('Specific options to compare'),
  priorities: z.array(z.string()).optional().describe('What matters most (e.g., ["performance", "dx", "cost"])'),
  thinking_level: McpThinkingLevelSchema.default('medium').describe('Analysis depth'),
}).extend({ ...WebhookSchema.shape, ...SessionContextSchema.shape });

// ============================================================================
// LIST SESSIONS
// ============================================================================

export const ListSessionsInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20).describe('Max results to return'),
  offset: z.number().int().min(0).default(0).describe('Pagination offset'),
  tool_name: z.string().optional().describe('Filter by tool name (e.g., "consult", "architect")'),
});

// ============================================================================
// GET LOGS
// ============================================================================

export const GetLogsInputSchema = z.object({
  end_time: z.number().optional().describe('End timestamp (ms) for time range filter'),
  event: z.string().optional().describe('Filter by event name (e.g., "debate_completed")'),
  level: McpLogLevelSchema.optional().describe('Filter by log level'),
  limit: z.number().int().min(1).max(200).default(50).describe('Max results'),
  offset: z.number().int().min(0).default(0).describe('Pagination offset'),
  session_id: z.string().optional().describe('Filter logs for a specific session'),
  start_time: z.number().optional().describe('Start timestamp (ms) for time range filter'),
});

// ============================================================================
// GET SESSION
// ============================================================================

export const GetSessionInputSchema = z.object({
  session_id: z.string().min(1).describe('The session ID to retrieve'),
});

// ============================================================================
// GET THREAD LINK
// ============================================================================

export const GetThreadLinkInputSchema = z.object({
  session_id: z.string().min(1).describe('The session ID to get the thread link for'),
});

// ============================================================================
// LIST MODELS
// ============================================================================

export const ListModelsInputSchema = z.object({
  thinking_level: McpThinkingLevelSchema.optional().describe('Filter to a specific thinking level'),
});

// ============================================================================
// SET THREAD VISIBILITY
// ============================================================================

export const SetThreadVisibilityInputSchema = z.object({
  is_public: z.boolean().describe('Set to true to make the thread publicly accessible, false to make it private'),
  session_id: z.string().min(1).describe('The session ID from a previous debate'),
});

// ============================================================================
// CHECK USAGE (no input)
// ============================================================================

export const CheckUsageInputSchema = z.object({});
