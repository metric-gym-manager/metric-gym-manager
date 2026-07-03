# PayHere Free/Pro Subscription — Executable Implementation Plan (Architecture-Bound)

Target repository: `gym-management-saas` (Next.js 16, React 19, TypeScript strict, Supabase Postgres, npm).
This plan is bound to the conventions in `.claude/rules/architecture.md`, `SYSTEM_MANUAL.md`, and `FILE_TREE.md`. Every artifact path, naming scheme, and pattern below matches the existing codebase. Execute tasks in order. Do not skip steps. Do not introduce parallel structures that duplicate existing ones.

Architecture rules this plan obeys (cross-check each against the rule file):
- §2.3 ResponseBuilder for every API route, including webhooks and cron.
- §2.4 Feature-first module under `/src/features/subscriptions/`, independently deletable.
- §2.5 State transitions via dedicated domain methods guarded by `canTransition`; no generic status writes.
- §2.5.1 Non-transition property updates (recurring renewal) via a dedicated `renew`-style method, never a self-transition.
- §2.6 Cron jobs persist execution via `CronLogger` + `cron_logs`.
- §2.2 Zod with `z.nativeEnum` for domain enums; no `any`.
- §2.11 `serializeXForAPI` for HTTP serialization (YYYY-MM-DD dates, camelCase + snake_case duplicated fields).
- Clean Architecture layering: domain → ports → use-cases → infrastructure (repos + DI) → app routes.
- Multi-tenant isolation: every query and lock scoped by `gym_id`; RLS policies on all new tables.

---

## 0. Discovery & Global Constants (run before writing code)

### 0.1 Confirm the live conventions
1. `cat package.json` → confirm npm (lockfile `package-lock.json`), scripts (`type-check`, `lint`, `test`, `test:integration`, `test:e2e`, `build`).
2. `ls supabase/migrations/` → record the highest numeric prefix `N`. New migrations use zero-padded sequential prefixes `(N+1)`, `(N+2)`, `(N+3)`. **Do not use timestamp prefixes.** Below they are written as `NNN_`, `NNN1_`, `NNN2_`; substitute the computed numbers.
3. Confirm these existing artifacts and their exact export signatures, then reuse them verbatim (do not recreate):
   - `src/core/utils/api/ApiResponse.ts` → `ResponseBuilder`, `HTTP_STATUS`, `ApiResponse<T>`.
   - `src/core/utils/errors.ts` → `ValidationError`, `InvalidStatusTransitionError`, `NotFoundError`, `ConflictError`.
   - `src/core/utils/cron/CronLogger.ts` → `logStart`, `logSuccess`, `logFailure`.
   - `src/infrastructure/di/Container.ts` and the `getContainer()` / `getAdminContainer()` exports from `@/infrastructure/di`.
   - `src/lib/supabase/client.ts` (anon) and `src/lib/supabase/admin.ts` (service role).
   - The auth helper `getCurrentGymProfile()` (used in API routes; locate its module and import path).
   - The existing member-status enum config (`StatusConfig.ts`) to mirror its file location and TS-enum style for the new subscription enums.
4. Confirm the tenant table is `gyms` with PK `id uuid`, and the members table is `members` with `gym_id uuid` (per `SYSTEM_MANUAL.md` A.3). Confirm no `subscription_tier` column exists yet.
5. Locate the existing members registration path: `src/app/api/members/route.ts` (POST) → `RegisterMember` use case → `MemberRepository`. The quota gate is injected here (Phase 6); do not create a second members route.

### 0.2 Global constants
Create `src/lib/constants/SubscriptionConfig.ts`:

```ts
import { z } from 'zod';

export enum SaasTier {
  Free = 'free',
  Pro = 'pro',
}

export enum SaasStatus {
  Active = 'active',
  PastDue = 'past_due',
  Canceled = 'canceled',
}

export const FREE_TIER_MEMBER_LIMIT = 50;
export const GRACE_PERIOD_DAYS = 7;
export const PRO_BILLING_RECURRENCE = '1 Month'; // PayHere recurrence param
export const PRO_BILLING_DURATION = 'Forever';   // PayHere duration param
export const PRO_BILLING_INTERVAL_SQL = "interval '1 month'";
export const CHECKOUT_INTENT_TTL_MINUTES = 30;
export const PAYMENT_POLL_TIMEOUT_MS = 10_000;
export const PAYMENT_POLL_INTERVAL_MS = 1_500;

// z.nativeEnum per §2.2 — validation layer reuses the domain enum
export const saasTierSchema = z.nativeEnum(SaasTier);
export const saasStatusSchema = z.nativeEnum(SaasStatus);
```

