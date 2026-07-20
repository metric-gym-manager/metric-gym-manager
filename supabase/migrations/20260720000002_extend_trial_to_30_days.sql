-- Migration: extend the new-gym trial window from 14 to 30 days
--
-- New-gym onboarding is a trial STATUS (20260708000003): gyms start
-- lite/trialing with trial_ends_at set by the column DEFAULT at signup. This
-- migration re-anchors that DEFAULT to a 30-day window.
--
-- Self-serve onboarding is Lite/Pro only (Enterprise is contact-sales and
-- never enters the trial flow), so the longer trial applies to Lite and Pro.
--
-- TS mirror: TRIAL_PERIOD_DAYS = 30 (SubscriptionConfig.ts). Keep in lock-step.
--
-- Only the DEFAULT changes: the trial-expiry cron (20260708000006) trusts the
-- per-row clock, so existing trialing gyms keep the clock they were given at
-- signup. New signups after this migration get the 30-day window.

ALTER TABLE gyms
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '30 days');

COMMENT ON COLUMN gyms.trial_ends_at IS
  'Trial-window boundary (TRIAL_PERIOD_DAYS = 30, SubscriptionConfig.ts). Set by DEFAULT at signup; meaningful while subscription_status = trialing. The trial-expiry cron (20260708000006) suspends trialing gyms past it.';
