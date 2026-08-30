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
      'src/app/**/*.tsx',
      'src/components/**/*.tsx',
      'src/features/**/*.tsx',
    ],
    ignores: [
      '**/__tests__/**',
      '**/tests/**',
      'src/components/landing/**',
      'src/app/page.tsx',
      // Rendered by Satori into a PNG, never by the browser: no token layer applies.
      'src/features/registration/services/qr-poster.tsx',
    ],
    rules: { 'no-restricted-syntax': ['error', ...DESIGN_TOKEN_RESTRICTIONS] },
  },
]

export default eslintConfig
