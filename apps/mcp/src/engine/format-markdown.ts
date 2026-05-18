/**
 * Markdown Formatter for MCP Tool Output
 *
 * Transforms DebateResult into well-formatted markdown so MCP clients
 * receive a readable document instead of raw JSON.
 */

import { formatMs } from '@debatekit/shared';
import type { McpOutputFormat } from '@debatekit/shared/enums';
import { z } from 'zod';

import { getThreadUrl } from '../lib/url-resolver';
import type { Env } from '../types';
import type { DebateResult } from './debate-engine';
import { extractModelName } from './debate-engine';

type ThreadInfo = {
  env: Env;
  sessionId?: string;
  threadSlug?: string;
};

/** Tool names that correspond to debate-based MCP tools */
const TOOL_NAME_VALUES = ['assess-tradeoffs', 'consult-council', 'debug-issue', 'design-architecture', 'plan-implementation', 'review-code'] as const;
const ToolNameSchema = z.enum(TOOL_NAME_VALUES);
type ToolName = z.infer<typeof ToolNameSchema>;

/** MCP standalone tool names that have display labels */
const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
  'assess-tradeoffs': 'Tradeoff Assessment',
  'consult-council': 'Council Discussion',
  'debug-issue': 'Debugging Council',
  'design-architecture': 'Architecture Council',
  'plan-implementation': 'Implementation Planning',
  'review-code': 'Code Review Council',
};

const FORMAT_LABELS: Record<McpOutputFormat, string> = {
  'adr': 'ADR',
  'comparison': 'Comparison',
  'discussion': 'Discussion',
  'pros-cons': 'Pros/Cons',
};

function truncatePrompt(prompt: string, max = 200) {
  if (prompt.length <= max) {
    return prompt;
  }
  return `${prompt.slice(0, max)}...`;
}

export function formatDebateAsMarkdown(
  result: DebateResult,
  toolName?: string,
  prompt?: string,
  threadInfo?: ThreadInfo,
) {
  const { metadata, moderator, participants } = result;
  const parsedToolName = ToolNameSchema.safeParse(toolName);
  const title = parsedToolName.success ? TOOL_DISPLAY_NAMES[parsedToolName.data] : 'Council Discussion';
  const formatLabel = FORMAT_LABELS[metadata.format];
  const moderatorName = extractModelName(moderator.model_id);

  const lines: string[] = [];

  // Header
  lines.push(`# ${title}`);
  lines.push('');
  if (prompt) {
    lines.push(`> ${truncatePrompt(prompt)}`);
    lines.push('');
  }

  // Synthesis (first — it's the answer)
  lines.push('## Synthesis');
  lines.push('');
  lines.push(`*Moderator: ${moderatorName}*`);
  lines.push('');
  lines.push(moderator.summary);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Participant responses
  lines.push('## Participant Responses');
  lines.push('');
  for (const [i, p] of participants.entries()) {
    const roleLabel = p.role ? ` — ${p.role}` : '';
    lines.push(`### ${i + 1}. ${p.model_name}${roleLabel}`);
    lines.push('');
    lines.push(p.response);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Compact metadata footer
  const metaParts = [
    `participants:${participants.length}`,
    `thinking:${metadata.thinking_level}`,
    `mode:${metadata.mode}`,
    `format:${formatLabel}`,
    `time:${formatMs(metadata.duration_ms)}`,
    `credits:${metadata.total_credits_used}`,
  ];
  lines.push(metaParts.join(' | '));

  // Thread link and share hint
  if (threadInfo?.threadSlug) {
    const threadUrl = getThreadUrl(threadInfo.env, threadInfo.threadSlug);
    const parts = [`[View in DebateKit app](${threadUrl})`];
    if (threadInfo.sessionId) {
      parts.push(`Share: \`set-thread-visibility\` with session_id \`${threadInfo.sessionId}\``);
    }
    lines.push('');
    lines.push(parts.join(' | '));
  }

  return lines.join('\n');
}
