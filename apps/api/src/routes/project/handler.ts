import type { RouteHandler } from '@hono/zod-openapi';
import { PROJECT_LIMITS, WebAppEnvs } from '@debatekit/shared';
import { DEFAULT_PROJECT_INDEX_STATUS, SubscriptionTiers, ThreadStatuses } from '@debatekit/shared/enums';
import { and, eq, inArray, like } from 'drizzle-orm';
import { ulid } from 'ulid';

import { invalidateProjectCache, invalidatePublicThreadCache } from '@/common/cache-utils';
import { createError } from '@/common/error-handling';
import {
  applyCursorPagination,
  buildCursorWhereWithFilters,
  createHandler,
  createTimestampCursor,
  getCursorOrderBy,
  IdParamSchema,
  Responses,
} from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import type { ChatProjectUpdate, ProjectAttachmentRagMetadata } from '@/db/validation/project';
import { projectTracking } from '@/lib/analytics';
import { log } from '@/lib/logger';
import { deductCreditsForAction } from '@/services/billing/credit.service';
import {
  getAggregatedProjectContext,
} from '@/services/context';
import { generateProjectFileR2Key } from '@/services/search';
import { cancelUploadCleanup, copyFile, deleteFile, isCleanupSchedulerAvailable } from '@/services/uploads';
import { getUserTier } from '@/services/usage';
import {
  enrichProjectWithCounts,
  omitUploadR2Key,
  verifyProjectOwnership,
  verifyUploadOwnership,
} from '@/shared-operations';
import type { ApiEnv } from '@/types';

import type {
  addAttachmentToProjectRoute,
  createProjectRoute,
  deleteProjectRoute,
  getProjectAttachmentRoute,
  getProjectContextRoute,
  getProjectLimitsRoute,
  getProjectRoute,
  listProjectAttachmentsRoute,
  listProjectsRoute,
  listProjectThreadsRoute,
  removeAttachmentFromProjectRoute,
  updateProjectAttachmentRoute,
  updateProjectRoute,
} from './route';
import {
  AddUploadToProjectRequestSchema,
  CreateProjectRequestSchema,
  ListProjectAttachmentsQuerySchema,
  ListProjectsQuerySchema,
  ListProjectThreadsQuerySchema,
  ProjectAttachmentParamSchema,
  UpdateProjectAttachmentRequestSchema,
  UpdateProjectRequestSchema,
} from './schema';

// ============================================================================
// PROJECT HANDLERS
// ============================================================================

/**
 * List all projects for the authenticated user
 */
export const listProjectsHandler: RouteHandler<typeof listProjectsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'listProjects',
    validateQuery: ListProjectsQuerySchema,
  },
  async (c) => {
    const { user } = c.auth();
    const query = c.validated.query;
    const db = await getDbAsync();

    // Build filters
    const filters = [eq(tables.chatProject.userId, user.id)];

    if (query.search) {
      filters.push(like(tables.chatProject.name, `%${query.search}%`));
    }

    // ✅ PERF: Fetch projects with relations in single query using Drizzle relational
    const projects = await db.query.chatProject.findMany({
      limit: query.limit + 1,
      orderBy: getCursorOrderBy(tables.chatProject.createdAt, 'desc'),
      where: buildCursorWhereWithFilters(
        tables.chatProject.createdAt,
        query.cursor,
        'desc',
        filters,
      ),
      with: {
        attachments: {
          columns: { id: true },
        },
        threads: {
          columns: { id: true },
        },
      },
    });

    // Transform to include counts
    const projectsWithCounts = projects.map((project) => {
      const { attachments, threads, ...projectData } = project;
      return {
        ...projectData,
        attachmentCount: attachments?.length ?? 0,
        threadCount: threads?.length ?? 0,
      };
    });

    // Apply pagination
    const { items, pagination } = applyCursorPagination(
      projectsWithCounts,
      query.limit,
      project => createTimestampCursor(project.createdAt),
    );

    return Responses.cursorPaginated(c, items, pagination);
  },
);

