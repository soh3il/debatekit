-- MCP Tables: Session history, prompt templates, and structured logs.

-- ============================================================================
-- MCP SESSION
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  total_credits INTEGER NOT NULL,
  thinking_level TEXT NOT NULL,
  format TEXT NOT NULL,
  mode TEXT NOT NULL,
  model_ids_json TEXT NOT NULL,
  quality_score INTEGER,
  evaluation_status TEXT NOT NULL DEFAULT 'pending' CHECK(evaluation_status IN ('pending', 'completed', 'failed')),
  execution_mode TEXT NOT NULL DEFAULT 'sequential' CHECK(execution_mode IN ('sequential', 'parallel')),
  prompt_version INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS mcp_session_user_idx ON mcp_session(user_id);
CREATE INDEX IF NOT EXISTS mcp_session_tool_idx ON mcp_session(tool_name);
CREATE INDEX IF NOT EXISTS mcp_session_created_idx ON mcp_session(created_at);
CREATE INDEX IF NOT EXISTS mcp_session_user_created_idx ON mcp_session(user_id, created_at);

-- ============================================================================
-- MCP PROMPT TEMPLATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_prompt_template (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK(template_type IN ('participant_system', 'moderator_synthesis', 'evaluator')),
  version INTEGER NOT NULL DEFAULT 1,
  template_text TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  avg_quality_score INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS mcp_prompt_template_tool_idx ON mcp_prompt_template(tool_name);
CREATE INDEX IF NOT EXISTS mcp_prompt_template_type_idx ON mcp_prompt_template(template_type);
CREATE INDEX IF NOT EXISTS mcp_prompt_template_active_idx ON mcp_prompt_template(is_active);

-- ============================================================================
-- MCP LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_log (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES mcp_session(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK(level IN ('info', 'warn', 'error')),
  event TEXT NOT NULL,
  data_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS mcp_log_session_idx ON mcp_log(session_id);
CREATE INDEX IF NOT EXISTS mcp_log_user_idx ON mcp_log(user_id);
CREATE INDEX IF NOT EXISTS mcp_log_level_idx ON mcp_log(level);
CREATE INDEX IF NOT EXISTS mcp_log_created_idx ON mcp_log(created_at);
CREATE INDEX IF NOT EXISTS mcp_log_user_created_idx ON mcp_log(user_id, created_at);
