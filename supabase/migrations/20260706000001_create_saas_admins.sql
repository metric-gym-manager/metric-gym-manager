-- Migration: SaaS-admin allow-list (platform operators, distinct from gym owners)
--
-- Replaces the NEXT_PUBLIC_ADMIN_API_SECRET Bearer-in-the-browser scheme for the
-- system-health / billing-failures admin surfaces. That secret was compiled into
-- the client bundle (any NEXT_PUBLIC_* var is), so it was extractable by viewing
-- source. Authorization now uses the Supabase session + membership in this table;
-- no shared secret reaches the browser.
--
-- A SaaS admin is the person/company operating the platform, NOT a tenant. The
-- allow-list is keyed by auth.users(id); an admin may or may not also own a gym.

CREATE TABLE saas_admins (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       text,        -- free-text: who/why, for the operator's own audit
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saas_admins ENABLE ROW LEVEL SECURITY;

-- Service role (server admin client, migrations, dashboard SQL) manages the list.
CREATE POLICY "Service role full access saas_admins"
  ON saas_admins FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- A signed-in user may read ONLY their own row. This is what the server gate
-- relies on: getSaasAdmin() runs under the caller's session and selects
-- WHERE user_id = auth.uid() — a non-admin sees zero rows (they have none),
-- an admin sees exactly their row. No user can ever enumerate the admin list,
-- and the check needs no service_role.
CREATE POLICY "Admins can read own admin row"
  ON saas_admins FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE saas_admins IS 'Platform-operator allow-list gating /system-health + /api/admin/*. Session + membership here replaces the retired NEXT_PUBLIC_ADMIN_API_SECRET. Provision by inserting a user_id (service role / dashboard SQL) — see docs/DEPLOYMENT_PAYHERE_CHECKLIST.md.';

-- Provisioning (run as service role / dashboard SQL, never from the client):
--   INSERT INTO saas_admins (user_id, note)
--   SELECT id, 'platform operator' FROM auth.users WHERE email = 'ops@example.com';
