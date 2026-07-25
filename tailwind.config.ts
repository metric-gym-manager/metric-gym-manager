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
        input: 'hsl(var(--input))',
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
