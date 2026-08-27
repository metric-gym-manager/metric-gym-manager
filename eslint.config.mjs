import nextPlugin from 'eslint-config-next'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
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
]

export default eslintConfig
