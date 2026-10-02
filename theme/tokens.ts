import { useColorScheme } from 'react-native'

/**
 * Central design tokens — the single source of truth for the 3awedlou
 * visual identity. Light and dark are designed as independent palettes
 * (dark is not a naive inversion). Green stays the single brand color.
 */

export interface AppTheme {
  dark: boolean
  /* Brand green ramp */
  green50: string
  green100: string
  green200: string
  green300: string
  green400: string
  green500: string
  green600: string
  green700: string
  green800: string
  green900: string

  /* Surfaces */
  bg: string
  surface: string
  surface2: string
  surface3: string
  surfaceInset: string

  /* Content */
  text: string
  text2: string
  text3: string
  border: string
  borderStrong: string

  /* Status (per-theme tuned) */
  success: string
  successBg: string
  warning: string
  warningBg: string
  danger: string
  dangerBg: string
  info: string
  infoBg: string

  /* Metrics */
  chartBar: string
  chartBarAlt: string
  spark: string

  /* Semantic shortcuts */
  accent: string
  accentStrong: string
  accentContrast: string
  accentSoft: string
  accentBorder: string
}

const light: AppTheme = {
  dark: false,

  green50: '#ecfdf3',
  green100: '#d1fae0',
  green200: '#a7f3c9',
  green300: '#6ee7a8',
  green400: '#34d37f',
  green500: '#16a34a',
  green600: '#12813c',
  green700: '#0f6a33',
  green800: '#14532d',
  green900: '#0a3d20',

  bg: '#f3f5f3',
  surface: '#ffffff',
  surface2: '#f6f8f6',
  surface3: '#eef1ee',
  surfaceInset: '#f2f4f1',

  text: '#131a15',
  text2: '#5a655d',
  text3: '#8b958d',
  border: '#e2e7e2',
  borderStrong: '#cfd6cf',

  success: '#15803d',
  successBg: '#e5f7eb',
  warning: '#b45309',
  warningBg: '#fdf1e0',
  danger: '#b91c1c',
  dangerBg: '#fdeceb',
  info: '#1d4ed8',
  infoBg: '#e8eefc',

  chartBar: '#16a34a',
  chartBarAlt: '#0ea5e9',
  spark: '#16a34a',

  accent: '#16a34a',
  accentStrong: '#12813c',
  accentContrast: '#ffffff',
  accentSoft: '#ecfdf3',
  accentBorder: '#bfe8cd',
}

const dark: AppTheme = {
  dark: true,

  green50: '#12251b',
  green100: '#143526',
  green200: '#1a4a34',
  green300: '#226444',
  green400: '#34d37f',
  green500: '#4ade80',
  green600: '#34d37f',
  green700: '#22c55e',
  green800: '#16a34a',
  green900: '#14532d',

  bg: '#0b100e',
  surface: '#151b18',
  surface2: '#1b221f',
  surface3: '#232b27',
  surfaceInset: '#10150f',

  text: '#ecf2ee',
  text2: '#9aa89f',
  text3: '#6b7a70',
  border: '#262e29',
  borderStrong: '#39433d',

  success: '#4ade80',
  successBg: 'rgba(74, 222, 128, 0.12)',
  warning: '#fbbf24',
  warningBg: 'rgba(251, 191, 36, 0.12)',
  danger: '#f87171',
  dangerBg: 'rgba(248, 113, 113, 0.13)',
  info: '#93c5fd',
  infoBg: 'rgba(147, 197, 253, 0.13)',

  chartBar: '#34d37f',
  chartBarAlt: '#38bdf8',
  spark: '#34d37f',

  accent: '#34d37f',
  accentStrong: '#6ee7a8',
  accentContrast: '#052012',
  accentSoft: 'rgba(52, 211, 127, 0.13)',
  accentBorder: 'rgba(52, 211, 127, 0.35)',
}

export const themes: Record<'light' | 'dark', AppTheme> = { light, dark }

/* Spacing scale (4px base) */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

/* Radius scale */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const

/* Typography scale — system font stack, tabular numerals via fontVariant */
export const type = {
  hero: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 17, fontWeight: '800' as const },
  head: { fontSize: 14, fontWeight: '700' as const },
  body: { fontSize: 13.5, fontWeight: '600' as const },
  sub: { fontSize: 12, fontWeight: '500' as const },
  micro: { fontSize: 10.5, fontWeight: '700' as const },
  num: { fontSize: 18, fontWeight: '800' as const, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
}

export function useThemeMode(): 'light' | 'dark' {
  const scheme = useColorScheme()
  return scheme === 'dark' ? 'dark' : 'light'
}
