import type { InfiniteData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { shouldRetryMutation } from '@/hooks/utils';
import enCommon from '@/i18n/locales/en/common.json';
import { invalidationPatterns } from '@/lib/data/cache';
import { queryKeys } from '@/lib/data/keys';
import { toastManager } from '@/lib/toast';
import type { GetProjectResponse, ListProjectAttachmentsResponse, ListProjectsResponse, ProjectAttachmentItem, ProjectListItem } from '@/services/api';
import {
  addUploadToProjectService,
  createProjectService,
  deleteProjectService,
  removeAttachmentFromProjectService,
  updateProjectAttachmentService,
  updateProjectService,
} from '@/services/api';
import { deleteProjectMemoryService, extractProjectMemoryService, restoreProjectMemoryService } from '@/services/api/memories';

// Derive response types from service functions (avoids InferResponseType resolution issues)
type CreateProjectResult = Awaited<ReturnType<typeof createProjectService>>;
type UpdateProjectResult = Awaited<ReturnType<typeof updateProjectService>>;
type DeleteProjectResult = Awaited<ReturnType<typeof deleteProjectService>>;
type AddUploadToProjectResult = Awaited<ReturnType<typeof addUploadToProjectService>>;
type UpdateProjectAttachmentResult = Awaited<ReturnType<typeof updateProjectAttachmentService>>;
type RemoveAttachmentFromProjectResult = Awaited<ReturnType<typeof removeAttachmentFromProjectService>>;

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation<CreateProjectResult, Error, Parameters<typeof createProjectService>[0]>({
    mutationFn: createProjectService,
    mutationKey: ['projects', 'create'],
    onError: () => {
      toastManager.error(enCommon.projects.createError);
    },
    onSuccess: () => {
      invalidationPatterns.projects.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: false,
    throwOnError: false,
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation<UpdateProjectResult, Error, Parameters<typeof updateProjectService>[0]>({
    mutationFn: updateProjectService,
    mutationKey: ['projects', 'update'],
    onSuccess: (response, variables) => {
      if (response.success && response.data) {
        const updatedProject = response.data;

        // 1. Update infinite query caches (sidebar and list use useInfiniteQuery with pages structure)
        queryClient.setQueriesData<InfiniteData<ListProjectsResponse>>(
          {
            predicate: (query) => {
              if (!Array.isArray(query.queryKey) || query.queryKey.length < 2) {
                return false;
              }
              return query.queryKey[1] === 'list' || query.queryKey[1] === 'sidebar';
            },
            queryKey: queryKeys.projects.all,
          },
          (old) => {
            if (!old?.pages) {
              return old;
            }

            return {
              ...old,
              pages: old.pages.map((page) => {
                if (!page.success || !page.data?.items) {
                  return page;
                }

                return {
                  ...page,
                  data: {
                    ...page.data,
                    items: page.data.items.map(
                      (project: ProjectListItem) => (project.id === updatedProject.id ? { ...project, ...updatedProject } : project),
                    ),
                  },
                };
              }),
            };
          },
        );

        // 2. Update detail query directly (optimistic)
        queryClient.setQueryData(
          queryKeys.projects.detail(variables.param.id),
          (old: GetProjectResponse | undefined) => {
            if (!old?.success || !old.data) {
              return old;
            }
            return { ...old, data: updatedProject };
          },
        );
      }

      // 3. Invalidate and force refetch for active observers
      invalidationPatterns.projectDetail(variables.param.id).forEach((key) => {
        queryClient.invalidateQueries({
          queryKey: key,
          refetchType: 'active',
        });
      });
    },
    retry: shouldRetryMutation,
    throwOnError: false,
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation<DeleteProjectResult, Error, Parameters<typeof deleteProjectService>[0], { previousProjects?: ListProjectsResponse; projectId?: string }>({
    mutationFn: deleteProjectService,
    mutationKey: ['projects', 'delete'],
    onMutate: async (data) => {
      const projectId = data.param?.id;
      if (!projectId) {
        return { previousProjects: undefined, projectId: undefined };
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });

      const previousProjects = queryClient.getQueryData<ListProjectsResponse>(queryKeys.projects.list());

      queryClient.setQueryData<ListProjectsResponse>(
        queryKeys.projects.list(),
        (oldData: ListProjectsResponse | undefined) => {
          if (!oldData?.success || !oldData.data?.items) {
            return oldData;
          }

          return {
            ...oldData,
            data: {
              ...oldData.data,
              items: oldData.data.items.filter((project: ProjectListItem) => project.id !== projectId),
            },
          };
        },
      );

      return { previousProjects, projectId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.list(),
          context.previousProjects,
        );
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      const projectId = context?.projectId;

      // Invalidate all project queries including sidebar
      invalidationPatterns.projects.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Invalidate thread queries since threads were soft-deleted
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });

      // Explicitly invalidate project-specific caches if we have the projectId
      // This ensures all project-related caches are cleared (threads, memories, detail, context, attachments)
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.threads(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.memories(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.context(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.attachments(projectId) });
      }

      // Invalidate usage stats to reflect deleted threads
      queryClient.invalidateQueries({ queryKey: queryKeys.usage.stats() });
    },
    retry: shouldRetryMutation,
    throwOnError: false,
  });
}

export function useAddAttachmentToProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation<AddUploadToProjectResult, Error, Parameters<typeof addUploadToProjectService>[0]>({
    mutationFn: addUploadToProjectService,
    mutationKey: ['projects', 'attachments', 'add'],
    onError: (_error, variables) => {
      // On error, invalidate to get fresh state
      const projectId = variables.param.id;
      invalidationPatterns.projectAttachments(projectId).forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      // Notify user of failure
      toastManager.error('Failed to add file to project');
    },
    onSuccess: (data, variables) => {
      if (!data.success || !data.data) {
        return;
      }

      const projectId = variables.param.id;
      const newAttachment = data.data;

      // Direct cache update - insert at top of infinite query
      // Use setQueriesData with predicate to match all queries starting with attachments key
      // (the actual query key includes indexStatus param which varies)
      queryClient.setQueriesData<InfiniteData<ListProjectAttachmentsResponse>>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key) || key.length < 3) {
              return false;
            }
            return key[0] === 'projects' && key[1] === 'attachments' && key[2] === projectId;
          },
          queryKey: queryKeys.projects.attachments(projectId),
        },
        (oldData) => {
          if (!oldData?.pages) {
            return oldData;
          }
          return {
            ...oldData,
            pages: oldData.pages.map((page, index) => {
              if (index !== 0 || !page.success || !page.data) {
                return page;
              }
              return {
                ...page,
                data: {
                  ...page.data,
                  items: [newAttachment, ...page.data.items],
                },
              };
            }),
          };
        },
      );

      // Invalidate project detail for attachment count (active observers will refetch)
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(projectId),
        refetchType: 'active',
      });
    },
    retry: false,
    throwOnError: false,
  });
}