/**
 * Get project limits for current user based on subscription tier
 */
export const getProjectLimitsHandler: RouteHandler<typeof getProjectLimitsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getProjectLimits',
  },
  async (c) => {
    const { user } = c.auth();
    const db = await getDbAsync();

    const tier = await getUserTier(user.id);

    // Get current project count
    const existingProjects = await db.query.chatProject.findMany({
      columns: { id: true },
      where: eq(tables.chatProject.userId, user.id),
    });

    const currentProjects = existingProjects.length;
    const maxProjects = tier === SubscriptionTiers.PRO ? PROJECT_LIMITS.MAX_PROJECTS_PER_USER : 0;
    const maxThreadsPerProject = tier === SubscriptionTiers.PRO ? PROJECT_LIMITS.MAX_THREADS_PER_PROJECT : 0;

    return Responses.ok(c, {
      canCreateProject: tier === SubscriptionTiers.PRO && currentProjects < maxProjects,
      currentProjects,
      maxProjects,
      maxThreadsPerProject,
      tier,
    });
  },
);

/**
 * Get a single project by ID
 */
export const getProjectHandler: RouteHandler<typeof getProjectRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getProject',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id } = c.validated.params;
    const db = await getDbAsync();

    const project = await verifyProjectOwnership(id, user.id, db, {
      includeAttachments: true,
      includeThreads: true,
    });

    return Responses.ok(c, enrichProjectWithCounts(project));
  },
);

/**
 * Create a new project
 */
export const createProjectHandler: RouteHandler<typeof createProjectRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'createProject',
    validateBody: CreateProjectRequestSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const body = c.validated.body;
    const db = await getDbAsync();

    // Check PRO tier - projects are PRO-only
    const tier = await getUserTier(user.id);
    if (tier === SubscriptionTiers.FREE) {
      throw createError.unauthorized('Projects require Pro subscription', {
        errorType: 'subscription',
        resource: 'project',
      });
    }

    // Check project count limit
    const existingProjects = await db.query.chatProject.findMany({
      columns: { id: true },
      where: eq(tables.chatProject.userId, user.id),
    });

    if (existingProjects.length >= PROJECT_LIMITS.MAX_PROJECTS_PER_USER) {
      throw createError.unauthorized(`Project limit reached (max ${PROJECT_LIMITS.MAX_PROJECTS_PER_USER})`, {
        errorType: 'quota',
        resource: 'project',
      });
    }

    const projectId = ulid();
    const r2FolderPrefix = `projects/${projectId}/`;

    // Determine AutoRAG instance ID based on environment
    const autoragInstanceId
      = body.autoragInstanceId
        || (c.env.WEBAPP_ENV === WebAppEnvs.PROD
          ? 'debatekit-rag-prod'
          : c.env.WEBAPP_ENV === WebAppEnvs.PREVIEW
            ? 'debatekit-rag-preview'
            : 'debatekit-rag-local');

    const [project] = await db
      .insert(tables.chatProject)
      .values({
        autoragInstanceId,
        color: body.color || 'blue',
        createdAt: new Date(),
        customInstructions: body.customInstructions,
        description: body.description,
        icon: body.icon || 'briefcase',
        id: projectId,
        name: body.name,
        r2FolderPrefix,
        settings: body.settings,
        updatedAt: new Date(),
        userId: user.id,
      })
      .returning();

    await invalidateProjectCache(db, projectId);

    return Responses.created(c, {
      ...project,
      attachmentCount: 0,
      threadCount: 0,
    });
  },
);

/**
 * Update an existing project
 */
