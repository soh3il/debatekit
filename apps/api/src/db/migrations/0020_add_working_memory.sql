-- Working Memory: AI-maintained persistent scratchpad
-- Compatible with @ai-sdk-tools/memory DrizzleProvider schema
-- Two scopes: 'user' (cross-conversation) and 'chat' (per-thread)

CREATE TABLE IF NOT EXISTS working_memory (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('chat', 'user')),
  chat_id TEXT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS working_memory_scope_idx ON working_memory(scope);
CREATE INDEX IF NOT EXISTS working_memory_user_idx ON working_memory(user_id);
CREATE INDEX IF NOT EXISTS working_memory_chat_idx ON working_memory(chat_id);
CREATE INDEX IF NOT EXISTS working_memory_chat_scope_idx ON working_memory(chat_id, scope);
