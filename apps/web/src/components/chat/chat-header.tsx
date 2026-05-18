import { Link, useLocation, useMatches, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { memo, useCallback } from 'react';
import { z } from 'zod';

import { Icons } from '@/components/icons';
import { Logo } from '@/components/logo';
import { useChatStore } from '@/components/providers';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useSidebarOptional } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { BRAND } from '@/constants';
import { useProjectQuery, useThreadQuery } from '@/hooks/queries';
import { useTranslations } from '@/lib/i18n';
import { useShallow } from '@/lib/store';
import { cn } from '@/lib/ui/cn';
import { ChatPhases } from '@/stores/chat';

import type { ChatPageHeaderProps, NavigationHeaderProps, PageHeaderProps } from './chat-header.types';
import { ChatScrollButton } from './chat-scroll-button';
import { ChatSection } from './chat-states';
import { ChatThreadActions } from './chat-thread-actions';
import { useThreadHeaderOptional } from './thread-header-context';

const BREADCRUMB_PATHS = ['/chat', '/chat/pricing', '/chat/settings/api-keys', '/admin/impersonate', '/admin/jobs'] as const;
type BreadcrumbPath = (typeof BREADCRUMB_PATHS)[number];

const BREADCRUMB_MAP: Record<BreadcrumbPath, { titleKey: string; parent?: string }> = {
  '/admin/impersonate': { parent: '/chat', titleKey: 'admin.impersonate.title' },
  '/admin/jobs': { parent: '/chat', titleKey: 'admin.jobs.title' },
  '/chat': { titleKey: 'navigation.chat' },
  '/chat/pricing': { parent: '/chat', titleKey: 'navigation.pricing' },
  '/chat/settings/api-keys': { parent: '/chat', titleKey: 'settings.apiKeys.breadcrumb.current' },
};

const BREADCRUMB_PATH_SET: ReadonlySet<string> = new Set<string>(BREADCRUMB_PATHS);

function isBreadcrumbPath(path: string): path is BreadcrumbPath {
  return BREADCRUMB_PATH_SET.has(path);
}

const RouteThreadSchema = z.object({
  id: z.string(),
  isFavorite: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  title: z.string().nullish().transform(v => v ?? undefined),
});

/**
 * Build a ChatThreadFlexible-compatible thread object from route data.
 * Only includes optional properties when they have defined values
 * (required for exactOptionalPropertyTypes: true).
 */
function buildThreadFromRoute(route: z.output<typeof RouteThreadSchema>): { id: string; title?: string; isFavorite?: boolean; isPublic?: boolean } {
  const result: { id: string; title?: string; isFavorite?: boolean; isPublic?: boolean } = { id: route.id };
  if (route.title !== undefined) {
    result.title = route.title;
  }
  if (route.isFavorite !== undefined) {
    result.isFavorite = route.isFavorite;
  }
  if (route.isPublic !== undefined) {
    result.isPublic = route.isPublic;
  }
  return result;
}

type RouteThread = z.output<typeof RouteThreadSchema>;

const ThreadLoaderDataSchema = z.object({
  threadData: z.object({
    thread: RouteThreadSchema,
  }).nullish(),
  threadTitle: z.string().nullish(),
});

const RouteParamsSchema = z.object({
  slug: z.string(),
});

// Project route schemas
const ProjectLoaderDataSchema = z.object({
  project: z.object({ name: z.string() }).nullish(),
  projectName: z.string().nullish(),
});

function extractProjectName(loaderData: unknown): string | null {
  const result = ProjectLoaderDataSchema.safeParse(loaderData);
  if (!result.success) {
    return null;
  }
  // Prefer explicit projectName, fall back to project.name
  return result.data.projectName ?? result.data.project?.name ?? null;
}

function extractThreadFromLoaderData(loaderData: unknown): RouteThread | null {
  const result = ThreadLoaderDataSchema.safeParse(loaderData);
  if (!result.success) {
    return null;
  }
  return result.data.threadData?.thread ?? null;
}

function extractThreadTitle(loaderData: unknown): string | null {
  const result = ThreadLoaderDataSchema.safeParse(loaderData);
  if (!result.success) {
    return null;
  }
  return result.data.threadTitle ?? null;
}

function extractSlugFromParams(params: unknown): string | null {
  const result = RouteParamsSchema.safeParse(params);
  if (!result.success) {
    return null;
  }
  return result.data.slug;
}

