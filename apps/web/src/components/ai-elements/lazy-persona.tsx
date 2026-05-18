'use client';

import { memo } from 'react';

import type { PersonaState } from '@/components/ai-elements/persona';
import { Persona } from '@/components/ai-elements/persona';
import { cn } from '@/lib/ui/cn';

type LazyPersonaProps = {
  state: PersonaState;
  className?: string;
};

/**
 * Logo-based orb using the actual brand logo image with CSS animations
 * for each persona state (idle, listening, thinking, speaking, asleep).
 */
export const LazyPersona = memo(({ className, ...props }: LazyPersonaProps) => (
  <div className={cn('relative', className)}>
    <Persona
      {...props}
      className="size-full"
    />
  </div>
));

LazyPersona.displayName = 'LazyPersona';
