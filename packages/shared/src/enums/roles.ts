import { z } from '@hono/zod-openapi';

import { BRAND } from '../constants/brand';

// ============================================================================
// SHORT ROLE NAME
// ============================================================================

// 1️⃣ ARRAY CONSTANT - Source of truth for values
export const SHORT_ROLE_NAMES = ['Ideator', 'Strategist', 'Analyst', 'Builder', 'Critic'] as const;

// 2️⃣ ZOD SCHEMA - Runtime validation + OpenAPI docs
export const ShortRoleNameSchema = z.enum(SHORT_ROLE_NAMES).openapi({
  description: 'Short role name category for participant roles',
  example: 'Analyst',
});

// 3️⃣ TYPESCRIPT TYPE - Inferred from Zod schema
export type ShortRoleName = z.infer<typeof ShortRoleNameSchema>;

// 4️⃣ DEFAULT VALUE
export const DEFAULT_SHORT_ROLE_NAME: ShortRoleName = 'Analyst';

// 5️⃣ CONSTANT OBJECT - For usage in code
export const ShortRoleNames = {
  ANALYST: 'Analyst' as const,
  BUILDER: 'Builder' as const,
  CRITIC: 'Critic' as const,
  IDEATOR: 'Ideator' as const,
  STRATEGIST: 'Strategist' as const,
} as const;

// ============================================================================
// ROLE ICON NAME (string literals - frontend maps to actual icon components)
// ============================================================================

export const ROLE_ICON_NAMES = [
  'lightbulb',
  'messageSquare',
  'hammer',
  'target',
  'sparkles',
  'graduationCap',
  'users',
  'briefcase',
  'trendingUp',
  'swords',
] as const;

export const RoleIconNameSchema = z.enum(ROLE_ICON_NAMES).openapi({
  description: 'Icon name for role template (maps to frontend icon component)',
  example: 'lightbulb',
});

export type RoleIconName = z.infer<typeof RoleIconNameSchema>;

// 4️⃣ DEFAULT VALUE
export const DEFAULT_ROLE_ICON_NAME: RoleIconName = 'lightbulb';

// 5️⃣ CONSTANT OBJECT - For usage in code (prevents typos)
export const RoleIconNames = {
  BRIEFCASE: 'briefcase' as const,
  GRADUATION_CAP: 'graduationCap' as const,
  HAMMER: 'hammer' as const,
  LIGHTBULB: 'lightbulb' as const,
  MESSAGE_SQUARE: 'messageSquare' as const,
  SPARKLES: 'sparkles' as const,
  SWORDS: 'swords' as const,
  TARGET: 'target' as const,
  TRENDING_UP: 'trendingUp' as const,
  USERS: 'users' as const,
} as const;

// ============================================================================
// ROLE CATEGORY METADATA
// ============================================================================

export const RoleCategoryMetadataSchema = z.object({
  bgColor: z.string(),
  iconColor: z.string(),
}).strict();

export type RoleCategoryMetadata = z.infer<typeof RoleCategoryMetadataSchema>;

// Role colors sourced from BRAND.logoGradient indices:
// Analyst=7 (Cyan), Builder=1 (Deep Orange), Critic=2 (Deep Pink),
// Ideator=9 (Green), Strategist=6 (Blue)
function hexToBgColor(hex: string): string {
  const h = hex.replace('#', '');
  return `rgba(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)}, 0.2)`;
}

export const ROLE_CATEGORY_METADATA: Record<ShortRoleName, RoleCategoryMetadata> = {
  Analyst: {
    bgColor: hexToBgColor(BRAND.logoGradient[7]),
    iconColor: BRAND.logoGradient[7],
  },
  Builder: {
    bgColor: hexToBgColor(BRAND.logoGradient[1]),
    iconColor: BRAND.logoGradient[1],
  },
  Critic: {
    bgColor: hexToBgColor(BRAND.logoGradient[2]),
    iconColor: BRAND.logoGradient[2],
  },
  Ideator: {
    bgColor: hexToBgColor(BRAND.logoGradient[9]),
    iconColor: BRAND.logoGradient[9],
  },
  Strategist: {
    bgColor: hexToBgColor(BRAND.logoGradient[6]),
    iconColor: BRAND.logoGradient[6],
  },
};

