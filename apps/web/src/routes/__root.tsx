import '../styles/globals.css';

import { BRAND } from '@debatekit/shared';
import { WebAppEnvs } from '@debatekit/shared/enums';
import type { ErrorComponentProps } from '@tanstack/react-router';
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { ThreadModeratorPlayer } from '@/components/chat/podcast';
import { Icons } from '@/components/icons';
import { StructuredData } from '@/components/seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAppBaseUrl, getWebappEnv } from '@/lib/config/base-urls';
import { sessionQueryOptions } from '@/lib/data/keys/auth';
import { getPostHogApiKey } from '@/lib/env';
import { useTranslations } from '@/lib/i18n';
import { rlog } from '@/lib/utils/dev-logger';
import { IdleLazyProvider } from '@/lib/utils/lazy-provider';
import type { RouterContext } from '@/router';

/**
 * Root route with QueryClient context
 * QueryClientProvider is automatically wrapped by setupRouterSsrQueryIntegration in router.tsx
 * No need for manual provider - the integration handles SSR dehydration/hydration automatically
 */
const siteName = BRAND.name;
const siteTitle = `${BRAND.name} — ${BRAND.tagline}`;
const siteDescription = BRAND.description;
const twitterHandle = BRAND.social.twitterHandle;

export const Route = createRootRouteWithContext<RouterContext>()({
  // ✅ SSR SESSION STRATEGY: Use TanStack Query cache for session deduplication
  // Server uses cookies via cookieMiddleware, client uses cached session
  // This prevents 4+ getSession calls on page load (FIX P1.5)
  beforeLoad: async ({ context }) => {
    try {
      // Use ensureQueryData to leverage TanStack Query cache
      // On server: fetches session (SSR), on client: uses cached if fresh
      const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
      return { session };
    } catch (error) {
      rlog.stuck('root-route', `session-error: ${error instanceof Error ? error.message : String(error)}`);
      return { session: null };
    }
  },
  component: RootComponent,
  errorComponent: RootErrorComponent,
  // ✅ VITE ENV VARS: Use import.meta.env directly (TanStack Start best practice)
  // VITE_* prefixed vars are replaced at build time by Vite
  // No need for server functions - Vite handles build-time env var replacement
  head: () => {
    const siteUrl = getAppBaseUrl();
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: siteTitle },
        { name: 'description', content: siteDescription },
        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: siteName },
        { property: 'og:title', content: siteTitle },
        { property: 'og:description', content: siteDescription },
        { property: 'og:url', content: siteUrl },
        { property: 'og:image', content: `${siteUrl}/static/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: twitterHandle },
        { name: 'twitter:creator', content: twitterHandle },
        { name: 'twitter:title', content: siteTitle },
        { name: 'twitter:description', content: siteDescription },
        { name: 'twitter:image', content: `${siteUrl}/static/og-image.png` },
        // Theme
        { name: 'theme-color', content: '#000000' },
        { name: 'color-scheme', content: 'dark' },
        // SEO - Default to index, follow (child routes can override)
        { name: 'robots', content: 'index, follow' },
        // PWA
        { name: 'application-name', content: siteName },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: siteName },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'mobile-web-app-capable', content: 'yes' },
      ],
      links: [
        // Google Fonts: preconnect for faster font loading (CSS + font files)
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        // Google Fonts: Vazirmatn only (Farsi/Arabic) — Latin uses system-ui (SF Pro / Segoe UI)
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=block' },
        // Performance: DNS prefetch and preconnect for external resources
        { rel: 'dns-prefetch', href: 'https://us.posthog.com' },
        { rel: 'preconnect', href: 'https://us.posthog.com', crossOrigin: 'anonymous' },
        // PWA Manifest
        { rel: 'manifest', href: '/manifest.webmanifest' },
        // Favicon - default for all browsers (without sizes for maximum compatibility)
        { rel: 'icon', type: 'image/png', href: '/icons/icon-96x96.png' },
        { rel: 'shortcut icon', type: 'image/png', href: '/icons/icon-96x96.png' },
        // Sized icons for high-DPI displays and PWA
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/icon-72x72.png' },
        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/icons/icon-96x96.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icons/icon-192x192.png' },
        // Apple touch icon for iOS
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        // Note: canonical URLs are set per-route, not in root layout
      ],
    };
  },
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  // Google Tag must be in initial HTML for Google Ads verification bots to detect it.
  // Keep IDs in sync with google-ads-provider.tsx
  const isLocal = getWebappEnv() === WebAppEnvs.LOCAL;

  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        {!isLocal && (
          <>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-8NRM019810" />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-8NRM019810');gtag('config','AW-17914668376');`,
              }}
            />
          </>
        )}
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Skip link for keyboard/screen reader users - hardcoded for robustness in critical navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        {/* Non-critical analytics and PWA providers - loaded after browser idle */}
        <IdleLazyProvider<{ children: ReactNode }>
          loader={() => import('@/components/providers/service-worker-provider').then(m => ({ default: m.ServiceWorkerProvider }))}
          providerProps={{ children: null }}
        >
          <IdleLazyProvider<{ children: ReactNode; apiKey?: string }>
            loader={() => import('@/components/providers/posthog-provider').then(m => ({ default: m.default }))}
            providerProps={{ apiKey: getPostHogApiKey(), children: null }}
          >
            <IdleLazyProvider<{ children: ReactNode }>
              loader={() => import('@/components/providers/google-ads-provider').then(m => ({ default: m.default }))}
              providerProps={{ children: null }}
            >
              {children}
            </IdleLazyProvider>
          </IdleLazyProvider>
        </IdleLazyProvider>
        <PodcastPlayer />
        <StructuredData type="WebApplication" />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Floating podcast player (Dynamic Island).
 * Rendered for all users -- the player is only visible when the store's
 * `isVisible` flag is true (i.e. when a playlist is loaded).
 * Loaded with { ssr: false } via the barrel export.
 */
