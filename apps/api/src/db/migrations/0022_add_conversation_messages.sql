-- Conversation Messages: Required by @ai-sdk-tools/memory DrizzleProvider constructor
-- Matches library's createSqliteMessagesSchema() output exactly
-- Not used for message storage (chatMessage table is the primary store)

CREATE TABLE IF NOT EXISTS conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  user_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS conversation_messages_chat_idx ON conversation_messages(chat_id, timestamp);
