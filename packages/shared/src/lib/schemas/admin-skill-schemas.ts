/**
 * Admin Skill Schemas
 *
 * Single source of truth for AdminSkill validation.
 * Used by both API (skill-registry.ts) and Web (admin skills service).
 */

import { z } from 'zod';

// ============================================================================
// SKILL CATEGORY (5-part enum pattern)
// ============================================================================

export const SKILL_CATEGORIES = ['pipeline', 'tweet'] as const;
export const DEFAULT_SKILL_CATEGORY: SkillCategory = 'pipeline';
export const SkillCategorySchema = z.enum(SKILL_CATEGORIES);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;
export const SkillCategories = { PIPELINE: 'pipeline', TWEET: 'tweet' } as const;

// ============================================================================
// ADMIN SKILL SCHEMA
// ============================================================================

export const AdminSkillSchema = z.object({
  category: SkillCategorySchema,
  contentPreview: z.string(),
  description: z.string(),
  id: z.string(),
  name: z.string(),
});

export type AdminSkill = z.infer<typeof AdminSkillSchema>;
