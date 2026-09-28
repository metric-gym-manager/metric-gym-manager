import nextPlugin from 'eslint-config-next'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

/** Shared by the two design-token ratchet blocks at the end of this config. */
const DESIGN_TOKEN_RESTRICTIONS = [
  {
    selector:
      'JSXAttribute[name.name="className"] Literal[value=/(^|\\s)(bg|text|border|ring|divide|from|via|to)-(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-[0-9]{2,3})?($|\\s)/]',
    message:
      'Raw Tailwind palette colour. Use a semantic design token (bg-surface-*, text-ink*, border-line-*, text-success/warning/error) so it follows the theme. See METRIC_UI_DIRECTIVE.md §4.5.',
  },
  {
    selector:
      'JSXAttribute[name.name="className"] TemplateElement[value.raw=/(^|\\s)(bg|text|border|ring|divide)-(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-[0-9]{2,3})?($|\\s)/]',
    message:
      'Raw Tailwind palette colour in a template literal. Use a semantic design token. See METRIC_UI_DIRECTIVE.md §4.5.',
  },
  {
    // Anywhere in the value, not just at the start: `var(--x, #fff)` smuggles a
    // literal through a fallback and the anchored form missed it.
    selector:
      'JSXAttribute[name.name="style"] Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(/]',
    message:
      'Hardcoded colour in an inline style. Use a token class or var(--ds-*) — a literal does not follow the theme. See METRIC_UI_DIRECTIVE.md §4.5.',
  },
  {
    // Tailwind arbitrary values — `bg-[#fff]`, `text-[rgb(0,0,0)]`. These
    // bypassed every other rule here: they are not named palette utilities and
    // not inline styles, so the token system could be sidestepped entirely with
    // the gate still green. Found by the inverted check (probe C1).
    selector:
      'JSXAttribute[name.name="className"] Literal[value=/\\b(bg|text|border|ring|divide|from|via|to|fill|stroke|outline|decoration|accent|caret|shadow)-\\[(#|rgba?\\(|hsla?\\()/]',
    message:
      'Arbitrary colour value. Use a semantic design token; an arbitrary value does not follow the theme. See METRIC_UI_DIRECTIVE.md §4.5.',
  },
  {
    selector:
      'JSXAttribute[name.name="className"] TemplateElement[value.raw=/\\b(bg|text|border|ring|divide|from|via|to|fill|stroke|outline|decoration|accent|caret|shadow)-\\[(#|rgba?\\(|hsla?\\()/]',
    message:
      'Arbitrary colour value in a template literal. Use a semantic design token. See METRIC_UI_DIRECTIVE.md §4.5.',
  },
]

/**
 * Off-scale VALUES — directive §4.5 and §7 forbid hardcoded typography and
 * radius, not merely colour. Kept separate from the colour list above so the
 * one documented exception below can drop these without also dropping colour
 * enforcement.
 *
 * Deliberately narrow: `[0-9.` only, so `text-[10px]` is caught while
 * `text-[#fff]` stays the colour rule's business and nothing double-reports.
 * Arbitrary spacing is NOT restricted — the repo is at zero for it, but w-/h-
 * arbitrary values are legitimate layout sizing and would flood this rule.
 */
