-- Member remarks + registration consents
--
-- 1. members.remarks — free-text note captured on the manual (desk) registration
--    form only. NULL for QR self-registrations and older members.
-- 2. members.accepted_terms_at / accepted_gym_rules_at — consent audit trail.
--    Set to the registration timestamp when the member ticked, respectively,
--    "accept Metric's privacy policy & terms of service" and "agree to the
--    gym's guidelines & rules". Both forms (manual + QR) require the ticks, so
--    these are normally non-null for members created after this migration; they
--    remain NULL for pre-existing members.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_gym_rules_at TIMESTAMPTZ;

COMMENT ON COLUMN members.remarks IS 'Free-text note from the manual desk registration form. NULL for QR self-registrations.';
COMMENT ON COLUMN members.accepted_terms_at IS 'When the member accepted Metric''s privacy policy & terms of service at registration.';
COMMENT ON COLUMN members.accepted_gym_rules_at IS 'When the member agreed to the gym''s guidelines & rules at registration.';

-- ============================================================
-- register_member_guarded v6 — insert surface now carries remarks + consents
-- (quota logic unchanged from v5; only the INSERT column list is extended).
-- ============================================================

CREATE OR REPLACE FUNCTION register_member_guarded(p_gym_id uuid, p_member jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status member_status;
  new_id   uuid;
BEGIN
  v_status := COALESCE(NULLIF(p_member->>'status', '')::member_status, 'active');

  IF v_status = 'active' THEN
    -- Locks the gyms row and raises MEMBER_LIMIT_REACHED / GYM_NOT_FOUND.
    -- (The BEFORE trigger repeats this check on the INSERT below — idempotent,
    -- the lock is already held by this transaction.)
    PERFORM assert_gym_can_add_active_member(p_gym_id);
  ELSE
    PERFORM 1 FROM gyms WHERE id = p_gym_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  END IF;

  -- Column list = exact live members INSERT surface (SupabaseMemberRepository.toDatabase)
  INSERT INTO members (
    gym_id, name, phone_number, plan_type, plan_amount, discount_id,
    recurring_discount, status, registered_date, membership_start_date, next_due_date,
    remarks, accepted_terms_at, accepted_gym_rules_at
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
    (p_member->>'next_due_date')::date,
    NULLIF(p_member->>'remarks', ''),
    NULLIF(p_member->>'accepted_terms_at', '')::timestamptz,
    NULLIF(p_member->>'accepted_gym_rules_at', '')::timestamptz
  )
  RETURNING id INTO new_id;  -- AFTER trigger increments member_count iff active

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION register_member_guarded IS
  'FOR UPDATE-locked quota gate + member insert (lite 100 / pro unlimited / enterprise unlimited). Quota applies only to ACTIVE members; non-active registrations are unlimited. Delegates to assert_gym_can_add_active_member. Insert surface includes remarks + registration consents.';
