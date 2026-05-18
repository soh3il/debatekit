/**
 * Email Campaign Service
 *
 * Orchestrates lifecycle email campaigns: onboarding, retention, conversion,
 * and newsletters. Respects frequency caps and user preferences.
 */

import type { EmailCategory, EmailTemplateId } from '@debatekit/shared/enums';
import { EmailCategories } from '@debatekit/shared/enums';
import { and, eq, gt, lt, sql } from 'drizzle-orm';

import type { AppDb } from '@/db';
import { emailPreference, emailSendLog, user } from '@/db/tables';
import { log } from '@/lib/logger';

import type { EnqueueEmailEnv } from './email-sending.service';
import { enqueueEmail } from './email-sending.service';

// ============================================================================
// TYPES
// ============================================================================

type CohortUser = { email: string; id: string; name: string | null };

// ============================================================================
// CAMPAIGN CONFIG (used by queue consumer's TRIGGER_CAMPAIGN handler)
// ============================================================================

type CampaignConfig = {
  category: EmailCategory;
  defaultVars: Record<string, string>;
  subject: string;
  templateId: EmailTemplateId;
};

/**
 * Campaign type to config mapping.
 * Used by the queue consumer to look up campaign details by type string.
 */
const CAMPAIGN_CONFIGS: Record<string, CampaignConfig> = {
  'newsletter-weekly': {
    category: EmailCategories.NEWSLETTER,
    defaultVars: {},
    subject: 'DebateKit Weekly Digest',
    templateId: 'newsletter-weekly-digest',
  },
  'onboarding-welcome': {
    category: EmailCategories.TIPS,
    defaultVars: {},
    subject: 'Welcome to DebateKit',
    templateId: 'onboarding-welcome',
  },
  'retention-14d': {
    category: EmailCategories.MARKETING,
    defaultVars: {},
    subject: 'Your ideas are waiting at DebateKit',
    templateId: 'retention-14d',
  },
  'retention-7d': {
    category: EmailCategories.MARKETING,
    defaultVars: {},
    subject: 'We miss you at DebateKit',
    templateId: 'retention-7d',
  },
};

/**
 * Get campaign config by campaign type string.
 * Returns undefined for unknown campaign types.
 */
export function getCampaignConfig(campaignType: string): CampaignConfig | undefined {
  return CAMPAIGN_CONFIGS[campaignType];
}

/**
 * Generic cohort query dispatcher for queue-triggered campaigns.
 * Routes to the appropriate cohort function based on campaignType.
 */
export async function getCampaignCohort(
  db: AppDb,
  campaignType: string,
  _cohortQuery?: Record<string, string>,
  limit?: number,
): Promise<CohortUser[]> {
  const config = CAMPAIGN_CONFIGS[campaignType];
  if (!config) {
    return [];
  }

  let cohort: CohortUser[];

  // Route to appropriate cohort query based on campaign prefix
  if (campaignType.startsWith('onboarding-')) {
    cohort = await getOnboardingCohort(db, config.templateId);
  } else if (campaignType.startsWith('retention-')) {
    const daysInactive = campaignType === 'retention-14d' ? 14 : 7;
    cohort = await getRetentionCohort(db, daysInactive);
  } else if (campaignType.startsWith('newsletter-')) {
    // Newsletter uses its own cohort (all subscribed users)
    const rows = await db
      .select()
      .from(user)
      .where(
        sql`EXISTS (
          SELECT 1 FROM ${emailPreference}
          WHERE ${emailPreference.userId} = ${user.id}
          AND ${emailPreference.category} = ${EmailCategories.NEWSLETTER}
          AND ${emailPreference.subscribed} = 1
          AND ${emailPreference.globalUnsubscribe} = 0
        )`,
      );
    cohort = rows.map(r => ({ email: r.email, id: r.id, name: r.name }));
  } else {
    cohort = [];
  }

  return limit ? cohort.slice(0, limit) : cohort;
}

// ============================================================================
// FREQUENCY CAPS
// ============================================================================

const FREQUENCY_CAPS = {
  conversion: { cooldownDays: 14, maxBeforeCooldown: 3, minHoursBetween: 72 },
  globalMarketing: { maxPerWeek: 3 },
  newsletter: { maxPerWeek: 1 },
  onboarding: { maxPerDay: 1 },
  retention: { minDaysBetween: 14 },
} as const;

// ============================================================================
// FREQUENCY CAP CHECK
// ============================================================================

/**
 * Check if user can receive email based on frequency limits.
 *
 * @returns true if the user is within frequency limits
 */
