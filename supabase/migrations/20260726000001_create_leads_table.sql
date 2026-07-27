-- Marketing leads (public landing-page demo / sales enquiries).
--
-- Anonymous by design: a lead exists BEFORE any gym account, so the row has no
-- gym_id / user_id. Writes come from the public POST /api/public/leads route
-- via the service-role admin client (bypasses RLS). RLS is enabled with a
-- deny-by-default posture for normal clients; the only read path is SaaS
-- admins. Every statement is idempotent so the chain replays from an empty DB
-- (R11).

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  gym_name text,
  message text,
  interest text NOT NULL DEFAULT 'demo'
    CHECK (interest IN ('demo', 'sales', 'starter', 'growth', 'enterprise')),
  source text NOT NULL DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE leads IS 'Anonymous marketing leads captured from the public landing page (demo/sales enquiries)';

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_interest ON leads USING btree (interest);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- RLS on, deny-by-default: anonymous inserts arrive via the service-role
-- client (bypasses RLS); no anon/authenticated policy is granted. The only
-- grant is SELECT for SaaS admins (future admin lead inbox).

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SaaS admins can view leads" ON leads;
CREATE POLICY "SaaS admins can view leads"
  ON leads FOR SELECT
  USING (EXISTS (SELECT 1 FROM saas_admins WHERE saas_admins.user_id = auth.uid()));
