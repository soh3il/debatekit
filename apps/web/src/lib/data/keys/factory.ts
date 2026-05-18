export const QueryKeyFactory = {
  action: (resource: string, action: string, ...params: string[]) =>
    [resource, action, ...params] as const,
  all: (resource: string) => [resource, 'all'] as const,
  base: (resource: string) => [resource] as const,
  current: (resource: string) => [resource, 'current'] as const,
  detail: (resource: string, id: string) => [resource, 'detail', id] as const,
  list: (resource: string) => [resource, 'list'] as const,
} as const;
