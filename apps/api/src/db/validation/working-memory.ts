/**
 * Working Memory Validation Schemas
 *
 * Pure Drizzle-Zod schemas for the working_memory table.
 * Includes 5-part enum for WorkingMemoryScope.
 */

import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import * as z from 'zod';

import { workingMemory } from '@/db/tables/working-memory';

// ============================================================================
// 5-PART ENUM: WorkingMemoryScope
// ============================================================================

export const WORKING_MEMORY_SCOPES = ['chat', 'user'] as const;
export const DEFAULT_WORKING_MEMORY_SCOPE: WorkingMemoryScope = 'chat';
export const WorkingMemoryScopeSchema = z.enum(WORKING_MEMORY_SCOPES);
export type WorkingMemoryScope = z.infer<typeof WorkingMemoryScopeSchema>;
export const WorkingMemoryScopes = { CHAT: 'chat', USER: 'user' } as const;

// ============================================================================
// TABLE SCHEMAS
// ============================================================================

export const workingMemorySelectSchema = createSelectSchema(workingMemory);
export const workingMemoryInsertSchema = createInsertSchema(workingMemory);
export const workingMemoryUpdateSchema = createUpdateSchema(workingMemory);

export type WorkingMemory = z.infer<typeof workingMemorySelectSchema>;
export type WorkingMemoryInsert = z.infer<typeof workingMemoryInsertSchema>;
export type WorkingMemoryUpdate = z.infer<typeof workingMemoryUpdateSchema>;
