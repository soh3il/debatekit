import { QueryKeyFactory } from './factory';

export const presetKeys = {
  userPresets: {
    all: QueryKeyFactory.base('userPresets'),
    detail: (id: string) => QueryKeyFactory.detail('userPresets', id),
    details: () => [...presetKeys.userPresets.all, 'detail'] as const,
    list: (cursor?: string) =>
      cursor
        ? QueryKeyFactory.action('userPresets', 'list', cursor)
        : QueryKeyFactory.list('userPresets'),
    lists: () => [...presetKeys.userPresets.all, 'list'] as const,
  },
} as const;
