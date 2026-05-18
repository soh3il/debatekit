/**
 * Core Date Transformation Utilities
 *
 * Shared date conversion utilities used by both API and Web apps.
 * Entity-specific transforms remain in each app due to different type requirements.
 */

/**
 * Ensure value is a Date object (convert string if needed)
 *
 * @param value - String or Date value
 * @returns Date object
 */
export function ensureDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/**
 * Ensure nullable value is a Date object or null
 *
 * @param value - String, Date, or null value
 * @returns Date object or null
 */
export function ensureDateOrNull(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  return ensureDate(value);
}

/**
 * Convert Date or string to ISO string (for cache serialization)
 *
 * @param value - Date or string value
 * @returns ISO string
 */
export function toISOString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Convert nullable Date or string to ISO string or null
 *
 * @param value - Date, string, or null value
 * @returns ISO string or null
 */
export function toISOStringOrNull(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toISOString(value);
}
