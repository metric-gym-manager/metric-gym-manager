# Database Function Security

> Rule 2.18. Every function in the `public` schema pins its `search_path`, and
> every `SECURITY DEFINER` function is unreachable by `anon` and `authenticated`.
> Both properties are asserted by the migrations that establish them, so a
> regression fails the migration rather than shipping.

Established by `supabase/migrations/20260805000001`–`20260805000005`.

---

## 1. Why this exists

15 of the 19 functions in `public` are `SECURITY DEFINER`. They execute as
`postgres` and deliberately bypass RLS — that is the point of
`register_member_guarded`, `assert_gym_can_add_active_member` and
`save_gym_subscription`, which enforce the multi-tenant quota and billing gates.

Because they bypass RLS, two things are the *only* controls standing between a
caller and a privileged body:

1. **Name resolution** — which table the body actually reads.
2. **`EXECUTE` privilege** — who can invoke it at all.

Both were wrong. The Supabase linter flagged 44 findings across
`function_search_path_mutable` (0011), `anon_security_definer_function_executable`
(0028) and `authenticated_security_definer_function_executable` (0029).

---

## 2. Rule: pin `search_path = pg_catalog, public, pg_temp`

Every function in `public` — `SECURITY DEFINER` or not — must set:

```sql
ALTER FUNCTION public.some_function(args)
  SET search_path = pg_catalog, public, pg_temp;
```

Each element earns its place:

| Element | Why |
| --- | --- |
| `pg_catalog` **first** | Built-in functions and operators can never be shadowed. |
| `public` | Every table, view and enum this project uses lives here (pg_trgm too), so bodies resolve exactly as before. This is what makes pinning behaviour-preserving — **no function body needs rewriting with qualified names**. |
| `pg_temp` **last** | The part everyone misses. See below. |

### 2.1 `pg_temp` must be listed, and listed last

PostgreSQL searches the session temp schema **first — ahead of even
`pg_catalog`** — whenever `pg_temp` is not named explicitly in the path. It is
consulted only for relation and type names, never functions or operators, but
that is precisely enough: any caller can `CREATE TEMP TABLE gyms (...)` and
shadow the real table inside a `SECURITY DEFINER` body.

Naming `pg_temp` last demotes it to lowest priority and closes the hole.

### 2.2 Do NOT use `SET search_path = ''`

This is the remediation the Supabase docs suggest. It silences the linter and
**leaves the vulnerability open**, because an empty path does not list `pg_temp`
either.

Verified on PostgreSQL 16 by planting a temp table named `gyms` claiming an
attacker owned a real gym, then calling `is_gym_owner()` as a non-owner. The
correct answer is `false` in every row:

| `search_path` | `is_gym_owner()` returns | Safe? |
| --- | --- | --- |
| *(mutable — the original state)* | `true` | ✗ cross-tenant ownership bypass |
| `pg_catalog, public, pg_temp` | `false` | ✓ |
| `pg_catalog, public` | `true` | ✗ still exploitable |
| `''` | `true` | ✗ still exploitable |

Only the three-element form is actually safe. All four pass or silence the
linter — the linter is not a proof of correctness here.

The same check was re-run against the hosted project after applying, in a
rolled-back transaction: it returned `false` and read the true owner.

---

## 3. Rule: `SECURITY DEFINER` functions are not reachable by `anon`/`authenticated`

```sql
REVOKE ALL ON FUNCTION public.some_function(args) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.some_function(args) TO service_role;  -- only if actually called
```

PostgREST exposes every function a role can execute at `/rest/v1/rpc/<name>`.
These functions take the tenant id as a **parameter** and resolve nothing from
the session, so a caller could simply pass someone else's `gym_id`. The sharpest
cases were `get_revenue_stats`, `get_member_payment_history` and
`get_overdue_members` — all reachable **unauthenticated**.

### 3.1 Who gets a grant

Only functions the application actually calls, and only `service_role`. Every
`.rpc(` call site in this repo goes through `createAdminClient()` — including
dashboard member registration (`app/api/members/route.ts`) and public QR
registration (`app/api/public/registrations/route.ts`). Nothing calls a
`SECURITY DEFINER` function as `anon` or `authenticated`.

The five currently granted:

| Function | Caller |
| --- | --- |
| `register_member_guarded` | `features/members/services/SupabaseMemberRepository.ts` |
| `save_gym_subscription` | `features/subscriptions/services/SupabaseGymSubscriptionRepository.ts` |
| `process_dunning_suspensions` | ″ (cron) |
| `process_trial_expiry` | ″ (cron) |
| `schedule_charge_retry` | ″ (webhook/cron) |

