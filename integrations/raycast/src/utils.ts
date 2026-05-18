import { DEBATEKIT_APP_URL } from "@debatekit/integration-shared";
import type { DebateResult } from "./types";

/** Format a debate result as markdown for Raycast Detail view */
export function formatDebateMarkdown(result: DebateResult): string {
  const lines: string[] = [];

  // Summary
  lines.push("# Moderator Summary");
  lines.push("");
  lines.push(result.moderator.summary);
  lines.push("");

  // Participants
  lines.push("---");
  lines.push("");
  lines.push("## Participant Responses");
  lines.push("");

  for (const participant of result.participants) {
    const role = participant.role ? ` (${participant.role})` : "";
    lines.push(`### ${participant.model_name}${role}`);
    lines.push("");
    lines.push(participant.response);
    lines.push("");
  }

  // Metadata
  lines.push("---");
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  const durationSec = (result.metadata.duration_ms / 1000).toFixed(1);
  lines.push(`- **Duration:** ${durationSec}s`);
  lines.push(`- **Mode:** ${result.metadata.mode}`);
  lines.push(`- **Thinking Level:** ${result.metadata.thinking_level}`);
  lines.push(`- **Credits Used:** ${result.metadata.total_credits_used}`);
  lines.push(`- **Session ID:** \`${result.sessionId}\``);
  if (result.threadSlug) {
    // NOTE: Threads are private by default. This link only works if the
    // user has set the thread to public via set_thread_visibility.
    lines.push(
      `- **Thread:** [View on DebateKit](${DEBATEKIT_APP_URL}/public/chat/${result.threadSlug})`,
    );
  }

  return lines.join("\n");
}

/** Known tool name keys returned by the API */
const TOOL_NAME_LABELS = new Map([
  ["assess_tradeoffs", "Assess Tradeoffs"],
  ["consult_council", "Consult"],
  ["debug_issue", "Debug"],
  ["design_architecture", "Architect"],
  ["plan_implementation", "Plan Implementation"],
  ["review_code", "Review Code"],
]);

/** Map tool names to human-readable labels */
export function toolNameLabel(toolName: string): string {
  return TOOL_NAME_LABELS.get(toolName) || toolName;
}

/** Format a date string to relative time */
export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/** Truncate text to a max length */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "\u2026";
}
