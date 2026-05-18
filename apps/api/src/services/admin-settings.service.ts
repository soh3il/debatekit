/**
 * Admin Settings Service
 *
 * Helper for reading admin settings from DB with defaults.
 * Used by the content pipeline and other services that need configurable limits.
 */

import { eq } from 'drizzle-orm';

import type { getDbAsync } from '@/db';
import * as tables from '@/db/tables';
import type { AdminSettingKey } from '@/routes/admin/settings/schema';
import {
  ADMIN_SETTING_DEFAULTS,
} from '@/routes/admin/settings/schema';

type Db = Awaited<ReturnType<typeof getDbAsync>>;

/**
 * Read a single admin setting from DB, falling back to its default.
 */
export async function getAdminSetting(db: Db, key: AdminSettingKey) {
  const rows = await db
    .select()
    .from(tables.adminSettings)
    .where(eq(tables.adminSettings.key, key))
    .limit(1);

  const row = rows[0];
  return row?.value ?? ADMIN_SETTING_DEFAULTS[key];
}

/**
 * Pipeline configuration derived from admin settings.
 * All values are typed (numbers are numbers, booleans are booleans).
 */
export type PipelineConfig = {
  autoTweetEnabled: boolean;
  dailyJobLimit: number;
  dailyTweetLimit: number;
  defaultRoundCount: number;
  keywordGenerationPrompt: string;
  modelSelectionPrompt: string;
  participantBehaviorPrompt: string;
  pipelineEnabled: boolean;
  roundPromptGeneration: string;
  systemPrompt: string;
  topicGuidance: string;
  trendExtractionPrompt: string;
  tweetSkillsPrompt: string;
  tweetSystemPrompt: string;
  viralScoringPrompt: string;
  viralScoreThreshold: number;
};

/**
 * Read all pipeline-related settings in one call with proper types.
 */
export async function getPipelineConfig(db: Db): Promise<PipelineConfig> {
  const rows = await db
    .select()
    .from(tables.adminSettings);

  const map = new Map(rows.map(r => [r.key, r.value]));

  const get = (key: AdminSettingKey) =>
    map.get(key) ?? ADMIN_SETTING_DEFAULTS[key];

  return {
    autoTweetEnabled: get('autoTweetEnabled') === 'true',
    dailyJobLimit: Number(get('dailyJobLimit')),
    dailyTweetLimit: Number(get('dailyTweetLimit')),
    defaultRoundCount: Number(get('defaultRoundCount')),
    keywordGenerationPrompt: get('keywordGenerationPrompt') ?? '',
    modelSelectionPrompt: get('modelSelectionPrompt') ?? '',
    participantBehaviorPrompt: get('participantBehaviorPrompt') ?? '',
    pipelineEnabled: get('pipelineEnabled') === 'true',
    roundPromptGeneration: get('roundPromptGeneration') ?? '',
    systemPrompt: get('systemPrompt') ?? '',
    topicGuidance: get('topicGuidance') ?? '',
    trendExtractionPrompt: get('trendExtractionPrompt') ?? '',
    tweetSkillsPrompt: get('tweetSkillsPrompt') ?? '',
    tweetSystemPrompt: get('tweetSystemPrompt') ?? '',
    viralScoreThreshold: Number(get('viralScoreThreshold')),
    viralScoringPrompt: get('viralScoringPrompt') ?? '',
  };
}
