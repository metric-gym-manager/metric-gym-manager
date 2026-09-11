#!/usr/bin/env node
/**
 * Database audit — holds the LIVE database to the contracts this repo declares.
 *
 * Three checks, each written because the thing it checks actually went wrong:
 *
 *  1. ENUM PARITY. Postgres enums vs `supabase/expected-enums.json`. They have
 *     drifted four times, twice reaching production as a failing insert that
 *     was patched afterwards by a migration. `enum-parity.test.ts` holds the
 *     TypeScript side to the same file, so neither side can move alone.
 *
 *  2. FUNCTION SECURITY (rule 2.18). Every project-owned function in `public`
 *     must pin `search_path = pg_catalog, public, pg_temp` with pg_temp LAST,
 *     and no SECURITY DEFINER function may be executable by anon or
 *     authenticated. Five access-control functions sat on the unsafe
 *     `search_path = public` for three weeks, because they were created after
 *     the migration that pinned everything else — a lockdown protects what
 *     exists when it runs, not what is added later. This check is the thing
 *     that would have noticed.
 *
 *  3. MIGRATION DRIFT. The repo chain vs `supabase_migrations`. These disagree
 *     in BOTH directions here: 23 repo migrations had no history entry, 10
 *     entries had no file, and 14 of 15 unrecorded ones had in fact been
 *     applied. Reported, never asserted on — the drift is the normal state and
 *     the point is that it stays visible. **Never decide whether a migration
 *     ran from this table; probe the schema effect.**
 *
 * Read-only: SELECTs against catalog tables, nothing else.
 *
 * Requires SUPABASE_DB_URL. Skips loudly without it, so it is safe to wire into
 * CI before secrets exist — a check that silently passes when it did not run is
 * worse than no check at all.
 *
 * Usage: npm run db:audit
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REQUIRED_PIN = 'pg_catalog, public, pg_temp'

let failures = 0
const fail = (check, message) => {
  failures++
  console.error(`  ✗ [${check}] ${message}`)
}
const pass = (message) => console.log(`  ✓ ${message}`)

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      for (const raw of readFileSync(path.join(ROOT, file), 'utf8').split(
        '\n'
      )) {
        // `.trim()` is load-bearing: a CRLF file leaves a trailing \r on every
        // value, which turns a perfectly good connection string into
        // ERR_INVALID_URL with the offending character invisible in the error.
        const line = raw.trim()
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
        }
      }
    } catch {
      /* absent — handled by the env check below */
    }
  }
}

async function auditEnums(client) {
  console.log(
    '\n── 1. Enum parity (database vs supabase/expected-enums.json) ──'
  )
  const expected = JSON.parse(
    readFileSync(path.join(ROOT, 'supabase/expected-enums.json'), 'utf8')
  )
  const names = Object.keys(expected.enums)

  const { rows } = await client.query(
    `SELECT t.typname AS name,
            -- ::text is load-bearing. Bare \`enumlabel\` is type \`name\`, so
            -- array_agg returns name[] (OID 1003) — an OID node-postgres has no
            -- array parser for, so it hands back the raw literal
            -- \`{active,cancelled,...}\` as a STRING. Spreading that below then
            -- yields one element per character and every enum reports as
            -- drifted. text[] (1009) is parsed into a real array.
            array_agg(e.enumlabel::text ORDER BY e.enumlabel) AS values
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = ANY($1::text[])
      GROUP BY t.typname`,
    [names]
  )

  for (const [name, spec] of Object.entries(expected.enums)) {
    const actual = rows.find((r) => r.name === name)
    if (!actual) {
      fail('enum', `${name} does not exist in the database`)
      continue
    }
    const want = [...spec.values].sort()
    const got = [...actual.values].sort()
    if (want.join(',') !== got.join(',')) {
      const extra = got.filter((v) => !want.includes(v))
      const missing = want.filter((v) => !got.includes(v))
      fail(
        'enum',
        `${name}: ${extra.length ? `DB has extra [${extra}]; ` : ''}` +
          `${missing.length ? `DB missing [${missing}]; ` : ''}` +
          `owner is ${spec.owner}`
      )
    } else {
      pass(`${name} (${got.length} values) matches the contract`)
    }
  }
}

async function auditFunctions(client) {
  console.log('\n── 2. Function security (rule 2.18) ──')

  // Extension-owned functions are excluded: pg_trgm and friends are not ours.
  const { rows } = await client.query(`
    SELECT p.proname,
           p.prosecdef,
           coalesce(p.proconfig::text, '') AS config,
           coalesce(array_to_string(p.proacl, ' '), '') AS acl,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
       )
     ORDER BY p.proname`)

  const unpinned = rows.filter((r) => !r.config.includes(REQUIRED_PIN))
  const exposed = rows.filter(
    (r) => r.prosecdef && /(anon|authenticated)=X/.test(r.acl)
  )

  for (const r of unpinned) {
    fail(
      'search_path',
      `${r.proname}(${r.args}) is pinned "${r.config || 'not at all'}" — ` +
        `must be "${REQUIRED_PIN}" with pg_temp LAST`
    )
  }
  for (const r of exposed) {
    fail(
      'grants',
      `SECURITY DEFINER ${r.proname}(${r.args}) is executable by anon/authenticated`
    )
  }

  if (!unpinned.length) pass(`all ${rows.length} functions pinned correctly`)
  if (!exposed.length)
    pass('no SECURITY DEFINER function exposed to anon/authenticated')
}

