import { QueryKeyFactory } from './factory';

export const uploadKeys = {
  uploads: {
    all: QueryKeyFactory.base('uploads'),
    detail: (id: string) => QueryKeyFactory.detail('uploads', id),
    details: () => [...uploadKeys.uploads.all, 'detail'] as const,
    downloadUrl: (id: string) => QueryKeyFactory.action('uploads', 'downloadUrl', id),
    list: (cursor?: string) =>
      cursor
        ? QueryKeyFactory.action('uploads', 'list', cursor)
        : QueryKeyFactory.list('uploads'),
    lists: () => [...uploadKeys.uploads.all, 'list'] as const,
  },
} as const;
