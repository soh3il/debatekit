-- Add thread_id column to mcp_session for linking sessions to chat threads.
-- Thread creator (apps/mcp/src/engine/thread-creator.ts) creates a chat_thread
-- from each MCP debate, and with-credits.ts links them via this column.

ALTER TABLE mcp_session ADD COLUMN thread_id TEXT REFERENCES chat_thread(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mcp_session_thread_idx ON mcp_session(thread_id);
