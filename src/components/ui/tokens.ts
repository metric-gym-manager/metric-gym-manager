/**
 * Metric Design System — Design Tokens (Layer 1)
 * ------------------------------------------------
 * The single JavaScript source of truth for every design value in the system,
 * mirroring the Metric Design System Specification §2 (Design Tokens &
 * Foundations). CSS-reachable values are also exposed as CSS custom properties
 * in `globals.css` and mapped into Tailwind via `tailwind.config.ts`; this file
 * exists for the values JS/TS needs directly (chart palettes, motion durations,
 * programmatic theming).
 *
 * RULE: This module — together with `globals.css` and `tailwind.config.ts` — is
 * the ONLY place raw hex/px values may appear. Every component references tokens,
 * never literals. If a value you need is missing, add it here first.
 *
 * @see docs/architecture/feature-first-growth-rules.md (shared UI lives in components/)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitive colors (raw values — never referenced directly by components)
// ─────────────────────────────────────────────────────────────────────────────

export const primitiveColors = {
  neutral: {
    50: '#f4f4f5',
    100: '#e4e4e7',
    200: '#d4d4d8',
    300: '#c4c4c8',
    400: '#a1a1aa',
    500: '#8a8a92',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  dark: {
    50: '#ededf0',
    100: '#d4d4d8',
    200: '#9b9ba4',
    300: '#8b8b93',
    400: '#8a8a92',
    500: '#64646d',
    600: '#5c5c64',
    700: '#3a3a41',
    800: '#141416',
    900: '#111113',
    950: '#101012',
    1000: '#0c0c0d',
    base: '#0a0a0b',
    black: '#000000',
  },
  blue: {
    500: '#4340ff',
    600: '#3230ff',
    700: '#1b17ff',
    tint: '#8a88ff',
    tintLight: '#a5a3ff',
    bg: 'rgba(27,23,255,0.12)',
    ring: 'rgba(27,23,255,0.25)',
    border: 'rgba(138,136,255,0.3)',
  },
  green: {
    500: '#3fb950',
    700: '#1a7f37',
    bg: 'rgba(63,185,80,0.1)',
    border: 'rgba(63,185,80,0.25)',
  },
  yellow: {
    500: '#d29922',
    700: '#9a6700',
    bg: 'rgba(210,153,34,0.1)',
    border: 'rgba(210,153,34,0.25)',
  },
  red: {
    400: '#f85149',
    700: '#cf222e',
    bg: 'rgba(248,81,73,0.1)',
    border: 'rgba(248,81,73,0.25)',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Semantic colors — resolved per theme. Components reference these names via
// Tailwind classes bound to CSS variables; this object is the JS mirror.
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticColorScale {
  surfaceBase: string
  surfaceCard: string
  surfaceInput: string
  surfaceHover: string
  surfaceActive: string
  surfaceOverlay: string
  border1: string
  border2: string
  border3: string
  borderHover: string
  borderStrong: string
  borderSubtle: string
  borderDashed: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textPlaceholder: string
  primaryDefault: string
  primaryText: string
  accentDefault: string
  accentHover: string
  accentText: string
  accentLink: string
  accentLinkHover: string
  focusBorder: string
  successText: string
  successBg: string
  successBorder: string
  warningText: string
  warningBg: string
  warningBorder: string
  errorText: string
  errorBg: string
  errorBorder: string
  destructiveDefault: string
  destructiveText: string
}

/** Light theme — the App Workspace surface. */
export const lightColors: SemanticColorScale = {
  surfaceBase: '#f4f4f5',
  surfaceCard: '#ffffff',
  surfaceInput: '#f4f4f5',
  surfaceHover: 'rgba(0,0,0,0.04)',
  surfaceActive: 'rgba(0,0,0,0.045)',
  surfaceOverlay: 'rgba(0,0,0,0.45)',
  border1: 'rgba(0,0,0,0.09)',
  border2: 'rgba(0,0,0,0.13)',
  border3: 'rgba(0,0,0,0.16)',
  borderHover: 'rgba(0,0,0,0.28)',
  borderStrong: 'rgba(0,0,0,0.35)',
  borderSubtle: 'rgba(0,0,0,0.05)',
  borderDashed: 'rgba(0,0,0,0.16)',
  textPrimary: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#8a8a92',
  textPlaceholder: '#c4c4c8',
  primaryDefault: '#18181b',
  primaryText: '#f4f4f5',
  accentDefault: '#1b17ff',
  accentHover: '#3230ff',
  accentText: '#ffffff',
  accentLink: '#4340ff',
  accentLinkHover: '#1b17ff',
  focusBorder: '#1b17ff',
  successText: '#1a7f37',
  successBg: 'rgba(63,185,80,0.1)',
  successBorder: 'rgba(63,185,80,0.25)',
  warningText: '#9a6700',
  warningBg: 'rgba(210,153,34,0.1)',
  warningBorder: 'rgba(210,153,34,0.25)',
  errorText: '#cf222e',
  errorBg: 'rgba(248,81,73,0.1)',
  errorBorder: 'rgba(248,81,73,0.25)',
  destructiveDefault: '#cf222e',
  destructiveText: '#ffffff',
}

