import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

// =============================================================================
// n8n CONSTRAINT: Community nodes publish to npm as standalone packages.
// Workspace deps (@debatekit/integration-shared) are NOT available at runtime.
// All values below are INLINED copies. Source of truth is noted per section.
// =============================================================================

// ---------------------------------------------------------------------------
// SHARED EXPRESSION: comma-separated string → trimmed array
// Used by routing.send.value for fields that accept comma-separated lists.
// ---------------------------------------------------------------------------
export const COMMA_SPLIT_EXPRESSION =
	'={{$value ? $value.split(",").map((s) => s.trim()) : undefined}}';

// ---------------------------------------------------------------------------
// THINKING LEVELS
// Source of truth: integrations/shared/src/enums.ts → THINKING_LEVELS
// Values: ['low', 'medium', 'high']
// ---------------------------------------------------------------------------
export const THINKING_LEVEL_OPTIONS: INodePropertyOptions[] = [
	{
		name: 'Low',
		value: 'low',
		description: 'Fast and cheap — good for simple queries',
	},
	{
		name: 'Medium',
		value: 'medium',
		description: 'Balanced quality and cost',
	},
	{
		name: 'High',
		value: 'high',
		description: 'Maximum reasoning — best for complex problems',
	},
];

// ---------------------------------------------------------------------------
// CHAT MODES
// Source of truth: integrations/shared/src/enums.ts → CHAT_MODES
// Values: ['analyzing', 'brainstorming', 'debating', 'solving']
// ---------------------------------------------------------------------------
export const CHAT_MODE_OPTIONS: INodePropertyOptions[] = [
	{
		name: 'Analyzing',
		value: 'analyzing',
		description: 'Research and analysis focus',
	},
	{
		name: 'Brainstorming',
		value: 'brainstorming',
		description: 'Creative ideation focus',
	},
	{
		name: 'Debating',
		value: 'debating',
		description: 'Tradeoffs and counterarguments',
	},
	{
		name: 'Solving',
		value: 'solving',
		description: 'Action plans and solutions',
	},
];

// ---------------------------------------------------------------------------
// OUTPUT FORMATS
// Source of truth: integrations/shared/src/enums.ts → OUTPUT_FORMATS
// Values: ['discussion', 'adr', 'comparison', 'pros-cons']
// ---------------------------------------------------------------------------
export const OUTPUT_FORMAT_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Discussion', value: 'discussion' },
	{ name: 'ADR (Architecture Decision Record)', value: 'adr' },
	{ name: 'Comparison Table', value: 'comparison' },
	{ name: 'Pros & Cons', value: 'pros-cons' },
];

// ---------------------------------------------------------------------------
// ARCHITECT SCALES
// Source of truth: integrations/shared/src/enums.ts → ARCHITECT_SCALES
// Values: ['startup', 'growth', 'enterprise']
// ---------------------------------------------------------------------------
export const ARCHITECT_SCALE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Startup', value: 'startup' },
	{ name: 'Growth', value: 'growth' },
	{ name: 'Enterprise', value: 'enterprise' },
];

// ---------------------------------------------------------------------------
// API TOOL NAMES (for session filtering)
// Source of truth: integrations/shared/src/enums.ts → API_TOOL_NAMES
// Values use underscore form matching MCP tool names in list-sessions response.
// ---------------------------------------------------------------------------
export const TOOL_NAME_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Consult', value: 'consult' },
	{ name: 'Architect', value: 'architect' },
	{ name: 'Review Code', value: 'review_code' },
	{ name: 'Plan Implementation', value: 'plan_implementation' },
	{ name: 'Debug', value: 'debug' },
	{ name: 'Assess Tradeoffs', value: 'assess_tradeoffs' },
];

// ---------------------------------------------------------------------------
// SHARED FIELD FACTORIES
// Reduce duplication across operation description files.
// ---------------------------------------------------------------------------

/** Display filter for a specific resource + operation combination. */
export const showFor = (resource: string, operation?: string) =>
	operation ? { operation: [operation], resource: [resource] } : { resource: [resource] };

/** Reusable thinking-level field — used by consult, debug, reviewCode, planImplementation, assessTradeoffs. */
export const createThinkingLevelField = (
	displayOptions: INodeProperties['displayOptions'],
	description = 'Controls model quality and cost',
): INodeProperties => ({
	displayName: 'Thinking Level',
	name: 'thinkingLevel',
	type: 'options',
	displayOptions,
	options: THINKING_LEVEL_OPTIONS,
	default: 'medium',
	description,
	routing: {
		send: {
			type: 'body',
			property: 'thinking_level',
		},
	},
});