### 3.2 Trigger functions need no grant at all

PostgreSQL does **not** check `EXECUTE` on a trigger function when the trigger
fires; permission is checked when the trigger is *created*. So
`assign_member_number`, `enforce_active_member_quota` and
`sync_gym_member_count` are revoked from everyone and still work.

Verified: inserting a member as a role holding zero `EXECUTE` on all three still
assigned `member_number` and incremented `gyms.member_count`.

### 3.3 `is_gym_owner` is currently unused

Its `COMMENT` advertises it as an RLS helper but no policy references it. If a
future policy calls it, `authenticated` will need `EXECUTE` granted back
explicitly.

---

## 4. Footgun: `DROP`/`CREATE` silently discards both properties

Changing a function's `RETURNS TABLE` column type requires `DROP` + `CREATE`
(`CREATE OR REPLACE` cannot do it). **`DROP` discards `pg_proc.proconfig` *and*
`pg_proc.proacl`** — so the pinned `search_path` and the `EXECUTE` revocation
both vanish.

Any migration that drops and recreates a function MUST re-apply both:

```sql
DROP FUNCTION IF EXISTS public.f(args);
CREATE FUNCTION public.f(args) ... ;

-- re-apply BOTH, or the earlier migrations silently regress
ALTER FUNCTION public.f(args) SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION public.f(args) FROM PUBLIC, anon, authenticated;
```

`20260805000003` does exactly this and asserts both afterwards.

---

## 5. Post-mortem: what mutable `search_path` and open `EXECUTE` cost

- `get_overdue_members` and `get_upcoming_due_members` **failed on every call**
  in production for an unrelated reason (OUT column declared `member_plan_type`
  while `members.plan_type` is `text`). Nobody noticed, because nothing in the
  app calls them. Two `SECURITY DEFINER` functions were simultaneously broken
  and publicly reachable.
- `register_member_guarded`, `save_gym_subscription` and
  `assert_gym_can_add_active_member` showed `anon=X | authenticated=X` **despite**
  migrations `20260704000003` and `20260708000001/000004` revoking exactly those
  privileges. No migration re-granted them, so they were re-granted outside
  version control. That is why the migrations now **assert** their end state
  rather than merely declaring it.

---

## 6. Checklist when adding or changing a function in `public`

- [ ] `SET search_path = pg_catalog, public, pg_temp` — `pg_temp` last, never `''`.
- [ ] `REVOKE ALL ... FROM PUBLIC, anon, authenticated`.
- [ ] `GRANT EXECUTE ... TO service_role` **only** if a `.rpc(` call site exists.
- [ ] Trigger function? No grant needed.
- [ ] Dropping and recreating? Re-apply the pin *and* the revocation.
- [ ] Add an assertion so a regression fails the migration.
- [ ] Never touch `auth`, `storage`, `realtime`, `extensions` or `graphql_public` —
      Supabase-managed and reset by platform upgrades. Extension-owned functions
      (pg_trgm) are excluded via `pg_depend.deptype = 'e'`.

---

## 7. Verification

Both queries must return zero rows.

```sql
-- 1. any function in public with a mutable search_path
SELECT p.proname, pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN pg_depend d
         ON d.objid = p.oid AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e'
 WHERE n.nspname = 'public'
   AND d.objid IS NULL
   AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c
                    WHERE c LIKE 'search\_path=%');

-- 2. any SECURITY DEFINER function reachable by anon/authenticated
SELECT p.proname, pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN pg_depend d
         ON d.objid = p.oid AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e'
 WHERE n.nspname = 'public'
   AND d.objid IS NULL
   AND p.prosecdef
   AND (has_function_privilege('anon', p.oid, 'EXECUTE')
     OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
```

`mcp__Supabase__get_advisors(type: 'security')` should report no
`function_search_path_mutable`, `anon_security_definer_function_executable` or
`authenticated_security_definer_function_executable` findings.

---

## 8. Related: the repo must reproduce the hosted project

Several problems above existed only because DDL was applied to the hosted
project and never committed — `phone_verifications`, `cleanup_expired_otps`, the
`plan_type` → `text` conversion, and the re-granted `EXECUTE` privileges.

A replay of `supabase/migrations/` onto an empty database must produce the same
schema as the hosted project. This is verifiable: replay all migrations into a
scratch PostgreSQL database and compare per-table column fingerprints plus the
function inventory. At the time of writing both sides agree — 16 tables, 19
functions, 0 unpinned, 0 reachable by `anon`/`authenticated`.

See also R11 (replayable migrations) in
[`feature-first-growth-rules.md`](./feature-first-growth-rules.md).
