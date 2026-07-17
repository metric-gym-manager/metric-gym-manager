import nextPlugin from "eslint-config-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "*.config.js",
      "next-env.d.ts",
    ],
  },
  ...nextPlugin,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Feature-first structure guard: the hexagonal core/infrastructure and the
      // presentation layer were dissolved into features/ in the 2026-07 refactor.
      // Business logic has exactly ONE home per domain: src/features/<domain>/.
      // These bans stop those competing layers from ever being reintroduced.
      // See docs/architecture/feature-first-growth-rules.md.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/core", "@/core/*"],
              message:
                "The hexagonal `core/` layer was dissolved into features/. Put domain logic in src/features/<domain>/. See docs/architecture/feature-first-growth-rules.md (R1).",
            },
            {
              group: ["@/infrastructure", "@/infrastructure/*"],
              message:
                "The `infrastructure/` layer was dissolved. Third-party glue lives in src/lib/; domain repositories live in src/features/<domain>/services/. See docs/architecture/feature-first-growth-rules.md (R1, R8).",
            },
            {
              group: ["@/presentation", "@/presentation/*"],
              message:
                "The `presentation/` layer was removed. Shared UI lives in src/components/; feature UI lives in src/features/<domain>/components/. See docs/architecture/feature-first-growth-rules.md (R1, R8).",
            },
            {
              group: ["@/services", "@/services/*"],
              message:
                "There is deliberately no top-level services layer. Business logic belongs to exactly one feature: src/features/<domain>/services/. See docs/architecture/feature-first-growth-rules.md (R1).",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
