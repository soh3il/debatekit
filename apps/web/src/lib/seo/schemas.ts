import { z } from 'zod';

/**
 * SEO Schemas - Zod schemas for SEO configuration
 * All types are inferred from these schemas (single source of truth)
 */

// ============================================================================
// PAGE TYPE ENUM
// ============================================================================

export const PAGE_TYPES = {
  AI_COUNCIL: 'ai-council',
  ARCHITECTURE_REVIEW: 'architecture-review',
  CHAT: 'chat',
  CHAT_THREAD: 'chat-thread',
  COMPLIANCE_ADVISORY: 'compliance-advisory',
  CONNECT: 'connect',
  HEALTHCARE_CLINICAL: 'healthcare-clinical',
  HOME: 'home',
  INVESTMENT_ANALYSIS: 'investment-analysis',
  LEGAL_REVIEW: 'legal-review',
  LLM_COUNCIL: 'llm-council',
  MA_DEAL_SCREENING: 'ma-deal-screening',
  MCP_LANDING: 'mcp-landing',
  MULTI_AGENT_DEBATE: 'multi-agent-debate',
  PRICING: 'pricing',
  PRIVACY: 'privacy',
  SIGN_IN: 'sign-in',
  TERMS: 'terms',
  WHY_DEBATEKIT: 'why-debatekit',
} as const;

export const PAGE_TYPE_VALUES = Object.values(PAGE_TYPES) as [
  (typeof PAGE_TYPES)[keyof typeof PAGE_TYPES],
  ...(typeof PAGE_TYPES)[keyof typeof PAGE_TYPES][],
];

export const PageTypeSchema = z.enum(PAGE_TYPE_VALUES);

/** @deprecated Use PageTypeSchema instead */
export const pageTypeSchema = PageTypeSchema;

export type PageType = z.infer<typeof PageTypeSchema>;

export const DEFAULT_PAGE_TYPE: PageType = 'home';

// ============================================================================
// ROBOTS DIRECTIVE
// ============================================================================

export const ROBOTS_DIRECTIVES = ['index, follow', 'noindex, nofollow'] as const;

export const DEFAULT_ROBOTS_DIRECTIVE: RobotsDirective = 'index, follow';

export const RobotsDirectiveSchema = z.enum(ROBOTS_DIRECTIVES);

export type RobotsDirective = z.infer<typeof RobotsDirectiveSchema>;

export const RobotsDirectives = {
  INDEX_FOLLOW: 'index, follow' as const,
  NOINDEX_NOFOLLOW: 'noindex, nofollow' as const,
} as const;

// ============================================================================
// SEO CONFIG SCHEMA
// ============================================================================

export const seoMetadataSchema = z.object({
  cacheControl: z.string().optional(),
  description: z.string(),
  ogImagePath: z.string().optional(),
  path: z.string(),
  robots: RobotsDirectiveSchema.default(DEFAULT_ROBOTS_DIRECTIVE),
  title: z.string(),
});

export type SeoMetadata = z.infer<typeof seoMetadataSchema>;

// ============================================================================
// HEAD CONFIG SCHEMA (TanStack Start compatible)
// ============================================================================

export const headMetaSchema = z.union([
  z.object({ title: z.string() }),
  z.object({ charSet: z.string() }),
  z.object({ content: z.string(), name: z.string() }),
  z.object({ content: z.string(), property: z.string() }),
]);

export type HeadMeta = z.infer<typeof headMetaSchema>;

export const headLinkSchema = z.object({
  as: z.string().optional(),
  href: z.string(),
  rel: z.string(),
  sizes: z.string().optional(),
  type: z.string().optional(),
});

export type HeadLink = z.infer<typeof headLinkSchema>;

export const headConfigSchema = z.object({
  links: z.array(headLinkSchema).optional(),
  meta: z.array(headMetaSchema),
});

export type HeadConfig = z.infer<typeof headConfigSchema>;

// ============================================================================
// DYNAMIC SEO OVERRIDES
// ============================================================================

export const seoOverridesSchema = z.object({
  description: z.string().optional(),
  noindex: z.boolean().optional(),
  ogImage: z.string().optional(),
  title: z.string().optional(),
});

export type SeoOverrides = z.infer<typeof seoOverridesSchema>;
