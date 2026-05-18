CREATE TABLE `scheduled_tweet` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text,
	`thread_id` text,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`scheduled_at` integer,
	`sent_at` integer,
	`twitter_post_id` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `automated_job`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_thread`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scheduled_tweet_user_idx` ON `scheduled_tweet` (`user_id`);
--> statement-breakpoint
CREATE INDEX `scheduled_tweet_status_idx` ON `scheduled_tweet` (`status`);
--> statement-breakpoint
CREATE INDEX `scheduled_tweet_scheduled_at_idx` ON `scheduled_tweet` (`scheduled_at`);
--> statement-breakpoint
CREATE INDEX `scheduled_tweet_job_idx` ON `scheduled_tweet` (`job_id`);
--> statement-breakpoint
CREATE INDEX `scheduled_tweet_thread_idx` ON `scheduled_tweet` (`thread_id`);
