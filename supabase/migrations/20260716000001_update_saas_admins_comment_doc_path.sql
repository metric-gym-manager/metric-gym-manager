-- Update the saas_admins table comment: the operator-provisioning doc moved
-- from docs/DEPLOYMENT_PAYHERE_CHECKLIST.md to docs/setup/ in the 2026-07
-- docs reorganization. Comment-only change; no schema or data impact.

COMMENT ON TABLE public.saas_admins IS
  'Platform-operator allow-list gating /system-health + /api/admin/*. Session + membership here replaces the retired NEXT_PUBLIC_ADMIN_API_SECRET. Provision by inserting a user_id (service role / dashboard SQL) — see docs/setup/DEPLOYMENT_PAYHERE_CHECKLIST.md.';