/** Dark theme — the Marketing, Auth, and Legal surfaces. */
export const darkColors: SemanticColorScale = {
  surfaceBase: '#0a0a0b',
  surfaceCard: '#131316',
  surfaceInput: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.06)',
  surfaceActive: 'rgba(255,255,255,0.07)',
  surfaceOverlay: 'rgba(0,0,0,0.7)',
  border1: 'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.12)',
  border3: 'rgba(255,255,255,0.15)',
  borderHover: 'rgba(255,255,255,0.25)',
  borderStrong: 'rgba(255,255,255,0.3)',
  borderSubtle: 'rgba(255,255,255,0.05)',
  borderDashed: 'rgba(255,255,255,0.12)',
  textPrimary: '#ededf0',
  textSecondary: '#9b9ba4',
  textMuted: '#64646d',
  textPlaceholder: '#5c5c64',
  primaryDefault: '#ededf0',
  primaryText: '#0a0a0b',
  accentDefault: '#1b17ff',
  accentHover: '#3230ff',
  accentText: '#ffffff',
  accentLink: '#8a88ff',
  accentLinkHover: '#a5a3ff',
  focusBorder: '#1b17ff',
  successText: '#3fb950',
  successBg: 'rgba(63,185,80,0.1)',
  successBorder: 'rgba(63,185,80,0.25)',
  warningText: '#d29922',
  warningBg: 'rgba(210,153,34,0.1)',
  warningBorder: 'rgba(210,153,34,0.25)',
  errorText: '#f85149',
  errorBg: 'rgba(248,81,73,0.1)',
  errorBorder: 'rgba(248,81,73,0.25)',
  destructiveDefault: '#cf222e',
  destructiveText: '#ffffff',
}

export const colors = { light: lightColors, dark: darkColors } as const
export type ThemeName = keyof typeof colors
export type SemanticColorToken = keyof SemanticColorScale

