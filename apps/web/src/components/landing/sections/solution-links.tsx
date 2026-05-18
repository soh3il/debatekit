import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';

import { Icons } from '@/components/icons';
import { cn } from '@/lib/ui/cn';

import type { AccentColor } from './accent-colors';
import { ACCENT_COLORS } from './accent-colors';
import { MotionDiv, quickTransition, subtleFade, VIEWPORT_ONCE } from './motion-variants';
import { SectionHeader } from './section-header';

type SolutionPage = {
  accentColor: AccentColor;
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
};

const SOLUTION_PAGES: SolutionPage[] = [
  {
    accentColor: 'emerald',
    description: 'Multi-model consensus for investment memos, due diligence, and portfolio risk.',
    href: '/solutions/investment-analysis',
    icon: Icons.trendingUp,
    title: 'Investment Analysis',
  },
  {
    accentColor: 'blue',
    description: 'Structured deal evaluation with competing AI perspectives on valuation and fit.',
    href: '/solutions/ma-deal-screening',
    icon: Icons.scale,
    title: 'M&A Deal Screening',
  },
  {
    accentColor: 'indigo',
    description: 'Contract analysis and risk identification through adversarial AI review.',
    href: '/solutions/legal-review',
    icon: Icons.fileSearch,
    title: 'Legal Review',
  },
  {
    accentColor: 'red',
    description: 'Clinical decision support with multi-model differential diagnosis.',
    href: '/solutions/healthcare-clinical',
    icon: Icons.brain,
    title: 'Healthcare Clinical',
  },
  {
    accentColor: 'violet',
    description: 'Regulatory compliance analysis with cross-jurisdictional AI debate.',
    href: '/solutions/compliance-advisory',
    icon: Icons.shieldAlert,
    title: 'Compliance Advisory',
  },
  {
    accentColor: 'indigo',
    description: 'Multi-model architecture review for microservices, data layer, and infrastructure decisions.',
    href: '/solutions/architecture-review',
    icon: Icons.layers,
    title: 'Architecture Review',
  },
  {
    accentColor: 'teal',
    description: 'Connect any MCP client to structured AI debates and brainstorming.',
    href: '/mcp',
    icon: Icons.terminal,
    title: 'MCP Server',
  },
  {
    accentColor: 'blue',
    description: 'Karpathy\'s LLM council concept, built for production with structured deliberation.',
    href: '/solutions/llm-council',
    icon: Icons.users,
    title: 'LLM Council',
  },
  {
    accentColor: 'violet',
    description: 'Multi-agent debate validated at ICML 2024 — from research papers to your workflow.',
    href: '/solutions/multi-agent-debate',
    icon: Icons.scale,
    title: 'Multi-Agent Debate',
  },
  {
    accentColor: 'emerald',
    description: 'Multi-model AI council for better decisions on any question.',
    href: '/solutions/ai-council',
    icon: Icons.sparkles,
    title: 'AI Council',
  },
];

type SolutionLinksSectionProps = {
  currentPath: string;
  heading?: string;
  label?: string;
};

export function SolutionLinksSection({
  currentPath,
  heading = 'Built for Every High-Stakes Decision',
  label = 'Explore More',
}: SolutionLinksSectionProps) {
  const pages = SOLUTION_PAGES.filter(p => p.href !== currentPath);

  return (
    <section className="relative py-12 sm:py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionHeader heading={heading} label={label} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {pages.map((page, i) => {
            const colors = ACCENT_COLORS[page.accentColor];

            return (
              <MotionDiv
                key={page.href}
                initial={subtleFade.hidden}
                transition={{ ...quickTransition, delay: i * 0.08 }}
                viewport={VIEWPORT_ONCE}
                whileInView={subtleFade.visible}
              >
                <Link
                  className={cn(
                    'group flex flex-col h-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-6 transition-all duration-300',
                    colors.cardHoverBorder,
                    colors.cardHoverBg,
                  )}
                  to={page.href}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={cn(
                        'flex items-center justify-center size-10 rounded-lg border',
                        colors.glowBg,
                        colors.badgeBorder,
                      )}
                    >
                      <page.icon className={cn('size-5', colors.iconText)} />
                    </div>
                    <Icons.arrowRight className="size-4 text-white/20 transition-all duration-300 group-hover:text-white/60 group-hover:translate-x-0.5" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{page.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {page.description}
                  </p>
                </Link>
              </MotionDiv>
            );
          })}
        </div>
      </div>
    </section>
  );
}
