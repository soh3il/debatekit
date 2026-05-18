'use client';

import { ClientOnly, Link } from '@tanstack/react-router';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { RadialGlow } from '@/components/ui/radial-glow';
import { BRAND, getCopyrightText } from '@/constants';

type LandingPageLayoutProps = {
  children: React.ReactNode;
};

export function LandingPageLayout({ children }: LandingPageLayoutProps) {
  return (
    <div className="relative min-h-svh flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none flex items-center justify-center overflow-hidden">
        <ClientOnly fallback={null}>
          <div className="block sm:hidden">
            <RadialGlow size={1200} offsetY={-200} duration={18} animate />
          </div>
          <div className="hidden sm:block lg:hidden">
            <RadialGlow size={1800} offsetY={-200} duration={18} animate />
          </div>
          <div className="hidden lg:block">
            <RadialGlow size={2400} offsetY={-300} duration={18} animate />
          </div>
        </ClientOnly>
      </div>

      {/* Sticky header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="sm" variant="icon" className="size-7 sm:size-8" />
            <span className="text-base sm:text-lg font-semibold tracking-tight">{BRAND.name}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6">
            <Link to="/chat/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Button asChild size="sm">
              <Link to="/chat">Try a Debate</Link>
            </Button>
          </nav>

          {/* Mobile nav */}
          <nav className="sm:hidden flex items-center gap-5">
            <Link to="/chat/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Button asChild size="sm">
              <Link to="/chat">Try a Debate</Link>
            </Button>
          </nav>
        </div>

      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Logo size="sm" variant="icon" className="size-5 sm:size-6" />
              <span className="text-sm font-medium">{BRAND.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {getCopyrightText()}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
