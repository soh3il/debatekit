-- Email marketing tables: preferences, send log, and suppression list.
-- Supports per-category opt-out, send tracking with SES integration,
-- and bounce/complaint suppression management.

-- ============================================================================
-- email_preference: Per-user email category subscription preferences
-- ============================================================================

CREATE TABLE `email_preference` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `category` text NOT NULL,
  `subscribed` integer NOT NULL DEFAULT 1,
  `global_unsubscribe` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `email_preference_user_category_idx` ON `email_preference` (`user_id`, `category`);
CREATE INDEX `email_preference_user_id_idx` ON `email_preference` (`user_id`);

-- ============================================================================
-- email_send_log: Tracks every email sent with delivery status
-- ============================================================================

CREATE TABLE `email_send_log` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text REFERENCES `user`(`id`) ON DELETE SET NULL,
  `recipient_email` text NOT NULL,
  `template_id` text NOT NULL,
  `category` text NOT NULL,
  `subject` text NOT NULL,
  `status` text NOT NULL DEFAULT 'queued',
  `ses_message_id` text,
  `metadata` text,
  `opened_at` integer,
  `clicked_at` integer,
  `bounced_at` integer,
  `complained_at` integer,
  `error_message` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX `email_send_log_user_id_idx` ON `email_send_log` (`user_id`);
CREATE INDEX `email_send_log_status_idx` ON `email_send_log` (`status`);
CREATE INDEX `email_send_log_template_id_idx` ON `email_send_log` (`template_id`);
CREATE INDEX `email_send_log_ses_message_id_idx` ON `email_send_log` (`ses_message_id`);

-- ============================================================================
-- email_suppression: Global suppression list for bounces/complaints
-- ============================================================================

CREATE TABLE `email_suppression` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `reason` text NOT NULL,
  `source` text NOT NULL,
  `suppressed_at` integer NOT NULL,
  `expires_at` integer,
  `created_at` integer NOT NULL
);
