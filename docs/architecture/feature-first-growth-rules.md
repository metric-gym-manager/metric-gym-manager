# Feature-First Growth Rules

> **This document is law.** It is the binding contract for how `metric-gym-manager`
> grows. It applies equally to **human contributors** and **AI agents** (Claude Code
> and any other assistant). If a change violates a rule here, the change is wrong —
> not the rule. When a rule genuinely must bend, you change _this document first_, in
> its own reviewed commit, and explain why; you never quietly violate it.

**Why this exists.** This codebase was refactored out of a real mess: three backend
architectures running at once (hexagonal `core/` + `infrastructure/` + DI container,
feature-first `features/`, and 32 routes with inline Supabase queries), duplicated
domain types, dead code, and ~27 stray one-off files at the repo root. The refactor
collapsed all of that into a single, pure **feature-first** architecture. These rules
exist so that outcome is permanent. The goal is stated plainly:

> **The codebase must never again grow into an unorganized, multi-architecture mess.**

Several of these rules are enforced by machines (ESLint, `npm run arch:check`,
type-check, the test suite). The rest are enforced by review. Both are mandatory. See
[Enforcement](#enforcement).

---

## Prime Directive

**Feature-first is the only architecture.** All business logic lives in exactly one
place per domain: `src/features/<domain>/`. There is no `core/`, no `infrastructure/`,
no `presentation/`, and no top-level `services/` layer. A feature is a self-contained,
deletable vertical slice. Everything else (`app/`, `components/`, `lib/`, `utils/`,
`hooks/`) exists only to route to, compose, or support features.

---

## The canonical structure (authoritative)

This is the shape of `src/`. New code fits into it; it does not add new top-level
concepts.

```
src/
  app/            # Next.js App Router. Routes ONLY: auth + Zod validation + ONE service/factory call.
  components/     # SHARED UI only: ui/ common/ layout/ landing/ providers/ pwa/ dashboard/
  features/       # ALL business logic. One folder per domain. THE center of gravity.
    members/  payments/  subscriptions/  sms/  auth/
    announcements/  registration/  revenue/  settings/  access-control/
  lib/            # Third-party glue only: supabase/ payhere/ storage/ cron/ auth/ middleware/ access-control/ ...
  hooks/          # Shared React hooks
  utils/          # Pure, framework-free utility functions: api/ errors/ date/ phone/ money/ ...
  contexts/       # Shared React contexts
  types/          # Shared TS types (create a file here ONLY when a type is genuinely cross-feature)
tests/            # Integration (live-stack) + e2e. Unit tests live in features/<domain>/tests/.
docs/             # product/ reference/ setup/ ops/ architecture/ integrations/ legal/ seo/
```

Each feature has this internal shape — **six mandated folders plus three optional
ones**:

```
features/<domain>/
  components/     # (mandated) UI specific to this feature
  services/       # (mandated) business logic: use-case classes, repositories, factory.ts
  schemas/        # (mandated) Zod schemas
  types/          # (mandated) TypeScript interfaces
  tests/          # (mandated) unit tests for this feature (*.test.ts / *.test.tsx)
  index.ts        # (mandated) the feature's PUBLIC API barrel
  domain/         # (optional) entities / value logic, e.g. members/domain/Member.ts
  config/         # (optional) domain constants, e.g. subscriptions/config/SubscriptionConfig.ts
  hooks/          # (optional) feature-local React hooks
  utils/          # (optional) feature-coupled helpers, e.g. members/utils/calculateNextDueDate.ts
```

A feature that has no UI may omit `components/`; one with no persistence may omit a
repository. But **every feature has `index.ts`**, and no feature invents folders
outside this list.

---

## The Rules

Each rule is imperative. Where a rule is machine-checked, the enforcer is named.

### R1 — One architecture, one home per domain _(machine-enforced)_

All domain/business logic lives under `src/features/<domain>/`. The dissolved layers
must never return.

- ❌ Do not create `src/core/`, `src/infrastructure/`, `src/presentation/`, or
  `src/services/`.
- ❌ Do not import `@/core/*`, `@/infrastructure/*`, `@/presentation/*`, or
  `@/services/*`.
- ✅ Domain entities, repositories, and use-cases go in `src/features/<domain>/`.
- ✅ Third-party glue (SDK clients, gateways, adapters) goes in `src/lib/`.

Enforced by: ESLint `no-restricted-imports` **and** `npm run arch:check` (both fail
the build on violation).

### R2 — A feature is deletable in isolation

The litmus test for correct placement: _"If I `rm -rf` this feature folder, does only
this feature break?"_ If deleting `features/revenue/` would break `features/members/`,
something is in the wrong place. Shared concerns move down to `lib/`, `utils/`, or
`components/`; they do not sit inside a sibling feature.

- ✅ Two features needing the same pure helper → the helper lives in `src/utils/`.
- ✅ Two features needing the same UI primitive → it lives in `src/components/`.
- ❌ `features/payments/` reaching into `features/revenue/components/` for a chart.

### R3 — Respect the feature's internal shape

Put files in the correct sub-folder (see the canonical shape above). Do not flatten a
feature into a pile of files, and do not invent new sub-folders. Zod schemas in
`schemas/`, entities in `domain/`, use-cases/repositories in `services/`, constants in
`config/`, tests in `tests/`.

Enforced by: review + `npm run arch:check` (verifies `index.ts` presence).

### R4 — Every feature publishes a public API via `index.ts` _(presence machine-enforced)_

Each feature exposes its intended surface through `index.ts`. This barrel is the
feature's contract with the rest of the app.

- ✅ Every `src/features/<domain>/` contains an `index.ts` (enforced by `arch:check`).
- ✅ **Prefer** importing another feature through its barrel: `import { Member } from
'@/features/members'`.
- ✅ **New** cross-feature imports SHOULD go through the barrel, not deep paths.
- ❌ Never import another feature's `tests/`, mocks, or internal helpers from
  **production** code. Test-only utilities may be shared between test suites, but
  production code treats another feature's `tests/` as private.

**Honest note on today's reality:** much existing cross-feature code still imports
_stable deep paths_ (e.g. `@/features/subscriptions/config/SubscriptionConfig`,
`@/features/members/domain/Member`). Those paths are treated as part of the public
surface and are tolerated; migrating them to the barrel is opportunistic cleanup, not
a blocking requirement. What is **never** tolerated is reaching past a feature's
intended surface into something it did not mean to expose.

### R5 — Single ownership of shared domain concepts

A domain enum, status machine, or config is **owned by exactly one feature** and
imported from there. Never copy it.

- ✅ `MemberStatus` / `PlanType` live in `features/members/config/`; everyone imports
  them from members.
- ✅ `SaasTier` / `SaasStatus` / the tier ladder live in
  `features/subscriptions/config/SubscriptionConfig.ts` (this filename is cited by
  name in `.claude/rules/architecture.md` rule 2.13 — **do not rename it**).
- ❌ A second `type Member = …` or a duplicated status list anywhere else.

### R6 — Routes stay thin _(review-enforced)_

An App Router handler (`src/app/**/route.ts` or a Server Action) does exactly three
things: **(1)** authenticate/authorize, **(2)** validate input with a Zod schema, and
**(3)** make one call into a feature service or factory. No business logic and **no
inline Supabase queries** in routes.

```ts
// ✅ correct route shape
export async function POST(req: NextRequest) {
  const user = await requireGymOwner() // 1. auth
  const input = createMemberSchema.parse(await req.json()) // 2. validate
  const result = await createRegisterMember(await createClient()) // 3. one service call
    .execute({ gymId: user.gymId, ...input })
  return ResponseBuilder.ok(result)
}
```

```ts
// ❌ forbidden: inline query + business logic in the route
const { data } = await supabase.from('members').insert(...);
if (data.length > gym.limit) { /* quota logic in the route */ }
```

**Documented exceptions** (these are the _only_ ones): per-route auth/tenant `gyms`
lookups; `api/admin/system-health/*` infra-monitoring reads (no domain owner);
dev-only `api/demo/*`. Adding a new exception requires updating this list.

### R7 — Server composition goes through a factory

Wiring a use-case (injecting its repositories, gateways, SMS/storage providers) is the
job of the feature's `services/factory.ts`, via `create<UseCase>(supabase)` functions.
Routes call the factory; they do not `new` up repositories or wire dependencies
themselves. Pass the correct Supabase client — session `createClient()` for
gym-scoped RLS, service-role `createAdminClient()` for cron/webhook/admin paths — the
same distinction the old DI container made.

### R8 — `lib/`, `utils/`, `components/` have strict, narrow jobs

- **`src/lib/`** = third-party glue **only** (Supabase clients, PayHere gateways, R2
  storage, cron logger, middleware, rate-limit). If it wraps an external service or
  framework, it belongs here. It must not contain gym-domain business rules.
- **`src/utils/`** = **pure**, framework-free functions (dates, money, phone, error
  shapes, the `ResponseBuilder` in `utils/api/`). No React, no Supabase, no
  domain-specific branching. Stateful helpers (e.g. rate-limit) go in `lib/`, not
  `utils/`.
- **`src/components/`** = **shared** UI only. UI used by a single feature lives in
  that feature's `components/`. (`components/dashboard/` is intentionally shared — it
  is page composition, not feature-owned.)

