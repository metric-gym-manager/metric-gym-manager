# SaaS Subscription (Starter/Growth/Enterprise via PayHere) — Reference & Runbook

**Implemented:** 2026-07-04 · **Plan:** `docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md`
(conflict register C-1..C-27 explains every design decision referenced below).

> **Tier history:** launched `free`/`pro` (cap 50) → renamed `starter`/`growth`,
> Starter cap **40** (`20260706000002`) → added **Enterprise** tier + capped
> Growth at **190** (`20260707000001`). Three tiers now: Starter (free, 40) /
> Growth (paid, 190) / Enterprise (paid, unlimited). All swaps are transactional
> CHECK-constraint changes (the C-19 text+CHECK design exists for exactly this).
> TS mirror: `SubscriptionConfig.ts` (`SaasTier.Starter/Growth/Enterprise`,
> `STARTER_TIER_MEMBER_LIMIT = 40`, `GROWTH_TIER_MEMBER_LIMIT = 190`,
> `PAYHERE_ENTERPRISE_PRICE_LKR`).
>
> **Complimentary (lifetime) subscriptions:** a paid tier provisioned manually
> (enterprise/active, no gateway subscription, no period end) — `isComplimentary()`.
> Never billed, immune to dunning (both WHERE clauses require a period end), and
> all self-service billing controls are disabled in the UI + rejected by the
> checkout/cancel APIs. Provision via `save_gym_subscription(gym, 'enterprise',
> 'active', NULL, NULL, false)`.

---

## 1. Schema

Migrations `20260704000001..3`:

| Object | Purpose |
|---|---|
| `gyms.subscription_tier` (`text` CHECK `starter\|growth\|enterprise`), `gyms.subscription_status` (`text` CHECK `active\|past_due\|canceled`) | Tenant billing state. Text + CHECK, not enums — tier additions/renames stay transactional (C-19). |
| `gyms.payhere_subscription_id / payhere_customer_id / current_period_end / member_count` | Gateway ids, paid-through boundary (always DB-clock), denormalized quota counter. |
| `checkout_intents` | order_id → gym attribution for webhooks; one `pending` per gym (partial unique index → concurrent checkout 409s). |
| `saas_payment_logs` | Webhook audit + idempotency anchor (partial unique on `payhere_payment_id`) + gym billing history. `message_type`/`status_message` promoted for classification (C-22). `raw_payload.md5sig` always `[REDACTED]` (C-24). |
| `prevent_subscription_self_update` trigger | Column-write guard: subscription columns (incl. `member_count`) writable only by `postgres`/`service_role` — allow-list, fails closed (C-14). |
| `register_member_guarded(gym_id, member)` | **The single member-quota authority.** `FOR UPDATE` on the gyms row serializes registrations. service_role-only EXECUTE. |
| `save_gym_subscription(...)` | Single-clock subscription writer; `p_extend_period=true` sets `current_period_end = now() + 1 month` **on the DB clock** (supabase-js cannot express SQL expressions — C-18/C-23). |
| `process_dunning_downgrades(grace_days)` | Set-based dunning (see §3). |

## 2. State machine

Legal `(tier, status)` pairs: starter/{active,canceled} + {growth,enterprise}/{active,past_due,canceled}. Domain entity: `src/core/domain/subscription/Subscription.ts`.

Transitions are generalized over the paid tiers (`{paid}` = growth|enterprise);
`activatePaid(targetTier)` provisions the tier the checkout intent priced.

```
starter/active ──activatePaid──▶ {paid}/active ◀──renew(recovery)── {paid}/past_due
starter/canceled ─activatePaid─▶     │                                     ▲
{paid}/canceled ──activatePaid─▶     │──markPastDue──────────────────────▶─┘
                                     │──cancelPaid──▶ {paid}/canceled
{paid}/past_due ──cancelPaid───▶ {paid}/canceled
{paid}/past_due (grace over) ──downgradeToStarter──▶ starter/canceled   (dunning cron only)
{paid}/canceled (period over) ─downgradeToStarter──▶ starter/canceled   (dunning cron only)
```

- `renew()` is a **non-transition** (§2.5.1): installment success on active/past_due; never from
  canceled (a stale installment must not un-cancel — C-21).
- Voluntary cancel keeps the paid tier **until `current_period_end`, no grace**; involuntary
  failure gets `GRACE_PERIOD_DAYS` (7) of grace after `current_period_end`.
- A live paid subscription blocks a new checkout — a plan change (e.g. Growth→Enterprise) requires
  cancelling first (PayHere has no in-place plan swap).
- Quota matrix (mirrored in SQL and `canAddMember`, cap from the PlanRestrictions matrix):
  starter → `member_count < 40` · growth → `< 190` (subject to live-sub state) · enterprise → ∞ ·
  paid/past_due → until period+grace · paid/canceled → until period end · **complimentary → ∞,
  always** (status active, no period end).
- **No code path ever deletes members.** Over-limit gyms keep everything; only new inserts block.

## 3. Webhook contract (`POST /api/webhooks/payhere`)

- Form-urlencoded only; `md5sig` verified over the raw received strings before anything else.
- **HTTP status is never derived from PayHere's `status_code`.** 200 for: success, pending, failed
  payment, duplicate delivery, unresolved gym, invalid signature, garbage body. 500 **only** for
  transient faults (DB down) so PayHere retries.
