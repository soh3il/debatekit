import type { DebugData, DevLogLevel, RlogCategory, RlogStreamAction } from '@debatekit/shared';
import { DevLogLevels, RLOG_CATEGORY_STYLES, RlogCategories } from '@debatekit/shared';
import { WebAppEnvs } from '@debatekit/shared/enums';
// Shared logger formatting utilities from the shared package
// Note: Local formatDebugValue uses 10 char truncation vs 20 chars in shared
import { formatLogData as sharedFormatLogData } from '@debatekit/shared/lib/logger';

import { getWebappEnv } from '@/lib/config/base-urls';

import { safeStorageRemove, safeStorageSet } from './safe-storage';

// Re-export shared utility for external use (verifies shared package is accessible)
export { sharedFormatLogData };

// ============================================================================
// ENVIRONMENT DETECTION (defined early for use throughout file)
// ============================================================================

// Enable client-side logging in development AND preview environments (not production)
// Uses hostname-based detection for reliable env detection on client
function getIsDev(): boolean {
  const env = getWebappEnv();
  return env === WebAppEnvs.LOCAL || env === WebAppEnvs.PREVIEW;
}

const isDev = getIsDev();

// rlogEnabled must be defined early since it's used in functions defined before the main rlog object
let rlogEnabled = isDev;

/**
 * Module-level constant for guarding highest-frequency rlog call sites.
 * Use `if (RLOG_ENABLED)` before template literal rlog calls in hot paths
 * to skip string interpolation in production.
 */
export const RLOG_ENABLED = isDev;

type LogEntry = {
  key: string;
  level: DevLogLevel;
  message: string;
  data?: string;
  count: number;
  lastTime: number;
};

type UpdateTracker = {
  count: number;
  windowStart: number;
};

const DEBOUNCE_MS = 500;
const UPDATE_WINDOW_MS = 1000;
const EXCESSIVE_UPDATE_THRESHOLD = 10;

// ============================================================================
// RENDER COUNT TRACKING - For diagnosing over-rendering
// ============================================================================

type RenderCountEntry = {
  count: number;
  windowStart: number;
  lastRender: number;
};

const renderCounts = new Map<string, RenderCountEntry>();
const RENDER_COUNT_WINDOW_MS = 30000; // 30 second window
const PERF_MILESTONES = new Set([50, 200, 500]); // Only log at these counts

// Track total renders for summary
let totalRenders = 0;
let summaryIntervalId: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// TIERED LOGGING SYSTEM
// Goal: Reduce console noise from 200+ logs to <50 per round
// ============================================================================

const LOG_DEDUPE_WINDOW_MS = 3000; // Collapse logs within 3 second window

// ============================================================================
// DEBOUNCED LOGGING WITH COUNTS - rlog.debounced
// ============================================================================

type DebouncedLogEntry = {
  count: number;
  lastLog: number;
  lastMessage: string;
};

const debouncedRenderCounts = new Map<string, DebouncedLogEntry>();
const DEBOUNCED_LOG_MS = 2000;

/**
 * Debounced logging with counts.
 * Groups rapid logs within 500ms window and shows count when they fire.
 *
 * @example
 * rlog.debounced('TRIGGER', 'submit', 'user clicked send');
 * // If called 5 times in 500ms, logs: "[TRIGGER] submit: user clicked send (x5)"
 */
function logDebounced(category: string, key: string, message: string): void {
  if (!rlogEnabled) {
    return;
  }

  const cacheKey = `${category}:${key}`;
  const now = Date.now();
  const existing = debouncedRenderCounts.get(cacheKey);

  if (existing && now - existing.lastLog < DEBOUNCED_LOG_MS) {
    existing.count++;
    existing.lastMessage = message;
    return; // Debounce - don't log yet
  }

  // Time to log
  const count = existing?.count ?? 1;
  const countSuffix = count > 1 ? ` (x${count})` : '';

  // eslint-disable-next-line no-console
  console.log(
    `%c[${category}] ${key}: ${message}${countSuffix}`,
    RLOG_CATEGORY_STYLES[category as RlogCategory] || 'color: #9E9E9E',
  );

  debouncedRenderCounts.set(cacheKey, { count: 1, lastLog: now, lastMessage: message });
}

// ============================================================================
// STREAMING DIAGNOSTIC LOGGER - createDebouncedStreamLogger
// ============================================================================

type StreamLogBuffer = {
  buffer: string[];
  timeoutId: ReturnType<typeof setTimeout> | null;
};

const streamLogBuffers = new Map<string, StreamLogBuffer>();

/**
 * Extract the action type from a stream log message.
 * Matches patterns like "r0 onReasoningChunk(0, 5chars)" -> "onReasoningChunk"
 * or "r0 type=text-delta" -> "type=text-delta"
 * or "r0 p0 delta=5chars total=120 phase=streaming" -> "delta"
 */
