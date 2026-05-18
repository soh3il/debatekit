/**
 * Test Route Schemas
 */

import { z } from '@hono/zod-openapi';

import { createApiResponseSchema } from '@/core/schemas';

export const SetCreditsRequestSchema = z.object({
  credits: z.number().int().min(0).max(1000000).openapi({
    description: 'Credit amount to set',
    example: 10000,
  }),
}).openapi('SetCreditsRequest');

export type SetCreditsRequest = z.infer<typeof SetCreditsRequestSchema>;

const SetCreditsPayloadSchema = z.object({
  available: z.number().openapi({
    description: 'Available credits',
    example: 10000,
  }),
  balance: z.number().openapi({
    description: 'Current credit balance',
    example: 10000,
  }),
  planType: z.string().openapi({
    description: 'User plan type',
    example: 'free',
  }),
  reserved: z.number().openapi({
    description: 'Reserved credits',
    example: 0,
  }),
}).openapi('SetCreditsPayload');

export const SetCreditsResponseSchema = createApiResponseSchema(
  SetCreditsPayloadSchema,
).openapi('SetCreditsResponse');

export type SetCreditsResponse = z.infer<typeof SetCreditsResponseSchema>;

// ============================================================================
// PostHog Diagnostic Schema
// ============================================================================

const PostHogDiagnosticPayloadSchema = z.object({
  clientInitialized: z.boolean().openapi({
    description: 'Whether PostHog client was initialized',
  }),
  eventCaptured: z.boolean().openapi({
    description: 'Whether the test event was captured',
  }),
  eventFlushed: z.boolean().openapi({
    description: 'Whether the event was flushed to PostHog',
  }),
  eventName: z.string().openapi({
    description: 'The test event name that was sent',
  }),
  error: z.string().nullable().openapi({
    description: 'Error message if any step failed',
  }),
  config: z.object({
    hasApiKey: z.boolean(),
    host: z.string().nullable(),
    environment: z.string().nullable(),
  }).openapi({
    description: 'PostHog configuration status',
  }),
}).openapi('PostHogDiagnosticPayload');

export const PostHogDiagnosticResponseSchema = createApiResponseSchema(
  PostHogDiagnosticPayloadSchema,
).openapi('PostHogDiagnosticResponse');

export type PostHogDiagnosticResponse = z.infer<typeof PostHogDiagnosticResponseSchema>;
