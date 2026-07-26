-- ROLLBACK for migrations 20260726000001 / 20260726000002 / 20260726000003
--
-- Run this ONLY to reverse the security-hardening migrations. It restores the
-- pre-2026-07-26 state exactly, INCLUDING the vulnerabilities those migrations
-- closed. Every function body below was captured verbatim from the live
-- production database (pg_get_functiondef) on 2026-07-26 before any change.
--
-- Usage: paste into the Supabase SQL editor, or
--        psql "$SUPABASE_DB_URL" -f scripts/security/rollback-20260726-phase0.sql
--
-- ⚠  Re-granting these functions to anon/authenticated restores a live billing
--    bypass (save_gym_subscription) and cross-tenant PII reads. Only do this if
--    the hardening broke something you cannot fix forward.
--
-- Reversal order is the inverse of application order: 03 → 02 → 01.

BEGIN;

-- ===========================================================================
-- Reverse 20260726000003 — function default hardening
-- ===========================================================================

-- Restore Supabase's stock default privilege (functions born anon-callable)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

-- Unpin search_path on project functions (restores proconfig = NULL)
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proconfig IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) RESET search_path', fn.proname, fn.args);
  END LOOP;
END;
$$;

-- ===========================================================================
-- Reverse 20260726000002 — recreate phone_verifications
-- ===========================================================================
-- NOTE: the table was dropped with 0 rows, so no data is being restored — only
-- the (deliberately permissive, insecure) structure and policies.

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number character varying NOT NULL,
  otp_code     character varying NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  verified     boolean DEFAULT false,
  attempts     integer DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz DEFAULT now(),
  verified_at  timestamptz
);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert verifications"
  ON public.phone_verifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own verifications"
  ON public.phone_verifications FOR SELECT
  USING ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can update own verifications"
  ON public.phone_verifications FOR UPDATE
  USING ((auth.uid() = user_id) OR (user_id IS NULL));

-- ===========================================================================
-- Reverse 20260726000001 — restore the 8 dropped functions
-- ===========================================================================
-- Captured verbatim from production 2026-07-26. Note that get_overdue_members
-- and get_upcoming_due_members declare `plan_type member_plan_type` in their
-- RETURNS TABLE while members.plan_type is now `text` (changed by
-- 20260301052657_allow_custom_plan_types) — these functions were very likely
-- already failing at runtime, which is consistent with having zero callers.

CREATE OR REPLACE FUNCTION public.is_gym_owner(p_gym_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM gyms WHERE id = p_gym_id AND user_id = auth.uid()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
 RETURNS void LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM phone_verifications WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_announcement_failures()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  UPDATE announcements
  SET session_failures = '[]'::jsonb
  WHERE sent_at < NOW() - INTERVAL '24 hours'
    AND session_failures != '[]'::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_expire_overdue_members()
 RETURNS TABLE(expired_count integer, gym_id uuid, gym_name text)
 LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_updated_count INTEGER;
BEGIN
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

  RETURN QUERY
  WITH expired_summary AS (
    SELECT COUNT(*)::INTEGER AS count, m.gym_id, g.gym_name
    FROM members m
    JOIN gyms g ON g.id = m.gym_id
    WHERE m.status = 'expired'
      AND m.updated_at >= NOW() - INTERVAL '1 minute'
    GROUP BY m.gym_id, g.gym_name
  )
  SELECT * FROM expired_summary;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_member_payment_history(p_member_id uuid)
 RETURNS TABLE(payment_id uuid, payment_date date, amount_paid numeric,
               discount_applied text, discount_percentage integer,
               next_due_date_calculated date, created_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.payment_date, p.amount_paid, p.discount_applied,
         p.discount_percentage, p.next_due_date_calculated, p.created_at
  FROM payments p
  WHERE p.member_id = p_member_id
  ORDER BY p.payment_date DESC, p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_overdue_members(p_gym_id uuid)
 RETURNS TABLE(member_id uuid, member_name text, phone_number text,
               plan_type member_plan_type, plan_amount numeric,
               next_due_date date, days_overdue integer, status member_status)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.id, m.name, m.phone_number, m.plan_type, m.plan_amount, m.next_due_date,
         (CURRENT_DATE - m.next_due_date)::INTEGER, m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date < CURRENT_DATE - INTERVAL '7 days'
  ORDER BY m.next_due_date ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_upcoming_due_members(p_gym_id uuid, p_days_ahead integer DEFAULT 7)
 RETURNS TABLE(member_id uuid, member_name text, phone_number text,
               plan_type member_plan_type, plan_amount numeric,
               next_due_date date, days_until_due integer, status member_status)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.id, m.name, m.phone_number, m.plan_type, m.plan_amount, m.next_due_date,
         (m.next_due_date - CURRENT_DATE)::INTEGER, m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
  ORDER BY m.next_due_date ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_revenue_stats(p_gym_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(total_collected numeric, total_projected numeric,
               payment_count integer, active_member_count integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(p.amount_paid), 0)::DECIMAL,
    COALESCE(SUM(m.plan_amount *
      CASE m.plan_type
        WHEN 'daily'   THEN (p_end_date - p_start_date + 1)
        WHEN 'monthly' THEN CEILING((p_end_date - p_start_date + 1) / 30.0)
        WHEN 'annual'  THEN CEILING((p_end_date - p_start_date + 1) / 365.0)
      END), 0)::DECIMAL,
    COUNT(DISTINCT p.id)::INTEGER,
    COUNT(DISTINCT m.id)::INTEGER
  FROM members m
  LEFT JOIN payments p ON p.member_id = m.id
    AND p.payment_date BETWEEN p_start_date AND p_end_date
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.membership_start_date <= p_end_date;
END;
$function$;

-- Restore the explicit anon/authenticated grants that were revoked
GRANT EXECUTE ON FUNCTION public.register_member_guarded(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_gym_subscription(uuid, text, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_gym_can_add_active_member(uuid) TO anon, authenticated;

COMMIT;
