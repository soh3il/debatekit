import { CardVariants } from '@debatekit/shared';

import { Card, CardContent } from '@/components/ui/card';
import { GlowingEffect } from '@/components/ui/glowing-effect';

import { LANDING_MODES } from './landing-modes';
import { cellReveal, denseStagger, MotionDiv, quickTransition, VIEWPORT_ONCE } from './motion-variants';
import { SectionHeader } from './section-header';

type ModesGridSectionProps = {
  /** Optional footer text below the grid */
  footer?: string;
};

/**
 * Reusable "Deliberation Modes" section shared across all solution landing pages.
 * Shows the four modes (Debating, Analyzing, Brainstorming, Problem Solving)
 * in a 2x2 card grid.
 */
export function ModesGridSection({
  footer = 'Each mode shapes the deliberation differently \u2014 choose based on your question.',
}: ModesGridSectionProps) {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Deliberation Modes"
          heading="Four Ways to"
          headingHighlight="Structure the Debate"
        />

        <MotionDiv
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {LANDING_MODES.map((mode, i) => (
            <MotionDiv
              key={mode.title}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <mode.icon className={`size-6 ${mode.color}`} />
                    <h3 className="text-lg font-semibold">{mode.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {mode.description}
                  </p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>

        {footer && (
          <p className="mt-10 text-center text-muted-foreground max-w-2xl mx-auto">
            {footer}
          </p>
        )}
      </div>
    </section>
  );
}
