import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Outlet, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { PreferencesStoreProvider } from '@/components/providers/preferences-store-provider';
import { useSessionQuerySync } from '@/hooks/utils/use-session-query-sync';
import { authClient, useSession } from '@/lib/auth/client';
import { clearServiceWorkerCache, invalidateUserQueries } from '@/lib/data/cache';
import { subscriptionsQueryOptions } from '@/lib/data/keys/billing';
import { sidebarThreadsQueryOptions } from '@/lib/data/keys/chat';
import { modelsQueryOptions } from '@/lib/data/keys/models';
import { sidebarProjectsQueryOptions } from '@/lib/data/keys/projects';
import { usageQueryOptions } from '@/lib/data/keys/usage';
import { rlog } from '@/lib/utils/dev-logger';

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ context }) => {
    // Return whatever session SSR resolved (may be null).
    // Client-side auth is handled by ProtectedLayout via Better Auth's
    // useSession() — the official client-side session source of truth.
    // @see https://better-auth.com/docs/concepts/session-management
    return { session: context.session ?? null };
  },

  component: ProtectedLayout,
  loader: async ({ context }) => {
    const { queryClient, session } = context;

    try {
      const prefetchPromises: Promise<unknown>[] = [
        queryClient.ensureQueryData(modelsQueryOptions),
        queryClient.ensureInfiniteQueryData(sidebarThreadsQueryOptions),
      ];

      if (session) {
        prefetchPromises.push(
          queryClient.ensureInfiniteQueryData(sidebarProjectsQueryOptions),
          queryClient.ensureQueryData(subscriptionsQueryOptions),
          queryClient.ensureQueryData(usageQueryOptions),
        );
      }

      await Promise.all(prefetchPromises);
    } catch (error) {
      rlog.stuck('protected-loader', `prefetch-error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {};
  },
  staleTime: 5 * 60 * 1_000,
});

/**
 * ProtectedLayout — gates access using Better Auth's useSession().
 *
 * useSession() is the official Better Auth React pattern: it makes a direct
 * browser→API call, correctly receives Set-Cookie headers, and caches
 * internally. We wait for its isPending to resolve before making any
 * anonymous sign-in or redirect decisions.
 *
 * @see https://better-auth.com/docs/concepts/session-management
 */
function ProtectedLayout() {
  const routeContext = Route.useRouteContext();
  const { data: clientSession, isPending } = useSession();
  const activeSession = clientSession ?? routeContext.session;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [anonSignInFailed, setAnonSignInFailed] = useState(false);
  const attemptedRef = useRef(false);

  useSessionQuerySync();

  // Wait for useSession() to finish before making auth decisions.
  // useSession() makes a direct browser→API call that properly handles
  // cookies (Set-Cookie headers reach the browser). Only after it resolves
  // to null do we know the user genuinely has no session.
  useEffect(() => {
    if (isPending || activeSession || attemptedRef.current) {
      return;
    }
    attemptedRef.current = true;

    authClient.signIn.anonymous()
      .then((result) => {
        if (!result.data) {
          setAnonSignInFailed(true);
          return;
        }
        invalidateUserQueries(queryClient);
        router.invalidate();
        clearServiceWorkerCache();
      })
      .catch(() => {
        setAnonSignInFailed(true);
      });
  }, [isPending, activeSession, queryClient, router]);

  useEffect(() => {
    if (anonSignInFailed) {
      navigate({ search: { redirect: window.location.href }, to: '/auth/sign-in' });
    }
  }, [anonSignInFailed, navigate]);

  // While useSession() is loading or anonymous sign-in is in progress,
  // render nothing to avoid a flash.
  if (isPending || (!activeSession && !anonSignInFailed)) {
    return null;
  }

  return (
    <PreferencesStoreProvider>
      <Outlet />
    </PreferencesStoreProvider>
  );
}
