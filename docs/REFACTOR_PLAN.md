# Codebase Refactor & Reorganization Plan — metric-gym-manager

## Context

The repo has grown organically into an inconsistent state:

- **~27 stray files at repo root**: dev logs, `tsc` output dumps, one-off error analyses, completed implementation plans, an empty `index.ts`, an empty orphan migration SQL, plus living docs (SYSTEM_MANUAL, PRD, CRON_JOBS) that belong in `docs/`.
- **Three backend architectures live simultaneously** in `src/`: hexagonal (`core/` 83 files + `infrastructure/` 20 files + DI `Container.ts`; used by 28 API routes), feature-first (`features/`, mandated by `.claude/rules/architecture.md`, used by 27 routes — but its services bypass the hexagonal layer and hit Supabase directly), and 32 routes with **inline Supabase queries**. Some routes mix all three (`src/app/api/members/route.ts`).
- **Dead code**: `src/presentation/` (0 inbound imports), `src/lib/services/sms.ts` (0 importers), ~14 legacy landing components, `src/app/dashboard/` (layout-only, unroutable branch — real page is `(dashboard)/dashboard/`).
- **Duplication**: `Member` type ×3, SMS transport ×3, phone logic ×3, date utils ×2-3, `MetricCard.tsx` ×2.
- **Broken tooling**: husky configured but no `.husky/` dir → lint-staged/pre-commit never runs; duplicate migration timestamp `20260708000001` (×2 files); `instructions.md` referenced by 8 files but missing; committed PII CSV (78 member rows in `scripts/bulk-members-import.csv`); `.gitignore` lacks `*.log`.

## User-approved decisions

1. **Pure feature-first architecture** — dissolve `core/` + `infrastructure/` into `features/<domain>/`; delete the DI container; feature services use `src/lib/supabase` clients directly.
2. **Phased execution** — organization/hygiene first (no behavior change), code consolidation after; tests green after every phase.
3. **Delete historical one-off docs** (git history preserves them). *Adjustment during verification: 3 docs the design pass marked for deletion are actually referenced by README/code/other docs (`SAAS_SUBSCRIPTION_IMPLEMENTATION.md`, `multi-gym-implementation-blueprint.md`, `pwa-update-banner-testing.md`) — these are kept and relocated instead.*

Branch: `claude/codebase-refactor-plan-9puy7f`. Conventional Commits (`refactor:`/`docs:`/`chore:`/`test:`), **never** bump version/CHANGELOG release sections (repo rule: only the user releases via GUI).

---

## Target end state

### `src/`

```
src/
  app/                          # URLs unchanged; dead app/dashboard/ deleted
  components/                   # SHARED UI only: ui/ common/ layout/ landing/ providers/ pwa/ dashboard/
  contexts/  hooks/             # unchanged
  features/
    members/       components/ domain/ config/ services/ schemas/ types/ utils/ tests/ index.ts
    payments/      components/ domain/ services/ types/ tests/ index.ts        (NEW feature dir)
    subscriptions/ components/ domain/ config/ services/ hooks/ schemas/ types/ utils/ tests/ index.ts
    sms/           config/ services/ schemas/ types/ tests/ index.ts
    auth/ announcements/ registration/ revenue/ settings/   (existing, gain components/ in Phase 6)
  lib/                          # third-party glue only
    supabase/{client,server,admin}.ts
    payhere/                    # existing + gateways & port interfaces from infrastructure/
    storage/                    # R2/Mock providers from infrastructure/
    cron/CronLogger.ts
    auth/ middleware/ client-state/ rate-limit.ts
    utils/index.ts              # cn() only — '@/lib/utils' shadcn alias keeps resolving
  utils/                        # pure utilities (NEW top-level, mandated)
    api/ApiResponse.ts          # ResponseBuilder (rule 2.3 — class name preserved)
    errors/  date/  phone/  money/  api-error.ts  badge-colors.ts  member-photo.ts  image.ts
# DELETED ENTIRELY: src/core/, src/infrastructure/, src/presentation/
```

Conventions codified in Phase 7: feature folders may add `domain/`, `config/`, `utils/`; shared domain enums/configs owned by exactly one feature, imported only via its `index.ts`; route handlers = auth + Zod validation + one service call, no inline Supabase (documented exception: `admin/system-health/*` infra reads).

