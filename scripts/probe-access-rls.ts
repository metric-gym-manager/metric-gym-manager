/**
 * Access-control RLS and tenant-boundary probe — campaign block P12/P13.
 *
 * Every access-control table is SELECT-only for gym owners: writes must go
 * through `createAdminClient()`. Five routes once shipped writing through the
 * caller's session client and RLS refused every row, in production, with unit
 * tests green — because unit tests mock the repository, so **RLS never runs
 * there**. Only a live stack can catch this class.
 *
 * The sharpest case is DB-10: an RLS-denied DELETE removes nothing and reports
 * no error. `error === null` is therefore not evidence of a write; only the
 * returned row count is. Every write below asserts on rows affected.
 *
 * Read-only in effect: nothing it attempts as a gym session is permitted, and
 * the two service-role writes it makes are reverted before it exits.
 *
 * Usage: npx tsx scripts/probe-access-rls.ts
 */

import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const GYM_A = 'e0d0a7f9-094c-474c-9277-21cdf1b0bffd' // E2E Enterprise, 2 readers
const GYM_B = '3133db6c-55e1-4c30-a309-811e691f0be9' // E2E Lite, none

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const results: { id: string; what: string; verdict: string; detail: string }[] =
  []

function note(id: string, what: string, pass: boolean, detail: string) {
  const verdict = pass ? 'PASS' : 'FAIL'
  results.push({ id, what, verdict, detail })
  console.log(
    `${id.padEnd(11)} ${verdict.padEnd(5)} ${what.padEnd(52)} ${detail}`
  )
}

