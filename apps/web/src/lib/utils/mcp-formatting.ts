/**
 * MCP Formatting Utilities
 *
 * Shared helpers for countdown timers, reset times, duration formatting,
 * and compact number display used by the MCP dashboard components.
 */

/**
 * Computes seconds remaining until a given ISO timestamp.
 */
export function secondsUntil(isoString: string) {
  const target = new Date(isoString).getTime();
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

/**
 * Formats a number into a compact, human-readable string.
 * Examples: 2000000 → "2M", 1500000 → "1.5M", 20000 → "20k", 500 → "500"
 */
export function formatCompactNumber(n: number) {
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${Number.parseFloat(val.toFixed(1))}M`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return val % 1 === 0 ? `${val}k` : `${Number.parseFloat(val.toFixed(1))}k`;
  }
  return String(n);
}

/**
 * Formats a duration in seconds to a human-readable countdown string.
 * Examples: "2h 15m", "45m 30s", "30s"
 */
export function formatCountdown(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return '0s';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Formats an ISO timestamp to local time string: "3:00 PM"
 * Uses the browser's locale and timezone automatically.
 */
export function formatLocalResetTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