async function auditMigrations(client) {
  console.log('\n── 3. Migration drift (repo chain vs applied history) ──')

  const repo = new Set(
    readdirSync(path.join(ROOT, 'supabase/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.replace(/^\d+_/, '').replace(/\.sql$/, ''))
  )

  let applied = new Set()
  try {
    const { rows } = await client.query(
      'SELECT name FROM supabase_migrations.schema_migrations WHERE name IS NOT NULL'
    )
    applied = new Set(rows.map((r) => r.name))
  } catch {
    console.log('  … history table unreadable; skipping the comparison')
    return
  }

  const onlyRepo = [...repo].filter((n) => !applied.has(n))
  const onlyApplied = [...applied].filter((n) => !repo.has(n))

  console.log(`  repo: ${repo.size} · history: ${applied.size}`)
  console.log(`  in repo, not in history: ${onlyRepo.length}`)
  console.log(`  in history, not in repo: ${onlyApplied.length}`)
  console.log(
    '  NOT a failure: these disagree in both directions here, and 14 of 15\n' +
      '  unrecorded migrations were found to have been applied anyway. Decide\n' +
      '  whether a migration ran by probing its schema effect, never from this.'
  )
}

/**
 * Percent-encode the password inside a connection string.
 *
 * A Postgres password may legally contain characters that are structural in a
 * URL. This project's actual `SUPABASE_DB_URL` contains a `?`, which starts a
 * query string and leaves the URL with no host, so `pg` rejects it with a bare
 * `ERR_INVALID_URL` and a redacted input — an error that tells you nothing
 * about which character was at fault.
 *
 * Rather than ask anyone to rewrite a working credential, the userinfo is
 * encoded here. Splitting on the LAST `@` is deliberate: the password may
 * contain one, the host may not.
 */
function normalizeConnectionString(raw) {
  const schemeEnd = raw.indexOf('://')
  if (schemeEnd === -1) return raw

  const scheme = raw.slice(0, schemeEnd + 3)
  const rest = raw.slice(schemeEnd + 3)

  const at = rest.lastIndexOf('@')
  if (at === -1) return raw

  const userinfo = rest.slice(0, at)
  const hostAndPath = rest.slice(at + 1)

  const colon = userinfo.indexOf(':')
  if (colon === -1) return raw

  const user = userinfo.slice(0, colon)
  const password = userinfo.slice(colon + 1)

  // Already encoded? Leave it alone rather than double-encoding the %.
  const encoded = /%[0-9A-Fa-f]{2}/.test(password)
    ? password
    : encodeURIComponent(password)

  return `${scheme}${user}:${encoded}@${hostAndPath}`
}

async function main() {
  loadEnv()

  const connectionString = process.env.SUPABASE_DB_URL
  if (!connectionString) {
    console.log('⚠ db:audit SKIPPED — set SUPABASE_DB_URL to run it.')
    process.exit(0)
  }

  const client = new pg.Client({
    connectionString: normalizeConnectionString(connectionString),
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
  } catch (error) {
    // Supabase's direct `db.<ref>.supabase.co:5432` endpoint resolves to IPv6
    // only. A host without an IPv6 route — WSL and many CI runners — cannot
    // reach it, and the raw ENETUNREACH stack says nothing about why.
    if (error?.code === 'ENETUNREACH' || error?.code === 'EHOSTUNREACH') {
      console.error(
        '\n✗ db:audit could not connect: no route to the database host.\n' +
          "  Supabase's direct connection endpoint is IPv6-only. On a host\n" +
          '  without IPv6 (WSL, many CI runners) use the SESSION POOLER URL\n' +
          '  instead — Supabase dashboard → Project Settings → Database →\n' +
          '  Connection string → Session pooler. It resolves over IPv4.\n'
      )
      process.exit(1)
    }
    throw error
  }

  try {
    await auditEnums(client)
    await auditFunctions(client)
    await auditMigrations(client)
  } finally {
    await client.end()
  }

  console.log('')
  if (failures > 0) {
    console.error(`✗ db:audit — ${failures} problem(s) found.\n`)
    process.exit(1)
  }
  console.log('✅ db:audit — declared contracts hold.\n')
}

main().catch((error) => {
  console.error('db:audit failed to run:', error)
  process.exit(1)
})