If the repo's existing enum config lives at a different constants path (0.1.3), place this file beside it and match its style. Reference these constants everywhere; never inline the literals except inside SQL, where they must carry a comment pointing back here.

### 0.3 Environment variables
Append to `.env.example` and document; set real values in `.env.local` and the deployment environment:

```
# PayHere (SaaS subscription billing)
PAYHERE_MODE=sandbox
PAYHERE_MERCHANT_ID=
PAYHERE_MERCHANT_SECRET=
PAYHERE_PRO_PRICE_LKR=
PAYHERE_CHECKOUT_URL_SANDBOX=https://sandbox.payhere.lk/pay/checkout
PAYHERE_CHECKOUT_URL_LIVE=https://www.payhere.lk/pay/checkout
```

`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_SECRET`, `CRON_SECRET`, and the public base URL already exist in the repo (cron + admin patterns depend on them); reuse the existing names. Derive `notify_url`, `return_url`, `cancel_url` from the existing public-URL env var. Add a typed accessor for the PayHere vars in the repo's existing env/config module (or `src/lib/payhere/config.ts`) that throws at import if any required var is absent.

---

## 1. Database — Migrations, RLS, Triggers, Locking Function

All numeric prefixes below are sequential after the current max (0.1.2).

### 1.1 Migration `NNN_create_saas_subscriptions.sql`

```sql
-- Enums (TS mirror: src/lib/constants/SubscriptionConfig.ts)
CREATE TYPE saas_tier AS ENUM ('free', 'pro');
CREATE TYPE saas_status AS ENUM ('active', 'past_due', 'canceled');

-- Tenant columns
ALTER TABLE gyms
  ADD COLUMN subscription_tier       saas_tier   NOT NULL DEFAULT 'free',
  ADD COLUMN subscription_status     saas_status NOT NULL DEFAULT 'active',
  ADD COLUMN payhere_customer_id      text,
  ADD COLUMN payhere_subscription_id  text,
  ADD COLUMN current_period_end       timestamptz,
  ADD COLUMN member_count             integer     NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX idx_gyms_payhere_subscription_id
  ON gyms (payhere_subscription_id)
  WHERE payhere_subscription_id IS NOT NULL;

-- Backfill denormalized counter
UPDATE gyms g
SET member_count = (SELECT count(*) FROM members m WHERE m.gym_id = g.id);

-- order_id -> gym_id resolution (mandatory: webhooks cannot attribute payment without it)
CREATE TABLE checkout_intents (
  order_id        text          PRIMARY KEY,
  gym_id          uuid          NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  target_tier     saas_tier     NOT NULL,
  expected_amount numeric(12,2) NOT NULL,
  currency        text          NOT NULL DEFAULT 'LKR',
  status          text          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','completed','failed','expired')),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  expires_at      timestamptz   NOT NULL
);
-- At most one live pending intent per gym (blocks concurrent double-checkout)
CREATE UNIQUE INDEX idx_checkout_intents_one_pending_per_gym
  ON checkout_intents (gym_id) WHERE status = 'pending';

-- SaaS payment audit (named to avoid collision with member `payments` table)
CREATE TABLE saas_payment_logs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                  uuid        REFERENCES gyms(id) ON DELETE SET NULL,
  order_id                text,
  payhere_payment_id      text        NOT NULL UNIQUE,  -- idempotency anchor
  payhere_subscription_id text,
  status_code             integer     NOT NULL,
  signature_valid         boolean     NOT NULL,
  raw_payload             jsonb       NOT NULL,
  processed_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_saas_payment_logs_failures
  ON saas_payment_logs (processed_at)
  WHERE status_code < 2 OR signature_valid = false;
CREATE INDEX idx_saas_payment_logs_gym ON saas_payment_logs (gym_id, processed_at DESC);
```

### 1.2 Migration `NNN1_saas_subscriptions_rls.sql`
Follow the existing RLS conventions (`002_add_rls_policies.sql`, and the `cron_logs` service-role pattern).

```sql
ALTER TABLE checkout_intents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_payment_logs ENABLE ROW LEVEL SECURITY;

-- Service role: full access (webhook + cron run under service role)
CREATE POLICY "service_role full checkout_intents"
  ON checkout_intents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full saas_payment_logs"
  ON saas_payment_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gym managers: read-only, own gym only (billing history UI).
-- Use the same gym-ownership predicate the existing policies use; the template
-- below assumes a gyms row keyed to auth.uid(). Replace the subquery with the
-- repo's established ownership expression discovered in 002_add_rls_policies.sql.
CREATE POLICY "gym read own saas_payment_logs"
  ON saas_payment_logs FOR SELECT
  USING (gym_id IN (SELECT id FROM gyms WHERE /* owner predicate */ true));
```

