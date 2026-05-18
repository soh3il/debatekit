/**
 * Duration Formatting Utilities
 *
 * Human-readable duration formatting shared across API and web.
 */

/**
 * Format a duration between two ISO date strings as a human-readable string.
 * Examples: "500ms", "45s", "3m 12s", "2h 15m"
 */
export function formatDuration(startedAt: string, completedAt: string) {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;

  if (diffMs < 1000) {
    return `${diffMs}ms`;
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Format a raw millisecond value as a human-readable duration.
 * Examples: "500ms", "45s", "3m 12s"
 */
export function formatMs(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const sec = Math.round(ms / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`;
}

/**
 * Format elapsed seconds as a compact duration string.
 * Examples: "45s", "2m 30s"
 */
export function formatElapsedSeconds(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const min = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`;
}
