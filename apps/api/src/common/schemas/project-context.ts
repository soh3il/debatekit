/**
 * Project Context Schemas
 *
 * Centralized Zod schemas for project context service contracts.
 * Single source of truth for RAG context, memories, chats, searches, and moderators.
 */

import * as z from 'zod';

import type { AppDb } from '@/db';

// ============================================================================
// ATTACHMENT SOURCE (5-part enum pattern)
// ============================================================================

// 1. ARRAY CONSTANT
export const ATTACHMENT_SOURCE_VALUES = ['project', 'thread'] as const;

// 2. ZOD SCHEMA
export const AttachmentSourceSchema = z.enum(ATTACHMENT_SOURCE_VALUES);

// 3. TYPESCRIPT TYPE
export type AttachmentSource = z.infer<typeof AttachmentSourceSchema>;

// 4. DEFAULT VALUE
export const DEFAULT_ATTACHMENT_SOURCE: AttachmentSource = 'project';

// 5. CONSTANT OBJECT
export const AttachmentSources = {
  PROJECT: 'project' as const,
  THREAD: 'thread' as const,
} as const;

// ============================================================================
// Memory Context Schemas
// ============================================================================

export const ProjectMemoryItemSchema = z.object({
  content: z.string(),
  id: z.string().min(1),
  importance: z.number().int().nonnegative(),
  source: z.string(),
  sourceThreadId: z.string().nullable(),
  summary: z.string().nullable(),
});

export type ProjectMemoryItem = z.infer<typeof ProjectMemoryItemSchema>;

export const ProjectMemoryContextSchema = z.object({
  memories: z.array(ProjectMemoryItemSchema),
  totalCount: z.number().int().nonnegative(),
});

export type ProjectMemoryContext = z.infer<typeof ProjectMemoryContextSchema>;

// ============================================================================
// Chat Context Schemas
// ============================================================================

export const ProjectChatMessageSchema = z.object({
  content: z.string(),
  role: z.string(),
  roundNumber: z.number().int().nonnegative(),
});

export type ProjectChatMessage = z.infer<typeof ProjectChatMessageSchema>;

export const ProjectChatThreadSchema = z.object({
  id: z.string().min(1),
  messages: z.array(ProjectChatMessageSchema),
  title: z.string(),
});

export type ProjectChatThread = z.infer<typeof ProjectChatThreadSchema>;

export const ProjectChatContextSchema = z.object({
  threads: z.array(ProjectChatThreadSchema),
  totalThreads: z.number().int().nonnegative(),
});

export type ProjectChatContext = z.infer<typeof ProjectChatContextSchema>;

// ============================================================================
// Search Context Schemas
// ============================================================================

export const ProjectSearchResultSchema = z.object({
  answer: z.string().nullable(),
  query: z.string(),
});

export type ProjectSearchResult = z.infer<typeof ProjectSearchResultSchema>;

export const ProjectSearchItemSchema = z.object({
  results: z.array(ProjectSearchResultSchema),
  roundNumber: z.number().int().nonnegative(),
  summary: z.string().nullable(),
  threadId: z.string().min(1),
  threadTitle: z.string(),
  userQuery: z.string(),
});

export type ProjectSearchItem = z.infer<typeof ProjectSearchItemSchema>;

export const ProjectSearchContextSchema = z.object({
  searches: z.array(ProjectSearchItemSchema),
  totalCount: z.number().int().nonnegative(),
});

export type ProjectSearchContext = z.infer<typeof ProjectSearchContextSchema>;

// ============================================================================
// Moderator Context Schemas
// ============================================================================

export const ProjectModeratorItemSchema = z.object({
  keyThemes: z.string().nullable(),
  moderator: z.string(),
  recommendations: z.array(z.string()),
  roundNumber: z.number().int().nonnegative(),
  threadId: z.string().min(1),
  threadTitle: z.string(),
  userQuestion: z.string(),
});

