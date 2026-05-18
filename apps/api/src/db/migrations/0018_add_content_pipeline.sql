CREATE TABLE `content_pipeline_run` (
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_job_ids` text,
	`created_tweet_ids` text,
	`discovered_topics` text,
	`error_message` text,
	`id` text PRIMARY KEY NOT NULL,
	`metadata` text,
	`selected_topics` text,
	`started_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`trigger_type` text DEFAULT 'cron' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`viral_scores` text
);
--> statement-breakpoint
CREATE INDEX `content_pipeline_run_status_idx` ON `content_pipeline_run` (`status`);
--> statement-breakpoint
CREATE INDEX `content_pipeline_run_trigger_type_idx` ON `content_pipeline_run` (`trigger_type`);
--> statement-breakpoint
CREATE INDEX `content_pipeline_run_created_idx` ON `content_pipeline_run` (`created_at`);
--> statement-breakpoint
ALTER TABLE `scheduled_tweet` ADD `viral_score` integer;
--> statement-breakpoint
ALTER TABLE `scheduled_tweet` ADD `pipeline_run_id` text REFERENCES `content_pipeline_run`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `scheduled_tweet_pipeline_idx` ON `scheduled_tweet` (`pipeline_run_id`);
