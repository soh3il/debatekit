'use client';

import { motion } from 'motion/react';
import { useId } from 'react';

import { Icons } from '@/components/icons';
import {
  quickTransition,
  subtleFade,
  VIEWPORT_ONCE,
} from '@/components/landing/sections/motion-variants';
import { cn } from '@/lib/ui/cn';

// ============================================================================
// DATA
// ============================================================================

const STEPS = [
  {
    badge: '30s',
    color: 'teal' as const,
    description:
      'Add one JSON config. Claude Code, Cursor, any MCP client. 30 seconds.',
    icon: Icons.zap,
    title: 'Connect',
  },
  {
    badge: '3 models',
    color: 'multi' as const,
    description:
      'Models respond sequentially. Each sees all previous responses. Real cross-examination.',
    icon: Icons.messagesSquare,
    title: 'Debate',
  },
  {
    badge: '1 consensus',
    color: 'amber' as const,
    description:
      'Council Moderator synthesizes agreements, disagreements, and recommendations.',
    icon: Icons.brain,
    title: 'Consensus',
  },
] as const;

// ============================================================================
// COLOR CONFIG
// ============================================================================

const NODE_STYLES = {
  amber: {
    badgeColor: 'text-amber-400/70 border-amber-500/20',
    glow: 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_24px_rgba(245,158,11,0.12)]',
    icon: 'text-amber-400',
    ring: 'ring-amber-500/20',
  },
  multi: {
    badgeColor: 'text-blue-400/70 border-blue-500/20',
    glow: 'bg-gradient-to-br from-teal-500/10 via-blue-500/10 to-violet-500/10 border-transparent shadow-[0_0_24px_rgba(99,102,241,0.12)]',
    icon: 'text-blue-400',
    ring: 'ring-violet-500/20',
  },
  teal: {
    badgeColor: 'text-teal-400/70 border-teal-500/20',
    glow: 'bg-teal-500/10 border-teal-500/30 shadow-[0_0_24px_rgba(20,184,166,0.12)]',
    icon: 'text-teal-400',
    ring: 'ring-teal-500/20',
  },
} as const;

const MULTI_BORDER
  = 'border border-transparent [background-clip:padding-box] before:absolute before:inset-0 before:rounded-full before:-z-10 before:bg-gradient-to-br before:from-teal-500/30 before:via-blue-500/30 before:to-violet-500/30 before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:p-[1px]';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MCPPipelineSteps() {
  return (
    <div className="w-full">
      {/* Desktop: horizontal layout */}
      <div className="hidden lg:flex flex-col items-center gap-8">
        <div className="flex items-start justify-center gap-0">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex items-start">
              <StepNode step={step} index={i} />
              {i < STEPS.length - 1 && <ConnectorHorizontal />}
            </div>
          ))}
        </div>

        {/* Timeline bar */}
        <motion.div
          className="relative w-full max-w-md h-1 rounded-full bg-white/[0.04] overflow-hidden"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT_ONCE}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-teal-400/60 via-blue-400/50 via-60% to-amber-400/60"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={VIEWPORT_ONCE}
            transition={{ delay: 0.6, duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'left' }}
          />
        </motion.div>
      </div>

      {/* Mobile: vertical layout */}
      <div className="flex lg:hidden">
        <div className="flex flex-col items-center mr-5 sm:mr-6">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center">
              <MobileNode step={step} index={i} />
              {i < STEPS.length - 1 && <ConnectorVertical />}
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-around py-2">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={subtleFade.hidden}
              whileInView={subtleFade.visible}
              viewport={VIEWPORT_ONCE}
              transition={{
                ...quickTransition,
                delay: i * 0.15,
              }}
              className="flex flex-col justify-center min-h-[80px]"
            >
              <h3 className="text-sm font-semibold text-white">
                {step.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1 max-w-[260px]">
                {step.description}
              </p>
              <span className={cn(
                'mt-1.5 inline-flex self-start items-center rounded-full border px-2 py-0.5 text-[10px] font-mono',
                NODE_STYLES[step.color].badgeColor,
              )}
              >
                {step.badge}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DESKTOP NODE
// ============================================================================

type StepNodeProps = {
  index: number;
  step: (typeof STEPS)[number];
};

function StepNode({ index, step }: StepNodeProps) {
  const style = NODE_STYLES[step.color];
  const IconComponent = step.icon;

  return (
    <motion.div
      initial={subtleFade.hidden}
      whileInView={subtleFade.visible}
      viewport={VIEWPORT_ONCE}
      transition={{
        ...quickTransition,
        delay: index * 0.15,
      }}
      className="flex flex-col items-center w-[180px]"
    >
      {/* Glow ring + circle with rotating conic-gradient ring */}
      <div className="relative">
        {/* Rotating ring */}
        <motion.div
          className="absolute -inset-2 rounded-full opacity-40"
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.1), transparent)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
        />
        <div
          className={cn(
            'relative size-24 rounded-full flex items-center justify-center',
            'ring-1',
            style.ring,
          )}
        >
          <div
            className={cn(
              'relative size-24 rounded-full flex items-center justify-center border',
              style.glow,
              step.color === 'multi' && MULTI_BORDER,
            )}
          >
            <IconComponent className={cn('size-9', style.icon)} />
          </div>
        </div>
      </div>

      {/* Label */}
      <h3 className="mt-4 text-sm font-semibold text-white">{step.title}</h3>
      <p className="mt-1.5 text-xs text-muted-foreground text-center leading-relaxed max-w-[160px]">
        {step.description}
      </p>

      {/* Micro-badge */}
      <span className={cn(
        'mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono',
        style.badgeColor,
      )}
      >
        {step.badge}
      </span>
    </motion.div>
  );
}