The new subscription columns live on `gyms`, so they inherit the existing gyms SELECT policy — verify the dashboard can read them; do not assume.

### 1.3 Migration `NNN2_member_count_trigger_and_guarded_insert.sql`

Member-count maintenance (SECURITY DEFINER so it can write `gyms` regardless of the inserting role's RLS):

```sql
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
```

Concurrency-safe guarded insert (replaces the invalid `SELECT count(*) ... FOR UPDATE`). SECURITY DEFINER; the API layer passes the JWT-derived `gym_id`, and the function locks that gyms row as a per-tenant mutex:

```sql
CREATE OR REPLACE FUNCTION register_member_guarded(
  p_gym_id uuid,
  p_member jsonb        -- all member columns required by the members INSERT
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  g          RECORD;
  allowed    boolean;
  new_id     uuid;
  grace_end  timestamptz;
BEGIN
  SELECT subscription_tier, subscription_status, member_count, current_period_end
    INTO g FROM gyms WHERE id = p_gym_id FOR UPDATE;   -- serializes per-gym writes
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;

  IF g.subscription_tier = 'pro' THEN
    IF g.subscription_status = 'active' THEN
      allowed := true;
    ELSIF g.subscription_status = 'past_due' THEN
      grace_end := g.current_period_end + (interval '1 day' * 7);  -- GRACE_PERIOD_DAYS (SubscriptionConfig.ts)
      allowed := (g.current_period_end IS NOT NULL AND now() <= grace_end);
    ELSE
      allowed := false;
    END IF;
  ELSE
    allowed := (g.member_count < 50);  -- FREE_TIER_MEMBER_LIMIT (SubscriptionConfig.ts)
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'MEMBER_LIMIT_REACHED'; END IF;

  INSERT INTO members (
    gym_id, name, phone_number, plan_type, plan_amount, discount_id,
    recurring_discount, status, registered_date, membership_start_date, next_due_date
  )
  SELECT p_gym_id,
         p_member->>'name',
         p_member->>'phone_number',
         (p_member->>'plan_type')::member_plan_type,
         (p_member->>'plan_amount')::numeric,
         NULLIF(p_member->>'discount_id','')::uuid,
         COALESCE((p_member->>'recurring_discount')::boolean, false),
         COALESCE((p_member->>'status')::member_status, 'active'),
         COALESCE((p_member->>'registered_date')::date, CURRENT_DATE),
         COALESCE((p_member->>'membership_start_date')::date, CURRENT_DATE),
         (p_member->>'next_due_date')::date
  RETURNING id INTO new_id;  -- AFTER trigger increments member_count

  RETURN new_id;
END;
$$;
```

Adjust the INSERT column list to the exact `members` schema (SYSTEM_MANUAL A.3). The literals `7` and `50` must keep the comments linking them to `SubscriptionConfig.ts`.

### 1.4 Apply & verify
Run the repo's migration command (or `npx supabase migration up`). Acceptance: migrations run clean and idempotently on a fresh DB; `member_count` equals live `count(*)` per gym after backfill.

---

## 2. Domain Layer — Subscription Entity & State Machine (§2.5, §2.5.1)

### 2.1 Ports
`src/core/ports/IGymSubscriptionRepository.ts`:

```ts
import { Subscription } from '@/core/domain/subscription/Subscription';

export interface IGymSubscriptionRepository {
  findByGymId(gymId: string): Promise<Subscription | null>;
  findByPayhereSubscriptionId(subscriptionId: string): Promise<Subscription | null>;
  save(sub: Subscription): Promise<Subscription>; // persists tier/status/period/ids to gyms row
}
```

`src/core/ports/ICheckoutIntentRepository.ts`:

```ts
export interface CheckoutIntent {
  orderId: string; gymId: string; targetTier: 'pro';
  expectedAmount: number; currency: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  expiresAt: Date;
}
export interface ICheckoutIntentRepository {
  createPending(intent: Omit<CheckoutIntent,'status'>): Promise<CheckoutIntent>; // throws ConflictError on unique pending violation
  findPendingByOrderId(orderId: string): Promise<CheckoutIntent | null>;
  markStatus(orderId: string, status: CheckoutIntent['status']): Promise<void>;
  expireStale(now: Date): Promise<number>;
}
```

`src/core/ports/ISaasPaymentLogRepository.ts`:

```ts
export interface SaasPaymentLogInput {
  gymId: string | null; orderId: string | null;
  payherePaymentId: string; payhereSubscriptionId: string | null;
  statusCode: number; signatureValid: boolean; rawPayload: Record<string, string>;
}
export interface ISaasPaymentLogRepository {
  /** Returns false if payherePaymentId already exists (idempotency), true if inserted. */
  insertIfNew(input: SaasPaymentLogInput): Promise<boolean>;
  listFailures(limit: number, offset: number): Promise<unknown[]>;
}
```

`src/core/ports/IPaymentGateway.ts`:

```ts
export interface CheckoutParams { [k: string]: string; }
export interface IPaymentGateway {
  buildCheckoutParams(input: {
    orderId: string; amount: number; currency: string; gymId: string;
    customer: { firstName: string; lastName: string; email: string; phone: string; address: string; city: string; };
  }): CheckoutParams;
  verifyNotificationSignature(fields: Record<string,string>): boolean;
}
```

### 2.2 Domain entity `src/core/domain/subscription/Subscription.ts`

Immutable; transition methods guarded by `canTransition`; recurring renewal is a non-transition `renew` method per §2.5.1.

```ts
import { SaasTier, SaasStatus, GRACE_PERIOD_DAYS, FREE_TIER_MEMBER_LIMIT } from '@/lib/constants/SubscriptionConfig';
import { InvalidStatusTransitionError } from '@/core/utils/errors';

export interface SubscriptionProps {
  gymId: string;
  tier: SaasTier;
  status: SaasStatus;
  memberCount: number;
  currentPeriodEnd: Date | null;
  payhereCustomerId: string | null;
  payhereSubscriptionId: string | null;
}

const TRANSITIONS: Record<string, SaasStatus[]> = {
  'free:active':   [SaasStatus.Active],                    // free→pro handled by activatePro
  'pro:active':    [SaasStatus.Active, SaasStatus.PastDue],
  'pro:past_due':  [SaasStatus.Active, SaasStatus.Canceled],
  'free:canceled': [SaasStatus.Active],
};

export class Subscription {
  private constructor(private readonly props: SubscriptionProps) {}
  static create(p: SubscriptionProps) { return new Subscription(p); }

  get tier() { return this.props.tier; }
  get status() { return this.props.status; }
  get currentPeriodEnd() { return this.props.currentPeriodEnd; }
  toProps(): SubscriptionProps { return { ...this.props }; }

  /** free/active or free/canceled → pro/active. Initial activation or reactivation. */
  activatePro(input: { periodEnd: Date; subscriptionId: string | null; customerId: string | null }): Subscription {
    if (this.props.tier !== SaasTier.Free) {
      throw new InvalidStatusTransitionError(`${this.props.tier}:${this.props.status}`, 'pro:active');
    }
    return new Subscription({
      ...this.props, tier: SaasTier.Pro, status: SaasStatus.Active,
      currentPeriodEnd: input.periodEnd,
      payhereSubscriptionId: input.subscriptionId ?? this.props.payhereSubscriptionId,
      payhereCustomerId: input.customerId ?? this.props.payhereCustomerId,
    });
  }

  /** NON-TRANSITION (§2.5.1): successful recurring charge on an already-Pro sub.
   *  Extends the period and recovers past_due→active without a self-transition. */
  renew(input: { periodEnd: Date }): Subscription {
    if (this.props.tier !== SaasTier.Pro) {
      throw new InvalidStatusTransitionError(`${this.props.tier}:${this.props.status}`, 'pro:active');
    }
    return new Subscription({ ...this.props, status: SaasStatus.Active, currentPeriodEnd: input.periodEnd });
  }

  /** pro/active → pro/past_due. Recurring charge failed; grace begins. */
  markPastDue(): Subscription {
    this.assertCanTransition(SaasStatus.PastDue);
    return new Subscription({ ...this.props, status: SaasStatus.PastDue });
  }

  /** pro/past_due → free/canceled. Grace expired (cron). */
  downgradeToFree(): Subscription {
    this.assertCanTransition(SaasStatus.Canceled);
    return new Subscription({ ...this.props, tier: SaasTier.Free, status: SaasStatus.Canceled, payhereSubscriptionId: null });
  }

  canAddMember(now: Date): boolean {
    if (this.props.tier === SaasTier.Pro) {
      if (this.props.status === SaasStatus.Active) return true;
      if (this.props.status === SaasStatus.PastDue && this.props.currentPeriodEnd) {
        const graceEnd = new Date(this.props.currentPeriodEnd);
        graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
        return now <= graceEnd;
      }
      return false;
    }
    return this.props.memberCount < FREE_TIER_MEMBER_LIMIT;
  }

  isGraceExpired(now: Date): boolean {
    if (this.props.status !== SaasStatus.PastDue || !this.props.currentPeriodEnd) return false;
    const graceEnd = new Date(this.props.currentPeriodEnd);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
    return now > graceEnd;
  }

  private assertCanTransition(next: SaasStatus) {
    const key = `${this.props.tier}:${this.props.status}`;
    const allowed = TRANSITIONS[key] ?? [];
    if (!allowed.includes(next)) {
      throw new InvalidStatusTransitionError(key, `${this.props.tier}:${next}`);
    }
  }
}
```

Domain tests: `src/core/__tests__/domain/subscription/Subscription.test.ts`.

---

## 3. PayHere Gateway & Crypto (exact algorithm)

`src/lib/payhere/crypto.ts`:

```ts
import { createHash, timingSafeEqual } from 'crypto';
import { payhereConfig } from '@/lib/payhere/config';

const md5Upper = (s: string) => createHash('md5').update(s, 'utf8').digest('hex').toUpperCase();
export const formatAmount = (n: number) => n.toFixed(2); // mirrors PHP number_format(x,2,'.','')

// Outbound: UPPER(md5( merchant_id + order_id + amount(2dp) + currency + UPPER(md5(secret)) ))
export function generateCheckoutHash(orderId: string, amount: number, currency: string): string {
  return md5Upper(
    payhereConfig.merchantId + orderId + formatAmount(amount) + currency + md5Upper(payhereConfig.merchantSecret)
  );
}

// Inbound: UPPER(md5( merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(md5(secret)) ))
// payhere_amount and status_code are the RAW received strings — never reparse or reformat.
export function verifyNotificationSignature(f: {
  merchant_id: string; order_id: string; payhere_amount: string;
  payhere_currency: string; status_code: string; md5sig: string;
}): boolean {
  const local = md5Upper(
    f.merchant_id + f.order_id + f.payhere_amount + f.payhere_currency + f.status_code + md5Upper(payhereConfig.merchantSecret)
  );
  const a = Buffer.from(local), b = Buffer.from(f.md5sig ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

`src/infrastructure/payments/PayHereGateway.ts` implements `IPaymentGateway` using the crypto helpers and config-derived `notify_url`/`return_url`/`cancel_url`. `buildCheckoutParams` sets `recurrence = PRO_BILLING_RECURRENCE`, `duration = PRO_BILLING_DURATION`, `amount = formatAmount(price)`, `currency='LKR'`, `country='Sri Lanka'`, `custom_1 = gymId`, `hash = generateCheckoutHash(...)`.

`src/lib/payhere/config.ts` exports a validated `payhereConfig` (mode-aware checkout URL, merchant id/secret, price); throws on missing env.

Constant-time secret compare for admin/cron auth: reuse the repo's existing helper if present; else add `src/lib/auth/safeEqual.ts` using `timingSafeEqual`. Never log secrets or `md5sig`.

---

## 4. Use Cases (`src/core/use-cases/subscription/`)

### 4.1 `GenerateCheckoutUrl.ts`
Constructor injects `IGymSubscriptionRepository`, `ICheckoutIntentRepository`, `IPaymentGateway`. `execute({ gymId, customer })`:
1. Load subscription; if `tier=pro` and `status=active` → throw `ConflictError('Already subscribed')`.
2. `orderId = 'SUB-' + gymId + '-' + Date.now()`.
3. `checkoutIntentRepo.createPending({ orderId, gymId, targetTier:'pro', expectedAmount: price, currency:'LKR', expiresAt: now + TTL })`. The unique partial index makes a concurrent second call throw `ConflictError` — let it propagate.
4. Return `gateway.buildCheckoutParams(...)` plus the gateway checkout URL.

### 4.2 `HandlePayHereWebhook.ts`
Synchronous (a tier flip is one row; returning 200 before provisioning would forfeit PayHere's retry-on-non-2xx). Constructor injects the three subscription repos + gateway. `execute(fields, rawPayload)`:
1. Resolve gym: (a) `checkoutIntentRepo.findPendingByOrderId(order_id)`; else (b) `subscriptionRepo.findByPayhereSubscriptionId(subscription_id)`; else (c) `custom_1` as gymId. If none → log with `gymId=null`, return `{ outcome:'UNRESOLVED' }`.
2. `const inserted = await saasPaymentLogRepo.insertIfNew({...})`. If `false` → `{ outcome:'ALREADY_PROCESSED' }` (idempotency; no state change).
3. Branch on integer `status_code`:
   - `2`: if intent-driven, assert `formatAmount(payhere_amount) === formatAmount(expectedAmount)`; mismatch → mark intent `failed`, no provisioning, return `{ outcome:'AMOUNT_MISMATCH' }`. Else compute `periodEnd = now + 1 month`. If current sub is Pro → `sub.renew({periodEnd})` (recovers past_due→active); if Free → `sub.activatePro({periodEnd, subscriptionId, customerId})`. `subscriptionRepo.save(...)`; if intent-driven mark intent `completed`.
   - `0`: log only.
   - `-1 | -2 | -3`: if current sub is Pro (active or past_due) → `sub.markPastDue()` then `save` (begin grace; do not downgrade here). If this was an initial activation (intent pending, gym Free) → mark intent `failed`, leave Free.
   - default: log only.
4. Return outcome enum.

`current_period_end` is computed in the repo UPDATE via Postgres `now() + interval '1 month'` (single clock), not JS date math.

### 4.3 `ProcessDunning.ts`
Injects `IGymSubscriptionRepository` (or a single repo method) and `ICheckoutIntentRepository`. Executes, server-clock only, idempotent:

```sql
UPDATE gyms
SET subscription_tier = 'free', subscription_status = 'canceled', payhere_subscription_id = NULL
WHERE subscription_status = 'past_due'
  AND current_period_end IS NOT NULL
  AND current_period_end + (interval '1 day' * $1) < now();  -- $1 = GRACE_PERIOD_DAYS
```

Then `checkoutIntentRepo.expireStale(now)`. Return `{ downgraded, intentsExpired }`. Members untouched.

---

## 5. Infrastructure — Repositories & DI

Concrete repos in `src/infrastructure/database/repositories/`:
- `GymSubscriptionRepository.ts` (maps gyms subscription columns ↔ `Subscription`; `save` writes tier/status/ids and, on renew/activate, sets `current_period_end = now() + interval '1 month'`).
- `CheckoutIntentRepository.ts` (`createPending` catches Postgres unique-violation `23505` → throws `ConflictError`).
- `SaasPaymentLogRepository.ts` (`insertIfNew` catches `23505` → returns `false`; else inserts → `true`).

All three use the service-role client (`src/lib/supabase/admin.ts`) — webhook and cron have no user session. Typed rows; no `any` (§2.2).

DI registration in `src/infrastructure/di/Container.ts` (mirror existing factory style):

```ts
getGymSubscriptionRepository(): IGymSubscriptionRepository { ... }
getCheckoutIntentRepository(): ICheckoutIntentRepository { ... }
getSaasPaymentLogRepository(): ISaasPaymentLogRepository { ... }
getPaymentGateway(): IPaymentGateway { ... }
getGenerateCheckoutUrlUseCase(): GenerateCheckoutUrl { ... }
getHandlePayHereWebhookUseCase(): HandlePayHereWebhook { ... }
getProcessDunningUseCase(): ProcessDunning { ... }
```

Webhook and cron obtain these via `getAdminContainer()`; the checkout route via `getContainer()`.

---

## 6. Members Quota Gate (wire into the EXISTING registration path)

Do not add a new members route. In `RegisterMember` (`src/core/use-cases/member/RegisterMember.ts`) and its repository, replace the plain INSERT with the guarded RPC so the quota check holds the `gyms` row lock:

1. Extend `IMemberRepository` with `createGuarded(gymId: string, member: MemberInsert): Promise<string>`.
2. `MemberRepository.createGuarded` calls `supabaseAdmin.rpc('register_member_guarded', { p_gym_id: gymId, p_member: member })`. Map exceptions: `MEMBER_LIMIT_REACHED` → throw `ConflictError('Member limit reached for current plan')` (or a dedicated `MemberLimitError`); `GYM_NOT_FOUND` → `NotFoundError('Gym')`.
3. `RegisterMember.execute` calls `createGuarded` instead of `create`.
4. In `src/app/api/members/route.ts` POST, map the limit error to `ResponseBuilder.forbidden('Member limit reached for current plan')` / 403 (or `conflict` 409), with `errorCode: 'MEMBER_LIMIT_REACHED'` so the frontend can prompt an upgrade. All other handling stays via `ResponseBuilder` (§2.3).

Acceptance (integration): 60 parallel registrations on a Free gym at `member_count=49` → exactly 1 success, 59 rejections, final `member_count=50`. An over-limit Free gym (e.g. 500 after downgrade) blocks new inserts; existing members remain readable.

---

## 7. App Routes

All routes return through `ResponseBuilder`; `export const runtime = 'nodejs'` where Node crypto / service-role is used.

### 7.1 Checkout — `src/app/api/billing/checkout/route.ts` (POST, JWT)
`getCurrentGymProfile()` → 401 via `ResponseBuilder.unauthorized()` if absent. Zod-validate the customer body (schema in the subscriptions feature). `getContainer().getGenerateCheckoutUrlUseCase().execute(...)`. `ConflictError` → `ResponseBuilder.conflict(...)`/409. Success → `ResponseBuilder.success({ checkoutUrl, params })`/200.

### 7.2 Webhook — `src/app/api/webhooks/payhere/route.ts` (POST, public)
`runtime='nodejs'`, `dynamic='force-dynamic'`. Read `await req.formData()` (PayHere posts `application/x-www-form-urlencoded`); collect raw string fields verbatim.

```ts
const valid = gateway.verifyNotificationSignature(fields);
if (!valid) {
  await logInvalidSignature(fields, raw); // best-effort, never throws
  return NextResponse.json(ResponseBuilder.success({ received: true }), { status: 200 });
}
try {
  const outcome = await handler.execute(fields, raw); // synchronous, idempotent
  return NextResponse.json(ResponseBuilder.success({ outcome }), { status: 200 });
} catch (e) {
  // transient/server fault → 500 so PayHere RETRIES.
  // (Unique-violation is caught inside the use case and never reaches here.)
  return NextResponse.json(
    ResponseBuilder.internalError('Webhook processing failed', e instanceof Error ? e.stack : undefined),
    { status: 500 }
  );
}
```

Rules: return 200 for success, pending, failure codes, duplicate, unresolved, and invalid signature; return 500 only for genuine transient faults. Never derive the HTTP status from `status_code`.

### 7.3 Subscription read — `src/app/api/settings/subscription/route.ts` (GET, JWT)
Returns `serializeSubscriptionForAPI(...)` for the current gym (billing UI + return-flow poll). Mirror the existing `settings/gym` route style and `ResponseBuilder` usage.

### 7.4 Dunning cron — `src/app/api/cron/process-dunning/route.ts` (POST, CRON_SECRET)
Follow §2.6 exactly: Bearer `CRON_SECRET` via `safeEqual` → 401 otherwise; `logStart('process-dunning')`; `getAdminContainer().getProcessDunningUseCase().execute()`; `logSuccess(logId, summary)`; on error `logFailure(logId, [msg])` + `ResponseBuilder.internalError(...)`/500. Provide the dev-only `GET` manual trigger guarded by `NODE_ENV !== 'production'`, as existing crons do. Register the schedule in `vercel.json` (e.g. `"0 2 * * *"`).

### 7.5 Admin failures — `src/app/api/admin/system-health/billing-failures/route.ts` (GET, ADMIN_API_SECRET)
Bearer `ADMIN_API_SECRET` via `safeEqual`, authorized BEFORE any DB query (§1 CRITICAL RULE). Query `saas_payment_logs` failures (uses the partial index). Return via `ResponseBuilder.success` with pagination meta. Technical details never reach gym managers (admin group only).

---

## 8. Serialization (§2.11)

`src/features/subscriptions/utils/serializeSubscriptionForAPI.ts`: dates as `YYYY-MM-DD` (`current_period_end.toISOString().split('T')[0]`); provide both `currentPeriodEnd`/`current_period_end`, `subscriptionTier`/`subscription_tier`, `subscriptionStatus`/`subscription_status`, `memberCount`/`member_count`. Use in 7.3 and any billing response. Unit-test (date format + dual field names) per the architecture mandate.

---

## 9. Feature Module — `src/features/subscriptions/` (§2.4)

Self-contained, deletable. Structure:
- `components/PricingTable.tsx` — Free vs Pro. CTA posts to `/api/billing/checkout`, then auto-submits a plain (non-React-controlled) HTML form to the mode-appropriate PayHere checkout URL with the returned params. Use Shadcn UI; any Radix `Select` already carries the React-19 hydration fix in `components/ui/select.tsx` (§2.12) — do not re-patch.
- `components/BillingHistoryTable.tsx` — serialized payment history.
- `components/UpgradeModal.tsx` — confirmation + price.
- `hooks/usePaymentStatusPoll.ts` — TOCTOU mitigation (below).
- `schemas/subscription.schemas.ts` — Zod input schemas using `z.nativeEnum(SaasTier/SaasStatus)`.
- `services/subscriptions.service.ts`, `types/index.ts`, `__tests__/`, `index.ts` (public API only).

Billing page: `src/app/(dashboard)/settings/billing/page.tsx` (the `settings` route group exists). Add a nav entry consistent with existing settings sub-pages.

### 9.1 Return-from-PayHere (TOCTOU)
On `return_url` (`/settings/billing?order=<id>`): enter `VERIFYING`; poll `GET /api/settings/subscription` every `PAYMENT_POLL_INTERVAL_MS` up to `PAYMENT_POLL_TIMEOUT_MS` (or Supabase Realtime on the gyms row). `subscription_tier=pro` → `SUCCESS`. Window elapses → `PENDING_CONFIRMATION` (NOT failure; webhook is the source of truth and may arrive later) with a manual refresh control. Only `cancel_url` (`?canceled=1`) shows a canceled state.

---

## 10. Tests (pyramid 70/20/10; Jest + Playwright)

Unit (`src/core/__tests__/` + `tests/unit/`):
- `Subscription`: free below/at/over limit; pro/active; pro/past_due in-grace and past-grace; `activatePro` rejects when already Pro; `renew` recovers past_due→active; `markPastDue`/`downgradeToFree` guard rails; over-limit (500) Free → `canAddMember=false`.
- crypto: `generateCheckoutHash` matches a PHP reference vector; `verifyNotificationSignature` rejects wrong secret / tampered amount / tampered status_code / truncated sig.
- `serializeSubscriptionForAPI`: date format + dual field names.

Integration (`tests/integration/api/`):
- webhook: initial success provisions once; duplicate `payment_id` provisions once, returns 200; recurring success on past_due recovers; recurring failure (−2) on active → past_due; invalid signature logs + 200 + no change; amount mismatch → no provision; unresolved gym → log + 200.
- quota: 60 parallel guarded registrations at count 49 → 1 success.
- dunning: past-grace → downgraded; in-grace → retained; members preserved.
- checkout race: two parallel checkouts for one gym → one pending intent, other 409.

E2E (`tests/e2e/`, Playwright): upgrade → return URL → `VERIFYING` → (simulated webhook) → Pro; webhook-absent path → `PENDING_CONFIRMATION`.

Coverage gates per `.claude/rules/testing.md`.

---

## 11. Repo Hygiene (mandatory per project rules)
1. `CHANGELOG.md`: add an entry under a new minor version (conventional commits / `.claude/rules/versioning.md`).
2. `docs/`: add `docs/SAAS_SUBSCRIPTION_IMPLEMENTATION.md` (schema, state machine, webhook contract). Reconcile or supersede the existing `docs/TIER_IMPLEMENTATION_PLAN.md`; note which.
3. `instructions.md` / `.claude/rules/`: record the Free/Pro limit, grace period, and the webhook-200 idempotency rule as project constraints.
4. `vercel.json`: add the `process-dunning` cron schedule.
5. Gate: `npm run type-check`, `npm run lint`, `npm test`, `npm run test:integration`, then `npm run build` (zero type errors).

---

## 12. Build Order
1. Discovery (0.1–0.3).
2. Migrations 1.1 → 1.2 → 1.3; apply; verify backfill (1.4).
3. Constants (0.2), ports (2.1), domain `Subscription` (2.2); run unit tests.
4. PayHere config + crypto + gateway (Phase 3); crypto unit tests.
5. Repositories + DI registration (Phase 5).
6. Use cases (Phase 4).
7. Members quota wiring into `RegisterMember` + repo + route (Phase 6); concurrency integration test.
8. Routes: checkout (7.1), webhook (7.2), subscription read (7.3), dunning cron (7.4), admin failures (7.5); webhook integration tests.
9. Serialization (Phase 8); admin UI `BillingFailuresTable.tsx` in `(admin)/system-health/`, consistent with `CronStatusGrid`/`RawSMSFailureTable`.
10. Feature module + billing page (Phase 9); E2E.
11. Repo hygiene (Phase 11).
12. Full quality gate (11.5).

## 13. Final Invariants (assert before sign-off)
- Every new route returns through `ResponseBuilder`; no manual JSON envelopes.
- HTTP status to PayHere is never derived from `status_code`; 500 only for transient faults; duplicates / invalid-sig / unresolved return 200.
- The only member-quota authority is the `FOR UPDATE`-locked `register_member_guarded`; session-cached subscription fields are display-only.
- No code path deletes members on downgrade.
- Recurring failure sets `past_due`; only the dunning cron performs the hard downgrade, via server-clock SQL.
- `PAYHERE_MERCHANT_SECRET` and `md5sig` never reach the client and never appear in logs; all secret comparisons are constant-time.
- Enums are TS enums validated with `z.nativeEnum`; zero `any`.
- SQL literals `7` / `50` / `1 month` carry comments pointing to `SubscriptionConfig.ts`.
- The `subscriptions` feature folder is deletable without breaking other features (§2.4).
