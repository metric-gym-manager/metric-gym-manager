-- Provision colomboshyan@gmail.com as a SaaS admin (platform operator).
--
-- The QR-codes admin dashboard ((admin)/qr-codes) and its API routes are gated
-- by a Supabase session + membership in `saas_admins` (see getSaasAdmin /
-- requireSaasAdmin; architecture rule 2.9). This seeds that allow-list so the
-- operator account can view every gym's registration QR, download/print the
-- poster, and regenerate a gym's token.
--
-- Idempotent: keyed on the resolved auth.users id, ON CONFLICT DO NOTHING. If
-- the account has not signed up yet, the SELECT yields no row and this is a
-- no-op — re-run the migration (or insert manually) once the user exists.

INSERT INTO saas_admins (user_id, note)
SELECT id, 'platform operator — QR admin dashboard'
FROM auth.users
WHERE email = 'colomboshyan@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
