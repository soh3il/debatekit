/**
 * Shared Database Relations
 *
 * Relations for tables that live in @debatekit/db.
 * API-only relations (project, upload, etc.) remain in apps/api.
 */

import { relations } from 'drizzle-orm';

import { user } from './auth';
import {
  chatCustomRole,
  chatMessage,
  chatParticipant,
  chatPreSearch,
  chatThread,
  chatThreadChangelog,
  chatUserPreset,
  roundExecution,
} from './chat';
import { mcpLog, mcpSession } from './mcp';

// ============================================================================
// Chat Relations
// ============================================================================

export const chatThreadRelations = relations(chatThread, ({ many, one }) => ({
  changelog: many(chatThreadChangelog),
  messages: many(chatMessage),
  participants: many(chatParticipant),
  preSearches: many(chatPreSearch),
  user: one(user, {
    fields: [chatThread.userId],
    references: [user.id],
  }),
}));

export const chatCustomRoleRelations = relations(chatCustomRole, ({ many, one }) => ({
  participants: many(chatParticipant),
  user: one(user, {
    fields: [chatCustomRole.userId],
    references: [user.id],
  }),
}));

export const chatUserPresetRelations = relations(chatUserPreset, ({ one }) => ({
  user: one(user, {
    fields: [chatUserPreset.userId],
    references: [user.id],
  }),
}));

export const chatParticipantRelations = relations(chatParticipant, ({ many, one }) => ({
  customRole: one(chatCustomRole, {
    fields: [chatParticipant.customRoleId],
    references: [chatCustomRole.id],
  }),
  messages: many(chatMessage),
  thread: one(chatThread, {
    fields: [chatParticipant.threadId],
    references: [chatThread.id],
  }),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  participant: one(chatParticipant, {
    fields: [chatMessage.participantId],
    references: [chatParticipant.id],
  }),
  thread: one(chatThread, {
    fields: [chatMessage.threadId],
    references: [chatThread.id],
  }),
}));

export const chatThreadChangelogRelations = relations(chatThreadChangelog, ({ one }) => ({
  thread: one(chatThread, {
    fields: [chatThreadChangelog.threadId],
    references: [chatThread.id],
  }),
}));

export const chatPreSearchRelations = relations(chatPreSearch, ({ one }) => ({
  thread: one(chatThread, {
    fields: [chatPreSearch.threadId],
    references: [chatThread.id],
  }),
}));

export const roundExecutionRelations = relations(roundExecution, ({ one }) => ({
  thread: one(chatThread, {
    fields: [roundExecution.threadId],
    references: [chatThread.id],
  }),
  user: one(user, {
    fields: [roundExecution.userId],
    references: [user.id],
  }),
}));

// ============================================================================
// MCP Relations
// ============================================================================

export const mcpSessionRelations = relations(mcpSession, ({ many, one }) => ({
  logs: many(mcpLog),
  user: one(user, {
    fields: [mcpSession.userId],
    references: [user.id],
  }),
}));

export const mcpLogRelations = relations(mcpLog, ({ one }) => ({
  session: one(mcpSession, {
    fields: [mcpLog.sessionId],
    references: [mcpSession.id],
  }),
  user: one(user, {
    fields: [mcpLog.userId],
    references: [user.id],
  }),
}));
