/**
 * Database Relations - Centralized Drizzle Relations
 *
 * Defines ALL relations for the API. Shared tables come from @debatekit/db,
 * but relations are defined here because the API extends some with
 * API-only tables (project, upload, working-memory, active-stream).
 *
 * NOTE: Cannot re-export shared relations because Drizzle requires exactly
 * one relation definition per table. API overrides chatThread and chatMessage
 * relations to add project/upload references.
 */

import {
  chatCustomRole,
  chatMessage,
  chatParticipant,
  chatPreSearch,
  chatThread,
  chatThreadChangelog,
  chatUserPreset,
  creditTransaction,
  mcpLog,
  mcpSession,
  roundExecution,
  user,
  userCreditBalance,
} from '@debatekit/db/tables';
import { relations } from 'drizzle-orm';

import { activeStream } from './active-stream';
import { chatProject, projectAttachment } from './project';
import { messageUpload, threadUpload, upload } from './upload';
import { workingMemory } from './working-memory';

// ============================================================================
// Chat Relations
// ============================================================================

export const chatThreadRelations = relations(chatThread, ({ many, one }) => ({
  changelog: many(chatThreadChangelog),
  messages: many(chatMessage),
  participants: many(chatParticipant),
  preSearches: many(chatPreSearch),
  project: one(chatProject, {
    fields: [chatThread.projectId],
    references: [chatProject.id],
  }),
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

export const chatMessageRelations = relations(chatMessage, ({ many, one }) => ({
  messageUploads: many(messageUpload),
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

export const activeStreamRelations = relations(activeStream, ({ one }) => ({
  thread: one(chatThread, {
    fields: [activeStream.threadId],
    references: [chatThread.id],
  }),
}));

// ============================================================================
// Project Relations
// ============================================================================

export const chatProjectRelations = relations(chatProject, ({ many, one }) => ({
  attachments: many(projectAttachment),
  threads: many(chatThread),
  user: one(user, {
    fields: [chatProject.userId],
    references: [user.id],
  }),
}));

export const projectAttachmentRelations = relations(projectAttachment, ({ one }) => ({
  addedByUser: one(user, {
    fields: [projectAttachment.addedBy],
    references: [user.id],
  }),
  project: one(chatProject, {
    fields: [projectAttachment.projectId],
    references: [chatProject.id],
  }),
  upload: one(upload, {
    fields: [projectAttachment.uploadId],
    references: [upload.id],
  }),
}));

// ============================================================================
// Upload Relations
// ============================================================================

export const uploadRelations = relations(upload, ({ many, one }) => ({
  messageUploads: many(messageUpload),
  threadUploads: many(threadUpload),
  user: one(user, {
    fields: [upload.userId],
    references: [user.id],
  }),
}));

export const threadUploadRelations = relations(threadUpload, ({ one }) => ({
  thread: one(chatThread, {
    fields: [threadUpload.threadId],
    references: [chatThread.id],
  }),
  upload: one(upload, {
    fields: [threadUpload.uploadId],
    references: [upload.id],
  }),
}));

export const messageUploadRelations = relations(messageUpload, ({ one }) => ({
  message: one(chatMessage, {
    fields: [messageUpload.messageId],
    references: [chatMessage.id],
  }),
  upload: one(upload, {
    fields: [messageUpload.uploadId],
    references: [upload.id],
  }),
}));

// ============================================================================
// Working Memory Relations
// ============================================================================

export const workingMemoryRelations = relations(workingMemory, ({ one }) => ({
  user: one(user, {
    fields: [workingMemory.userId],
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

// ============================================================================
// Credit Relations
// ============================================================================

export const userCreditBalanceRelations = relations(userCreditBalance, ({ one }) => ({
  user: one(user, {
    fields: [userCreditBalance.userId],
    references: [user.id],
  }),
}));

export const creditTransactionRelations = relations(creditTransaction, ({ one }) => ({
  thread: one(chatThread, {
    fields: [creditTransaction.threadId],
    references: [chatThread.id],
  }),
  user: one(user, {
    fields: [creditTransaction.userId],
    references: [user.id],
  }),
}));
