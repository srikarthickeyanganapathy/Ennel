/**
 * Design tokens shared by the student app and admin app (Spec §17).
 * Both Tailwind configs read these so the palette has one source.
 */
export const THEME_COLORS = {
  primary: '#0B5D46', // Deep Green
  primaryForeground: '#FFFFFF',
  mint: '#E7F4EC', // Soft Mint
  background: '#FFFFFF',
  surface: '#F6F7F8',
  border: '#E2E5E8',
  text: '#14201B',
  textMuted: '#5B6B64',
  warning: '#B7791F',
  warningSurface: '#FEF6E0',
  danger: '#C53030',
  dangerSurface: '#FDECEC',
  success: '#0B5D46',
  successSurface: '#E7F4EC',
  info: '#2B6CB0',
  infoSurface: '#EBF4FF',
  /** Segmented controls and quiet fills (Figma `color/neutral-soft`). */
  neutralSurface: '#EEF2F0',
} as const;

export const THEME_RADII = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '24px',
} as const;

export const THEME_FONT_FAMILY = 'Inter';