// ============================================================================
// MOBILE NODE
// ============================================================================

function MobileNode({ index, step }: StepNodeProps) {
  const style = NODE_STYLES[step.color];
  const IconComponent = step.icon;

  return (
    <motion.div
      initial={subtleFade.hidden}
      whileInView={subtleFade.visible}
      viewport={VIEWPORT_ONCE}
      transition={{
        ...quickTransition,
        delay: index * 0.15,
      }}
      className={cn(
        'relative size-16 rounded-full flex items-center justify-center border',
        'ring-1',
        style.ring,
        style.glow,
        step.color === 'multi' && MULTI_BORDER,
      )}
    >
      <IconComponent className={cn('size-6', style.icon)} />
    </motion.div>
  );
}

// ============================================================================
// CONNECTORS
// ============================================================================

function ConnectorHorizontal() {
  const gradientId = useId();

  return (
    <div className="flex items-center h-24 mx-1">
      <div className="relative w-24 xl:w-32 h-6 flex items-center">
        {/* Base track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-white/[0.06] rounded-full" />
        {/* Animated beam */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(20,184,166,0.4)" />
              <stop offset="50%" stopColor="rgba(59,130,246,0.4)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0.4)" />
            </linearGradient>
          </defs>
          <motion.line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ opacity: 0, pathLength: 0 }}
            whileInView={{ opacity: 1, pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          />
        </svg>
        {/* Traveling dot */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-white/40"
          animate={{ left: ['0%', '100%'] }}
          transition={{ duration: 2, ease: 'linear', repeat: Infinity, repeatDelay: 1 }}
        />
      </div>
    </div>
  );
}

function ConnectorVertical() {
  return (
    <div className="flex justify-center py-1">
      <div className="relative w-[2px] h-8">
        <div className="absolute inset-0 border-l border-dashed border-white/10" />
        <motion.div
          className="absolute inset-0 w-[2px] bg-gradient-to-b from-teal-400/30 via-blue-400/30 to-violet-400/30 rounded-full"
          initial={{ opacity: 0, scaleY: 0 }}
          whileInView={{ opacity: 1, scaleY: 1 }}
          viewport={VIEWPORT_ONCE}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          style={{ transformOrigin: 'top' }}
        />
      </div>
    </div>
  );
}
