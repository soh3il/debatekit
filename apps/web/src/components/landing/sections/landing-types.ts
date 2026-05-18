/**
 * Shared types for solution landing pages.
 *
 * Provides Zod-backed types for pure-data shapes (FAQ, market stats)
 * and plain TypeScript types for shapes containing React components
 * (modes, roles, personas, failures) where Zod runtime validation
 * is not possible.
 */

import type { LucideIcon } from 'lucide-react';
import { z } from 'zod';

// ============================================================================
// FAQ
// ============================================================================

export const LandingFAQItemSchema = z.object({
  answer: z.string(),
  question: z.string(),
});
export type LandingFAQItem = z.infer<typeof LandingFAQItemSchema>;

// ============================================================================
// MODES (shared across all solution screens)
// ============================================================================

export const LANDING_MODE_VALUES = ['Debating', 'Analyzing', 'Brainstorming', 'Problem Solving'] as const;
export const LandingModeValueSchema = z.enum(LANDING_MODE_VALUES);

/**
 * A deliberation mode card shown on every solution landing page.
 *
 * Note: LucideIcon cannot be validated by Zod at runtime so this is a plain
 * TypeScript type rather than a z.infer<> derivation.
 */
export type LandingMode = {
  color: string;
  description: string;
  icon: LucideIcon;
  title: z.infer<typeof LandingModeValueSchema>;
};

// ============================================================================
// ROLES (per-solution, shared shape)
// ============================================================================

export type LandingRole = {
  color: string;
  description: string;
  icon: LucideIcon;
  model: string;
  title: string;
};

// ============================================================================
// PERSONAS (per-solution, shared shape)
// ============================================================================

export type LandingPersona = {
  color: string;
  description: string;
  icon: LucideIcon;
  painPoint: string;
  title: string;
};

// ============================================================================
// SINGLE MODEL FAILURES (per-solution, shared shape)
// ============================================================================

export type LandingFailure = {
  description: string;
  icon: LucideIcon;
  number: string;
  title: string;
};

// ============================================================================
// FEATURE CARD (generic icon + title + description, used for principles,
// advantages, integrations, reasons, etc.)
// ============================================================================

export type LandingFeatureCard = {
  color: string;
  description: string;
  icon: LucideIcon;
  title: string;
};

// ============================================================================
// MARKET STATS (per-solution, shared shape)
// ============================================================================

export const MarketStatSchema = z.object({
  label: z.string(),
  source: z.string(),
  stat: z.string(),
});
export type MarketStat = z.infer<typeof MarketStatSchema>;
