// Palette comes from @ennel/shared so the student and admin apps share one source (Spec §17).
const { THEME_COLORS, THEME_RADII } = require('@ennel/shared');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app has one light palette (Spec §17). 'class' keeps it light even when the phone is in
  // dark mode, and avoids NativeWind's web crash "Cannot manually set color scheme" under 'media'.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: THEME_COLORS.primary,
        'primary-foreground': THEME_COLORS.primaryForeground,
        mint: THEME_COLORS.mint,
        background: THEME_COLORS.background,
        surface: THEME_COLORS.surface,
        border: THEME_COLORS.border,
        foreground: THEME_COLORS.text,
        'muted-foreground': THEME_COLORS.textMuted,
        warning: THEME_COLORS.warning,
        'warning-surface': THEME_COLORS.warningSurface,
        danger: THEME_COLORS.danger,
        'danger-surface': THEME_COLORS.dangerSurface,
        success: THEME_COLORS.success,
        'success-surface': THEME_COLORS.successSurface,
        info: THEME_COLORS.info,
        'info-surface': THEME_COLORS.infoSurface,
      },
      borderRadius: {
        sm: THEME_RADII.sm,
        md: THEME_RADII.md,
        lg: THEME_RADII.lg,
        xl: THEME_RADII.xl,
      },
    },
  },
  plugins: [],
};
