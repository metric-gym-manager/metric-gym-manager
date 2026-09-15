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
  surfacePanel: string
  surfaceInput: string
  surfaceHover: string
  surfaceActive: string
  surfaceSelected: string
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
  primaryHover: string
  accentDefault: string
  accentHover: string
  accentText: string
  accentLink: string
  accentLinkHover: string
  accentBg: string
  accentBorder: string
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

/** Dark theme — the Marketing, Auth, and Legal surfaces. */
export const darkColors: SemanticColorScale = {
  surfaceBase: '#08080a',
  surfaceCard: '#131317',
  surfacePanel: '#0d0d10',
  surfaceInput: 'rgba(255,255,255,0.05)',
  surfaceHover: 'rgba(255,255,255,0.055)',
  surfaceActive: 'rgba(255,255,255,0.08)',
  surfaceSelected: 'rgba(74,71,209,0.3)',
  surfaceOverlay: 'rgba(0,0,0,0.72)',
  border1: 'rgba(255,255,255,0.1)',
  border2: 'rgba(255,255,255,0.145)',
  border3: 'rgba(255,255,255,0.19)',
  borderHover: 'rgba(255,255,255,0.3)',
  borderStrong: 'rgba(255,255,255,0.38)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderDashed: 'rgba(255,255,255,0.16)',
  textPrimary: '#f2f2f5',
  textSecondary: '#a6a6b0',
  textMuted: '#85858f',
  textPlaceholder: '#5c5c66',
  primaryDefault: '#f2f2f5',
  primaryText: '#08080a',
  primaryHover: '#dcdce2',
  accentDefault: '#4a47d1',
  accentHover: '#5c59dd',
  accentText: '#ffffff',
  accentLink: '#9694f5',
  accentLinkHover: '#b0aef8',
  accentBg: 'rgba(74,71,209,0.16)',
  accentBorder: 'rgba(110,107,225,0.35)',
  focusBorder: '#6461e2',
  successText: '#3fb950',
  successBg: 'rgba(63,185,80,0.12)',
  successBorder: 'rgba(63,185,80,0.28)',
  warningText: '#d29922',
  warningBg: 'rgba(210,153,34,0.12)',
  warningBorder: 'rgba(210,153,34,0.28)',
  errorText: '#f85149',
  errorBg: 'rgba(248,81,73,0.12)',
  errorBorder: 'rgba(248,81,73,0.28)',
  destructiveDefault: '#da3633',
  destructiveText: '#ffffff',
}

/**
 * Light theme — RETIRED (ruling R2, 2026-08-29).
 *
 * The App Workspace is dark-first and dark-only; `globals.css` no longer
 * declares a light `--ds-*` block, and nothing read this object at runtime.
 * Kept as an alias so the exported `colors` shape stays stable for the
 * `theme?: 'light' | 'dark'` props still present on the portalled overlays —
 * those props are removed in Phase 2, and this alias goes with them.
 *
 * See docs/architecture/workspace-ui-overhaul-log.md.
 */
export const lightColors: SemanticColorScale = darkColors

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
  /**
   * Touch targets (mobile rebuild plan §5.1, §15.1). Two values and no third:
   * `touch` (44) is the primary target every non-dense control must reach on a
   * phone, `touch-sm` (40) the dense one a control marked `data-dense` may use.
   * The probe (`tests/e2e/helpers/mobile-probe.ts`) asserts these exact numbers,
   * so a change here is a change to the rule.
   *
   * Applied through `phone:` only — desktop control heights are unchanged.
   */
  touch: '44px',
  'touch-sm': '40px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Safe area (mobile rebuild plan §5.1, §16, §25.1)
// ─────────────────────────────────────────────────────────────────────────────
// The only tokens whose value is supplied by the device rather than by us: the
// notch/home-indicator insets a `viewport-fit=cover` document must keep clear.
// `env()` resolves to 0px everywhere it does not apply, so the same class is
// correct on a desktop browser and on an iPhone in landscape.
//
// Declared in `globals.css` as `--ds-safe-*` OUTSIDE the colour block (they are
// not colours and have no entry in `SemanticColorScale`) and bound to Tailwind
// spacing so `pt-safe-top` / `pb-safe-bottom` exist without an arbitrary value.

export const safeArea = {
  top: 'env(safe-area-inset-top, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
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
  focus: '0 0 0 2px rgba(100,97,226,0.45)',
  focusError: '0 0 0 2px rgba(248,81,73,0.4)',
  // Elevation is a 1px boundary, never a floating effect (directive §5.12/§6).
  overlay: '0 0 0 1px rgba(255,255,255,0.14)',
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
  /**
   * Readout — the value in an operational KPI band (directive §5.5). Mono and
   * tabular at the call site so figures align in a column; 24px is large enough
   * to scan across a band without becoming display type (§5.11: hierarchy from
   * precision and alignment, not size).
   */
  readout: { fontSize: '24px', lineHeight: '28px', fontWeight: 600 },
  /**
   * Input text on phones (mobile rebuild plan §5.1). 16px is not a taste
   * decision: mobile Safari zooms the layout viewport when a focused text
   * control renders below 16px, and the page never zooms back. Applied via
   * `phone:text-input` on Input/Select/Textarea only.
   */
  input: { fontSize: '16px', lineHeight: '24px', fontWeight: 400 },
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
  /**
   * The phone tier's upper bound (mobile rebuild plan §4): one boundary at
   * `tablet`, so `phone` is the max-width side of it. Tailwind binds this as
   * `screens.phone = { max: '767px' }`; it is `tablet - 1`, never a second
   * number to keep in step.
   */
  phoneMax: 767,
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
  /**
   * Phone chrome (mobile rebuild plan §5.1, §25.3). The bottom bar's own
   * height, before the safe-area inset; `<main>`'s bottom padding and the
   * toast offset derive from it rather than repeating 56.
   */
  bottomNavHeight: '56px',
  /**
   * Bottom-sheet ceiling (`Modal placement="sheet"`, phone `Drawer`).
   * `dvh`, not `vh`: with a mobile browser's collapsing address bar `vh` is
   * the *largest* viewport, so an 85vh sheet was taller than the screen while
   * the bar was showing and its footer sat below the fold.
   */
  sheetMaxHeight: '90dvh',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Chart palette (spec §15 Data Visualization) — max 3 colors per chart; accent
// highlights the current series, status colors for status-driven data.
// ─────────────────────────────────────────────────────────────────────────────

const darkChartPalette = {
  bar: 'rgba(255,255,255,0.14)',
  highlight: '#4a47d1',
  success: '#3fb950',
  warning: '#d29922',
  error: '#f85149',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#85858f',
} as const

/**
 * Chart palette. `light` is an alias of `dark` — the light theme is retired
 * (ruling R2). Charts read the `--ds-*` CSS vars directly (see Charts.tsx);
 * this object is the JS mirror of that contract.
 */
export const chartPalette = {
  light: darkChartPalette,
  dark: darkChartPalette,
} as const

/** The complete token set, for convenience imports. */
export const tokens = {
  primitiveColors,
  colors,
  spacing,
  safeArea,
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