// Pre-compiled regex patterns for stream action extraction (avoid per-call compilation)
const RE_CALLBACK = /r\d+\s+(on\w+)\(/;
const RE_CHARS = /(\d+)chars/;
const RE_DELTA = /r\d+\s+p\d+\s+(delta)=(\d+)chars/;
const RE_TYPE = /r\d+\s+(type=\S+)/;

function extractStreamAction(message: string): { action: string; chars: number } {
  // Match callback-style: "rN onSomething(...)"
  const callbackMatch = RE_CALLBACK.exec(message);
  if (callbackMatch?.[1]) {
    // Extract char count from patterns like "5chars)" or ", 5chars)"
    const charMatch = RE_CHARS.exec(message);
    return { action: callbackMatch[1], chars: charMatch?.[1] ? Number(charMatch[1]) : 0 };
  }

  // Match delta-style: "rN pN delta=5chars"
  const deltaMatch = RE_DELTA.exec(message);
  if (deltaMatch?.[1] && deltaMatch[2]) {
    return { action: deltaMatch[1], chars: Number(deltaMatch[2]) };
  }

  // Match type-style: "rN type=something"
  const typeMatch = RE_TYPE.exec(message);
  if (typeMatch?.[1]) {
    return { action: typeMatch[1], chars: 0 };
  }

  // Fallback: use the whole message (trimmed)
  return { action: message.slice(0, 40), chars: 0 };
}

/**
 * Summarize a batch of stream log messages by action type.
 * Instead of joining all messages, groups by action and shows counts + total chars.
 *
 * @example
 * // Input: ["r1 onReasoningChunk(0, 5chars)", "r1 onReasoningChunk(0, 3chars)", "r1 onParticipantChunk(0, 10chars)"]
 * // Output: "onReasoningChunk: 2x (8 total chars) | onParticipantChunk: 1x (10 total chars)"
 */
function summarizeStreamBatch(messages: string[]): string {
  const groups = new Map<string, { count: number; totalChars: number }>();

  for (const msg of messages) {
    const { action, chars } = extractStreamAction(msg);
    const existing = groups.get(action);
    if (existing) {
      existing.count++;
      existing.totalChars += chars;
    } else {
      groups.set(action, { count: 1, totalChars: chars });
    }
  }

  const parts: string[] = [];
  for (const [action, { count, totalChars }] of groups) {
    const charsSuffix = totalChars > 0 ? ` (${totalChars} total chars)` : '';
    parts.push(`${action}: ${count}x${charsSuffix}`);
  }

  return parts.join(' | ');
}

/**
 * Create a debounced logger for streaming diagnostics.
 * Batches rapid log messages and outputs a compact summary grouped by action type.
 *
 * @param label - Unique label for this logger (e.g., 'onData', 'delta', 'callback')
 * @param delay - Debounce delay in ms (default: 100)
 * @returns A function that accepts a message string
 *
 * @example
 * const logCallback = createDebouncedStreamLogger('callback', 100);
 * logCallback(`r1 onReasoningChunk(0, 5chars)`);
 * logCallback(`r1 onReasoningChunk(0, 3chars)`);
 * logCallback(`r1 onParticipantChunk(0, 10chars)`);
 * // After 100ms: "[STREAM] callback: [batched 3] onReasoningChunk: 2x (8 total chars) | onParticipantChunk: 1x (10 total chars)"
 */
export function createDebouncedStreamLogger(label: string, delay = 100): (message: string) => void {
  return (message: string): void => {
    if (!rlogEnabled) {
      return;
    }

    let entry = streamLogBuffers.get(label);
    if (!entry) {
      entry = { buffer: [], timeoutId: null };
      streamLogBuffers.set(label, entry);
    }

    entry.buffer.push(message);

    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }

    // Capture entry reference for use in setTimeout callback
    const currentEntry = entry;
    currentEntry.timeoutId = setTimeout(() => {
      const bufferCopy = [...currentEntry.buffer];
      currentEntry.buffer = [];
      currentEntry.timeoutId = null;

      if (bufferCopy.length === 0) {
        return;
      }

      const summary = summarizeStreamBatch(bufferCopy);

      // eslint-disable-next-line no-console
      console.log(
        `%c[STREAM] ${label}: [batched ${bufferCopy.length}] ${summary}`,
        'color: #00BCD4; font-style: italic',
      );
    }, delay);
  };
}

/**
 * Clear all stream log buffers and cancel pending flush timers.
 * Call at round completion to reset all stream-related logging state.
 *
 * @example
 * // In round completion handler:
 * clearStreamLoggers();
 */
export function clearStreamLoggers(): void {
  for (const [, entry] of streamLogBuffers.entries()) {
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
  }
  streamLogBuffers.clear();
}

// ============================================================================
// DEBOUNCE MECHANISM - Reduces rapid repeated logs
// ============================================================================
const debouncedLogs = new Map<string, { lastTime: number; count: number; lastMessage: string }>();
const RAPID_LOG_DEBOUNCE_MS = 2000;

/**
 * Check if a log should fire based on debounce timing.
 * Returns { shouldLog: true, suppressedCount: N } if log should fire.
 * Returns { shouldLog: false } if log is suppressed.
 *
 * When shouldLog is true after suppression, caller can append "(+N suppressed)" to message.
 */
function shouldLogDebounced(key: string, message: string): { shouldLog: boolean; suppressedCount: number } {
  const now = Date.now();
  const state = debouncedLogs.get(key);

  if (!state || now - state.lastTime >= RAPID_LOG_DEBOUNCE_MS) {
    // First log or debounce window expired - log immediately
    const suppressedCount = state?.count ?? 0;
    debouncedLogs.set(key, { count: 0, lastMessage: message, lastTime: now });
    return { shouldLog: true, suppressedCount };
  }

  // Within debounce window - suppress and count
  state.count++;
  state.lastMessage = message;
  return { shouldLog: false, suppressedCount: 0 };
}

// ============================================================================
// BATCHED TRACE LOGGING - Accumulates high-frequency events and logs summaries
// ============================================================================
type TraceBatchEntry = {
  count: number;
  windowStart: number;
  lastDetails: string[];
};

const TRACE_BATCH_WINDOW_MS = 1000; // Accumulate events for 1 second
const TRACE_MAX_DETAILS = 3; // Keep last N details for context

const traceBatches = new Map<string, TraceBatchEntry>();
const traceFlushTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Batched trace logging for high-frequency events.
 * Accumulates events within a time window and logs a summary instead of each individual event.
 *
 * @example
 * // Instead of 50 logs like "[STUCK] TRACE-onData: r0 RAW: {...}"
 * // You get: "[TRACE] onData: 50 events in 1000ms (last: r0 RAW: {...})"
 */
function logTraceBatched(category: string, detail: string): void {
  // Use isDev check here since rlogEnabled is defined later in file
  // This is fine since trace logging is specifically for dev debugging
  if (!getIsDev()) {
    return;
  }

  const now = Date.now();
  const entry = traceBatches.get(category);

  if (!entry || now - entry.windowStart >= TRACE_BATCH_WINDOW_MS) {
    // New batch window - clear any existing timer and start fresh
    const existingTimer = traceFlushTimers.get(category);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    traceBatches.set(category, {
      count: 1,
      lastDetails: [detail],
      windowStart: now,
    });

    // Schedule flush at end of window
    const timer = setTimeout(() => {
      flushTraceBatch(category);
    }, TRACE_BATCH_WINDOW_MS);
    traceFlushTimers.set(category, timer);
    return;
  }

  // Add to existing batch
  entry.count++;
  entry.lastDetails.push(detail);
  if (entry.lastDetails.length > TRACE_MAX_DETAILS) {
    entry.lastDetails.shift();
  }
}

function flushTraceBatch(category: string): void {
  const entry = traceBatches.get(category);
  if (!entry || entry.count === 0) {
    return;
  }

  const duration = Date.now() - entry.windowStart;
  const lastDetail = entry.lastDetails[entry.lastDetails.length - 1] || '';

  // eslint-disable-next-line no-console
  console.log(
    `%c[TRACE] ${category}: ${entry.count} events in ${duration}ms (last: ${lastDetail.substring(0, 80)}${lastDetail.length > 80 ? '...' : ''})`,
    'color: #9E9E9E; font-style: italic',
  );

  traceBatches.delete(category);
  traceFlushTimers.delete(category);
}

type DedupeEntry = {
  count: number;
  firstTime: number;
  lastTime: number;
  lastArgs: string;
  reported: boolean;
};

