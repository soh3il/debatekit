import { BRAND } from '@debatekit/shared';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/ui/cn';

// Full BRAND.logoGradient spectrum for holographic glow cycling
const GLOW_COLORS = [...BRAND.logoGradient] as const;
const DEFAULT_GLOW_COLOR = BRAND.logoGradient[0];

type LogoGlowProps = {
  className?: string;
};

export function LogoGlow({ className }: LogoGlowProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion;
  const colorCycle = [...GLOW_COLORS, DEFAULT_GLOW_COLOR];

  return (
    <motion.div
      className={cn(
        'absolute inset-0 rounded-full blur-xl',
        className,
      )}
      animate={shouldAnimate
        ? {
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.35, 0.2],
            backgroundColor: colorCycle,
          }
        : {}}
      transition={{
        scale: {
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        opacity: {
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        backgroundColor: {
          duration: 24,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
      style={{
        willChange: 'transform, opacity',
        backgroundColor: DEFAULT_GLOW_COLOR,
      }}
    />
  );
}
