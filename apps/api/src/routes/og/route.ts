/**
 * OG Image Routes
 *
 * OpenAPI route definitions for OG image generation.
 * @see /docs/backend-patterns.md - Route conventions
 */

import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createPublicRouteResponses } from '@/core';

import { OgChatQuerySchema, OgPageQuerySchema } from './schema';

// ============================================================================
// OG CACHE STATUS (5-part enum pattern)
// ============================================================================

// 1. ARRAY CONSTANT
export const OG_CACHE_STATUS_VALUES = ['HIT', 'MISS'] as const;

// 2. ZOD SCHEMA
export const OgCacheStatusSchema = z.enum(OG_CACHE_STATUS_VALUES);

// 3. TYPESCRIPT TYPE
export type OgCacheStatus = z.infer<typeof OgCacheStatusSchema>;

// 4. DEFAULT VALUE
export const _DEFAULT_OG_CACHE_STATUS: OgCacheStatus = 'MISS';

// 5. CONSTANT OBJECT
export const _OgCacheStatuses = {
  HIT: 'HIT' as const,
  MISS: 'MISS' as const,
} as const;

/**
 * GET /og/chat - Generate OG image for public thread
 *
 * Returns a dynamically generated PNG image for social media sharing.
 * Public endpoint - no authentication required.
 */
export const ogChatRoute = createRoute({
  description: 'Generates a dynamic Open Graph image for a publicly shared thread. Returns PNG image directly.',
  method: 'get',
  path: '/og/chat',
  request: {
    query: OgChatQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'image/png': {
          // ✅ JUSTIFIED: Binary responses cannot be validated by Zod at runtime.
          // OpenAPI spec requires schema; using string+binary format for documentation.
          schema: z.string().openapi({
            description: 'PNG image binary data',
            format: 'binary',
          }),
        },
      },
      description: 'OG image generated successfully (returns fallback for missing/private threads)',
      headers: z.object({
        'Cache-Control': z.string(),
        'Content-Type': z.literal('image/png'),
        'X-OG-Cache': OgCacheStatusSchema,
      }),
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Generate OG image for public thread',
  tags: ['og'],
});

/**
 * GET /og/page - Generate OG image for a landing/solution page
 *
 * Returns a dynamically generated PNG image with page-specific headline.
 * Public endpoint - no authentication required.
 */
export const ogPageRoute = createRoute({
  description: 'Generates a dynamic Open Graph image for a landing or solution page. Returns PNG image directly.',
  method: 'get',
  path: '/og/page',
  request: {
    query: OgPageQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'image/png': {
          // ✅ JUSTIFIED: Binary responses cannot be validated by Zod at runtime.
          schema: z.string().openapi({
            description: 'PNG image binary data',
            format: 'binary',
          }),
        },
      },
      description: 'OG image generated successfully for the specified page type',
      headers: z.object({
        'Cache-Control': z.string(),
        'Content-Type': z.literal('image/png'),
      }),
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Generate OG image for landing/solution page',
  tags: ['og'],
});
