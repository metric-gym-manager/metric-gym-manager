import type { Config } from 'tailwindcss'

/**
 * Tailwind theme is the Layer-1 token surface for utility classes. Design-system
 * colors bind to the `--ds-*` CSS variables defined in `src/app/globals.css`,
 * whose values flip with the nearest `[data-theme]` scope (or the legacy
 * `.mws-root` / `.mauth-root` scopes) — so a primitive using `bg-surface-card`
 * renders light or dark automatically with no `dark:` variants.
 *
 * The JS mirror of these tokens lives in `src/components/ui/tokens.ts`.
 * Legacy shadcn keys (background/foreground/card/primary/…) are kept unchanged
 * so existing (deprecated) components keep working during migration.
 */
const config: Config = {
  // `dark:` variants activate under a `[data-theme="dark"]` scope. Most
  // design-system components don't need `dark:` — the `--ds-*` variables already
  // carry the per-theme values — but the variant is available when required.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      spacing: {
        // Control heights from spec §11 that fall off the 8pt grid (4px sub-grid)
        '6.5': '26px', // Button XS / compact table action height
        '7.5': '30px', // Button SM / settings sub-nav height

        // ── Mobile rebuild (plan §5.1) ──────────────────────────────────
        // Touch targets (§15.1). Two thresholds, no third: `touch` is the
        // primary one, `touch-sm` the dense one a control marked `data-dense`
        // may use. Reached through `phone:` only.
        touch: '44px',
        'touch-sm': '40px',

        // The bottom bar's own height (§25.3). In `spacing` rather than
        // `height` on purpose: `<main>`'s bottom padding and the toast offset
        // are derived from the bar, so `h-bottom-nav` and `pb-bottom-nav` must
        // both exist and must be the same number.
        'bottom-nav': '56px',

        // Bottom-sheet ceiling. In `spacing` so `h-sheet` and `max-h-sheet`
        // come from ONE entry: the `full` sheet sets the height and every
        // sheet caps its max height, and those two must not be able to drift.
        // `dvh` because a mobile browser's `vh` is the viewport with the
        // address bar hidden — the old 85vh sheet was taller than the visible
        // screen while the bar was showing.
        sheet: '90dvh',

        // Safe-area insets (§16). `env()` is 0px where it does not apply, so
        // `pb-safe-bottom` is a no-op on a desktop browser. Declared in
        // globals.css; bound here so no component needs an arbitrary value.
        'safe-top': 'var(--ds-safe-top)',
        'safe-bottom': 'var(--ds-safe-bottom)',
        'safe-left': 'var(--ds-safe-left)',
        'safe-right': 'var(--ds-safe-right)',
      },
      colors: {
        // ── Legacy shadcn tokens (unchanged) ──────────────────────────────
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        // `input` is deliberately ABSENT from this legacy group. `fontSize`
        // and `textColor` both emit `.text-<key>`, so a colour named `input`
        // beside the `fontSize.input` token below produced ONE `.text-input`
        // rule carrying `font-size: 16px; line-height: 24px; color: hsl(var(--input))`
        // — every phone text control would have been painted the legacy
        // shadcn `--input` grey (214.3 31.8% 91.4%) as a side effect of its
        // font size. Found by building the CSS, not by reading the config.
        // Nothing in `src/` referenced `bg-input`/`border-input`/`text-input`,
        // so the binding is removed rather than the type token renamed.
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        brand: {
          accent: 'var(--ds-accent)',
          'accent-hover': 'var(--ds-accent-hover)',
          'accent-text': 'var(--ds-accent-text)',
          link: 'var(--ds-accent-link)',
          'link-hover': 'var(--ds-accent-link-hover)',
          navy: '#1a1f3c',
          charcoal: '#1a202c',
          gray: '#f8f9fa',
        },

        // ── Metric Design System — semantic tokens (theme-aware) ───────────
        surface: {
          base: 'var(--ds-surface-base)',
          card: 'var(--ds-surface-card)',
          panel: 'var(--ds-surface-panel)',
          input: 'var(--ds-surface-input)',
          hover: 'var(--ds-surface-hover)',
          active: 'var(--ds-surface-active)',
          selected: 'var(--ds-surface-selected)',
          overlay: 'var(--ds-surface-overlay)',
        },
        line: {
          DEFAULT: 'var(--ds-border-1)',
          '1': 'var(--ds-border-1)',
          '2': 'var(--ds-border-2)',
          '3': 'var(--ds-border-3)',
          hover: 'var(--ds-border-hover)',
          strong: 'var(--ds-border-strong)',
          subtle: 'var(--ds-border-subtle)',
          dashed: 'var(--ds-border-dashed)',
        },
        ink: {
          DEFAULT: 'var(--ds-text-primary)',
          primary: 'var(--ds-text-primary)',
          secondary: 'var(--ds-text-secondary)',
          muted: 'var(--ds-text-muted)',
          placeholder: 'var(--ds-text-placeholder)',
        },
        // Solid neutral (primary) button surface
        solid: {
          DEFAULT: 'var(--ds-primary)',
          text: 'var(--ds-primary-text)',
          hover: 'var(--ds-primary-hover)',
        },
        // Accent (single interactive color)
        accentui: {
          DEFAULT: 'var(--ds-accent)',
          hover: 'var(--ds-accent-hover)',
          text: 'var(--ds-accent-text)',
          link: 'var(--ds-accent-link)',
          bg: 'var(--ds-accent-bg)',
          border: 'var(--ds-accent-border)',
        },
        focusring: 'var(--ds-focus-border)',
        // Status colors (tint recipe applied via bg/border variants)
        success: {
          DEFAULT: 'var(--ds-success-text)',
          text: 'var(--ds-success-text)',
          bg: 'var(--ds-success-bg)',
          border: 'var(--ds-success-border)',
        },
        warning: {
          DEFAULT: 'var(--ds-warning-text)',
          text: 'var(--ds-warning-text)',
          bg: 'var(--ds-warning-bg)',
          border: 'var(--ds-warning-border)',
        },
        error: {
          DEFAULT: 'var(--ds-error-text)',
          text: 'var(--ds-error-text)',
          bg: 'var(--ds-error-bg)',
          border: 'var(--ds-error-border)',
        },
        danger: {
          DEFAULT: 'var(--ds-destructive)',
          text: 'var(--ds-destructive-text)',
        },
      },
      borderRadius: {
        // Spec §2 Radius Tokens — unified scale (px). Overrides the previous
        // --radius-based lg/md/sm so the whole app shares one radius system.
        none: '0px',
        xs: '2px',
        sm: '4px',
        DEFAULT: '5px',
        md: '5px',
        lg: '6px',
        xl: '8px',
        '2xl': '10px',
        '3xl': '12px',
        full: '9999px',
      },
      fontFamily: {
        // Legacy default kept for marketing/body; Geist powers the design system.
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        geist: [
          'var(--font-geist)',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // ─────────────────────────────────────────────────────────────────
        // Tailwind's DEFAULT scale, re-pointed onto Metric sizes.
        //
        // The Metric scale below was ADDED to Tailwind's defaults rather than
        // replacing them, so `text-sm` (14px) and `text-base` (16px) stayed
        // valid and won 10:1 over the design tokens — 412 uses against 50.
        // Both are off-scale, and both render LARGER than the 13px body the
        // workspace sets, so secondary text outweighed primary text.
        // Directive §4.5 forbids hardcoded typography; §5.8 requires hierarchy
        // from precision rather than size. Re-pointing fixes every existing
        // call site without touching a component.
        //
        // Size + line-height only: no weight, no tracking. This is a SIZE
        // correction. Anything wanting full heading treatment should use the
        // semantic token (`text-h1`/`text-h2`/`text-h3`) declared below.
        //
        // `2xl` and larger are deliberately NOT re-pointed — they carry both
        // page titles and KPI values, which need the readout decision in
        // Phase 2 (see OPEN-4 in workspace-ui-overhaul-log.md).
        xs: ['12px', { lineHeight: '16px' }], // was 12/16 — already on-scale
        sm: ['13px', { lineHeight: '20px' }], // was 14/20 → body
        base: ['14px', { lineHeight: '20px' }], // was 16/24 → h3 size
        lg: ['16px', { lineHeight: '24px' }], // was 18/28 → h2 size
        xl: ['20px', { lineHeight: '28px' }], // was 20/28 — already on-scale

        // Spec §5 Typography Scale — [size, { lineHeight, letterSpacing, fontWeight }]
        'display-xl': [
          'clamp(48px,7.5vw,92px)',
          { lineHeight: '0.98', letterSpacing: '-0.04em', fontWeight: '600' },
        ],
        display: [
          'clamp(34px,4.4vw,52px)',
          { lineHeight: '1.04', letterSpacing: '-0.028em', fontWeight: '600' },
        ],
        'display-sm': [
          'clamp(22px,3vw,32px)',
          { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '500' },
        ],
        h1: [
          '20px',
          { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '600' },
        ],
        h2: [
          '16px',
          { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' },
        ],
        h3: ['14px', { lineHeight: '20px', fontWeight: '600' }],
        // Operational KPI value (directive §5.5). See tokens.ts `readout`.
        readout: ['24px', { lineHeight: '28px', fontWeight: '600' }],
        // Mobile rebuild §5.1: 16px stops mobile Safari zooming the layout
        // viewport on focus. `phone:text-input` on text controls only.
        input: ['16px', { lineHeight: '24px' }],
        'body-lg': ['15px', { lineHeight: '24px' }],
        body: ['13px', { lineHeight: '20px' }],
        'body-sm': ['12px', { lineHeight: '16px' }],
        caption: ['12px', { lineHeight: '16px' }],
        metadata: [
          '11px',
          { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '500' },
        ],
        button: ['13px', { lineHeight: '20px', fontWeight: '500' }],
        'button-sm': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'button-lg': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'mono-md': ['12px', { lineHeight: '16px' }],
        'mono-sm': ['11px', { lineHeight: '16px' }],
        'mono-xs': ['10px', { lineHeight: '14px' }],
        code: ['11px', { lineHeight: '19px' }],
      },
      boxShadow: {
        // Spec §2 Shadow Tokens — no decorative shadows; only focus + overlay.
        focus: 'var(--ds-focus-ring)',
        'focus-error': 'var(--ds-focus-ring-error)',
        overlay: 'var(--ds-shadow-overlay)',
        'marketing-overlay': '0 8px 30px rgba(0,0,0,0.5)',
      },
      zIndex: {
        // Spec §2 Z-Index Scale
        base: '0',
        sticky: '50',
        'drawer-backdrop': '60',
        drawer: '61',
        'modal-backdrop': '70',
        modal: '71',
        'modal-nested-backdrop': '72',
        'modal-nested': '73',
        'palette-backdrop': '80',
        palette: '81',
        toast: '90',
        'demo-modal': '100',
      },
      transitionDuration: {
        // Spec §2 Motion Tokens
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
        'very-slow': '600ms',
        drawer: '180ms',
        modal: '140ms',
      },
      backdropBlur: {
        // Spec §2 Blur Tokens
        modal: '6px',
        nav: '16px',
        'marketing-modal': '8px',
      },
      height: {
        // Chrome bar height — the sidebar's workspace selector and the
        // breadcrumb header share one rhythm. Mirrors `layout.breadcrumbHeight`
        // / `layout.workspaceSelectorHeight` in tokens.ts, which nothing could
        // previously consume from a class.
        bar: '52px',
      },
      maxWidth: {
        app: '1200px',
        marketing: '1120px',
      },
      screens: {
        // Spec §4 Breakpoints (min-width variants)
        mobile: '480px',
        tablet: '768px',
        laptop: '1024px',
        desktop: '1440px',
        // Mobile rebuild §4 — the one composition boundary, as the max-width
        // side of `tablet`. `phone:` is how a primitive reaches the phone tier;
        // `sm:`/`md:`/`lg:` stay legal for fluid refinement inside a
        // composition but may never switch compositions.
        phone: { max: '767px' },
      },
      animation: {
        'scroll-left': 'scroll-left 40s linear infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        // Design-system overlay motion (spec §7)
        'drawer-in': 'drawer-in 180ms ease',
        'pal-in': 'pal-in 140ms ease',
        'fade-in': 'fade-in 140ms ease',
        'accordion-down': 'accordion-down 200ms ease',
        'accordion-up': 'accordion-up 200ms ease',
      },
      keyframes: {
        'scroll-left': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(27, 23, 255, 0.4)' },
          '100%': { boxShadow: '0 0 0 20px rgba(27, 23, 255, 0)' },
        },
        // Spec §7 Keyframe definitions
        'drawer-in': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'pal-in': {
          from: { transform: 'translateY(-8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