### R9 — Tests live with the code they test

- Feature unit tests → `features/<domain>/tests/` (`*.test.ts` / `*.test.tsx`).
- Shared code (`lib/`, `utils/`, `components/`, `app/`) keeps jest-conventional
  `__tests__/` folders.
- Integration (live-stack) and e2e tests → top-level `tests/`.

Every feature ships tests for the happy path, validation errors, authorization
errors, and edge cases (see `.claude/rules/testing.md`). TDD is the workflow
(`.claude/rules/development.md`).

### R10 — The repo root and `docs/` stay clean _(root junk machine-enforced)_

- The repo root holds only project-level files: `README.md`, `CHANGELOG.md`,
  `CLAUDE.md`, `CONTRIBUTING.md`, `instructions.md`, and configs. **No** dev logs,
  `tsc` output dumps, one-off `*_ANALYSIS` notes, scratch `.sql`, or throwaway
  scripts at the root.
- Documentation lives under `docs/<taxonomy>/`: `product/`, `reference/`, `setup/`,
  `ops/`, `architecture/`, `integrations/`, `legal/`, `seo/`. A new doc goes in the right
  bucket, never at the root.
- Historical, one-off, or superseded docs are deleted (git history preserves them),
  not left to rot in the tree.

Enforced by: `npm run arch:check` rejects `*.log`, `*_ANALYSIS.*`, compiler-output
dumps, `*.tmp`, and root-level `*.sql`. `.gitignore` covers `*.log`.

