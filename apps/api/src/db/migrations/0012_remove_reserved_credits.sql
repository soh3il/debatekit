-- Remove reserved_credits column from user_credit_balance
-- SQLite DROP COLUMN fails when CHECK constraints reference the column,
-- so we rebuild the table without the column and its constraint.

PRAGMA foreign_keys=OFF;

CREATE TABLE `user_credit_balance_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`plan_type` text DEFAULT 'free' NOT NULL,
	`monthly_credits` integer DEFAULT 0 NOT NULL,
	`last_refill_at` integer,
	`next_refill_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_balance_non_negative" CHECK("user_credit_balance_new"."balance" >= 0),
	CONSTRAINT "check_monthly_credits_non_negative" CHECK("user_credit_balance_new"."monthly_credits" >= 0),
	CONSTRAINT "check_version_positive" CHECK("user_credit_balance_new"."version" > 0)
);

INSERT INTO `user_credit_balance_new` (`id`, `user_id`, `balance`, `plan_type`, `monthly_credits`, `last_refill_at`, `next_refill_at`, `version`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `balance`, `plan_type`, `monthly_credits`, `last_refill_at`, `next_refill_at`, `version`, `created_at`, `updated_at`
FROM `user_credit_balance`;

DROP TABLE `user_credit_balance`;

ALTER TABLE `user_credit_balance_new` RENAME TO `user_credit_balance`;

CREATE UNIQUE INDEX `user_credit_balance_user_id_unique` ON `user_credit_balance` (`user_id`);
CREATE INDEX `user_credit_balance_user_idx` ON `user_credit_balance` (`user_id`);
CREATE INDEX `user_credit_balance_next_refill_idx` ON `user_credit_balance` (`next_refill_at`);

PRAGMA foreign_keys=ON;