// Track previous values for value-change detection (FLOW tier)
const prevValuesMap = new Map<string, string>();

const dedupeMap = new Map<string, DedupeEntry>();
const throttleMap = new Map<string, number>(); // category -> lastLogTime

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

// TIER 1: CRITICAL - Always log immediately (never dedupe)
// These are essential for debugging race conditions, state issues, errors
const CRITICAL_CATEGORIES = new Set([
  'phase-transition',
  'round-complete',
  'pcount-mismatch',
  'race-detected',
  'round-ref-lag',
  'state-desync',
  'stuck',
  'error',
  'handoff',
  'submit',
  'frame',
  'race',
]);

// TIER 2: FLOW - Log on state changes only (dedupe by value)
// Important for understanding flow, but only when values change
const FLOW_CATEGORIES = new Set([
  'phase',
  'gate',
  'trigger',
  'changelog',
]);

// TIER 3: DEBUG - Heavily throttled (2000ms minimum between same logs)
// Useful for debugging but generates too much noise at full speed
const DEBUG_CATEGORIES = new Set([
  'stream',
  'mod',
  'init',
  'msg',
  'sync',
  'presrch',
  'resume',
]);

// TIER 4: SILENT - Don't log unless explicitly enabled via localStorage
// High-frequency, low-value logs that obscure debugging
const SILENT_CATEGORIES = new Set([
  'chunk',
  'render-state',
  'query-render',
  'stream-append',
]);

// Throttle interval for DEBUG tier (2 seconds)
const DEBUG_THROTTLE_MS = 2000;

// ============================================================================
// VERBOSE FLAGS - Enable for deep debugging specific subsystems
// ============================================================================

/**
 * When true, logs ALL resume-related events including expected disabled states.
 * Default false - only logs state changes, actual resumptions, and errors.
 * Enable via: rlog.setVerboseResume(true) or localStorage.set('rlog_verbose_resume', '1')
 */
let VERBOSE_RESUME = typeof localStorage !== 'undefined'
  ? localStorage.getItem('rlog_verbose_resume') === '1'
  : false;

export function setVerboseResume(enabled: boolean): void {
  VERBOSE_RESUME = enabled;
  if (typeof localStorage !== 'undefined') {
    if (enabled) {
      localStorage.setItem('rlog_verbose_resume', '1');
    } else {
      localStorage.removeItem('rlog_verbose_resume');
    }
  }
}

export function isVerboseResumeEnabled(): boolean {
  return VERBOSE_RESUME;
}

/**
 * Enable verbose logging for a specific category (SILENT tier).
 * Useful for debugging specific subsystems without enabling all logs.
 *
 * @example
 * enableVerboseCategory('chunk'); // Enable chunk logging
 * disableVerboseCategory('chunk'); // Disable chunk logging
 */
export function enableVerboseCategory(category: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`rlog_verbose_${category}`, '1');
    // eslint-disable-next-line no-console
    console.log(`%c[RLOG] Verbose logging enabled for: ${category}`, 'color: #4CAF50');
  }
}

export function disableVerboseCategory(category: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(`rlog_verbose_${category}`);
    // eslint-disable-next-line no-console
    console.log(`%c[RLOG] Verbose logging disabled for: ${category}`, 'color: #FF5722');
  }
}

function isVerboseCategoryEnabled(category: string): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(`rlog_verbose_${category}`) === '1';
}

function shouldLogWithDedupe(category: string, message: string, key?: string): { shouldLog: boolean; suffix?: string } {
  // Extract base category (e.g., 'INIT-url' → 'init') for tier matching
  const baseCategory = (category.split('-')[0] ?? category).toLowerCase();

  // TIER 1: Critical - always log immediately
  if (CRITICAL_CATEGORIES.has(baseCategory)) {
    return { shouldLog: true };
  }

  // TIER 4: Silent - check localStorage flag before logging
  if (SILENT_CATEGORIES.has(baseCategory)) {
    if (!isVerboseCategoryEnabled(baseCategory)) {
      return { shouldLog: false };
    }
  }

  // Skip logs with no debugging value
  if (message.includes('APPEND') || message.includes('SKIP:')) {
    return { shouldLog: false };
  }

  const now = Date.now();
  const dedupeKey = `${category}:${message.slice(0, 60)}`; // Shorter key for faster lookup

  // TIER 2: Flow - dedupe by value change only
  if (FLOW_CATEGORIES.has(baseCategory) && key) {
    const valueKey = `${category}:${key}`;
    const prevValue = prevValuesMap.get(valueKey);
    if (prevValue === message) {
      return { shouldLog: false };
    }
    prevValuesMap.set(valueKey, message);
    return { shouldLog: true };
  }

  // TIER 3: Debug - heavy throttling (2000ms between ANY logs in this category)
  if (DEBUG_CATEGORIES.has(baseCategory)) {
    const lastLog = throttleMap.get(baseCategory) ?? 0;
    if (now - lastLog < DEBUG_THROTTLE_MS) {
      return { shouldLog: false };
    }
    throttleMap.set(baseCategory, now);
    return { shouldLog: true };
  }

  // Standard deduplication for remaining categories
  const entry = dedupeMap.get(dedupeKey);
  if (!entry || now - entry.lastTime > LOG_DEDUPE_WINDOW_MS) {
    dedupeMap.set(dedupeKey, { count: 1, firstTime: now, lastArgs: message, lastTime: now, reported: false });
    return { shouldLog: true };
  }

  entry.count++;
  entry.lastTime = now;
  return { shouldLog: false };
}

/**
 * Prune a Map to a maximum size by removing the oldest entries.
 * Uses a provided accessor to determine age. Removes oldest entries first.
 */
function pruneMapByAge<K, V>(map: Map<K, V>, maxSize: number, getTime: (v: V) => number): void {
  if (map.size <= maxSize) {
    return;
  }
  const sorted = [...map.entries()].sort((a, b) => getTime(a[1]) - getTime(b[1]));
  const toRemove = sorted.length - maxSize;
  for (let i = 0; i < toRemove; i++) {
    const entry = sorted[i];
    if (entry) {
      map.delete(entry[0]);
    }
  }
}

const MAX_MAP_ENTRIES = 100;
const RLOG_DEBOUNCE_MS = 100; // Reduced from 300ms for snappier logs
const rlogDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const rlogLastLogged: Record<string, string> = {};

