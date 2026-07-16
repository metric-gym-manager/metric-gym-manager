-- Extensions installed at backup time (2026-07-16), project kcafbafxjjrksicwewmp
-- pg_stat_statements v1.11 (schema: extensions)
-- pg_trgm v1.6 (schema: public)
-- pgcrypto v1.3 (schema: extensions)
-- plpgsql v1.0 (built-in)
-- supabase_vault v0.3.1 (schema: vault) — Supabase-managed
-- uuid-ossp v1.1 (schema: extensions)

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
