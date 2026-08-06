-- ============================================================
-- Retire the legacy phone_verifications table
-- ============================================================
--
-- `public.phone_verifications` and its companion `cleanup_expired_otps()` exist
-- only on the hosted project (remote migration
-- `20260214020546_create_phone_verifications_table`); neither was ever
-- committed here, so a replay of this repo has never produced them. This
-- migration resolves that divergence by removing them from the hosted project
-- rather than adopting them, because the table is dead and actively harmful:
--
--   * Superseded. OTP storage moved to `otp_tokens` with hashed codes in
--     20260212000001_hash_otp_codes and 20260708000007_lock_down_otp_tokens.
--     phone_verifications still stores `otp_code` in PLAINTEXT.
--   * Unused. Zero references across src/, tests/ and scripts/ — for both the
--     table and the function.
--   * Empty. 0 rows on the hosted project. The guard below re-checks this at
--     apply time and aborts if that is no longer true, so this can never
--     silently destroy data.
--   * Exposed. `anon` and `authenticated` held full DML (arwdDxtm), and the
--     SELECT/UPDATE policies use `(auth.uid() = user_id) OR (user_id IS NULL)`
--     while the INSERT policy is `WITH CHECK (true)` — so any anonymous caller
--     could insert a row with a NULL user_id and then read it back. On a table
--     of plaintext one-time passcodes.
--
-- Full recreate DDL (columns, constraints, indexes, RLS, all three policies and
-- the original grants) was captured before the drop and is kept as a rollback
-- script alongside this change.
--
-- Ordering note: 20260805000001 pinned search_path on cleanup_expired_otps()
-- via a guarded block, precisely because the function is hosted-only. That
-- guard means this DROP does not invalidate the earlier migration on a replay.
--
-- Idempotent: IF EXISTS on both drops, so this is a no-op on any database that
-- never had them — which includes every fresh replay of this repo.

-- ---------- Safety guard: refuse to drop a table that holds data ------------

DO $$
DECLARE
  v_rows bigint;
BEGIN
  IF to_regclass('public.phone_verifications') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.phone_verifications' INTO v_rows;
    IF v_rows > 0 THEN
      RAISE EXCEPTION
        'Refusing to drop public.phone_verifications: % row(s) present. '
        'This migration assumes the table is empty and abandoned; investigate '
        'before proceeding.', v_rows;
    END IF;
  END IF;
END;
$$;

-- ---------- Drop ------------------------------------------------------------

-- Function first: its body references the table.
DROP FUNCTION IF EXISTS public.cleanup_expired_otps();

-- Indexes and policies are dropped implicitly with the table.
DROP TABLE IF EXISTS public.phone_verifications;

-- ---------- Assertion -------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.phone_verifications') IS NOT NULL THEN
    RAISE EXCEPTION 'public.phone_verifications still exists';
  END IF;

  IF to_regprocedure('public.cleanup_expired_otps()') IS NOT NULL THEN
    RAISE EXCEPTION 'public.cleanup_expired_otps() still exists';
  END IF;

  -- The surviving OTP path must be intact.
  IF to_regclass('public.otp_tokens') IS NULL THEN
    RAISE EXCEPTION 'otp_tokens is missing — do not retire phone_verifications without it';
  END IF;
END;
$$;