// Periodic cleanup of old entries (runs every 10 seconds)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = LOG_DEDUPE_WINDOW_MS * 5;

    // Clean dedupeMap
    for (const [key, entry] of dedupeMap.entries()) {
      if (now - entry.lastTime > staleThreshold) {
        dedupeMap.delete(key);
      }
    }

    // Clean debouncedLogs (stale after 30 seconds)
    const debounceStaleThreshold = 30000;
    for (const [key, entry] of debouncedLogs.entries()) {
      if (now - entry.lastTime > debounceStaleThreshold) {
        debouncedLogs.delete(key);
      }
    }

    // Clean streamLogBuffers - remove entries with empty buffers and no pending timer
    for (const [key, entry] of streamLogBuffers.entries()) {
      if (entry.buffer.length === 0 && entry.timeoutId === null) {
        streamLogBuffers.delete(key);
      }
    }

    // Clean debouncedRenderCounts (stale after 30 seconds)
    for (const [key, entry] of debouncedRenderCounts.entries()) {
      if (now - entry.lastLog > debounceStaleThreshold) {
        debouncedRenderCounts.delete(key);
      }
    }

    // Clean traceBatches and traceFlushTimers (stale after 5 seconds)
    const traceStaleThreshold = 5000;
    for (const [key, entry] of traceBatches.entries()) {
      if (now - entry.windowStart > traceStaleThreshold) {
        traceBatches.delete(key);
        const timer = traceFlushTimers.get(key);
        if (timer) {
          clearTimeout(timer);
          traceFlushTimers.delete(key);
        }
      }
    }

    // Clean throttleMap (stale after 10 seconds)
    for (const [key, lastTime] of throttleMap.entries()) {
      if (now - lastTime > 10000) {
        throttleMap.delete(key);
      }
    }

    // Clean prevValuesMap (cap size only - no timestamp available)
    pruneMapByAge(prevValuesMap, MAX_MAP_ENTRIES, () => 0);

    // Clean rlogDebounceTimers - remove completed timer references
    for (const key of Object.keys(rlogDebounceTimers)) {
      // Timer references that have already fired are stale; remove them
      // by checking if a matching rlogLastLogged entry exists and is old
      if (rlogLastLogged[key]) {
        // Keep the entry only if it was recently set (within debounce window)
        // Otherwise clean both timer ref and last-logged ref
        delete rlogDebounceTimers[key];
      }
    }

    // Clean rlogLastLogged (cap size)
    const lastLoggedKeys = Object.keys(rlogLastLogged);
    if (lastLoggedKeys.length > MAX_MAP_ENTRIES) {
      const toRemove = lastLoggedKeys.length - MAX_MAP_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        const key = lastLoggedKeys[i];
        if (key) {
          delete rlogLastLogged[key];
        }
      }
    }

    // Size limit enforcement for all Maps
    pruneMapByAge(dedupeMap, MAX_MAP_ENTRIES, v => v.lastTime);
    pruneMapByAge(debouncedLogs, MAX_MAP_ENTRIES, v => v.lastTime);
    pruneMapByAge(debouncedRenderCounts, MAX_MAP_ENTRIES, v => v.lastLog);
    pruneMapByAge(traceBatches, MAX_MAP_ENTRIES, v => v.windowStart);
    pruneMapByAge(throttleMap, MAX_MAP_ENTRIES, v => v);
    pruneMapByAge(streamLogBuffers, MAX_MAP_ENTRIES, () => 0);
  }, 10000);
}

const logCache = new Map<string, LogEntry>();
const updateCounts = new Map<string, UpdateTracker>();

/* eslint-disable no-console */
function getConsoleMethod(level: DevLogLevel): typeof console.debug {
  const consoleMethodMap: Record<DevLogLevel, typeof console.debug> = {
    [DevLogLevels.DEBUG]: console.debug.bind(console),
    [DevLogLevels.ERROR]: console.error.bind(console),
    [DevLogLevels.INFO]: console.info.bind(console),
    [DevLogLevels.WARN]: console.warn.bind(console),
  };
  return consoleMethodMap[level];
}

function logWarning(message: string): void {
  console.log(`%c${message}`, RLOG_CATEGORY_STYLES[RlogCategories.PERF]);
}
/* eslint-enable no-console */

function debouncedLog(
  key: string,
  level: DevLogLevel,
  message: string,
  data?: string,
): void {
  if (!isDev) {
    return;
  }

  const now = Date.now();
  const cached = logCache.get(key);

  if (cached && now - cached.lastTime < DEBOUNCE_MS) {
    cached.count++;
    return;
  }

  if (cached && cached.count > 1) {
    const cachedLogFn = getConsoleMethod(cached.level);
    const msg = `[DEV] ${cached.message} (×${cached.count} in ${DEBOUNCE_MS}ms)`;
    if (cached.data) {
      cachedLogFn(msg, cached.data);
    } else {
      cachedLogFn(msg);
    }
  }

  const logFn = getConsoleMethod(level);
  const logMsg = `[DEV:${key}] ${message}`;
  if (data !== undefined) {
    logFn(logMsg, data);
  } else {
    logFn(logMsg);
  }

  logCache.set(key, {
    count: 1,
    data,
    key,
    lastTime: now,
    level,
    message,
  });
}

function trackUpdate(key: string): { count: number; isExcessive: boolean } {
  if (!isDev) {
    return { count: 0, isExcessive: false };
  }

  const now = Date.now();
  const entry = updateCounts.get(key);

  if (!entry || now - entry.windowStart > UPDATE_WINDOW_MS) {
    updateCounts.set(key, { count: 1, windowStart: now });
    return { count: 1, isExcessive: false };
  }

  entry.count++;
  const isExcessive = entry.count > EXCESSIVE_UPDATE_THRESHOLD;

  if (isExcessive && entry.count === EXCESSIVE_UPDATE_THRESHOLD + 1) {
    logWarning(
      `[DEV:EXCESSIVE] ${key} (x${entry.count}) in ${UPDATE_WINDOW_MS}ms`,
    );
  }

  return { count: entry.count, isExcessive };
}

function formatDebugValue(key: string, value: string | number | boolean | null | undefined): string {
  if (typeof value === 'boolean') {
    return `${key}=${value ? 1 : 0}`;
  }
  if (typeof value === 'number') {
    return `${key}=${value}`;
  }
  if (typeof value === 'string') {
    return `${key}=${value.length > 10 ? `${value.slice(0, 10)}…` : value}`;
  }
  if (value === null || value === undefined) {
    return `${key}=-`;
  }
  return `${key}=?`;
}

function getRlogStyle(category: RlogCategory): string {
  return RLOG_CATEGORY_STYLES[category];
}

