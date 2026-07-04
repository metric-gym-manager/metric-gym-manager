-- Migration: SaaS Free/Pro subscription schema (PayHere billing)
-- Plan: docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md (Phase DB, file 1)
--
-- Tier/status domains are text + CHECK, NOT Postgres enums (plan conflict C-19):
-- prior product intent points at >2 tiers, and ALTER TYPE ... ADD VALUE is
-- non-transactional, so it cannot ship in one transactional migration with
-- dependent DDL. A CHECK constraint swap is transactional.
-- TS mirror: src/core/utils/constants/SubscriptionConfig.ts

-- ============================================================
-- PART 1: TENANT SUBSCRIPTION COLUMNS
-- ============================================================

ALTER TABLE gyms
  ADD COLUMN subscription_tier       text NOT NULL DEFAULT 'free'
             CHECK (subscription_tier IN ('free', 'pro')),                     -- values = SaasTier
  ADD COLUMN subscription_status     text NOT NULL DEFAULT 'active'
             CHECK (subscription_status IN ('active', 'past_due', 'canceled')), -- values = SaasStatus
  ADD COLUMN payhere_customer_id     text,
  ADD COLUMN payhere_subscription_id text,
  ADD COLUMN current_period_end      timestamptz,
  ADD COLUMN member_count            integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX idx_gyms_payhere_subscription_id
  ON gyms (payhere_subscription_id) WHERE payhere_subscription_id IS NOT NULL;

-- Backfill the denormalized counter from live data
UPDATE gyms g
SET member_count = (SELECT count(*) FROM members m WHERE m.gym_id = g.id);

COMMENT ON COLUMN gyms.subscription_tier IS 'SaaS billing tier (free|pro). Mirror: SubscriptionConfig.ts SaasTier';
COMMENT ON COLUMN gyms.subscription_status IS 'SaaS billing status (active|past_due|canceled). Mirror: SubscriptionConfig.ts SaasStatus';
COMMENT ON COLUMN gyms.current_period_end IS 'Paid-through boundary; always set from the DB clock via save_gym_subscription()';
COMMENT ON COLUMN gyms.member_count IS 'Denormalized member counter maintained by trg_sync_gym_member_count; quota source read under FOR UPDATE';

-- ============================================================
-- PART 2: CHECKOUT INTENTS (order_id -> gym resolution for webhooks)
-- ============================================================

CREATE TABLE checkout_intents (
  order_id        text          PRIMARY KEY,
  gym_id          uuid          NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  target_tier     text          NOT NULL CHECK (target_tier IN ('free', 'pro')), -- values = SaasTier
  expected_amount numeric(12,2) NOT NULL,
  currency        text          NOT NULL DEFAULT 'LKR',
  status          text          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  expires_at      timestamptz   NOT NULL
);

-- At most one live pending intent per gym: a concurrent double-checkout hits 23505
CREATE UNIQUE INDEX idx_checkout_intents_one_pending_per_gym
  ON checkout_intents (gym_id) WHERE status = 'pending';

COMMENT ON TABLE checkout_intents IS 'Pending PayHere checkout attribution: webhook resolves order_id -> gym. Server-side plumbing; no gym-owner RLS policy.';

-- ============================================================
-- PART 3: SAAS PAYMENT AUDIT LOG
-- (named saas_payment_logs to avoid the member-facing `payments` table)
-- ============================================================

CREATE TABLE saas_payment_logs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                  uuid        REFERENCES gyms(id) ON DELETE SET NULL,
  order_id                text,
  -- NULL allowed: invalid-signature/garbage posts may omit it (plan conflict C-8)
  payhere_payment_id      text,
  payhere_subscription_id text,
  status_code             integer     NOT NULL,
  signature_valid         boolean     NOT NULL,
  -- Promoted from raw_payload for decline classification & admin triage (plan C-22)
  message_type            text,
  status_message          text,
  raw_payload             jsonb       NOT NULL,
  processed_at            timestamptz NOT NULL DEFAULT now()
);

-- Idempotency anchor (partial unique: NULL ids from invalid posts must not collide)
CREATE UNIQUE INDEX idx_saas_payment_logs_payment_id
  ON saas_payment_logs (payhere_payment_id) WHERE payhere_payment_id IS NOT NULL;

-- Admin failures view (status_code < 2 covers pending/canceled/failed/chargeback)
CREATE INDEX idx_saas_payment_logs_failures
  ON saas_payment_logs (processed_at) WHERE status_code < 2 OR signature_valid = false;

-- C-20 flood-cap counter: exact predicate so the hourly count plans index-only
CREATE INDEX idx_saas_payment_logs_invalid_sig
  ON saas_payment_logs (processed_at) WHERE signature_valid = false;

-- Gym-facing billing history (newest first)
CREATE INDEX idx_saas_payment_logs_gym ON saas_payment_logs (gym_id, processed_at DESC);

COMMENT ON TABLE saas_payment_logs IS 'PayHere webhook audit + idempotency anchor + gym billing history. raw_payload stores md5sig REDACTED (load-bearing for replay defense, plan C-24).';