### R11 — Migrations are idempotent and replay from empty _(duplicate-timestamp machine-enforced)_

Every migration in `supabase/migrations/` must rebuild the schema correctly when run
from an **empty** database (fresh clone, staging, disaster recovery), not just against
the live project.

- ✅ `CREATE TABLE IF NOT EXISTS`, `DROP … IF EXISTS`, guarded enum swaps that drop and
  recreate dependent indexes/functions, schema-qualified extension calls
  (`extensions.gen_random_bytes(...)`).
- ✅ Forward references resolved in order (create a table before the FK that points at
  it, or add the FK in a later migration).
- ❌ Duplicate numeric timestamp prefixes (they make apply-order non-deterministic).
- ✅ When you create or alter a table directly in the Supabase dashboard, capture it
  as a matching idempotent migration so the chain never drifts from production.

Enforced by: `npm run arch:check` rejects duplicate migration timestamps. Full-replay
correctness is verified by running the chain against an empty DB in CI/staging.

### R12 — Conventional Commits; never auto-release

Commit messages follow Conventional Commits (`feat`, `fix`, `refactor`, `docs`,
`chore`, `test`, `perf`, …), validated by the `commit-msg` hook. **Only a human
releases** — never bump the version in `package.json`, edit `CHANGELOG.md` release
sections, or create tags as part of ordinary work. See `.claude/rules/versioning.md`.

### R13 — Type-safety and validation are non-negotiable

`strict: true`; **zero** `any` (use `unknown`, then narrow); all API inputs validated
with Zod; domain enums validated with `z.nativeEnum()`, never a duplicated `z.enum()`
set. Responses are built with `ResponseBuilder` (`@/utils/api`) and serialized through
the domain's serialization helper — never by handing a raw entity to `JSON`. These are
detailed in `.claude/rules/security.md` and the pattern index in
`.claude/rules/architecture.md`.

---

## Where does new code go? (decision tree)

```
Is it a URL / HTTP entry point?
  └─ yes → src/app/**  (thin: auth + Zod + ONE service call — R6)

Is it gym business logic (members, payments, billing, SMS, revenue, …)?
  └─ yes → src/features/<domain>/…
             ├─ a Zod schema?              → schemas/
             ├─ an entity / value logic?   → domain/
             ├─ a use-case or repository?  → services/  (+ wire it in services/factory.ts — R7)
             ├─ a domain constant/enum?    → config/    (owned by ONE feature — R5)
             ├─ feature-specific UI?       → components/
             └─ a test?                    → tests/
           …and export the public surface from index.ts (R4)

Does it wrap an external service / framework (Supabase, PayHere, R2, cron)?
  └─ yes → src/lib/<thing>/

Is it a pure, framework-free helper used by more than one feature?
  └─ yes → src/utils/<thing>/   (stateful? → src/lib/ instead — R8)

Is it shared UI used by more than one feature?
  └─ yes → src/components/…

None of the above / it's a brand-new domain?
  └─ create a NEW feature folder (see below). Do NOT bolt it onto an unrelated feature.
```