function rlogLog(category: RlogCategory, key: string, message: string): void {
  if (!rlogEnabled) {
    return;
  }

  // Skip empty threadId resume logs
  if (key === 'resume' && message.includes('tid= ')) {
    return;
  }

  // Use tier-based deduplication system (pass key for value-change detection)
  const dedupeCategory = `${category}-${key}`;
  const { shouldLog } = shouldLogWithDedupe(dedupeCategory, message, key);

  if (!shouldLog) {
    return;
  }

  const logKey = `${category}:${key}`;
  const fullMessage = `[${category}] ${message}`;

  // Skip exact duplicate messages
  if (rlogLastLogged[logKey] === fullMessage) {
    return;
  }

  // Clear any pending debounce timer
  if (rlogDebounceTimers[logKey]) {
    clearTimeout(rlogDebounceTimers[logKey]);
  }

  // Use short debounce for snappier logs
  rlogDebounceTimers[logKey] = setTimeout(() => {
    rlogLastLogged[logKey] = fullMessage;
    delete rlogDebounceTimers[logKey]; // Clean up completed timer reference
    // eslint-disable-next-line no-console
    console.log(`%c${fullMessage}`, getRlogStyle(category));
  }, RLOG_DEBOUNCE_MS);
}

function rlogNow(category: RlogCategory, message: string): void {
  if (!rlogEnabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`%c[${category}] ${message}`, getRlogStyle(category));
}

/**
 * Frame descriptions from FLOW_DOCUMENTATION.md
 * Each frame represents a specific UI state in the round flow
 */
const FRAME_DESCRIPTIONS: Record<number, string> = {
  1: 'User Types Message on Overview Screen',
  10: 'Web Research Streaming (Blocks Participants)',
  11: 'Web Research Complete → Participants Start',
  12: 'Round 2 Complete',
  2: 'User Clicks Send → ALL Placeholders Appear Instantly',
  3: 'Participant 1 Starts Streaming (Others Still Waiting)',
  4: 'Participant 1 Complete → Participant 2 Starts',
  5: 'All Participants Complete → Moderator Starts',
  6: 'Round 1 Complete',
  7: 'User Enables Web Search + Changes Participants',
  8: 'Send Clicked → Changelog + All Placeholders Appear',
  9: 'Changelog Expanded (Click to See Details)',
};

