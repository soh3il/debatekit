ALTER TABLE chat_podcast ADD COLUMN progress INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE chat_podcast ADD COLUMN episode_title TEXT;