function PodcastPlayer() {
  return <ThreadModeratorPlayer />;
}

/**
 * Check if PostHog is available for tracking
 * Returns false in local environment or SSR context
 */
function isPostHogAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return getWebappEnv() !== WebAppEnvs.LOCAL;
}

/**
 * Track error to PostHog for monitoring and debugging
 * Uses dynamic import to avoid loading PostHog in critical path
 */
async function trackErrorToPostHog(error: Error, context: { url: string; userAgent: string }) {
  if (!isPostHogAvailable()) {
    return;
  }

  // Lazy load PostHog only when needed for error tracking
  const posthog = (await import('posthog-js')).default;
  posthog.capture('$exception', {
    $exception_message: error.message,
    $exception_source: 'tanstack_router_error_boundary',
    $exception_stack_trace_raw: error.stack,
    $exception_type: error.name,
    url: context.url,
    userAgent: context.userAgent,
  });
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const isProd = getWebappEnv() === WebAppEnvs.PROD;
  const hasTrackedRef = useRef(false);
  const t = useTranslations();

  // Track error to PostHog once
  useEffect(() => {
    if (error && !hasTrackedRef.current) {
      hasTrackedRef.current = true;
      trackErrorToPostHog(error, {
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      });
    }
  }, [error]);

  return (
    <RootDocument>
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4 sm:p-8">
        <div className="w-full max-w-3xl">
          {/* Error Card */}
          <div className="rounded-2xl border border-destructive/30 bg-card/80 backdrop-blur-sm p-6 sm:p-10 shadow-xl">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="rounded-full bg-destructive/10 p-4 mb-4">
                <Icons.triangleAlert className="size-10 text-destructive" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-destructive mb-2">
                {t('states.error.default')}
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-md">
                {t('states.error.boundaryDescription')}
              </p>
            </div>

            {/* Error Details - Development Only */}
            {!isProd && error && (
              <details className="w-full rounded-xl bg-destructive/5 border border-destructive/20 mb-8 overflow-hidden">
                <summary className="cursor-pointer px-5 py-4 font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2">
                  <Icons.chevronRight className="size-4 transition-transform [details[open]>&]:rotate-90" />
                  <span>{t('states.error.detailsTitle')}</span>
                  <Badge variant="outline" className="ml-auto font-mono text-xs">
                    {error.name || 'Error'}
                  </Badge>
                </summary>
                <div className="px-5 pb-5 space-y-4 border-t border-destructive/10">
                  <div className="pt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t('errors.boundary.errorLabel')}</p>
                    <pre className="overflow-x-auto rounded-lg bg-black/20 p-4 text-sm text-destructive/90 font-mono whitespace-pre-wrap break-words">
                      {error.message || String(error)}
                    </pre>
                  </div>
                  {error.stack && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t('errors.boundary.stackLabel')}</p>
                      <pre className="overflow-auto rounded-lg bg-black/20 p-4 text-xs text-muted-foreground font-mono max-h-64 whitespace-pre">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {typeof window !== 'undefined' && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t('errors.boundary.urlLabel')}</p>
                      <pre className="overflow-x-auto rounded-lg bg-black/20 p-3 text-xs text-muted-foreground font-mono">
                        {window.location.href}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="default"
                size="lg"
                onClick={reset}
                startIcon={<Icons.refreshCw />}
                className="min-w-[140px]"
              >
                {t('actions.tryAgain')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                startIcon={<Icons.home />}
                className="min-w-[140px]"
              >
                <Link to="/">{t('actions.goHome')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </RootDocument>
  );
}
