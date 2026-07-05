-- Billing DB acceptance probes (plan §4, phases DB/QG) — run as postgres.
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
  v_member_id uuid;
  v_count     integer;
  v_before    integer;
  v_rows      integer;
  v_ok        boolean;
BEGIN
  ------------------------------------------------------------------
  -- 0. Schema presence
  ------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'gyms' AND column_name = 'subscription_tier';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MIGRATIONS NOT APPLIED: gyms.subscription_tier missing';
  END IF;
  PERFORM pg_temp._acc_log('PASS 0: schema present');

  ------------------------------------------------------------------
  -- 1. Backfill equality: member_count == live count(*) for every gym
  ------------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM gyms g
  WHERE g.member_count <> (SELECT count(*) FROM members m WHERE m.gym_id = g.id);
  IF v_count = 0 THEN
    PERFORM pg_temp._acc_log('PASS 1: member_count backfill equals live counts for all gyms');
  ELSE
    v_failures := v_failures || format('FAIL 1: %s gyms with mismatched member_count', v_count);
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
  --    (guard only protects the six subscription columns)
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
  -- 6. Guarded insert + counter trigger (SECURITY DEFINER paths exempt)
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
    PERFORM pg_temp._acc_log('PASS 6: guarded insert works; counter trigger incremented through the guard');
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
  -- 7. Free-tier limit enforced at exactly 50 (sequential fill)
  ------------------------------------------------------------------
  FOR i IN 1..50 LOOP
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
      'name', 'Over Limit', 'phone_number', '+94770000051',
      'plan_type', 'monthly', 'plan_amount', 2000,
      'recurring_discount', false, 'status', 'active',
      'next_due_date', '2099-01-01'
    ));
    v_failures := v_failures || 'FAIL 7: 51st member accepted on Free tier';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MEMBER_LIMIT_REACHED%' THEN
      PERFORM pg_temp._acc_log('PASS 7: 51st registration rejected with MEMBER_LIMIT_REACHED');
    ELSE
      v_failures := v_failures || format('FAIL 7: unexpected error: %s', SQLERRM);
    END IF;
  END;

  ------------------------------------------------------------------
  -- 8. Dunning branches via process_dunning_downgrades (server clock)
  ------------------------------------------------------------------
  SELECT count(*) INTO v_before FROM members WHERE gym_id = v_gym_id;

  -- 8a. past_due beyond grace -> free/canceled
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'past_due', 'PHSUB-ACC', NULL, false);
  UPDATE gyms SET current_period_end = now() - interval '9 days' WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_downgrades(7);
  SELECT (subscription_tier = 'free' AND subscription_status = 'canceled'
          AND payhere_subscription_id IS NULL) INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8a: past-grace past_due downgraded to free/canceled, id cleared');
  ELSE
    v_failures := v_failures || 'FAIL 8a: past-grace downgrade did not apply';
  END IF;

  -- 8b. past_due inside grace -> retained
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'past_due', 'PHSUB-ACC2', NULL, false);
  UPDATE gyms SET current_period_end = now() - interval '5 days' WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_downgrades(7);
  SELECT (subscription_tier = 'pro' AND subscription_status = 'past_due') INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8b: in-grace past_due retained');
  ELSE
    v_failures := v_failures || 'FAIL 8b: in-grace gym was downgraded';
  END IF;

  -- 8c. voluntary cancel past period end -> lapses to free, status stays canceled
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'canceled', 'PHSUB-ACC3', NULL, false);
  UPDATE gyms SET current_period_end = now() - interval '1 day' WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_downgrades(7);
  SELECT (subscription_tier = 'free' AND subscription_status = 'canceled') INTO v_ok
  FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8c: ended voluntary cancel lapsed to free (status preserved)');
  ELSE
    v_failures := v_failures || 'FAIL 8c: voluntary-cancel lapse did not apply';
  END IF;

  -- 8d. paid-through voluntary cancel -> retained
  PERFORM save_gym_subscription(v_gym_id, 'pro', 'canceled', 'PHSUB-ACC4', NULL, false);
  UPDATE gyms SET current_period_end = now() + interval '5 days' WHERE id = v_gym_id;
  PERFORM * FROM process_dunning_downgrades(7);
  SELECT (subscription_tier = 'pro') INTO v_ok FROM gyms WHERE id = v_gym_id;
  IF v_ok THEN
    PERFORM pg_temp._acc_log('PASS 8d: paid-through voluntary cancel retained');
  ELSE
    v_failures := v_failures || 'FAIL 8d: paid-through gym was lapsed early';
  END IF;

  -- 8e. THE invariant: no dunning branch touched members
  SELECT count(*) INTO v_count FROM members WHERE gym_id = v_gym_id;
  IF v_count = v_before THEN
    PERFORM pg_temp._acc_log(format('PASS 8e: members untouched across all dunning branches (%s rows)', v_count));
  ELSE
    v_failures := v_failures || format('FAIL 8e: members %s -> %s', v_before, v_count);
  END IF;

  -- 8f. idempotence
  PERFORM * FROM process_dunning_downgrades(7);
  PERFORM pg_temp._acc_log('PASS 8f: second dunning pass ran (idempotent, no error)');

  ------------------------------------------------------------------
  -- 9. One pending intent per gym (23505) + payment-id partial unique
  ------------------------------------------------------------------
  INSERT INTO checkout_intents (order_id, gym_id, target_tier, expected_amount, expires_at)
  VALUES ('ACC-1-' || v_gym_id, v_gym_id, 'pro', 4900, now() + interval '30 minutes');
  BEGIN
    INSERT INTO checkout_intents (order_id, gym_id, target_tier, expected_amount, expires_at)
    VALUES ('ACC-2-' || v_gym_id, v_gym_id, 'pro', 4900, now() + interval '30 minutes');
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
