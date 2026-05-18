/**
 * Date Validation Utilities
 *
 * Generic date validation shared across API and web.
 */

/**
 * Check if a date is valid.
 */
export function isValidDate(date: Date | string | number): boolean {
  const dateObj = new Date(date);
  return !Number.isNaN(dateObj.getTime());
}
