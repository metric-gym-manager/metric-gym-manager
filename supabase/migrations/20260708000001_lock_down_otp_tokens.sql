-- Lock down otp_tokens: remove world-open RLS policies.
--
-- The original policies (migration 20260211000005) granted anonymous SELECT,
-- INSERT and UPDATE to anyone holding the public anon key:
--
--   FOR INSERT WITH CHECK (true)   -- anyone can insert
--   FOR SELECT USING (true)        -- anyone can read the whole table
--   FOR UPDATE USING (true) ...    -- anyone can mark rows used
--
-- That allowed phone-number enumeration and token-spray inserts. No application
-- code reads or writes this table via the anon key; every real access path uses
-- the service-role client, which bypasses RLS entirely. Dropping these policies
-- is therefore safe and leaves the table default-deny for the anon and
-- authenticated roles (service role is unaffected).

DROP POLICY IF EXISTS "Anyone can create OTP tokens"  ON otp_tokens;
DROP POLICY IF EXISTS "Anyone can verify OTP tokens"   ON otp_tokens;
DROP POLICY IF EXISTS "OTP tokens can be marked used"  ON otp_tokens;

-- RLS stays enabled; with no permissive policies remaining, only the service
-- role (used by server-side code) can touch this table.
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