const OFF_SCALE_RESTRICTIONS = [
  {
    selector:
      'JSXAttribute[name.name="className"] Literal[value=/\\b(text|leading|tracking)-\\[[0-9.]/]',
    message:
      'Off-scale typography. Use the type scale (text-xs/sm/base or the semantic text-h1/h2/h3) — an arbitrary size sits outside the scale and breaks the density hierarchy. See METRIC_UI_DIRECTIVE.md §4.5, §5.8.',
  },
  {
    selector:
      'JSXAttribute[name.name="className"] TemplateElement[value.raw=/\\b(text|leading|tracking)-\\[[0-9.]/]',
    message:
      'Off-scale typography in a template literal. Use the type scale. See METRIC_UI_DIRECTIVE.md §4.5, §5.8.',
  },
  {
    selector:
      'JSXAttribute[name.name="className"] Literal[value=/\\brounded-\\[/]',
    message:
      'Off-scale radius. Use the radius scale (rounded-sm/md/lg/xl) defined in tokens.ts. See METRIC_UI_DIRECTIVE.md §4.5.',
  },
  {
    selector:
      'JSXAttribute[name.name="className"] TemplateElement[value.raw=/\\brounded-\\[/]',
    message:
      'Off-scale radius in a template literal. Use the radius scale. See METRIC_UI_DIRECTIVE.md §4.5.',
  },
  {
    // The className rules above are blind to `style={{ fontSize: 13 }}`, which
    // is how 103 off-scale values survived a repo reported as being "at zero".
    // Scoped to `style`: recharts' contentStyle/labelStyle/wrapperStyle and the
    // axis-tick object are SVG props that cannot take a class, and are not this
    // rule's business.
    selector:
      'JSXAttribute[name.name="style"] Property[key.name=/^(fontSize|lineHeight|letterSpacing|fontWeight|borderRadius)$/]',
    message:
      'Off-scale typography or radius in an inline style. Use the type/radius scale via a class — an inline literal sits outside the token system entirely. See METRIC_UI_DIRECTIVE.md §4.5, §7.',
  },
  {
    // The colour rule above only fires on `#hex` and `rgb(`, so a bare CSS
    // colour keyword walked straight through it. `transparent`/`inherit`/
    // `currentColor`/`none`/`unset`/`initial` are structural, not palette.
    selector:
      'JSXAttribute[name.name="style"] Property[key.name=/^(color|background|backgroundColor|borderColor|fill|stroke|outlineColor)$/] > Literal[value=/^(?!transparent$|inherit$|currentColor$|none$|unset$|initial$|auto$)[a-z]+$/]',
    message:
      'Named CSS colour in an inline style. Use a semantic token — a colour keyword does not follow the theme. See METRIC_UI_DIRECTIVE.md §4.5.',
  },
]

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      // Nested standalone Remotion project: its own package.json, node_modules
      // and eslint.config.mjs. Untracked, not part of this application, and
      // linting it produced 92 of the 97 errors that appeared to block §8.9.
      'my-video/**',
      // Tracked standalone Remotion project (launch film). Own package.json,
      // tsconfig and vitest; not part of the application bundle.
      'video/**',
      '*.config.js',
      'next-env.d.ts',
    ],
  },
  ...nextPlugin,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Feature-first structure guard: the hexagonal core/infrastructure and the
      // presentation layer were dissolved into features/ in the 2026-07 refactor.
      // Business logic has exactly ONE home per domain: src/features/<domain>/.
      // These bans stop those competing layers from ever being reintroduced.
      // See docs/architecture/feature-first-growth-rules.md.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/core', '@/core/*'],
              message:
                'The hexagonal `core/` layer was dissolved into features/. Put domain logic in src/features/<domain>/. See docs/architecture/feature-first-growth-rules.md (R1).',
            },
            {
              group: ['@/infrastructure', '@/infrastructure/*'],
              message:
                'The `infrastructure/` layer was dissolved. Third-party glue lives in src/lib/; domain repositories live in src/features/<domain>/services/. See docs/architecture/feature-first-growth-rules.md (R1, R8).',
            },
            {
              group: ['@/presentation', '@/presentation/*'],
              message:
                'The `presentation/` layer was removed. Shared UI lives in src/components/; feature UI lives in src/features/<domain>/components/. See docs/architecture/feature-first-growth-rules.md (R1, R8).',
            },
            {
              group: ['@/services', '@/services/*'],
              message:
                'There is deliberately no top-level services layer. Business logic belongs to exactly one feature: src/features/<domain>/services/. See docs/architecture/feature-first-growth-rules.md (R1).',
            },
          ],
        },
      ],
    },
  },

  {
    // ------------------------------------------------------------------
    // Accessibility: every form label must name a control
    // ------------------------------------------------------------------
    // A <label> with no htmlFor and no nested control is announced by screen
    // readers as nothing at all, and is equally invisible to password managers
    // and to Playwright's getByLabel. All five auth pages had this; the login
    // page's version silently broke every E2E spec that logs in, and went
    // unnoticed because those specs were skipping for an unrelated reason.
    //
    // `eslint-plugin-jsx-a11y` ships with eslint-config-next but Next does not
    // enable this rule. It was landed scoped to the auth pages first, then
    // widened here once the remaining 20 violations across members, payments
    // and landing were fixed. The repo is at zero; keep it there.
    //
    // NOTE: the rule cannot see through a component boundary, so a <label>
    // wrapping a DS primitive reads as empty. `controlComponents` teaches it
    // which components are controls; without it, correct code like the
    // AccessReadersCard "In use" switch is a false positive.
    files: ['src/**/*.tsx'],
    rules: {
      'jsx-a11y/label-has-associated-control': [
        'error',
        {
          assert: 'either',
          controlComponents: [
            'Input',
            'Textarea',
            'Select',
            'Checkbox',
            'Radio',
            'Switch',
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------
  // Design tokens: no raw colour outside the Layer-1 sources
  // ------------------------------------------------------------------
  // The workspace is being converted to a dark-first operational system
  // (docs/architecture/METRIC_UI_DIRECTIVE.md §4.5, §7). A raw Tailwind palette
  // utility or a hex literal does not participate in the token system, so it
  // silently survives the dark flip and renders wrong — this is exactly how the
  // shell ended up with a hardcoded white sidebar on a near-black canvas.
  //
  // Missing value → add a semantic token → sync tokens.ts + globals.css +
  // tailwind.config.ts → consume it. Never bypass the token system.
  //
  // The repo is at ZERO. Keep it there — this is now a hard error everywhere in
  // scope, with no per-directory tiers left to graduate. Scope is every surface
  // except the landing page.
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
    ],
    ignores: [
      '**/__tests__/**',
      '**/tests/**',
      'src/components/landing/**',
      'src/app/page.tsx',
      // Rendered by Satori into a PNG, never by the browser: no token layer applies.
      'src/features/registration/services/qr-poster.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...DESIGN_TOKEN_RESTRICTIONS,
        ...OFF_SCALE_RESTRICTIONS,
      ],
    },
  },

  // ------------------------------------------------------------------
  // Documented off-scale exemptions — colour rules still apply
  // ------------------------------------------------------------------
  // These files keep every COLOUR restriction and drop only the off-scale
  // typography/radius ones. A flat-config `ignores` cannot express that: a
  // later block setting the same rule replaces the earlier one wholesale, so
  // the exemption is written as a re-declaration without OFF_SCALE_RESTRICTIONS.
  //
  // Two reasons, both recorded:
  //
  // 1. `AnnouncementProgress` — six `text-[10px] md:text-xs` pairs. Only the
  //    MOBILE half is off-scale (the scale floor is 12px); ruling R6 hands the
  //    mobile surface to a separate rebuild, so collapsing them here would be
  //    an unrendered visual change to a surface this work does not own.
  //
  // 2. The auth + legal surface — a SEPARATE design system. `globals.css`
  //    declares 14 `--ma-*` variables alongside the 44 `--ds-*` ones, and these
  //    screens style themselves with inline numeric type against them: 95
  //    violations across 8 files, and NONE anywhere else in the product. The
  //    workspace directive does not cover this surface, so this is debt made
  //    visible rather than debt fixed. Retheming it onto `--ds-*` is a project,
  //    not a lint fix, and it cannot be done without rendering the screens.
  //
  // `arch:check` UI5 fails if any file here stops needing its exemption.
  {
    files: [
      'src/features/announcements/components/AnnouncementProgress.tsx',
      'src/components/auth/AuthShell.tsx',
      'src/components/legal/LegalLayout.tsx',
      'src/app/refund-policy/page.tsx',
      'src/app/(auth)/login/page.tsx',
      'src/app/(auth)/register/page.tsx',
      'src/app/(auth)/forgot-password/page.tsx',
      'src/app/(auth)/reset-password/page.tsx',
      'src/app/(auth)/verify-email/page.tsx',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...DESIGN_TOKEN_RESTRICTIONS],
    },
  },
]

export default eslintConfig
