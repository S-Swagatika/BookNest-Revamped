import { Platform } from 'react-native';

export const colors = {
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EEE6',
  ink: '#1C1917',
  muted: '#6B645C',
  border: '#E7E0D5',
  primary: '#1F4D3F',
  primaryText: '#FFFFFF',
  accent: '#B8893B',
  accentText: '#8A6422',
  accentSoft: '#F4E9D2',
  hero: '#17251F',
  heroText: '#F6F1E7',
  heroMuted: '#B9C4BC',
  danger: '#B3261E',
  dangerSoft: '#FBE9E7',
  success: '#2E7D4F',
  successSoft: '#E3F1E8',
  warning: '#8A5A00',
  warningSoft: '#FFF1D6',
} as const;

export type ColorName = keyof typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 72,
} as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const fonts = Platform.select({
  web: {
    serif: "Georgia, 'Times New Roman', serif",
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  ios: { serif: 'Georgia', sans: 'System' },
  default: { serif: 'serif', sans: 'sans-serif' },
});

export const shadows = {
  card: '0 2px 12px rgba(28, 25, 23, 0.08)',
  lifted: '0 12px 32px rgba(28, 25, 23, 0.18)',
} as const;

export const MAX_CONTENT_WIDTH = 1200;
export const TOUCH_TARGET = 44;
