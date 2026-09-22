/**
 * VFT subject-lifecycle probe — the tier-A vendor campaign block.
 *
 * `AddEmployee` and its siblings write to **VFT's servers, not to a terminal**
 * (confirmed on the 2026-08-28 call), so the whole subject lifecycle can be
 * exercised without a reader being online and without anyone standing at a
 * door. That makes this the cheapest source of vendor truth we have: real
 * return codes, real field limits, and the answer to A-4 — who assigns `EmpId`.
 *
 * ## What it does NOT do
 *
 * No device command is enqueued: no `syncsometoone`, `validperiod`,
 * `accessgrant`, `enrollfinger`, `dooropen` or `reboot`. Nothing here can
 * change the state of a physical reader.
 *
 * ## Reversibility
 *
 * Every subject it creates uses an id outside `MAX_SUBJECT_ID` (79,999,999),
 * so it can never collide with one our allocator issues, and cleanup runs in a
 * `finally` — including after a failure part-way through.
 *
 * Usage:
 *   npx tsx scripts/vft-lifecycle.ts            # read-only: list what is there
 *   npx tsx scripts/vft-lifecycle.ts --apply    # run the lifecycle
 */

import { config } from 'dotenv'
import { VftAccessControlProvider } from '../src/lib/access-control/VftAccessControlProvider'
import type { AccessCredentials } from '../src/lib/access-control/IAccessControlProvider'

config({ path: '.env.local' })

/** Outside MAX_SUBJECT_ID (79,999,999): our allocator can never issue these. */
const TEST_ID = '90000001'
const TEST_ID_2 = '90000002'

const apply = process.argv.includes('--apply')

const credentials: AccessCredentials = {
  baseUrl: (process.env.VFT_API_BASE_URL ?? '').trim(),
  email: (process.env.VFT_PROBE_EMAIL ?? '').trim(),
  password: process.env.VFT_PROBE_PASSWORD ?? '',
  areaId: 1,
}

const provider = new VftAccessControlProvider()
let token = ''

interface Step {
  id: string
  what: string
  status: number | string
  body: string
  verdict: string
}

const steps: Step[] = []

