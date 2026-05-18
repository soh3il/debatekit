/**
 * Default MODES constant shared across solution landing pages.
 *
 * Screens that need domain-specific descriptions should override
 * individual entries rather than duplicating the entire array.
 */

import { Icons } from '@/components/icons';

import type { LandingMode } from './landing-types';

export const LANDING_MODES: readonly LandingMode[] = [
  {
    color: 'text-red-400',
    description: 'Models surface genuine disagreements and explain why they see things differently.',
    icon: Icons.scale,
    title: 'Debating',
  },
  {
    color: 'text-blue-400',
    description: 'Models examine from different angles, challenging each other\'s framings.',
    icon: Icons.search,
    title: 'Analyzing',
  },
  {
    color: 'text-amber-400',
    description: 'Models spark off each other\'s ideas, building and branching in real-time.',
    icon: Icons.lightbulb,
    title: 'Brainstorming',
  },
  {
    color: 'text-emerald-400',
    description: 'Models build on each other\'s proposals toward actionable recommendations.',
    icon: Icons.target,
    title: 'Problem Solving',
  },
] as const;
