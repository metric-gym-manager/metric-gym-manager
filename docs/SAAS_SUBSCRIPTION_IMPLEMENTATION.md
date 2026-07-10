# SaaS Subscription (Lite/Pro/Enterprise via PayHere) — Reference & Runbook

**Implemented:** 2026-07-04 · **Plan:** `docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md`
(conflict register C-1..C-30 explains every design decision referenced below).

> **Tier history:** launched `free`/`pro` (cap 50) → renamed `starter`/`growth`,
> Starter cap **40** (`20260706000002`) → added **Enterprise** + Growth cap 190
> (`20260707000001`) → Growth cap 150 (`20260708000002`) → **re-anchored to the
> PAID-ONLY ladder** Lite (100) / Pro (∞) / Enterprise (∞) (`20260708000003..6`).
> This last step is not a rename: the free tier is REMOVED. Onboarding is a
> **trial status** (lite/trialing + 14-day clock), and dunning **suspends**
> (status change, tier preserved) instead of downgrading. The string `'pro'` is
> reused for the unlimited mid tier — collision-free because the free-era
> `'pro'` rows were all renamed to `'growth'` in `20260706000002`. All swaps are
> transactional CHECK-constraint changes (the C-19 text+CHECK design exists for
> exactly this). TS mirror: `SubscriptionConfig.ts`
> (`SaasTier.Lite/Pro/Enterprise`, `SaasStatus` incl. `Trialing`/`Suspended`,
> `LITE_TIER_MEMBER_LIMIT = 100`, `TRIAL_PERIOD_DAYS = 14`,
> `PAYHERE_LITE_PRICE_LKR`/`PAYHERE_PRO_PRICE_LKR`/`PAYHERE_ENTERPRISE_PRICE_LKR`).
>
> **Complimentary (lifetime) subscriptions:** a tier provisioned manually
> (active, no gateway subscription, no period end) — `isComplimentary()`.
> Never billed, immune to dunning (both WHERE clauses require a period end), and
> all self-service billing controls are disabled in the UI + rejected by the
> checkout/cancel APIs. Provision via `save_gym_subscription(gym, 'enterprise',
> 'active', NULL, NULL, false)`.

---

## 1. Schema

Migrations `20260704000001..3` + tier strategy `20260708000003..6`:

| Object | Purpose |
|---|---|
| `gyms.subscription_tier` (`text` CHECK `lite\|pro\|enterprise`, DEFAULT `lite`), `gyms.subscription_status` (`text` CHECK `trialing\|active\|past_due\|suspended\|canceled`, DEFAULT `trialing`) | Tenant billing state. Text + CHECK, not enums — tier additions/renames stay transactional (C-19). |
| `gyms.trial_ends_at` (`timestamptz` DEFAULT `now() + interval '14 days'`) | Trial clock set at signup; the trial-expiry cron suspends `trialing` rows past it. 14 = `TRIAL_PERIOD_DAYS`. |
| `gyms.payhere_subscription_id / payhere_customer_id / current_period_end / member_count` | Gateway ids, paid-through boundary (always DB-clock), denormalized ACTIVE-member counter. |
| `checkout_intents` | order_id → gym attribution for webhooks; one `pending` per gym (partial unique index → concurrent checkout 409s). `target_tier` CHECK `lite\|pro\|enterprise`. |
| `saas_payment_logs` | Webhook audit + idempotency anchor (partial unique on `payhere_payment_id`) + gym billing history. `message_type`/`status_message` promoted for classification (C-22). `raw_payload.md5sig` always `[REDACTED]` (C-24). |
| `prevent_subscription_self_update` trigger | Column-write guard: subscription columns (incl. `member_count`) writable only by `postgres`/`service_role` — allow-list, fails closed (C-14). |
| `assert_gym_can_add_active_member(gym_id)` | **The single active-member quota authority.** `FOR UPDATE` on the gyms row serializes into-active writes. |
| `register_member_guarded(gym_id, member)` | Delegates to the quota authority for active inserts; owns the `members` INSERT. service_role-only EXECUTE. |
| `save_gym_subscription(...)` | Single-clock subscription writer; `p_extend_period=true` sets `current_period_end = now() + 1 month` **on the DB clock** (supabase-js cannot express SQL expressions — C-18/C-23). |
| `process_dunning_suspensions(grace_days)` | Set-based dunning: SUSPENDS, never writes a tier (see §4). |
| `process_trial_expiry()` | `trialing` past `trial_ends_at` → `suspended` (tier preserved). |