export const updateProjectHandler: RouteHandler<typeof updateProjectRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'updateProject',
    validateBody: UpdateProjectRequestSchema,
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id } = c.validated.params;
    const body = c.validated.body;
    const db = await getDbAsync();

    await verifyProjectOwnership(id, user.id, db);

    const updateData: ChatProjectUpdate = { updatedAt: new Date() };

    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }
    if (body.color !== undefined) {
      updateData.color = body.color ?? undefined;
    }
    if (body.icon !== undefined) {
      updateData.icon = body.icon ?? undefined;
    }
    if (body.customInstructions !== undefined) {
      updateData.customInstructions = body.customInstructions || null;
    }
    if (body.autoragInstanceId !== undefined) {
      updateData.autoragInstanceId = body.autoragInstanceId;
    }
    if (body.settings !== undefined) {
      updateData.settings = body.settings;
    }

    const [updated] = await db
      .update(tables.chatProject)
      .set(updateData)
      .where(eq(tables.chatProject.id, id))
      .returning();

    // Fetch counts for response
    const projectWithCounts = await verifyProjectOwnership(id, user.id, db, {
      includeAttachments: true,
      includeThreads: true,
    });

    await invalidateProjectCache(db, id);

    // Track project update - fire-and-forget
    const changes = Object.keys(body).filter(key => body[key as keyof typeof body] !== undefined);
    projectTracking.projectUpdated({
      changes,
      project_id: id,
    }, user.id).catch(() => {});

    return Responses.ok(c, {
      ...updated,
      attachmentCount: projectWithCounts.attachments.length,
      threadCount: projectWithCounts.threads.length,
    });
  },
);

/**
 * Delete a project with FULL CASCADE
 *
 * Deletes everything related to the project:
 * - All threads and their messages, participants, changelogs, pre-searches
 * - All project attachments and their R2 files
 * - All project memories (including those from deleted threads)
 * - All working memory (compound ID `chat:${projectId}`, no FK to project)
 * - All junction table records (threadUpload, messageUpload)
 * - All R2 files from thread uploads
 */
