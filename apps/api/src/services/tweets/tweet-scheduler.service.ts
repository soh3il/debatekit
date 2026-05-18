/**
 * Tweet Scheduler Service - Timezone-aware scheduling for US/Canada rush hours
 *
 * Calculates optimal posting times based on Eastern Time rush hour windows.
 * Uses pure date math with no external dependencies.
 * Compatible with Cloudflare Workers runtime (no Intl API dependency).
 *
 * Rush Hour Windows (Eastern Time):
 * - Morning: 9:00-10:00 AM ET
 * - Lunch: 12:00-1:00 PM ET
 * - Evening: 5:00-6:00 PM ET
 */

import { z } from 'zod';

// ============================================================================
// RUSH HOUR LABEL (5-part enum pattern)
// ============================================================================

/** 1. Array constant */
export const RUSH_HOUR_LABEL_VALUES = ['morning', 'lunch', 'evening'] as const;

/** 2. Zod schema */
export const RushHourLabelSchema = z.enum(RUSH_HOUR_LABEL_VALUES);

/** 3. TypeScript type */
export type RushHourLabel = z.infer<typeof RushHourLabelSchema>;

/** 4. Default value */
export const DEFAULT_RUSH_HOUR_LABEL: RushHourLabel = 'morning';

/** 5. Constant object */
export const RushHourLabels = {
  EVENING: 'evening',
  LUNCH: 'lunch',
  MORNING: 'morning',
} as const;

// ============================================================================
// RUSH HOUR WINDOW SCHEMA
// ============================================================================

export const RushHourWindowSchema = z.object({
  label: RushHourLabelSchema,
  startHour: z.number().int().min(0).max(23),
});

export type RushHourWindow = z.infer<typeof RushHourWindowSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Rush hour windows defined in Eastern Time hours (24h format) */
export const RUSH_HOUR_WINDOWS: readonly [RushHourWindow, ...RushHourWindow[]] = [
  { label: 'morning', startHour: 9 },
  { label: 'lunch', startHour: 12 },
  { label: 'evening', startHour: 17 },
];

/** Each window lasts 1 hour */
export const WINDOW_DURATION_HOURS = 1;

/** Maximum random jitter within a window (minutes) */
export const MAX_JITTER_MINUTES = 45;

/** EST offset from UTC in hours */
const EST_OFFSET = -5;

/** EDT offset from UTC in hours */
const EDT_OFFSET = -4;

/** Milliseconds in one hour */
const MS_PER_HOUR = 3_600_000;

/** Milliseconds in one minute */
const MS_PER_MINUTE = 60_000;

/** Milliseconds in one day */
const MS_PER_DAY = 86_400_000;

// ============================================================================
// DST DETECTION
// ============================================================================

/**
 * Determine whether a given UTC date falls within Eastern Daylight Time (EDT).
 *
 * EDT runs from the second Sunday of March at 2:00 AM ET
 * to the first Sunday of November at 2:00 AM ET.
 *
 * This uses pure date math without the Intl API for Workers compatibility.
 */
function isEDT(date: Date) {
  const year = date.getUTCFullYear();

  // Second Sunday of March at 2:00 AM EST (7:00 AM UTC)
  // March 1 dayOfWeek, then find second Sunday
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const marchFirstDay = marchFirst.getUTCDay(); // 0=Sun
  const daysToFirstSunday = marchFirstDay === 0 ? 0 : 7 - marchFirstDay;
  const secondSundayMarch = 1 + daysToFirstSunday + 7;
  // Transition at 2:00 AM EST = 7:00 AM UTC
  const edtStart = Date.UTC(year, 2, secondSundayMarch, 7, 0, 0);

  // First Sunday of November at 2:00 AM EDT (6:00 AM UTC)
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const novFirstDay = novFirst.getUTCDay();
  const firstSundayNov = novFirstDay === 0 ? 1 : 1 + (7 - novFirstDay);
  // Transition at 2:00 AM EDT = 6:00 AM UTC
  const edtEnd = Date.UTC(year, 10, firstSundayNov, 6, 0, 0);

  const ts = date.getTime();
  return ts >= edtStart && ts < edtEnd;
}

// ============================================================================
// TIMEZONE HELPERS
// ============================================================================

/**
 * Get the current Eastern Time offset from UTC.
 * Handles DST automatically: EST = UTC-5, EDT = UTC-4.
 */
function getEasternTimeOffset(date: Date) {
  return isEDT(date) ? EDT_OFFSET : EST_OFFSET;
}

/**
 * Convert a UTC date to Eastern Time components.
 */
