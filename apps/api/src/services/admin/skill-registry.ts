/**
 * Admin Skill Registry
 *
 * Skill metadata is defined in code. Skill CONTENT lives in the DB
 * (admin_settings table with `skill:{id}` keys, seeded via seed-admin-settings.sql).
 * The resolver replaces `{skill_id}` tokens with DB content at runtime.
 */

import type { AdminSkill } from '@debatekit/shared';
import { AdminSkillSchema } from '@debatekit/shared';
import { like } from 'drizzle-orm';

import type { getDbAsync } from '@/db';
import * as tables from '@/db';

// Re-export for consumers
export { type AdminSkill, AdminSkillSchema };

type Db = Awaited<ReturnType<typeof getDbAsync>>;

// ============================================================================
// SKILL METADATA (content lives in DB)
// ============================================================================

/** Truncate content to ~100 chars for preview */
function preview(content: string): string {
  const flat = content.replace(/\n+/g, ' ').trim();
  if (flat.length <= 100) {
    return flat;
  }
  return `${flat.slice(0, 97)}...`;
}

const SKILL_METADATA: Array<{ category: 'pipeline' | 'tweet'; description: string; id: string; name: string }> = [
  // --- Tweet Skills ---
  { category: 'tweet', description: 'Brand identity, tone pillars, and words to avoid', id: 'brand_voice', name: 'Brand Voice' },
  { category: 'tweet', description: 'Twitter/X character count and URL budget rules', id: 'character_rules', name: 'Character Rules' },
  { category: 'tweet', description: 'Top copywriting frameworks optimized for Twitter', id: 'copywriting_frameworks', name: 'Copywriting Frameworks' },
  { category: 'tweet', description: 'Marketing psychology techniques for engagement', id: 'psychology_techniques', name: 'Psychology Techniques' },
  { category: 'tweet', description: 'Rules to make AI-generated tweets sound human', id: 'humanizer_rules', name: 'Humanizer Rules' },
  { category: 'tweet', description: 'Twitter/X engagement and voice tactics', id: 'engagement_tactics', name: 'Engagement Tactics' },
  { category: 'tweet', description: 'Data-driven tweet strategies using debate outcomes', id: 'data_strategies', name: 'Data-Driven Strategies' },
  { category: 'tweet', description: 'Tactics for showcasing the debatekit debate format', id: 'showcase_tactics', name: 'Thread Showcase' },
  { category: 'tweet', description: 'Example tweets demonstrating skill combinations', id: 'tweet_examples', name: 'Tweet Examples' },
  // --- Pipeline Skills ---
  { category: 'pipeline', description: 'Global preamble for debatekit participants', id: 'participant_preamble', name: 'Participant Preamble' },
  { category: 'pipeline', description: 'Global rules for debatekit participant behavior', id: 'participant_rules', name: 'Participant Rules' },
  { category: 'pipeline', description: 'Analyzing mode participant instructions', id: 'mode_analyzing', name: 'Analyzing Mode' },
  { category: 'pipeline', description: 'Brainstorming mode participant instructions', id: 'mode_brainstorming', name: 'Brainstorming Mode' },
  { category: 'pipeline', description: 'Debating mode participant instructions', id: 'mode_debating', name: 'Debating Mode' },
  { category: 'pipeline', description: 'Solving mode participant instructions', id: 'mode_solving', name: 'Solving Mode' },
  { category: 'pipeline', description: 'Viral scoring system prompt criteria', id: 'viral_scoring_criteria', name: 'Viral Scoring Criteria' },
  { category: 'pipeline', description: 'Keyword generation base prompt', id: 'keyword_generation_base', name: 'Keyword Generation Base' },
];

// ============================================================================
// DB FUNCTIONS
// ============================================================================

/**
 * Load all skill content from DB into a Map.
 * Skills are stored as admin_settings with key format `skill:{id}`.
 */
export async function loadSkillContentMap(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select()
    .from(tables.adminSettings)
    .where(like(tables.adminSettings.key, 'skill:%'));

  const map = new Map<string, string>();
  for (const row of rows) {
    const skillId = row.key.replace('skill:', '');
    map.set(skillId, row.value);
  }
  return map;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Resolve `{skill_id}` tokens in a prompt string.
 * Reads skill content from DB. Unrecognized tokens are left as-is.
 */
export async function resolveSkillTokens(prompt: string, db: Db): Promise<string> {
  const skillMap = await loadSkillContentMap(db);
  return prompt.replace(/\{([a-z_]+)\}/g, (match, id: string) => {
    const content = skillMap.get(id);
    return content ?? match;
  });
}

/**
 * Get the full list of skills for the admin API.
 * Returns metadata + content preview from DB.
 */
export async function getSkillList(db: Db): Promise<AdminSkill[]> {
  const skillMap = await loadSkillContentMap(db);
  return SKILL_METADATA.map(({ category, description, id, name }) => ({
    category,
    contentPreview: preview(skillMap.get(id) ?? ''),
    description,
    id,
    name,
  }));
}
