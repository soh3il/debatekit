import { CardVariants } from '@debatekit/shared';

import { Card, CardContent } from '@/components/ui/card';
import { GlowingEffect } from '@/components/ui/glowing-effect';

import type { LandingFeatureCard } from './landing-types';
import { cellReveal, denseStagger, MotionDiv, quickTransition, VIEWPORT_ONCE } from './motion-variants';
import { SectionHeader } from './section-header';

type FeatureCardGridSectionProps = {
  /** Number of columns at md breakpoint */
  columns?: 2 | 3;
  description?: string;
  heading: string;
  headingHighlight: string;
  items: readonly LandingFeatureCard[];
  label?: string;
};

/**
 * Reusable icon+title+description card grid used for principles,
 * advantages, integrations, reasons, etc.
 */
export function FeatureCardGridSection({
  columns = 3,
  description,
  heading,
  headingHighlight,
  items,
  label,
}: FeatureCardGridSectionProps) {
  const gridClass = columns === 2
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-6'
    : 'grid grid-cols-1 md:grid-cols-3 gap-6';

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
          className={gridClass}
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {items.map((item, i) => (
            <MotionDiv
              key={item.title}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <item.icon className={`size-6 ${item.color}`} />
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>
      </div>
    </section>
  );
}
