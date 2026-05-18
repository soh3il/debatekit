/**
 * Email Design Tokens
 *
 * Comprehensive design system for email templates with email-safe properties.
 * All values are converted to pixels for maximum email client compatibility.
 */

import { getAppUrl } from '@debatekit/shared';
import { WebAppEnvs } from '@debatekit/shared/enums';

import { getWebappEnv } from '@/lib/config/base-urls';

/**
 * Get the base URL for email assets.
 * Email clients block localhost URLs, so we use production URL for local dev.
 * For preview/prod, use the appropriate environment URL.
 */
function getEmailAssetsBaseUrl(): string {
  const env = getWebappEnv();
  // Local dev: use production URL (localhost blocked by email clients)
  return getAppUrl(env === WebAppEnvs.LOCAL ? WebAppEnvs.PROD : env);
}

export const EMAIL_ASSETS_BASE_URL = getEmailAssetsBaseUrl();

// Brand Colors - Aligned with global.css design system light mode (OKLCH converted to hex)
export const colors = {
  // Accent matching global.css
  accent: '#F4F4F5', // oklch(0.967 0.001 286.375)
  accentForeground: '#18181B', // oklch(0.21 0.006 285.885)
  // Core Colors from global.css light mode (OKLCH to hex)
  background: '#FFFFFF', // oklch(1 0 0)

  backgroundPrimary: '#FFFFFF', // Card color
  backgroundSecondary: '#FFFFFF', // Background color
  // Border matching global.css
  border: '#E4E4E7', // oklch(0.92 0.004 286.32)
  card: '#FFFFFF', // oklch(1 0 0)

  cardForeground: '#09090B', // oklch(0.141 0.005 285.823)
  // Semantic Colors (minimal, email-safe)
  destructive: '#E40015', // oklch(0.577 0.245 27.325)
  destructiveForeground: '#FFFFFF',
  foreground: '#09090B', // oklch(0.141 0.005 285.823)

  input: '#E4E4E7', // oklch(0.92 0.004 286.32)
  muted: '#F4F4F5', // oklch(0.967 0.001 286.375)

  mutedForeground: '#71717B', // oklch(0.552 0.016 285.938)
  // Primary Brand Color - matching global.css primary oklch(0.45 0.18 260)
  primary: '#044CB6', // Deep blue from OKLCH theme
  primaryForeground: '#FFFFFF', // White for button text contrast

  primaryHover: '#003F9F', // oklch(0.40 0.18 260) - darker for hover
  ring: '#044CB6', // oklch(0.45 0.18 260)

  // Secondary & Muted - OKLCH to hex
  secondary: '#F4F4F5', // oklch(0.967 0.001 286.375)
  secondaryForeground: '#18181B', // oklch(0.21 0.006 285.885)
  textInverse: '#FFFFFF', // White text
  textMuted: '#A1A1AA', // zinc-400

  // Text hierarchy aligned with global system
  textPrimary: '#09090B', // Main text - foreground color
  textSecondary: '#71717B', // Secondary text - muted foreground
  // Simplified backgrounds
  white: '#FFFFFF',
};

// Typography - System fonts for email-safe rendering
export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',

  fontSize: {
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
    'base': '16px',
    'lg': '18px',
    'sm': '14px',
    'xl': '20px',
    'xs': '12px',
  },

  fontWeight: {
    bold: '700',
    medium: '500',
    normal: '400',
    semibold: '600',
  },

  letterSpacing: {
    normal: '0em',
    tight: '-0.025em',
    wide: '0.025em',
  },

  lineHeight: {
    loose: '32px',
    normal: '24px',
    relaxed: '28px',
    tight: '20px',
  },
};

// Spacing - Pixel-based for email compatibility
export const spacing = {
  0: '0px',
  1: '4px',
  10: '40px',
  12: '48px',
  16: '64px',
  2: '8px',
  20: '80px',
  24: '96px',
  3: '12px',
  32: '128px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
};