export const ROLE_NAME_MAPPINGS = {
  'Advocate': ShortRoleNames.STRATEGIST,
  'Alternative Framer': ShortRoleNames.IDEATOR,
  'Alternative Lens': ShortRoleNames.ANALYST,
  'Architect': ShortRoleNames.BUILDER,
  'Assumption Challenger': ShortRoleNames.CRITIC,
  'Assumption Critic': ShortRoleNames.CRITIC,
  'Balancer': ShortRoleNames.ANALYST,
  'Brand Strategist': ShortRoleNames.STRATEGIST,
  // Building/Implementation roles → Builder
  'Builder': ShortRoleNames.BUILDER,
  'Care Coordinator': ShortRoleNames.ANALYST,
  'CFO Advisor': ShortRoleNames.ANALYST,
  'Challenger': ShortRoleNames.CRITIC,
  'Chief Medical Officer': ShortRoleNames.STRATEGIST,
  'Code Reviewer': ShortRoleNames.CRITIC,
  'Communications Lead': ShortRoleNames.STRATEGIST,
  'Competitive Analyst': ShortRoleNames.ANALYST,
  'Contrarian': ShortRoleNames.CRITIC,
  'Correctness Reviewer': ShortRoleNames.CRITIC,
  'Cost Analyst': ShortRoleNames.ANALYST,
  'Creative Spark': ShortRoleNames.IDEATOR,
  'Crisis Manager': ShortRoleNames.STRATEGIST,
  'Cross-Checker': ShortRoleNames.ANALYST,
  'Culture Advisor': ShortRoleNames.ANALYST,
  'Customer Success Lead': ShortRoleNames.ANALYST,
  'Data Analyst': ShortRoleNames.ANALYST,
  'Data Strategist': ShortRoleNames.ANALYST,
  'Deep Reasoner': ShortRoleNames.STRATEGIST,
  // Critical/Skeptical roles → Critic
  'Devil\'s Advocate': ShortRoleNames.CRITIC,
  'Domain Expert': ShortRoleNames.ANALYST,
  'Employment Counsel': ShortRoleNames.CRITIC,
  'Engineering Lead': ShortRoleNames.BUILDER,
  'Enterprise Advisor': ShortRoleNames.STRATEGIST,
  'Evidence Gatherer': ShortRoleNames.ANALYST,
  'Fact Checker': ShortRoleNames.ANALYST,
  'Finance Lead': ShortRoleNames.ANALYST,
  'Framer': ShortRoleNames.IDEATOR,
  'Futurist': ShortRoleNames.IDEATOR,
  'Grounding Voice': ShortRoleNames.CRITIC,
  'Growth Advisor': ShortRoleNames.STRATEGIST,
  'Growth Analyst': ShortRoleNames.ANALYST,
  'Growth Expert': ShortRoleNames.STRATEGIST,
  'Growth Strategist': ShortRoleNames.STRATEGIST,
  'Healthcare Administrator': ShortRoleNames.BUILDER,
  'HR Advisor': ShortRoleNames.ANALYST,
  'HR Director': ShortRoleNames.STRATEGIST,
  'HR Strategist': ShortRoleNames.STRATEGIST,
  'Ideator': ShortRoleNames.IDEATOR,
  'Implementation Strategist': ShortRoleNames.STRATEGIST,
  'Implementer': ShortRoleNames.BUILDER,
  'Industry Analyst': ShortRoleNames.ANALYST,
  'Innovation Lead': ShortRoleNames.IDEATOR,
  'IP Attorney': ShortRoleNames.CRITIC,
  'Lateral Thinker': ShortRoleNames.IDEATOR,
  'Legal Counsel': ShortRoleNames.CRITIC,
  'M&A Advisor': ShortRoleNames.STRATEGIST,
  'M&A Expert': ShortRoleNames.ANALYST,
  'Market Analyst': ShortRoleNames.ANALYST,
  // Moderation/Support roles
  'Mediator': ShortRoleNames.ANALYST,
  'Medical Ethicist': ShortRoleNames.CRITIC,
  'Monetization Expert': ShortRoleNames.STRATEGIST,
  'Nuancer': ShortRoleNames.ANALYST,
  'Oncologist': ShortRoleNames.ANALYST,
  'Operations Analyst': ShortRoleNames.ANALYST,
  'Operations Expert': ShortRoleNames.BUILDER,
  'Optimizer': ShortRoleNames.BUILDER,
  'Patent Attorney': ShortRoleNames.CRITIC,
  'Patient Advocate': ShortRoleNames.ANALYST,
  'Position Advocate': ShortRoleNames.STRATEGIST,
  'Practical Evaluator': ShortRoleNames.CRITIC,
  'Pragmatist': ShortRoleNames.BUILDER,
  'Product Lead': ShortRoleNames.STRATEGIST,
  'Product Strategist': ShortRoleNames.STRATEGIST,
  'Proposer': ShortRoleNames.STRATEGIST,
  'PR Strategist': ShortRoleNames.STRATEGIST,
  'Quality Reviewer': ShortRoleNames.CRITIC,
  'Reasoner': ShortRoleNames.STRATEGIST,
  'Reframer': ShortRoleNames.IDEATOR,
  'Reputation Analyst': ShortRoleNames.ANALYST,
  'Researcher': ShortRoleNames.ANALYST,
  'Revenue Strategist': ShortRoleNames.STRATEGIST,
  'Reviewer': ShortRoleNames.CRITIC,
  'Risk Advisor': ShortRoleNames.ANALYST,
  'Risk Analyst': ShortRoleNames.ANALYST,
  'Secondary Theorist': ShortRoleNames.ANALYST,
  'Security Reviewer': ShortRoleNames.CRITIC,
  'Skeptic': ShortRoleNames.CRITIC,
  'Strategic Advisor': ShortRoleNames.STRATEGIST,
  'Strategic Analyst': ShortRoleNames.ANALYST,
  'Strategic Planner': ShortRoleNames.STRATEGIST,
  'Strategist': ShortRoleNames.STRATEGIST,
  // Strategy/Reasoning roles → Strategist
  'Strategy Advisor': ShortRoleNames.STRATEGIST,
  'Structured Reasoner': ShortRoleNames.STRATEGIST,
  'Synthesizer': ShortRoleNames.BUILDER,
  'Systems Thinker': ShortRoleNames.STRATEGIST,
  'Tech Lead': ShortRoleNames.BUILDER,
  'Technical Expert': ShortRoleNames.BUILDER,
  // Analysis roles → Analyst
  'The Data Analyst': ShortRoleNames.ANALYST,
  // Ideation/Creative roles → Ideator
  'The Ideator': ShortRoleNames.IDEATOR,
  'Trade-Off Analyst': ShortRoleNames.ANALYST,
  'Trade-off Clarifier': ShortRoleNames.ANALYST,
  'User Advocate': ShortRoleNames.ANALYST,
  'User Champion': ShortRoleNames.ANALYST,
  'UX Strategist': ShortRoleNames.STRATEGIST,
  'Verifier': ShortRoleNames.CRITIC,
  'Visionary Thinker': ShortRoleNames.IDEATOR,
  'Wildcard': ShortRoleNames.IDEATOR,
} as const;