/** Raw call, so the vendor's own words are captured rather than our reading. */
async function raw(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; text: string }> {
  const res = await fetch(new URL(path, credentials.baseUrl).toString(), {
    method,
    headers: {
      ApiToken: token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  return { status: res.status, text: (await res.text()).slice(0, 300) }
}

function record(
  id: string,
  what: string,
  r: { status: number; text: string },
  verdict = ''
) {
  steps.push({ id, what, status: r.status, body: r.text || '(empty)', verdict })
  console.log(
    `${id.padEnd(9)} ${what.padEnd(46)} ${String(r.status).padEnd(5)} ${r.text.slice(0, 90)}`
  )
}

async function countSubjects(): Promise<number> {
  return (await provider.listSubjects(credentials)).length
}

async function main(): Promise<void> {
  token = await provider.signIn(credentials)
  console.log(`Signed in. Base ${credentials.baseUrl}\n`)

  const before = await countSubjects()
  console.log(`Subjects on the account before: ${before}\n`)

  if (!apply) {
    console.log('Dry run. Re-run with --apply to exercise the lifecycle.')
    return
  }

  console.log(
    `${'STEP'.padEnd(9)} ${'CALL'.padEnd(46)} ${'HTTP'.padEnd(5)} BODY`
  )
  console.log('-'.repeat(110))

  try {
    // ---- create ----
    record(
      'VEND-22a',
      'add subject, we choose EmpId',
      await raw('POST', '/api/template/add', {
        EmpId: TEST_ID,
        EmpName: 'Campaign_Probe',
        AreaID: 1,
      })
    )

    // A-4: does the vendor keep our id, or mint its own?
    const listed = await provider.listSubjects(credentials)
    const mine = listed.find((s) => s.subjectId === TEST_ID)
    console.log(
      `\n  A-4 → account now holds ${listed.length} subject(s); our id present: ${mine ? 'YES' : 'NO'}`
    )
    if (listed.length)
      console.log(`  raw subject fields: ${JSON.stringify(listed[0])}\n`)

    // ---- duplicate ----
    record(
      'DEVICE-03v',
      'add the SAME EmpId again',
      await raw('POST', '/api/template/add', {
        EmpId: TEST_ID,
        EmpName: 'Campaign_Probe',
        AreaID: 1,
      })
    )

    // ---- rename ----
    record(
      'VEND-01',
      'rename via PUT /template/edit/{EmpId}',
      await raw('PUT', `/api/template/edit/${TEST_ID}`, {
        EmpName: 'Campaign_Probe_2',
      })
    )

    // ---- field limits ----
    record(
      'VEND-03a',
      'EmpName exactly 24 chars',
      await raw('POST', '/api/template/add', {
        EmpId: TEST_ID_2,
        EmpName: 'A'.repeat(24),
        AreaID: 1,
      })
    )
    record(
      'VEND-03b',
      'EmpName 40 chars (over the stated 24)',
      await raw('PUT', `/api/template/edit/${TEST_ID_2}`, {
        EmpName: 'B'.repeat(40),
      })
    )
    record(
      'VEND-06',
      'EmpName in Sinhala script',
      await raw('PUT', `/api/template/edit/${TEST_ID_2}`, { EmpName: 'කසුන්' })
    )
    record(
      'VAL-03v',
      'EmpName empty string',
      await raw('PUT', `/api/template/edit/${TEST_ID_2}`, { EmpName: '' })
    )

    const after = await provider.listSubjects(credentials)
    console.log(
      `\n  field-limit outcome: ${JSON.stringify(after.map((s) => ({ id: s.subjectId, name: s.name })))}\n`
    )

    // ---- error shapes ----
    record(
      'ENR-15',
      'rename an EmpId that does not exist',
      await raw('PUT', '/api/template/edit/90009999', { EmpName: 'Nobody' })
    )
    record(
      'ENR-23v',
      'delete an EmpId that does not exist',
      await raw('DELETE', '/api/template/90009999')
    )
    record(
      'VAL-11v',
      'non-numeric EmpId',
      await raw('POST', '/api/template/add', {
        EmpId: 'NOT-NUMERIC',
        EmpName: 'Bad_Id',
        AreaID: 1,
      })
    )
    record(
      'VAL-08v',
      'EmpId of 16 digits (over the stated 15)',
      await raw('POST', '/api/template/add', {
        EmpId: '9'.repeat(16),
        EmpName: 'Too_Long',
        AreaID: 1,
      })
    )

    // ---- our own guard ----
    const guard = await provider
      .upsertSubject(credentials, {
        subjectId: '9'.repeat(16),
        name: 'Too Long',
      })
      .then((o) => JSON.stringify(o))
      .catch((e) => `threw: ${(e as Error).message}`)
    console.log(`\n  our EmpId guard → ${guard}\n`)

    // ---- cancellation path ----
    record(
      'CANCELv',
      'revoke templates: DELETE /template/fromdev/{EmpId}',
      await raw('DELETE', `/api/template/fromdev/${TEST_ID}`)
    )

    // ---- how OUR client reads all of that ----
    //
    // The raw calls above are vendor truth; this is the part that decides what
    // the outbox does with it. A failure read as success leaves a member on a
    // door; a permanent failure read as transient is six wasted attempts.
    console.log('\n--- our CommandOutcome for the same calls ---')
    const show = async (label: string, run: Promise<unknown>) =>
      console.log(`  ${label.padEnd(44)} ${JSON.stringify(await run)}`)

    await show(
      'create a fresh subject',
      provider.upsertSubject(credentials, {
        subjectId: '90000003',
        name: 'Classify Probe',
        areaId: 1,
      })
    )
    await show(
      'create the SAME subject again (HTTP 500)',
      provider.upsertSubject(credentials, {
        subjectId: '90000003',
        name: 'Classify Probe',
        areaId: 1,
      })
    )
    await show(
      'rename it',
      provider.renameSubject(credentials, '90000003', 'Classify Probe 2')
    )
    await show(
      'remove a subject that does not exist',
      provider.removeSubject(credentials, '90009999')
    )
    await show(
      'revoke templates (fromdev)',
      provider.revokeBiometrics(credentials, '90000003')
    )
    await show(
      'remove the probe subject',
      provider.removeSubject(credentials, '90000003')
    )
  } finally {
    console.log('\n--- cleanup ---')
    for (const id of [
      TEST_ID,
      TEST_ID_2,
      '90000003',
      '9'.repeat(16),
      'NOT-NUMERIC',
    ]) {
      const r = await raw(
        'DELETE',
        `/api/template/${encodeURIComponent(id)}`
      ).catch(() => ({
        status: 0,
        text: 'error',
      }))
      console.log(
        `  delete ${id.padEnd(17)} → ${r.status} ${r.text.slice(0, 60)}`
      )
    }
    const left = await countSubjects().catch(() => -1)
    console.log(
      `\nSubjects on the account after cleanup: ${left} (was ${before} before the run)`
    )
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