export function useUpdateProjectAttachmentMutation() {
  const queryClient = useQueryClient();

  return useMutation<UpdateProjectAttachmentResult, Error, Parameters<typeof updateProjectAttachmentService>[0]>({
    mutationFn: updateProjectAttachmentService,
    mutationKey: ['projects', 'attachments', 'update'],
    onSuccess: (_data, variables) => {
      const projectId = variables.param.id;

      // Use predicate to match all attachment queries (key includes indexStatus param)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key) || key.length < 3) {
            return false;
          }
          return key[0] === 'projects' && key[1] === 'attachments' && key[2] === projectId;
        },
      });

      // Also invalidate project detail to refresh attachment metadata (e.g. indexStatus changes)
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(projectId),
        refetchType: 'active',
      });
    },
    retry: shouldRetryMutation,
    throwOnError: false,
  });
}

export function useRemoveAttachmentFromProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation<RemoveAttachmentFromProjectResult, Error, Parameters<typeof removeAttachmentFromProjectService>[0]>({
    mutationFn: removeAttachmentFromProjectService,
    mutationKey: ['projects', 'attachments', 'remove'],
    onSuccess: (_data, variables) => {
      const projectId = variables.param.id;
      const attachmentId = variables.param.attachmentId;

      // Optimistically remove attachment from cache using predicate
      // (actual query key includes indexStatus param which varies)
      queryClient.setQueriesData<InfiniteData<ListProjectAttachmentsResponse>>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key) || key.length < 3) {
              return false;
            }
            return key[0] === 'projects' && key[1] === 'attachments' && key[2] === projectId;
          },
          queryKey: queryKeys.projects.attachments(projectId),
        },
        (oldData) => {
          if (!oldData?.pages) {
            return oldData;
          }
          return {
            ...oldData,
            pages: oldData.pages.map((page) => {
              if (!page.success || !page.data) {
                return page;
              }
              return {
                ...page,
                data: {
                  ...page.data,
                  items: page.data.items.filter((item: ProjectAttachmentItem) => item.id !== attachmentId),
                },
              };
            }),
          };
        },
      );

      // Invalidate project detail to update attachment count
      // The attachments list is already updated optimistically via setQueriesData above,
      // so we don't need to invalidate it (and doing so could cause a race condition
      // where stale data from server cache overwrites our optimistic update)
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(projectId),
        refetchType: 'active',
      });
    },
    retry: shouldRetryMutation,
    throwOnError: false,
  });
}

// ============================================================================
// Memory Mutations
// ============================================================================

// Derive result types from service functions
type DeleteProjectMemoryResult = Awaited<ReturnType<typeof deleteProjectMemoryService>>;
type ExtractProjectMemoryResult = Awaited<ReturnType<typeof extractProjectMemoryService>>;
type RestoreProjectMemoryResult = Awaited<ReturnType<typeof restoreProjectMemoryService>>;

export function useDeleteProjectMemoryMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<DeleteProjectMemoryResult, Error>({
    mutationFn: () =>
      deleteProjectMemoryService({
        param: { id: projectId },
      }),
    mutationKey: ['projects', 'memory', 'delete', projectId],
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.memories(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.context(projectId) });
    },
    retry: false,
    throwOnError: false,
  });
}

export function useExtractMemoryMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<ExtractProjectMemoryResult, Error, string>({
    mutationFn: userMessage =>
      extractProjectMemoryService({
        json: { userMessage },
        param: { id: projectId },
      }),
    mutationKey: ['projects', 'memory', 'extract', projectId],
    onSuccess: (data) => {
      if (data.success && data.data?.extracted) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.memories(projectId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.context(projectId) });
      }
    },
    retry: false,
    throwOnError: false,
  });
}

export function useRestoreMemoryMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<RestoreProjectMemoryResult, Error, string | null>({
    mutationFn: content =>
      restoreProjectMemoryService({
        json: { content },
        param: { id: projectId },
      }),
    mutationKey: ['projects', 'memory', 'restore', projectId],
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.memories(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.context(projectId) });
    },
    retry: false,
    throwOnError: false,
  });
}