export type ProjectModeratorItem = z.infer<typeof ProjectModeratorItemSchema>;

export const ProjectModeratorContextSchema = z.object({
  moderators: z.array(ProjectModeratorItemSchema),
  totalCount: z.number().int().nonnegative(),
});

export type ProjectModeratorContext = z.infer<typeof ProjectModeratorContextSchema>;

// ============================================================================
// Attachment Context Schemas
// ============================================================================

export const ProjectAttachmentItemSchema = z.object({
  filename: z.string(),
  fileSize: z.number().int().nonnegative(),
  id: z.string().min(1),
  mimeType: z.string(),
  r2Key: z.string(),
  source: AttachmentSourceSchema,
  textContent: z.string().nullable(),
  threadId: z.string().nullable(),
  threadTitle: z.string().nullable(),
});

export type ProjectAttachmentItem = z.infer<typeof ProjectAttachmentItemSchema>;

export const ProjectAttachmentContextSchema = z.object({
  attachments: z.array(ProjectAttachmentItemSchema),
  totalCount: z.number().int().nonnegative(),
});

export type ProjectAttachmentContext = z.infer<typeof ProjectAttachmentContextSchema>;

// ============================================================================
// Aggregated Context Schema
// ============================================================================

export const AggregatedProjectContextSchema = z.object({
  attachments: ProjectAttachmentContextSchema,
  chats: ProjectChatContextSchema,
  memories: ProjectMemoryContextSchema,
  moderators: ProjectModeratorContextSchema,
  searches: ProjectSearchContextSchema,
});

export type AggregatedProjectContext = z.infer<typeof AggregatedProjectContextSchema>;

// ============================================================================
// Project Context Params Schema
// ============================================================================

/** Explicit type to annotate schema and prevent TS7056 */
export type ProjectContextParams = {
  currentThreadId: string;
  db: AppDb;
  maxMemories?: number;
  maxMessagesPerThread?: number;
  maxModerators?: number;
  maxSearchResults?: number;
  projectId: string;
  r2Bucket?: R2Bucket;
  userQuery: string;
};

const _ProjectContextParamsSchema = z.object({
  currentThreadId: z.string().min(1),
  db: z.custom<AppDb>(),
  maxMemories: z.number().int().positive().optional(),
  maxMessagesPerThread: z.number().int().positive().optional(),
  maxModerators: z.number().int().positive().optional(),
  maxSearchResults: z.number().int().positive().optional(),
  projectId: z.string().min(1),
  r2Bucket: z.custom<R2Bucket>().optional(),
  userQuery: z.string(),
});

export const ProjectContextParamsSchema: z.ZodType<ProjectContextParams> = _ProjectContextParamsSchema;

// ============================================================================
// RAG Context Params Schema
// ============================================================================

/** Explicit type to annotate schema and prevent TS7056 */
export type ProjectRagContextParams = {
  ai: Ai | undefined;
  db: AppDb;
  maxResults?: number;
  projectId: string;
  query: string;
  userId?: string;
};

export const ProjectRagContextParamsSchema: z.ZodType<ProjectRagContextParams> = z.object({
  ai: z.custom<Ai | undefined>(),
  db: z.custom<AppDb>(),
  maxResults: z.number().int().positive().optional(),
  projectId: z.string().min(1),
  query: z.string().min(1),
  userId: z.string().min(1).optional(),
});

// ============================================================================
// Citable Context Params Schema
// ============================================================================

/** Explicit type to annotate schema and prevent TS7056 */
export type CitableContextParams = ProjectContextParams & {
  baseUrl: string;
  includeAttachments?: boolean;
};

export const CitableContextParamsSchema: z.ZodType<CitableContextParams> = _ProjectContextParamsSchema.extend({
  baseUrl: z.string().min(1).describe('Base URL for generating absolute download URLs'),
  includeAttachments: z.boolean().optional(),
});
