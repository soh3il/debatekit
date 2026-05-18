/**
 * Database Tables - Barrel Export
 *
 * Shared tables come from @debatekit/db/tables (single source of truth).
 * Only TABLE definitions are re-exported (NOT shared relations) because
 * API defines its own complete relation set in ./relations.
 */

// Shared tables: auth
export { account, apiKey, session, user, verification } from '@debatekit/db/tables';

// Shared tables: chat
export {
  chatCustomRole,
  chatMessage,
  chatParticipant,
  chatPodcast,
  chatPreSearch,
  chatThread,
  chatThreadChangelog,
  chatUserPreset,
  roundExecution,
} from '@debatekit/db/tables';

// Shared tables: credits
export { creditTransaction, userCreditBalance } from '@debatekit/db/tables';

// Shared tables: mcp
export { mcpLog, mcpPromptTemplate, mcpSession } from '@debatekit/db/tables';

// API-only tables
export * from './active-stream';
export * from './admin-settings';
export * from './billing';
export * from './conversation-messages';
export * from './deleted-account-audit';
export * from './email';
export * from './job';
export * from './pipeline';
export * from './project';
export * from './tweet';
export * from './upload';
export * from './usage';
export * from './working-memory';

// Relations (API-complete set, overrides shared relation defs)
export * from './relations';
