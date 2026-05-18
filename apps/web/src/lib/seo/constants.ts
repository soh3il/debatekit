import { BRAND } from '@debatekit/shared';

import type { PageType, SeoMetadata } from './schemas';
import { PAGE_TYPES } from './schemas';

/**
 * SEO Constants - Centralized SEO configuration
 * Uses BRAND constant for consistent branding
 */

// ============================================================================
// DEFAULT SEO VALUES
// ============================================================================

export const SEO_DEFAULTS = {
  colorScheme: 'dark',
  description: BRAND.description,
  ogImageHeight: '630',
  ogImagePath: '/static/og-image.png',
  ogImageWidth: '1200',
  ogType: 'website',
  siteName: BRAND.name,
  themeColor: '#000000',
  twitterHandle: BRAND.social.twitterHandle,
} as const;

// ============================================================================
// CACHE CONTROL PRESETS
// ============================================================================

export const CACHE_HEADERS = {
  /** Daily refresh content - 1 day at CDN, stale for 7 days */
  daily: 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
  /** Hourly refresh content - 1 hour at CDN, stale for 1 day */
  hourly: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  /** No cache - always revalidate */
  noCache: 'no-store, no-cache, must-revalidate',
  /** Static content - 7 days at CDN, stale for 30 days */
  static: 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000, immutable',
} as const;

// ============================================================================
// PAGE SEO METADATA MAP
// ============================================================================

/**
 * SEO metadata for each page type
 * Single source of truth for all page SEO configuration
 */
