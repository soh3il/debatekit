import { queryOptions } from '@tanstack/react-query';

import { getProducts } from '@/server/products';
import { getSubscriptions } from '@/server/subscriptions';

import { STALE_TIMES } from '../stale-times';
import { QueryKeyFactory } from './factory';

export const billingKeys = {
  checkout: {
    all: QueryKeyFactory.base('checkout'),
    session: (sessionId: string) => QueryKeyFactory.action('checkout', 'session', sessionId),
  },

  products: {
    all: QueryKeyFactory.base('products'),
    detail: (id: string) => QueryKeyFactory.detail('products', id),
    details: () => [...billingKeys.products.all, 'detail'] as const,
    list: () => QueryKeyFactory.list('products'),
    lists: () => [...billingKeys.products.all, 'list'] as const,
  },

  subscriptions: {
    all: QueryKeyFactory.base('subscriptions'),
    current: () => QueryKeyFactory.current('subscriptions'),
    detail: (id: string) => QueryKeyFactory.detail('subscriptions', id),
    details: () => [...billingKeys.subscriptions.all, 'detail'] as const,
    list: () => QueryKeyFactory.list('subscriptions'),
    lists: () => [...billingKeys.subscriptions.all, 'list'] as const,
  },
} as const;

export const productsQueryOptions = queryOptions({
  queryFn: () => getProducts(),
  queryKey: billingKeys.products.list(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: STALE_TIMES.products,
});

export const subscriptionsQueryOptions = queryOptions({
  queryFn: () => getSubscriptions(),
  queryKey: billingKeys.subscriptions.current(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: STALE_TIMES.subscriptions,
});