export const deleteProjectHandler: RouteHandler<typeof deleteProjectRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'deleteProject',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id } = c.validated.params;
    const db = await getDbAsync();

    await verifyProjectOwnership(id, user.id, db);

    // Invalidate project cache before cascade delete (while data still exists)
    await invalidateProjectCache(db, id);

    // =========================================================================
    // STEP 1: Collect all data that needs to be deleted
    // =========================================================================

    // Get all threads with their messages for cascade deletion
    const threads = await db.query.chatThread.findMany({
      columns: { id: true, isPublic: true, previousSlug: true, slug: true },
      where: eq(tables.chatThread.projectId, id),
      with: {
        messages: {
          columns: { id: true },
        },
      },
    });

    const threadIds = threads.map(t => t.id);
    const messageIds = threads.flatMap(t => t.messages?.map(m => m.id) ?? []);

    // Get all project attachments for R2 cleanup
    const projectAttachments = await db.query.projectAttachment.findMany({
      where: eq(tables.projectAttachment.projectId, id),
      with: {
        upload: {
          columns: { r2Key: true },
        },
      },
    });

    // Get thread uploads for R2 cleanup (junction table has no FK to thread)
    const threadUploads = threadIds.length > 0
      ? await db.query.threadUpload.findMany({
          where: inArray(tables.threadUpload.threadId, threadIds),
          with: {
            upload: {
              columns: { r2Key: true },
            },
          },
        })
      : [];

    // Get message uploads for R2 cleanup (junction table has no FK to message)
    const messageUploads = messageIds.length > 0
      ? await db.query.messageUpload.findMany({
          where: inArray(tables.messageUpload.messageId, messageIds),
          with: {
            upload: {
              columns: { r2Key: true },
            },
          },
        })
      : [];

    // =========================================================================
    // STEP 2: Delete junction table records (no FK constraints)
    // These MUST be deleted before threads/messages due to missing FKs
    // =========================================================================

    if (threadIds.length > 0) {
      await db.delete(tables.threadUpload)
        .where(inArray(tables.threadUpload.threadId, threadIds));
    }

    if (messageIds.length > 0) {
      await db.delete(tables.messageUpload)
        .where(inArray(tables.messageUpload.messageId, messageIds));
    }

    // =========================================================================
    // STEP 3: Invalidate public thread caches before deletion
    // =========================================================================

    if (threads.length > 0) {
      const cacheInvalidationTasks = threads
        .filter(thread => thread.isPublic && !!thread.slug)
        .flatMap((thread) => {
          const tasks = [
            invalidatePublicThreadCache(db, thread.slug, thread.id, c.env.UPLOADS_R2_BUCKET),
          ];
          if (thread.previousSlug) {
            tasks.push(invalidatePublicThreadCache(db, thread.previousSlug, thread.id, c.env.UPLOADS_R2_BUCKET));
          }
          return tasks;
        });

      if (cacheInvalidationTasks.length > 0 && c.executionCtx) {
        c.executionCtx.waitUntil(Promise.all(cacheInvalidationTasks).catch(() => {}));
      }
    }

    // =========================================================================
    // STEP 3.5: Delete working memory (no FK to project — compound ID convention)
    // working_memory.id uses `chat:${projectId}`, not a foreign key reference
    // =========================================================================

    const compoundMemoryId = `chat:${id}`;
    await db.delete(tables.workingMemory).where(eq(tables.workingMemory.id, compoundMemoryId));

    // =========================================================================
    // STEP 4: Delete the project (DB cascade handles threads, attachments)
    // With onDelete: 'cascade' on chatThread.projectId, all threads are deleted
    // Thread cascade then deletes: messages, participants, changelogs, pre-searches
    // =========================================================================

    await db.delete(tables.chatProject).where(eq(tables.chatProject.id, id));

    // Track project deletion - fire-and-forget
    projectTracking.projectDeleted({
      project_id: id,
      thread_count: threads.length,
    }, user.id).catch(() => {});

    // =========================================================================
    // STEP 5: Delete R2 files in background (non-blocking)
    // =========================================================================

    if (c.executionCtx && c.env.UPLOADS_R2_BUCKET) {
      const r2CleanupTasks: Promise<unknown>[] = [];

      // Delete project attachment files
      for (const attachment of projectAttachments) {
        if (attachment.upload?.r2Key) {
          r2CleanupTasks.push(deleteFile(c.env.UPLOADS_R2_BUCKET, attachment.upload.r2Key));
        }
      }

      // Delete thread upload files
      for (const threadUpload of threadUploads) {
        if (threadUpload.upload?.r2Key) {
          r2CleanupTasks.push(deleteFile(c.env.UPLOADS_R2_BUCKET, threadUpload.upload.r2Key));
        }
      }

      // Delete message upload files
      for (const messageUpload of messageUploads) {
        if (messageUpload.upload?.r2Key) {
          r2CleanupTasks.push(deleteFile(c.env.UPLOADS_R2_BUCKET, messageUpload.upload.r2Key));
        }
      }

      if (r2CleanupTasks.length > 0) {
        c.executionCtx.waitUntil(Promise.all(r2CleanupTasks).catch(() => {}));
      }
    }

    return Responses.ok(c, {
      deleted: true,
      deletedAttachmentCount: projectAttachments.length,
      deletedThreadCount: threads.length,
      id,
    });
  },
);

// ============================================================================
// PROJECT THREADS HANDLERS
// ============================================================================

/**
 * List threads for a project
 */
export const listProjectThreadsHandler: RouteHandler<typeof listProjectThreadsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'listProjectThreads',
    validateParams: IdParamSchema,
    validateQuery: ListProjectThreadsQuerySchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: projectId } = c.validated.params;
    const query = c.validated.query;
    const db = await getDbAsync();

    await verifyProjectOwnership(projectId, user.id, db);

    const threads = await db.query.chatThread.findMany({
      columns: {
        createdAt: true,
        id: true,
        slug: true,
        title: true,
        updatedAt: true,
      },
      limit: query.limit + 1,
      offset: query.cursor ? 1 : 0,
      orderBy: (thread, { desc }) => [desc(thread.updatedAt)],
      where: eq(tables.chatThread.projectId, projectId),
    });

    const { items, pagination } = applyCursorPagination(
      threads,
      query.limit,
      thread => createTimestampCursor(thread.updatedAt),
    );

    return Responses.cursorPaginated(c, items.map(t => ({
      createdAt: t.createdAt.toISOString(),
      id: t.id,
      slug: t.slug,
      title: t.title,
      updatedAt: t.updatedAt.toISOString(),
    })), pagination);
  },
);

