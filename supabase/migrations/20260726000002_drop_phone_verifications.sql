-- Drop the dead, world-writable phone_verifications table (security audit H1)
--
-- BACKGROUND
-- `phone_verifications` was created by 20260214000546_create_phone_verifications_table
-- for a phone-OTP login flow that was never completed. Its RLS policies are
-- dangerously permissive and it is reachable by anyone holding the anon key:
--
--   "Users can insert verifications"  INSERT  WITH CHECK (true)
--       → anyone, including unauthenticated callers, can insert arbitrary rows
--   "Users can view own verifications"  SELECT USING (auth.uid() = user_id OR user_id IS NULL)
--   "Users can update own verifications" UPDATE USING (auth.uid() = user_id OR user_id IS NULL)
--       → the `OR user_id IS NULL` arm makes every unclaimed row world-readable
--         and world-writable
--
-- The `otp_code` column is plain `varchar` with no hashing — contrast the real
-- `otp_tokens` table, which stores bcrypt hashes (char_length = 60 check) and
-- correctly has zero policies (default-deny, service_role only).
--
-- Had this table ever been wired up, that combination — unauthenticated insert,
-- unauthenticated read of unclaimed rows, plaintext codes — would have been an
-- account-takeover primitive. It is dead rather than exploited, but it is an
-- open credential-shaped write surface sitting on production.
--
-- SAFETY
-- Verified 2026-07-26 immediately before writing this migration:
--   * row count = 0
--   * zero references anywhere in src/ except src/app/api/demo/reset-rate-limits/route.ts,
--     which only bulk-DELETEs from `otp_tokens` (a different table) and does not
--     touch this one
--   * the only FK is phone_verifications.user_id → auth.users(id), i.e. this
--     table is a leaf; nothing depends on it
--   * cleanup_expired_otps(), the only function that referenced it, is dropped
--     in 20260726000001
--
-- The paired feature gap (the security-settings UI calls
-- /api/settings/security/phone/{request,verify}-otp, neither of which exists
-- server-side) is tracked separately as audit finding M9 — that UI 404s today
-- with or without this table.

DROP TABLE IF EXISTS public.phone_verifications;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'phone_verifications'
  ) THEN
    RAISE EXCEPTION 'phone_verifications still present after DROP';
  END IF;
  RAISE NOTICE 'phone_verifications dropped.';
END;
$$;
