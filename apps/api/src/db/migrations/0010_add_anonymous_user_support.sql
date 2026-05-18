-- Migration: Add anonymous user support
-- Purpose: Enable anonymous guest trial - 1 free round without signup

-- Add is_anonymous column to user table
ALTER TABLE `user` ADD COLUMN `is_anonymous` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Create anonymous_identity table
CREATE TABLE `anonymous_identity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`anonymous_token` text NOT NULL,
	`fingerprint_hash` text,
	`ip_address` text,
	`user_agent` text,
	`round_completed` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
	`updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anonymous_identity_user_id_unique` ON `anonymous_identity` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `anon_identity_token_idx` ON `anonymous_identity` (`anonymous_token`);
--> statement-breakpoint
CREATE INDEX `anon_identity_fingerprint_idx` ON `anonymous_identity` (`fingerprint_hash`);
--> statement-breakpoint
CREATE INDEX `anon_identity_ip_idx` ON `anonymous_identity` (`ip_address`);