// ============================================================================
// PROJECT ATTACHMENT HANDLERS (Reference-based, S3/R2 Best Practice)
// ============================================================================

/**
 * List attachments for a project
 */
export const listProjectAttachmentsHandler: RouteHandler<typeof listProjectAttachmentsRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'listProjectAttachments',
    validateParams: IdParamSchema,
    validateQuery: ListProjectAttachmentsQuerySchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: projectId } = c.validated.params;
    const query = c.validated.query;
    const db = await getDbAsync();

    await verifyProjectOwnership(projectId, user.id, db);

    const filters = [eq(tables.projectAttachment.projectId, projectId)];
    if (query.indexStatus) {
      filters.push(eq(tables.projectAttachment.indexStatus, query.indexStatus));
    }

    const attachments = await db.query.projectAttachment.findMany({
      limit: query.limit + 1,
      orderBy: getCursorOrderBy(tables.projectAttachment.createdAt, 'desc'),
      where: buildCursorWhereWithFilters(
        tables.projectAttachment.createdAt,
        query.cursor,
        'desc',
        filters,
      ),
      with: {
        addedByUser: {
          columns: { email: true, id: true, name: true },
        },
        upload: true,
      },
    });

    const transformedAttachments = attachments.map(omitUploadR2Key);

    const { items, pagination } = applyCursorPagination(
      transformedAttachments,
      query.limit,
      attachment => createTimestampCursor(attachment.createdAt),
    );

    return Responses.cursorPaginated(c, items, pagination);
  },
);

/**
 * Add an existing upload to a project (reference-based)
 * S3/R2 Best Practice: Reference existing uploads instead of direct file upload
 */
export const addAttachmentToProjectHandler: RouteHandler<typeof addAttachmentToProjectRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'addUploadToProject',
    validateBody: AddUploadToProjectRequestSchema,
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: projectId } = c.validated.params;
    const body = c.validated.body;
    const db = await getDbAsync();

    await verifyProjectOwnership(projectId, user.id, db);
    const existingUpload = await verifyUploadOwnership(body.uploadId, user.id, db);

    // Check if upload is already in project
    const existingProjectAttachment = await db.query.projectAttachment.findFirst({
      where: and(
        eq(tables.projectAttachment.projectId, projectId),
        eq(tables.projectAttachment.uploadId, body.uploadId),
      ),
    });

    if (existingProjectAttachment) {
      throw createError.conflict(`Upload already in project`, {
        errorType: 'resource',
        resource: 'projectAttachment',
        resourceId: existingProjectAttachment.id,
      });
    }

    // Copy file to project folder for AI Search indexing
    const projectR2Key = generateProjectFileR2Key(projectId, existingUpload.filename);
    const copyResult = await copyFile(
      c.env.UPLOADS_R2_BUCKET,
      existingUpload.r2Key,
      projectR2Key,
    );

    if (!copyResult.success) {
      log.db('error', '[Project] Failed to copy file to project folder', {
        error: copyResult.error,
        originalKey: existingUpload.r2Key,
        targetKey: projectR2Key,
      });
      throw createError.internal('Failed to copy file to project storage. Please try again.');
    }

    const projectAttachmentId = ulid();
    const [projectAttachment] = await db
      .insert(tables.projectAttachment)
      .values({
        addedBy: user.id,
        createdAt: new Date(),
        id: projectAttachmentId,
        indexStatus: DEFAULT_PROJECT_INDEX_STATUS,
        projectId,
        ragMetadata: {
          context: body.context,
          description: body.description,
          projectR2Key: copyResult.success ? projectR2Key : undefined,
          tags: body.tags,
        },
        updatedAt: new Date(),
        uploadId: body.uploadId,
      })
      .returning();

    // Deduct credits for file attachment
    try {
      await deductCreditsForAction(user.id, 'projectFileLink', {
        description: `File linked: ${existingUpload.filename}`,
      });
    } catch {
      // Non-critical - don't fail attachment if billing fails
    }

    if (isCleanupSchedulerAvailable(c.env)) {
      const cancelTask = cancelUploadCleanup(c.env.UPLOAD_CLEANUP_SCHEDULER, body.uploadId).catch(() => {});
      if (c.executionCtx) {
        c.executionCtx.waitUntil(cancelTask);
      }
    }

    await invalidateProjectCache(db, projectId);

    const { r2Key: _r2Key, ...uploadWithoutR2Key } = existingUpload;

    return Responses.created(c, {
      ...projectAttachment,
      addedByUser: { email: user.email, id: user.id, name: user.name },
      upload: uploadWithoutR2Key,
    });
  },
);