export const PAGE_SEO_METADATA: Record<PageType, SeoMetadata> = {
  [PAGE_TYPES.AI_COUNCIL]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'Multi-model AI council where three models argue the tradeoffs, a moderator synthesizes the verdict. Better than asking one AI — validated at ICML 2024. The best AI tool for productivity in 2026.',
    ogImagePath: '/og/page?type=ai-council',
    path: '/solutions/ai-council',
    robots: 'index, follow',
    title: `AI Council \u2014 Multi-Model Debate for Better Decisions | ${BRAND.name}`,
  },
  [PAGE_TYPES.ARCHITECTURE_REVIEW]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'AI-powered architecture review with multiple AI models that debate trade-offs, assess security implications, and evaluate operational readiness. Built for engineering leads, CTOs, and platform teams. Structured architecture decisions in minutes, not weeks.',
    ogImagePath: '/og/page?type=architecture-review',
    path: '/solutions/architecture-review',
    robots: 'index, follow',
    title: `AI Architecture Review — Multi-Model Trade-off Analysis for Engineering Teams | ${BRAND.name}`,
  },
  [PAGE_TYPES.CHAT]: {
    description: `Start a conversation with multiple AI models on ${BRAND.name}.`,
    path: '/chat',
    robots: 'noindex, nofollow',
    title: `Chat - ${BRAND.name}`,
  },
  [PAGE_TYPES.CHAT_THREAD]: {
    description: `AI conversation on ${BRAND.name}.`,
    path: '/chat',
    robots: 'noindex, nofollow',
    title: `Chat - ${BRAND.name}`,
  },
  [PAGE_TYPES.COMPLIANCE_ADVISORY]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'AI-powered regulatory compliance analysis with multiple AI models that monitor regulatory changes, identify compliance gaps, score risks, and draft remediation roadmaps. Built for chief compliance officers, regulated financial institutions, and multinational corporations.',
    ogImagePath: '/og/page?type=compliance-advisory',
    path: '/solutions/compliance-advisory',
    robots: 'index, follow',
    title: `AI Compliance Advisory — Multi-Model Regulatory Risk Assessment | ${BRAND.name}`,
  },
  [PAGE_TYPES.CONNECT]: {
    description: 'Use DebateKit across your favorite platforms and tools.',
    path: '/chat/connect',
    robots: 'noindex, nofollow',
    title: `Connect - ${BRAND.name}`,
  },
  [PAGE_TYPES.HEALTHCARE_CLINICAL]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'AI-powered clinical decision support with multiple AI models that simulate multi-specialty consultation — differential diagnosis, treatment planning, drug interaction review, and evidence-based reasoning. Built for clinicians, hospital systems, and medical educators.',
    ogImagePath: '/og/page?type=healthcare-clinical',
    path: '/solutions/healthcare-clinical',
    robots: 'index, follow',
    title: `AI Clinical Decision Support — Multi-Specialty Diagnostic Reasoning | ${BRAND.name}`,
  },
  [PAGE_TYPES.HOME]: {
    description: BRAND.description,
    ogImagePath: '/og/page?type=home',
    path: '/',
    robots: 'index, follow',
    title: `${BRAND.name} — ${BRAND.tagline}`,
  },
  [PAGE_TYPES.INVESTMENT_ANALYSIS]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'AI-powered investment analysis with multiple AI models that debate bull/bear cases, assess macro context, and build valuation frameworks. Built for equity research, venture capital, and institutional asset managers.',
    ogImagePath: '/og/page?type=investment-analysis',
    path: '/solutions/investment-analysis',
    robots: 'index, follow',
    title: `AI Investment Analysis — Multi-Model Bull/Bear Debate for Research Teams | ${BRAND.name}`,
  },
  [PAGE_TYPES.LEGAL_REVIEW]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'AI-powered contract review and legal analysis with multiple AI models that debate clause risks, compliance gaps, IP exposure, and litigation liability. Built for law firms, general counsel, and corporate legal teams.',
    ogImagePath: '/og/page?type=legal-review',
    path: '/solutions/legal-review',
    robots: 'index, follow',
    title: `AI Contract Review & Legal Analysis — Multi-Model Risk Assessment | ${BRAND.name}`,
  },
  [PAGE_TYPES.LLM_COUNCIL]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'Turn Karpathy\'s LLM council concept into production. Multiple AI models debate, challenge, and synthesize answers. Structured deliberation validated at ICML 2024.',
    ogImagePath: '/og/page?type=llm-council',
    path: '/solutions/llm-council',
    robots: 'index, follow',
    title: `LLM Council — Multi-Model AI Deliberation Platform | ${BRAND.name}`,
  },
  [PAGE_TYPES.MA_DEAL_SCREENING]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'Screen M&A deals with multiple AI models that debate, challenge, and converge. Built for private equity, investment banks, and corporate development teams. Structured deal briefs in minutes, not days.',
    ogImagePath: '/og/page?type=ma-deal-screening',
    path: '/solutions/ma-deal-screening',
    robots: 'index, follow',
    title: `AI M&A Deal Screening for Private Equity — Multi-Model AI Analysis | ${BRAND.name}`,
  },
  [PAGE_TYPES.MCP_LANDING]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'Kill the AI echo chamber. Multi-model deliberation for your AI workflow — each model reads and challenges previous responses. Models from Anthropic, OpenAI, Google, and DeepSeek, one MCP config. Validated at ICML 2024 (Best Paper), NeurIPS 2024, and ICLR 2025.',
    ogImagePath: '/og/page?type=mcp-landing',
    path: '/mcp',
    robots: 'index, follow',
    title: `MCP Server — Kill the Echo Chamber | ${BRAND.name}`,
  },
  [PAGE_TYPES.MULTI_AGENT_DEBATE]: {
    cacheControl: CACHE_HEADERS.daily,
    description: 'Multi-agent debate improves AI accuracy by 28% (ICML 2024). DebateKit brings MAD research to production — multiple models debate, challenge, and synthesize better answers.',
    ogImagePath: '/og/page?type=multi-agent-debate',
    path: '/solutions/multi-agent-debate',
    robots: 'index, follow',
    title: `Multi-Agent Debate — AI Deliberation Platform Backed by Research | ${BRAND.name}`,
  },
  [PAGE_TYPES.PRICING]: {
    cacheControl: CACHE_HEADERS.daily,
    description: `Choose your ${BRAND.name} plan - collaborative AI brainstorming with multiple AI models working together.`,
    path: '/chat/pricing',
    robots: 'index, follow',
    title: `Pricing - ${BRAND.name}`,
  },
  [PAGE_TYPES.PRIVACY]: {
    cacheControl: CACHE_HEADERS.static,
    description: `Privacy Policy for ${BRAND.name} - Learn how we collect, use, and protect your data.`,
    path: '/legal/privacy',
    robots: 'index, follow',
    title: `Privacy Policy - ${BRAND.name}`,
  },
  [PAGE_TYPES.SIGN_IN]: {
    cacheControl: CACHE_HEADERS.hourly,
    description: `Sign in to ${BRAND.name} - the collaborative AI brainstorming platform where multiple AI models work together to solve problems and generate ideas.`,
    path: '/auth/sign-in',
    robots: 'index, follow',
    title: `Sign In - ${BRAND.name}`,
  },
  [PAGE_TYPES.TERMS]: {
    cacheControl: CACHE_HEADERS.static,
    description: `Terms of Service for ${BRAND.name} - Read our terms and conditions for using the platform.`,
    path: '/legal/terms',
    robots: 'index, follow',
    title: `Terms of Service - ${BRAND.name}`,
  },
  [PAGE_TYPES.WHY_DEBATEKIT]: {
    description: 'Your AI Board of Directors. Multi-model deliberation for better answers.',
    path: '/chat/why-debatekit',
    robots: 'index, follow',
    title: `Why DebateKit? | ${BRAND.name}`,
  },
};