export const rlog = {
  // ============================================================================
  // TIER 1: CRITICAL - Always log immediately (use rlogNow)
  // ============================================================================

  /** Changelog logging - important state changes */
  changelog: (action: string, detail: string): void => rlogLog(RlogCategories.CHANGELOG, action, `${action}: ${detail}`),

  /** Citation logging - tracks citation data flow through store */
  cite: (action: string, detail: string): void => rlogLog(RlogCategories.CITE, action, `${action}: ${detail}`),

  /**
   * Streaming diagnostic logger factory.
   * Creates a debounced logger for high-frequency streaming events.
   * Use this to diagnose streaming issues without flooding the console.
   *
   * @example
   * const logDelta = rlog.createStreamLogger('delta');
   * logDelta(`r0 p0 chars=50`);
   */
  createStreamLogger: createDebouncedStreamLogger,

  /**
   * Debounced logging with counts.
   * Groups rapid logs within 500ms window and shows count when they fire.
   *
   * @example
   * rlog.debounced('TRIGGER', 'submit', 'user clicked send');
   * // If called 5 times in 500ms, logs: "[TRIGGER] submit: user clicked send (x5)"
   */
  debounced: (category: string, key: string, message: string): void => {
    logDebounced(category, key, message);
  },

  disable: (): void => {
    rlogEnabled = false;
    safeStorageRemove('rlog', 'local');
  },

  disableVerbose: disableVerboseCategory,

  // ============================================================================
  // TIER 2: FLOW - Log on state changes only (use rlogLog with key)
  // ============================================================================

  enable: (): void => {
    rlogEnabled = true;
    safeStorageSet('rlog', '1', 'local');
    // eslint-disable-next-line no-console
    console.log('%c[RLOG] Debug logging enabled', 'color: #4CAF50; font-weight: bold');
  },

  /** Enable verbose logging for a specific silent category */
  enableVerbose: enableVerboseCategory,

  /** Flow logging (alias for resume) */
  flow: (key: string, detail: string): void => rlogLog(RlogCategories.RESUME, key, detail),

  /**
   * Frame-based logging for documenting round flow states
   * Frames 1-6: Round 1 flow (no web search)
   * Frames 7-12: Round 2 flow (with config changes + web search)
   */
  frame: (frameNumber: number, action: string, detail?: string): void => {
    const timestamp = Date.now() % 100000;
    const desc = FRAME_DESCRIPTIONS[frameNumber] || 'Unknown Frame';
    const msg = detail
      ? `[${timestamp}] Frame ${frameNumber}: ${desc} | ${action} | ${detail}`
      : `[${timestamp}] Frame ${frameNumber}: ${desc} | ${action}`;
    rlogNow(RlogCategories.FRAME, msg);
  },

  /** Gate check logging - logs on result change */
  gate: (check: string, result: string): void => rlogLog(RlogCategories.GATE, check, `${check}: ${result}`),

  // ============================================================================
  // TIER 3: DEBUG - Heavily throttled (2000ms between same logs)
  // ============================================================================

  /** Get/set verbose resume logging */
  getVerboseResume: isVerboseResumeEnabled,

  /** Participant handoff logging (P0 → P1 → P2 transitions) - debounced */
  handoff: (action: string, detail: string): void => {
    const debounceKey = `handoff:${action}`;
    const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
    if (shouldLog) {
      const suffix = suppressedCount > 0 ? ` (x${suppressedCount + 1})` : '';
      rlogNow(RlogCategories.HANDOFF, `${action}: ${detail}${suffix}`);
    }
  },

  /** Init logging - debounced to reduce noise from repeated renders */
  init: (action: string, detail: string): void => {
    const debounceKey = `init:${action}`;
    const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
    if (!shouldLog) {
      return;
    }
    const suffix = suppressedCount > 0 ? ` (+${suppressedCount} suppressed)` : '';
    rlogLog(RlogCategories.INIT, action, `${detail}${suffix}`);
  },

  isEnabled: (): boolean => rlogEnabled,

  /** Summary of deduplicated log counts - useful at end of rounds */
  logDedupeStats: (): void => {
    if (!rlogEnabled) {
      return;
    }
    const stats = Array.from(dedupeMap.entries())
      .filter(([, e]) => e.count > 1)
      .map(([k, e]) => `${k.split(':')[0]}:×${e.count}`)
      .join(', ');
    if (stats) {
      // eslint-disable-next-line no-console
      console.log(`%c[DEDUPE-STATS] ${stats}`, 'color: #9E9E9E; font-style: italic');
    }
  },

  /**
   * Log message ordering for debugging jumbled UI.
   * Shows message IDs/indexes to help identify ordering issues.
   *
   * @example
   * rlog.messageOrder(messages.map(m => m.id));
   * // Logs: "[MSG-ORDER] count=5 | [msg1, msg2, msg3, msg4, msg5]"
   */
  messageOrder: (messages: Array<{ id: string; role?: string; roundNumber?: number }>): void => {
    if (!rlogEnabled) {
      return;
    }

    const summary = messages.map((m) => {
      const parts = [m.id.slice(-6)];
      if (m.role) {
        parts.push(m.role.charAt(0).toUpperCase());
      }
      if (m.roundNumber !== undefined) {
        parts.push(`r${m.roundNumber}`);
      }
      return parts.join('');
    }).join(', ');

    // eslint-disable-next-line no-console
    console.log(
      `%c[MSG-ORDER] count=${messages.length} | [${summary}]`,
      'color: #2196F3; font-style: italic',
    );
  },

  // ============================================================================
  // TIER 4: SILENT - Use enableVerboseCategory() to enable
  // chunk, render-state, query-render, stream-append are filtered by tier system
  // ============================================================================

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /** Moderator logging - 'chunk' debounced, other actions throttled */
  moderator: (action: string, detail: string): void => {
    // Debounce chunk logging to reduce noise from rapid streaming
    if (action === 'chunk' || action === 'append') {
      const debounceKey = `mod:${action}`;
      const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
      if (!shouldLog) {
        return;
      }
      const suffix = suppressedCount > 0 ? ` (+${suppressedCount} suppressed)` : '';
      rlogLog(RlogCategories.MOD, 'moderator', `${action}: ${detail}${suffix}`);
      return;
    }
    rlogLog(RlogCategories.MOD, 'moderator', `${action}: ${detail}`);
  },

  /**
   * Message logging - debounced with key-specific deduplication.
   * The key parameter is included in the debounce key, so different keys
   * (e.g., different rounds: list-r0, list-r1) have separate debounce windows.
   * This prevents logs from different rounds from suppressing each other
   * while still reducing noise from the SAME round re-rendering rapidly.
   */
  msg: (key: string, detail: string): void => {
    // Include key in debounce key so different rounds/components have separate debounce windows
    const debounceKey = `msg:${key}`;
    const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
    if (!shouldLog) {
      return;
    }
    const suffix = suppressedCount > 0 ? ` (+${suppressedCount} suppressed)` : '';
    rlogLog(RlogCategories.MSG, key, `${detail}${suffix}`);
  },

  /** Phase logging - logs on value change */
  phase: (phase: string, detail: string): void => rlogLog(RlogCategories.PHASE, phase, `${phase}: ${detail}`),

  /**
   * Log streaming phase transitions.
   * Critical for debugging round flow issues.
   *
   * @example
   * rlog.phaseTransition('idle', 'streaming');
   * // Logs: "[PHASE] idle → streaming"
   */
  phaseTransition: (from: string, to: string): void => {
    if (!rlogEnabled) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `%c[PHASE] ${from} → ${to}`,
      'color: #4CAF50; font-weight: bold; background: #E8F5E9; padding: 2px 6px; border-radius: 3px',
    );
  },
  /** Presearch logging - 'partial-update' debounced, other actions throttled */
  presearch: (action: string, detail: string): void => {
    // Debounce partial-update and status-change to reduce noise from rapid SSE events
    if (action === 'partial-update' || action === 'status-change') {
      const debounceKey = `presearch:${action}`;
      const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
      if (!shouldLog) {
        return;
      }
      const suffix = suppressedCount > 0 ? ` (+${suppressedCount} suppressed)` : '';
      rlogLog(RlogCategories.PRESRCH, action, `${action}: ${detail}${suffix}`);
      return;
    }
    rlogLog(RlogCategories.PRESRCH, action, `${action}: ${detail}`);
  },

  /** Race condition detection logging - critical actions immediate, informational debounced */
  race: (action: string, detail: string): void => {
    // Critical actions that indicate actual errors/corruption - always log immediately
    const CRITICAL_RACE_ACTIONS = new Set([
      'identity-corruption-at-complete',
      'msg-content-lost',
      'msg-metadata-corrupted',
      'msg-placeholder-lost',
      'prev-round-msg-lost',
      'prev-round-content-changed',
      'prev-round-model-changed',
      'prev-round-name-changed',
      'prev-round-index-changed',
      'moderator-start-early',
      'start-round-not-idle',
      'reasoning-dropped',
      'send-blocked',
      'sendMessage-error',
      'data-after-complete',
      'error-callback',
      'participants-changed-during-stream',
      'participants-cleared',
      'hook-reset-from-active',
    ]);

    if (CRITICAL_RACE_ACTIONS.has(action)) {
      rlogNow(RlogCategories.RACE, `${action}: ${detail}`);
    } else {
      // Informational race logs - debounce with suppression count
      const debounceKey = `race:${action}`;
      const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
      if (shouldLog) {
        const suffix = suppressedCount > 0 ? ` (x${suppressedCount + 1})` : '';
        rlogNow(RlogCategories.RACE, `${action}: ${detail}${suffix}`);
      }
    }
  },

  /**
   * Flag potential race conditions for investigation.
   *
   * @example
   * rlog.raceCondition('submit', 'Multiple rounds started before previous completed');
   */
  raceCondition: (context: string, details: string): void => {
    if (!rlogEnabled) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `%c[RACE] ${context}: ${details}`,
      RLOG_CATEGORY_STYLES[RlogCategories.RACE],
    );
  },

  /**
   * Debounced race condition logging with render counts.
   * Groups rapid logs within 2s window and shows count when they fire.
   * Use for high-frequency race logs like wrapper-fallback in render paths.
   */
  raceDebounced: (action: string, detail: string): void => {
    const debounceKey = `race:${action}`;
    const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
    if (!shouldLog) {
      return;
    }
    const suffix = suppressedCount > 0 ? ` (x${suppressedCount + 1})` : '';
    rlogNow(RlogCategories.RACE, `${action}: ${detail}${suffix}`);
  },

  /**
   * Track render counts per component.
   * Use to diagnose over-rendering components.
   *
   * @example
   * // In component:
   * useEffect(() => { rlog.renderCount('ChatMessageList'); }, []);
   * // Logs warning if > 10 renders in 5 seconds
   */
  renderCount: (component: string, count?: number): void => {
    if (!rlogEnabled) {
      return;
    }

    const now = Date.now();
    const entry = renderCounts.get(component);
    totalRenders++;

    if (!entry || now - entry.windowStart >= RENDER_COUNT_WINDOW_MS) {
      // New window
      renderCounts.set(component, { count: count ?? 1, lastRender: now, windowStart: now });
      return;
    }

    // Update existing window
    entry.count += count ?? 1;
    entry.lastRender = now;

    // Warn on excessive renders at specific milestones only
    if (PERF_MILESTONES.has(entry.count)) {
      // eslint-disable-next-line no-console
      console.log(
        `%c[PERF] ${component} (x${entry.count}) in ${Math.round((now - entry.windowStart) / 1000)}s`,
        RLOG_CATEGORY_STYLES[RlogCategories.PERF],
      );
    }
  },

  /**
   * Reset render counts and total renders.
   * Useful at the start of a new round.
   */
  resetRenderCounts: (): void => {
    renderCounts.clear();
    totalRenders = 0;
    // eslint-disable-next-line no-console
    console.log('%c[RLOG] Render counts reset', 'color: #9E9E9E; font-style: italic');
  },

  /**
   * Resume logging with verbose flag support.
   * Critical resume events always log, others require VERBOSE_RESUME.
   */
  resume: (key: string, detail: string): void => {
    const criticalKeys = new Set([
      'trigger',
      'in-progress-detected',
      'hook-result',
      'hook-fetch',
      'hook-parsed',
      'skip-stale',
      'fill-completed',
      'reset',
      'nav-cleanup',
      'hydrate',
      'latch',
      'resume-get',
      'no-active-stream',
    ]);

    if (criticalKeys.has(key)) {
      rlogLog(RlogCategories.RESUME, key, detail);
      return;
    }

    if (!VERBOSE_RESUME) {
      return;
    }

    rlogLog(RlogCategories.RESUME, key, detail);
  },

  /** Resume logging that always logs (for state changes, errors) */
  resumeAlways: (key: string, detail: string): void => rlogLog(RlogCategories.RESUME, key, detail),

  /**
   * Serialize a Map for logging (Maps show as {} in JSON).
   * Use to debug participantSnapshotsByRound and other Map state.
   *
   * @example
   * rlog.serializeMap(participantSnapshotsByRound);
   * // Returns: "Map(2) { 0 => [gpt-5-nano, deepseek], 1 => [gpt-5-nano, claude-haiku] }"
   */
  serializeMap: <K, V>(map: Map<K, V> | null | undefined, valueFormatter?: (v: V) => string): string => {
    if (!map) {
      return 'null';
    }
    if (map.size === 0) {
      return 'Map(0) {}';
    }

    const entries: string[] = [];
    for (const [key, value] of map.entries()) {
      const formattedValue = valueFormatter
        ? valueFormatter(value)
        : (Array.isArray(value) ? `[${value.length} items]` : String(value));
      entries.push(`${key} => ${formattedValue}`);
    }
    return `Map(${map.size}) { ${entries.join(', ')} }`;
  },

  // ============================================================================
  // DIAGNOSTIC METHODS - For debugging console flooding issues
  // ============================================================================

  setVerboseResume,

  /**
   * Log snapshot Map state for debugging participant identity preservation.
   * Call when snapshots should be created/accessed to verify they exist.
   *
   * @example
   * rlog.snapshotDiag(participantSnapshotsByRound, 1);
   * // Logs: "[RACE] snapshot-diag: Map(2) { 0 => [gpt-5-nano, deepseek], 1 => [gpt-5-nano, claude] } | r1 snapshot: [gpt-5-nano, claude]"
   */
  snapshotDiag: (
    snapshots: Map<number, Array<{ modelId: string; role?: string | null }>> | null | undefined,
    currentRound?: number,
  ): void => {
    if (!rlogEnabled) {
      return;
    }

    const formatParticipants = (arr: Array<{ modelId: string; role?: string | null }>): string =>
      `[${arr.map(p => p.modelId?.split('/').pop() ?? 'null').join(', ')}]`;

    const mapStr = rlog.serializeMap(snapshots, formatParticipants);
    const roundSnapshot = currentRound !== undefined ? snapshots?.get(currentRound) : undefined;
    const currentStr = currentRound !== undefined && roundSnapshot
      ? ` | r${currentRound} snapshot: ${formatParticipants(roundSnapshot)}`
      : currentRound !== undefined ? ` | r${currentRound} snapshot: MISSING` : '';

    rlogNow(RlogCategories.RACE, `snapshot-diag: ${mapStr}${currentStr}`);
  },

  /** Message split logging - tracks splitUnifiedStreamMessages diagnostics */
  split: (action: string, detail: string): void => rlogLog(RlogCategories.MSG, `split-${action}`, `${action}: ${detail}`),

  /**
   * Start automatic summary logging (every 5 seconds during streaming).
   * Call rlog.stopAutoSummary() to stop.
   */
  startAutoSummary: (): void => {
    if (summaryIntervalId) {
      return; // Already running
    }

    // eslint-disable-next-line no-console
    console.log('%c[RLOG] Auto-summary started (every 5s)', 'color: #4CAF50');

    summaryIntervalId = setInterval(() => {
      if (totalRenders > 0) {
        rlog.summary();
      }
    }, 5000);
  },

  /** State summary logging */
  state: (summary: string): void => rlogLog(RlogCategories.RESUME, 'state', summary),

  /**
   * Track state changes in Zustand stores.
   * Logs when field values change to help debug state mutations.
   *
   * @example
   * rlog.stateChange('chat', 'isStreaming', false, true);
   * // Logs: "[STATE] chat.isStreaming: false → true"
   */
  stateChange: (store: string, field: string, oldVal: unknown, newVal: unknown): void => {
    if (!rlogEnabled) {
      return;
    }

    const formatVal = (v: unknown): string => {
      if (v === null) {
        return 'null';
      }
      if (v === undefined) {
        return 'undefined';
      }
      if (typeof v === 'boolean') {
        return v ? 'true' : 'false';
      }
      if (typeof v === 'number') {
        return String(v);
      }
      if (typeof v === 'string') {
        return v.length > 20 ? `"${v.slice(0, 20)}..."` : `"${v}"`;
      }
      if (Array.isArray(v)) {
        return `Array(${v.length})`;
      }
      if (typeof v === 'object') {
        return `{${Object.keys(v).length} keys}`;
      }
      return String(v);
    };

    // eslint-disable-next-line no-console
    console.log(
      `%c[STATE] ${store}.${field}: ${formatVal(oldVal)} → ${formatVal(newVal)}`,
      'color: #9C27B0; font-weight: bold',
    );
  },

  /**
   * Stop automatic summary logging.
   */
  stopAutoSummary: (): void => {
    if (summaryIntervalId) {
      clearInterval(summaryIntervalId);
      summaryIntervalId = null;
      // eslint-disable-next-line no-console
      console.log('%c[RLOG] Auto-summary stopped', 'color: #FF5722');
    }
  },

  /** Stream logging - 'start'/'end' immediate, 'check' debounced to reduce noise */
  stream: (action: RlogStreamAction, detail: string): void => {
    // Keep 'start' and 'end' immediate (critical for debugging flow)
    if (action === 'start' || action === 'end') {
      rlogLog(RlogCategories.STREAM, 'stream', `${action}: ${detail}`);
      return;
    }
    // Debounce 'check' and 'skip' actions to reduce noise
    const debounceKey = `stream:${action}`;
    const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
    if (!shouldLog) {
      return;
    }
    const suffix = suppressedCount > 0 ? ` (+${suppressedCount} suppressed)` : '';
    rlogLog(RlogCategories.STREAM, 'stream', `${action}: ${detail}${suffix}`);
  },

  /** Stuck state detection logging (blockers, timeouts, stuck rounds) */
  stuck: (action: string, detail: string): void => rlogNow(RlogCategories.STUCK, `${action}: ${detail}`),

  /** Submit action logging - key actions immediate, detail logs debounced */
  submit: (action: string, detail: string): void => {
    const CRITICAL_SUBMIT_ACTIONS = new Set([
      'auto-mode-submit',
      'streaming-trigger',
      'changelog-compare',
    ]);
    if (CRITICAL_SUBMIT_ACTIONS.has(action)) {
      rlogNow(RlogCategories.SUBMIT, `${action}: ${detail}`);
    } else {
      const debounceKey = `submit:${action}`;
      const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
      if (shouldLog) {
        const suffix = suppressedCount > 0 ? ` (x${suppressedCount + 1})` : '';
        rlogNow(RlogCategories.SUBMIT, `${action}: ${detail}${suffix}`);
      }
    }
  },

  /**
   * Log periodic summary of render activity.
   * Call this manually or enable auto-summary during streaming.
   *
   * @example
   * rlog.summary();
   * // Logs render counts and component breakdown
   */
  summary: (): void => {
    if (!rlogEnabled) {
      return;
    }

    const componentBreakdown = Array.from(renderCounts.entries())
      .filter(([, e]) => e.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([k, v]) => `${k}:${v.count}`)
      .join(', ');

    // eslint-disable-next-line no-console
    console.log('%c=== RLOG SUMMARY ===', 'color: #FF9800; font-weight: bold');
    // eslint-disable-next-line no-console
    console.log(`%cTotal renders: ${totalRenders}`, 'color: #FF9800');
    if (componentBreakdown) {
      // eslint-disable-next-line no-console
      console.log(`%cComponents: ${componentBreakdown}`, 'color: #FF9800');
    }
  },

  /** Sync logging - debounced to reduce noise */
  sync: (key: string, detail: string): void => {
    const debounceKey = `sync:${key}`;
    const { shouldLog, suppressedCount } = shouldLogDebounced(debounceKey, detail);
    if (!shouldLog) {
      return;
    }
    const suffix = suppressedCount > 0 ? ` (+${suppressedCount} suppressed)` : '';
    rlogLog(RlogCategories.SYNC, key, `${detail}${suffix}`);
  },

  /**
   * Trace logging for high-frequency debugging events.
   * Batches events and logs a summary instead of individual entries.
   * Use for onData, message routing, and other per-event debugging.
   *
   * @example
   * rlog.trace('onData', `r0 RAW: ${JSON.stringify(data)}`);
   * // Logs: "[TRACE] onData: 50 events in 1000ms (last: r0 RAW: {...})"
   */
  trace: (category: string, detail: string): void => logTraceBatched(category, detail),

  /** Trigger logging - logs on action change */
  trigger: (action: string, detail: string): void => rlogLog(RlogCategories.TRIGGER, action, detail),
};