/**
 * Get a single project attachment
 */
export const getProjectAttachmentHandler: RouteHandler<typeof getProjectAttachmentRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getProjectAttachment',
    validateParams: ProjectAttachmentParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { attachmentId, id: projectId } = c.validated.params;
    const db = await getDbAsync();

    await verifyProjectOwnership(projectId, user.id, db);

    const projectAttachment = await db.query.projectAttachment.findFirst({
      where: and(
        eq(tables.projectAttachment.id, attachmentId),
        eq(tables.projectAttachment.projectId, projectId),
      ),
      with: {
        addedByUser: {
          columns: { email: true, id: true, name: true },
        },
        upload: true,
      },
    });

    if (!projectAttachment) {
      throw createError.notFound(`Attachment not found: ${attachmentId}`, {
        errorType: 'resource',
        resource: 'projectAttachment',
        resourceId: attachmentId,
      });
    }

    return Responses.ok(c, omitUploadR2Key(projectAttachment));
  },
);

/**
 * Update project attachment metadata
 */
export const updateProjectAttachmentHandler: RouteHandler<typeof updateProjectAttachmentRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'updateProjectAttachment',
    validateBody: UpdateProjectAttachmentRequestSchema,
    validateParams: ProjectAttachmentParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { attachmentId, id: projectId } = c.validated.params;
    const body = c.validated.body;
    const db = await getDbAsync();

    await verifyProjectOwnership(projectId, user.id, db);

    const existing = await db.query.projectAttachment.findFirst({
      where: and(
        eq(tables.projectAttachment.id, attachmentId),
        eq(tables.projectAttachment.projectId, projectId),
      ),
      with: {
        addedByUser: {
          columns: { email: true, id: true, name: true },
        },
        upload: true,
      },
    });

    if (!existing) {
      throw createError.notFound(`Attachment not found: ${attachmentId}`, {
        errorType: 'resource',
        resource: 'projectAttachment',
        resourceId: attachmentId,
      });
    }

    const currentMetadata = existing.ragMetadata || {};
    const updatedMetadata: ProjectAttachmentRagMetadata = { ...currentMetadata };

    if (body.context !== undefined) {
      updatedMetadata.context = body.context ?? undefined;
    }
    if (body.description !== undefined) {
      updatedMetadata.description = body.description ?? undefined;
    }
    if (body.tags !== undefined) {
      updatedMetadata.tags = body.tags;
    }

    const [updated] = await db
      .update(tables.projectAttachment)
      .set({ ragMetadata: updatedMetadata, updatedAt: new Date() })
      .where(eq(tables.projectAttachment.id, attachmentId))
      .returning();

    await invalidateProjectCache(db, projectId);

    const { r2Key: _r2Key, ...uploadWithoutR2Key } = existing.upload;

    return Responses.ok(c, {
      ...updated,
      addedByUser: existing.addedByUser,
      upload: uploadWithoutR2Key,
    });
  },
);

/**
 * Remove an attachment from a project (reference removal, not file deletion)
 * S3/R2 Best Practice: Only removes the reference, the underlying file remains in the upload table
 */