- Guard chain (normative, `HandlePayHereWebhook`): resolve gym (intent → subscription_id →
  `custom_1`) → idempotency (`payhere_payment_id` unique) → identity guard (non-intent mutations
  require the event's `subscription_id` to equal the stored one — C-21) → cancel reconciliation
  (`RECURRING_STOPPED`/`item_rec_status=-1`) → status branch.
- Amount assertion before any intent-driven provisioning (signed amount must equal the intent's
  `expected_amount`).
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

## 4. Dunning (`POST /api/cron/process-dunning`, daily 00:45 UTC)

1. `{growth,enterprise}/past_due` with `current_period_end + 7d < now()` → `starter/canceled`, gateway id cleared.
2. `{growth,enterprise}/canceled` with `current_period_end < now()` → tier `starter` (status stays `canceled`).
3. Stale pending checkout intents → `expired`.

All decisions in SQL on the DB clock; idempotent; logged via `CronLogger` (visible in the
system-health CronStatusGrid). Failure classification (C-22): PayHere exposes no card-network
decline codes — `classifyRecurringFailure` maps `-2`→`retriable` (PayHere retries), `-1/-3/
RECURRING_STOPPED`→`hard`. The class drives banner copy only, never state.

## 5. Cancel flow

`POST /api/billing/cancel` → `CancelSubscription`: **gateway first** (PayHere OAuth
`subscription/cancel`, idempotent on already-cancelled), then local `{paid}/canceled`. Gateway failure
leaves local state untouched. Final confirmation via the next `RECURRING_STOPPED` webhook.
**No manual "retry charge" is exposed** (C-26): card-network retry budgets (Visa 15/30d;
Mastercard fees past 35/30d) are PayHere's liability only while PayHere owns all retries. If a
retry button is ever added, cap it (≤1/24h per subscription, ≤2 per past_due episode).

## 6. Surfaces

| Surface | Auth | Notes |
|---|---|---|
| `/settings/billing` page | JWT | Plan card, pricing, upgrade/cancel dialogs, return-flow poll (10s → PENDING_CONFIRMATION, never "failure"), history |
| `GET /api/settings/subscription` | JWT | Serialized state + sanitized `pastDueReason` + `proPriceLkr` meta |
| `GET /api/billing/history` | JWT | `saas_payment_logs` is authoritative for the gym UI (C-12); whitelisted fields only |
| `POST /api/billing/checkout` / `cancel` | JWT | Admin-container writes after `getCurrentGymProfile()` pins the gym (C-15) |
| `GET /api/admin/system-health/billing-failures` | SaaS admin session (`saas_admins`) | Full technical detail lives HERE ONLY — never gym-facing |
| Member quota | — | 403 `MEMBER_LIMIT_REACHED` from `/api/members` (+bulk per-row `errorCode`) → inline upgrade upsell |

## 6.1 Plan restrictions (Starter feature switches)

**Single source of truth: `src/core/domain/subscription/PlanRestrictions.ts`**
(the capability matrix). Tier conditionals are never written anywhere else;
adding a tier to `SaasTier` breaks compilation until the matrix is extended.

| Capability | Starter | Growth | Server authority | UX layer |
|---|---|---|---|---|
| `maxMembers` | 40 | 190 (Growth) · ∞ (Enterprise) | `register_member_guarded` (SQL, unchanged) | `StarterLimitBar` (site-wide slots counter + Upgrade CTA, hidden on `/settings/*`), quota upsell |
| `automatedReminders` | ✗ | ✓ | `SendAutomatedReminders` skips restricted gyms (one tier lookup per distinct gym, fail-closed; `membersSkippedPlanRestricted` in the cron summary) | — |
| `announcements` | ✗ | ✓ | `POST /api/announcements` → 403 `FEATURE_NOT_AVAILABLE` before any work (fail-closed) | `/make-announcement` renders `FeatureGate` upgrade panel; composer never mounts |

The serializer exposes `capabilities` + `remainingMemberSlots` (dual-key) so
every client gate reads server-computed flags — never local tier math. The
Growth avatar ring (`GrowthAvatarRing`, header) is the positive marker on the
paid side of the same matrix.

## 7. Deployment runbook (REQUIRED config)

1. **Env** (see `.env.example`): `PAYHERE_MODE/MERCHANT_ID/MERCHANT_SECRET/PRO_PRICE_LKR/APP_ID/APP_SECRET`.
2. **PayHere dashboard**: whitelist the app domain for the Merchant Secret AND for the API key
   (App ID). **Live** REST (cancel) additionally requires server IP whitelisting via
   `support@payhere.lk`.
3. **Edge rate limit (C-27, required)**: per-IP limit on `/api/webhooks/payhere` at ~5× expected
   peak (legitimate volume ≈ one notification per gym per month + retries; 60 req/min/IP is
   generous). Rate-limit, don't IP-allowlist — PayHere publishes no stable origin ranges.
4. **Sandbox testing**: `notify_url` cannot be localhost — tunnel the dev server (e.g. ngrok) and
   set `NEXT_PUBLIC_APP_URL` to the tunnel origin.
5. **Migrations**: apply `20260704000001..3` in order; verify per plan §4 (backfill equality,
   double-apply behavior, trigger fail-closed probe, `EXPLAIN` index-only cap count).

## 8. Testing

- Unit: `npx jest` — domain matrix, crypto vectors, use-case branch table, serializer, UI states.
- Integration (`npm run test:integration`): **gated** on `INTEGRATION_TESTS=1` +
  `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` against a **disposable** database with
  migrations applied. Covers webhook idempotency/recovery-anchor/identity-guard/flood-cap, 60-way
  quota race, dunning branches (members preserved), checkout race, cancel ordering.
- E2E (`npm run test:e2e`): gated on `E2E_BILLING=1` + seeded gym login + PayHere env matching the
  dev server; per-state specs additionally gate on `E2E_PRO_GYM`/`E2E_PAST_DUE_GYM`/
  `E2E_AT_LIMIT_GYM`. Webhooks are simulated with correctly signed bodies — PayHere is never driven.

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