## 2. State machine

Legal `(tier, status)` pairs: `{lite,pro,enterprise} × {trialing,active,past_due,suspended,canceled}`.
Every tier is paid; there is no free tier and no downgrade landing tier.
Domain entity: `src/core/domain/subscription/Subscription.ts`.

`activate(targetTier)` is tier-agnostic and provisions the tier the checkout
intent priced; `convertTrialToPaid()` is its trialing-guarded alias.

```
lite/trialing ──convertTrialToPaid──▶ {tier}/active ◀──renew(recovery)── {tier}/past_due
{tier}/suspended ──activate─────────▶     │                                     ▲
{tier}/canceled ──activate──────────▶     │──markPastDue──────────────────────▶─┘
{tier}/suspended ──reactivate───────▶     │──cancelPaid──▶ {tier}/canceled
{tier}/past_due ──cancelPaid────────▶ {tier}/canceled
{tier}/past_due (grace over) ──suspend──▶ {tier}/suspended   (dunning cron only)
{tier}/canceled (period over) ─suspend──▶ {tier}/suspended   (dunning cron only)
lite/trialing (trial over) ────suspend──▶ lite/suspended     (trial-expiry cron only)
```

- `renew()` is a **non-transition** (§2.5.1): installment success on active/past_due; never from
  canceled (a stale installment must not un-cancel — C-21). A late installment success on a
  SUSPENDED account `reactivate()`s it (the gateway id is retained on suspension).
- Voluntary cancel keeps the tier **until `current_period_end`, no grace**, then dunning
  suspends; involuntary failure gets `GRACE_PERIOD_DAYS` (7) of grace after `current_period_end`.
- A live subscription (active/past_due) blocks a new checkout — a plan change (e.g. Lite→Pro)
  requires cancelling first (PayHere has no in-place plan swap). Trialing/suspended/canceled can
  check out into any tier.
- Quota matrix (mirrored in SQL and `canAddMember`, cap from the PlanRestrictions matrix):
  trialing/active → within cap (lite < 100; pro/enterprise ∞) · past_due → within cap until
  period+grace · canceled → within cap while paid-through (until period end, NO grace — the
  customer keeps what they paid for) · **suspended → blocked on every tier** ·
  **complimentary → ∞, always**
  (status active, no period end).
- **No code path ever deletes members.** Over-limit gyms keep everything; only new into-active
  writes block.

## 3. Webhook contract (`POST /api/webhooks/payhere`)

- Form-urlencoded only; `md5sig` verified over the raw received strings before anything else.
- **HTTP status is never derived from PayHere's `status_code`.** 200 for: success, pending, failed
  payment, duplicate delivery, unresolved gym, invalid signature, garbage body. 500 **only** for
  transient faults (DB down) so PayHere retries.
