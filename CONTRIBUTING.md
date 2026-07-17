# Contributing to metric-gym-manager

Welcome. This project has **one architecture** — feature-first — and a small set of
hard rules that keep it that way. They apply to everyone: human contributors and AI
agents alike.

## Read this first

**[`docs/architecture/feature-first-growth-rules.md`](docs/architecture/feature-first-growth-rules.md)**
is the binding rulebook for how the codebase may grow. Read it before adding, moving,
or refactoring code. It contains the full rules (R1–R13), a "where does new code go?"
decision tree, a new-feature checklist, and the forbidden-patterns table.

For AI agents, `.claude/rules/` is auto-loaded every session; the growth rulebook is
linked from `.claude/rules/architecture.md` (rule 2.4).

## The non-negotiables (short version)

- **Business logic lives in `src/features/<domain>/` — nowhere else.** No `core/`,
  `infrastructure/`, `presentation/`, or top-level `services/` layer. Ever.
- **Routes are thin:** auth + Zod validation + one feature-service call. No inline
  Supabase queries in routes.
- **A feature is deletable in isolation.** Shared code moves down to `lib/` (glue),
  `utils/` (pure), or `components/` (shared UI) — never into a sibling feature.
- **One owner per domain type/enum/config.** Import it; never duplicate it.
- **Every feature exposes a public `index.ts`.**
- **Keep the repo root clean.** No logs, `tsc` dumps, one-off analyses, or scratch
  SQL. Docs go under `docs/<taxonomy>/`.
- **Migrations are idempotent and replay from an empty database.** Unique timestamps.
- **Conventional Commits.** Never bump the version or edit `CHANGELOG.md` release
  sections — releases are a human-only action via the GUI.
- **`strict: true`, zero `any`, Zod on every input.**

## Before you commit / open a PR

Run the full gate:

```bash
npm run arch:check         # feature-first structure invariants (auto-runs in pre-commit)
npm run type-check         # strict TypeScript, no `any`
npm run lint               # code quality + dissolved-layer import ban
npm test                   # unit tests
npm run test:integration   # money-path / RLS (when a live stack is configured)
npm run build              # production build sanity
```

`npm run arch:check` also runs automatically in the pre-commit hook, so a change that
breaks the structure is stopped before it is ever pushed. If it fails, it prints the
exact rule you broke and how to fix it.

## Detailed rules

The `.claude/rules/` directory holds the full engineering standards:

- `architecture.md` — feature-first structure + the pattern index
- `security.md` — validation, RBAC, secrets
- `testing.md` — the testing pyramid and mandatory coverage
- `development.md` — the TDD (Red-Green-Refactor) workflow
- `versioning.md` — Conventional Commits and the release process
- `performance.md`, `documentation.md`

Thank you for helping keep this codebase clean and scalable.
