-- Add 'unified' to active_stream entity_type CHECK constraint
-- Required for unified round streaming (single SSE connection for entire round)
--
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints directly.
-- We need to recreate the table with the updated constraint.

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE active_stream_new (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'participant' CHECK(entity_type IN ('presearch', 'participant', 'moderator', 'unified')),
  entity_index INTEGER,
  stream_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy existing data
INSERT INTO active_stream_new SELECT * FROM active_stream;

-- Step 3: Drop old table
DROP TABLE active_stream;

-- Step 4: Rename new table
ALTER TABLE active_stream_new RENAME TO active_stream;

-- Step 5: Recreate indexes
CREATE INDEX idx_active_stream_thread ON active_stream(thread_id);
CREATE UNIQUE INDEX idx_active_stream_lookup ON active_stream(thread_id, round_number, entity_type, entity_index);
