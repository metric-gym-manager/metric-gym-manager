# PayHere Free/Pro Subscription — Execution Plan (Repository-Verified)

**Date:** 2026-07-03
**Branch:** `claude/payhere-subscription-implementation-fucodc`
**Status:** Plan only — no feature code is written by this document.

This plan operationalizes `docs/Payhere_subscritption_integration/payhere-subscription-implementation-plan.md`
(the "source plan") and `docs/Payhere_subscritption_integration/payhere-api-reference.md` (the "API reference")
against the **live codebase**. Where the source plan and the repository disagree, the repository and
`.claude/rules/architecture.md` win; every such divergence is recorded in §7 (Risk & Conflict Register) and the
corrected value is used throughout this document.

Inputs read in full before writing: `SYSTEM_MANUAL.md`, `.claude/rules/architecture.md` (+ the on-demand
references in `docs/architecture/`), `FILE_TREE.md`, the PayHere API reference, the source plan, and a direct
inventory of the frontend (`src/components/ui/`, `src/components/layout/`, `src/app/(dashboard)/settings/`,
`src/features/members/`, toast/query conventions).

---

## Table of Contents

1. [Preflight — Discovery Tasks & Captured Values](#1-preflight)
2. [Phased Task Breakdown](#2-phased-task-breakdown)
3. [Dependency Ordering](#3-dependency-ordering)
4. [Per-Phase Acceptance Criteria](#4-per-phase-acceptance-criteria)
5. [UI Surface & User Flows](#5-ui-surface--user-flows)
6. [Test Matrix](#6-test-matrix)
7. [Risk & Conflict Register](#7-risk--conflict-register)
8. [Final Verification Gate](#8-final-verification-gate)

---

## 1. Preflight

Every value below was captured against the working tree on 2026-07-03. The executing agent must **re-run each
command** before Phase DB-1 and treat any drift from the captured value as a stop-and-reconcile event (the
captured value is stale, not wrong-by-definition).

### 1.1 Package manager & scripts

- **Command:** `cat package.json` (scripts block), `ls package-lock.json`
- **Captured:** npm (lockfile `package-lock.json` present). Scripts: `type-check` (`tsc --noEmit`), `lint`
  (`eslint .`), `test` (jest), `test:integration` (`jest --config jest.integration.config.js`), `test:e2e`
  (`playwright test`), `build` (`npm run pwa:generate && next build`). Node >= 18, npm >= 9.

### 1.2 Migration prefix series

- **Command:** `ls supabase/migrations/ | sort | tail -3`
- **Captured:** The live series is **date-encoded**, `YYYYMMDD` + zero-padded sequence, e.g.
  `20260325000001_…`, `20260325000002_…`, current maximum `20260329000001_add_sms_logs_gym_filter_index.sql`.
  It is **not** the `001_`/`002_` short series shown in the stale `FILE_TREE.md`, and it is **not** free-form
  timestamps either — same-day files increment the trailing sequence.
- **Decision (conflict C-1, §7):** the three new migrations use the live convention with the execution date:
  - `20260703000001_create_saas_subscriptions.sql`
  - `20260703000002_saas_subscriptions_rls.sql`
  - `20260703000003_member_count_trigger_and_guarded_insert.sql`

  If execution happens on a different date, substitute that date; keep the three-file split and ordering.
- **Note:** a stray `20260214000000_multi_gym_refactor.sql` sits at the **repo root** (outside
  `supabase/migrations/`); it is not part of the applied series. Do not renumber around it; flag it in Phase
  HY (hygiene) as pre-existing clutter, do not delete it in this feature.

### 1.3 Exact `members` INSERT columns

- **Command:** `grep -n "toDatabase" src/infrastructure/database/repositories/SupabaseMemberRepository.ts`
  and read `supabase/migrations/20260211000002_create_members_table.sql`
- **Captured:** `SupabaseMemberRepository.create()` inserts (id/created_at/updated_at stripped):
  `gym_id, name, phone_number, plan_type, plan_amount, discount_id, recurring_discount, status,
  registered_date, membership_start_date, next_due_date`.
  DB constraints that the guarded function must respect: `phone_number ~ '^\+94[0-9]{9}$'`,
  `plan_amount > 0`, `next_due_date NOT NULL`, `membership_start_date >= registered_date`, enums
  `member_plan_type` / `member_status`. (Emergency-contact columns still exist in the table but were removed
  from the app path by `20260227000001`; the guarded INSERT must not touch them.)

### 1.4 RLS gym-ownership predicate

- **Command:** `cat supabase/migrations/20260211000005_enable_rls_policies.sql`
- **Captured:** the established ownership expression is
  ```sql
  EXISTS (SELECT 1 FROM gyms WHERE gyms.id = <table>.gym_id AND gyms.user_id = auth.uid())
  ```
  plus a helper `is_gym_owner(p_gym_id UUID) RETURNS BOOLEAN SECURITY DEFINER`. New policies in
  `20260703000002` use this exact predicate (or the helper), **not** the source plan's
  `gym_id IN (SELECT id FROM gyms WHERE …)` placeholder.

### 1.5 Shared artifacts and exact signatures (reuse verbatim, never recreate)

| Artifact | Location | Captured signature |
|---|---|---|
| `ResponseBuilder`, `HTTP_STATUS`, `ApiResponse<T>`, `getHttpStatusFromErrorCode` | `src/core/utils/api/ApiResponse.ts` | static `success<T>(data, meta?)`, `error(message, code, details?, stack?)`, `validationError`, `notFound`, `unauthorized`, `forbidden`, `badRequest`, `conflict(message, details?)`, `internalError(message?, stack?)`, `fromError(error)` |
| Domain errors | `src/core/utils/errors/DomainError.ts` (re-exported by `src/core/utils/errors/index.ts`; import as `@/core/utils/errors`) | `ValidationError`, `NotFoundError`, `ConflictError`, `InvalidStatusTransitionError(from, to)`, `ForbiddenError`, `ExternalServiceError(service, message)` — all carry `.code` and `.statusCode`. **Conflict C-2:** source plan cites `src/core/utils/errors.ts` (flat file); real path is the directory module. |
| `CronLogger` | `src/core/utils/cron/CronLogger.ts` (import `@/core/utils/cron`) | `new CronLogger(supabase)`; `logStart(jobName) → Promise<string>`; `logSuccess(logId, summary)`; `logFailure(logId, errors[], summary?)`; `logComplete(logId, status, summary, errors?)` |
| DI container | `src/infrastructure/di/Container.ts`, exported via `@/infrastructure/di` | `class Container { constructor(supabase: SupabaseClient) }` with lazy singleton getters; `getContainer(): Promise<Container>` (session SSR client) and `getAdminContainer(): Promise<Container>` (service-role client) |
| Supabase clients | `src/lib/supabase/server.ts` (`createClient()`, cookie-bound SSR), `src/lib/supabase/admin.ts` (`createAdminClient()`, service role, no session persistence), `src/lib/supabase/client.ts` (browser) | — |
| Auth helper | `src/lib/middleware/auth.ts` | `getCurrentGymProfile()` → selects `id, username, email, email_verified, phone_number, gym_name, gym_address, gym_website, profile_image_url` from `gyms` where `user_id = auth.uid()`; **throws** `Error('Unauthorized')` / `Error('Gym profile not found')`. API routes follow the `src/app/api/members/route.ts` pattern: call it inside try/catch and map the thrown message to `ResponseBuilder.unauthorized()` / 401. (A second helper `getApiGymProfile()` in `src/lib/middleware/api-auth.ts` returns `{gymProfile, error}` tuples — do not mix styles; new routes use `getCurrentGymProfile()`.) |
| Enum-config style template | `src/core/utils/constants/StatusConfig.ts` (TS enum + JSDoc + transition table) | New subscription enums live **beside it**: `src/core/utils/constants/SubscriptionConfig.ts`. **Conflict C-3:** source plan said `src/lib/constants/`; that directory does not exist. |
| Ports layout | `src/core/ports/repositories/*.ts` + `src/core/ports/services/*.ts`, each with `index.ts` barrel | **Conflict C-4:** source plan used flat `src/core/ports/*.ts`; real layout is namespaced. |
| Repository naming | `src/infrastructure/database/repositories/Supabase*Repository.ts` | New repos are `Supabase`-prefixed. |
| Serialization precedent | inline `serializeMemberForAPI` in `src/app/api/members/route.ts`; mandate in `docs/architecture/api-patterns.md` §2.11 | dates `toISOString().split('T')[0]`, dual camelCase + snake_case keys |
| Cron route template | `src/app/api/cron/update-expired-status/route.ts` | Bearer `CRON_SECRET` check → `logStart` → `getAdminContainer()` use case → `logSuccess`/`logFailure` → `ResponseBuilder`; dev-only `GET` manual trigger guarded by `NODE_ENV === 'production'` → 405 |
| Admin route template | `src/app/api/admin/system-health/cron-stats/route.ts` | `ADMIN_API_SECRET` Bearer check **before any DB query**. **Conflict C-5:** existing admin routes hand-roll JSON envelopes; §2.3 mandates `ResponseBuilder` — new admin route uses `ResponseBuilder` (rule wins for new code; existing routes untouched). |
| Constant-time compare | `grep -rn timingSafeEqual src/` → **no existing helper** | Create `src/lib/auth/safeEqual.ts` (Phase GW). Existing cron/admin routes use plain `!==` with a `'dev-secret-key'` fallback — new routes use `safeEqual` and **no fallback secret** (fail closed). |

### 1.6 Tenant schema facts

- **Command:** `cat supabase/migrations/20260211000001_create_gyms_table.sql`; `grep -rn "subscription" supabase/migrations/`
- **Captured:** `gyms` PK `id uuid`, ownership column `user_id uuid → auth.users`. `members.gym_id uuid NOT NULL`.
  **No** `subscription_tier`/`subscription_plan`/`member_count` column exists anywhere (the older
  `docs/TIER_IMPLEMENTATION_PLAN.md` migration `20260415000001_add_entitlements_to_gyms.sql` was never created
  — see conflict C-9). Greenfield for the new columns.

### 1.7 Registration path (quota injection point)

- **Command:** read `src/app/api/members/route.ts` (POST), `src/core/use-cases/member/RegisterMember.ts`,
  `src/core/ports/repositories/IMemberRepository.ts`
- **Captured:** `POST /api/members` → `addMemberSchema.parse` → `container.getRegisterMemberUseCase().execute()`
  → `memberRepo.create(member)` (plain INSERT, then a separate `paymentRepo.create` and fire-and-forget welcome
  SMS). The quota gate is injected by swapping `memberRepo.create` for a guarded RPC (Phase QG). There is also a
  `POST /api/members/bulk` route — it must be inventoried in Phase QG and routed through the same guard
  (one RPC call per member, same lock), otherwise bulk import becomes a quota bypass.

### 1.8 Environment variables

- **Command:** `cat .env.example`
- **Captured (existing, reuse names):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (public base URL — derive `return_url`, `cancel_url`,
  `notify_url` from this), `CRON_SECRET`, `ADMIN_API_SECRET`.
- **New (Phase GW adds to `.env.example` with dummy values):**
  ```bash
  # PayHere (SaaS subscription billing)
  PAYHERE_MODE=sandbox                      # sandbox | live
  PAYHERE_MERCHANT_ID=
  PAYHERE_MERCHANT_SECRET=                  # per-domain; server-side only, never logged
  PAYHERE_PRO_PRICE_LKR=                    # e.g. 4900.00
  # OAuth REST (Subscription Manager — cancel/retry/list). Per API key, domain-whitelisted.
  PAYHERE_APP_ID=
  PAYHERE_APP_SECRET=
  ```
  Base URLs are derived from `PAYHERE_MODE` inside `src/lib/payhere/config.ts`
  (`https://sandbox.payhere.lk` / `https://www.payhere.lk`) rather than four separate URL vars — fewer knobs,
  no sandbox/live mismatch possible.
  **Deployment config (not code):** PayHere dashboard must whitelist the app domain for the Merchant Secret
  and the App ID; **live** REST calls additionally require server IP whitelisting via `support@payhere.lk`.
  Record both in the runbook section of `docs/SAAS_SUBSCRIPTION_IMPLEMENTATION.md` (Phase HY).

### 1.9 Test topology

- **Command:** `cat jest.config.js jest.integration.config.js playwright.config.ts; ls tests`
- **Captured:** unit tests match `src/**/__tests__/**` and `src/**/*.test.*` (jsdom, 70% global coverage
  threshold). Integration tests match `tests/integration/**/*.test.*` (node env) — **directory does not exist
  yet; create it**. Playwright `testDir: ./tests/e2e` — **does not exist yet; create it**; webServer =
  `npm run dev` on :3000. **Conflict C-6:** source plan's `tests/unit/` location is wrong for this repo; unit
  tests go under `src/**/__tests__/`.

### 1.10 Frontend inventory (design system the new UI must reuse)

- **Primitives** (`src/components/ui/`): `alert-dialog`, `badge`, `button`, `calendar`, `card`, `checkbox`,
  `dialog`, `input`, `label`, `progress`, `select` (carries the React-19 `suppressHydrationWarning` fix at
  line 25 — §2.12; never re-patch), `table`, `textarea`, `tooltip`. Icons: `lucide-react`.
- **Layout & nav:** sidebar items in `src/components/layout/Sidebar.tsx` (Dashboard, Members, Revenue, Fee
  Collection, Announcements, **Billing Setup** — note: that is *member* billing config, a naming hazard for
  copy, see conflict C-7 — Settings, Support). Settings sub-nav is the `settingsNavigation` array in
  `src/app/(dashboard)/settings/layout.tsx` (currently Gym Information, Account Security) — the subscription
  page attaches here.
- **Data fetching:** `@tanstack/react-query` via feature hooks (`src/features/members/hooks/*`), services that
  `fetch` and unwrap the `ApiResponse` envelope (`src/features/*/services/*.service.ts`).
- **Toasts:** `sonner` (used across payment-collection components and `src/presentation/hooks/api/*`).
- **Feature-module shape** (mirror `src/features/members/`): `components/`, `hooks/`, `schemas/`, `services/`,
  `types/`, `__tests__/`, `index.ts` public API.
- **Loading/empty/error conventions:** table components render skeleton/spinner (`LoadingSpinner`), explicit
  empty-state rows, and error toasts; forms use React Hook Form + Zod resolvers.

---

## 2. Phased Task Breakdown

Phases are labeled for cross-referencing: **DB** (database), **DM** (domain), **GW** (gateway/crypto),
**RP** (repositories/DI), **UC** (use cases), **QG** (quota gate), **RT** (routes), **SR** (serialization),
**UI** (feature UI), **CR** (cron), **AD** (admin observability), **TS** (tests), **HY** (hygiene).

> **Why this order:** each layer only depends on layers before it (schema → pure domain → pure crypto →
> persistence → orchestration → HTTP → presentation). Tests are written *inside* each phase (TDD,
> `.claude/rules/development.md` §3.1); Phase TS is the consolidation/coverage pass, not the first time tests
> appear.

### Phase DB — Database: schema, RLS, triggers, guarded insert

**Why first:** every other layer types against these columns, and the quota gate's correctness argument is a
Postgres row lock — it cannot be retrofitted.

**File 1 — `supabase/migrations/20260703000001_create_saas_subscriptions.sql`**
Responsibility: tier/status text domains (CHECK-constrained, see C-19), `gyms` subscription columns,
backfill, `checkout_intents`, `saas_payment_logs`.

```sql
-- Tier/status domains as text + CHECK, NOT Postgres enums (conflict C-19):
-- prior product intent (docs/TIER_IMPLEMENTATION_PLAN.md) points at >2 tiers, and
-- ALTER TYPE ... ADD VALUE is non-transactional — it cannot ship in the same
-- transactional migration as dependent DDL. A CHECK constraint swap is transactional.
-- TS mirror: src/core/utils/constants/SubscriptionConfig.ts
ALTER TABLE gyms
  ADD COLUMN subscription_tier       text NOT NULL DEFAULT 'free'
             CHECK (subscription_tier IN ('free','pro')),          -- values = SaasTier
  ADD COLUMN subscription_status     text NOT NULL DEFAULT 'active'
             CHECK (subscription_status IN ('active','past_due','canceled')),  -- values = SaasStatus
  ADD COLUMN payhere_customer_id     text,
  ADD COLUMN payhere_subscription_id text,
  ADD COLUMN current_period_end      timestamptz,
  ADD COLUMN member_count            integer     NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX idx_gyms_payhere_subscription_id
  ON gyms (payhere_subscription_id) WHERE payhere_subscription_id IS NOT NULL;

-- Backfill the denormalized counter from live data
UPDATE gyms g SET member_count = (SELECT count(*) FROM members m WHERE m.gym_id = g.id);

-- order_id → gym resolution for webhooks (a notification alone cannot be attributed)
CREATE TABLE checkout_intents (
  order_id        text          PRIMARY KEY,
  gym_id          uuid          NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  target_tier     text          NOT NULL CHECK (target_tier IN ('free','pro')),  -- values = SaasTier
  expected_amount numeric(12,2) NOT NULL,
  currency        text          NOT NULL DEFAULT 'LKR',
  status          text          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','completed','failed','expired')),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  expires_at      timestamptz   NOT NULL
);
-- at most one live pending intent per gym → concurrent double-checkout hits 23505
CREATE UNIQUE INDEX idx_checkout_intents_one_pending_per_gym
  ON checkout_intents (gym_id) WHERE status = 'pending';

-- SaaS billing audit log. Named saas_payment_logs to avoid the member `payments` table.
CREATE TABLE saas_payment_logs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                  uuid        REFERENCES gyms(id) ON DELETE SET NULL,
  order_id                text,
  payhere_payment_id      text,                -- NULL allowed: invalid-signature/garbage posts may omit it
  payhere_subscription_id text,
  status_code             integer     NOT NULL,
  message_type            text,                -- e.g. RECURRING_INSTALLMENT_FAILED (C-22 classification)
  status_message          text,                -- PayHere's failure reason, verbatim (admin-only surface)
  signature_valid         boolean     NOT NULL,
  raw_payload             jsonb       NOT NULL,
  processed_at            timestamptz NOT NULL DEFAULT now()
);
-- idempotency anchor (partial unique: NULL ids from invalid posts must not collide)
CREATE UNIQUE INDEX idx_saas_payment_logs_payment_id
  ON saas_payment_logs (payhere_payment_id) WHERE payhere_payment_id IS NOT NULL;
CREATE INDEX idx_saas_payment_logs_failures
  ON saas_payment_logs (processed_at) WHERE status_code < 2 OR signature_valid = false;
-- C-20 cap counter: predicate matches the cap query EXACTLY so the hourly count is a true
-- index-only scan even mid-flood. The broader failures index above cannot serve it: its OR
-- predicate would either force heap filtering on signature_valid or (if the cap query adopted
-- the OR predicate) make legitimately-signed failed payments count against the invalid-sig cap.
CREATE INDEX idx_saas_payment_logs_invalid_sig
  ON saas_payment_logs (processed_at) WHERE signature_valid = false;
CREATE INDEX idx_saas_payment_logs_gym ON saas_payment_logs (gym_id, processed_at DESC);
```

*Refinement over the source plan (conflict C-8):* `payhere_payment_id` is nullable with a partial unique
index. The source plan's `NOT NULL UNIQUE` would make the mandated "log invalid-signature posts" step
impossible for payloads that omit the field, forcing either fabricated ids or dropped audit rows.
`raw_payload` for invalid-signature rows must be stored with the `md5sig` field **redacted** (invariant: the
signature never appears in logs).

*Consequence of the nullable id (conflict C-20):* null-id audit rows bypass the `insertIfNew` dedup, so a
flood of forged payloads to the public webhook would be unbounded write amplification. `insertInvalid`
therefore enforces a cap before writing: one indexed count over the last hour
(`WHERE signature_valid = false AND processed_at > now() - interval '1 hour'`, served **index-only** by the
exact-predicate `idx_saas_payment_logs_invalid_sig`); at or beyond `INVALID_WEBHOOK_LOG_HOURLY_CAP` it skips
the insert and emits a single `console.warn` — the route still returns 200 (never leak validation behavior
to a prober). The guard query stays cheap under the very flood it defends against: beyond the cap nothing is
inserted, so the scanned index range is bounded at ~cap entries per hour. The cap is **global, not
per-gym/per-order** — the attacker controls `order_id`/`custom_1` and would shard a scoped cap into
unlimited writes. Legitimate signed traffic (including signed failed payments) never counts against it. Edge-level rate limiting on `/api/webhooks/payhere` (Vercel WAF /
middleware token bucket) is recommended defense-in-depth but is deployment config, not a code dependency.

**File 2 — `supabase/migrations/20260703000002_saas_subscriptions_rls.sql`**
Responsibility: RLS on both new tables using the repo's real predicate (§1.4) and the `cron_logs`
service-role pattern.

```sql
ALTER TABLE checkout_intents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_payment_logs ENABLE ROW LEVEL SECURITY;

-- Service role: full access (checkout creation, webhook, cron all run under service role)
CREATE POLICY "Service role full access checkout_intents"
  ON checkout_intents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access saas_payment_logs"
  ON saas_payment_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gym owners: read-only billing history for their own gym (mirrors 20260211000005 predicate)
CREATE POLICY "Gym owners can view own saas payment logs"
  ON saas_payment_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM gyms
    WHERE gyms.id = saas_payment_logs.gym_id AND gyms.user_id = auth.uid()
  ));
-- No gym-owner policy on checkout_intents: it is server-side plumbing, invisible to the dashboard.
```

The new `gyms` columns inherit the existing `"Gym owners can view own gym"` SELECT policy (verified in
`20260211000005`) — the dashboard can read them with the session client. They also inherit the owner
**UPDATE** policy, and RLS is row-level only: a malicious owner with raw PostgREST access could
`UPDATE gyms SET subscription_tier='pro'` (or `member_count=0`, defeating the quota) on their own row.
Mitigation (include in migration 2): a `BEFORE UPDATE` trigger `prevent_subscription_self_update`:

```sql
CREATE OR REPLACE FUNCTION prevent_subscription_self_update() RETURNS trigger
LANGUAGE plpgsql AS $$   -- SECURITY INVOKER on purpose: current_user must reflect the caller chain
BEGIN
  -- PostgREST executes SET ROLE from the JWT, so current_user is the reliable signal.
  -- Allow-list by privilege — FAILS CLOSED: only 'postgres' (migrations, backfills,
  -- SECURITY DEFINER function bodies, dashboard SQL) and 'service_role' (the app's
  -- admin-client writes: webhook, cron, billing repos) may touch these columns.
  -- Every unenumerated role — anon, authenticated, custom roles, future renames,
  -- direct non-postgres logins — is rejected. A block-list of ('anon','authenticated')
  -- would fail OPEN for any role not on the list.
  IF current_user NOT IN ('postgres', 'service_role') AND (
       NEW.subscription_tier       IS DISTINCT FROM OLD.subscription_tier
    OR NEW.subscription_status     IS DISTINCT FROM OLD.subscription_status
    OR NEW.payhere_customer_id     IS DISTINCT FROM OLD.payhere_customer_id
    OR NEW.payhere_subscription_id IS DISTINCT FROM OLD.payhere_subscription_id
    OR NEW.current_period_end      IS DISTINCT FROM OLD.current_period_end
    OR NEW.member_count            IS DISTINCT FROM OLD.member_count
  ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_COLUMNS_READONLY';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_subscription_self_update
BEFORE UPDATE ON gyms FOR EACH ROW EXECUTE FUNCTION prevent_subscription_self_update();
```

Role-signal notes the executor must not deviate from: (a) `member_count` **is** protected — it is the quota
source read under `FOR UPDATE`; (b) both legitimate write paths resolve to an allow-listed role:
`sync_gym_member_count()` and `register_member_guarded()` are SECURITY DEFINER, so inside them
`current_user` is the function owner (`postgres`); webhook/cron/billing repository writes run as
`service_role` via the admin client; migrations/backfills run as `postgres`. Note `'postgres'` alone would
**not** suffice as the allow-list — the app's direct column writes are `service_role`, not definer-mediated.
(c) Do not key off `current_setting('request.jwt.claims', …)` — it is absent on direct connections and would
make the guard fail-open there. (d) The allow-list deliberately fails **closed**: if a Supabase
infrastructure role or a future custom role ever legitimately needs these columns, it surfaces as a loud
exception to be added explicitly, never as a silent bypass. This closes the gap at the database layer,
matching the repo's defense-in-depth stance (`.claude/rules/security.md` Layer 1).

**File 3 — `supabase/migrations/20260703000003_member_count_trigger_and_guarded_insert.sql`**
Responsibility: counter maintenance trigger, the single quota authority `register_member_guarded`, and the
server-clock persistence RPC `save_gym_subscription`. Full final SQL (self-contained — the executor copies
this, not the source plan):

```sql
-- 1. Denormalized member counter (SECURITY DEFINER: writes gyms regardless of inserter's RLS)
CREATE OR REPLACE FUNCTION sync_gym_member_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE gyms SET member_count = member_count + 1 WHERE id = NEW.gym_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE gyms SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.gym_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_gym_member_count
AFTER INSERT OR DELETE ON members
FOR EACH ROW EXECUTE FUNCTION sync_gym_member_count();

-- 2. The ONLY member-quota authority. The gyms row lock is the per-tenant mutex:
--    concurrent registrations serialize here, which is what makes limit-1 races impossible.
CREATE OR REPLACE FUNCTION register_member_guarded(p_gym_id uuid, p_member jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  g       RECORD;
  allowed boolean := false;
  new_id  uuid;
BEGIN
  SELECT subscription_tier, subscription_status, member_count, current_period_end
    INTO g FROM gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;

  -- Allowance matrix — MUST mirror Subscription.canAddMember (SubscriptionConfig.ts)
  IF g.subscription_tier = 'pro' THEN
    IF g.subscription_status = 'active' THEN
      allowed := true;
    ELSIF g.subscription_status = 'past_due' THEN
      -- 7 = GRACE_PERIOD_DAYS (SubscriptionConfig.ts)
      allowed := (g.current_period_end IS NOT NULL
                  AND now() <= g.current_period_end + (interval '1 day' * 7));
    ELSIF g.subscription_status = 'canceled' THEN
      -- voluntary cancel: paid-through until period end, NO grace (plan §2 Phase DM)
      allowed := (g.current_period_end IS NOT NULL AND now() <= g.current_period_end);
    END IF;
  ELSE
    -- 50 = FREE_TIER_MEMBER_LIMIT (SubscriptionConfig.ts)
    allowed := (g.member_count < 50);
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'MEMBER_LIMIT_REACHED'; END IF;

  -- Column list = exact live members INSERT surface (preflight §1.3)
  INSERT INTO members (
    gym_id, name, phone_number, plan_type, plan_amount, discount_id,
    recurring_discount, status, registered_date, membership_start_date, next_due_date
  )
  VALUES (
    p_gym_id,
    p_member->>'name',
    p_member->>'phone_number',
    (p_member->>'plan_type')::member_plan_type,
    (p_member->>'plan_amount')::numeric,
    NULLIF(p_member->>'discount_id','')::uuid,
    COALESCE((p_member->>'recurring_discount')::boolean, false),
    COALESCE(NULLIF(p_member->>'status','')::member_status, 'active'),
    COALESCE(NULLIF(p_member->>'registered_date','')::date, CURRENT_DATE),
    COALESCE(NULLIF(p_member->>'membership_start_date','')::date, CURRENT_DATE),
    (p_member->>'next_due_date')::date
  )
  RETURNING id INTO new_id;  -- AFTER trigger increments member_count in this same transaction

  RETURN new_id;
END;
$$;

-- 3. Server-clock subscription persistence (item-3 fix): supabase-js .update() cannot express
--    SQL expressions, so `current_period_end = now() + interval '1 month'` MUST go through an
--    RPC. SupabaseGymSubscriptionRepository.save() calls this — never JS date math (C-18/C-23).
CREATE OR REPLACE FUNCTION save_gym_subscription(
  p_gym_id                  uuid,
  p_tier                    text,     -- SaasTier value; CHECK on gyms re-validates
  p_status                  text,     -- SaasStatus value
  p_payhere_subscription_id text,     -- NULL clears (downgrade)
  p_payhere_customer_id     text,
  p_extend_period           boolean   -- true on activate/renew: period anchors at now()
) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period_end timestamptz;
BEGIN
  UPDATE gyms SET
    subscription_tier       = p_tier,
    subscription_status     = p_status,
    payhere_subscription_id = p_payhere_subscription_id,
    payhere_customer_id     = p_payhere_customer_id,
    current_period_end      = CASE WHEN p_extend_period
                              THEN now() + interval '1 month'  -- PRO_BILLING_RECURRENCE (SubscriptionConfig.ts)
                              ELSE current_period_end END
  WHERE id = p_gym_id
  RETURNING current_period_end INTO v_period_end;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  RETURN v_period_end;
END;
$$;

-- Both RPCs are service-role-only: the API layer authenticates the caller and pins gym_id
-- BEFORE invoking; direct PostgREST callers must not reach these.
REVOKE ALL ON FUNCTION register_member_guarded(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION save_gym_subscription(uuid, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_member_guarded(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION save_gym_subscription(uuid, text, text, text, text, boolean) TO service_role;
```

*Why `pro/canceled` appears here:* the mandated first-class cancel flow (§2 Phase UC-4) keeps Pro
entitlements until period end; the DB gate must encode that or cancel would instantly strand gyms over 50
members. This is an intentional extension of the source plan's two-branch matrix.

**Apply & verify:** `npx supabase migration up` (or dashboard SQL). See §4 for acceptance.

### Phase DM — Domain: constants + `Subscription` entity

**File — `src/core/utils/constants/SubscriptionConfig.ts`** (beside `StatusConfig.ts`, matching its
enum-plus-docs style):

```ts
import { z } from 'zod';

export enum SaasTier { Free = 'free', Pro = 'pro' }
export enum SaasStatus { Active = 'active', PastDue = 'past_due', Canceled = 'canceled' }

export const FREE_TIER_MEMBER_LIMIT = 50;
export const GRACE_PERIOD_DAYS = 7;
export const PRO_BILLING_RECURRENCE = '1 Month';  // PayHere `recurrence`
export const PRO_BILLING_DURATION = 'Forever';    // PayHere `duration`
export const CHECKOUT_INTENT_TTL_MINUTES = 30;
export const PAYMENT_POLL_TIMEOUT_MS = 10_000;
export const PAYMENT_POLL_INTERVAL_MS = 1_500;
export const INVALID_WEBHOOK_LOG_HOURLY_CAP = 100; // bound on signature-invalid audit rows/hour (C-20)

/** Coarse decline classification (C-22). PayHere exposes no card-network decline codes —
 *  only status_code + message_type + free-text status_message — so classification is
 *  capture-first and deliberately two-valued until real gateway data justifies more. */
export enum RecurringFailureClass {
  Retriable = 'retriable', // -2 installment failed: PayHere retries; UX = "ensure funds"
  Hard = 'hard',           // -3 chargedback, -1 canceled, RECURRING_STOPPED: no retry coming
}
export const recurringFailureClassSchema = z.nativeEnum(RecurringFailureClass);

// §2.2: validation layer reuses the domain enum — never a duplicate z.enum list
export const saasTierSchema = z.nativeEnum(SaasTier);
export const saasStatusSchema = z.nativeEnum(SaasStatus);
```

**File — `src/core/domain/subscription/Subscription.ts`**
Immutable entity over the `gyms` subscription columns, in the style of `Member.ts`: private constructor,
`static create(props)`, guarded transition methods throwing `InvalidStatusTransitionError`, and a
non-transition `renew` (§2.5.1, same pattern as `Member.renew`).

State model — five legal `(tier, status)` pairs and their moves (this **extends** the source plan's matrix to
carry the mandated cancel flow):

| From | Method | To | Trigger |
|---|---|---|---|
| `free/active`, `free/canceled` | `activatePro({periodEnd, subscriptionId, customerId})` | `pro/active` | first checkout success / re-subscription after downgrade |
| `pro/canceled` | `activatePro(...)` | `pro/active` | re-subscription after voluntary cancel (new PayHere `subscription_id` replaces the old) |
| `pro/active`, `pro/past_due` | `renew({periodEnd})` — **non-transition** | status `active`, period extended | recurring installment success (recovers past_due) |
| `pro/active` | `markPastDue()` | `pro/past_due` | recurring installment failure — grace begins |
| `pro/active`, `pro/past_due` | `cancelPro()` | `pro/canceled` | voluntary cancel confirmed at gateway; keeps `currentPeriodEnd` |
| `pro/past_due` (grace expired), `pro/canceled` (period ended) | `downgradeToFree()` | `free/canceled` | dunning cron; clears `payhereSubscriptionId`; **members untouched** |

Pinned signatures (executor implements exactly these — no improvisation):

```ts
export interface SubscriptionProps {
  gymId: string;
  tier: SaasTier;
  status: SaasStatus;
  memberCount: number;
  currentPeriodEnd: Date | null;
  payhereCustomerId: string | null;
  payhereSubscriptionId: string | null;
}

export class Subscription {
  static create(props: SubscriptionProps): Subscription;
  get gymId(): string;
  get tier(): SaasTier;
  get status(): SaasStatus;
  get memberCount(): number;
  get currentPeriodEnd(): Date | null;
  get payhereCustomerId(): string | null;
  get payhereSubscriptionId(): string | null;
  toProps(): SubscriptionProps;                      // defensive copy
  activatePro(input: { subscriptionId: string | null; customerId: string | null }): Subscription;
  renew(): Subscription;                             // §2.5.1 non-transition; period set by save RPC
  markPastDue(): Subscription;
  cancelPro(): Subscription;
  downgradeToFree(): Subscription;
  canAddMember(now: Date): boolean;
  isGraceExpired(now: Date): boolean;
  isPaidThrough(now: Date): boolean;
  graceEndsAt(): Date | null;                        // currentPeriodEnd + GRACE_PERIOD_DAYS when past_due
}
```

Note `activatePro`/`renew` no longer take a `periodEnd` — the period is computed server-side by the
`save_gym_subscription` RPC (`extendPeriod: true`); the entity carries intent, the database owns the clock.
`currentPeriodEnd` on a freshly transitioned in-memory entity is therefore stale-until-saved; the repo's
`save` returns a `Subscription` rebuilt with the RPC's returned `current_period_end`.

Guard details that must be enforced (and unit-tested):
- `activatePro` **rejects** `pro/active` and `pro/past_due` (already subscribed; past_due recovery arrives via
  `renew` on the existing subscription, not a second checkout).
- `renew` requires tier `Pro` **and** status `Active | PastDue`. A stale installment event on `pro/canceled`
  must *not* silently un-cancel — the webhook use case treats it as log-only (`STALE_EVENT`).
- `markPastDue` only from `pro/active` (a failure on `past_due` is already-known; log-only).
- Query helpers: `canAddMember(now)` (mirror of the SQL matrix in Phase DB file 3), `isGraceExpired(now)`,
  `isPaidThrough(now)`, `graceEndsAt` (derived `currentPeriodEnd + GRACE_PERIOD_DAYS`).

**File — `src/core/domain/subscription/classifyRecurringFailure.ts`** (C-22): pure function
`(statusCode: number, messageType: string | null) → RecurringFailureClass` — `-2` /
`RECURRING_INSTALLMENT_FAILED` → `Retriable`; `-1`, `-3`, `RECURRING_STOPPED` → `Hard`; default `Hard`
(fail pessimistic). The dunning discipline the industry sources demand (retry-tactic branching per decline
code) is mostly PayHere's job — it owns retry scheduling — but the **recovery UX** must still branch:
"PayHere will retry, ensure funds" vs "no retry is coming, re-subscribe". Capture-first: the class is
persisted with every failure log and surfaced (sanitized) to the banner; finer-grained mapping waits for
observed `status_message` data rather than guessing a taxonomy PayHere doesn't publish.

Tests first (TDD): `src/core/__tests__/domain/subscription/Subscription.test.ts` — full matrix, see §6.

### Phase GW — PayHere config, crypto, gateways

**File — `src/lib/payhere/config.ts`**: `getPayhereConfig(): PayhereConfig` — **lazy, cached** Zod parse of
`process.env` on first call (not module load: module-load throwing breaks Jest suites that import consumers
without billing env; lazy keeps unit tests hermetic via `process.env` stubs + cache reset helper
`__resetPayhereConfigForTests()`). Throws naming every missing var. Exposes `mode`, `merchantId`,
`merchantSecret`, `proPriceLkr`, `checkoutUrl` (mode-derived `…/pay/checkout`), `restBaseUrl`
(mode-derived), `appId`, `appSecret`, and the callback URLs built from `NEXT_PUBLIC_APP_URL`:
- `returnUrl = ${APP_URL}/settings/billing?order={orderId}` (appended by the gateway)
- `cancelUrl = ${APP_URL}/settings/billing?canceled=1`
- `notifyUrl = ${APP_URL}/api/webhooks/payhere` — must be publicly reachable (API reference: no localhost);
  document the sandbox tunneling requirement in the runbook.

**File — `src/lib/payhere/crypto.ts`** — final code (self-contained; the executor copies this):

```ts
import { createHash, timingSafeEqual } from 'crypto';

const md5Upper = (s: string): string =>
  createHash('md5').update(s, 'utf8').digest('hex').toUpperCase();

/** Mirrors PHP number_format(x, 2, '.', '') — two decimals, no thousands separator. */
export const formatAmount = (n: number): string => n.toFixed(2);

/** Outbound: UPPER(md5(merchant_id + order_id + amount(2dp) + currency + UPPER(md5(secret)))) */
export function generateCheckoutHash(
  merchantId: string, merchantSecret: string,
  orderId: string, amount: number, currency: string
): string {
  return md5Upper(merchantId + orderId + formatAmount(amount) + currency + md5Upper(merchantSecret));
}

/** Inbound: recompute over the RAW received strings — never re-parse/re-format payhere_amount
 *  or status_code. Constant-time compare with length guard. */
export function verifyNotificationSignature(
  merchantSecret: string,
  f: { merchant_id: string; order_id: string; payhere_amount: string;
       payhere_currency: string; status_code: string; md5sig: string }
): boolean {
  if (!f.md5sig) return false;
  const local = md5Upper(
    f.merchant_id + f.order_id + f.payhere_amount + f.payhere_currency +
    f.status_code + md5Upper(merchantSecret)
  );
  const a = Buffer.from(local);
  const b = Buffer.from(f.md5sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

(Secrets are passed in, not imported — keeps the module pure and unit-testable without env.) Node `crypto`
only ⇒ every consumer route declares `export const runtime = 'nodejs'`.

**File — `src/lib/auth/safeEqual.ts`**: `safeEqual(a: string, b: string): boolean` via `timingSafeEqual`
with length check. Used by the new cron and admin routes for Bearer secrets (§1.5 last row).

**File — `src/core/ports/services/IPaymentGateway.ts`** (barrel-exported from
`src/core/ports/services/index.ts`):

```ts
export interface CheckoutRedirect { checkoutUrl: string; params: Record<string, string>; }
export interface IPaymentGateway {
  buildCheckoutRedirect(input: {
    orderId: string; amount: number; currency: 'LKR'; gymId: string;
    customer: { firstName: string; lastName: string; email: string;
                phone: string; address: string; city: string };
  }): CheckoutRedirect;
  verifyNotificationSignature(fields: Record<string, string>): boolean;
}
```

**File — `src/core/ports/services/ISubscriptionGateway.ts`** *(new — closes the cancel gap)*:

```ts
export interface ISubscriptionGateway {
  /** POST /merchant/v1/subscription/cancel. Resolves on success OR already-cancelled (idempotent). */
  cancelSubscription(payhereSubscriptionId: string): Promise<void>;
  /** GET /merchant/v1/subscription/{id}/payments — admin-side reconciliation only (not the UI source). */
  listSubscriptionPayments(payhereSubscriptionId: string): Promise<unknown[]>;
}
```

**File — `src/infrastructure/payments/PayHereGateway.ts`** implements `IPaymentGateway`:
`buildCheckoutRedirect` assembles the Recurring-checkout field set — required Checkout params +
`recurrence = PRO_BILLING_RECURRENCE`, `duration = PRO_BILLING_DURATION`, `items = 'Pro Plan — Monthly'`,
`amount = formatAmount(proPriceLkr)`, `currency = 'LKR'`, `country = 'Sri Lanka'`, `custom_1 = gymId`
(webhook resolution fallback), `hash = generateCheckoutHash(...)`, and the three callback URLs. The Merchant
Secret never leaves this module; the returned `params` contain only what PayHere's form needs.

**File — `src/infrastructure/payments/PayHereSubscriptionGateway.ts`** implements `ISubscriptionGateway`:
- OAuth token flow per the API reference: `POST {restBaseUrl}/merchant/v1/oauth/token` with
  `Authorization: Basic base64(appId:appSecret)`, body `grant_type=client_credentials`; caches
  `{ token, expiresAt }` in a module-scoped variable and refreshes only when expired (tokens live ~10 min —
  per-request fetching would triple latency and hammer the token endpoint).
- `cancelSubscription`: `POST /merchant/v1/subscription/cancel` `{ subscription_id }` with Bearer token.
  Top-level `status === 1` → resolve. `status === -1` with an already-cancelled/completed `msg` → resolve
  (idempotent semantics so a retried user click is not an error). Anything else (including `-2` auth errors,
  network faults) → throw `ExternalServiceError('PayHere', msg)` — the route maps this to 502-style
  `internalError` and the local state is **not** changed (gateway remains authoritative).

Unit tests first: crypto vectors (see §6) and gateway param assembly with an injected fake config.

### Phase RP — Ports (repositories), Supabase implementations, DI

**Ports** (in `src/core/ports/repositories/`, added to the barrel):

- `IGymSubscriptionRepository.ts` — pinned:

  ```ts
  export interface IGymSubscriptionRepository {
    findByGymId(gymId: string): Promise<Subscription | null>;
    findByPayhereSubscriptionId(payhereSubscriptionId: string): Promise<Subscription | null>;
    /** Persists tier/status/ids via the save_gym_subscription RPC (migration 3). extendPeriod:true
     *  anchors current_period_end = now() + 1 month ON THE DATABASE CLOCK — supabase-js .update()
     *  cannot express SQL expressions, hence the RPC; JS date math is forbidden here (C-18/C-23).
     *  Returns the entity rebuilt with the RPC's returned current_period_end. */
    save(sub: Subscription, opts: { extendPeriod: boolean }): Promise<Subscription>;
  }
  ```
- `ICheckoutIntentRepository.ts` — pinned:

  ```ts
  export interface CheckoutIntent {
    orderId: string; gymId: string; targetTier: SaasTier;
    expectedAmount: number; currency: string;
    status: 'pending' | 'completed' | 'failed' | 'expired';
    expiresAt: Date;
  }
  export interface ICheckoutIntentRepository {
    /** throws ConflictError on the one-pending-per-gym partial unique index (23505) */
    createPending(intent: Omit<CheckoutIntent, 'status'>): Promise<CheckoutIntent>;
    findPendingByOrderId(orderId: string): Promise<CheckoutIntent | null>;
    markStatus(orderId: string, status: CheckoutIntent['status']): Promise<void>;
    expireStale(now: Date): Promise<number>;
  }
  ```
- `ISaasPaymentLogRepository.ts` — `insertIfNew(input): Promise<boolean>` (false on duplicate
  `payhere_payment_id` → idempotency), `insertInvalid(input)` (signature-invalid/unattributed rows; never
  throws; enforces the `INVALID_WEBHOOK_LOG_HOURLY_CAP` hourly cap — C-20), `listFailures(limit, offset)`, `listByGym(gymId, page, limit)` (billing-history UI, typed rows —
  no `unknown[]`; conflict C-10 refines the source plan's `listFailures(): Promise<unknown[]>`), and
  `findLatestFailure(gymId): Promise<SaasPaymentLogRow | null>` (feeds the serializer's `pastDueReason`,
  C-22). The insert input carries `messageType` and `statusMessage` (promoted columns, not just
  `raw_payload`), so classification is queryable.

**Implementations** (in `src/infrastructure/database/repositories/`, `Supabase` prefix per §1.5):
`SupabaseGymSubscriptionRepository.ts`, `SupabaseCheckoutIntentRepository.ts`,
`SupabaseSaasPaymentLogRepository.ts`. All take the `SupabaseClient` from the container constructor (the
existing pattern); Postgres error `23505` is translated to `ConflictError` (intents) or `false` (payment
logs). Typed row interfaces, zero `any` (§2.2). **C-19 corollary:** with the DB domains now `text + CHECK`,
`z.nativeEnum` plus these repo signatures carry the application-layer enforcement — every tier/status
parameter and row-mapping in the repos is typed as `SaasTier`/`SaasStatus` (never `string`), values always
originate from `Subscription` entity props or a parsed schema, and the **only** raw string literals for
these domains live in CHECK-guarded SQL (`register_member_guarded`, dunning UPDATEs) with their
`SubscriptionConfig.ts` back-reference comments.

**DI** (`src/infrastructure/di/Container.ts`, mirroring the existing lazy-getter style):
`getGymSubscriptionRepository()`, `getCheckoutIntentRepository()`, `getSaasPaymentLogRepository()`,
`getPaymentGateway()`, `getSubscriptionGateway()`, `getGenerateCheckoutUrlUseCase()`,
`getHandlePayHereWebhookUseCase()`, `getCancelSubscriptionUseCase()`, `getProcessDunningUseCase()`.

**Client discipline:** all four billing routes (checkout, cancel, webhook, dunning) obtain the container via
`getAdminContainer()` — the webhook and cron have no session at all, and checkout/cancel must write
`checkout_intents`/`gyms` columns that RLS deliberately hides from the session role. **Authentication still
happens first** via `getCurrentGymProfile()` in the JWT routes; the admin client is used only after the
caller's gym identity is established, the same trust pattern the repo already uses for registration. The
read-only `GET /api/settings/subscription` and `GET /api/billing/history` use the **session** client so RLS
does the tenant scoping (defense in depth, zero chance of cross-tenant leak by code bug).

### Phase UC — Use cases (`src/core/use-cases/subscription/`)

**UC-1 `GenerateCheckoutUrl.ts`** — injects `IGymSubscriptionRepository`, `ICheckoutIntentRepository`,
`IPaymentGateway`. `execute({ gymId, customer })`:
1. Load subscription; throw `ConflictError('Already subscribed')` if `pro/active` **or** `pro/past_due`
   (past_due must recover via PayHere retry / dunning, not a parallel second subscription — otherwise the gym
   ends up double-billed under two `subscription_id`s). `pro/canceled` and `free/*` may proceed.
2. `orderId = 'SUB-' + gymId + '-' + Date.now()`.
3. `createPending({orderId, gymId, targetTier: SaasTier.Pro, expectedAmount: config.proPriceLkr,
   currency: 'LKR', expiresAt: now + CHECKOUT_INTENT_TTL_MINUTES})` — a concurrent second call dies on the
   partial unique index as `ConflictError`; let it propagate (the route maps it to 409).
4. Return `gateway.buildCheckoutRedirect(...)`.

**UC-2 `HandlePayHereWebhook.ts`** — synchronous and idempotent; injects the three repos + subscription repo.
Executed only **after** the route has verified `md5sig`. `execute(fields, rawPayload)` returns a
`WebhookOutcome` TS enum (`PROVISIONED | RENEWED | MARKED_PAST_DUE | RECONCILED_CANCELED | LOGGED_PENDING |
AMOUNT_MISMATCH | ALREADY_PROCESSED | UNRESOLVED | STALE_EVENT | LOGGED_ONLY`):
1. **Resolve gym**, in order: pending intent by `order_id` → subscription by `subscription_id` → `custom_1`
   as gymId (verify the gym exists). None → `insertInvalid`-style log with `gym_id = NULL`, outcome
   `UNRESOLVED`, done.
2. **Idempotency**: `insertIfNew({... payherePaymentId ...})` — `false` → `ALREADY_PROCESSED`, no state
   change. This single row is why PayHere's at-least-once redelivery is safe.
3. **Branch on integer `status_code`** (never on `message_type` alone — the signature covers `status_code`):
   - `2` (success): intent-driven → assert `formatAmount(raw payhere_amount) === formatAmount(expectedAmount)`;
     mismatch → intent `failed`, outcome `AMOUNT_MISMATCH`, **no provisioning** (a tampered client could
     otherwise buy Pro for 1 LKR — the signature validates integrity of what PayHere saw, not that the amount
     is the price). Then: current sub Free or `pro/canceled` → `activatePro`; `pro/active|past_due` → `renew`
     **subject to the identity guard below**. `save({extendPeriod: true})`; intent → `completed`.
   - `0` (pending): log only → `LOGGED_PENDING`.
   - `-1 | -2 | -3`: initial activation (intent pending, gym Free) → intent `failed`, stay Free. Recurring on
     `pro/active` → `markPastDue` + save (grace starts; **no downgrade here** — only the dunning cron
     downgrades, on the server clock). On `pro/past_due` → already known, `LOGGED_ONLY`. On `pro/canceled` →
     `STALE_EVENT`.
   - **Subscription-identity guard (C-21) — applies to every non-intent, state-mutating branch** (`renew`,
     `markPastDue`, cancel reconciliation): the event's `subscription_id` must equal the gym's stored
     `payhereSubscriptionId`; on mismatch (or when the gym was resolved only via `custom_1` and carries a
     different/NULL stored id) → `STALE_EVENT`, log-only. Why: after cancel + re-subscribe, the gym's row
     holds the **new** subscription B while PayHere may still deliver late events for the replaced
     subscription A. Without this guard, a late `RECURRING_STOPPED` for A would fall through the
     `subscription_id` lookup (A is no longer stored), resolve the gym via `custom_1`, and wrongly cancel B —
     and a late installment success for A would wrongly extend B's period. Intent-driven activations are
     exempt: they are the moment the stored id is (re)established.
   - **Cancel reconciliation:** independent of the status-code branch, if `message_type =
     'RECURRING_STOPPED'` or `item_rec_status = '-1'`, the identity guard passes, and the local sub is still
     `pro/active|past_due` → apply `cancelPro()` + save, outcome `RECONCILED_CANCELED`. This is the mandated
     authoritative-state reconciliation: the gateway said this subscription is dead (whether we initiated it
     or PayHere/customer-side did), so local state follows. It is idempotent: if the state already matches
     (`pro/canceled` from UC-4, or a replayed event) the guard chain yields `STALE_EVENT`/`ALREADY_PROCESSED`
     and nothing is written.
   - **Period anchor on recovery (C-23):** every successful charge — first activation, on-time renewal, or
     `past_due` recovery — sets `current_period_end = now() + interval '1 month'` in the repo's SQL, i.e.
     anchored at the **successful-charge processing date**, never `old current_period_end + 1 month`. A gym
     that fails on the 1st and recovers on the 9th is paid through the 9th of next month; re-anchoring at
     the stale boundary would silently shorten the period they just paid for (the industry "recovery
     restores access but not the billing math" failure). PayHere's `item_rec_date_next` is **captured in
     `raw_payload` but never used for period math**: it is outside the `md5sig`-signed field set (see C-24),
     and the plan's single-clock principle keeps all period arithmetic on the server. If observed gateway
     schedules drift from the local period, that surfaces in admin reconciliation
     (`listSubscriptionPayments`), not in automatic trust of an unsigned field.
   - **Failure classification capture (C-22):** every log insert persists `message_type` and
     `status_message` verbatim; UC-2 computes `classifyRecurringFailure(...)` for the outcome it returns but
     takes no class-dependent state action yet — the class drives UX copy (Phase SR/UI) and admin triage
     only.

**Normative guard-chain order** — the executor implements exactly this sequence; re-ordering any step
re-opens a closed hole (resolution before idempotency so duplicates are attributed; idempotency before any
state mutation; identity guard before every non-intent mutation):

```
execute(fields, rawPayload):
  intent = checkoutIntentRepo.findPendingByOrderId(fields.order_id)          # 1. resolve gym
  sub    = intent ? subRepo.findByGymId(intent.gymId)
         : fields.subscription_id ? subRepo.findByPayhereSubscriptionId(fields.subscription_id)
         : null
  if !sub and fields.custom_1: sub = subRepo.findByGymId(fields.custom_1)    # fallback, unsigned (C-24)
  if !sub:
    logRepo.insertIfNew({gymId: null, ...fields})                            # audit, unattributed
    return UNRESOLVED

  inserted = logRepo.insertIfNew({gymId, orderId, payherePaymentId,          # 2. idempotency anchor
              payhereSubscriptionId, statusCode, signatureValid: true,
              messageType, statusMessage, rawPayload})
  if !inserted: return ALREADY_PROCESSED                                     # replay → no state change

  idMatches = intent != null                                                 # 3. identity guard (C-21)
           or (fields.subscription_id and fields.subscription_id == sub.payhereSubscriptionId)

  if fields.message_type == 'RECURRING_STOPPED' or fields.item_rec_status == '-1':   # 4. reconcile cancel
    if idMatches and sub.status in (Active, PastDue) and sub.tier == Pro:
      subRepo.save(sub.cancelPro(), {extendPeriod: false}); return RECONCILED_CANCELED
    return STALE_EVENT

  switch int(fields.status_code):                                            # 5. status branch
    case 2:
      if intent:
        if formatAmount(fields.payhere_amount) != formatAmount(intent.expectedAmount):
          intentRepo.markStatus(orderId,'failed'); return AMOUNT_MISMATCH    # no provisioning
        if sub.tier == Free or (sub.tier == Pro and sub.status == Canceled):
          subRepo.save(sub.activatePro({subscriptionId, customerId}), {extendPeriod: true})
        else:
          subRepo.save(sub.renew(), {extendPeriod: true})                    # past_due recovery incl.
        intentRepo.markStatus(orderId,'completed'); return PROVISIONED
      # recurring installment (no intent):
      if !idMatches: return STALE_EVENT                                      # late event for replaced sub
      if sub.tier == Pro and sub.status in (Active, PastDue):
        subRepo.save(sub.renew(), {extendPeriod: true}); return RENEWED      # anchor = now() (C-23)
      return STALE_EVENT                                                     # canceled: never un-cancel
    case 0: return LOGGED_PENDING
    case -1, -2, -3:
      if intent: intentRepo.markStatus(orderId,'failed'); return LOGGED_ONLY # initial checkout failed
      if !idMatches: return STALE_EVENT
      if sub.tier == Pro and sub.status == Active:
        subRepo.save(sub.markPastDue(), {extendPeriod: false}); return MARKED_PAST_DUE
      return LOGGED_ONLY                                                     # past_due known / canceled stale
    default: return LOGGED_ONLY
```

**UC-3 `ProcessDunning.ts`** — injects `IGymSubscriptionRepository` (set-based method) +
`ICheckoutIntentRepository`. All decisions in SQL on the server clock, idempotent:

```sql
-- 1. Grace expired after involuntary failure → hard downgrade
UPDATE gyms SET subscription_tier='free', subscription_status='canceled', payhere_subscription_id=NULL
WHERE subscription_tier='pro' AND subscription_status='past_due'
  AND current_period_end IS NOT NULL
  AND current_period_end + (interval '1 day' * $1) < now();   -- $1 = GRACE_PERIOD_DAYS (SubscriptionConfig.ts)

-- 2. Voluntary cancel reached period end → lapse to Free (no grace; the user chose this)
UPDATE gyms SET subscription_tier='free', payhere_subscription_id=NULL
WHERE subscription_tier='pro' AND subscription_status='canceled'
  AND current_period_end IS NOT NULL AND current_period_end < now();
```

Then `expireStale(now)` on intents. Returns `{ downgradedPastDue, lapsedCanceled, intentsExpired }`.
**No statement touches `members`** — over-limit Free gyms keep every member readable; only *new* inserts are
blocked by the guarded function.

**UC-4 `CancelSubscription.ts`** *(new — the cancel gap)* — injects `IGymSubscriptionRepository` +
`ISubscriptionGateway`. `execute({ gymId })`:
1. Load sub. Not Pro → `ConflictError('No active subscription')`. Already `pro/canceled` → return current
   state (idempotent UX). Missing `payhereSubscriptionId` → `ConflictError` (nothing to cancel at the
   gateway; surfaced to admin observability).
2. `subscriptionGateway.cancelSubscription(id)` — **gateway first, then local state**. If the gateway call
   throws, local state is untouched and the user sees a retriable error; the inverse order could stop billing
   locally while PayHere keeps charging the card.
3. `sub.cancelPro()` → `save({extendPeriod: false})`.
4. Return the updated subscription (the UI shows "Pro until {currentPeriodEnd}"). Final confirmation of
   gateway state arrives via the next `RECURRING_STOPPED` webhook (UC-2 step "cancel reconciliation" is then
   a no-op because the state already matches).

*Window analysis (C-21 edge):* between gateway-cancel success and the local `pro/canceled` write, the stored
id is still A and the row still reads `pro/active|past_due`. Two events could land in that window:
(a) `RECURRING_STOPPED`(A) — passes the identity guard and writes `pro/canceled`; that is precisely the
reconciliation backstop for the gateway-success/local-write-fail case, and UC-4's own subsequent save writes
the same terminal values, so the two writers converge idempotently (no `InvalidStatusTransitionError`: UC-4
operates on its already-loaded entity, not a re-read). (b) A replacement subscription B — **cannot exist in
the window**: creating B requires a fresh `GenerateCheckoutUrl` call, and UC-1 rejects while the row reads
`pro/active|past_due`; B only becomes creatable after A's local cancel write has committed, at which point
any later event for A fails the identity guard. No code path initiates B while A's cancel write is pending.

Unit tests first for all four (mocked ports) — see §6.

### Phase QG — Member quota gate (wire into the EXISTING registration path)

No new route. Changes:
1. `src/core/ports/repositories/IMemberRepository.ts`: add
   `createGuarded(gymId: string, member: Member): Promise<Member>`.
2. `src/infrastructure/database/repositories/SupabaseMemberRepository.ts`: implement via
   `this.supabase.rpc('register_member_guarded', { p_gym_id, p_member })`, where `p_member` is built from the
   same `toDatabase()` mapping used by `create()` (single source for column names). Map raised messages:
   `MEMBER_LIMIT_REACHED` → `ConflictError('Member limit reached for current plan')`; `GYM_NOT_FOUND` →
   `NotFoundError('Gym')`. Fetch the inserted row by returned id to hydrate the `Member` domain object.
3. `src/core/use-cases/member/RegisterMember.ts`: step 5 becomes
   `this.memberRepo.createGuarded(input.gymId, member)`. Everything else (duplicate-phone check, payment
   record, welcome SMS) unchanged.
4. `src/app/api/members/route.ts` POST error mapping: add a branch **before** the generic `ConflictError`
   handler that returns
   `ResponseBuilder.error('Member limit reached for current plan', 'MEMBER_LIMIT_REACHED')` with HTTP **403**
   — the machine-readable code is what the frontend keys the upgrade prompt on (§5.4 flow 3). Duplicate-phone
   conflicts keep their existing 409 shape. Cleanest implementation: throw a dedicated
   `MemberLimitError extends DomainError` (`code: 'MEMBER_LIMIT_REACHED'`, `statusCode: 403`) from the repo
   instead of a bare `ConflictError`, so route mapping is `instanceof` — add it to
   `src/core/utils/errors/DomainError.ts` + barrel.
5. **`POST /api/members/bulk`**: inspect `src/app/api/members/bulk/route.ts`; route every member INSERT it
   performs through `createGuarded` (per-row RPC — the gyms row lock serializes them correctly) and surface
   partial results (`{registered: n, rejected: m, reason: 'MEMBER_LIMIT_REACHED'}`) through `ResponseBuilder`.
   RLS note: because the RPC is SECURITY DEFINER and callable, revoke EXECUTE from `anon`/`authenticated`
   **except** through the API path? Postgres cannot distinguish; instead the function re-derives nothing from
   the JWT — the API layer passes the JWT-derived `gym_id` (from `getCurrentGymProfile()`), and the function
   validates the gym exists. Direct PostgREST callers could pass a foreign gym_id; therefore **grant EXECUTE
   to `service_role` only** (migration 3) and call it exclusively through the admin-client repo instance —
   `SupabaseMemberRepository` receives the admin client in the containers used by these routes. Preflight
   check for the executor: `POST /api/members` currently runs on `getContainer()` (session client) — the
   guarded RPC call must therefore run on an admin-client repo. Follow the same pattern as Phase RP client
   discipline: keep reads on the session container; perform `createGuarded` through the admin container after
   `getCurrentGymProfile()` has pinned the gym id. Document this in the route with a two-line comment.

### Phase RT — App routes

All return through `ResponseBuilder` (§2.3); all Node-crypto/service-role routes declare
`export const runtime = 'nodejs'`.

| Route | File | Auth | Wiring |
|---|---|---|---|
| `POST /api/billing/checkout` | `src/app/api/billing/checkout/route.ts` | JWT (`getCurrentGymProfile`) | Zod `checkoutCustomerSchema` (feature schemas; defaults derived server-side from the gym profile: `firstName = gym_name`, `email`, `phone = phone_number ?? ''`, `address = gym_address ?? ''`, `city` required in body). `getAdminContainer().getGenerateCheckoutUrlUseCase()`. 200 `{checkoutUrl, params, orderId}`; `ConflictError` → 409; ZodError → 400 `validationError`. |
| `POST /api/billing/cancel` | `src/app/api/billing/cancel/route.ts` | JWT | `getCancelSubscriptionUseCase()`. 200 with serialized subscription; `ConflictError` → 409; `ExternalServiceError` → 500 `internalError('Could not reach payment gateway…')` (sanitized — §2.8, no PayHere response bodies to the client). |
| `POST /api/webhooks/payhere` | `src/app/api/webhooks/payhere/route.ts` | public | `dynamic = 'force-dynamic'`. `await req.formData()` (PayHere posts form-urlencoded), collect raw strings verbatim. Invalid `md5sig` → best-effort `insertInvalid` (md5sig redacted; hourly-capped per C-20) → **200** `success({received:true})`. Valid → `execute(fields, raw)` → **200** `success({outcome})` for every business outcome incl. duplicate/unresolved/failed-payment. Only a thrown transient fault (DB down, etc.) → **500** `internalError` so PayHere retries. **HTTP status is never derived from `status_code`.** |
| `GET /api/settings/subscription` | `src/app/api/settings/subscription/route.ts` | JWT | Session-client read of the gym's subscription columns (+`member_count`); returns `serializeSubscriptionForAPI(...)`. Powers the billing page and the post-redirect poll. |
| `GET /api/billing/history` | `src/app/api/billing/history/route.ts` | JWT | Session-client (RLS-scoped) paginated read of `saas_payment_logs` for the gym; `ResponseBuilder.success(rows, {page,totalPages,totalCount})`. Row payload: date, order id, masked status (`paid/pending/failed`), amount+currency from `raw_payload` whitelist — **never** the raw payload or signature fields (§2.8). *(Addition over the source plan — the UI needs an envelope-consistent API; direct client-side Supabase reads would bypass the service/hook convention.)* |
| `POST /api/cron/process-dunning` | `src/app/api/cron/process-dunning/route.ts` | `CRON_SECRET` via `safeEqual` | Template = `update-expired-status` route: 401 on mismatch (no dev fallback secret) → `logStart('process-dunning')` → `getAdminContainer().getProcessDunningUseCase().execute()` → `logSuccess(logId, summary)`; catch → `logFailure` + 500. Dev-only `GET` (405 in production). |
| `GET /api/admin/system-health/billing-failures` | `src/app/api/admin/system-health/billing-failures/route.ts` | `ADMIN_API_SECRET` via `safeEqual`, **before any DB access** | `listFailures(limit, offset)` (partial index), `ResponseBuilder.success(rows, meta)`. Full technical detail (status codes, signature_valid, raw error text) is allowed **here only** — admin group, never gym managers (architecture §1 CRITICAL RULE). |

### Phase SR — Serialization (§2.11)

**File — `src/features/subscriptions/utils/serializeSubscriptionForAPI.ts`** (+ unit test):
input `Subscription` props (+`memberCount`), output:

```ts
{
  subscriptionTier, subscription_tier,          // SaasTier
  subscriptionStatus, subscription_status,      // SaasStatus
  memberCount, member_count,
  memberLimit, member_limit,                    // FREE_TIER_MEMBER_LIMIT | null (Pro = null)
  currentPeriodEnd, current_period_end,         // 'YYYY-MM-DD' | null
  graceEndsAt, grace_ends_at,                   // 'YYYY-MM-DD' | null — only when past_due; computed
                                                // server-side so banner countdowns share one clock
  pastDueReason, past_due_reason,               // RecurringFailureClass | null — only when past_due;
                                                // derived from findLatestFailure() via
                                                // classifyRecurringFailure (C-22). The class token only —
                                                // raw status_message NEVER reaches the gym client (§2.8)
  canAddMember: boolean
}
```

Dates via `toISOString().split('T')[0]`, dual-key convention exactly as `serializeMemberForAPI`.
`payhere_subscription_id` / `payhere_customer_id` are **deliberately excluded** — the client has no use for
gateway identifiers (§2.8 sanitization).

### Phase UI — Feature module `src/features/subscriptions/` + screens

Full detail in §5. Files:

```
src/features/subscriptions/
  components/CurrentPlanCard.tsx        # tier/status badge, usage meter, contextual CTA
  components/PricingTable.tsx           # Free vs Pro comparison + upgrade CTA
  components/UpgradeConfirmDialog.tsx   # price + recurrence disclosure, confirm
  components/PayHereRedirectForm.tsx    # hidden plain <form> POST auto-submit (non-React-controlled)
  components/ReturnStatusPanel.tsx      # VERIFYING / SUCCESS / PENDING_CONFIRMATION / CANCELED
  components/PastDueBanner.tsx          # grace countdown banner
  components/CancelSubscriptionDialog.tsx  # alert-dialog, consequence disclosure
  components/BillingHistoryTable.tsx    # paginated saas_payment_logs, printable row detail
  components/QuotaReachedUpsell.tsx     # inline upsell used by members feature on 403
  hooks/useSubscription.ts              # react-query GET /api/settings/subscription
  hooks/usePaymentStatusPoll.ts         # bounded poll (PAYMENT_POLL_* constants)
  hooks/useBillingHistory.ts
  hooks/useCheckout.ts                  # mutation → POST /api/billing/checkout
  hooks/useCancelSubscription.ts        # mutation → POST /api/billing/cancel
  schemas/subscription.schemas.ts       # z.nativeEnum(SaasTier/SaasStatus); checkoutCustomerSchema
  services/subscriptions.service.ts     # fetch + ApiResponse envelope unwrap (members.service pattern)
  utils/serializeSubscriptionForAPI.ts  # Phase SR
  types/index.ts
  __tests__/
  index.ts                              # public API (only what app routes/pages import)
app/(dashboard)/settings/billing/page.tsx      # server shell
app/(dashboard)/settings/billing/BillingPageClient.tsx
app/(admin)/system-health/BillingFailuresTable.tsx  # Phase AD
```

Navigation: append `{ name: 'Subscription', href: '/settings/billing' }` to `settingsNavigation` in
`src/app/(dashboard)/settings/layout.tsx`. The label is **Subscription**, not "Billing", to avoid colliding
with the sidebar's member-facing "Billing Setup" (conflict C-7).

The feature folder is deletable: nothing outside it imports from it except the two `app/` pages, the members
feature's `QuotaReachedUpsell` import (via the feature's public `index.ts`), and the API routes importing the
serializer — all of which are part of the feature's surface and die with it (§2.4).

### Phase CR — Cron registration

`vercel.json`: add `{ "path": "/api/cron/process-dunning", "schedule": "45 0 * * *" }` — after
`update-expired-status` (00:00) and `cancel-overdue-members` (00:15), keeping the nightly maintenance window
contiguous. (Route itself was built in Phase RT; this phase is registration + a manual dev-trigger smoke run.)
Pre-existing observation, out of scope: `/api/cron/expire-suspended-members` exists as a route but is absent
from `vercel.json` — noted in §7, not fixed here.

### Phase AD — Admin observability

`src/app/(admin)/system-health/BillingFailuresTable.tsx`, rendered from the existing
`system-health/page.tsx` alongside `CronStatusGrid` and `RawSMSFailureTable`, following their exact
data-fetch pattern (Bearer `ADMIN_API_SECRET` from the admin layout's secret handling) against
`GET /api/admin/system-health/billing-failures`. Columns: processed_at, gym, order_id, payment_id,
status_code, `message_type`, `status_message` (verbatim — admin is the only surface where it may appear,
C-22), failure class, signature_valid, resolution outcome. The dunning cron is automatically visible in
`CronStatusGrid` because it logs through `CronLogger` — no extra work.

### Phase TS — Test consolidation

See §6. New directories `tests/integration/` and `tests/e2e/` are created here if not already present from
earlier phases' tests.

### Phase HY — Repo hygiene

1. `CHANGELOG.md`: entry under `## [Unreleased] → ### Added` (Keep-a-Changelog format already in use). **Do
   not** bump `package.json` version or tag — releases are user-triggered via the GUI
   (`.claude/rules/versioning.md`, "Never Auto-Bump Version").
2. `docs/SAAS_SUBSCRIPTION_IMPLEMENTATION.md`: schema, state machine diagram, webhook contract
   (200-semantics table), dunning rules + failure-classification table (C-22), the C-24 threat model and its
   compensating controls, and the PayHere runbook — domain whitelisting, live IP whitelisting, sandbox
   notify-url tunneling, **required** per-IP edge rate limit on `/api/webhooks/payhere` (C-27), the
   manual-retry guardrail (C-26), and the authoritative-source decision for invoice history. Include a
   references appendix (industry sources behind C-22..C-27: Flexprice billing edge cases, RevenueCat grace
   periods, Hooklistener/Hookdeck webhook security, Digital Applied dunning playbook) with the standing note
   that Stripe-ecosystem articles supply universal principles only — PayHere's actual field surface
   (`status_code`/`message_type`/`md5sig` 5-tuple, no decline codes, no timestamped signatures) is the
   binding contract.
3. `docs/TIER_IMPLEMENTATION_PLAN.md`: prepend a superseded-notice pointing at the new doc (conflict C-9).
4. `.claude/rules/architecture.md`: add a Pattern Index row — "SaaS subscription billing: Free limit 50,
   grace 7 days, webhook always-200 idempotency, quota via `register_member_guarded`" → reference
   `docs/architecture/saas-subscription.md` (new, condensed from item 2). `instructions.md` does not exist to
   update (conflict C-11); constraints land in the rules index instead.
5. `.env.example`: PayHere block (§1.8).
6. Commits: Conventional Commits per phase (`feat(billing): …`, `feat(db): …`, `test(billing): …`) — the
   pre-commit hook enforces format and runs lint-staged + related tests.

---

## 3. Dependency Ordering

Each step lists hard prerequisites. Steps with the same number can run in parallel.

| # | Step | Prerequisites |
|---|---|---|
| 0 | Preflight re-verification (§1) | — |
| 1 | DB migrations 1→2→3 applied & verified | 0 |
| 2a | `SubscriptionConfig.ts` constants | 0 |
| 2b | `Subscription` entity + domain tests | 2a |
| 2c | `payhere/config.ts`, `crypto.ts`, `safeEqual.ts` + crypto tests | 0 (env names), independent of DB |
| 3a | Ports: `IGymSubscriptionRepository`, `ICheckoutIntentRepository`, `ISaasPaymentLogRepository` | 2b (Subscription type) |
| 3b | Ports: `IPaymentGateway`, `ISubscriptionGateway` | 2a |
| 4a | `PayHereGateway`, `PayHereSubscriptionGateway` | 2c, 3b |
| 4b | Supabase repos ×3 | 1 (columns exist), 3a |
| 5 | DI registration (repos, gateways, use cases) | 4a, 4b |
| 6 | Use cases UC-1..UC-4 + unit tests (mocked ports — can start at 3a/3b; DI wiring needs 5) | 3a, 3b (authoring); 5 (wiring) |
| 7 | Quota gate: `MemberLimitError`, `createGuarded`, `RegisterMember` swap, members + bulk route mapping | 1 (RPC exists), 5 |
| 8 | Routes: checkout, cancel, webhook, subscription read, billing history | 5, 6; serializer (9) for the two GETs |
| 9 | `serializeSubscriptionForAPI` + test | 2b |
| 10 | Cron route + `vercel.json` registration | 6 (UC-3), 2c (safeEqual) |
| 11 | Admin failures route + `BillingFailuresTable` | 4b, 2c |
| 12 | Feature UI module + billing page + nav entry + members-modal upsell wiring | 8, 9 |
| 13 | Integration tests (webhook, quota concurrency, dunning, checkout race, cancel) | 7, 8, 10 |
| 14 | E2E tests | 12, 13 |
| 15 | Hygiene (CHANGELOG, docs, rules, superseded notice) | all |
| 16 | Final gate (§8) | all |

---

## 4. Per-Phase Acceptance Criteria

| Phase | Proof of correctness |
|---|---|
| DB | All three migrations apply cleanly **twice** on a fresh database (idempotence where declared, clean failure otherwise); `SELECT member_count FROM gyms` equals live `count(*)` per gym after backfill; inserting two `pending` intents for one gym raises `23505`; inserting two rows with the same `payhere_payment_id` raises `23505` while two `NULL`-id rows coexist; guard trigger: as role `authenticated`, `UPDATE gyms SET subscription_tier='pro'` **and** `UPDATE gyms SET member_count=0` are both rejected; as a freshly created unenumerated role with UPDATE grant, the same statements are rejected (fail-closed); a member INSERT via the guarded RPC still increments `member_count` (SECURITY DEFINER path exempt) and a service-role tier flip succeeds; CHECK constraints reject an out-of-domain tier/status value; `EXPLAIN` of the C-20 cap count shows an index-only scan on `idx_saas_payment_logs_invalid_sig`. |
| DM | `Subscription.test.ts` green over the full matrix (§6); illegal moves throw `InvalidStatusTransitionError` with correct from/to strings; entity is immutable (mutating a returned instance's source leaves the original intact). |
| GW | `generateCheckoutHash` reproduces a PHP-reference vector (compute once with the documented `strtoupper(md5(...))` formula and pin it); `verifyNotificationSignature` accepts the matching vector and rejects wrong-secret / tampered-amount / tampered-status / truncated-sig / absent-sig; token cache issues one token fetch for two consecutive gateway calls (mock fetch); `cancelSubscription` resolves on `status:1` and already-cancelled `-1`, throws on auth error. |
| RP | Repos round-trip against a dev database: save→find preserves every field; `insertIfNew` returns `true` then `false` for the same payment id; `createPending` throws `ConflictError` on second pending. DI getters resolve without circular imports (`npm run type-check`). |
| UC | Unit suites green: UC-1 rejects `pro/active` and `pro/past_due`; UC-2 produces the exact outcome enum per §6 branch table with correct repo interactions (verify `save` called with/without `extendPeriod`); UC-3 SQL affects only qualifying rows; UC-4 leaves local state untouched when the gateway throws. |
| QG | Integration: gym at `member_count = 49` receives 60 parallel `POST /api/members` → exactly 1 success, 59 × 403 `MEMBER_LIMIT_REACHED`, final count 50. Over-limit Free gym (e.g. 500 members post-downgrade): insert blocked, `GET /api/members` still returns all 500. Bulk route enforces the same gate per row. |
| RT | Webhook returns 200 for: success, pending, failure, duplicate, invalid-sig, unresolved; 500 only when the DB layer is forced to throw (mock). No response ever echoes `md5sig` or the secret. Checkout returns 409 on second concurrent call. Cancel returns 409 for a Free gym. Subscription read matches the serializer contract. |
| SR | Serializer unit test: `YYYY-MM-DD` dates, dual-key parity for every field, nulls for Free gyms, `graceEndsAt` present iff `past_due`. |
| UI | Screens render in all `(tier,status)` states per §5.5 table (component tests with mocked hooks); upgrade CTA disabled while a checkout mutation is in flight; return flow reaches `PENDING_CONFIRMATION` when the poll times out (fake timers); no new styling primitives introduced (`components/ui` diff is empty). |
| CR | `vercel.json` diff adds exactly one cron entry; dev `GET` trigger runs the use case and writes a `cron_logs` row visible in `CronStatusGrid`; production `GET` returns 405. |
| AD | Route returns 403 before any DB query when the Bearer secret is wrong (verify with a DB spy/log); failures list paginates via the partial index (`EXPLAIN` uses `idx_saas_payment_logs_failures`). |
| TS | Coverage ≥ 70% global (existing jest threshold) with the new modules included; every §6 scenario implemented. |
| HY | CHANGELOG entry present; no `package.json` version change in the diff; TIER plan carries the superseded banner; `.env.example` documents every new var with dummy values. |

---

## 5. UI Surface & User Flows

### 5.1 Existing-UI audit (what the new screens reuse)

- **Layout slot:** `/settings/billing` renders inside the `(dashboard)` layout (sidebar + header) and the
  settings sub-nav (`settings/layout.tsx` tab bar — border-bottom tabs, blue active underline). No new layout
  chrome.
- **Primitives:** `Card` (plan panels, usage panel), `Table` (billing history — same header/row classes as
  `MembersTable`), `Badge` (tier/status chips — reuse the color conventions from
  `src/lib/utils/badge-colors.ts`), `Button` variants, `AlertDialog` (cancel confirmation — same primitive the
  member-cancel flow uses), `Dialog` (upgrade confirm), `Progress` (member-quota meter), `Tooltip`
  (disabled-CTA explanations). Icons from `lucide-react`.
- **Radix/React-19 hydration:** any `Select` usage inherits the patched `components/ui/select.tsx`
  (`suppressHydrationWarning`, §2.12). Do not re-patch, do not add raw Radix imports.
- **Data layer:** react-query hooks in the feature (`useSubscription` etc.) with query keys
  `['subscription']`, `['billing-history', page]`; mutations invalidate `['subscription']` exactly the way
  `PaymentCollectionModal` invalidates `['members']`. Toasts via `sonner` (`toast.success` / `toast.error`).
- **Loading/empty/error states:** skeleton rows in tables, `LoadingSpinner` for panel loads, explicit
  empty-state copy rows, error toast + inline retry button — copied from the payment-collection tables.
- **Entry points in navigation:** settings sub-nav item **Subscription**; plus contextual entry points: the
  quota upsell inside `AddMemberModal`/`BulkAddMemberModal`, and the `PastDueBanner` link. No new sidebar item
  (billing is a settings concern, and the sidebar already has an unrelated "Billing Setup").

### 5.2 Screen inventory

| Screen / component | Path | Purpose |
|---|---|---|
| Billing page (server shell + client) | `src/app/(dashboard)/settings/billing/page.tsx`, `BillingPageClient.tsx` | Composes everything below; reads `?order=` / `?canceled=1` search params |
| Current plan & usage panel | `features/subscriptions/components/CurrentPlanCard.tsx` | Tier badge, status badge, `member_count / limit` meter (`Progress`), period end / grace dates, contextual primary CTA |
| Pricing / plan comparison | `components/PricingTable.tsx` | Free vs Pro columns (member limit vs unlimited, price `PAYHERE_PRO_PRICE_LKR`/month); CTA per current state |
| Upgrade confirmation | `components/UpgradeConfirmDialog.tsx` | Price, "recurring monthly, charged by PayHere", city/contact fields (checkout schema), Confirm → `useCheckout` |
| PayHere hand-off | `components/PayHereRedirectForm.tsx` | Hidden **plain HTML form** (not React-controlled inputs) populated from the checkout response, auto-submitted to `checkoutUrl`. Plain form because PayHere requires a browser-level form POST navigation; a `fetch` cannot follow the cross-origin redirect. |
| Post-redirect verification | `components/ReturnStatusPanel.tsx` | `VERIFYING` spinner → `SUCCESS` / `PENDING_CONFIRMATION` / `CANCELED` states (flow 1) |
| Billing / invoice history | `components/BillingHistoryTable.tsx` | Paginated `saas_payment_logs` rows: date, order id, amount, status badge (`paid/pending/failed`); row click → printable detail (browser print stylesheet — no PDF dependency) |
| Cancel subscription | `components/CancelSubscriptionDialog.tsx` | `AlertDialog` with consequence disclosure (5.4 flow 4); destructive-variant confirm |
| Past-due banner | `components/PastDueBanner.tsx` | Amber banner, copy branches on `pastDueReason` (C-22): `retriable` → "Payment failed — PayHere will retry automatically. Make sure your card has funds. Pro features continue until {graceEndsAt} ({n} days left)."; `hard` → "Your payment method was declined and won't be retried. Pro features continue until {graceEndsAt} — re-subscribe before then to avoid reverting to Free." Rendered on the billing page; optionally exported for the dashboard layout later (kept feature-internal for deletability now) |
| Quota-reached upsell | `components/QuotaReachedUpsell.tsx` | Inline panel: "Free plan limit reached (50/50 members). Upgrade to Pro for unlimited members." CTA → `/settings/billing`. Consumed by the members feature via `features/subscriptions` public index |
| Admin failures table | `app/(admin)/system-health/BillingFailuresTable.tsx` | Phase AD; admin-only, technical detail permitted |

### 5.3 State-to-UI mapping

| `(tier, status)` + context | CurrentPlanCard | PricingTable CTA | Cancel visibility | Banner | Add-member surface |
|---|---|---|---|---|---|
| `free/active`, count < 50 | "Free plan — X of 50 members" meter | **Upgrade to Pro** (primary) | hidden | — | normal |
| `free/active`, count = 50 | meter full (destructive tint) | **Upgrade to Pro** (primary, pulsing emphasis ok within existing styles) | hidden | quota notice on members page | Add/Bulk buttons open modal → 403 path shows `QuotaReachedUpsell` (buttons may also be pre-disabled via `canAddMember=false` with tooltip) |
| `free/canceled` (post-downgrade), count > 50 | "Free plan — X members (over the 50 limit)" + explainer "existing members are kept; new registrations need Pro" | **Re-subscribe to Pro** | hidden | neutral info banner | blocked with upsell |
| `pro/active` | "Pro — unlimited members", renews on {currentPeriodEnd} | "Current plan" (disabled) | **visible** | — | normal |
| `pro/past_due` (in grace) | status badge amber "Past due" | disabled ("resolve payment first") — UC-1 rejects anyway | visible (cancel allowed) | `PastDueBanner` with countdown | normal until `graceEndsAt` |
| `pro/past_due` (grace elapsed, cron not yet run) | same as above; countdown shows 0 days | disabled | visible | banner: "grace period ended — account will revert to Free" | blocked (server `canAddMember` false — UI trusts the serializer flag, never local math) |
| `pro/canceled` (paid-through) | "Pro until {currentPeriodEnd}, then Free" | **Re-subscribe** (allowed — UC-1 permits) | hidden (already canceled) | neutral: "subscription canceled — Pro features until {date}" | normal until period end |
| `?order=` present (any state) | — | — | — | `ReturnStatusPanel` replaces the top of the page | — |
| `?canceled=1` | — | — | — | `ReturnStatusPanel` CANCELED: "Payment canceled — you have not been charged." | — |

Webhook outcomes never render directly (the browser never sees the webhook); they surface only through the
polled subscription state above. Every data-backed view defines: **loading** (skeleton/spinner), **empty**
(billing history: "No payments yet — invoices appear here after your first Pro payment"), **error** (toast +
inline "Try again" button re-firing the query).

### 5.4 User flows (state at each step → system reaction)

**Flow 1 — Upgrade (Free → Pro):**
1. Free gym manager hits any entry point (pricing CTA, quota upsell, banner) → `/settings/billing`.
2. `PricingTable` → **Upgrade to Pro** → `UpgradeConfirmDialog` (price, monthly recurrence, contact fields).
3. Confirm → `POST /api/billing/checkout` → server creates the pending intent (state:
   `checkout_intents.pending`, gym unchanged) and returns `{checkoutUrl, params}`.
   - 409 (`Already subscribed` / concurrent pending intent) → error toast with explanation.
4. `PayHereRedirectForm` auto-submits → browser navigates to PayHere; customer authorizes the recurring
   payment (card entry happens entirely on PayHere — no card data ever touches this app).
5. PayHere → `return_url` = `/settings/billing?order=SUB-…` → `ReturnStatusPanel` enters **VERIFYING**;
   `usePaymentStatusPoll` polls `GET /api/settings/subscription` every 1.5 s up to 10 s.
6. Meanwhile (async, authoritative): PayHere POSTs `notify_url` → webhook verifies `md5sig` → UC-2:
   intent matched, amount asserted, `activatePro`, `current_period_end = now()+1 month`, intent `completed`,
   `saas_payment_logs` row inserted.
7. Poll sees `subscription_tier: 'pro'` → **SUCCESS** panel (green check, "You're on Pro") + `sonner`
   success toast; query `['subscription']` cache updated; usage meter switches to unlimited.
8. If the webhook is slow/undelivered inside 10 s → **PENDING_CONFIRMATION**: "Payment received by PayHere is
   still being confirmed. This can take a minute." + manual **Refresh status** button (re-fires the query).
   Explicitly *not* rendered as failure — the webhook is the source of truth and may arrive later (TOCTOU
   mitigation from the source plan §9.1).
9. If the customer cancels on PayHere → `cancel_url` (`?canceled=1`) → CANCELED panel; intent later flips
   `failed`/`expired` (webhook `-1` or dunning `expireStale`).

**Flow 2 — Recurring lifecycle surfaced to the user:**
1. Month N: PayHere auto-charges → webhook `RECURRING_INSTALLMENT_SUCCESS` (`status_code 2`) → UC-2 `renew`
   → period extended. User sees nothing except a new `paid` row in billing history.
2. Charge fails → webhook `-2` → `markPastDue` → next billing-page load (or dashboard visit) shows
   `PastDueBanner` with the server-computed `graceEndsAt` countdown; member registration keeps working.
3. **Recovery:** PayHere retries (or admin uses gateway-side retry) → installment success → `renew` recovers
   `past_due → active` → banner disappears, history shows the recovery payment.
4. **No recovery:** grace passes → nightly `process-dunning` flips to `free/canceled` → UI now renders the
   `free/canceled` over-limit state: members all readable, adds blocked with upsell, plan card explains what
   happened. No member data was deleted (hard invariant).

**Flow 3 — Quota block on member add:**
1. Free gym at 50 members → Add Member modal submits → `POST /api/members` → guarded RPC raises →
   **403 `MEMBER_LIMIT_REACHED`**.
2. `AddMemberModal` (members feature) recognizes the code (service maps it to a typed error) → renders
   `QuotaReachedUpsell` inside the modal body (form preserved, not lost) → CTA navigates to
   `/settings/billing`.
3. Upgrade completes (Flow 1) → back on members page, `['subscription']` invalidation re-enables the form;
   retry succeeds.
4. Race window honesty: even if the UI thought a slot was free, the 403 is authoritative — the modal path
   must handle it regardless of the pre-flight `canAddMember` flag.

**Flow 4 — Cancel (active Pro → canceled → Free at period end):**
1. Pro gym → billing page → **Cancel subscription** (subtle placement, destructive variant) →
   `CancelSubscriptionDialog`:
   > "Cancel your Pro subscription? • You keep Pro features until **{currentPeriodEnd}**. • After that, your
   > account reverts to the Free plan (50-member limit). • Your {member_count} members and all data are kept —
   > if you're over 50, you can't add *new* members until you re-subscribe. • No further charges will be
   > made. This cannot be undone from here; re-subscribing starts a new billing cycle."
2. Confirm → `POST /api/billing/cancel` → UC-4: PayHere REST cancel **first**, then local `cancelPro`.
   - Gateway unreachable → error toast "Couldn't reach the payment provider — nothing was changed. Try
     again." (state untouched; sanitized per §2.8).
3. 200 → success toast; plan card re-renders as `pro/canceled` ("Pro until {date}"); cancel button gone;
   re-subscribe CTA appears.
4. Reconciliation: PayHere later emits `RECURRING_STOPPED` → UC-2 confirms (no-op if states already match;
   corrective `cancelPro` if a gateway-side/manual cancel happened that the app didn't initiate).
5. Period end passes → dunning lapse branch → `free/canceled` state (Flow 2 step 4 UI).

**Flow 5 — Invoice / history:**
1. Billing page → `BillingHistoryTable` (default page 1, newest first via `idx_saas_payment_logs_gym`).
2. Filter chips: all / paid / failed (client-side on the current page — server filter param optional,
   `status` query arg reserved in the route schema).
3. Row → detail: order id, PayHere payment id, date, amount, status; **Print** button triggers the browser
   print dialog with a print stylesheet (invoice-shaped: gym name, plan, period, amount) — downloadable via
   "save as PDF" without adding a PDF library.
4. Authority: `saas_payment_logs` is the single source for this UI (see conflict C-12); the Subscription
   Manager `GET /{id}/payments` endpoint is admin-side tooling only.

### 5.5 Access & safety

- All screens live in `(dashboard)` → JWT-gated by the existing middleware; there is exactly one manager per
  gym (`gyms.user_id`), so no intra-gym role split is needed.
- The client never receives: `md5sig`, Merchant Secret, App credentials, raw webhook payloads, PayHere
  subscription/customer ids, or stack traces. Serializer whitelist (Phase SR) + history-route field whitelist
  enforce this structurally, not by convention.
- Irreversible-action copy: the cancel dialog above; the upgrade dialog states the recurring charge
  explicitly ("LKR {price} charged monthly by PayHere until you cancel").
- Failure copy is user-facing sanitized ("Payment could not be confirmed", "Couldn't reach the payment
  provider") with technical detail visible only in `(admin)/system-health` (§2.8, §2.9).

---

## 6. Test Matrix

Pyramid targets 70/20/10 (`.claude/rules/testing.md`); every feature covers happy path, validation error,
authorization error, edge cases.

### 6.1 Unit (Jest, `src/**/__tests__/`)

| Suite | Scenarios |
|---|---|
| `core/__tests__/domain/subscription/Subscription.test.ts` | free below/at/over limit (`canAddMember` 49/50/500); pro/active; pro/past_due inside grace (day 6) and past grace (day 8); pro/canceled paid-through vs lapsed; `activatePro` from free/active, free/canceled, pro/canceled; `activatePro` **rejects** pro/active and pro/past_due; `renew` from active and past_due, **rejects** canceled and Free; `markPastDue` only from pro/active; `cancelPro` from active + past_due, rejects Free; `downgradeToFree` from past_due + canceled, rejects pro/active; immutability; `graceEndsAt` arithmetic across month boundaries |
| `core/__tests__/domain/subscription/classifyRecurringFailure.test.ts` | `-2`/`RECURRING_INSTALLMENT_FAILED` → retriable; `-1`, `-3`, `RECURRING_STOPPED` → hard; unknown/null message_type → hard (pessimistic default) |
| `lib/payhere/__tests__/crypto.test.ts` | outbound hash matches pinned PHP-formula vector; two-decimal formatting (`4900 → '4900.00'`, `4900.5 → '4900.50'`); inbound verify accepts valid vector; rejects wrong secret / tampered `payhere_amount` / tampered `status_code` / truncated & empty `md5sig`; raw-string rule (amount `'100.0'` must hash as `'100.0'`) |
| `lib/payhere/__tests__/config.test.ts` | throws naming each missing var; sandbox vs live URL derivation |
| `infrastructure/payments/__tests__/PayHereGateway.test.ts` | param assembly: recurrence/duration/custom_1/hash present; secret absent from output |
| `infrastructure/payments/__tests__/PayHereSubscriptionGateway.test.ts` | token cached across calls; refresh after expiry; cancel success / already-cancelled idempotence / auth-error throw (mocked `fetch`) |
| `core/__tests__/use-cases/subscription/*.test.ts` (mocked ports) | UC-1: happy, already-pro conflict, past_due conflict, concurrent-intent conflict propagation; UC-2 branch table — every outcome enum value reachable: PROVISIONED, RENEWED (incl. past_due recovery), MARKED_PAST_DUE, AMOUNT_MISMATCH (no save called!), ALREADY_PROCESSED, UNRESOLVED, LOGGED_PENDING, STALE_EVENT, RECONCILED_CANCELED; identity guard (C-21): after re-subscribe (stored id = B), late `RECURRING_STOPPED` for A → STALE_EVENT with B untouched, late installment success for A → STALE_EVENT with no period extension, and same-id replay of RECONCILED_CANCELED is a no-op; UC-3 returns counts from repo method; UC-4: happy, Free-gym conflict, idempotent second cancel, **gateway-throw leaves save un-called** |
| `features/subscriptions/utils/__tests__/serializeSubscriptionForAPI.test.ts` | date format, dual keys, null handling, graceEndsAt + pastDueReason presence rules (both null unless past_due), gateway-id exclusion, raw `status_message` never present |
| `features/subscriptions/__tests__/` (RTL, jsdom) | `usePaymentStatusPoll` with fake timers (success mid-poll; timeout → pending); `CurrentPlanCard` per §5.3 row; `QuotaReachedUpsell` render + CTA href; `CancelSubscriptionDialog` shows consequence copy and calls mutation on confirm only |
| Members feature delta | `AddMemberModal` maps 403 `MEMBER_LIMIT_REACHED` to the upsell (mocked service) |

### 6.2 Integration (Jest node env, `tests/integration/api/`, disposable Supabase required — gated on env vars, skipped with a loud warning otherwise)

| Suite | Scenarios |
|---|---|
| `webhook.test.ts` | initial success provisions exactly once; duplicate `payment_id` replay → 200 + `ALREADY_PROCESSED` + single log row + no double period extension; recurring success on past_due recovers to active **with `current_period_end` re-anchored at the recovery charge date, not the stale boundary** (C-23); `-2` on active → past_due with `message_type`/`status_message` persisted and class `retriable`, `-3` → class `hard`; invalid signature → 200, `signature_valid=false` row, gym unchanged, md5sig redacted in `raw_payload`; forged-payload flood of `INVALID_WEBHOOK_LOG_HOURLY_CAP + 50` requests → row count capped at the constant, every response still 200 (C-20); amount mismatch → intent failed, gym stays Free; unresolved gym → 200 + null-gym log; `RECURRING_STOPPED` on pro/active → canceled; cancel + re-subscribe then late `RECURRING_STOPPED`/installment for the old `subscription_id` → new subscription untouched, `STALE_EVENT` logged (C-21); forced DB failure → 500 |
| `quota.test.ts` | 60 parallel registrations at count 49 → exactly 1 success/59 rejections/final 50; over-limit Free gym insert blocked + members readable; pro/past_due inside grace allows insert, past grace blocks; pro/canceled paid-through allows, lapsed blocks; bulk route per-row enforcement |
| `dunning.test.ts` | past_due beyond grace → downgraded, `payhere_subscription_id` NULL; past_due inside grace → retained; pro/canceled past period-end → tier free, status stays canceled; pro/canceled before period-end → retained; **members table row count unchanged in all cases**; stale intents expired; cron_logs row written; wrong CRON_SECRET → 401 before any effect |
| `checkout.test.ts` | two parallel checkouts → one pending intent + one 409; unauthenticated → 401; pro/active → 409 |
| `cancel.test.ts` | active Pro + mocked-success gateway → pro/canceled persisted; mocked gateway failure → 500 and state unchanged; Free gym → 409 |
| `billing-history.test.ts` | RLS: gym A cannot read gym B's rows via the route; pagination meta correct |

### 6.3 E2E (Playwright, `tests/e2e/`, chromium; seeded test gym; PayHere itself is **not** driven — the webhook is simulated by POSTing a correctly-signed form body with the sandbox secret from env)

| Spec | Flow |
|---|---|
| `subscription-upgrade.spec.ts` | login → billing page → upgrade dialog → intercept the PayHere form submit (block navigation) → simulate return `?order=` → VERIFYING → POST signed webhook → SUCCESS panel → plan card shows Pro |
| `subscription-pending.spec.ts` | same but no webhook → PENDING_CONFIRMATION with working manual refresh (then webhook → success) |
| `quota-block.spec.ts` | seed gym at limit → Add Member → upsell rendered → CTA lands on billing page |
| `subscription-cancel.spec.ts` | Pro gym (route-mocked gateway) → cancel dialog copy visible → confirm → "Pro until {date}" state |
| `past-due-banner.spec.ts` | seed `pro/past_due` → banner with countdown; seed lapsed state → Free over-limit messaging |

---

## 7. Risk & Conflict Register

| # | Divergence / risk | Resolution |
|---|---|---|
| C-1 | Source plan + task prompt say "sequential numeric prefixes, not timestamps"; `FILE_TREE.md` shows `001_`-style names; the **live** series is date-encoded `20260329000001`-style. | Live codebase wins: `20260703000001..3`. FILE_TREE.md is stale (also wrong about `src/lib/constants/`, settings sub-pages, tests tree) — treat it as a map, `ls` as territory. |
| C-2 | Source plan cites `src/core/utils/errors.ts`. | Real module is `src/core/utils/errors/` (DomainError.ts + index); import path `@/core/utils/errors` unchanged. |
| C-3 | Source plan places constants at `src/lib/constants/SubscriptionConfig.ts`. | Directory doesn't exist; live convention is `src/core/utils/constants/` — file goes there (source plan §0.2 itself authorizes this relocation). |
| C-4 | Source plan uses flat `src/core/ports/*.ts` and bare repo names. | Live layout: `ports/repositories/` + `ports/services/` with barrels; infra repos are `Supabase*Repository.ts`. All new files follow suit. |
| C-5 | §2.3 mandates ResponseBuilder everywhere, but existing admin/system-health routes hand-roll envelopes, and existing cron auth uses plain compare + `'dev-secret-key'` fallback. | New routes follow the rule (ResponseBuilder + `safeEqual`, no fallback secret). Existing routes are **not** refactored in this feature (scope discipline); logged as follow-up debt in the new docs. |
| C-6 | Source plan puts unit tests in `tests/unit/`. | jest.config only matches `src/**` — unit tests live in `src/**/__tests__/`; `tests/integration/` and `tests/e2e/` must be created (configs already point at them). |
| C-7 | Naming collision: sidebar already has "Billing Setup" (member plan-types/discounts). | SaaS page is labeled **Subscription** under Settings; copy never says "billing setup". Route stays `/settings/billing` (URL collision is with `/billing-setup`, distinct enough). |
| C-8 | Source plan schema: `payhere_payment_id text NOT NULL UNIQUE` conflicts with the mandate to log invalid-signature posts (which may lack the field). | Nullable column + partial unique index; `insertInvalid` port method for non-anchored audit rows. |
| C-9 | `docs/TIER_IMPLEMENTATION_PLAN.md` describes an unimplemented 3-tier (basic/pro/enterprise, 40-member) system; none of its migrations/columns exist. | Superseded by this plan (2-tier free/pro, 50-member). Phase HY prepends a superseded notice; its `feature_overrides` idea is explicitly out of scope. |
| C-10 | Source plan port returns `listFailures(): Promise<unknown[]>`. | Violates the zero-`any`/typed-results spirit of §2.2 — define a typed `SaasPaymentLogRow`. |
| C-11 | `CLAUDE.md`/architecture §1.1 reference `instructions.md` as mandatory; the file does not exist at repo root. | Pre-existing gap, not created wholesale here. New constraints (Free=50, grace=7d, webhook-200 idempotency, members-never-deleted) are recorded in the architecture Pattern Index + `docs/architecture/saas-subscription.md` (Phase HY). |
| C-12 | Invoice-history authority ambiguity: local `saas_payment_logs` vs PayHere Subscription Manager `/{id}/payments`. | **`saas_payment_logs` is authoritative for the gym-facing UI**: it is RLS-scoped, includes failed/pending rows (gateway list shows only its own view), works when PayHere is down, and adds no REST-quota/IP-whitelist coupling to a page load. The gateway endpoint is exposed only through `ISubscriptionGateway.listSubscriptionPayments` for admin-side reconciliation. |
| C-13 | **Cancel-subscription gap** (the source plan ships no gateway cancellation). | Closed by design in this plan: `ISubscriptionGateway` port + `PayHereSubscriptionGateway` (OAuth token flow, cached ~10 min) + `CancelSubscription` use case + `POST /api/billing/cancel` + `cancelPro` domain transition + `pro/canceled` handling in quota SQL/dunning/webhook reconciliation + full UI flow (§5.4 flow 4). Config prerequisites treated as required: App ID/Secret env vars, PayHere domain whitelisting, live IP whitelisting (runbook). |
| C-14 | Gyms UPDATE RLS is row-level only — an owner could self-write subscription columns (incl. `member_count`, the quota source) via raw PostgREST. A block-list of PostgREST roles would fail **open** for custom/renamed/direct-login roles. | `prevent_subscription_self_update` trigger in migration 2: SECURITY INVOKER, **allow-list by privilege** — changes to the six protected columns rejected unless `current_user IN ('postgres','service_role')`. `'postgres'` alone is insufficient: the app's legitimate column writes run as `service_role` (admin client), not through definer functions. `member_count` protected; SECURITY DEFINER counter trigger + guarded RPC resolve to `postgres` and stay exempt; every unenumerated role fails closed. |
| C-15 | `POST /api/members` currently uses the session container; the guarded RPC is service-role-only. | Registration write path moves to the admin container **after** `getCurrentGymProfile()` fixes the gym id (same trust model the repo already uses elsewhere); reads stay session-scoped. |
| C-16 | Sandbox `notify_url` cannot be localhost. | Dev/test uses a tunnel (documented in runbook); integration/E2E tests bypass PayHere entirely by posting signed bodies directly to the webhook route. |
| C-17 | PayHere may retry or deliver webhooks out of order (e.g., installment success arriving after a cancel). | Idempotency row + state guards make replays no-ops and stale events log-only (`STALE_EVENT`); ordering never corrupts state because every mutation is guard-checked against current state, not event order. |
| C-18 | Grace arithmetic in three places (TS entity, guarded SQL, dunning SQL) can drift. | Literals carry `-- see SubscriptionConfig.ts` comments (invariant), and integration tests assert TS-vs-SQL agreement at the boundary days (in-grace day 6 insert allowed, day 8 blocked ⇔ dunning day 8 downgrade). |
| C-19 | Source plan modeled `saas_tier`/`saas_status` as Postgres enums, but the superseded `TIER_IMPLEMENTATION_PLAN.md` shows prior product intent for >2 tiers, and `ALTER TYPE … ADD VALUE` is non-transactional (cannot ship in one transactional migration with dependent DDL). | Columns are `text` + CHECK constraints covering the full domains — tier `IN ('free','pro')`, status `IN ('active','past_due','canceled')`, `target_tier` likewise — validated immediately (new columns with passing defaults / new tables; no `NOT VALID` anywhere). `pro/canceled` paid-through is `tier='pro' + status='canceled'` — **no new status token exists outside the CHECK**. TS enums + `z.nativeEnum` unchanged and now sole app-layer enforcement: repo/route signatures type tier/status as the enums, never `string` (Phase RP corollary; §8 invariant 8 grep). Adding a tier later is a transactional CHECK swap. |
| C-20 | Nullable `payhere_payment_id` (C-8) means invalid-signature audit rows bypass `insertIfNew` dedup — a forged-payload flood against the public webhook becomes unbounded write amplification. | `insertInvalid` enforces `INVALID_WEBHOOK_LOG_HOURLY_CAP`: hourly count served **index-only** by the exact-predicate `idx_saas_payment_logs_invalid_sig` (`WHERE signature_valid = false`) — the broader failures index is unsuitable (heap filtering, or signed failed payments counting against the cap on a dunning-storm day). Cap is **global**, not per-gym/order (attacker controls `order_id`/`custom_1` and would shard a scoped cap). Skip insert + single `console.warn` beyond cap; response stays 200; scanned range self-bounds at ~cap rows/hour. Edge-level rate limiting recommended as deployment-config defense-in-depth. |
| C-21 | Late/out-of-order gateway events for a **replaced** subscription: after cancel + re-subscribe, `subscription_id` lookup for old sub A misses (row now stores B) and the `custom_1` fallback resolves the gym — a late `RECURRING_STOPPED`(A) would cancel B; a late installment success (A) would extend B. | Subscription-identity guard in UC-2: every non-intent state-mutating branch (`renew`, `markPastDue`, cancel reconciliation) requires the event's `subscription_id` to equal the stored `payhereSubscriptionId`; mismatch → `STALE_EVENT` (log-only). Intent-driven activations exempt (they establish the id). The gateway-success→local-write window is safe: `RECURRING_STOPPED` for the current id in that window **is** the intended reconciliation and converges idempotently with UC-4's own write, and no replacement subscription can be created inside the window because UC-1 rejects checkout while the row still reads `pro/active|past_due` (see UC-4 window analysis). Unit + integration coverage in §6. |
| C-22 | Industry dunning discipline centers on decline-code classification (retriable vs unrecoverable); the plan previously collapsed `-1/-2/-3` into one undifferentiated `past_due`. PayHere constraint: no card-network decline codes exist — only `status_code`, `message_type`, free-text `status_message`. | Capture-first classification: `message_type`/`status_message` promoted to `saas_payment_logs` columns; two-valued `RecurringFailureClass` (`retriable`/`hard`, pessimistic default) computed by a pure domain helper; surfaced sanitized as `pastDueReason` (class token only, never raw text) to branch the past-due banner copy; full detail admin-only. State transitions unchanged — PayHere owns retry scheduling. Finer taxonomy deferred until observed `status_message` data exists. |
| C-23 | Recovery that "restores access but not the billing math": re-anchoring at the stale pre-failure boundary silently shortens the period the customer just paid for. | Already the design (single server clock), now explicit + tested: every successful charge sets `current_period_end = now() + interval '1 month'` at the charge-processing date. PayHere's `item_rec_date_next` is captured in `raw_payload` but **never** used for period math — it sits outside the signed field set (C-24); gateway-vs-local schedule drift is an admin-reconciliation concern, not an automatic-trust concern. |
| C-24 | PayHere protocol limitation: `md5sig` signs only `(merchant_id, order_id, payhere_amount, payhere_currency, status_code)` and carries no timestamp/nonce. Consequences: (a) timestamped-signature replay rejection is unavailable — idempotency is the sole replay defense (industry-sanctioned when the provider lacks timestamps); (b) `payment_id`, `subscription_id`, `message_type`, `item_rec_*` are **unsigned** — an actor holding one captured valid tuple could mutate them. | Compensating controls, named: TLS-only exposure of notify traffic; `md5sig` never logged (redaction is load-bearing, not hygiene); `payhere_subscription_id`/`customer_id` never serialized to any client; idempotency anchor on `payment_id`; identity guard on `subscription_id` (C-21); amount assertion before any provisioning; all period extension computed from the server clock, bounded to `+1 month` (no unsigned date is ever trusted — C-23); C-20 cap bounds the unauthenticated write path. Recorded so no future change (e.g. trusting `item_rec_date_next`) silently widens the surface. |
| C-25 | Dominant industry webhook pattern is verify → enqueue → ACK (async worker); this plan is deliberately synchronous. | Conscious deviation, rationale recorded: the provisioning transaction is a single-row `gyms` UPDATE + one log insert; the stack has no queue/worker infrastructure; PayHere's retry-on-non-2xx **is** the durability layer, and ACKing before provisioning would forfeit it. Revisit trigger: if webhook side effects grow beyond the single transaction (emails, SMS, multi-row provisioning), introduce an outbox/queue and flip to verify-enqueue-ack rather than stretching the synchronous handler. |
| C-26 | Card-network retry budgets (Visa: 15 attempts/30 days; Mastercard: fees per retry beyond 35/30 days from Jan 2025) can be breached by uncapped merchant-triggered retries. PayHere owns automatic retry scheduling, so the automatic path is its liability. | This plan deliberately exposes **no** user-facing "retry now" (`ISubscriptionGateway` omits `retrySubscription`; the past-due UX says PayHere retries). Guardrail recorded for the future: if a manual retry is ever added, cap it hard (e.g. 1/24h per subscription, ≤2 per past_due episode) so combined manual + PayHere attempts stay inside the tightest network budget. |
| C-27 | App-layer cap (C-20) bounds audit writes but every forged request still costs a signature computation + one indexed count; the public webhook route itself needs an inbound ceiling. | Upgraded from "recommended" to **required deployment config** in the runbook (Phase HY): per-IP rate limit on `/api/webhooks/payhere` at ~5× expected peak (expected legitimate volume ≈ one notification per gym per month plus retries — tens/day platform-wide; a 60 req/min/IP ceiling is generous). Rate-limit rather than IP-allowlist: PayHere publishes no stable origin ranges. Kept as deployment config, not code — the app-layer C-20 cap remains the in-code guarantee. |
| Obs | `/api/cron/expire-suspended-members` route exists but is missing from `vercel.json`. | Pre-existing, out of scope; noted for maintainers. |

---

## 8. Final Verification Gate

Run in order; every step must pass with zero errors before sign-off:

```bash
npm run type-check          # tsc --noEmit — strict, zero errors
npm run lint                # eslint . — zero errors
npm test                    # unit suites incl. all new __tests__; coverage ≥ 70% global
npm run test:integration    # against disposable Supabase (env-gated)
npm run test:e2e            # playwright chromium (env-gated; webServer = npm run dev)
npm run build               # next build — zero type/build errors
```

Then assert the invariants (manual checklist against the diff):

1. Every new route builds responses exclusively through `ResponseBuilder`; no hand-rolled envelopes.
2. Webhook HTTP status is never derived from `status_code`; 200 for handled/duplicate/unresolved/invalid-sig;
   500 only for transient faults.
3. The **only** member-quota authority is the `FOR UPDATE`-locked `register_member_guarded`; all serialized
   subscription fields on the client are display-only.
4. No code path deletes or mutates `members` rows on downgrade/lapse (grep the dunning SQL + UC-3).
5. Recurring failure sets `past_due` only; the hard downgrade happens exclusively in the dunning cron via
   server-clock SQL.
6. `PAYHERE_MERCHANT_SECRET`, App Secret, OAuth tokens, and `md5sig` never reach the client and never appear
   in logs (grep for the env names + `md5sig` in every `console.*` and serializer/route payload; confirm
   invalid-sig `raw_payload` redaction — load-bearing for replay defense per C-24, not hygiene). Raw
   `status_message` reaches admin surfaces only; gym clients see the `RecurringFailureClass` token alone.
7. All secret comparisons on new routes are constant-time (`safeEqual`/`timingSafeEqual`).
8. Enums are TS enums validated with `z.nativeEnum`; `grep -rn ": any\b"` over new files is empty; no repo
   or route types a tier/status parameter as `string` — grep new files for `'free'|'pro'|'past_due'` string
   literals: hits only in `SubscriptionConfig.ts` and CHECK-guarded SQL.
9. SQL literals `50`, `7`, `1 month` each carry the `SubscriptionConfig.ts` back-reference comment.
10. `src/features/subscriptions/` is deletable: `grep -rn "features/subscriptions" src/` matches only the two
    `app/` billing pages, the members-modal upsell import, the API-route serializer import, and the admin
    table — nothing in `core/` or other features.
11. `package.json` version untouched; CHANGELOG updated under `[Unreleased]`; no git tags created.
12. `vercel.json` contains the `process-dunning` schedule; a manual dev trigger shows the run in
    `CronStatusGrid`.
