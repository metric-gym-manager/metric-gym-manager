-- Application functions, public schema (backup 2026-07-16)
-- pg_trgm extension-owned functions (gin_*/gtrgm_*/similarity*/word_similarity*/show_*/set_limit)
-- are omitted; CREATE EXTENSION pg_trgm (00_extensions.sql) recreates them.

CREATE OR REPLACE FUNCTION public.assert_gym_can_add_active_member(p_gym_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  g          RECORD;
  v_cap      integer;
  within_cap boolean;
  allowed    boolean := false;
BEGIN
  SELECT subscription_tier, subscription_status, member_count, current_period_end
    INTO g FROM gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;

  v_cap := CASE g.subscription_tier
             WHEN 'lite'       THEN 100
             WHEN 'pro'        THEN NULL
             WHEN 'enterprise' THEN NULL
           END;
  within_cap := (v_cap IS NULL OR g.member_count < v_cap);

  IF g.subscription_status IN ('trialing', 'active') THEN
    allowed := within_cap;
  ELSIF g.subscription_status = 'past_due' THEN
    allowed := within_cap AND (g.current_period_end IS NOT NULL
                AND now() <= g.current_period_end + (interval '1 day' * 7));
  ELSIF g.subscription_status = 'canceled' THEN
    allowed := within_cap AND
               (g.current_period_end IS NOT NULL AND now() <= g.current_period_end);
  ELSE
    allowed := false;
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'MEMBER_LIMIT_REACHED'; END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_expire_overdue_members()
 RETURNS TABLE(expired_count integer, gym_id uuid, gym_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update members who are more than 7 days overdue
  WITH updated AS (
    UPDATE members m
    SET status = 'expired', updated_at = NOW()
    WHERE m.status = 'active'
      AND m.next_due_date < CURRENT_DATE - INTERVAL '7 days'
    RETURNING m.gym_id
  )
  SELECT COUNT(*)::INTEGER, u.gym_id
  INTO v_updated_count, gym_id
  FROM updated u
  GROUP BY u.gym_id;

  -- Return summary of expired members by gym
  RETURN QUERY
  WITH expired_summary AS (
    SELECT
      COUNT(*)::INTEGER AS count,
      m.gym_id,
      g.gym_name
    FROM members m
    JOIN gyms g ON g.id = m.gym_id
    WHERE m.status = 'expired'
      AND m.updated_at >= NOW() - INTERVAL '1 minute' -- Just updated
    GROUP BY m.gym_id, g.gym_name
  )
  SELECT * FROM expired_summary;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_next_due_date(p_plan_type member_plan_type, p_start_date date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  RETURN CASE p_plan_type
    WHEN 'daily' THEN p_start_date + INTERVAL '1 day'
    WHEN 'monthly' THEN p_start_date + INTERVAL '30 days'
    WHEN 'annual' THEN p_start_date + INTERVAL '365 days'
  END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_payment_amount(p_plan_amount numeric, p_discount_percentage integer DEFAULT NULL::integer)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF p_discount_percentage IS NULL OR p_discount_percentage = 0 THEN
    RETURN p_plan_amount;
  END IF;

  RETURN ROUND(p_plan_amount * (100 - p_discount_percentage) / 100, 2);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM phone_verifications
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_announcement_failures()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE announcements
  SET session_failures = '[]'::jsonb
  WHERE sent_at < NOW() - INTERVAL '24 hours'
    AND session_failures != '[]'::jsonb;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_active_member_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status <> 'active') THEN
    PERFORM assert_gym_can_add_active_member(NEW.gym_id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_member_payment_history(p_member_id uuid)
 RETURNS TABLE(payment_id uuid, payment_date date, amount_paid numeric, discount_applied text, discount_percentage integer, next_due_date_calculated date, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS payment_id,
    p.payment_date,
    p.amount_paid,
    p.discount_applied,
    p.discount_percentage,
    p.next_due_date_calculated,
    p.created_at
  FROM payments p
  WHERE p.member_id = p_member_id
  ORDER BY p.payment_date DESC, p.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_overdue_members(p_gym_id uuid)
 RETURNS TABLE(member_id uuid, member_name text, phone_number text, plan_type member_plan_type, plan_amount numeric, next_due_date date, days_overdue integer, status member_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.phone_number,
    m.plan_type,
    m.plan_amount,
    m.next_due_date,
    (CURRENT_DATE - m.next_due_date)::INTEGER AS days_overdue,
    m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date < CURRENT_DATE - INTERVAL '7 days'
  ORDER BY m.next_due_date ASC; -- Most overdue first
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_revenue_stats(p_gym_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(total_collected numeric, total_projected numeric, payment_count integer, active_member_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    -- Total collected revenue
    COALESCE(SUM(p.amount_paid), 0)::DECIMAL AS total_collected,

    -- Total projected revenue (all active members in period)
    COALESCE(
      SUM(m.plan_amount *
        CASE m.plan_type
          WHEN 'daily' THEN (p_end_date - p_start_date + 1)
          WHEN 'monthly' THEN CEILING((p_end_date - p_start_date + 1) / 30.0)
          WHEN 'annual' THEN CEILING((p_end_date - p_start_date + 1) / 365.0)
        END
      ), 0
    )::DECIMAL AS total_projected,

    -- Payment count
    COUNT(DISTINCT p.id)::INTEGER AS payment_count,

    -- Active member count
    COUNT(DISTINCT m.id)::INTEGER AS active_member_count

  FROM members m
  LEFT JOIN payments p ON p.member_id = m.id
    AND p.payment_date BETWEEN p_start_date AND p_end_date
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.membership_start_date <= p_end_date;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_upcoming_due_members(p_gym_id uuid, p_days_ahead integer DEFAULT 7)
 RETURNS TABLE(member_id uuid, member_name text, phone_number text, plan_type member_plan_type, plan_amount numeric, next_due_date date, days_until_due integer, status member_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.phone_number,
    m.plan_type,
    m.plan_amount,
    m.next_due_date,
    (m.next_due_date - CURRENT_DATE)::INTEGER AS days_until_due,
    m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
  ORDER BY m.next_due_date ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_gym_owner(p_gym_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM gyms
    WHERE id = p_gym_id
    AND user_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_subscription_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') AND (
       NEW.subscription_tier       IS DISTINCT FROM OLD.subscription_tier
    OR NEW.subscription_status     IS DISTINCT FROM OLD.subscription_status
    OR NEW.payhere_customer_id     IS DISTINCT FROM OLD.payhere_customer_id
    OR NEW.payhere_subscription_id IS DISTINCT FROM OLD.payhere_subscription_id
    OR NEW.current_period_end      IS DISTINCT FROM OLD.current_period_end
    OR NEW.member_count            IS DISTINCT FROM OLD.member_count
    OR NEW.trial_ends_at           IS DISTINCT FROM OLD.trial_ends_at
    OR NEW.next_charge_at          IS DISTINCT FROM OLD.next_charge_at
  ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_COLUMNS_READONLY';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_dunning_suspensions(p_grace_days integer)
 RETURNS TABLE(suspended_past_due integer, suspended_canceled integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_past_due integer;
  v_canceled integer;
BEGIN
  UPDATE gyms
  SET subscription_status = 'suspended', next_charge_at = NULL
  WHERE subscription_status = 'past_due'
    AND current_period_end IS NOT NULL
    AND current_period_end + (interval '1 day' * p_grace_days) < now();
  GET DIAGNOSTICS v_past_due = ROW_COUNT;

  UPDATE gyms
  SET subscription_status = 'suspended', next_charge_at = NULL
  WHERE subscription_status = 'canceled'
    AND current_period_end IS NOT NULL AND current_period_end < now();
  GET DIAGNOSTICS v_canceled = ROW_COUNT;

  RETURN QUERY SELECT v_past_due, v_canceled;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_trial_expiry()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_suspended integer;
BEGIN
  UPDATE gyms
  SET subscription_status = 'suspended', next_charge_at = NULL
  WHERE subscription_status = 'trialing'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now();
  GET DIAGNOSTICS v_suspended = ROW_COUNT;

  RETURN v_suspended;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.register_member_guarded(p_gym_id uuid, p_member jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_status member_status;
  new_id   uuid;
BEGIN
  v_status := COALESCE(NULLIF(p_member->>'status', '')::member_status, 'active');

  IF v_status = 'active' THEN
    PERFORM assert_gym_can_add_active_member(p_gym_id);
  ELSE
    PERFORM 1 FROM gyms WHERE id = p_gym_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  END IF;

  INSERT INTO members (
    gym_id, name, phone_number, plan_type, plan_amount, discount_id,
    recurring_discount, status, registered_date, membership_start_date, next_due_date
  )
  VALUES (
    p_gym_id,
    p_member->>'name',
    p_member->>'phone_number',
    (p_member->>'plan_type')::member_plan_type,
    (p_member->>'plan_amount')::numeric,
    NULLIF(p_member->>'discount_id', '')::uuid,
    COALESCE((p_member->>'recurring_discount')::boolean, false),
    v_status,
    COALESCE(NULLIF(p_member->>'registered_date', '')::date, CURRENT_DATE),
    COALESCE(NULLIF(p_member->>'membership_start_date', '')::date, CURRENT_DATE),
    (p_member->>'next_due_date')::date
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_gym_subscription(p_gym_id uuid, p_tier text, p_status text, p_payhere_subscription_id text, p_payhere_customer_id text, p_extend_period boolean)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_period_end timestamptz;
BEGIN
  UPDATE gyms SET
    subscription_tier       = p_tier,
    subscription_status     = p_status,
    payhere_subscription_id = p_payhere_subscription_id,
    payhere_customer_id     = p_payhere_customer_id,
    current_period_end      = CASE WHEN p_extend_period
                              THEN GREATEST(COALESCE(current_period_end, now()), now())
                                   + interval '1 month'
                              ELSE current_period_end END,
    next_charge_at          = CASE
                              WHEN p_status IN ('canceled', 'suspended', 'trialing') THEN NULL
                              WHEN p_extend_period AND p_status = 'active'
                                   AND p_payhere_customer_id IS NOT NULL
                                   AND p_payhere_subscription_id IS NULL
                                THEN GREATEST(COALESCE(current_period_end, now()), now())
                                     + interval '1 month'
                              ELSE next_charge_at END
  WHERE id = p_gym_id
  RETURNING current_period_end INTO v_period_end;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  RETURN v_period_end;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.schedule_charge_retry(p_gym_id uuid, p_retry_interval_days integer, p_grace_days integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_next timestamptz;
BEGIN
  UPDATE gyms SET
    next_charge_at = CASE
      WHEN current_period_end IS NOT NULL
           AND now() + (interval '1 day' * p_retry_interval_days)
               <= current_period_end + (interval '1 day' * p_grace_days)
        THEN now() + (interval '1 day' * p_retry_interval_days)
      ELSE NULL
    END
  WHERE id = p_gym_id
  RETURNING next_charge_at INTO v_next;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  RETURN v_next;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_gym_member_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'active' THEN
      UPDATE gyms SET member_count = member_count + 1 WHERE id = NEW.gym_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.status = 'active' AND NEW.status <> 'active' THEN
      UPDATE gyms SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.gym_id;
    ELSIF OLD.status <> 'active' AND NEW.status = 'active' THEN
      UPDATE gyms SET member_count = member_count + 1 WHERE id = NEW.gym_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.status = 'active' THEN
      UPDATE gyms SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.gym_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