function NavigationHeaderComponent({
  className,
  maxWidth = false,
  showLogo = false,
  showScrollButton = false,
  showSidebarTrigger = true,
  threadActions: threadActionsProp,
  threadTitle: threadTitleProp,
}: NavigationHeaderProps = {}) {
  const { pathname } = useLocation();
  const t = useTranslations();
  const sidebarContext = useSidebarOptional();
  const hasSidebar = sidebarContext !== null;

  const { animatingThreadId, animationPhase, createdThreadId, displayedTitle, resetToOverview, showInitialUI, storeThreadId, storeThreadTitle, thread } = useChatStore(
    useShallow(s => ({
      animatingThreadId: s.animatingThreadId,
      animationPhase: s.animationPhase,
      createdThreadId: s.createdThreadId,
      displayedTitle: s.displayedTitle,
      resetToOverview: s.resetToOverview,
      showInitialUI: s.showInitialUI,
      storeThreadId: s.thread?.id ?? null,
      storeThreadTitle: s.thread?.title ?? null,
      thread: s.thread,
    })),
  );

  const matches = useMatches();

  // Check for normal thread route
  const normalThreadMatch = matches.find(m => m.routeId === '/_protected/chat/$slug');

  // Check for project thread route
  const projectThreadMatch = matches.find(m => m.routeId === '/_protected/chat/projects/$projectId/$slug');

  // Use project thread match if available, otherwise normal thread match
  const threadMatch = projectThreadMatch ?? normalThreadMatch;
  const routeThreadTitle = extractThreadTitle(threadMatch?.loaderData);
  const routeThread = extractThreadFromLoaderData(threadMatch?.loaderData);
  const routeSlug = extractSlugFromParams(threadMatch?.params);

  // Project route detection - use pathname as primary indicator
  const isProjectPath = pathname?.includes('/chat/projects/');

  // Extract project ID from pathname for query fallback
  const projectIdFromPath = isProjectPath
    ? pathname?.match(/\/chat\/projects\/([^/]+)/)?.[1]
    : null;

  // Find route match for loader data
  const projectMatch = matches.find(m =>
    m.routeId === '/_protected/chat/projects/$projectId'
    || m.routeId?.startsWith('/_protected/chat/projects/$projectId/')
    || (isProjectPath && m.loaderData && typeof m.loaderData === 'object' && ('projectName' in m.loaderData || 'project' in m.loaderData)),
  );

  // Always fetch project query when on project page - this ensures header updates after settings changes
  // Query is cached so this doesn't cause extra network requests
  const { data: projectQueryData } = useProjectQuery(projectIdFromPath ?? '', !!projectIdFromPath);
  const queryProjectName = projectQueryData?.success ? projectQueryData.data?.name : null;

  // Extract project name from loader data - check project thread match first (has projectName),
  // then project index match, then fall back to query
  const loaderProjectName = extractProjectName(projectThreadMatch?.loaderData)
    ?? extractProjectName(projectMatch?.loaderData);

  // Use query data (reactive to changes) over loader data (static)
  const routeProjectName = queryProjectName ?? loaderProjectName;
  const isOnProjectPage = !!isProjectPath;
  // Detect if on project thread (has slug after projectId)
  const isOnProjectThreadPage = isOnProjectPage && !!pathname?.match(/\/chat\/projects\/[^/]+\/[^/]+/);

  const context = useThreadHeaderOptional();
  const navigate = useNavigate();
  const handleBreadcrumbClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Force store reset for same-URL navigation (already on /chat with active thread)
    if (pathname === '/chat') {
      resetToOverview();
    }
    navigate({ to: '/chat' });
  }, [navigate, pathname, resetToOverview]);

  const isStaticRoute = isBreadcrumbPath(pathname);
  const hasActiveThread = pathname === '/chat' && !showInitialUI && (createdThreadId || thread);
  const isOnThreadPage = pathname?.startsWith('/chat/') && pathname !== '/chat' && !isStaticRoute;
  const hasThreadInStore = !showInitialUI && !!thread;
  const shouldFetchThread = !!storeThreadId && isOnThreadPage && !hasThreadInStore;
  const { data: cachedThreadData } = useThreadQuery(storeThreadId ?? '', shouldFetchThread);

  // Prefer store title when available (most up-to-date after AI title generation)
  // Fall back to route/cache for SSR hydration
  const effectiveThreadTitle = storeThreadTitle
    ?? routeThreadTitle
    ?? (cachedThreadData?.success ? cachedThreadData.data?.thread?.title : null);

  // Determine current thread ID for animation scoping
  // Animation should only show if we're viewing the thread being animated
  const currentThreadId = storeThreadId ?? routeThread?.id;
  const isAnimatingCurrentThread = animatingThreadId === currentThreadId && currentThreadId !== null;

  const shouldUseStoreThreadTitle = hasActiveThread || (!isStaticRoute && pathname?.startsWith('/chat/') && pathname !== '/chat');
  const threadTitle = threadTitleProp ?? (showSidebarTrigger && shouldUseStoreThreadTitle ? effectiveThreadTitle : null);

  const contextThreadActions = showSidebarTrigger && shouldUseStoreThreadTitle ? context.threadActions : null;
  const ssrThreadActions = routeThread && routeSlug && !contextThreadActions
    ? <ChatThreadActions thread={buildThreadFromRoute(routeThread)} slug={routeSlug} />
    : null;
  const threadActions = threadActionsProp ?? contextThreadActions ?? ssrThreadActions;

  const isThreadPage = (
    (pathname?.startsWith('/chat/') && pathname !== '/chat' && !isStaticRoute && !isOnProjectPage)
    || pathname?.startsWith('/public/chat/')
    || isOnProjectThreadPage
  );
  const isOverviewPage = pathname === '/chat' && !hasActiveThread;
  const showThreadBreadcrumb = (isThreadPage || hasActiveThread) && threadTitle;
  const showProjectBreadcrumb = isOnProjectPage && routeProjectName;

  // Priority: Project thread > Project index > Thread page > Static routes
  const currentPage = isOnProjectThreadPage
    ? { isDynamic: true as const, titleKey: threadTitle ?? '' }
    : showProjectBreadcrumb
      ? { isDynamic: true as const, titleKey: routeProjectName }
      : showThreadBreadcrumb
        ? { isDynamic: true as const, titleKey: threadTitle }
        : pathname && isBreadcrumbPath(pathname) ? BREADCRUMB_MAP[pathname] : undefined;
  return (
    <header
      className={cn(
        'sticky top-0 left-0 right-0 z-50 flex h-14 sm:h-16 shrink-0 items-center gap-2 transition-all duration-200 ease-in-out bg-background',
        className,
      )}
    >
      <div className={cn(
        'flex items-center justify-between gap-2 pt-4 px-5 md:px-6 lg:px-8 h-14 sm:h-16 w-full',
        maxWidth && 'max-w-4xl mx-auto',
      )}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
          {hasSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden min-h-11 min-w-11 shrink-0 -ms-2"
              onClick={() => sidebarContext.setOpenMobile(true)}
              aria-label={t('accessibility.openSidebar')}
            >
              <Icons.panelLeft className="size-6" />
            </Button>
          )}
          {showLogo && !isOverviewPage && (
            <>
              <Link to="/" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 touch-manipulation">
                <Logo size="sm" variant="icon" />
                <span className="text-sm sm:text-base font-semibold tracking-tight hidden xs:inline">
                  {BRAND.displayName}
                </span>
              </Link>
              <Separator orientation="vertical" className="me-1 sm:me-2 h-3.5 sm:h-4 flex-shrink-0 opacity-30" />
            </>
          )}
          {!isOverviewPage && currentPage && (
            <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
              <BreadcrumbList className="flex-nowrap overflow-hidden">
                <BreadcrumbItem className="shrink-0 hidden sm:flex">
                  <BreadcrumbLink asChild>
                    <Link
                      to="/chat"
                      onClick={handleBreadcrumbClick}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm whitespace-nowrap"
                    >
                      {BRAND.displayName}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:flex shrink-0" />
                {/* Project thread: Collapsed dropdown on small screens, full path on larger */}
                {isOnProjectThreadPage && (
                  <>
                    {/* Mobile: Show ellipsis dropdown for collapsed items */}
                    <BreadcrumbItem className="sm:hidden shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                          <BreadcrumbEllipsis className="size-4" />
                          <span className="sr-only">{t('actions.more')}</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem asChild>
                            <Link to="/chat" onClick={handleBreadcrumbClick}>
                              {BRAND.displayName}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              to="/chat/projects/$projectId"
                              params={{ projectId: projectIdFromPath ?? '' }}
                            >
                              {routeProjectName}
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="sm:hidden shrink-0" />
                    {/* Desktop: Show Project name link - truncates */}
                    <BreadcrumbItem className="hidden sm:flex min-w-0">
                      <BreadcrumbLink asChild>
                        <Link
                          to="/chat/projects/$projectId"
                          params={{ projectId: projectIdFromPath ?? '' }}
                          className="text-muted-foreground hover:text-foreground transition-colors text-sm truncate max-w-24 lg:max-w-32 text-left"
                          dir="auto"
                        >
                          {routeProjectName}
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:flex shrink-0" />
                  </>
                )}
                {/* Project index: Project name (current) — no "Projects" crumb */}
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage
                    className="block truncate text-sm text-left"
                    dir="auto"
                    title={'isDynamic' in currentPage && currentPage.isDynamic ? currentPage.titleKey : t(currentPage.titleKey)}
                  >
                    {'isDynamic' in currentPage && currentPage.isDynamic
                      ? (isAnimatingCurrentThread && (animationPhase === 'deleting' || animationPhase === 'typing')
                          ? (
                              <>
                                {displayedTitle}
                                <span className="animate-blink inline-block w-[2px] h-[1em] bg-current ml-[1px] align-middle" aria-hidden="true" />
                              </>
                            )
                          : (effectiveThreadTitle ?? currentPage.titleKey))
                      : t(currentPage.titleKey)}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </div>
        {!isOverviewPage && (
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 -me-1.5 sm:me-0">
            {showScrollButton && <ChatScrollButton variant="header" />}
            {threadActions}
          </div>
        )}
      </div>
    </header>
  );
}
export const NavigationHeader = memo(NavigationHeaderComponent);

