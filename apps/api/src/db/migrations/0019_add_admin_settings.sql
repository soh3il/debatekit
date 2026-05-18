CREATE TABLE `admin_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`value` text NOT NULL
);
