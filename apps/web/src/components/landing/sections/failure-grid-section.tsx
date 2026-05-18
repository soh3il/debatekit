import { CardVariants } from '@debatekit/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { GlowingEffect } from '@/components/ui/glowing-effect';

import type { LandingFailure } from './landing-types';
import { cellReveal, denseStagger, MotionDiv, quickTransition, VIEWPORT_ONCE } from './motion-variants';
import { SectionHeader } from './section-header';

type FailureGridSectionProps = {
  description: string;
  /** Optional paragraph below the grid */
  footer?: React.ReactNode;
  heading: string;
  headingHighlight: string;
  items: readonly LandingFailure[];
  label?: string;
};

/**
 * Reusable "Why Not Single Model" section used on solution landing pages.
 * Shows numbered failure cards with icon, title, and description.
 */
export function FailureGridSection({
  description,
  footer,
  heading,
  headingHighlight,
  items,
  label = 'The Single-Model Problem',
}: FailureGridSectionProps) {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label={label}
          heading={heading}
          headingHighlight={headingHighlight}
          description={description}
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {items.map((item, i) => (
            <MotionDiv
              key={item.number}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="destructive" className="font-mono text-xs">{item.number}</Badge>
                    <item.icon className="size-5 text-destructive/70" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>

        {footer && (
          <p className="mt-10 text-center text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {footer}
          </p>
        )}
      </div>
    </section>
  );
}