/** The list of semantic color token names (light and dark share this contract). */
export function getSemanticKeys(): SemanticColorToken[] {
  return Object.keys(lightColors) as SemanticColorToken[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Spacing — 8-point grid with 4px sub-grid (spec §2 Spacing System)
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Radius (spec §2 Radius Tokens)
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  md: '5px',
  lg: '6px',
  xl: '8px',
  '2xl': '10px',
  '3xl': '12px',
  full: '9999px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Shadows (spec §2 Shadow Tokens) — elevation is background + hairline, not
// decorative drop shadows. Only focus rings and overlays use shadow.
// ─────────────────────────────────────────────────────────────────────────────

export const shadow = {
  none: 'none',
  focus: '0 0 0 3px rgba(27,23,255,0.25)',
  focusError: '0 0 0 3px rgba(248,81,73,0.25)',
  overlay: '0 16px 48px rgba(0,0,0,0.5)',
  marketingOverlay: '0 8px 30px rgba(0,0,0,0.5)',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Z-index scale (spec §2 Z-Index Scale)
// ─────────────────────────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  sticky: 50,
  drawerBackdrop: 60,
  drawer: 61,
  modalBackdrop: 70,
  modal: 71,
  modalNestedBackdrop: 72,
  modalNested: 73,
  paletteBackdrop: 80,
  palette: 81,
  toast: 90,
  demoModal: 100,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Motion (spec §2 Motion Tokens, §7 Motion System)
// ─────────────────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    verySlow: '600ms',
    drawer: '180ms',
    modal: '140ms',
  },
  easing: {
    default: 'ease',
    in: 'ease-in',
    out: 'ease-out',
    inOut: 'ease-in-out',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Blur & opacity (spec §2)
// ─────────────────────────────────────────────────────────────────────────────

export const blur = {
  nav: 'blur(16px)',
  modal: 'blur(6px)',
  marketingModal: 'blur(8px)',
} as const

export const opacity = {
  disabled: 0.5,
  hoverLight: 0.04,
  hoverDark: 0.06,
  pressed: 0.08,
  backdropLight: 0.45,
  backdropDark: 0.7,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Typography (spec §2 Typography Tokens, §5 Typography)
// ─────────────────────────────────────────────────────────────────────────────

export const fontFamily = {
  sans: "'Geist', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace",
} as const

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

export interface TypeToken {
  fontSize: string
  lineHeight: string
  fontWeight: number
  letterSpacing?: string
  textTransform?: 'uppercase'
}

export const typeScale = {
  displayXl: {
    fontSize: 'clamp(48px,7.5vw,92px)',
    lineHeight: '0.98',
    fontWeight: 600,
    letterSpacing: '-0.04em',
  },
  display: {
    fontSize: 'clamp(34px,4.4vw,52px)',
    lineHeight: '1.04',
    fontWeight: 600,
    letterSpacing: '-0.028em',
  },
  displaySm: {
    fontSize: 'clamp(22px,3vw,32px)',
    lineHeight: '1.3',
    fontWeight: 500,
    letterSpacing: '-0.02em',
  },
  h1: {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  h3: { fontSize: '14px', lineHeight: '20px', fontWeight: 600 },
  bodyLg: { fontSize: '15px', lineHeight: '24px', fontWeight: 400 },
  body: { fontSize: '13px', lineHeight: '20px', fontWeight: 400 },
  bodyEmphasis: { fontSize: '13px', lineHeight: '20px', fontWeight: 500 },
  bodySm: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
  caption: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
  metadata: {
    fontSize: '11px',
    lineHeight: '16px',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  label: {
    fontSize: '11px',
    lineHeight: '16px',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  button: { fontSize: '13px', lineHeight: '20px', fontWeight: 500 },
  buttonSm: { fontSize: '12px', lineHeight: '16px', fontWeight: 500 },
  mono: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
  monoSm: { fontSize: '11px', lineHeight: '16px', fontWeight: 400 },
  monoXs: { fontSize: '10px', lineHeight: '14px', fontWeight: 400 },
  code: { fontSize: '11px', lineHeight: '19px', fontWeight: 400 },
} as const satisfies Record<string, TypeToken>

// ─────────────────────────────────────────────────────────────────────────────
// Icon sizing (spec §6 Iconography)
// ─────────────────────────────────────────────────────────────────────────────

export const iconSize = {
  xs: 12,
  sm: 13,
  md: 14,
  default: 15,
  lg: 20,
  xl: 26,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Breakpoints (spec §4 Breakpoints)
// ─────────────────────────────────────────────────────────────────────────────

export const breakpoints = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Layout dimensions (spec §3 Layout System)
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  sidebarWidth: '240px',
  sidebarCollapsedWidth: '56px',
  workspaceSelectorHeight: '52px',
  breadcrumbHeight: '52px',
  workspacePadding: '24px',
  maxContentWidthApp: '1200px',
  maxContentWidthMarketing: '1120px',
  drawerWidth: '420px',
  settingsSubNavWidth: '160px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Chart palette (spec §15 Data Visualization) — max 3 colors per chart; accent
// highlights the current series, status colors for status-driven data.
// ─────────────────────────────────────────────────────────────────────────────

export const chartPalette = {
  light: {
    bar: 'rgba(0,0,0,0.16)',
    highlight: '#1b17ff',
    success: '#3fb950',
    warning: '#d29922',
    error: '#f85149',
    grid: 'rgba(0,0,0,0.05)',
    axis: '#8a8a92',
  },
  dark: {
    bar: 'rgba(255,255,255,0.12)',
    highlight: '#1b17ff',
    success: '#3fb950',
    warning: '#d29922',
    error: '#f85149',
    grid: 'rgba(255,255,255,0.05)',
    axis: '#64646d',
  },
} as const

/** The complete token set, for convenience imports. */
export const tokens = {
  primitiveColors,
  colors,
  spacing,
  radius,
  shadow,
  zIndex,
  motion,
  blur,
  opacity,
  fontFamily,
  fontWeight,
  typeScale,
  iconSize,
  breakpoints,
  layout,
  chartPalette,
} as const

export default tokens
