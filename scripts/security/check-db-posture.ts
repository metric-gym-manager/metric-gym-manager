/**
 * Database security-posture drift detector.
 *
 * Diffs the LIVE database against scripts/security/expected-db-posture.json and
 * exits non-zero on any deviation. Run in CI and on a schedule.
 *
 * WHY THIS EXISTS
 * Security audit finding C2: migration 20260704000003 revoked EXECUTE on
 * `save_gym_subscription` (the function that writes billing tier/status) from
 * anon/authenticated. The revoke worked. Then the function gained a parameter,
 * and because Supabase ships
 *
 *   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 *     GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
 *
 * the new function object was born anon-callable again. A full billing bypass
 * sat open on production for four months and nothing noticed, because the repo
 * said it was closed.
 *
 * Migration 20260726000003 inverts that default so it should not recur. This
 * script is the backstop that proves it hasn't.
 *
 * Usage:  npm run security:check-db
 * Env:    SUPABASE_DB_URL (same variable the backup script uses)
 */

import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

config({ path: '.env.local' })

const HERE = dirname(fileURLToPath(import.meta.url))

interface ExpectedPosture {
  allowedAnonExecute: string[]
  allowedAuthenticatedExecute: string[]
  expectedZeroPolicyTables: string[]
  expectedRlsDisabledTables: string[]
}

interface GrantRow {
  proname: string
  args: string
  security_definer: boolean
  anon_exec: boolean
  auth_exec: boolean
}

interface TableRow {
  table_name: string
  rls_enabled: boolean
  policy_count: string
}

interface SearchPathRow {
  proname: string
}

/**
 * Functions reachable over PostgREST RPC that a non-service-role caller can
 * execute. Trigger-returning functions are excluded: PostgREST does not expose
 * them and Postgres refuses direct invocation, so their grants are inert.
 */
const GRANT_QUERY = `
  SELECT p.proname,
         pg_get_function_identity_arguments(p.oid) AS args,
         p.prosecdef AS security_definer,
         has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_exec,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prorettype <> 'trigger'::regtype
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ORDER BY p.proname;
`

const TABLE_QUERY = `
  SELECT c.relname AS table_name,
         c.relrowsecurity AS rls_enabled,
         (SELECT count(*) FROM pg_policies pp
           WHERE pp.schemaname = 'public' AND pp.tablename = c.relname) AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname;
`

const SEARCH_PATH_QUERY = `
  SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proconfig IS NULL
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  ORDER BY p.proname;
`

function loadExpected(): ExpectedPosture {
  const raw = readFileSync(join(HERE, 'expected-db-posture.json'), 'utf8')
  return JSON.parse(raw) as ExpectedPosture
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_DB_URL
  if (!url) {
    console.error('✖ SUPABASE_DB_URL is missing (expected in .env.local)')
    process.exit(2)
  }

  const expected = loadExpected()
  const client = new Client({ connectionString: url })
  const failures: string[] = []
  const warnings: string[] = []
  let tableCount = 0

  await client.connect()
  try {
    // --- 1. RPC exposure -----------------------------------------------------
    const grants = await client.query<GrantRow>(GRANT_QUERY)
    for (const row of grants.rows) {
      const flavour = row.security_definer
        ? 'SECURITY DEFINER — bypasses RLS'
        : 'SECURITY INVOKER'

      const offending: string[] = []
      if (row.anon_exec && !expected.allowedAnonExecute.includes(row.proname)) {
        offending.push('anon')
      }
      if (
        row.auth_exec &&
        !expected.allowedAuthenticatedExecute.includes(row.proname)
      ) {
        offending.push('authenticated')
      }

      if (offending.length > 0) {
        failures.push(
          `RPC reachable by ${offending.join(' + ')}: ` +
            `${row.proname}(${row.args}) [${flavour}] — not in the allow-list. ` +
            `Either REVOKE EXECUTE, or add it to expected-db-posture.json as a ` +
            `reviewed security decision.`
        )
      }
    }

    // --- 2. RLS coverage -----------------------------------------------------
    const tables = await client.query<TableRow>(TABLE_QUERY)
    tableCount = tables.rows.length
    for (const row of tables.rows) {
      if (
        !row.rls_enabled &&
        !expected.expectedRlsDisabledTables.includes(row.table_name)
      ) {
        failures.push(
          `RLS DISABLED on public.${row.table_name} — RLS is the tenant-isolation ` +
            `model; a table without it is a cross-tenant leak.`
        )
      }
      if (
        row.rls_enabled &&
        Number(row.policy_count) === 0 &&
        !expected.expectedZeroPolicyTables.includes(row.table_name)
      ) {
        warnings.push(
          `public.${row.table_name} has RLS on but zero policies (deny-all). ` +
            `Intentional? If so add it to expectedZeroPolicyTables.`
        )
      }
    }

    // --- 3. search_path pinning ---------------------------------------------
    const unpinned = await client.query<SearchPathRow>(SEARCH_PATH_QUERY)
    if (unpinned.rowCount && unpinned.rowCount > 0) {
      failures.push(
        `Mutable search_path on ${unpinned.rowCount} function(s): ` +
          `${unpinned.rows.map((r) => r.proname).join(', ')} — ` +
          `privilege-escalation primitive on SECURITY DEFINER functions.`
      )
    }
  } finally {
    await client.end()
  }

  // --- Report ---------------------------------------------------------------
  for (const w of warnings) console.warn(`⚠ ${w}`)

  if (failures.length > 0) {
    console.error(`\n✖ Database posture drift — ${failures.length} issue(s):\n`)
    for (const f of failures) console.error(`  • ${f}`)
    console.error(
      '\nIf a change is intentional, update scripts/security/expected-db-posture.json ' +
        'in the same reviewed commit.\n'
    )
    process.exit(1)
  }

  console.log('✔ Database posture matches expected-db-posture.json')
  console.log('  • no unexpected anon/authenticated/PUBLIC RPC grants')
  console.log(`  • RLS enabled on all ${tableCount} public tables`)
  console.log('  • all project functions have a pinned search_path')
}

main().catch((err: unknown) => {
  console.error('✖ posture check failed to run:', err)
  process.exit(2)
})
