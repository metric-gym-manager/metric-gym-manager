# Supabase Schema Backup — 2026-07-16 (pre-refactor)

Structure-only snapshot of the live Supabase project `kcafbafxjjrksicwewmp`, taken
immediately before the feature-first codebase refactor. Extracted via read-only
catalog queries (`pg_class`, `pg_policies`, `pg_get_functiondef`, etc.) through the
Supabase MCP server — **not** a `pg_dump` (no DB credentials were available in the
session environment).

## Contents

| File | Contents |
|---|---|
| `00_extensions.sql` | Installed extensions at backup time |
| `01_types.sql` | Enum types (4) |
| `02_tables.sql` | `CREATE TABLE` for all 15 `public` tables |
| `03_constraints.sql` | PK / FK / UNIQUE / CHECK constraints |
| `04_indexes.sql` | All indexes (includes constraint-backed unique indexes) |
| `05_functions.sql` | All 20 application functions (quota guard, billing, triggers fns) |
| `06_triggers.sql` | All 7 non-internal triggers |
| `07_rls_policies.sql` | RLS ENABLE statements + all 36 policies |
| `08_grants.sql` | Table grants for `anon` / `authenticated` / `service_role` |
| `09_comments.sql` | Table & column comments (many are load-bearing docs) |

## Row counts at backup time (data NOT included)

gyms 10 · members 302 · payments 701 · sms_logs 547 · plan_types 22 · announcements 6
· otp_tokens 4 · discounts 1 · cron_logs 35 · checkout_intents 0 · saas_payment_logs 0
· saas_admins 0 · saas_charge_attempts 0 · email_confirmations 0 · phone_verifications 0

**Row data is deliberately not exported here**: member/payment rows contain personal
data (names, phone numbers) that should not be committed to a Git repository. For a
data-level backup use the Supabase Dashboard (Database → Backups — automated daily
backups on paid plans, or trigger/download one manually) or run `pg_dump` with the
project's `SUPABASE_DB_URL`. The refactor this snapshot guards makes **no data or
schema changes**.

## Restore notes

- Files are ordered for sequential application to an empty database, after
  `00_extensions.sql`. They are a faithful reference of live state, not a certified
  dump — for full-fidelity restore prefer Supabase's own backups.
- `pg_trgm`-owned functions (gin_*/gtrgm_*/similarity*/word_similarity*/show_*/set_limit)
  are intentionally omitted from `05_functions.sql`; `CREATE EXTENSION pg_trgm` recreates them.
- `auth.*` and `storage.*` schemas are Supabase-managed and not dumped. Storage tables
  have RLS enabled but **no custom policies** existed at backup time.

## Drift observed between live DB and repo code (informational)

1. **`member_status` enum still contains `'frozen'`** in the live DB, although the
   application removed the frozen status on 2026-03-26. Enum values cannot easily be
   dropped in Postgres; harmless but real drift.
2. **`member_plan_type` enum** contains `'weekly'`, `'3-months'`, `'6-months'`,
   `'custom'` beyond the values the DB function `calculate_next_due_date()` handles
   (daily/monthly/annual) — that function returns NULL for the others. App-side logic
   owns due-date math; noted for awareness.
3. **Broad default grants** (`DELETE, INSERT, ..., TRUNCATE` to `anon`/`authenticated`)
   are the Supabase default posture — actual protection is the RLS policies in
   `07_rls_policies.sql`. All 15 public tables have RLS enabled.
