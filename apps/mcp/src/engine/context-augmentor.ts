/**
 * MCP Context Augmentor
 *
 * Resolves and formats knowledge items for context injection.
 * Supports text pass-through and URL content fetching.
 */

import { z } from 'zod';

// ============================================================================
// Knowledge Item Type (5-part enum)
// ============================================================================

export const KNOWLEDGE_ITEM_TYPE_VALUES = ['text', 'url'] as const;
export const DEFAULT_KNOWLEDGE_ITEM_TYPE: KnowledgeItemType = 'text';
export const KnowledgeItemTypeSchema = z.enum(KNOWLEDGE_ITEM_TYPE_VALUES);
export type KnowledgeItemType = z.infer<typeof KnowledgeItemTypeSchema>;
export const KnowledgeItemTypes = { TEXT: 'text', URL: 'url' } as const;

// ============================================================================
// Schemas
// ============================================================================

export const KnowledgeItemSchema = z.object({
  content: z.string().describe('Text content or URL to fetch'),
  label: z.string().optional().describe('Label for this knowledge item'),
  type: KnowledgeItemTypeSchema.describe('Content type: text (pass-through) or url (fetch and extract)'),
});
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

// ============================================================================
// URL Content Fetching
// ============================================================================

async function fetchUrlContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/plain, text/html, application/json',
        'User-Agent': 'DebateKit-MCP/1.0',
      },
    });

    if (!response.ok) {
      return `[Failed to fetch: HTTP ${response.status}]`;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();

    // Trim to reasonable size
    const maxLength = 10000;

    if (contentType.includes('json')) {
      return text.slice(0, maxLength);
    }

    // Strip HTML tags for HTML content
    if (contentType.includes('html')) {
      const stripped = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return stripped.slice(0, maxLength);
    }

    return text.slice(0, maxLength);
  } catch (error) {
    return `[Failed to fetch URL: ${error instanceof Error ? error.message : 'unknown error'}]`;
  }
}

// ============================================================================
// Knowledge Resolution
// ============================================================================

export async function resolveKnowledge(items: KnowledgeItem[]) {
  const resolved: Array<{ content: string; label: string }> = [];

  for (const item of items) {
    const label = item.label ?? (item.type === 'url' ? item.content : 'Reference');

    if (item.type === 'url') {
      const content = await fetchUrlContent(item.content);
      resolved.push({ content, label });
    } else {
      resolved.push({ content: item.content, label });
    }
  }

  return resolved;
}

// ============================================================================
// Knowledge Formatting
// ============================================================================

export function formatKnowledge(items: Array<{ content: string; label: string }>) {
  if (items.length === 0) {
    return '';
  }

  const sections = items.map(item =>
    `### ${item.label}\n${item.content}`,
  );

  return `## Reference Knowledge\n\n${sections.join('\n\n')}\n\n---\n\n`;
}
