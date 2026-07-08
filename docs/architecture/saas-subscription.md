# SaaS Subscription Billing Pattern (§2.13)

> On-demand reference. Not auto-injected.
> **Rule:** SaaS billing state lives on `gyms` behind guarded domain methods; the **active**-member
> quota has exactly one authority (`assert_gym_can_add_active_member`); PayHere webhooks are
> synchronous, idempotent, and always return 200 for business outcomes.

Full contract, threat model and runbook: `docs/SAAS_SUBSCRIPTION_IMPLEMENTATION.md`.
Design rationale (conflict register C-1..C-27):
`docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md`.

## Non-negotiable constraints

1. **Caps are ACTIVE members** (Starter 40 / Growth 190 / Enterprise ∞), **grace = 7 days**
   (tiers renamed free/pro -> starter/growth, 20260706000002; active-only quota 20260708000001) —
   single source `src/core/utils/constants/SubscriptionConfig.ts`; SQL literals carry back-reference
   comments. Only members with `status = 'active'` count toward the cap; expired/suspended/cancelled
   members are unlimited on every tier (gyms are never pressured to delete history). `gyms.member_count`
   is the trigger-maintained active count. Unpaid actives expire 7 days past `next_due_date`
   (`MEMBER_EXPIRY_GRACE_DAYS`, cron `update-expired-status`) and drop out of the count.
2. **Quota authority**: exactly one allowance check, `assert_gym_can_add_active_member` (FOR UPDATE
   on the gyms row). It gates every into-active write: registration of an active member (via
   `register_member_guarded`) and any status flip into active (via the `trg_enforce_active_member_quota`
   BEFORE trigger — reactivation, payment-collection on an expired member). At the cap it raises
   `MEMBER_LIMIT_REACHED` (→ `MemberLimitError` → 403). Serialized `canAddMember` is display-only.
   Registering or keeping a NON-active member is never quota-blocked. Never add a second allowance path.
3. **Webhook 200-contract**: HTTP status is never derived from PayHere's `status_code`; 200 for
   handled/duplicate/unresolved/invalid-signature; 500 only for transient faults. Idempotency
   anchor = unique `payhere_payment_id`; identity guard = event `subscription_id` must match the
   stored one for non-intent mutations.
4. **Single clock**: `current_period_end` is written only by `save_gym_subscription` /
   `process_dunning_downgrades` on the DB clock. No JS date math for billing boundaries; never
   trust unsigned gateway date fields.
5. **Dunning is the only downgrade path** (`pro/past_due` past grace, `pro/canceled` past period).
   The webhook only marks `past_due`. **Members are never deleted or modified by billing code.**
6. **Cancel is gateway-first**: PayHere `subscription/cancel` succeeds (or is already cancelled)
   BEFORE the local `pro/canceled` write.
7. **Secrets & sanitization**: Merchant Secret / App Secret / OAuth tokens / `md5sig` never reach
   clients or logs (`raw_payload.md5sig` is redacted — load-bearing for replay defense). Raw
   `status_message` is admin-only; gym clients see the `RecurringFailureClass` token.
8. **Subscription columns are service-role-only** at the DB layer
   (`prevent_subscription_self_update`, allow-list `postgres`/`service_role`, fails closed).
