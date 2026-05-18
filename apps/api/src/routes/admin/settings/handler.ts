import type { RouteHandler } from '@hono/zod-openapi';

import { executeBatch } from '@/common/batch-operations';
import { createHandler, Responses } from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db/tables';
import { requireAdmin } from '@/lib/auth';
import type { ApiEnv } from '@/types';

import type { getAdminSettingsRoute, updateAdminSettingsRoute } from './route';
import type { AdminSettingKey, AdminSettingsPayload } from './schema';
import {
  ADMIN_SETTING_DEFAULTS,
  ADMIN_SETTING_KEYS,
  AdminSettingsPatchBodySchema,
} from './schema';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build the full settings payload from DB rows, filling defaults for missing keys.
 */
function buildSettingsPayload(rows: { key: string; value: string }[]): AdminSettingsPayload {
  const dbMap = new Map(rows.map(r => [r.key, r.value]));

  const getValue = (key: AdminSettingKey) =>
    dbMap.get(key) ?? ADMIN_SETTING_DEFAULTS[key];

  return {
    autoTweetEnabled: getValue('autoTweetEnabled') === 'true',
    continuous: getValue('continuous') === 'true',
    dailyJobLimit: Number(getValue('dailyJobLimit')),
    dailyTweetLimit: Number(getValue('dailyTweetLimit')),
    defaultRoundCount: Number(getValue('defaultRoundCount')),
    keywordGenerationPrompt: getValue('keywordGenerationPrompt'),
    modelSelectionPrompt: getValue('modelSelectionPrompt'),
    participantBehaviorPrompt: getValue('participantBehaviorPrompt'),
    pipelineEnabled: getValue('pipelineEnabled') === 'true',
    roundPromptGeneration: getValue('roundPromptGeneration'),
    systemPrompt: getValue('systemPrompt'),
    topicGuidance: getValue('topicGuidance'),
    trendExtractionPrompt: getValue('trendExtractionPrompt'),
    tweetSkillsPrompt: getValue('tweetSkillsPrompt'),
    tweetSystemPrompt: getValue('tweetSystemPrompt'),
    viralScoringPrompt: getValue('viralScoringPrompt'),
    viralScoreThreshold: Number(getValue('viralScoreThreshold')),
  };
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /admin/settings
 * Returns all admin settings with defaults for unset keys.
 */
export const getAdminSettingsHandler: RouteHandler<typeof getAdminSettingsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getAdminSettings',
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const db = await getDbAsync();

    const rows = await db
      .select()
      .from(tables.adminSettings);

    return Responses.ok(c, buildSettingsPayload(rows));
  },
);

/**
 * PATCH /admin/settings
 * Update one or more settings. Returns the full settings payload after update.
 */
export const updateAdminSettingsHandler: RouteHandler<typeof updateAdminSettingsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'updateAdminSettings',
    validateBody: AdminSettingsPatchBodySchema,
  },
  async (c) => {
    const { user } = c.auth();
    requireAdmin(user);

    const body = c.validated.body;
    const db = await getDbAsync();
    const now = new Date();

    // Collect entries to upsert: convert typed values to string for storage
    const entries: { key: AdminSettingKey; value: string }[] = [];

    for (const key of ADMIN_SETTING_KEYS) {
      const raw = body[key];
      if (raw === undefined) {
        continue;
      }
      entries.push({ key, value: String(raw) });
    }

    // Upsert each provided setting using executeBatch (D1-compatible)
    if (entries.length > 0) {
      const statements = entries.map(({ key, value }) =>
        db
          .insert(tables.adminSettings)
          .values({ key, updatedAt: now, value })
          .onConflictDoUpdate({
            set: { updatedAt: now, value },
            target: tables.adminSettings.key,
          }),
      );

      await executeBatch(db, statements);
    }

    // Re-read all settings to return consistent payload
    const rows = await db
      .select()
      .from(tables.adminSettings);

    return Responses.ok(c, buildSettingsPayload(rows));
  },
);