export const removeAttachmentFromProjectHandler: RouteHandler<typeof removeAttachmentFromProjectRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'removeAttachmentFromProject',
    validateParams: ProjectAttachmentParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { attachmentId, id: projectId } = c.validated.params;
    const db = await getDbAsync();

    await verifyProjectOwnership(projectId, user.id, db);

    const projectAttachment = await db.query.projectAttachment.findFirst({
      where: and(
        eq(tables.projectAttachment.id, attachmentId),
        eq(tables.projectAttachment.projectId, projectId),
      ),
    });

    if (!projectAttachment) {
      throw createError.notFound(`Attachment not found: ${attachmentId}`, {
        errorType: 'resource',
        resource: 'projectAttachment',
        resourceId: attachmentId,
      });
    }

    // ✅ VALIDATION: Prevent deletion of files linked to active threads
    if (projectAttachment.ragMetadata?.sourceThreadId) {
      const sourceThread = await db.query.chatThread.findFirst({
        columns: { id: true },
        where: and(
          eq(tables.chatThread.id, projectAttachment.ragMetadata.sourceThreadId),
          eq(tables.chatThread.status, ThreadStatuses.ACTIVE),
        ),
      });

      if (sourceThread) {
        throw createError.badRequest(
          'Cannot delete file linked to active thread. Delete the thread first.',
          { errorType: 'validation', field: 'projectAttachment' },
        );
      }
    }

    // Delete project R2 file copy (blocking with logging)
    // Note: Deletion is best-effort - if it fails, the file will be orphaned but won't cause functional issues
    if (projectAttachment.ragMetadata?.projectR2Key) {
      const deleteResult = await deleteFile(c.env.UPLOADS_R2_BUCKET, projectAttachment.ragMetadata.projectR2Key);

      if (!deleteResult.success) {
        log.db('warn', '[Project] Failed to delete project R2 file copy - orphaned file may remain', {
          attachmentId,
          error: deleteResult.error,
          projectId,
          r2Key: projectAttachment.ragMetadata.projectR2Key,
        });
      }
    }

    await db.delete(tables.projectAttachment).where(eq(tables.projectAttachment.id, attachmentId));

    await invalidateProjectCache(db, projectId);

    return Responses.ok(c, { deleted: true, id: attachmentId });
  },
);

// ============================================================================
// PROJECT CONTEXT HANDLER
// ============================================================================

/**
 * Get aggregated project context for RAG
 * Includes memories, cross-chat context, search history, and analyses
 */
export const getProjectContextHandler: RouteHandler<typeof getProjectContextRoute, ApiEnv> = createHandler(
  {
    auth: 'session',
    operationName: 'getProjectContext',
    validateParams: IdParamSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { id: projectId } = c.validated.params;
    const db = await getDbAsync();

    await verifyProjectOwnership(projectId, user.id, db);

    const context = await getAggregatedProjectContext({
      currentThreadId: '',
      db,
      projectId,
      userQuery: '',
    });

    return Responses.ok(c, {
      memories: {
        items: context.memories.memories.map(m => ({
          content: m.content,
          id: m.id,
          importance: m.importance,
          source: m.source,
          summary: m.summary,
        })),
        totalCount: context.memories.totalCount,
      },
      moderators: {
        items: context.moderators.moderators.map(m => ({
          moderator: m.moderator,
          threadTitle: m.threadTitle,
          userQuestion: m.userQuestion,
        })),
        totalCount: context.moderators.totalCount,
      },
      recentChats: {
        threads: context.chats.threads.map(t => ({
          id: t.id,
          messageExcerpt: t.messages[0]?.content.slice(0, 200) || '',
          title: t.title,
        })),
        totalCount: context.chats.totalThreads,
      },
      searches: {
        items: context.searches.searches.map(s => ({
          summary: s.summary,
          threadTitle: s.threadTitle,
          userQuery: s.userQuery,
        })),
        totalCount: context.searches.totalCount,
      },
    });
  },
);
