# Setup Guide

End-to-end local setup for Metric Gym OS. Consolidates the former
`DATABASE_SETUP.md`, `ENV_SETUP_GUIDE.md`, and `SUPABASE_CONFIG_REQUIRED.md`.

## Prerequisites

- Node.js >= 18, npm >= 9
- A Supabase project (https://app.supabase.com)
- (Optional) the Supabase CLI for migrations: `npm install -g supabase`

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

`.env.example` is the **authoritative, documented list** of every variable —
fill in `.env.local` from it. The essentials to start:

| Variable                        | Where to find it                                                          |
| ------------------------------- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → anon/public key (safe in the browser)                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | same page → service_role secret (**server-only, never commit or expose**) |
| `CRON_SECRET`                   | generate: `openssl rand -base64 32`                                       |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000` for local dev                                     |

Feature integrations (text.lk SMS, PayHere billing, Cloudflare R2 photo
storage, demo tooling) are documented inline in `.env.example`; leave
`ENABLE_REAL_SMS=false` and `PAYHERE_MODE=sandbox` until you go live.

**Security:** `.env.local` is gitignored — never commit it. If a secret is
ever exposed, rotate it in Supabase/PayHere and regenerate `CRON_SECRET`.
Use different values for production (set them in the Vercel dashboard).

## 3. Apply database migrations

Migrations live in `supabase/migrations/`, named with sortable timestamp
prefixes (`YYYYMMDDHHMMSS_description.sql`) and applied in that order.

- **Supabase CLI (recommended):**
  ```bash
  supabase link --project-ref <your-project-ref>
  supabase db push
  ```
- **Dashboard:** open each migration in SQL Editor (oldest first), paste, Run.

All 15 tables enable Row Level Security; the policies are part of the
migrations, so multi-tenant isolation is active as soon as they are applied.

## 4. Configure Supabase Auth

1. Authentication → Providers → **Email**: ensure it is enabled.
2. Enable **"Confirm email"** so Supabase sends verification emails on signup.
   Current app behavior: users can log in immediately after registering and
   see a dismissible "verify your email" banner until they confirm (the
   `email_verified` flag flips when they click the link).
3. (Production) Authentication → SMTP Settings: configure a real provider
   (SendGrid, AWS SES, …). Development can use Supabase's built-in mailer.

## 5. Run the app

```bash
npm run dev
```

Open http://localhost:3000 and register an account. If the gym record
appears in the `gyms` table, your database and auth are wired correctly.

## Verify your setup

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, both keys, and `CRON_SECRET` set in `.env.local`
- [ ] All migrations applied; every table shows RLS enabled
- [ ] Email provider enabled; a test registration succeeds
- [ ] With `ENABLE_REAL_SMS=false`, SMS actions log to the console (mock provider)

## Going to production

See [DEPLOYMENT_PAYHERE_CHECKLIST.md](./DEPLOYMENT_PAYHERE_CHECKLIST.md) for the
production billing + operator-provisioning checklist, and enable Point-in-Time
Recovery (Supabase → Project Settings → Database → Backups) on a paid plan.