// Container sizes
export const containers = {
  content: '465px', // Content container (Vercel-style)
  email: '600px', // Standard email width
  mobile: '320px', // Mobile fallback
};

// Border radius - Matching global.css system (--radius: 0.5rem = 8px)
export const borderRadius = {
  base: '6px', // --radius - 2px
  full: '9999px',
  lg: '12px', // --radius + 4px
  md: '8px', // --radius (0.5rem = 8px)
  none: '0px',
  sm: '4px', // --radius - 4px
  xl: '16px', // larger variant
};

// Shadows - Email-safe
export const shadows = {
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
};

// Component variants - Aligned with global.css design system
export const components = {
  button: {
    ghost: {
      ':hover': {
        backgroundColor: colors.secondary,
      },
      'backgroundColor': 'transparent',
      'borderColor': 'transparent',
      'borderRadius': borderRadius.md,
      'color': colors.foreground,
    },
    outline: {
      ':hover': {
        backgroundColor: colors.secondary,
      },
      'backgroundColor': 'transparent',
      'borderColor': colors.border,
      'borderRadius': borderRadius.md,
      'color': colors.foreground,
    },
    primary: {
      ':hover': {
        backgroundColor: colors.primaryHover,
      },
      'backgroundColor': colors.primary,
      'borderColor': colors.primary,
      'borderRadius': borderRadius.md,
      'color': colors.primaryForeground,
    },
    secondary: {
      ':hover': {
        backgroundColor: colors.muted, // Use muted color for hover
      },
      'backgroundColor': colors.secondary,
      'borderColor': colors.border,
      'borderRadius': borderRadius.md,
      'color': colors.secondaryForeground,
    },
  },

  text: {
    body: {
      color: colors.foreground,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.normal,
      lineHeight: typography.lineHeight.normal,
    },
    caption: {
      color: colors.textMuted,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.normal,
      lineHeight: '16px',
    },
    heading1: {
      color: colors.foreground,
      fontSize: typography.fontSize['3xl'],
      fontWeight: typography.fontWeight.bold,
      lineHeight: '36px',
    },
    heading2: {
      color: colors.foreground,
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.bold,
      lineHeight: '30px',
    },
    heading3: {
      color: colors.foreground,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      lineHeight: '26px',
    },
    heading4: {
      color: colors.foreground,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      lineHeight: typography.lineHeight.normal,
    },
    small: {
      color: colors.mutedForeground,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.normal,
      lineHeight: '16px',
    },
  },
};

// Layout presets - Using updated color system
export const layouts = {
  container: {
    backgroundColor: colors.backgroundPrimary,
    borderRadius: borderRadius.md,
    margin: '40px auto',
    maxWidth: containers.content,
    padding: spacing[5],
  },

  footer: {
    borderTop: `1px solid ${colors.border}`,
    color: colors.textSecondary,
    margin: `${spacing[6]} 0`,
    padding: `${spacing[4]} 0`,
    textAlign: 'center' as const,
  },

  header: {
    margin: `${spacing[8]} 0`,
    textAlign: 'center' as const,
  },

  section: {
    margin: `${spacing[8]} 0`,
  },
};

// Asset URLs - Always use production URL for email client compatibility
// Logo is at /public/static/logo.png in web app, served at /static/logo.png
export const assets = {
  // Use logo as fallback for missing avatar/placeholder assets
  fallbackAvatar: `${EMAIL_ASSETS_BASE_URL}/static/logo.png`,
  logo: `${EMAIL_ASSETS_BASE_URL}/static/logo.png`,
  logoBlack: `${EMAIL_ASSETS_BASE_URL}/static/logo.png`,
  logoRound: `${EMAIL_ASSETS_BASE_URL}/static/logo.png`,
  logoRoundBlack: `${EMAIL_ASSETS_BASE_URL}/static/logo.png`,
  logoRoundWhite: `${EMAIL_ASSETS_BASE_URL}/static/logo.png`,
  placeholder: `${EMAIL_ASSETS_BASE_URL}/static/logo.png`,
};
