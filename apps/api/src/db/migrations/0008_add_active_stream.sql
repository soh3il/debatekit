-- Per AI SDK docs: "Storage to track which stream belongs to each chat"
-- Extended for multi-entity: one activeStreamId per entity type per round

CREATE TABLE IF NOT EXISTS active_stream (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'participant' CHECK(entity_type IN ('presearch', 'participant', 'moderator')),
  entity_index INTEGER,
  stream_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_active_stream_thread ON active_stream(thread_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_stream_lookup ON active_stream(thread_id, round_number, entity_type, entity_index);