function MinimalHeaderComponent({ className }: { className?: string } = {}) {
  const t = useTranslations();
  const sidebarContext = useSidebarOptional();
  const hasSidebar = sidebarContext !== null;

  const {
    isCreatingThread,
    isModeratorStreaming,
    isStreaming,
    showInitialUI,
    waitingToStartStreaming,
  } = useChatStore(useShallow(s => ({
    isCreatingThread: s.isCreatingThread,
    // Derive streaming state from phase (source of truth)
    isModeratorStreaming: s.phase === ChatPhases.MODERATOR,
    isStreaming: s.phase === ChatPhases.PRESEARCH
      || s.phase === ChatPhases.PARTICIPANTS
      || s.phase === ChatPhases.MODERATOR,
    showInitialUI: s.showInitialUI,
    waitingToStartStreaming: s.phase === ChatPhases.IDLE && s.pendingMessage !== null,
  })));

  const isThreadFlowActive = isStreaming || isCreatingThread || waitingToStartStreaming || isModeratorStreaming;
  const showGlassEffect = !showInitialUI && isThreadFlowActive;

  return (
    <header
      className={cn(
        'sticky top-0 left-0 right-0 z-50',
        'flex h-14 sm:h-16 shrink-0 items-center',
        showGlassEffect && [
          'backdrop-blur-xl bg-background/60',
          'border-b border-border/30',
          'mb-2',
          'sm:backdrop-blur-none sm:bg-transparent sm:border-b-0 sm:mb-0',
        ],
        className,
      )}
    >
      {hasSidebar && (
        <div className="flex items-center px-3 sm:px-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={() => sidebarContext.setOpenMobile(true)}
            aria-label={t('accessibility.openSidebar')}
          >
            <Icons.panelLeft className="size-6" />
          </Button>
        </div>
      )}
      <div className="hidden md:block h-14 sm:h-16" />
    </header>
  );
}
export const MinimalHeader = memo(MinimalHeaderComponent);

