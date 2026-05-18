/**
 * Font Configuration
 *
 * system-ui base (SF Pro on Mac, Segoe UI on Windows, Roboto on Android).
 * Vazirmatn loaded from Google Fonts for Farsi/Arabic via CSS RTL override.
 */

/**
 * Primary font stack - system-ui with standard fallbacks
 */
export const systemFonts = {
  className: 'font-sans',
  style: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif',
  },
  variable: '--font-sans',
};

/**
 * Font family string for use in Tailwind config or inline styles
 */
export const FONT_FAMILY_SYSTEM = 'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif';