## Adding a new feature (checklist)

1. `src/features/<new-domain>/` with the mandated folders (`components/ services/
schemas/ types/ tests/`) plus any optional ones you need.
2. Write `index.ts` exporting only the intended public surface.
3. Business logic as use-case classes/functions in `services/`; wire them in
   `services/factory.ts` (`create<UseCase>(supabase)`).
4. Zod schemas in `schemas/`; own your enums/constants in `config/` (R5).
5. Tests in `tests/` covering happy path + validation + auth + edge cases (R9, TDD).
6. Routes in `src/app/**` stay thin and call your factory (R6).
7. Run the [full gate](#enforcement) before committing.

---

## Forbidden patterns (quick reference)

| ❌ Never                                                                         | ✅ Instead                                                  |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Recreate `core/`, `infrastructure/`, `presentation/`, or a top-level `services/` | Put logic in `features/<domain>/`; glue in `lib/`           |
| `import … from '@/core/…'` (or infrastructure/presentation/services)             | Import from `@/features/<domain>` or `@/lib` / `@/utils`    |
| Inline Supabase query inside a route handler                                     | Call a feature service via its factory (R6/R7)              |
| Duplicate a domain type/enum/config in a second place                            | Import it from its owning feature (R5)                      |
| Feature A importing feature B's `tests/`/mocks from production code              | Share only through B's public surface (R4)                  |
| Business logic in `src/lib/` or React/Supabase in `src/utils/`                   | Keep `lib/` = glue, `utils/` = pure (R8)                    |
| Feature-specific UI in shared `src/components/`                                  | Put it in `features/<domain>/components/` (R8)              |
| One-off docs / logs / `tsc` dumps / scratch `.sql` at the repo root              | Delete them, or file docs under `docs/<taxonomy>/` (R10)    |
| Non-idempotent migration, or duplicate migration timestamp                       | Idempotent, empty-DB-replayable, unique timestamp (R11)     |
| Bumping version / editing CHANGELOG release sections as normal work              | Leave releases to a human via the GUI (R12)                 |
| `any`, unvalidated input, raw-entity serialization                               | `unknown`+narrow, Zod, `ResponseBuilder` + serializer (R13) |

---

## Enforcement

Two layers, both mandatory.

### Machine-enforced (fails the build — cannot be merged red)

| Check                      | Command                                         | Covers                                                                                              |
| -------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Dissolved-layer import ban | `npm run lint` (ESLint `no-restricted-imports`) | R1                                                                                                  |
| Structure invariants       | `npm run arch:check`                            | R1 (dirs + imports), R4 (every feature has `index.ts`), R10 (root junk), R11 (duplicate timestamps) |
| Type safety                | `npm run type-check`                            | R13 (`strict`, no `any`)                                                                            |
| Behavior                   | `npm test` / `npm run test:integration`         | R9 and every rule with a test                                                                       |
| Commit format              | `commit-msg` git hook                           | R12                                                                                                 |

`npm run arch:check` also runs automatically in the **pre-commit hook** (fast,
dependency-free) so a violating commit is stopped locally before it is ever pushed.
Wire `npm run arch:check` into CI as a required status check as well.

### Review-enforced (a human/agent verifies in review)

R2 (deletability), R3 (correct sub-folder), R5 (single ownership), R6 exceptions, R7
(factory wiring), R8 (layer discipline), and the `SHOULD` half of R4 (prefer the
barrel) are checked in code review. AI agents must self-check these before proposing a
change; reviewers must reject changes that violate them.

### The full gate (run before any merge)

```bash
npm run arch:check      # structure invariants (R1, R4, R10, R11)
npm run type-check      # R13
npm run lint            # R1 import ban + code quality
npm test                # unit
npm run test:integration  # money-path / RLS (when a live stack is configured)
npm run build           # production build sanity
```

`rg "@/core|@/infrastructure|@/presentation|@/services" src tests` must return **zero**.
`npm test -- --listTests | wc -l` must be **≥** the previous baseline (no suite silently
dropped).

---

## For AI agents specifically

- Before writing code, load this file and `.claude/rules/architecture.md`. When you
  touch a domain, open the relevant `docs/architecture/*.md` pattern reference first.
- Never "temporarily" reintroduce a layer, duplicate a type, or inline a query with a
  promise to clean it up later. There is no later.
- If a task seems to require breaking a rule, stop and surface the conflict to the
  user rather than working around it. Changing the architecture is a human decision;
  it starts with editing _this document_.
- Run `npm run arch:check` (and the full gate) as part of finishing any structural
  change, and report the result honestly.
