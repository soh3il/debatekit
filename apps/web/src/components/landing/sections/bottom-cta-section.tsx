import { Icons } from '@/components/icons';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';

import { MotionDiv, quickTransition, subtleFade, VIEWPORT_ONCE } from './motion-variants';

type BottomCTASectionProps = {
  children?: React.ReactNode;
  ctaHref?: string;
  ctaText?: string;
  description: string;
  heading: string;
  onCtaClick?: () => void;
};

/**
 * Shared bottom CTA section used across all landing pages.
 *
 * - Optional `children` renders above the CTA button (e.g. MCPPlatformCodeBlock)
 * - Defaults to sign-in link
 */
export function BottomCTASection({
  children,
  ctaHref = '/auth/sign-in',
  ctaText = 'Get Started',
  description,
  heading,
  onCtaClick,
}: BottomCTASectionProps) {
  return (
    <section className="py-12 sm:py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 text-center relative min-w-0 overflow-hidden">
        <MotionDiv
          initial={subtleFade.hidden}
          whileInView={subtleFade.visible}
          viewport={VIEWPORT_ONCE}
          transition={quickTransition}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-snug mb-3 sm:mb-4">
            {heading}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-xl mx-auto leading-relaxed">
            {description}
          </p>

          {children}

          <HoverBorderGradient
            as="a"
            containerClassName="mx-auto"
            className="flex items-center gap-2 px-6 py-2.5 sm:px-8 sm:py-3 text-sm sm:text-base font-medium"
            href={ctaHref}
            onClick={onCtaClick}
          >
            {ctaText}
            <Icons.arrowRight className="size-4" />
          </HoverBorderGradient>
        </MotionDiv>
      </div>
    </section>
  );
}
