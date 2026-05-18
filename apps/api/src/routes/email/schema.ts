/**
 * Email Route Schemas
 *
 * Schemas for email preferences, unsubscribe flows, and tracking pixels.
 * Reuses database validation schemas and shared enums.
 */

import { z } from '@hono/zod-openapi';
import { EmailCategorySchema } from '@debatekit/shared/enums';

import { CoreSchemas, createApiResponseSchema } from '@/core/schemas';
import { emailPreferenceSelectSchema } from '@/db/validation/email-marketing';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const SendLogIdParamSchema = z.object({
  logId: CoreSchemas.id().openapi({
    description: 'Email send log ID',
    example: 'log_abc123xyz',
    param: {
      in: 'path',
      name: 'logId',
    },
  }),
}).openapi('SendLogIdParam');

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const UnsubscribeQuerySchema = z.object({
  category: EmailCategorySchema.openapi({
    description: 'Email category to unsubscribe from',
    example: 'marketing',
    param: { in: 'query', name: 'category' },
  }),
  token: z.string().min(1).openapi({
    description: 'HMAC unsubscribe token',
    example: 'abc123def456',
    param: { in: 'query', name: 'token' },
  }),
  userId: CoreSchemas.id().openapi({
    description: 'User ID',
    example: 'user_abc123',
    param: { in: 'query', name: 'userId' },
  }),
}).openapi('UnsubscribeQuery');

// ============================================================================
// Request Body Schemas
// ============================================================================

export const UpdatePreferencesRequestSchema = z.object({
  preferences: z.array(z.object({
    category: EmailCategorySchema.openapi({
      description: 'Email category',
      example: 'marketing',
    }),
    subscribed: z.boolean().openapi({
      description: 'Whether the user is subscribed to this category',
      example: true,
    }),
  })).min(1, 'At least one preference is required').openapi({
    description: 'Array of category subscription preferences to update',
  }),
}).openapi('UpdatePreferencesRequest');

export const UnsubscribeRequestSchema = z.object({
  category: EmailCategorySchema.openapi({
    description: 'Email category to unsubscribe from',
    example: 'marketing',
  }),
  token: z.string().min(1).openapi({
    description: 'HMAC unsubscribe token',
    example: 'abc123def456',
  }),
  userId: CoreSchemas.id().openapi({
    description: 'User ID',
    example: 'user_abc123',
  }),
}).openapi('UnsubscribeRequest');

export const ResubscribeRequestSchema = z.object({
  category: EmailCategorySchema.openapi({
    description: 'Email category to resubscribe to',
    example: 'marketing',
  }),
  token: z.string().min(1).openapi({
    description: 'HMAC resubscribe token',
    example: 'abc123def456',
  }),
  userId: CoreSchemas.id().openapi({
    description: 'User ID',
    example: 'user_abc123',
  }),
}).openapi('ResubscribeRequest');

// ============================================================================
// Response Schemas
// ============================================================================

export const EmailPreferenceSchema = emailPreferenceSelectSchema
  .omit({ id: true, userId: true })
  .openapi('EmailPreference');

export const GetPreferencesResponseSchema = createApiResponseSchema(
  z.object({
    preferences: z.array(EmailPreferenceSchema),
  }).openapi('GetPreferencesPayload'),
).openapi('GetPreferencesResponse');

export const UpdatePreferencesResponseSchema = createApiResponseSchema(
  z.object({
    preferences: z.array(EmailPreferenceSchema),
  }).openapi('UpdatePreferencesPayload'),
).openapi('UpdatePreferencesResponse');

export const UnsubscribeValidationResponseSchema = createApiResponseSchema(
  z.object({
    category: EmailCategorySchema,
    valid: z.boolean(),
  }).openapi('UnsubscribeValidationPayload'),
).openapi('UnsubscribeValidationResponse');

export const UnsubscribeConfirmResponseSchema = createApiResponseSchema(
  z.object({
    category: EmailCategorySchema,
    unsubscribed: z.boolean(),
  }).openapi('UnsubscribeConfirmPayload'),
).openapi('UnsubscribeConfirmResponse');

export const ResubscribeConfirmResponseSchema = createApiResponseSchema(
  z.object({
    category: EmailCategorySchema,
    resubscribed: z.boolean(),
  }).openapi('ResubscribeConfirmPayload'),
).openapi('ResubscribeConfirmResponse');

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EmailPreference = z.infer<typeof EmailPreferenceSchema>;
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;
export type UnsubscribeRequest = z.infer<typeof UnsubscribeRequestSchema>;
export type ResubscribeRequest = z.infer<typeof ResubscribeRequestSchema>;
