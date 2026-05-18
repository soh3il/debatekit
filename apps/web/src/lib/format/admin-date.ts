/**
 * Admin Date Formatting Utilities
 *
 * Centralized Eastern Time date formatting for admin pages.
 * Single source of truth for all ET-based date/time display.
 */

import { isValidDate } from '@debatekit/shared/lib';

const ET_TIMEZONE = 'America/New_York';
const LOCALE = 'en-US';

/**
 * Format a date in Eastern Time (date only).
 * Example: "Feb 26, 2026"
 */
export function formatDateET(date: Date | string | number) {
  if (!isValidDate(date)) {
    return 'Invalid Date';
  }
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    timeZone: ET_TIMEZONE,
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Format a date+time in Eastern Time with timezone abbreviation.
 * Example: "Feb 26, 2026, 3:45 PM EST"
 */
export function formatDateTimeET(date: Date | string | number) {
  if (!isValidDate(date)) {
    return 'Invalid Date';
  }
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: ET_TIMEZONE,
    timeZoneName: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Format time only in Eastern Time with timezone abbreviation.
 * Example: "3:45 PM EST"
 */
export function formatTimeET(date: Date | string | number) {
  if (!isValidDate(date)) {
    return 'Invalid Date';
  }
  return new Intl.DateTimeFormat(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ET_TIMEZONE,
    timeZoneName: 'short',
  }).format(new Date(date));
}

/**
 * Get the ET hour (0-23) from a date string.
 * Useful for rush-hour window detection.
 */
export function getETHour(date: Date | string | number) {
  return Number(
    new Intl.DateTimeFormat(LOCALE, {
      hour: 'numeric',
      hour12: false,
      timeZone: ET_TIMEZONE,
    }).format(new Date(date)),
  );
}
