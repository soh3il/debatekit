import { CardVariants } from '@debatekit/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { GlowingEffect } from '@/components/ui/glowing-effect';

import { MotionSpan, VIEWPORT_ONCE } from './motion-variants';
import { SectionHeader } from './section-header';

type ComparisonStepsSectionProps = {
  description?: string;
  heading: string;
  headingHighlight: string;
  label?: string;
  /** "Before" column configuration */
  manual: {
    badge: string;
    label: string;
    steps: readonly string[];
  };
  /** "After" column configuration */
  debatekit: {
    badge: string;
    label: string;
    steps: readonly string[];
  };
};

/**
 * Side-by-side comparison of manual (single model) vs DebateKit workflows.
 * Left column shows struck-through steps; right column shows animated
 * numbered steps with glow border.
 */
export function ComparisonStepsSection({
  debatekit,
  description,
  heading,
  headingHighlight,
  label,
  manual,
}: ComparisonStepsSectionProps) {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label={label}
          heading={heading}
          headingHighlight={headingHighlight}
          description={description}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card variant={CardVariants.GLASS_SUBTLE}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary">{manual.badge}</Badge>
                <span className="text-sm font-medium text-destructive/70">{manual.label}</span>
              </div>
              <ol className="space-y-4">
                {manual.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-sm text-muted-foreground/60 line-through">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <div className="relative rounded-2xl border-2 border-white/20 dark:border-white/10 p-2 md:rounded-3xl md:p-3">
            <GlowingEffect blur={0} borderWidth={2} spread={80} glow proximity={64} inactiveZone={0.01} disabled={false} />
            <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-white/20 dark:border-white/10 bg-background/50 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge>{debatekit.badge}</Badge>
                <span className="text-sm font-medium text-emerald-400">{debatekit.label}</span>
              </div>
              <ol className="space-y-4">
                {debatekit.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <MotionSpan
                      className="flex-shrink-0 size-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary"
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={VIEWPORT_ONCE}
                      transition={{ delay: i * 0.15, duration: 0.4 }}
                    >
                      {i + 1}
                    </MotionSpan>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
