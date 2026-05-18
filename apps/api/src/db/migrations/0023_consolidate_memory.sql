-- Consolidate memory: drop project_memory table, clean up user-scoped working memory
-- Project memory is now unified into working_memory with scope='chat' and chatId=projectId

DROP TABLE IF EXISTS project_memory;
DELETE FROM working_memory WHERE scope = 'user';
