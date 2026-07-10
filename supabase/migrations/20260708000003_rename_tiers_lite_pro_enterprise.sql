-- Migration: paid-only tier ladder — starter/growth/enterprise -> lite/pro/enterprise
--
-- This is a RE-ANCHORING, not a rename. Starter was simultaneously the
-- default tier, the free tier and the dunning-downgrade landing tier; all
-- three roles are removed:
--   * every tier is paid (lite 2990 / pro 4990 / enterprise 6990 LKR/mo)
--   * new-gym onboarding is a TRIAL STATUS (trialing + trial clock), not a
--     default-free tier
--   * dunning SUSPENDS (status change, tier preserved) — see 20260708000005
--
-- Naming history (C-19 text+CHECK design; each swap was transactional):
--   free/pro (20260704*) -> starter/growth (20260706000002)
--   -> +enterprise (20260707000001) -> lite/pro/enterprise (this file).
-- The string 'pro' is REUSED for the new unlimited mid tier. Because
-- pro->growth already ran in 20260706000002, no historical row still carries
-- 'pro', so the reuse is collision-free.
--
-- TS mirror: src/core/utils/constants/SubscriptionConfig.ts
-- (SaasTier.Lite/'lite', SaasTier.Pro/'pro', SaasTier.Enterprise/'enterprise';
--  SaasStatus adds Trialing/'trialing' and Suspended/'suspended';
--  LITE_TIER_MEMBER_LIMIT = 100, TRIAL_PERIOD_DAYS = 14).
--
-- Deploy in the same release train as 20260708000004..6 AND the env flip:
-- PAYHERE_LITE_PRICE_LKR=2990 (new), PAYHERE_PRO_PRICE_LKR=4990 (repurposed —
-- previously Growth's 2990). See docs/DEPLOYMENT_PAYHERE_CHECKLIST.md.
--
-- Runs as postgres: the subscription column-guard trigger allow-lists
-- postgres/service_role, so the backfill UPDATEs pass it.

-- ============================================================
-- PART 1: TRIAL CLOCK COLUMN
-- New gyms start trialing; the DB default sets the clock at signup.
-- 14 days = TRIAL_PERIOD_DAYS (SubscriptionConfig.ts)
-- ============================================================

ALTER TABLE gyms
  ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days');

COMMENT ON COLUMN gyms.trial_ends_at IS
  'Trial-window boundary (TRIAL_PERIOD_DAYS = 14, SubscriptionConfig.ts). Set by DEFAULT at signup; meaningful while subscription_status = trialing. The trial-expiry cron (20260708000006) suspends trialing gyms past it.';

-- ============================================================
-- PART 2: DROP OLD CONSTRAINTS + DEFAULTS (swap is one transaction)
-- ============================================================

ALTER TABLE gyms DROP CONSTRAINT gyms_subscription_tier_check;
ALTER TABLE gyms DROP CONSTRAINT gyms_subscription_status_check;
ALTER TABLE gyms ALTER COLUMN subscription_tier DROP DEFAULT;
ALTER TABLE gyms ALTER COLUMN subscription_status DROP DEFAULT;

-- ============================================================
-- PART 3: DATA MIGRATION (plan §11)
--
-- enterprise                  -> enterprise (unchanged; gains access-control
--                                hardware via the capability matrix; 6990/mo)
-- growth, active count <= 100 -> lite  (price-neutral 2990->2990; the cap
--                                tightens 150->100 but these gyms fit)
-- growth, active count  > 100 -> pro   (cap removed). GRANDFATHERED AT THE
--                                LITE PRICE: PayHere fixes a recurring
--                                subscription's amount at creation, so an
--                                existing gateway subscription keeps charging
--                                2990 until the gym cancels or re-subscribes.
--                                No silent 2990->4990 charge can occur.
--                                OPS: notify any BILLED gym of the tier
--                                change. No-op at migration time: no gym
--                                carries a billed gateway subscription (the
--                                real accounts are complimentary/lifetime;
--                                the rows this branch matches are operator-
--                                created demo accounts).
-- starter (free, any status)  -> lite/trialing with a fresh 14-day trial
--                                window. Non-paying accounts get a full-
--                                feature window, then the trial-expiry cron
--                                suspends any that have not checked out.
-- ============================================================

-- growth overflow first (WHERE still matches 'growth')
UPDATE gyms
SET subscription_tier = 'pro'
WHERE subscription_tier = 'growth' AND member_count > 100;

UPDATE gyms
SET subscription_tier = 'lite'
WHERE subscription_tier = 'growth';

UPDATE gyms
SET subscription_tier   = 'lite',
    subscription_status = 'trialing',
    trial_ends_at       = now() + interval '14 days'   -- TRIAL_PERIOD_DAYS
WHERE subscription_tier = 'starter';

-- ============================================================
-- PART 4: NEW CONSTRAINTS + DEFAULTS
-- Legal pairs: {lite,pro,enterprise} x {trialing,active,past_due,suspended,canceled}
-- ============================================================

ALTER TABLE gyms
  ADD CONSTRAINT gyms_subscription_tier_check
  CHECK (subscription_tier IN ('lite', 'pro', 'enterprise'));          -- values = SaasTier

ALTER TABLE gyms
  ADD CONSTRAINT gyms_subscription_status_check
  CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'suspended', 'canceled')); -- values = SaasStatus

ALTER TABLE gyms ALTER COLUMN subscription_tier SET DEFAULT 'lite';
ALTER TABLE gyms ALTER COLUMN subscription_status SET DEFAULT 'trialing';

COMMENT ON COLUMN gyms.subscription_tier IS
  'SaaS billing tier (lite|pro|enterprise — all paid). Mirror: SubscriptionConfig.ts SaasTier';
COMMENT ON COLUMN gyms.subscription_status IS
  'SaaS billing status (trialing|active|past_due|suspended|canceled). Mirror: SubscriptionConfig.ts SaasStatus';

-- ============================================================
-- PART 5: checkout_intents.target_tier — same swap
-- In-flight growth intents map to PRO (the tier that preserves what they
-- bought: >100-member headroom at the 2990 they authorized; intents are
-- 30-minute TTL so this is a vanishing edge case).
-- ============================================================

ALTER TABLE checkout_intents DROP CONSTRAINT checkout_intents_target_tier_check;

UPDATE checkout_intents SET target_tier = 'pro'  WHERE target_tier = 'growth';
UPDATE checkout_intents SET target_tier = 'lite' WHERE target_tier = 'starter';

ALTER TABLE checkout_intents
  ADD CONSTRAINT checkout_intents_target_tier_check
  CHECK (target_tier IN ('lite', 'pro', 'enterprise'));                -- values = SaasTier