export const devLog = {
  d: (tag: string, data: DebugData): void => {
    const key = `d:${tag}`;
    const { isExcessive } = trackUpdate(key);
    if (isExcessive) {
      return;
    }

    const pairs = Object.entries(data)
      .map(([k, v]) => {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null || v === undefined) {
          return formatDebugValue(k, v);
        }
        return `${k}=${String(v)}`;
      })
      .join(' ');

    debouncedLog(key, DevLogLevels.DEBUG, pairs);
  },
};

// ============================================================================
// SERVER-SIDE LOGGING (SSR / Server Functions)
// ============================================================================

/**
 * Server-side log styles for SSR categories
 */
const SERVER_LOG_STYLES = {
  ERROR: 'color: #D32F2F; font-weight: bold',
  LOADER: 'color: #4ECDC4; font-weight: bold', // Teal - route loaders
  SERVERFN: 'color: #45B7D1; font-weight: bold', // Sky blue - server functions
  SESSION: 'color: #96CEB4; font-weight: bold', // Sage - session/auth
  SSR: 'color: #FF6B6B; font-weight: bold', // Coral - server rendering
} as const;

type ServerLogCategory = keyof typeof SERVER_LOG_STYLES;

/**
 * Format data for server logging (key=value pairs)
 */
function formatServerData(data?: Record<string, string | number | boolean | null | undefined>): string {
  if (!data) {
    return '';
  }
  return Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => formatDebugValue(k, v))
    .join(' ');
}