export const PredefinedRoleTemplateSchema = z.object({
  category: ShortRoleNameSchema,
  description: z.string(),
  iconName: RoleIconNameSchema,
  name: z.string(),
}).strict();

export type PredefinedRoleTemplate = z.infer<typeof PredefinedRoleTemplateSchema>;

export const PREDEFINED_ROLE_TEMPLATES: readonly PredefinedRoleTemplate[] = [
  {
    category: ShortRoleNames.IDEATOR,
    description: 'Generates wild ideas, lateral connections, and unexpected angles',
    iconName: 'lightbulb',
    name: 'Creative Spark',
  },
  {
    category: ShortRoleNames.IDEATOR,
    description: 'Explores emerging trends, future scenarios, and paradigm shifts',
    iconName: 'sparkles',
    name: 'Futurist',
  },
  {
    category: ShortRoleNames.CRITIC,
    description: 'Challenges assumptions, stress-tests ideas, and surfaces hidden risks',
    iconName: 'swords',
    name: 'Devil\'s Advocate',
  },
  {
    category: ShortRoleNames.CRITIC,
    description: 'Evaluates feasibility, thoroughness, and real-world applicability',
    iconName: 'target',
    name: 'Quality Reviewer',
  },
  {
    category: ShortRoleNames.BUILDER,
    description: 'Focuses on practical implementation, timelines, and concrete next steps',
    iconName: 'hammer',
    name: 'Pragmatist',
  },
  {
    category: ShortRoleNames.ANALYST,
    description: 'Brings data, evidence, and domain-specific expertise to the discussion',
    iconName: 'graduationCap',
    name: 'Researcher',
  },
  {
    category: ShortRoleNames.ANALYST,
    description: 'Advocates for user needs, experience, and real-world impact',
    iconName: 'users',
    name: 'User Champion',
  },
  {
    category: ShortRoleNames.STRATEGIST,
    description: 'Connects the dots, plans long-term, and aligns ideas with goals',
    iconName: 'briefcase',
    name: 'Strategist',
  },
] as const;

export function isShortRoleName(role: unknown): role is ShortRoleName {
  return ShortRoleNameSchema.safeParse(role).success;
}

const ROLE_NAME_LOOKUP: ReadonlyMap<string, ShortRoleName> = new Map(
  Object.entries(ROLE_NAME_MAPPINGS),
);

export function getShortRoleName(role: string): string {
  return ROLE_NAME_LOOKUP.get(role) ?? role;
}

export function getRoleCategoryMetadata(role: string): RoleCategoryMetadata {
  const shortRole = getShortRoleName(role);

  if (isShortRoleName(shortRole)) {
    return ROLE_CATEGORY_METADATA[shortRole];
  }

  return ROLE_CATEGORY_METADATA[ShortRoleNames.ANALYST];
}

export function getPredefinedRoleTemplate(name: string): PredefinedRoleTemplate | undefined {
  return PREDEFINED_ROLE_TEMPLATES.find(t => t.name === name);
}

export function isPredefinedRole(name: string): boolean {
  return PREDEFINED_ROLE_TEMPLATES.some(t => t.name === name);
}
