4. Security & Data Integrity

4.1 Database Security Layers

- Layer 1 — Row Level Security: every table has RLS enabled, with policies scoped to the owning gym. Policy patterns and the service-role write rules are in the Pattern Index (2.7, 2.18, 2.20).
- Layer 2 — Authorization: check the caller (session, `saas_admins`, plan capability) in the route BEFORE any query. A gym is one Supabase user, so there is no per-user role inside a gym.
- Layer 3 — Input validation: every API route validates its input with a Zod schema before doing anything else.

4.2 Secrets Management Checklist

- All API keys in `.env` (never hardcoded)
- `.env` in `.gitignore`
- `.env.example` committed with dummy values
- Production secrets in Vercel/platform environment variables
- Webhook secrets verified on every request
