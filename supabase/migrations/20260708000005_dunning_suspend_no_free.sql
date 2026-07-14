-- Migration: dunning SUSPENDS — process_dunning_downgrades is REPLACED by
-- process_dunning_suspensions
--
-- With the free tier removed (20260708000003) there is no downgrade landing
-- tier. On grace expiry (involuntary failure) or lapse of a voluntary cancel,
-- the gym's subscription_status becomes 'suspended' and the TIER IS PRESERVED.
-- No tier write happens anywhere in dunning anymore.
--
-- payhere_subscription_id is RETAINED on suspension: PayHere may still
-- deliver a late successful retry for the same subscription, and the webhook
-- reactivates the account through the C-21 identity guard. A new checkout
-- replaces the id on activation.
--
-- Complimentary (lifetime) rows stay immune: both WHERE clauses require a
-- period end, and comped rows have current_period_end IS NULL.
--
-- Members are NEVER touched by any dunning branch.
--
-- TS mirror: Subscription.suspend() (SubscriptionConfig.ts / Subscription.ts),
-- ProcessDunning use case, SupabaseGymSubscriptionRepository.runDunningSuspensions.

-- ============================================================
-- PART 1: REPLACE THE DOWNGRADE FUNCTION WITH THE SUSPEND FUNCTION
-- ============================================================

DROP FUNCTION IF EXISTS process_dunning_downgrades(integer);

CREATE FUNCTION process_dunning_suspensions(p_grace_days integer)
RETURNS TABLE (suspended_past_due integer, suspended_canceled integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_past_due integer;
  v_canceled integer;
BEGIN
  -- 1. Grace expired after involuntary failure -> suspend (tier preserved)
  --    p_grace_days is passed from GRACE_PERIOD_DAYS (SubscriptionConfig.ts)
  UPDATE gyms
  SET subscription_status = 'suspended'
  WHERE subscription_status = 'past_due'
    AND current_period_end IS NOT NULL
    AND current_period_end + (interval '1 day' * p_grace_days) < now();
  GET DIAGNOSTICS v_past_due = ROW_COUNT;

  -- 2. Voluntary cancel reached period end -> suspend (no grace; user chose this)
  UPDATE gyms
  SET subscription_status = 'suspended'
  WHERE subscription_status = 'canceled'
    AND current_period_end IS NOT NULL AND current_period_end < now();
  GET DIAGNOSTICS v_canceled = ROW_COUNT;

  RETURN QUERY SELECT v_past_due, v_canceled;
END;
$$;

-- ============================================================
-- PART 2: EXECUTE GRANTS — SERVICE ROLE ONLY
-- ============================================================

REVOKE ALL ON FUNCTION process_dunning_suspensions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_dunning_suspensions(integer) TO service_role;

COMMENT ON FUNCTION process_dunning_suspensions IS
  'Set-based dunning on the DB clock: past_due beyond grace and lapsed canceled become SUSPENDED — tier preserved, no downgrade landing tier exists. Complimentary rows (NULL period end) are untouchable. Members never touched.';
