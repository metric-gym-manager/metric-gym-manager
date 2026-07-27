# SaaS Subscription Billing Pattern (§2.13)

> On-demand reference. Not auto-injected.
> **Rule:** SaaS billing state lives on `gyms` behind guarded domain methods; the **active**-member
> quota has exactly one authority (`assert_gym_can_add_active_member`); PayHere webhooks are
> synchronous, idempotent, and always return 200 for business outcomes.

Full contract, threat model and runbook: `docs/reference/SAAS_SUBSCRIPTION_IMPLEMENTATION.md`.
Design rationale (conflict register C-1..C-33):
`docs/integrations/payhere/payhere-subscription-execution-plan.md`.

## Non-negotiable constraints

1. **PAID-ONLY ladder, caps are ACTIVE members** (Lite 100 / Pro ∞ / Enterprise ∞), **grace = 7
   days**, **trial = 30 days** (paid-only re-anchor 20260708000003 — prior tier-name lineage
   lives in that migration + C-28..C-30; active-only quota 20260708000001) — single source
   `src/features/subscriptions/config/SubscriptionConfig.ts`; SQL literals carry back-reference comments.
   Legal pairs: `{lite,pro,enterprise} × {trialing,active,past_due,suspended,canceled}` — no free
   tier exists. Only members with `status = 'active'` count toward the cap; expired/suspended/
   cancelled members are unlimited on every tier (gyms are never pressured to delete history).
   `gyms.member_count` is the trigger-maintained active count. Unpaid actives expire as soon as
   `next_due_date` is in the past — **no grace period** (cron `update-expired-status`) — and drop
   out of the count; 14 days past due they are auto-cancelled
   (`MEMBER_CANCELLATION_OVERDUE_DAYS`, cron `cancel-overdue-members`). Tier differentiators reduce to two axes: the Lite member cap and access-control
   hardware (Enterprise only, `PlanRestrictions`); reminders/announcements are universal.
2. **Onboarding is a trial STATUS, not a free tier**: signup lands `lite/trialing` with
   `gyms.trial_ends_at = now() + 30 days` (DB DEFAULT). Full features during the trial (within
   the tier cap). Checkout into any tier converts `trialing → active` (webhook UC-2); the
   trial-expiry cron (`process_trial_expiry`, UC-5) suspends trials that never checked out.
3. **Quota authority**: exactly one allowance check, `assert_gym_can_add_active_member` (FOR
   UPDATE on the gyms row). It gates every into-active write: registration of an active member
   (via `register_member_guarded`) and any status flip into active (via the
   `trg_enforce_active_member_quota` BEFORE trigger — reactivation, payment-collection on an
   expired member). Matrix: trialing/active → within cap; past_due → within cap while in grace;
   canceled → within cap while paid-through (until period end, NO grace — the customer keeps
   what they paid for); **suspended → blocked on every tier**. At the cap it raises
   `MEMBER_LIMIT_REACHED` (→ `MemberLimitError` → 403). Serialized `canAddMember` is display-only.
   Registering or keeping a NON-active member is never quota-blocked. Never add a second
   allowance path.
4. **Webhook 200-contract**: HTTP status is never derived from PayHere's `status_code`; 200 for
   handled/duplicate/unresolved/invalid-signature; 500 only for transient faults. Idempotency
   anchor = unique `payhere_payment_id`; identity guard = event `subscription_id` must match the
   stored one for non-intent mutations.
5. **Single clock, banked credit**: `current_period_end` is written only by
   `save_gym_subscription` / the dunning SQL on the DB clock; extension =
   `GREATEST(existing boundary, now()) + 1 month` — unused paid days are BANKED (C-33), past
   boundaries anchor at the charge date (C-23). `trial_ends_at` comes from its column DEFAULT;
   `next_charge_at` (the token-billing clock) only from the save RPC / `schedule_charge_retry` /
   the suspend crons. No JS date math for billing boundaries; never trust unsigned gateway
   date fields.
6. **This app is the biller (token model)**: checkout = PayHere Preapproval (first month +
   `customer_token`); the daily `charge-renewals` cron charges due tokens via the Charging API.
   Every server-initiated charge goes through the `saas_charge_attempts` ledger — pending row
   BEFORE the REST call, one pending per gym, ambiguous outcomes finalized by the signed
   webhook or expired after `CHARGE_ATTEMPT_TTL_HOURS` (C-32). Retries are capped
   (`RENEWAL_RETRY_INTERVAL_DAYS`, never beyond grace — C-26 is our liability now). Plan
   changes on a live subscription are one-click (`ChangePlan` → `switchPlan()`), charged to the
   stored token. Legacy recurring rows stay PayHere-driven (`next_charge_at` NULL).
7. **Dunning and trial expiry SUSPEND — the tier is PRESERVED** (there is no downgrade landing
   tier): `past_due` past grace and `canceled` past period end → `suspended`
   (`process_dunning_suspensions`); `trialing` past `trial_ends_at` → `suspended`
   (`process_trial_expiry`). The webhook only marks `past_due`. The gateway subscription id is
   retained on suspension so a late successful PayHere retry reactivates through the identity
   guard; a new checkout replaces it. **Members are never deleted or modified by billing code.**
8. **Cancel**: token-billed subs cancel locally (the app owns the schedule; `next_charge_at`
   cleared, saved card retained). Legacy recurring subs stay gateway-first: PayHere
   `subscription/cancel` succeeds BEFORE the local `canceled` write. Canceled keeps the tier
   paid-through until period end, then the dunning cron suspends.
9. **Secrets & sanitization**: Merchant Secret / App Secret / OAuth tokens / card tokens
   (`payhere_customer_id` — clients see only the `hasSavedCard` boolean) / `md5sig` never reach
   clients or logs (`raw_payload.md5sig` is redacted — load-bearing for replay defense). Raw
   `status_message` is admin-only; gym clients see the `RecurringFailureClass` token.
10. **Subscription columns are service-role-only** at the DB layer
    (`prevent_subscription_self_update` v2 — incl. `trial_ends_at`, `next_charge_at`;
    allow-list `postgres`/`service_role`, fails closed).
