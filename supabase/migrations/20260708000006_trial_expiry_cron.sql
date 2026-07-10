-- Migration: trial-expiry function — trialing past the trial clock -> suspended
--
-- New-gym onboarding is a trial STATUS (20260708000003): gyms start
-- lite/trialing with trial_ends_at = signup + 14 days (TRIAL_PERIOD_DAYS,
-- SubscriptionConfig.ts — the literal lives in the column DEFAULT, not here;
-- this function trusts the per-row clock).
--
-- A successful checkout converts trialing -> active (webhook, UC-2), so a row
-- still 'trialing' past its clock by definition never checked out — it is
-- suspended with the TIER PRESERVED, exactly like dunning (20260708000005).
-- Checkout from suspended reactivates.
--
-- Members are NEVER touched.
--
-- TS mirror: ProcessTrialExpiry use case (UC-5),
-- SupabaseGymSubscriptionRepository.runTrialExpiry, Subscription.suspend().

CREATE FUNCTION process_trial_expiry()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_suspended integer;
BEGIN
  UPDATE gyms
  SET subscription_status = 'suspended'
  WHERE subscription_status = 'trialing'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now();
  GET DIAGNOSTICS v_suspended = ROW_COUNT;

  RETURN v_suspended;
END;
$$;

REVOKE ALL ON FUNCTION process_trial_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_trial_expiry() TO service_role;

COMMENT ON FUNCTION process_trial_expiry IS
  'Set-based trial expiry on the DB clock: trialing gyms past trial_ends_at become SUSPENDED (tier preserved, members untouched). A checkout before expiry converts to active and never reaches here.';
