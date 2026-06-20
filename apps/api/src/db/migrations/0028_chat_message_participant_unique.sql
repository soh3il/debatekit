-- Idempotency guard for participant turns.
--
-- Each participant produces exactly ONE message per round (the moderator's
-- message has participant_id = NULL and is excluded). Before this migration there
-- was no DB-level uniqueness, so a queue retry or two workers racing the same
-- round could persist DUPLICATE participant turns (the same agent appearing
-- twice). This adds a partial unique index on the business key so duplicate
-- inserts are rejected, and `.onConflictDoNothing()` in the persist paths makes
-- retries a safe no-op.
--
-- Existing duplicates must be removed first or the CREATE UNIQUE INDEX fails.
-- Dedup keeps, per (thread_id, round_number, participant_id): a successful
-- message over a "hasError" placeholder, then the most recent by created_at.

DELETE FROM `chat_message`
WHERE `participant_id` IS NOT NULL
  AND `rowid` NOT IN (
    SELECT `rowid` FROM (
      SELECT
        `rowid`,
        ROW_NUMBER() OVER (
          PARTITION BY `thread_id`, `round_number`, `participant_id`
          ORDER BY
            (CASE WHEN `metadata` LIKE '%"hasError":true%' THEN 1 ELSE 0 END) ASC,
            `created_at` DESC,
            `rowid` DESC
        ) AS `rn`
      FROM `chat_message`
      WHERE `participant_id` IS NOT NULL
    )
    WHERE `rn` = 1
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_message_thread_round_participant_unique`
  ON `chat_message` (`thread_id`, `round_number`, `participant_id`)
  WHERE `participant_id` IS NOT NULL;
