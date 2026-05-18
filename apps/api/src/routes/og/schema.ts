/**
 * OG Image Route Schemas
 *
 * Zod schemas for OG image generation endpoint.
 * @see /docs/backend-patterns.md - Schema conventions
 */

import { z } from '@hono/zod-openapi';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Query params for /og/chat endpoint
 */
export const OgChatQuerySchema = z.object({
  slug: z.string().min(1).openapi({
    description: 'Thread slug to generate OG image for',
    example: 'brainstorming-startup-ideas-abc123',
  }),
  v: z.string().optional().openapi({
    description: 'Cache version hash (optional, for cache busting)',
    example: 'a1b2c3d4',
  }),
}).openapi('OgChatQuery');

export type OgChatQuery = z.infer<typeof OgChatQuerySchema>;

// ============================================================================
// PAGE OG IMAGE SCHEMAS
// ============================================================================

/**
 * Page types that have dynamic OG images
 */
export const OG_PAGE_TYPE_VALUES = [
  'home',
  'mcp-landing',
  'architecture-review',
  'ma-deal-screening',
  'investment-analysis',
  'legal-review',
  'healthcare-clinical',
  'compliance-advisory',
] as const;

export const ogPageTypeSchema = z.enum(OG_PAGE_TYPE_VALUES);
export type OgPageType = z.infer<typeof ogPageTypeSchema>;

/**
 * Query params for /og/page endpoint
 */
export const OgPageQuerySchema = z.object({
  type: ogPageTypeSchema.openapi({
    description: 'Page type to generate OG image for',
    example: 'mcp-landing',
  }),
}).openapi('OgPageQuery');

export type OgPageQuery = z.infer<typeof OgPageQuerySchema>;
