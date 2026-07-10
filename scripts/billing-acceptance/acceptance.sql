-- Billing DB acceptance probes (plan §4, phases DB/QG) — run as postgres.
-- Tier strategy v2: paid-only Lite (100) / Pro (∞) / Enterprise (∞);
-- onboarding = lite/trialing + trial clock; dunning and trial expiry SUSPEND
-- (tier preserved — no downgrade landing tier exists).
--
-- Covers what the jest integration suite cannot: role-switching trigger
-- behavior, EXECUTE lockdown, backfill equality, unique-index semantics.
-- The concurrency race / dunning branches / webhook contract run in
-- tests/integration (see scripts/billing-acceptance/run.sh step 3).
--
-- Self-cleaning: every probe uses a throwaway gym/user and rolls back or
-- deletes what it created. Results are logged to a temp table (readable by
-- non-psql runners such as the Supabase MCP execute_sql, which does not
-- relay NOTICEs) and echoed as NOTICEs for psql; raises on FAIL at the end.
--
-- RLS note (load-bearing): gyms policies are `TO public USING (auth.uid() =
-- user_id)`. A role-switched UPDATE with no JWT claims sees ZERO rows, so the
-- guard trigger never fires and the probe proves nothing. Probes 2/3 therefore
-- impersonate the throwaway owner via request.jwt claims first, and treat a
-- zero-row UPDATE as a FAIL (inconclusive setup), never as a pass.

\set ON_ERROR_STOP on

CREATE TEMP TABLE _acceptance_results (n serial PRIMARY KEY, line text);

