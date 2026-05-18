import type { QueryClient } from '@tanstack/react-query';
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { lazy } from 'react';

import type { SessionData } from '@/lib/auth';
import { makeQueryClient } from '@/lib/data/query-client';

import { routeTree } from './routeTree.gen';

const NotFoundScreen = lazy(() => import('@/containers/screens/general/NotFoundScreen'));

export type RouterContext = {
  queryClient: QueryClient;
  session: SessionData | null;
};

export function getRouter() {
  const queryClient = makeQueryClient();

  const router = createTanStackRouter({
    context: { queryClient, session: null },
    defaultNotFoundComponent: NotFoundScreen,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({
    queryClient,
    router,
  });

  return router;
}

declare module '@tanstack/react-router' {
  // eslint-disable-next-line ts/consistent-type-definitions -- Module augmentation requires interface for declaration merging
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
