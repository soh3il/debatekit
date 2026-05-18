'use client';

import type { FC } from 'react';
import { memo } from 'react';

import { cn } from '@/lib/ui/cn';

export type PersonaState
  = | 'idle'
    | 'listening'
    | 'thinking'
    | 'speaking'
    | 'asleep';

type PersonaProps = {
  state: PersonaState;
  className?: string;
  onReady?: () => void;
};

const stateStyles: Record<PersonaState, string> = {
  asleep: 'animate-orb-asleep opacity-60',
  idle: 'animate-orb-idle',
  listening: 'animate-orb-listening',
  speaking: 'animate-orb-speaking',
  thinking: 'animate-orb-thinking',
};

export const Persona: FC<PersonaProps> = memo(
  ({
    className,
    onReady,
    state = 'idle',
  }) => {
    return (
      <img
        alt=""
        src="/static/logo.webp"
        onLoad={onReady}
        className={cn(
          'size-16 shrink-0 pointer-events-none object-contain',
          stateStyles[state],
          className,
        )}
      />
    );
  },
);

Persona.displayName = 'Persona';