/**
 * Server-side immediate log (no debouncing, works in SSR context)
 * Uses direct console.log - shows in terminal during wrangler dev
 */
function serverLogNow(
  category: ServerLogCategory,
  action: string,
  message: string,
  data?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!isDev) {
    return;
  }
  const dataStr = formatServerData(data);
  const fullMessage = dataStr ? `${message} ${dataStr}` : message;
  const style = SERVER_LOG_STYLES[category];
  // eslint-disable-next-line no-console
  console.log(`%c[${category}:${action}] ${fullMessage}`, style);
}

/**
 * Server-side logger for SSR and server functions.
 * Uses direct console.log without browser-specific deduplication.
 *
 * @example
 * import { serverLog } from '@/lib/utils/dev-logger';
 *
 * serverLog.ssr('render', '/chat/123', { durationMs: 45 });
 * serverLog.serverFn('call', 'getSession', { durationMs: 12 });
 */
export const serverLog = {
  error: (message: string, data?: Record<string, string | number | boolean | null | undefined>): void => {
    serverLogNow('ERROR', 'error', message, data);
  },

  loader: (action: string, message: string, data?: Record<string, string | number | boolean | null | undefined>): void => {
    serverLogNow('LOADER', action, message, data);
  },

  serverFn: (action: string, message: string, data?: Record<string, string | number | boolean | null | undefined>): void => {
    serverLogNow('SERVERFN', action, message, data);
  },

  session: (action: string, message: string, data?: Record<string, string | number | boolean | null | undefined>): void => {
    serverLogNow('SESSION', action, message, data);
  },

  ssr: (action: string, message: string, data?: Record<string, string | number | boolean | null | undefined>): void => {
    serverLogNow('SSR', action, message, data);
  },
};
