/**
 * Type Guards and Runtime Type Checking Utilities
 *
 * SINGLE SOURCE OF TRUTH: Runtime type checking using Zod schemas
 * for TypeScript type narrowing without unsafe type assertions.
 *
 * Pattern: Each type guard has a corresponding Zod schema that is exported
 * alongside the guard function. Use z.safeParse() for validation.
 */

import { MessagePartTypes } from '@debatekit/shared/enums';
import { z } from 'zod';

// ============================================================================
// BASIC SCHEMAS & TYPE GUARDS
// ============================================================================

/**
 * Schema for any plain object (not array, not null)
 *
 * VALIDATION BOUNDARY - Record<string, unknown> justified:
 * This is a fundamental runtime type guard used at system boundaries where
 * the incoming value shape is genuinely unknown (JSON parsing, external data).
 * Callers should use more specific Zod schemas after narrowing with isObject().
 *
 * Note: z.record() doesn't distinguish null from objects, so we use a
 * custom refinement to ensure proper object type checking.
 */
export const ObjectSchema = z.custom<Record<string, unknown>>(
  (val): val is Record<string, unknown> =>
    typeof val === 'object' && val !== null && !Array.isArray(val),
);

/**
 * VALIDATION BOUNDARY: Returns Record<string, unknown> intentionally.
 * This is the first-pass narrowing step; callers must validate further
 * with domain-specific Zod schemas for full type safety.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return ObjectSchema.safeParse(value).success;
}

/**
 * Schema for Stripe metadata format - flat object with string values only
 */
export const StringRecordSchema = z.record(z.string(), z.string());

export function isStringRecord(value: unknown): value is Record<string, string> {
  return StringRecordSchema.safeParse(value).success;
}

/**
 * Schema for non-empty string
 */
export const NonEmptyStringSchema = z.string().min(1);

export function isNonEmptyString(value: unknown): value is string {
  return NonEmptyStringSchema.safeParse(value).success;
}

/**
 * Schema for valid number (not NaN)
 */
export const NumberSchema = z.number().refine(n => !Number.isNaN(n));

// ============================================================================
// OBJECT PROPERTY EXTRACTION
// ============================================================================

export function extractProperty<T>(
  obj: unknown,
  key: string,
  guard: (value: unknown) => value is T,
): T | undefined {
  if (!isObject(obj)) {
    return undefined;
  }

  const value = obj[key];
  return guard(value) ? value : undefined;
}

/**
 * VALIDATION BOUNDARY: Uses Record<string, unknown> in return type
 * because the full object shape is unknown at this point. The guard
 * function narrows the specific property K to type T while preserving
 * access to other properties for further validation.
 */
export function hasProperty<K extends string, T>(
  obj: unknown,
  key: K,
  guard: (value: unknown) => value is T,
): obj is Record<string, unknown> & Record<K, T> {
  if (!isObject(obj)) {
    return false;
  }

  return guard(obj[key]);
}

// ============================================================================
// ARRAY SCHEMAS & TYPE GUARDS
// ============================================================================

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ============================================================================
// DOMAIN-SPECIFIC SCHEMAS & TYPE GUARDS
// ============================================================================

/**
 * Schema for text part of a message
 */
export const TextPartSchema = z.object({
  text: NonEmptyStringSchema,
  type: z.literal(MessagePartTypes.TEXT),
});

export type TextPart = z.infer<typeof TextPartSchema>;

export function isTextPart(
  value: unknown,
): value is { type: typeof MessagePartTypes.TEXT; text: string } {
  return TextPartSchema.safeParse(value).success;
}

/**
 * Schema for Stripe payment method card details
 *
 * Zod's default behavior strips unknown keys during parse, which is
 * the safest approach for Stripe objects that vary by API version.
 * We only validate the fields we actually use.
 */
export const StripeCardSchema = z.object({
  brand: z.string().optional(),
  last4: z.string().optional(),
});

export const StripePaymentMethodSchema = z.object({
  card: StripeCardSchema.optional().nullable(),
});

export type StripePaymentMethod = z.infer<typeof StripePaymentMethodSchema>;

export function isStripePaymentMethod(
  value: unknown,
): value is { card?: { brand?: string; last4?: string } } {
  return StripePaymentMethodSchema.safeParse(value).success;
}

/**
 * Schema for subscription period timestamps
 *
 * Zod strips unknown keys by default, so only the fields we need are
 * validated and retained from Stripe subscription objects.
 */
export const PeriodTimestampsSchema = z.object({
  current_period_end: NumberSchema.optional(),
  current_period_start: NumberSchema.optional(),
});

export type PeriodTimestamps = z.infer<typeof PeriodTimestampsSchema>;

export function hasPeriodTimestamps(
  value: unknown,
): value is { current_period_start?: number; current_period_end?: number } {
  return PeriodTimestampsSchema.safeParse(value).success;
}

/**
 * Schema for billing cycle anchor
 *
 * Zod strips unknown keys by default, so only the fields we need are
 * validated and retained from Stripe subscription objects.
 */
export const BillingCycleAnchorSchema = z.object({
  billing_cycle_anchor: NumberSchema.optional(),
});

export type BillingCycleAnchor = z.infer<typeof BillingCycleAnchorSchema>;

export function hasBillingCycleAnchor(
  value: unknown,
): value is { billing_cycle_anchor?: number } {
  return BillingCycleAnchorSchema.safeParse(value).success;
}

// ============================================================================
// ZOD-BASED TYPE GUARD UTILITIES
// ============================================================================

export function safeParse<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function filterArrayWithSchema<TSchema extends z.ZodType>(
  items: unknown[] | null | undefined,
  schema: TSchema,
): z.infer<TSchema>[] {
  if (!items || !isArray(items)) {
    return [];
  }

  return items
    .map(item => schema.safeParse(item))
    .filter((result): result is { success: true; data: z.infer<TSchema> } => result.success)
    .map(result => result.data);
}
