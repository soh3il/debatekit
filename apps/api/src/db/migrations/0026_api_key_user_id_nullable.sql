-- Make user_id nullable in api_key table.
-- @better-auth/api-key v1.5.3 uses reference_id instead of user_id.
-- The plugin inserts NULL for user_id, so the NOT NULL constraint must be removed.
-- SQLite requires table recreation to alter column constraints.
-- See: https://better-auth.com/docs/plugins/api-key/reference

PRAGMA foreign_keys=OFF;

CREATE TABLE api_key_new (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL DEFAULT 'default',
  name TEXT,
  start TEXT,
  prefix TEXT,
  key TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  rate_limit_enabled INTEGER NOT NULL DEFAULT 1,
  rate_limit_max INTEGER,
  rate_limit_time_window INTEGER,
  request_count INTEGER NOT NULL DEFAULT 0,
  remaining INTEGER,
  refill_amount INTEGER,
  refill_interval INTEGER,
  last_refill_at INTEGER,
  last_request INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  permissions TEXT,
  metadata TEXT
);

INSERT INTO api_key_new (
  id, config_id, name, start, prefix, key, reference_id, user_id,
  enabled, rate_limit_enabled, rate_limit_max, rate_limit_time_window,
  request_count, remaining, refill_amount, refill_interval,
  last_refill_at, last_request, expires_at, created_at, updated_at,
  permissions, metadata
)
SELECT
  id, config_id, name, start, prefix, key, reference_id, user_id,
  enabled, rate_limit_enabled, rate_limit_max, rate_limit_time_window,
  request_count, remaining, refill_amount, refill_interval,
  last_refill_at, last_request, expires_at, created_at, updated_at,
  permissions, metadata
FROM api_key;

DROP TABLE api_key;
ALTER TABLE api_key_new RENAME TO api_key;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS api_key_config_idx ON api_key(config_id);
CREATE INDEX IF NOT EXISTS api_key_reference_idx ON api_key(reference_id);
CREATE INDEX IF NOT EXISTS api_key_key_idx ON api_key(key);

PRAGMA foreign_keys=ON;
