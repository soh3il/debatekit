/**
 * SEO Module - Centralized SEO configuration using TanStack Start native patterns
 *
 * Usage in routes:
 * ```tsx
 * import { getSeoHead, getSeoHeaders, PAGE_TYPES } from '@/lib/seo';
 *
 * export const Route = createFileRoute('/chat/pricing')({
 *   head: () => getSeoHead(PAGE_TYPES.PRICING),
 *   headers: getSeoHeaders(PAGE_TYPES.PRICING),
 *   component: PricingPage,
 * });
 *
 * // With dynamic title
 * export const Route = createFileRoute('/chat/$slug')({
 *   head: ({ loaderData }) => getSeoHead(PAGE_TYPES.CHAT_THREAD, {
 *     title: `${loaderData.threadTitle} - DebateKit`
 *   }),
 * });
 * ```
 */

// Constants
export {
  CACHE_HEADERS,
  PAGE_SEO_METADATA,
  SEO_DEFAULTS,
} from './constants';

// Helpers
export {
  getCacheControl,
  getOgImageUrl,
  getPageUrl,
  getSeoHead,
  getSeoHeaders,
} from './helpers';

// Type-safe JSON-LD builders (using schema-dts)
export type { JsonLdData } from './json-ld';
export {
  createArticleJsonLd,
  createBreadcrumbListJsonLd,
  createDiscussionForumPostingJsonLd,
  createFAQPageJsonLd,
  createOrganizationJsonLd,
  createProductJsonLd,
  createSoftwareAppJsonLd,
  createWebPageJsonLd,
  createWebSiteJsonLd,
  serializeJsonLd,
} from './json-ld';
// Schemas (single source of truth for types)
export type {
  HeadConfig,
  HeadLink,
  HeadMeta,
  PageType,
  RobotsDirective,
  SeoMetadata,
  SeoOverrides,
} from './schemas';
export {
  DEFAULT_PAGE_TYPE,
  DEFAULT_ROBOTS_DIRECTIVE,
  headConfigSchema,
  headLinkSchema,
  headMetaSchema,
  PAGE_TYPES,
  PageTypeSchema,
  pageTypeSchema,
  RobotsDirectives,
  RobotsDirectiveSchema,
  seoMetadataSchema,
  seoOverridesSchema,
} from './schemas';
