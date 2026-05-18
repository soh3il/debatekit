/**
 * Type Guards and Runtime Type Checking Utilities
 *
 * SINGLE SOURCE OF TRUTH: Runtime type checking using Zod schemas
 * for TypeScript type narrowing without unsafe type assertions.
 *
 * Pattern: Each type guard has a corresponding Zod schema that is exported
 * alongside the guard function. Use z.safeParse() for validation.
 */

import { MessagePartTypes } from '@debatekit/shared';
import { z } from 'zod';

// ============================================================================
// BASIC SCHEMAS & TYPE GUARDS
// ============================================================================

/**
 * Represents serializable property values in a plain JavaScript object.
 * Covers primitives, arrays, nested objects, and Date (common in message metadata).
 */
export type PlainObjectValue
  = string
    | number
    | boolean
    | null
    | undefined
    | Date
    | PlainObjectValue[]
    | { [key: string]: PlainObjectValue };

/**
 * A plain JavaScript object with string keys.
 * Use this instead of Record<string, unknown> for typed object access.
 */
export type PlainObject = { [key: string]: PlainObjectValue };

/**
 * Schema for any plain object (not array, not null).
 *
 * Note: z.record() doesn't distinguish null from objects, so we use a
 * custom refinement to ensure proper object type checking.
 */
export const PlainObjectSchema = z.custom<PlainObject>(
  (val): val is PlainObject =>
    typeof val === 'object' && val !== null && !Array.isArray(val),
);

export function isObject(value: unknown): value is PlainObject {
  return PlainObjectSchema.safeParse(value).success;
}

/**
 * Schema for non-empty string
 */
export const NonEmptyStringSchema = z.string().min(1);

export function isNonEmptyString(value: unknown): value is string {
  return NonEmptyStringSchema.safeParse(value).success;
}

/**
 * Check if value is a valid ErrorCode enum value
 */
export function isValidErrorCode(code: string, validCodes: readonly string[]): boolean {
  return validCodes.includes(code);
}

// ============================================================================
// GENERIC FILTER HELPERS
// ============================================================================

/**
 * Creates a type-narrowing filter predicate that asserts a given field is non-null.
 *
 * Eliminates the need for inline type extensions (`& { field: NonNullable<...> }`)
 * in `.filter()` calls. After filtering, TypeScript knows the field is non-nullable.
 *
 * @param key - The property name to check for non-null
 * @returns A predicate function usable in `.filter()`
 *
 * @example
 * ```typescript
 * const withParticipant = orderedModels.filter(hasNonNullField('participant'));
 * // withParticipant[0].participant is now NonNullable
 * ```
 */
export function hasNonNullField<T, K extends keyof T>(key: K) {
  return (item: T): item is T & Record<K, NonNullable<T[K]>> => item[key] !== null && item[key] !== undefined;
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
}).strict();

export type TextPart = z.infer<typeof TextPartSchema>;

export function isTextPart(
  value: unknown,
): value is { type: typeof MessagePartTypes.TEXT; text: string } {
  return TextPartSchema.safeParse(value).success;
}