CREATE FUNCTION pg_temp._acc_log(msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _acceptance_results (line) VALUES (msg);
  RAISE NOTICE '%', msg;
END;
$$;

DO $$
DECLARE
  v_failures  text[] := '{}';
  v_user_id   uuid;
  v_gym_id    uuid;
  v_user2_id  uuid;
  v_gym2_id   uuid;
  v_member_id uuid;
  v_count     integer;
  v_before    integer;
  v_rows      integer;
  v_ok        boolean;
  v_suspended integer;
BEGIN
  ------------------------------------------------------------------
  -- 0. Schema presence (tier strategy v2 requires the trial clock)
  ------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'gyms' AND column_name = 'subscription_tier';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MIGRATIONS NOT APPLIED: gyms.subscription_tier missing';
  END IF;
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'gyms' AND column_name = 'trial_ends_at';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MIGRATIONS NOT APPLIED: gyms.trial_ends_at missing (20260708000003)';
  END IF;
  PERFORM pg_temp._acc_log('PASS 0: schema present (incl. trial_ends_at)');

  ------------------------------------------------------------------
  -- 1. Backfill equality: member_count == live ACTIVE count for every gym
  --    (the quota counts members with status = 'active' only)
  ------------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM gyms g
  WHERE g.member_count <> (
    SELECT count(*) FROM members m WHERE m.gym_id = g.id AND m.status = 'active'
  );
  IF v_count = 0 THEN
    PERFORM pg_temp._acc_log('PASS 1: member_count backfill equals live ACTIVE counts for all gyms');
  ELSE
    v_failures := v_failures || format('FAIL 1: %s gyms with mismatched active member_count', v_count);
  END IF;

  -- 1b. No row carries a retired tier/status value
  SELECT count(*) INTO v_count FROM gyms
  WHERE subscription_tier NOT IN ('lite', 'pro', 'enterprise')
     OR subscription_status NOT IN ('trialing', 'active', 'past_due', 'suspended', 'canceled');
  IF v_count = 0 THEN
    PERFORM pg_temp._acc_log('PASS 1b: every gym carries a v2 tier/status value');
  ELSE
    v_failures := v_failures || format('FAIL 1b: %s gyms on retired tier/status values', v_count);
  END IF;

  ------------------------------------------------------------------
  -- Seed a throwaway auth user + gym for the remaining probes
  ------------------------------------------------------------------
  v_user_id := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email,
                          encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'billing-acceptance-' || v_user_id || '@example.com',
          '', now(), now(), now());

  INSERT INTO gyms (user_id, username, email, gym_name)
  VALUES (v_user_id, 'acc-' || left(v_user_id::text, 8),
          'billing-acceptance-' || v_user_id || '@example.com', 'Acceptance Gym')
  RETURNING id INTO v_gym_id;

  -- 1c. New-gym defaults: lite/trialing with a trial clock ~14 days out
  SELECT (subscription_tier = 'lite' AND subscription_status = 'trialing'
          AND trial_ends_at IS NOT NULL
          AND trial_ends_at BETWEEN now() + interval '13 days' AND now() + interval '15 days')
    INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 1c: new gym defaults to lite/trialing with a ~14-day trial clock');
  ELSE
    v_failures := v_failures || 'FAIL 1c: new-gym defaults are not lite/trialing + trial clock';
  END IF;

  -- Impersonate the throwaway owner for the role-switch probes: without these
  -- claims, auth.uid() is NULL and RLS hides the row from non-owner roles.
  -- set_config(..., true) = SET LOCAL — scoped to this DO statement's txn.
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);

  ------------------------------------------------------------------
  -- 2. Column-guard trigger: authenticated role BLOCKED (C-14)
  ------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE authenticated;
    UPDATE gyms SET member_count = 999 WHERE id = v_gym_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RESET ROLE;
    IF v_rows = 0 THEN
      v_failures := v_failures ||
        'FAIL 2: RLS hid the gym row under authenticated (claims not applied) — trigger never probed';
    ELSE
      v_failures := v_failures || 'FAIL 2: authenticated role wrote member_count';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM LIKE '%SUBSCRIPTION_COLUMNS_READONLY%' THEN
      PERFORM pg_temp._acc_log('PASS 2: authenticated write to member_count rejected');
    ELSE
      v_failures := v_failures || format('FAIL 2: unexpected error: %s', SQLERRM);
    END IF;
  END;
  -- Regardless of the path taken, the value must be unchanged:
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym_id;
  IF v_count = 999 THEN
    v_failures := v_failures || 'FAIL 2b: member_count actually changed under authenticated';
  END IF;

  ------------------------------------------------------------------
  -- 3. Column-guard trigger: FRESH UNENUMERATED ROLE blocked (fail-closed)
  ------------------------------------------------------------------
  BEGIN
    CREATE ROLE billing_acceptance_probe NOLOGIN;
    -- PG16+: CREATEROLE grants ADMIN OPTION but NOT membership; grant it so
    -- SET ROLE below works for non-superuser runners (Supabase postgres).
    EXECUTE format('GRANT billing_acceptance_probe TO %I', session_user);
    GRANT USAGE ON SCHEMA public TO billing_acceptance_probe;
    GRANT UPDATE, SELECT ON gyms TO billing_acceptance_probe;
    -- The RLS predicate calls auth.uid(); the fresh role needs to evaluate it.
    GRANT USAGE ON SCHEMA auth TO billing_acceptance_probe;
    GRANT EXECUTE ON FUNCTION auth.uid() TO billing_acceptance_probe;
    BEGIN
      SET LOCAL ROLE billing_acceptance_probe;
      UPDATE gyms SET subscription_tier = 'pro' WHERE id = v_gym_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RESET ROLE;
      IF v_rows = 0 THEN
        v_failures := v_failures ||
          'FAIL 3: RLS hid the gym row for the probe role — trigger never probed';
      ELSE
        v_failures := v_failures || 'FAIL 3: unenumerated role self-upgraded to pro';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      IF SQLERRM LIKE '%SUBSCRIPTION_COLUMNS_READONLY%' THEN
        PERFORM pg_temp._acc_log('PASS 3: unenumerated custom role rejected (fail-closed)');
      ELSE
        v_failures := v_failures || format('FAIL 3: unexpected error: %s', SQLERRM);
      END IF;
    END;
    DROP OWNED BY billing_acceptance_probe;  -- revokes every grant made above
    DROP ROLE billing_acceptance_probe;
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp._acc_log('SKIP 3: connection role cannot CREATE ROLE (run with postgres)');
  END;

  ------------------------------------------------------------------
  -- 4. Column-guard trigger: profile columns still writable by anyone allowed
  --    (guard only protects the subscription columns)
  ------------------------------------------------------------------
  UPDATE gyms SET gym_address = 'Acceptance Street 1' WHERE id = v_gym_id;
  PERFORM pg_temp._acc_log('PASS 4: non-subscription column update unaffected by the guard');

  ------------------------------------------------------------------
  -- 5. EXECUTE lockdown: authenticated cannot call the guarded RPCs
  ------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM register_member_guarded(v_gym_id, '{}'::jsonb);
    RESET ROLE;
    v_failures := v_failures || 'FAIL 5: authenticated could EXECUTE register_member_guarded';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp._acc_log('PASS 5: register_member_guarded EXECUTE denied to authenticated');
  WHEN OTHERS THEN
    RESET ROLE;
    v_failures := v_failures || format('FAIL 5: expected privilege error, got: %s', SQLERRM);
  END;

  ------------------------------------------------------------------
  -- 6. Guarded insert + counter trigger (SECURITY DEFINER paths exempt);
  --    trialing grants access (full features during the trial window)
  ------------------------------------------------------------------
  v_member_id := register_member_guarded(v_gym_id, jsonb_build_object(
    'name', 'Acceptance Member',
    'phone_number', '+94770000001',
    'plan_type', 'monthly',
    'plan_amount', 2000,
    'recurring_discount', false,
    'status', 'active',
    'next_due_date', '2099-01-01'
  ));
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym_id;
  IF v_member_id IS NOT NULL AND v_count = 1 THEN
    PERFORM pg_temp._acc_log('PASS 6: guarded insert works while TRIALING; counter trigger incremented');
  ELSE
    v_failures := v_failures || format('FAIL 6: member=%s count=%s', v_member_id, v_count);
  END IF;

  -- 6b. DELETE decrements
  DELETE FROM members WHERE id = v_member_id;
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym_id;
  IF v_count = 0 THEN
    PERFORM pg_temp._acc_log('PASS 6b: counter trigger decremented on delete');
  ELSE
    v_failures := v_failures || format('FAIL 6b: count=%s after delete', v_count);
  END IF;

  ------------------------------------------------------------------
  -- 7. Lite cap enforced at exactly 100 (sequential fill on lite/active)
  ------------------------------------------------------------------
  PERFORM save_gym_subscription(v_gym_id, 'lite', 'active', 'PHSUB-CAP', NULL, true);
  FOR i IN 1..100 LOOP
    PERFORM register_member_guarded(v_gym_id, jsonb_build_object(
      'name', 'Fill ' || i,
      'phone_number', '+9477' || lpad((1000000 + i)::text, 7, '0'),
      'plan_type', 'monthly', 'plan_amount', 2000,
      'recurring_discount', false, 'status', 'active',
      'next_due_date', '2099-01-01'
    ));
  END LOOP;
  BEGIN
    PERFORM register_member_guarded(v_gym_id, jsonb_build_object(
      'name', 'Over Limit', 'phone_number', '+94770000151',
      'plan_type', 'monthly', 'plan_amount', 2000,
      'recurring_discount', false, 'status', 'active',
      'next_due_date', '2099-01-01'
    ));
    v_failures := v_failures || 'FAIL 7: 101st member accepted on Lite tier';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MEMBER_LIMIT_REACHED%' THEN
      PERFORM pg_temp._acc_log('PASS 7: 101st registration rejected with MEMBER_LIMIT_REACHED (Lite cap 100)');
    ELSE
      v_failures := v_failures || format('FAIL 7: unexpected error: %s', SQLERRM);
    END IF;
  END;

  -- 7b. Pro: unlimited — the 101st member that Lite rejected goes in
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'active', 'PHSUB-PRO', NULL, true);
  PERFORM register_member_guarded(v_gym_id, jsonb_build_object(
    'name', 'Pro Over', 'phone_number', '+94760000101',
    'plan_type', 'monthly', 'plan_amount', 2000,
    'recurring_discount', false, 'status', 'active',
    'next_due_date', '2099-01-01'
  ));
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym_id;
  IF v_count = 101 THEN
    PERFORM pg_temp._acc_log('PASS 7b: pro accepts beyond 100 (unlimited)');
  ELSE
    v_failures := v_failures || format('FAIL 7b: expected 101 members, got %s', v_count);
  END IF;

  -- 7c. Enterprise: unlimited as well
  PERFORM save_gym_subscription(v_gym_id, 'enterprise', 'active', 'PHSUB-ENT', NULL, true);
  PERFORM register_member_guarded(v_gym_id, jsonb_build_object(
    'name', 'Enterprise Over', 'phone_number', '+94760000102',
    'plan_type', 'monthly', 'plan_amount', 2000,
    'recurring_discount', false, 'status', 'active',
    'next_due_date', '2099-01-01'
  ));
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym_id;
  IF v_count = 102 THEN
    PERFORM pg_temp._acc_log('PASS 7c: enterprise accepts beyond 100 (unlimited)');
  ELSE
    v_failures := v_failures || format('FAIL 7c: expected 102 members, got %s', v_count);
  END IF;

  -- 7d. SUSPENDED blocks every into-active write regardless of tier/count
  UPDATE gyms SET subscription_status = 'suspended' WHERE id = v_gym_id;
  BEGIN
    PERFORM register_member_guarded(v_gym_id, jsonb_build_object(
      'name', 'Suspended Reg', 'phone_number', '+94760000103',
      'plan_type', 'monthly', 'plan_amount', 2000,
      'recurring_discount', false, 'status', 'active',
      'next_due_date', '2099-01-01'
    ));
    v_failures := v_failures || 'FAIL 7d: suspended gym accepted an active member';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MEMBER_LIMIT_REACHED%' THEN
      PERFORM pg_temp._acc_log('PASS 7d: suspended gym rejected an active registration');
    ELSE
      v_failures := v_failures || format('FAIL 7d: unexpected error: %s', SQLERRM);
    END IF;
  END;

  -- 7e. CANCELED blocks into-active writes even while paid-through (v2 policy)
  PERFORM save_gym_subscription(v_gym_id, 'enterprise', 'canceled', 'PHSUB-ENT', NULL, false);
  UPDATE gyms SET current_period_end = now() + interval '5 days' WHERE id = v_gym_id;
  BEGIN
    PERFORM register_member_guarded(v_gym_id, jsonb_build_object(
      'name', 'Canceled Reg', 'phone_number', '+94760000104',
      'plan_type', 'monthly', 'plan_amount', 2000,
      'recurring_discount', false, 'status', 'active',
      'next_due_date', '2099-01-01'
    ));
    v_failures := v_failures || 'FAIL 7e: canceled gym accepted an active member';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MEMBER_LIMIT_REACHED%' THEN
      PERFORM pg_temp._acc_log('PASS 7e: canceled gym rejected an active registration (paid-through)');
    ELSE
      v_failures := v_failures || format('FAIL 7e: unexpected error: %s', SQLERRM);
    END IF;
  END;

  ------------------------------------------------------------------
  -- 7f–7k. ACTIVE-MEMBER quota semantics (migration 20260708000001/4).
  -- Fresh throwaway gym on lite/active so counts are unambiguous.
  ------------------------------------------------------------------
  v_user2_id := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email,
                          encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (v_user2_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'billing-acceptance-' || v_user2_id || '@example.com',
          '', now(), now(), now());
  INSERT INTO gyms (user_id, username, email, gym_name)
  VALUES (v_user2_id, 'acc2-' || left(v_user2_id::text, 8),
          'billing-acceptance-' || v_user2_id || '@example.com', 'Acceptance Gym 2')
  RETURNING id INTO v_gym2_id;  -- defaults to lite/trialing (cap 100)
  PERFORM save_gym_subscription(v_gym2_id, 'lite', 'active', 'PHSUB-Q', NULL, true);

  -- 7f. Registering a NON-active member does not consume a slot (count stays 0)
  PERFORM register_member_guarded(v_gym2_id, jsonb_build_object(
    'name', 'Inactive Reg', 'phone_number', '+94750000001',
    'plan_type', 'monthly', 'plan_amount', 2000,
    'recurring_discount', false, 'status', 'expired',
    'next_due_date', '2020-01-01'
  ));
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym2_id;
  IF v_count = 0 THEN
    PERFORM pg_temp._acc_log('PASS 7f: registering a non-active member does not increment the active count');
  ELSE
    v_failures := v_failures || format('FAIL 7f: expected 0 active, got %s', v_count);
  END IF;

  -- 7g. Registering an ACTIVE member increments by exactly 1
  v_member_id := register_member_guarded(v_gym2_id, jsonb_build_object(
    'name', 'Active Reg', 'phone_number', '+94750000002',
    'plan_type', 'monthly', 'plan_amount', 2000,
    'recurring_discount', false, 'status', 'active',
    'next_due_date', '2099-01-01'
  ));
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym2_id;
  IF v_count = 1 THEN
    PERFORM pg_temp._acc_log('PASS 7g: registering an active member increments the active count');
  ELSE
    v_failures := v_failures || format('FAIL 7g: expected 1 active, got %s', v_count);
  END IF;

  -- 7h. Fill to exactly 100 active; a non-active registration is NOT quota-blocked
  FOR i IN 2..100 LOOP
    PERFORM register_member_guarded(v_gym2_id, jsonb_build_object(
      'name', 'AFill ' || i, 'phone_number', '+9475' || lpad((1000000 + i)::text, 7, '0'),
      'plan_type', 'monthly', 'plan_amount', 2000,
      'recurring_discount', false, 'status', 'active',
      'next_due_date', '2099-01-01'
    ));
  END LOOP;
  BEGIN
    PERFORM register_member_guarded(v_gym2_id, jsonb_build_object(
      'name', 'Inactive At Cap', 'phone_number', '+94750000099',
      'plan_type', 'monthly', 'plan_amount', 2000,
      'recurring_discount', false, 'status', 'expired',
      'next_due_date', '2020-01-01'
    ));
    PERFORM pg_temp._acc_log('PASS 7h: non-active registration allowed even at the active cap (unlimited inactive)');
  EXCEPTION WHEN OTHERS THEN
    v_failures := v_failures || format('FAIL 7h: non-active registration blocked at cap: %s', SQLERRM);
  END;

  -- 7i. Flipping an active member to expired decrements the active count
  UPDATE members SET status = 'expired' WHERE id = v_member_id;
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym2_id;
  IF v_count = 99 THEN
    PERFORM pg_temp._acc_log('PASS 7i: active->expired flip decremented the active count (100->99)');
  ELSE
    v_failures := v_failures || format('FAIL 7i: expected 99 after flip, got %s', v_count);
  END IF;

  -- 7j. Reactivating (expired->active) below cap succeeds (back to 100); a SECOND
  --     reactivation at the cap is rejected with MEMBER_LIMIT_REACHED, and the
  --     blocked member stays non-active (BEFORE trigger — nothing lands).
  UPDATE members SET status = 'active' WHERE id = v_member_id;
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym2_id;
  IF v_count <> 100 THEN
    v_failures := v_failures || format('FAIL 7j: reactivation below cap expected 100, got %s', v_count);
  END IF;
  -- Grab an inactive member (the 7f/7h expired ones) to reactivate at the cap
  SELECT id INTO v_member_id FROM members
   WHERE gym_id = v_gym2_id AND status = 'expired' LIMIT 1;
  BEGIN
    UPDATE members SET status = 'active' WHERE id = v_member_id;
    v_failures := v_failures || 'FAIL 7j: reactivation at the active cap was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MEMBER_LIMIT_REACHED%' THEN
      SELECT status INTO v_ok FROM (SELECT status = 'active' AS status FROM members WHERE id = v_member_id) s;
      IF v_ok THEN
        v_failures := v_failures || 'FAIL 7j: blocked member was left active despite the raise';
      ELSE
        PERFORM pg_temp._acc_log('PASS 7j: reactivation at the active cap rejected (MEMBER_LIMIT_REACHED), member stays inactive');
      END IF;
    ELSE
      v_failures := v_failures || format('FAIL 7j: unexpected error: %s', SQLERRM);
    END IF;
  END;

  -- Clean up gym 2 (members cascade via gym delete if FK is ON DELETE CASCADE;
  -- delete members explicitly first to be safe, exercising the DELETE branch).
  DELETE FROM members WHERE gym_id = v_gym2_id;
  SELECT member_count INTO v_count FROM gyms WHERE id = v_gym2_id;
  IF v_count = 0 THEN
    PERFORM pg_temp._acc_log('PASS 7k: deleting all members returns the active count to 0');
  ELSE
    v_failures := v_failures || format('FAIL 7k: expected 0 after delete, got %s', v_count);
  END IF;
  DELETE FROM gyms WHERE id = v_gym2_id;
  DELETE FROM auth.users WHERE id = v_user2_id;

  ------------------------------------------------------------------
  -- 8. Dunning branches via process_dunning_suspensions (server clock)
  --    Suspension changes STATUS only — tier and gateway id are preserved.
  ------------------------------------------------------------------
  SELECT count(*) INTO v_before FROM members WHERE gym_id = v_gym_id;

  -- 8a. past_due beyond grace -> suspended (tier preserved, id retained)
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'past_due', 'PHSUB-ACC', NULL, false);
  UPDATE gyms SET current_period_end = now() - interval '9 days' WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_suspensions(7);
  SELECT (subscription_tier = 'pro' AND subscription_status = 'suspended'
          AND payhere_subscription_id = 'PHSUB-ACC') INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8a: past-grace past_due SUSPENDED — tier preserved, gateway id retained');
  ELSE
    v_failures := v_failures || 'FAIL 8a: past-grace suspension did not apply as specified';
  END IF;

  -- 8b. past_due inside grace -> retained
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'past_due', 'PHSUB-ACC2', NULL, false);
  UPDATE gyms SET current_period_end = now() - interval '5 days' WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_suspensions(7);
  SELECT (subscription_tier = 'pro' AND subscription_status = 'past_due') INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8b: in-grace past_due retained');
  ELSE
    v_failures := v_failures || 'FAIL 8b: in-grace gym was suspended early';
  END IF;

  -- 8c. voluntary cancel past period end -> suspended (tier preserved)
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'canceled', 'PHSUB-ACC3', NULL, false);
  UPDATE gyms SET current_period_end = now() - interval '1 day' WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_suspensions(7);
  SELECT (subscription_tier = 'pro' AND subscription_status = 'suspended') INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8c: ended voluntary cancel SUSPENDED — tier preserved');
  ELSE
    v_failures := v_failures || 'FAIL 8c: voluntary-cancel suspension did not apply';
  END IF;

  -- 8d. paid-through voluntary cancel -> retained
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'canceled', 'PHSUB-ACC4', NULL, false);
  UPDATE gyms SET current_period_end = now() + interval '5 days' WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_suspensions(7);
  SELECT (subscription_tier = 'pro' AND subscription_status = 'canceled') INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8d: paid-through voluntary cancel retained');
  ELSE
    v_failures := v_failures || 'FAIL 8d: paid-through gym was suspended early';
  END IF;

  -- 8e. THE invariant: no dunning branch touched members
  SELECT count(*) INTO v_count FROM members WHERE gym_id = v_gym_id;
  IF v_count = v_before THEN
    PERFORM pg_temp._acc_log(format('PASS 8e: members untouched across all dunning branches (%s rows)', v_count));
  ELSE
    v_failures := v_failures || format('FAIL 8e: members %s -> %s', v_before, v_count);
  END IF;

  -- 8f. idempotence
  PERFORM * FROM process_dunning_suspensions(7);
  PERFORM pg_temp._acc_log('PASS 8f: second dunning pass ran (idempotent, no error)');

  -- 8g. Complimentary (lifetime) enterprise is immune to dunning:
  --     enterprise/active, NO gateway id, NO period end -> untouched
  PERFORM save_gym_subscription(v_gym_id, 'enterprise', 'active', NULL, NULL, false);
  UPDATE gyms SET current_period_end = NULL WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_suspensions(7);
  SELECT (subscription_tier = 'enterprise' AND subscription_status = 'active'
          AND payhere_subscription_id IS NULL AND current_period_end IS NULL) INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8g: complimentary enterprise untouched by dunning');
  ELSE
    v_failures := v_failures || 'FAIL 8g: dunning modified a complimentary enterprise row';
  END IF;

  ------------------------------------------------------------------
  -- 8h. Trial expiry via process_trial_expiry (server clock)
  ------------------------------------------------------------------
  -- Expired trial -> suspended (tier preserved)
  UPDATE gyms SET subscription_tier = 'lite', subscription_status = 'trialing',
                  trial_ends_at = now() - interval '1 day'
  WHERE id = v_gym_id;
  SELECT process_trial_expiry() INTO v_suspended;
  SELECT (subscription_tier = 'lite' AND subscription_status = 'suspended') INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok AND v_suspended >= 1 THEN
    PERFORM pg_temp._acc_log('PASS 8h: expired trial SUSPENDED — tier preserved');
  ELSE
    v_failures := v_failures || 'FAIL 8h: trial expiry did not suspend the expired trial';
  END IF;

  -- Running trial -> retained
  UPDATE gyms SET subscription_status = 'trialing', trial_ends_at = now() + interval '5 days'
  WHERE id = v_gym_id;
  PERFORM process_trial_expiry();
  SELECT (subscription_status = 'trialing') INTO v_ok FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8i: running trial retained by the trial-expiry pass');
  ELSE
    v_failures := v_failures || 'FAIL 8i: running trial was suspended early';
  END IF;

  ------------------------------------------------------------------
  -- 9. One pending intent per gym (23505) + payment-id partial unique
  ------------------------------------------------------------------
  INSERT INTO checkout_intents (order_id, gym_id, target_tier, expected_amount, expires_at)
  VALUES ('ACC-1-' || v_gym_id, v_gym_id, 'pro', 4990, now() + interval '30 minutes');
  BEGIN
    INSERT INTO checkout_intents (order_id, gym_id, target_tier, expected_amount, expires_at)
    VALUES ('ACC-2-' || v_gym_id, v_gym_id, 'pro', 4990, now() + interval '30 minutes');
    v_failures := v_failures || 'FAIL 9: second pending intent accepted';
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_temp._acc_log('PASS 9: second pending intent hit 23505');
  END;

  INSERT INTO saas_payment_logs (gym_id, payhere_payment_id, status_code, signature_valid, raw_payload)
  VALUES (v_gym_id, 'ACC-PAY-' || v_gym_id, 2, true, '{}'::jsonb);
  BEGIN
    INSERT INTO saas_payment_logs (gym_id, payhere_payment_id, status_code, signature_valid, raw_payload)
    VALUES (v_gym_id, 'ACC-PAY-' || v_gym_id, 2, true, '{}'::jsonb);
    v_failures := v_failures || 'FAIL 9b: duplicate payment id accepted';
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_temp._acc_log('PASS 9b: duplicate payhere_payment_id hit 23505');
  END;
  -- two NULL payment ids must coexist (invalid-signature audit rows)
  INSERT INTO saas_payment_logs (gym_id, payhere_payment_id, status_code, signature_valid, raw_payload)
  VALUES (v_gym_id, NULL, 0, false, '{}'::jsonb),
         (v_gym_id, NULL, 0, false, '{}'::jsonb);
  PERFORM pg_temp._acc_log('PASS 9c: multiple NULL payment-id audit rows coexist');

  ------------------------------------------------------------------
  -- Cleanup (payment logs keep NULL gym_id via ON DELETE SET NULL)
  ------------------------------------------------------------------
  DELETE FROM saas_payment_logs WHERE gym_id = v_gym_id OR gym_id IS NULL AND raw_payload = '{}'::jsonb;
  DELETE FROM gyms WHERE id = v_gym_id;
  DELETE FROM auth.users WHERE id = v_user_id;
  PERFORM pg_temp._acc_log('CLEANUP: acceptance gym/user removed');

  ------------------------------------------------------------------
  IF array_length(v_failures, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ACCEPTANCE FAILURES: %', array_to_string(v_failures, ' | ');
  END IF;
  PERFORM pg_temp._acc_log('=== ALL DB ACCEPTANCE PROBES PASSED ===');
END;
$$;

SELECT line FROM _acceptance_results ORDER BY n;

-- Advisory (outside the DO block): the C-20 cap counter should plan index-only
-- once the table has enough rows for the planner to prefer the index.
EXPLAIN SELECT count(*) FROM saas_payment_logs
WHERE signature_valid = false AND processed_at > now() - interval '1 hour';