async function sessionFor(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Could not sign in ${email}: ${error.message}`)
  return client
}

async function main(): Promise<void> {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const gymA = await sessionFor(
    process.env.E2E_ENTERPRISE_GYM_EMAIL!,
    process.env.E2E_ENTERPRISE_GYM_PASSWORD!
  )
  const gymB = await sessionFor(
    process.env.E2E_LITE_GYM_EMAIL!,
    process.env.E2E_LITE_GYM_PASSWORD!
  )

  console.log('Signed in as both gyms.\n')
  console.log(
    `${'CASE'.padEnd(11)} ${'V'.padEnd(5)} ${'WHAT'.padEnd(52)} DETAIL`
  )
  console.log('-'.repeat(120))

  // ---------- reads ----------
  const ownRead = await gymA.from('access_devices').select('id, device_serial')
  note(
    'DB-01',
    'Gym A reads its own devices',
    (ownRead.data?.length ?? 0) === 2,
    `${ownRead.data?.length ?? 0} rows, error=${ownRead.error?.code ?? 'none'}`
  )

  const crossRead = await gymB
    .from('access_devices')
    .select('id')
    .eq('gym_id', GYM_A)
  note(
    'DB-02',
    "Gym B reads Gym A's devices",
    (crossRead.data?.length ?? 0) === 0,
    `${crossRead.data?.length ?? 0} rows — a row this viewer cannot see is indistinguishable from one that does not exist`
  )

  const anonRead = await anon.from('access_devices').select('id')
  note(
    'TENANT-11',
    'Anonymous reads the device table',
    (anonRead.data?.length ?? 0) === 0,
    `${anonRead.data?.length ?? 0} rows, error=${anonRead.error?.code ?? 'none'}`
  )

  const secrets = await gymA.from('access_control_secrets').select('account_id')
  note(
    'SEC-15',
    'Gym A reads the credential table',
    (secrets.data?.length ?? 0) === 0,
    `${secrets.data?.length ?? 0} rows — RLS enabled with no policies, service-role only`
  )

  // Deliberately not readable. `access_sync_jobs` and `access_control_secrets`
  // carry RLS with NO policies, so a gym sees nothing of its own queue — rule
  // 2.9: raw vendor errors and dead-lettered jobs are /system-health only.
  // The gym has 660 dead jobs; seeing any of them here would be the defect.
  const jobs = await gymA.from('access_sync_jobs').select('id').limit(5)
  note(
    'DB-09',
    'Gym A reads the sync queue (must see nothing)',
    (jobs.data?.length ?? 0) === 0,
    `${jobs.data?.length ?? 0} rows — no policy exists, and the gym owns 660 dead jobs it must not see`
  )

  // ---------- writes as the gym: every one must be refused ----------
  const ins = await gymA
    .from('access_devices')
    .insert({
      gym_id: GYM_A,
      device_serial: 'RLSPROBE0001',
      device_name: 'RLS probe',
    })
    .select()
  note(
    'DB-03',
    'Gym A inserts a device directly',
    (ins.data?.length ?? 0) === 0,
    `rows=${ins.data?.length ?? 0}, error=${ins.error?.code ?? 'none'}`
  )

  const target = ownRead.data?.[0]
  const upd = await gymA
    .from('access_devices')
    .update({ device_name: 'RLS probe rename' })
    .eq('id', target?.id ?? '')
    .select()
  note(
    'DB-04',
    'Gym A renames its own device directly',
    (upd.data?.length ?? 0) === 0,
    `rows=${upd.data?.length ?? 0}, error=${upd.error?.code ?? 'none'}`
  )

  const del = await gymA
    .from('access_devices')
    .delete()
    .eq('id', target?.id ?? '')
    .select()
  note(
    'DB-05',
    'Gym A deletes its own device directly',
    (del.data?.length ?? 0) === 0,
    `rows=${del.data?.length ?? 0}, error=${del.error?.code ?? 'none'}`
  )

  // THE case. Not "was there an error" — "did anything change".
  const delReportsNoError = del.error === null && (del.data?.length ?? 0) === 0
  note(
    'DB-10',
    'An RLS-denied DELETE reports no error',
    delReportsNoError,
    delReportsNoError
      ? 'CONFIRMED: error=null and 0 rows removed. Asserting on error alone would have read as success.'
      : `error=${del.error?.code ?? 'none'}, rows=${del.data?.length ?? 0}`
  )

  const stillThere = await gymA.from('access_devices').select('id')
  note(
    'DB-05b',
    'Both readers survived the delete attempt',
    (stillThere.data?.length ?? 0) === 2,
    `${stillThere.data?.length ?? 0} rows remain`
  )

  const crossWrite = await gymB
    .from('access_devices')
    .update({ device_name: 'taken over' })
    .eq('gym_id', GYM_A)
    .select()
  note(
    'TENANT-04',
    "Gym B rewrites Gym A's devices",
    (crossWrite.data?.length ?? 0) === 0,
    `rows=${crossWrite.data?.length ?? 0}, error=${crossWrite.error?.code ?? 'none'}`
  )

  const eventForge = await gymA
    .from('access_events')
    .insert({
      gym_id: GYM_A,
      device_serial: 'NYU7251900066',
      subject_id: 100000,
      occurred_at: new Date().toISOString(),
    })
    .select()
  note(
    'SEC-03',
    'Gym A forges an access event',
    (eventForge.data?.length ?? 0) === 0,
    `rows=${eventForge.data?.length ?? 0}, error=${eventForge.error?.code ?? 'none'}`
  )

  const jobForge = await gymA
    .from('access_sync_jobs')
    .insert({ gym_id: GYM_A, intent: 'reconcile_member', status: 'pending' })
    .select()
  note(
    'SEC-14',
    'Gym A enqueues a sync job directly',
    (jobForge.data?.length ?? 0) === 0,
    `rows=${jobForge.data?.length ?? 0}, error=${jobForge.error?.code ?? 'none'}`
  )

  // ---------- the privileged path must still work ----------
  const svcIns = await admin
    .from('access_devices')
    .insert({
      gym_id: GYM_B,
      device_serial: 'RLSPROBE0002',
      device_name: 'Service-role probe',
      area_id: 1,
    })
    .select()
  note(
    'DB-06',
    'Service role inserts a device',
    (svcIns.data?.length ?? 0) === 1,
    `rows=${svcIns.data?.length ?? 0}, error=${svcIns.error?.code ?? 'none'}`
  )

  const probeId = svcIns.data?.[0]?.id

  const svcUpd = await admin
    .from('access_devices')
    .update({ device_name: 'Service-role probe renamed' })
    .eq('id', probeId ?? '')
    .select()
  note(
    'DB-07',
    'Service role updates a device',
    (svcUpd.data?.length ?? 0) === 1,
    `rows=${svcUpd.data?.length ?? 0}`
  )

  // Gym A must not see Gym B's new reader.
  const leak = await gymA
    .from('access_devices')
    .select('id')
    .eq('id', probeId ?? '')
  note(
    'TENANT-02',
    "Gym A reads Gym B's brand-new device by id",
    (leak.data?.length ?? 0) === 0,
    `${leak.data?.length ?? 0} rows — id substitution gains nothing`
  )

  const svcDel = await admin
    .from('access_devices')
    .delete()
    .eq('id', probeId ?? '')
    .select()
  note(
    'DB-08',
    'Service role deletes a device',
    (svcDel.data?.length ?? 0) === 1,
    `rows=${svcDel.data?.length ?? 0} — cleaned up`
  )

  const final = await admin.from('access_devices').select('gym_id')
  console.log(
    `\nDevices remaining: ${final.data?.length ?? 0} (expected 2, both Gym A's)`
  )

  const failed = results.filter((r) => r.verdict === 'FAIL')
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.log('\nFAILED:')
    failed.forEach((f) => console.log(`  ${f.id} ${f.what} — ${f.detail}`))
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