export function PageHeader({
  action,
  children,
  className,
  description,
  showSeparator = true,
  size = 'md',
  title,
}: PageHeaderProps) {
  const sizeConfig = {
    lg: {
      description: 'text-base text-muted-foreground',
      spacing: 'space-y-8',
      title: 'text-3xl font-bold tracking-tight',
    },
    md: {
      description: 'text-sm text-muted-foreground',
      spacing: 'space-y-6',
      title: 'text-2xl font-semibold tracking-tight',
    },
    sm: {
      description: 'text-xs text-muted-foreground',
      spacing: 'space-y-3',
      title: 'text-lg font-semibold tracking-tight',
    },
  } as const;
  const config = sizeConfig[size];
  return (
    <div className={cn(config.spacing, className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className={config.title}>{title}</h1>
          {description && (
            <p className={config.description}>{description}</p>
          )}
        </div>
        {action && <div className="flex items-center space-x-2">{action}</div>}
      </div>
      {children}
      {showSeparator && <Separator />}
    </div>
  );
}

export function ChatPageHeader({
  action,
  className,
  description,
  size = 'md',
  title,
}: ChatPageHeaderProps) {
  const chatSectionProps = className !== undefined ? { className } : {};
  return (
    <ChatSection {...chatSectionProps}>
      <div className="mx-auto px-5 md:px-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title={title}
            description={description}
            size={size}
            showSeparator={false}
          />
          {action && (
            <div className="flex items-center gap-2">
              {action}
            </div>
          )}
        </div>
      </div>
    </ChatSection>
  );
}
export function PageHeaderAction({ children }: { children: ReactNode }) {
  return <div className="flex items-center space-x-2">{children}</div>;
}

export function ChatPageHeaderSkeleton() {
  return (
    <div className="mx-auto px-5 md:px-6 py-4">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