### `docs/` and root

```
docs/
  README.md                     # NEW index
  product/      PRD.md, multi-gym-implementation-blueprint.md
  reference/    SYSTEM_MANUAL.md, authentication.md, USE_CASES.md, NAVIGATION_SCHEMA.md,
                SAAS_SUBSCRIPTION_IMPLEMENTATION.md
  setup/        SETUP.md        # NEW: merge DATABASE_SETUP + ENV_SETUP_GUIDE + SUPABASE_CONFIG_REQUIRED
  ops/          CRON_JOBS.md, DEPLOYMENT_PAYHERE_CHECKLIST.md, versioning-system-guide.md,
                pwa-update-workflow.md, pwa-update-banner-testing.md, PAYMENT_REMINDERS_TESTING.md,
                performance_optimization.md
  architecture/ (the 11 pattern files — UNCHANGED PATHS, 1:1 with .claude/rules index)
  legal/        privacy-policy.txt, terms-of-service.txt
  integrations/payhere/         # rename of misspelled Payhere_subscritption_integration/
instructions.md                 # NEW at root (mandated file, fixes 8 dangling references)
```

Root keeps only: `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `instructions.md`, configs.

---

## Phase 0 — Environment + baseline (no commits)

1. `npm install` **first action** (node_modules absent; a PostToolUse hook runs `lint && type-check` after every shell command and currently errors on missing `eslint-config-next`).
2. Baseline: `npm run type-check`, `npm test -- --listTests | wc -l` (record count), `npm test`, `npm run build`. `npm run test:integration` once if env vars exist, else note as manual/CI gate.
3. If baseline is red: report to user, fix-forward with `fix:` commits before proceeding.

## Phase 1 — Root/docs hygiene (`chore:`/`docs:`, no src changes)

**Delete (root):** `dev.log`, `.dev.log`, `type-check-output.txt`, `index.ts` (0B), `20260214000000_multi_gym_refactor.sql` (0B orphan, no counterpart in supabase/migrations/), `FILE_TREE.md`, `legacy_architecture.md`, `BUILD_ERROR_ANALYSIS.txt`, `MARK_PAID_ERROR_ANALYSIS.txt`, `SYSTEM_TEST_EARLY_RENEWAL_HOTFIX.txt`, `TYPE_CHECK_ERROR_ANALYSIS.txt`, `AUTH_VERIFICATION_REPORT.md`, `FROZEN_STATUS_REMOVAL_SUMMARY.md`, `IMPLEMENTATION_PLAN.md`, `MIGRATION_GUIDE.md`, `AUTH_IMPLEMENTATION_GUIDE.md` (superseded by docs/authentication.md), `CHANGELOG_EMAIL_VERIFICATION.md` (merge its entries into `CHANGELOG.md` **Unreleased/dated section first**).

**Delete (docs/):** `ARCHITECTURAL_SIMULATION_LEDGER.md`, `MIGRATION_GUIDE_20260325.md`, `NEW_ARCHITECTURE.md`, `PAYMENT_COLLECTED_TAB_ANALYSIS.md`, `PAYMENT_COLLECTED_TAB_IMPLEMENTATION_TODO.md`, `UI-improvements-progress.md`, `UI-improvements-lv01.md`, `pwa-update-banner-summary.md`, `CLEAN_ARCHITECTURE.md` (documents the hexagonal architecture this refactor dissolves — would mislead), `SYSTEM_REVIEW_AND_IMPROVEMENT_PLAN.md` (actioned by this refactor), `Payhere_subscritption_integration/payhere-subscription-implementation-plan.md`, `.claude/rules/Untitled` (empty stray). Grep each basename for references before deleting (`rg -l '<name>'`).

**Move/create:** `git mv` per the docs tree above; write `docs/setup/SETUP.md` (merged) + `docs/README.md`; rename `Payhere_subscritption_integration/` → `integrations/payhere/`; create root `instructions.md` (outline in Phase 7). Grep-update all references to moved docs (`README.md`, `scripts/README.md`, `docs/architecture/saas-subscription.md`, `DEPLOYMENT_PAYHERE_CHECKLIST.md`, comment in `src/infrastructure/payments/PayHereSubscriptionGateway.ts`).

**Scripts + PII:** delete `scripts/bulk-members-import.csv` (**PII**), `scripts/{import-bulk-members,cleanup-and-reimport,verify-import}.ts`, `scripts/apply-gym-id-migration.js`, `scripts/generate-pwa-assets-auto.js` (dead). Move root `test-reminder.js`, `test-welcome-sms.js` + `scripts/{create-test-member,identify-gym}.js`, `scripts/backfill-initial-payments.ts` → `scripts/manual/` with README. **Flagged user decision, not done here:** purging the PII CSV from git history (filter-repo/BFG + force-push) rewrites history and breaks clones; plan only removes it at HEAD.

**.gitignore:** add `*.log`.

Gate: `type-check` + `npm test` unchanged.  Risk: LOW.

## Phase 2 — Dead src code removal (`refactor:`, behavior-neutral)

1. Delete `src/presentation/` (re-verify `rg "@/presentation"` = 0 first).
2. Delete `src/lib/services/sms.ts` (+ empty dir).
3. Delete legacy landing components (`HeroSection`, `Footer`, `PricingSection`, `FeaturesSection`, `TestimonialsSection` — barrel labels them "Legacy, kept for reference"; `app/page.tsx` uses only `New*`); prune `components/landing/index.ts`; delete transitive orphans (`PricingCard` etc.) only if sole importers were deleted files. Optionally rename `New*` → plain names in a follow-up commit.
4. Delete `src/app/dashboard/` (verified: contains only `layout.tsx`, no page — unroutable; real page is `(dashboard)/dashboard/`).
5. Fix `lib/utils.ts` file/dir collision: `cn()` → new `src/lib/utils/index.ts`, delete `src/lib/utils.ts` (`@/lib/utils` imports keep resolving; `components.json` untouched).

Gate: `type-check` + `npm test` + `npm run build`.  Risk: LOW-MED (dynamic imports — mitigate with `rg` per basename + build gate).

## Phase 3 — Tooling fixes (`chore:`)

1. **Git hooks — standardize on the custom installer, drop husky** (installer + `scripts/hooks/` are tracked, working, wired via `postinstall`; husky was never initialized). Remove `"prepare": "husky"` + husky devDependency; add `scripts/hooks/pre-commit` running `npx lint-staged` (un-orphans existing lint-staged config); add `'pre-commit'` to the `HOOKS` array in `scripts/install-git-hooks.js`. Note in commit: commits get slower (`jest --findRelatedTests` now actually runs).
2. **tsconfig:** narrow `include` from `**/*` to `next-env.d.ts`, `src/**/*`, `tests/**/*`, `scripts/**/*.ts`, `playwright.config.ts`, `tailwind.config.ts`, `.next/types/**`. Compare `tsc --noEmit --listFiles | wc -l` before/after.
3. **jest.config.js:** `testMatch` → filename-based `'<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}'` (prep for `tests/` dirs inside features); extend coverage excludes with `!src/**/tests/**`, `!src/**/test-utils/**`. Prove no suite lost via `--listTests` count vs Phase 0.
4. **Migration timestamp:** `git mv supabase/migrations/20260708000001_lock_down_otp_tokens.sql → 20260708000007_lock_down_otp_tokens.sql` (content untouched). **Operator caveat in commit message:** if a linked project's `schema_migrations` recorded the old version, run `supabase migration repair --status applied 20260708000007` before any future `supabase db push`. Creating `supabase/config.toml` + CLI link = separate flagged user decision.
5. `docs:` drop removed `frozen` status from `CLAUDE.md` line 68.

Gate: `type-check` + `npm test` (same count); throwaway commit to confirm hooks fire.  Risk: LOW-MED.

## Phase 4 — Cross-cutting extraction (`refactor:`, pure `git mv` + import rewrites)

| From | To |
|---|---|
| `core/utils/api/ApiResponse.ts` (ResponseBuilder, pure — verified no Next imports) | `src/utils/api/` (~60 importers, mostly `app/api/**`) |
| `core/utils/errors/` | `src/utils/errors/` |
| `core/utils/cron/CronLogger.ts` | `src/lib/cron/` (8 cron routes) |
| `core/utils/date/formatDate.ts` + `lib/utils/date.ts` (+tests) | `src/utils/date/` (merge deferred to Phase 6) |
| `lib/utils/{api-error,badge-colors,member-photo,image}.ts` (+tests) | `src/utils/` |
| `lib/utils/rate-limit.ts` | `src/lib/rate-limit.ts` (stateful → lib, not utils) |
| `lib/utils/phone.ts` | `src/utils/phone/` (merge in Phase 6) |
| `core/domain/value-objects/{Money,PhoneNumber}.ts` | `src/utils/money/`, `src/utils/phone/` |
| `core/ports/services/IStorageProvider.ts` + `infrastructure/storage/*` | `src/lib/storage/` |
| `core/ports/services/{IPaymentGateway,ISubscriptionGateway}.ts` + `infrastructure/payments/*` (+tests) | `src/lib/payhere/` |

**NOT to `src/utils`:** `core/utils/date/{calculateNextDueDate,getDaysUntilDue}.ts` import `PlanConfig` — member-domain logic → `features/members/utils/` in Phase 5.2. `Container.ts` keeps compiling throughout (import paths only). 3-4 commits, each green.

Gate: `type-check`, `npm test`, `build`; `rg "@/core/utils/(api|errors|cron)"` = 0.  Risk: LOW-MED (volume; tsc catches misses).

## Phase 5 — Dissolve core/ + infrastructure/ into features/ (`refactor:` — the heart)

**Design:** the 18 use-case classes keep names, constructor injection, and `execute()` — they become feature service classes (the 21 unit suites mock ports via constructors; converting to functions would rewrite the billing test suite for zero gain). The DI container is replaced by **per-feature `services/factory.ts`** — `create<UseCase>(supabase: SupabaseClient)` functions whose wiring is copied **verbatim** from the corresponding `Container` getters (incl. env-driven Mock-vs-real SMS/storage selection, PayHere price injection). Route diff is minimal:

```ts
// before                                                  // after
const c = await getAdminContainer();                       const summary = await createChargeDueRenewals(
const summary = await c.getChargeDueRenewalsUseCase()          createAdminClient()).execute();
  .execute();
```
Audit each of the 28 DI routes for `getContainer` (→ `await createClient()`) vs `getAdminContainer` (→ `createAdminClient()`) so the same Supabase client is used as today.

**5.1 SMS first** (members depend on `ISMSProvider`): `ISMSRepository`, `ISMSProvider`, `SupabaseSMSRepository`, `infrastructure/sms/providers/*`, `core/use-cases/reminder/SendAutomatedReminders`, `ReminderConfig` (+tests) → `features/sms/{services,services/providers,config,tests}/`; new `factory.ts`; export public surface via `features/sms/index.ts`. Container import paths updated only (cron rewiring batched in 5.5).

**5.2 Members:** `core/domain/member/*` → `features/members/domain/`; `{Plan,Status,Registration}Config` → `features/members/config/`; `calculateNextDueDate`, `getDaysUntilDue` → `features/members/utils/`; `IMemberRepository` + `SupabaseMemberRepository` + 8 member use-cases → `features/members/services/`; all related tests (both the colocated `__tests__` AND the `core/__tests__` mirror copies, incl. `MemberLifecycleQuota`, `ArchitecturalSimulationHarness`) → `features/members/tests/`; new `factory.ts` (8 creators, SMS/storage deps via `features/sms` factory + `lib/storage`). Update cross-feature importers (`features/registration` uses `getPlanLabel`; schemas use `MemberStatus`) to go via `features/members` `index.ts`. Rewire the non-cron member routes (photo/verify/suspend/activate/cancel/bulk/public-registrations); hold `payment`/`day-pass` for 5.3.

**5.3 Payments (new feature dir):** `core/domain/payment/*`, `IPaymentRepository`, `SupabasePaymentRepository`, `CollectPayment`, `IssueDayPass` (+tests) → `features/payments/`; rewire `members/[id]/{payment,payment/preview,day-pass}`. Run the CollectPayment/IssueDayPass suites explicitly.

**5.4 Subscriptions (SaaS money — most careful):** `core/domain/subscription/*` → `features/subscriptions/domain/`; `SubscriptionConfig.ts` → `features/subscriptions/config/SubscriptionConfig.ts` (**filename preserved — rule 2.13 cites it by name**); 4 I*Repositories + 4 Supabase*Repositories + 7 subscription use-cases → `features/subscriptions/services/`; all subscription tests + `core/test-utils/subscription-mocks.ts` → `features/subscriptions/tests/`; rename existing `__tests__/` → `tests/`. New `factory.ts` (7 creators + `getPayHereGateway()` / `createSaasPaymentLogRepository()` for the webhook route; gateways from `@/lib/payhere`). **Update 4 integration suites' imports** (`tests/integration/api/{quota,webhook,dunning,checkout-cancel}.test.ts` import `@/core/utils/constants/SubscriptionConfig`). Rewire billing reads first (`settings/subscription`, `billing/history`, `admin/system-health/billing-failures`), then money writes (`billing/{checkout,change-plan,cancel}`). **Gate on `npm run test:integration`** — if env unavailable, stop and ask the user to run it before 5.5.

**5.5 Production-critical rewiring LAST:** the 7 cron routes (identical 2-line factory swaps; URLs unchanged → `vercel.json` untouched), update `api/cron/__tests__/cron-routes.test.ts` mocks from `getAdminContainer` to feature factories (the one test whose mocking strategy actually changes — budget review time). Then `api/webhooks/payhere` (signature gate → `getPayHereGateway()`, audit log → `createSaasPaymentLogRepository(adminClient)`, processing → `createHandlePayHereWebhook(adminClient)`); the always-200 idempotent contract is enforced by `tests/integration/api/webhook.test.ts` — **mandatory gate**.

**5.6 Delete the corpse:** delete `infrastructure/di/`, then empty `src/infrastructure/` + `src/core/` (anything left = missed mapping — investigate, don't force-delete). Gates: `rg "@/core|@/infrastructure|@/presentation" src tests scripts` = **0**; `type-check` + `npm test` + `build` + `test:integration` (+ e2e if env).

Risk: **HIGH, sequenced** — 5.1-5.3 MED, 5.4/5.5 HIGH (money/webhook/cron), 5.6 LOW. Never mix a move and a logic change in one commit; diff-review each factory against its Container getter side-by-side.

## Phase 6 — Consolidation (`refactor:`, first behavior-adjacent phase)

**6A Deduplication (one commit each):**
1. Member serialization: extract `serializeMemberForAPI()` from `app/api/members/route.ts` → `features/members/utils/` (+test); reuse in all member routes (satisfies rule 2.11).
2. SMS: `textlk.service.ts` (live, 7 importers) = single HTTP transport; `TextLkSMSProvider` becomes a thin adapter delegating to it.
3. Phone: merge `src/utils/phone/` + `features/auth/utils/phone.utils.ts` into one module (port BOTH test suites first; flag genuine normalization conflicts to user); `PhoneNumber` VO delegates.
4. Dates: merge `src/utils/date/` modules.
5. `MetricCard`: keep superset as `components/common/MetricCard.tsx`; update both importers.
6. Feature-owned UI out of shared `components/`: `payment-collection/*` → `features/payments/components/`; `AnnouncementProgress` → `features/announcements/`; `RevenueChart` → `features/revenue/`; `ProfileImageUpload` → `features/settings/`; `AuthRecovery` → `features/auth/`. (`components/dashboard/` deliberately stays shared — page composition.)

**6B Inline-Supabase route migrations, risk-ordered tiers (one commit per tier):** extract queries verbatim into `features/<domain>/services/*.service.ts`; response shapes byte-identical.
- **T1 read-only:** `members/suggestions`, `members/[id]/detail`, `members/[id]/sms-history` (→ sms), `dashboard/metrics` (→ `features/revenue/services/metrics.service.ts`), `announcements/[id]/progress`.
- **T2 settings/config CRUD:** `settings/gym/profile-image`, `settings/security/username`, `discounts`, `feedback`, `auth/verify-email` (fold into existing `features/auth` service), `admin/qr-codes` (→ registration).
- **T3 member/announcement writes:** `announcements/*`, residual inline parts of `members/route` + `members/[id]/payment` (delegate to Phase 5 services).
- **T4 SMS webhook:** `webhooks/textlk` (response contract identical — text.lk retries on failure).
- **T5 money + cron LAST:** `payment-collection/collected`, `regular-payments` (→ payments), `cron/archive-old-members` (→ members + CronLogger).
- **Documented exceptions (don't migrate):** `admin/system-health/{cron-stats,sms-failures}` (infra reads, no domain owner), `demo/reset-rate-limits`.

Gates per tier: `type-check`, `npm test`, `build`; T4-T5 add `test:integration` + before/after response capture on money endpoints where a dev DB exists.  Risk: MED (T5 HIGH).

## Phase 7 — Rules/docs realignment + final gates (`docs:`/`chore:`)

1. **`.claude/rules/architecture.md`:** delete the contradictory `/services  # Business logic layer` line from §1.1; replace the structure tree with the realized one; §2.4 canonical feature shape = mandated six + optional `domain/ config/ utils/`; add "shared enums owned by one feature, imported via its index.ts" and "routes = auth + validation + service call; no inline Supabase (exception: admin/system-health)"; update pattern-index paths (rule 2.3 → `@/utils/api`; rule 2.13 → `features/subscriptions/config/SubscriptionConfig.ts`).
2. **`CLAUDE.md`:** real structure tree, corrected Git Hooks section (custom installer, husky removed), new docs taxonomy pointers.
3. **`instructions.md`** final content: purpose line; 5-bullet product summary; pointers to `docs/product/PRD.md`, `docs/reference/SYSTEM_MANUAL.md`, `docs/reference/USE_CASES.md`, `docs/architecture/saas-subscription.md`, `docs/ops/CRON_JOBS.md`; non-negotiable invariants (statuses active/expired/suspended/cancelled — no frozen; RLS isolation; Lite 100/Pro ∞/Enterprise ∞ active members; webhook always-200 idempotent; members never deleted by billing code; quota only via `assert_gym_can_add_active_member`); project rules (Conventional Commits, no manual version bumps, TDD, zero `any`).
4. **`README.md`:** fix links, hooks description, doc paths.

**Final gates:**
- `rg "@/core|@/infrastructure|@/presentation" src tests scripts` → 0; `rg "getContainer|getAdminContainer" src` → 0
- `npm run type-check && npm run lint && npm test && npm run build && npm run test:integration` (+ e2e when env available)
- `npm test -- --listTests | wc -l` ≥ Phase 0 baseline (no suite lost)

---

## Test strategy

- Feature tests live in `features/<domain>/tests/` (mandated shape); shared code (`lib/`, `utils/`, `components/`, `app/`) keeps jest-conventional `__tests__/`. Phase 3's filename-based `testMatch` covers both with zero further config churn.
- Core's duplicate test tree (colocated `__tests__` + `core/__tests__` mirror) resolves by construction: both land in the same `features/<domain>/tests/` folder in the same commit as their subjects.
- 48 unit + 6 integration + 4 e2e suites stay green per phase: unit suites move with code (import lines only); integration needs import edits only in 5.4; e2e is black-box.

## Rollback

Each phase = 1-6 atomic commits, each independently green; later phases never depended on by earlier ones → reverting the tail is always safe (`git revert` a phase's contiguous range). Merge to default branch only after Phase 7's full gate.

## Flagged user decisions (NOT executed in this plan)

1. **PII git-history purge** of `scripts/bulk-members-import.csv` (filter-repo/BFG + force-push) — breaks clones, possible privacy-notification obligations.
2. **`supabase/config.toml` + CLI link** and `supabase migration repair` for the renamed migration — needs project access and operator action.
3. Renaming `New*` landing components to plain names (cosmetic follow-up).

## Risk register

| Phase | Risk | Key mitigation |
|---|---|---|
| 0-1 | LOW | grep-before-delete; PII purge deferred to user |
| 2 | LOW-MED | rg per basename + `next build` gate |
| 3 | LOW-MED | `--listTests` count check; migration-repair note |
| 4 | LOW-MED | per-group commits; tsc catches every miss |
| 5 | HIGH | factories copy Container wiring verbatim; integration + webhook suites gate 5.4/5.5; cron URLs untouched; corpse deleted only at grep-zero |
| 6 | MED (T5 HIGH) | queries copied verbatim; before/after response capture on money endpoints |
| 7 | LOW | rules text steers future sessions — review carefully |