function toEasternTime(date: Date) {
  const offset = getEasternTimeOffset(date);
  const etMs = date.getTime() + offset * MS_PER_HOUR;
  const etDate = new Date(etMs);

  return {
    date: etDate,
    hours: etDate.getUTCHours(),
    minutes: etDate.getUTCMinutes(),
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if a given UTC date falls within a rush hour window.
 *
 * Windows are 1 hour each:
 * - Morning: 9:00-10:00 AM ET
 * - Lunch: 12:00-1:00 PM ET
 * - Evening: 5:00-6:00 PM ET
 */
export function isRushHour(date: Date) {
  const et = toEasternTime(date);

  return RUSH_HOUR_WINDOWS.some(
    window =>
      et.hours >= window.startHour
      && et.hours < window.startHour + WINDOW_DURATION_HOURS,
  );
}

/**
 * Get the next available rush hour slot from a given date.
 * Adds random jitter (0-45 minutes) within the window to avoid
 * all tweets posting at the top of the hour.
 *
 * If the current time is already within a rush hour window,
 * returns the next future window instead.
 */
export function getNextRushHourSlot(fromDate?: Date) {
  const now = fromDate ?? new Date();
  const offset = getEasternTimeOffset(now);

  // Convert current time to ET for comparison
  const et = toEasternTime(now);
  const currentEtHours = et.hours;
  const currentEtMinutes = et.minutes;

  // Try today first, then tomorrow, up to 2 days out (covers all edge cases)
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const window of RUSH_HOUR_WINDOWS) {
      // Skip windows that have already passed today
      if (dayOffset === 0) {
        if (
          currentEtHours > window.startHour
          || (currentEtHours === window.startHour
            && currentEtMinutes >= MAX_JITTER_MINUTES)
        ) {
          continue;
        }
      }

      // Calculate UTC time for the start of this window
      // Use ET date (not UTC date from `now`) to avoid off-by-one when UTC date != ET date
      // (happens nightly between midnight UTC and ~4-5 AM UTC = 7-8 PM ET to midnight ET)
      const baseDate = new Date(et.date);
      baseDate.setUTCHours(window.startHour - offset, 0, 0, 0);

      if (dayOffset > 0) {
        baseDate.setTime(baseDate.getTime() + dayOffset * MS_PER_DAY);
      }

      // Recalculate offset for the target date (DST may differ)
      const targetOffset = getEasternTimeOffset(baseDate);
      if (targetOffset !== offset) {
        baseDate.setUTCHours(window.startHour - targetOffset, 0, 0, 0);
      }

      // Add random jitter (0 to MAX_JITTER_MINUTES minutes)
      const jitterMs = Math.floor(Math.random() * MAX_JITTER_MINUTES) * MS_PER_MINUTE;
      const scheduledTime = new Date(baseDate.getTime() + jitterMs);

      // Ensure the slot is in the future
      if (scheduledTime.getTime() > now.getTime()) {
        return scheduledTime;
      }
    }
  }

  // Fallback: should never reach here, but return tomorrow morning as safety
  const tomorrow = new Date(now.getTime() + MS_PER_DAY);
  const tomorrowOffset = getEasternTimeOffset(tomorrow);
  tomorrow.setUTCHours(RUSH_HOUR_WINDOWS[0].startHour - tomorrowOffset, 0, 0, 0);
  return tomorrow;
}

/**
 * Get all rush hour slots for the next N slots.
 * Useful for UI to show available scheduling options.
 *
 * Returns deterministic results (no jitter) for display purposes.
 * Jitter is only applied at actual scheduling time via getNextRushHourSlot.
 */
export function getUpcomingRushHourSlots(count: number, fromDate?: Date) {
  const slots: Date[] = [];
  const now = fromDate ?? new Date();

  // Use ET date as base to avoid off-by-one when UTC date != ET date
  const et = toEasternTime(now);
  let dayOffset = 0;

  while (slots.length < count) {
    const offset = getEasternTimeOffset(now);

    for (const window of RUSH_HOUR_WINDOWS) {
      if (slots.length >= count) {
        break;
      }

      // Build the UTC time for this window's start using ET date base
      const slotDate = new Date(et.date);
      if (dayOffset > 0) {
        slotDate.setTime(slotDate.getTime() + dayOffset * MS_PER_DAY);
      }
      slotDate.setUTCHours(window.startHour - offset, 0, 0, 0);

      // Recalculate offset in case DST boundary differs
      const slotOffset = getEasternTimeOffset(slotDate);
      if (slotOffset !== offset) {
        slotDate.setUTCHours(window.startHour - slotOffset, 0, 0, 0);
      }

      // Only include future slots
      if (slotDate.getTime() > now.getTime()) {
        slots.push(slotDate);
      }
    }

    dayOffset++;

    // Safety valve: prevent infinite loop
    if (dayOffset > count + 30) {
      break;
    }
  }

  return slots;
}
