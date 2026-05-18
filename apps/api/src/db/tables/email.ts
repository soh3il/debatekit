import { user } from '@debatekit/db/tables';
import {
  DEFAULT_EMAIL_SEND_STATUS,
  EMAIL_CATEGORIES,
  EMAIL_SEND_STATUSES,
  EMAIL_SUPPRESSION_REASONS,
  EMAIL_TEMPLATE_IDS,
} from '@debatekit/shared/enums';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { EmailSendLogMetadataType } from '@/db/validation/email-marketing';

// ============================================================================
// Email Preference
// ============================================================================

/**
 * Email Preference - Per-user email category subscription settings
 *
 * One row per user+category combination. Controls whether a user
 * receives emails for a given category. `globalUnsubscribe` overrides
 * all category-level subscriptions.
 */
export const emailPreference = sqliteTable(
  'email_preference',
  {
    category: text('category', { enum: EMAIL_CATEGORIES }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    globalUnsubscribe: integer('global_unsubscribe', { mode: 'boolean' })
      .default(false)
      .notNull(),
    id: text('id').primaryKey(),
    subscribed: integer('subscribed', { mode: 'boolean' })
      .default(true)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  table => [
    uniqueIndex('email_preference_user_category_idx').on(table.userId, table.category),
    index('email_preference_user_id_idx').on(table.userId),
  ],
);

// ============================================================================
// Email Send Log
// ============================================================================

/**
 * Email Send Log - Tracks every email sent with delivery status
 *
 * Records template, recipient, SES message ID, and engagement events
 * (opens, clicks, bounces, complaints). Used for analytics and debugging.
 */
export const emailSendLog = sqliteTable(
  'email_send_log',
  {
    bouncedAt: integer('bounced_at', { mode: 'timestamp_ms' }),
    category: text('category', { enum: EMAIL_CATEGORIES }).notNull(),
    clickedAt: integer('clicked_at', { mode: 'timestamp_ms' }),
    complainedAt: integer('complained_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    errorMessage: text('error_message'),
    id: text('id').primaryKey(),
    // TYPE-SAFE: Email send log metadata (string-to-string map) - type inferred from validation schema
    metadata: text('metadata', { mode: 'json' }).$type<EmailSendLogMetadataType>(),
    openedAt: integer('opened_at', { mode: 'timestamp_ms' }),
    recipientEmail: text('recipient_email').notNull(),
    sesMessageId: text('ses_message_id'),
    status: text('status', { enum: EMAIL_SEND_STATUSES })
      .notNull()
      .default(DEFAULT_EMAIL_SEND_STATUS),
    subject: text('subject').notNull(),
    templateId: text('template_id', { enum: EMAIL_TEMPLATE_IDS }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  },
  table => [
    index('email_send_log_user_id_idx').on(table.userId),
    index('email_send_log_status_idx').on(table.status),
    index('email_send_log_template_id_idx').on(table.templateId),
    index('email_send_log_ses_message_id_idx').on(table.sesMessageId),
  ],
);

// ============================================================================
// Email Suppression
// ============================================================================

/**
 * Email Suppression - Global suppression list for bounces and complaints
 *
 * Prevents sending to addresses that have hard-bounced, complained,
 * or been manually suppressed. Optional expiry for soft bounces.
 */
export const emailSuppression = sqliteTable(
  'email_suppression',
  {
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    email: text('email').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    id: text('id').primaryKey(),
    reason: text('reason', { enum: EMAIL_SUPPRESSION_REASONS }).notNull(),
    source: text('source').notNull(),
    suppressedAt: integer('suppressed_at', { mode: 'timestamp_ms' }).notNull(),
  },
);

// ============================================================================
// Relations
// ============================================================================

export const emailPreferenceRelations = relations(emailPreference, ({ one }) => ({
  user: one(user, {
    fields: [emailPreference.userId],
    references: [user.id],
  }),
}));

export const emailSendLogRelations = relations(emailSendLog, ({ one }) => ({
  user: one(user, {
    fields: [emailSendLog.userId],
    references: [user.id],
  }),
}));
