import { CardVariants } from '@debatekit/shared';

import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card, CardContent } from '@/components/ui/card';
import { GlowingEffect } from '@/components/ui/glowing-effect';

import { LandingBrowserFrame } from '../landing-browser-frame';
import type { LandingRole } from './landing-types';
import { cellReveal, denseStagger, MotionDiv, quickTransition, VIEWPORT_ONCE } from './motion-variants';
import { SectionHeader } from './section-header';

type RoleGridSectionProps = {
  /** Config demo component rendered in browser frame below the grid */
  configDemo: React.ReactNode;
  description: string;
  heading: string;
  headingHighlight: string;
  label?: string;
  roles: readonly LandingRole[];
};

/**
 * Reusable role assignment section used on solution landing pages.
 * Shows role cards with icon, title, model badge, and description,
 * followed by a browser-frame config demo.
 */
export function RoleGridSection({
  configDemo,
  description,
  heading,
  headingHighlight,
  label = 'Configurable Roles',
  roles,
}: RoleGridSectionProps) {
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
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {roles.map((role, i) => (
            <MotionDiv
              key={role.title}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <role.icon className={`size-6 ${role.color}`} />
                    <h3 className="text-lg font-semibold">{role.title}</h3>
                    <Badge variant="secondary" className="text-xs ml-auto">{role.model}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{role.description}</p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>

        <div className="mt-12">
          <BlurFade delay={0.1} inView className="max-w-4xl mx-auto">
            <LandingBrowserFrame>
              {configDemo}
            </LandingBrowserFrame>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
