import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { Icons } from '@/components/icons';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTranslations } from '@/lib/i18n';

function AdminHeader() {
  const t = useTranslations();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  const navItems = [
    { icon: <Icons.zap className="size-4" />, label: t('admin.nav.pipeline'), to: '/admin/jobs' },
    { icon: <Icons.userCog className="size-4" />, label: t('admin.nav.impersonate'), to: '/admin/impersonate' },
  ];

  const activeItem = navItems.find(item => pathname.startsWith(item.to));

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-background/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-5xl flex items-center justify-between gap-1.5 px-4 lg:px-8 py-1.5">
        <div className="flex items-center gap-0.5 min-w-0">
          <Logo />
          <div className="h-4 w-px bg-white/[0.08]" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground shrink-0">
                {activeItem?.icon}
                <span className="hidden sm:inline">{activeItem?.label ?? t('admin.nav.pipeline')}</span>
                <Icons.chevronsUpDown className="size-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                {t('admin.nav.label')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {navItems.map(item => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to} preload="intent" className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          variant="glass"
          size="sm"
          className="shrink-0"
          startIcon={<Icons.home className="size-3.5" />}
          onClick={() => navigate({ to: '/chat' })}
        >
          <span className="hidden sm:inline">{t('admin.layout.backToChat')}</span>
        </Button>
      </div>
    </header>
  );
}

function AdminPageLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen flex-col bg-background">
        <AdminHeader />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}

export { AdminHeader, AdminPageLayout };
