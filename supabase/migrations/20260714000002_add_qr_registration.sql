-- QR self-registration support
--
-- 1. members.registration_source distinguishes desk registrations ('manual')
--    from QR self-registrations ('qr').
-- 2. members.verified_at is the front-desk verification timestamp for QR
--    registrations. NULL + source 'qr' renders as a NEW badge in the UI.
--    Manual registrations are considered verified by definition.
-- 3. gym_registration_links stores one rotatable, unguessable public token
--    per gym. The QR code encodes {APP_URL}/join/{token}. Rotating the token
--    invalidates previously printed QR posters without touching gym ids.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- MEMBERS: registration source + verification
-- ============================================================

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS registration_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (registration_source IN ('manual', 'qr')),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

COMMENT ON COLUMN members.registration_source IS 'How the member was registered: manual (desk form) or qr (self-registration).';
COMMENT ON COLUMN members.verified_at IS 'When the gym verified a QR self-registration. NULL for unverified QR members (NEW badge).';

-- Partial index for the "new (unverified) members" lookup
CREATE INDEX IF NOT EXISTS idx_members_unverified
  ON members(gym_id, created_at DESC)
  WHERE registration_source = 'qr' AND verified_at IS NULL;

-- ============================================================
-- GYM REGISTRATION LINKS
-- ============================================================

CREATE TABLE IF NOT EXISTS gym_registration_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One link per gym
  gym_id UUID NOT NULL UNIQUE REFERENCES gyms(id) ON DELETE CASCADE,

  -- Unguessable URL token (32 hex chars = 128 bits of entropy)
  token TEXT NOT NULL UNIQUE,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  rotated_at TIMESTAMPTZ,

  CONSTRAINT token_length CHECK (char_length(token) >= 32)
);

CREATE INDEX IF NOT EXISTS idx_gym_registration_links_token
  ON gym_registration_links(token)
  WHERE is_active = TRUE;

COMMENT ON TABLE gym_registration_links IS 'Per-gym public self-registration token. QR codes encode /join/{token}.';
COMMENT ON COLUMN gym_registration_links.token IS 'Unguessable URL token. Rotating it invalidates printed QR codes.';
COMMENT ON COLUMN gym_registration_links.rotated_at IS 'When the token was last regenerated.';

-- ============================================================
-- RLS: gym owners manage their own link; anonymous access is
-- handled exclusively by service-role server code (token lookup),
-- so no anon policies exist.
-- ============================================================

ALTER TABLE gym_registration_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gym owners can view own registration link"
  ON gym_registration_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = gym_registration_links.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

CREATE POLICY "Gym owners can create own registration link"
  ON gym_registration_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = gym_registration_links.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

CREATE POLICY "Gym owners can update own registration link"
  ON gym_registration_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = gym_registration_links.gym_id
      AND gyms.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = gym_registration_links.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- ============================================================
-- BACKFILL: create a link for every existing gym
-- ============================================================

INSERT INTO gym_registration_links (gym_id, token)
SELECT g.id, encode(gen_random_bytes(16), 'hex')
FROM gyms g
ON CONFLICT (gym_id) DO NOTHING;
