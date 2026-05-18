/**
 * Podcast Validation Schemas
 *
 * ✅ DATABASE-ONLY: Pure Drizzle-Zod schemas derived from chatPodcast table
 * ❌ NO CUSTOM LOGIC: No business logic, API schemas, or UI-specific validations
 *
 * For API-specific schemas, see: @/routes/podcast/schema.ts
 * @see /src/db/tables/chat.ts
 */

import { chatPodcast } from '@debatekit/db/tables';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import type { z } from 'zod';

import { DbPodcastScriptSchema } from '@/db/schemas/chat-metadata';

// ============================================================================
// PODCAST SCHEMAS
// ============================================================================

const basePodcastSelectSchema = createSelectSchema(chatPodcast);
export const podcastSelectSchema = basePodcastSelectSchema.extend({
  scriptData: DbPodcastScriptSchema.nullable().optional(),
});

export const podcastInsertSchema = createInsertSchema(chatPodcast);
export const podcastUpdateSchema = createUpdateSchema(chatPodcast);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ChatPodcast = z.infer<typeof podcastSelectSchema>;
export type ChatPodcastInsert = z.infer<typeof podcastInsertSchema>;
export type ChatPodcastUpdate = z.infer<typeof podcastUpdateSchema>;