export async function checkFrequencyCap(
  db: AppDb,
  userId: string,
  category: EmailCategory,
): Promise<boolean> {
  const now = new Date();

  // Global marketing cap: max 3 marketing emails per week
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weeklyMarketingRows = await db
    .select()
    .from(emailSendLog)
    .where(
      and(
        eq(emailSendLog.userId, userId),
        gt(emailSendLog.createdAt, weekAgo),
        // Count all non-activity categories as marketing
        sql`${emailSendLog.category} != ${EmailCategories.ACTIVITY}`,
      ),
    );

  if (weeklyMarketingRows.length >= FREQUENCY_CAPS.globalMarketing.maxPerWeek) {
    return false;
  }

  // Category-specific caps
  switch (category) {
    case EmailCategories.TIPS: {
      // Onboarding: max 1 per day
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dailyRows = await db
        .select()
        .from(emailSendLog)
        .where(
          and(
            eq(emailSendLog.userId, userId),
            eq(emailSendLog.category, category),
            gt(emailSendLog.createdAt, dayAgo),
          ),
        );
      return dailyRows.length < FREQUENCY_CAPS.onboarding.maxPerDay;
    }

    case EmailCategories.MARKETING: {
      // Retention: min 14 days between emails
      const retentionWindow = new Date(now.getTime() - FREQUENCY_CAPS.retention.minDaysBetween * 24 * 60 * 60 * 1000);
      const retentionRows = await db
        .select()
        .from(emailSendLog)
        .where(
          and(
            eq(emailSendLog.userId, userId),
            eq(emailSendLog.category, category),
            gt(emailSendLog.createdAt, retentionWindow),
          ),
        );
      return retentionRows.length === 0;
    }

    case EmailCategories.PRODUCT_UPDATES: {
      // Conversion: min 72 hours between, max 3 before 14-day cooldown
      const hourWindow = new Date(now.getTime() - FREQUENCY_CAPS.conversion.minHoursBetween * 60 * 60 * 1000);
      const recentRows = await db
        .select()
        .from(emailSendLog)
        .where(
          and(
            eq(emailSendLog.userId, userId),
            eq(emailSendLog.category, category),
            gt(emailSendLog.createdAt, hourWindow),
          ),
        );

      if (recentRows.length > 0) {
        return false;
      }

      // Check cooldown: if 3+ in last 14 days, enforce cooldown
      const cooldownWindow = new Date(now.getTime() - FREQUENCY_CAPS.conversion.cooldownDays * 24 * 60 * 60 * 1000);
      const cooldownRows = await db
        .select()
        .from(emailSendLog)
        .where(
          and(
            eq(emailSendLog.userId, userId),
            eq(emailSendLog.category, category),
            gt(emailSendLog.createdAt, cooldownWindow),
          ),
        );
      return cooldownRows.length < FREQUENCY_CAPS.conversion.maxBeforeCooldown;
    }

    case EmailCategories.NEWSLETTER: {
      // Newsletter: max 1 per week
      const newsletterWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const newsletterRows = await db
        .select()
        .from(emailSendLog)
        .where(
          and(
            eq(emailSendLog.userId, userId),
            eq(emailSendLog.category, category),
            gt(emailSendLog.createdAt, newsletterWeekAgo),
          ),
        );
      return newsletterRows.length < FREQUENCY_CAPS.newsletter.maxPerWeek;
    }

    default:
      return true;
  }
}

// ============================================================================
// COHORT QUERIES
// ============================================================================

/**
 * Query users eligible for specific onboarding email.
 * Returns users who signed up recently and haven't received this template yet.
 */
export async function getOnboardingCohort(
  db: AppDb,
  templateId: EmailTemplateId,
) {
  // Use raw SQL subquery to avoid custom select on union db type
  const rows = await db
    .select()
    .from(user)
    .where(
      and(
        sql`${user.id} NOT IN (
          SELECT ${emailSendLog.userId} FROM ${emailSendLog}
          WHERE ${emailSendLog.templateId} = ${templateId}
        )`,
        sql`EXISTS (
          SELECT 1 FROM ${emailPreference}
          WHERE ${emailPreference.userId} = ${user.id}
          AND ${emailPreference.category} = ${EmailCategories.TIPS}
          AND ${emailPreference.subscribed} = 1
          AND ${emailPreference.globalUnsubscribe} = 0
        )`,
      ),
    );

  return rows.map(r => ({ email: r.email, id: r.id, name: r.name }));
}

/**
 * Query users eligible for retention email based on inactivity period.
 */
export async function getRetentionCohort(
  db: AppDb,
  daysInactive: number,
) {
  const inactiveThreshold = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(user)
    .where(
      and(
        // User's updatedAt is older than threshold (proxy for last activity)
        lt(user.updatedAt, inactiveThreshold),
        // Subscribed to marketing
        sql`EXISTS (
          SELECT 1 FROM ${emailPreference}
          WHERE ${emailPreference.userId} = ${user.id}
          AND ${emailPreference.category} = ${EmailCategories.MARKETING}
          AND ${emailPreference.subscribed} = 1
          AND ${emailPreference.globalUnsubscribe} = 0
        )`,
      ),
    );

  return rows.map(r => ({ email: r.email, id: r.id, name: r.name }));
}