- Guard chain (normative, `HandlePayHereWebhook`): resolve gym (intent → subscription_id →
  `custom_1`) → idempotency (`payhere_payment_id` unique) → identity guard (non-intent mutations
  require the event's `subscription_id` to equal the stored one — C-21) → cancel reconciliation
  (`RECURRING_STOPPED`/`item_rec_status=-1`) → status branch.
- Success with intent: `trialing → convertTrialToPaid`, `suspended|canceled → activate`,
  `active|past_due → renew` (rare). Success without intent: `renew` (active/past_due) or
  `reactivate` (suspended, id-matched). Amount assertion before any intent-driven provisioning
  (signed amount must equal the intent's `expected_amount`).
- Period extension always anchors at the charge-processing DB time — a gym failing on the 1st and
  recovering on the 9th is paid through the 9th of next month (C-23). `item_rec_date_next` is
  captured but **never trusted** (unsigned field — C-24).
- Synchronous by design (C-25): single-row transaction, no queue in the stack, PayHere
  retry-on-non-2xx is the durability layer. Revisit if webhook side effects grow.

### Replay/threat model (C-24)

`md5sig` signs only `(merchant_id, order_id, amount, currency, status_code)` — no timestamp, and
`payment_id`/`subscription_id`/`item_rec_*` are unsigned. Compensating controls (all load-bearing):
TLS-only notify traffic; **md5sig never logged** (redaction); gateway ids never serialized to any
client; idempotency on `payment_id`; C-21 identity guard; amount assertion; server-clock-bounded
period extension; C-20 hourly cap (100) on signature-invalid audit rows (global, not per-gym —
`order_id`/`custom_1` are attacker-controlled).

## 4. Dunning & trial expiry (daily crons)

`POST /api/cron/process-dunning` (00:45 UTC):
1. `past_due` with `current_period_end + 7d < now()` → **`suspended`** (tier preserved, gateway id retained).
2. `canceled` with `current_period_end < now()` → **`suspended`** (tier preserved).
3. Stale pending checkout intents → `expired`.

`POST /api/cron/process-trial-expiry` (00:50 UTC):
`trialing` with `trial_ends_at < now()` → **`suspended`** (tier preserved).

No tier is ever written — there is no downgrade landing tier. Suspension gates the account
(no into-active member writes, reminders halted) until payment: a new checkout `activate()`s,
a late gateway retry `reactivate()`s. All decisions in SQL on the DB clock; idempotent; logged
via `CronLogger` (visible in the system-health CronStatusGrid). Failure classification (C-22):
PayHere exposes no card-network decline codes — `classifyRecurringFailure` maps `-2`→`retriable`
(PayHere retries), `-1/-3/RECURRING_STOPPED`→`hard`. The class drives banner copy only, never state.

## 5. Cancel flow

`POST /api/billing/cancel` → `CancelSubscription`: **gateway first** (PayHere OAuth
`subscription/cancel`, idempotent on already-cancelled), then local `canceled` (tier retained,
paid-through; the dunning cron suspends at period end). Gateway failure leaves local state
untouched. Trialing/suspended accounts have nothing charging at the gateway → 409. Final
confirmation via the next `RECURRING_STOPPED` webhook.
**No manual "retry charge" is exposed** (C-26): card-network retry budgets (Visa 15/30d;
Mastercard fees past 35/30d) are PayHere's liability only while PayHere owns all retries. If a
retry button is ever added, cap it (≤1/24h per subscription, ≤2 per past_due episode).

## 6. Surfaces

| Surface | Auth | Notes |
|---|---|---|
| `/settings/billing` page | JWT | Trial banner, plan card, pricing (3 paid columns), upgrade/cancel dialogs, return-flow poll (10s → PENDING_CONFIRMATION, never "failure"), history |
| `GET /api/settings/subscription` | JWT | Serialized state (incl. `trialEndsAt`, `capabilities.accessControlHardware`) + sanitized `pastDueReason` + `litePriceLkr`/`proPriceLkr`/`enterprisePriceLkr` meta |
| `GET /api/billing/history` | JWT | `saas_payment_logs` is authoritative for the gym UI (C-12); whitelisted fields only |
| `POST /api/billing/checkout` / `cancel` | JWT | Admin-container writes after `getCurrentGymProfile()` pins the gym (C-15); checkout accepts any tier |
| `GET /api/admin/system-health/billing-failures` | SaaS admin session (`saas_admins`) | Full technical detail lives HERE ONLY — never gym-facing |
| Member quota | — | 403 `MEMBER_LIMIT_REACHED` from `/api/members` (+bulk per-row `errorCode`) → inline upgrade upsell (Lite→Pro) |

## 6.1 Plan restrictions (capability matrix)

**Single source of truth: `src/core/domain/subscription/PlanRestrictions.ts`**
(the capability matrix). Tier conditionals are never written anywhere else;
adding a tier to `SaasTier` breaks compilation until the matrix is extended.

| Capability | Lite | Pro | Enterprise | Server authority | UX layer |
|---|---|---|---|---|---|
| `maxMembers` | 100 | ∞ | ∞ | `assert_gym_can_add_active_member` (SQL) | `MemberLimitBar` (Lite only — the one capped tier), quota upsell → Pro |
| `automatedReminders` | ✓ | ✓ | ✓ | Universal — `SendAutomatedReminders` gates on billing STATUS only (send trialing/active/past_due-in-grace; halt suspended/canceled, fail-closed; `membersSkippedBillingRestricted` in the cron summary) | — |
| `announcements` | ✓ | ✓ | ✓ | Universal — `POST /api/announcements` keeps the fail-closed matrix check wired for future re-gating (never 403s by tier today) | `FeatureGate` passes through |
| `accessControlHardware` | ✗ | ✗ | ✓ | The sole remaining per-tier gate | `FeatureGate` upsell → Enterprise |

The serializer exposes `capabilities` + `remainingMemberSlots` + `trialEndsAt` (dual-key) so
every client gate reads server-computed flags — never local tier math. The
Pro/Enterprise avatar ring (`ProAvatarRing`, header) is the positive marker for
active subscribers.

## 7. Deployment runbook (REQUIRED config)

1. **Env** (see `.env.example`): `PAYHERE_MODE/MERCHANT_ID/MERCHANT_SECRET/APP_ID/APP_SECRET` +
   **all three prices**: `PAYHERE_LITE_PRICE_LKR=2990` (new), `PAYHERE_PRO_PRICE_LKR=4990`
   (**repurposed** — history `4900 (pro-original) → 2990 (growth) → 4990 (pro-new)`),
   `PAYHERE_ENTERPRISE_PRICE_LKR=6990`. Deploy the env flip in the SAME release as migration
   `20260708000003` (see `docs/DEPLOYMENT_PAYHERE_CHECKLIST.md`).
2. **PayHere dashboard**: whitelist the app domain for the Merchant Secret AND for the API key
   (App ID). **Live** REST (cancel) additionally requires server IP whitelisting via
   `support@payhere.lk`.
3. **Edge rate limit (C-27, required)**: per-IP limit on `/api/webhooks/payhere` at ~5× expected
   peak (legitimate volume ≈ one notification per gym per month + retries; 60 req/min/IP is
   generous). Rate-limit, don't IP-allowlist — PayHere publishes no stable origin ranges.
4. **Sandbox testing**: `notify_url` cannot be localhost — tunnel the dev server (e.g. ngrok) and
   set `NEXT_PUBLIC_APP_URL` to the tunnel origin.
5. **Migrations**: apply `20260704000001..3`, then `20260706000002`, `20260707000001`,
   `20260708000001..2`, then the tier-strategy train `20260708000003..6` in order; verify with
   `scripts/billing-acceptance/run.sh`. Grandfathering note (migration `…000003`, precautionary):
   a billed growth gym with >100 active members would land on Pro but keep paying 2990 on its
   existing gateway subscription (PayHere fixes the recurring amount at creation; no silent
   2990→4990 charge can occur) — notify any such gym of the tier change. No-op at migration
   time: no gym carries a billed gateway subscription (real accounts are complimentary/lifetime;
   growth rows are operator demo accounts).
6. **Cron**: `process-trial-expiry` added to `vercel.json` (daily 00:50 UTC) alongside
   `process-dunning` (00:45 UTC); both require `CRON_SECRET`.

## 8. Testing

- Unit: `npx jest` — domain matrix (trial/suspend transitions), crypto vectors, use-case branch
  table, serializer, UI states.
- Integration (`npm run test:integration`): **gated** on `INTEGRATION_TESTS=1` +
  `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` against a **disposable** database with
  migrations applied. Covers webhook idempotency/recovery-anchor/identity-guard/flood-cap, 60-way
  quota race at the Lite cap, dunning-suspend branches (members preserved, tier preserved),
  trial expiry, checkout race, cancel ordering.
- E2E (`npm run test:e2e`): gated on `E2E_BILLING=1` + seeded gym login + PayHere env matching the
  dev server; per-state specs additionally gate on `E2E_PRO_GYM`/`E2E_PAST_DUE_GYM`/
  `E2E_AT_LIMIT_GYM`/`E2E_SUSPENDED_GYM`/`E2E_ENTERPRISE_GYM`. Webhooks are simulated with
  correctly signed bodies — PayHere is never driven.

## 9. Industry references (behind C-22..C-27)

Stripe-ecosystem articles supply universal principles only — PayHere's actual surface
(`status_code`/`message_type` only, no decline codes, 5-tuple `md5sig`, no timestamps) is the
binding contract.

- Flexprice — billing edge cases that break homegrown systems (race conditions, dunning state,
  recovery pricing): flexprice.io/blog/billing-edge-cases-break-homegrown-systems
- RevenueCat — how grace periods work: revenuecat.com/docs/subscription-guidance/how-grace-periods-work
- Hooklistener — Stripe webhooks implementation (raw body, timing-safe, replay):
  hooklistener.com/learn/stripe-webhooks-implementation
- Hookdeck — webhook security vulnerabilities (idempotency as replay defense):
  hookdeck.com/webhooks/guides/webhook-security-vulnerabilities-guide
- Digital Applied — failed-payment recovery / dunning playbook 2026 (decline-to-tactic mapping):
  digitalapplied.com/blog/failed-payment-recovery-dunning-playbook-2026
- Tagada — gateway-vs-application-state separation: tagada.io/blog/subscription-billing-software
