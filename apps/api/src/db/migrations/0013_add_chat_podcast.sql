-- Chat Podcast table for AI-generated audio podcasts from debatekit discussions.
-- Each AI model gets a distinct ElevenLabs voice, moderator narrates.
-- Unique constraint: one podcast per thread + scope + roundNumber combo.

CREATE TABLE IF NOT EXISTS `chat_podcast` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL CHECK(`scope` IN ('thread', 'round')),
	`round_number` integer,
	`episode_number` integer,
	`status` text NOT NULL DEFAULT 'pending' CHECK(`status` IN ('pending', 'generating_script', 'generating_audio', 'uploading', 'completed', 'failed')),
	`audio_r2_key` text,
	`audio_duration_ms` integer,
	`audio_size_bytes` integer,
	`character_count` integer,
	`credits_used` integer,
	`script_data` text,
	`error_message` text,
	`created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
	`completed_at` integer,
	`updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`thread_id`) REFERENCES `chat_thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `chat_podcast_thread_idx` ON `chat_podcast` (`thread_id`);
CREATE INDEX IF NOT EXISTS `chat_podcast_user_idx` ON `chat_podcast` (`user_id`);
CREATE INDEX IF NOT EXISTS `chat_podcast_status_idx` ON `chat_podcast` (`status`);
CREATE UNIQUE INDEX IF NOT EXISTS `chat_podcast_thread_scope_round_unique` ON `chat_podcast` (`thread_id`, `scope`, `round_number`);