/**
 * Query users eligible for conversion email based on trigger criteria.
 */
export async function getConversionCohort(
  db: AppDb,
  _trigger: string,
) {
  // Conversion cohort depends on specific trigger
  // For now, return users subscribed to product_updates
  const rows = await db
    .select()
    .from(user)
    .where(
      sql`EXISTS (
        SELECT 1 FROM ${emailPreference}
        WHERE ${emailPreference.userId} = ${user.id}
        AND ${emailPreference.category} = ${EmailCategories.PRODUCT_UPDATES}
        AND ${emailPreference.subscribed} = 1
        AND ${emailPreference.globalUnsubscribe} = 0
      )`,
    );

  return rows.map(r => ({ email: r.email, id: r.id, name: r.name }));
}

// ============================================================================
// CAMPAIGN ORCHESTRATION
// ============================================================================

/**
 * Main entry point for cron-triggered email campaigns.
 * Runs onboarding, retention, and conversion campaign checks.
 */
export async function runScheduledEmailCampaigns(
  db: AppDb,
  env: EnqueueEmailEnv,
) {
  log.info('Running scheduled email campaigns');

  // Run campaigns in sequence to avoid overwhelming the queue
  try {
    await runOnboardingCampaigns(db, env);
  } catch (error) {
    log.error('Onboarding campaign failed', error instanceof Error ? error : { error: String(error) });
  }

  try {
    await runRetentionCampaigns(db, env);
  } catch (error) {
    log.error('Retention campaign failed', error instanceof Error ? error : { error: String(error) });
  }

  log.info('Scheduled email campaigns complete');
}

/**
 * Enqueue newsletter for all subscribed users.
 */
export async function triggerWeeklyNewsletter(
  db: AppDb,
  env: EnqueueEmailEnv,
) {
  const subscribedUsers = await db
    .select()
    .from(user)
    .where(
      sql`EXISTS (
        SELECT 1 FROM ${emailPreference}
        WHERE ${emailPreference.userId} = ${user.id}
        AND ${emailPreference.category} = ${EmailCategories.NEWSLETTER}
        AND ${emailPreference.subscribed} = 1
        AND ${emailPreference.globalUnsubscribe} = 0
      )`,
    );

  let enqueued = 0;
  for (const subscribedUser of subscribedUsers) {
    const withinCap = await checkFrequencyCap(db, subscribedUser.id, EmailCategories.NEWSLETTER);
    if (!withinCap) {
      continue;
    }

    await enqueueEmail(db, env, {
      category: EmailCategories.NEWSLETTER,
      recipientEmail: subscribedUser.email,
      subject: 'DebateKit Weekly Digest',
      templateId: 'newsletter-weekly-digest',
      userId: subscribedUser.id,
    });

    enqueued++;
  }

  log.info('Weekly newsletter triggered', { enqueued, total: subscribedUsers.length });
}

// ============================================================================
// INTERNAL CAMPAIGN RUNNERS
// ============================================================================

async function runOnboardingCampaigns(db: AppDb, env: EnqueueEmailEnv) {
  // Get users eligible for welcome email
  const cohort = await getOnboardingCohort(db, 'onboarding-welcome');

  let enqueued = 0;
  for (const eligible of cohort) {
    const withinCap = await checkFrequencyCap(db, eligible.id, EmailCategories.TIPS);
    if (!withinCap) {
      continue;
    }

    await enqueueEmail(db, env, {
      category: EmailCategories.TIPS,
      recipientEmail: eligible.email,
      subject: 'Welcome to DebateKit',
      templateId: 'onboarding-welcome',
      userId: eligible.id,
    });

    enqueued++;
  }

  if (enqueued > 0) {
    log.info('Onboarding emails enqueued', { count: enqueued });
  }
}

async function runRetentionCampaigns(db: AppDb, env: EnqueueEmailEnv) {
  // 7-day inactive users
  const cohort7d = await getRetentionCohort(db, 7);

  let enqueued = 0;
  for (const eligible of cohort7d) {
    const withinCap = await checkFrequencyCap(db, eligible.id, EmailCategories.MARKETING);
    if (!withinCap) {
      continue;
    }

    await enqueueEmail(db, env, {
      category: EmailCategories.MARKETING,
      recipientEmail: eligible.email,
      subject: 'We miss you at DebateKit',
      templateId: 'retention-7d',
      userId: eligible.id,
    });

    enqueued++;
  }

  if (enqueued > 0) {
    log.info('Retention 7d emails enqueued', { count: enqueued });
  }
}
