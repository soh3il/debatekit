/**
 * MCP Prompt Template Service
 *
 * Drizzle ORM replacement for raw D1 SQL in apps/mcp/src/engine/prompt-resolver.ts.
 * Versioned prompt template resolution, usage tracking, and default seeding.
 */

import { and, desc, eq, sql } from 'drizzle-orm';

import type { DbInstance } from '../factory';
import { mcpPromptTemplate } from '../tables/mcp';

// ============================================================================
// Types
// ============================================================================

type PromptTemplateRow = typeof mcpPromptTemplate.$inferSelect;

// ============================================================================
// Resolve Prompt
// ============================================================================

/**
 * Find the active highest-version template for a given tool and type.
 *
 * @returns The matching template row, or null if none found.
 */
export async function resolvePrompt(
  db: DbInstance,
  toolName: string,
  templateType: PromptTemplateRow['templateType'],
) {
  const rows = await db
    .select()
    .from(mcpPromptTemplate)
    .where(
      and(
        eq(mcpPromptTemplate.toolName, toolName),
        eq(mcpPromptTemplate.templateType, templateType),
        eq(mcpPromptTemplate.isActive, true),
      ),
    )
    .orderBy(desc(mcpPromptTemplate.version))
    .limit(1);

  return rows[0] ?? null;
}

// ============================================================================
// Increment Usage
// ============================================================================

/**
 * Bump the usage count for a template by 1.
 */
export async function incrementUsage(db: DbInstance, templateId: string) {
  await db
    .update(mcpPromptTemplate)
    .set({ usageCount: sql`${mcpPromptTemplate.usageCount} + 1` })
    .where(eq(mcpPromptTemplate.id, templateId));
}
