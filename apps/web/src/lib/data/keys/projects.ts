import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getProjectAttachments, getProjectById, getProjectMemory } from '@/server/project';
import { getSidebarProjects } from '@/server/sidebar-projects';
import { getThreadsByProject } from '@/server/thread';

import { STALE_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

export const projectKeys = {
  projects: {
    all: QueryKeyFactory.base('projects'),
    attachments: (id: string) => QueryKeyFactory.action('projects', 'attachments', id),
    context: (id: string) => QueryKeyFactory.action('projects', 'context', id),
    detail: (id: string) => QueryKeyFactory.detail('projects', id),
    details: () => [...projectKeys.projects.all, 'detail'] as const,
    limits: () => QueryKeyFactory.action('projects', 'limits'),
    list: (cursor?: string) =>
      cursor
        ? QueryKeyFactory.action('projects', 'list', cursor)
        : QueryKeyFactory.list('projects'),
    lists: (search?: string) =>
      search
        ? [...projectKeys.projects.all, 'list', 'search', search] as const
        : [...projectKeys.projects.all, 'list'] as const,
    memories: (id: string) => QueryKeyFactory.action('projects', 'memories', id),
    sidebar: () => [...projectKeys.projects.all, 'sidebar'] as const,
    threads: (id: string) => ['threads', 'list', { projectId: id, search: undefined }] as const,
  },
} as const;

export const sidebarProjectsQueryOptions = infiniteQueryOptions({
  queryFn: async () => {
    const result = await getSidebarProjects();
    if (!result.success) {
      throw new Error('Failed to fetch sidebar projects');
    }
    return result;
  },
  initialPageParam: undefined as string | undefined,
  getNextPageParam: lastPage => lastPage.data?.pagination?.nextCursor,
  queryKey: projectKeys.projects.sidebar(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: STALE_TIMES.projects,
});

export function projectQueryOptions(projectId: string) {
  return queryOptions({
    queryFn: () => getProjectById({ data: projectId }),
    queryKey: projectKeys.projects.detail(projectId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: STALE_TIMES.threadDetail,
  });
}

export function projectAttachmentsQueryOptions(projectId: string) {
  return infiniteQueryOptions({
    queryFn: async () => {
      const result = await getProjectAttachments({ data: projectId });
      if (!result.success) {
        throw new Error('Failed to fetch project attachments');
      }
      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.data?.pagination?.nextCursor,
    queryKey: projectKeys.projects.attachments(projectId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIMES.threadDetail,
  });
}

export function projectMemoryQueryOptions(projectId: string) {
  return queryOptions({
    queryFn: () => getProjectMemory({ data: projectId }),
    queryKey: projectKeys.projects.memories(projectId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIMES.threadDetail,
  });
}

export function projectThreadsQueryOptions(projectId: string) {
  return infiniteQueryOptions({
    queryFn: async () => {
      const result = await getThreadsByProject({ data: projectId });
      if (!result.success) {
        throw new Error('Failed to fetch project threads');
      }
      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.data?.pagination?.nextCursor,
    queryKey: projectKeys.projects.threads(projectId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIMES.threads,
  });
}
