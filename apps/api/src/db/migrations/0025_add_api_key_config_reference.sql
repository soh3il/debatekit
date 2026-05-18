-- Add config_id and reference_id columns to api_key table.
-- Required by @better-auth/api-key v1.5.3 upgrade:
-- - config_id: multi-configuration support (defaults to 'default')
-- - reference_id: generalized owner reference (replaces direct userId lookup)
-- Existing rows get reference_id = user_id for backwards compatibility.

ALTER TABLE api_key ADD COLUMN config_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE api_key ADD COLUMN reference_id TEXT NOT NULL DEFAULT '';

-- Backfill reference_id from user_id for existing keys
UPDATE api_key SET reference_id = user_id WHERE reference_id = '';

-- Add indexes for the new fields (plugin expects indexed lookups)
CREATE INDEX IF NOT EXISTS api_key_config_idx ON api_key(config_id);
CREATE INDEX IF NOT EXISTS api_key_reference_idx ON api_key(reference_id);
