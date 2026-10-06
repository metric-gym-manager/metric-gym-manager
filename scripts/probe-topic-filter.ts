/**
 * Live probe: does a Resend broadcast sent with a topic skip the contacts who
 * opted out of that topic? The two-checkbox design on /unsubscribe rests on
 * it (docs/architecture/marketing-email-inverted-check.md, F4).
 *
 * Sends two broadcasts to the Test segment, holding only Resend's test
 * addresses (`delivered+…@resend.dev`, which accept mail and reach no one):
 *   A — with the Marketing topic: must reach IN and skip OUT (opted out);
 *   B — with no topic, the control: must reach BOTH. If B could not see OUT,
 *       OUT's absence from A would prove nothing.
 * Real contacts in the Test segment are taken out for the run and put back
 * afterwards, whatever happens. Absence is only believed after polling: Resend
 * is eventually consistent (observation of 2026-10-06).
 *
 * Usage: npx tsx scripts/probe-topic-filter.ts
 * Needs RESEND_API_KEY (full access) in .env.local. Exit code 1 on a FAIL,
 * 2 when a recipient list had not filled in time (re-read it later).
 *
 * Results of 2026-10-06: PASS, twice (before and after the segments were
 * renamed). The topic broadcast reached only the opted-in contact; the
 * control reached both. Both times the TOPIC broadcast's recipient list filled
 * more than five minutes after the send, so the run printed INCONCLUSIVE and
 * the verdict came from a re-read (Resend MCP `list-broadcast-recipients`,
 * type `sent`) a few minutes later.
 */

import { config } from 'dotenv'
import { Resend } from 'resend'

config({ path: '.env.local', quiet: true })

const TEST_SEGMENT = 'bb11d210-e73d-4955-972d-266f2c9295c0'
const MARKETING_TOPIC = 'f6e083f1-e3aa-4ade-87b3-6131027728d4'
const IN = 'delivered+probe-topic-in@resend.dev'
const OUT = 'delivered+probe-topic-out@resend.dev'
const FROM = 'Metric Gym OS <hello@updates.metricgymos.com>'

const resend = new Resend(process.env.RESEND_API_KEY)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function must<T>(
  label: string,
  call: Promise<{ data: T | null; error: { message: string } | null }>
): Promise<T> {
  const { data, error } = await call
  if (error || data === null) throw new Error(`${label}: ${error?.message}`)
  return data
}

/**
 * Who a broadcast reached, polled until `expected` all appear (or about five
 * minutes pass). Resend fills each broadcast's recipient list on its own
 * schedule: on 2026-10-06 the topic broadcast's list was still empty after
 * two minutes while the control's, sent a moment later, was complete — and
 * minutes later it showed exactly the right recipient.
 */
async function recipients(id: string, expected: string[]): Promise<string[]> {
  let seen: string[] = []
  for (let i = 0; i < 100; i++) {
    const { data } = await resend.broadcasts.recipients(id, {
      type: 'sent',
      limit: 100,
    })
    seen = (data?.data ?? []).map((r) => r.email)
    if (expected.every((e) => seen.includes(e))) break
    await sleep(3000)
  }
  await sleep(15000) // a late arrival would still be a FAIL
  const { data } = await resend.broadcasts.recipients(id, {
    type: 'sent',
    limit: 100,
  })
  return (data?.data ?? []).map((r) => r.email)
}

async function main() {
  const members = await must(
    'list Test segment',
    resend.contacts.list({ segmentId: TEST_SEGMENT, limit: 100 })
  )
  const parked = members.data
    .map((c) => c.email)
    .filter((e) => !e.endsWith('@resend.dev'))
  for (const email of [IN, OUT]) await resend.contacts.remove({ email })

  try {
    for (const email of parked) {
      await must(
        `park ${email}`,
        resend.contacts.segments.remove({ email, segmentId: TEST_SEGMENT })
      )
    }
    for (const email of [IN, OUT]) {
      await must(
        `create ${email}`,
        resend.contacts.create({ email, segments: [{ id: TEST_SEGMENT }] })
      )
    }
    await must(
      'opt OUT out of Marketing',
      resend.contacts.topics.update({
        email: OUT,
        topics: [{ id: MARKETING_TOPIC, subscription: 'opt_out' }],
      })
    )
    let confirmed = false
    for (let i = 0; i < 15 && !confirmed; i++) {
      const t = await must(
        'read OUT topics',
        resend.contacts.topics.list({ email: OUT })
      )
      confirmed = t.data.some(
        (x) => x.id === MARKETING_TOPIC && x.subscription === 'opt_out'
      )
      if (!confirmed) await sleep(1000)
    }
    if (!confirmed)
      throw new Error('OUT never read back as opted out of Marketing')

    const base = {
      segmentId: TEST_SEGMENT,
      from: FROM,
      html: '<p>Topic filter probe. Sent only to Resend test addresses.</p>',
      text: 'Topic filter probe. Sent only to Resend test addresses.',
      send: true as const,
    }
    const a = await must(
      'broadcast A',
      resend.broadcasts.create({
        ...base,
        name: 'Probe: topic filter, Marketing topic',
        subject: 'Probe A (Marketing topic)',
        topicId: MARKETING_TOPIC,
      })
    )
    const b = await must(
      'broadcast B',
      resend.broadcasts.create({
        ...base,
        name: 'Probe: topic filter, no topic (control)',
        subject: 'Probe B (no topic)',
      })
    )

    const reachedA = await recipients(a.id, [IN])
    const reachedB = await recipients(b.id, [IN, OUT])
    console.log(`A (Marketing topic) reached: ${JSON.stringify(reachedA)}`)
    console.log(`B (no topic, control) reached: ${JSON.stringify(reachedB)}`)

    // A recipient that never showed up is a fact about Resend's listing, not
    // about delivery: only OUT appearing in A can FAIL the filter.
    const control =
      reachedB.includes(IN) && reachedB.includes(OUT) ? 'PASS' : 'INCONCLUSIVE'
    const filter = reachedA.includes(OUT)
      ? 'FAIL'
      : reachedA.includes(IN)
        ? 'PASS'
        : 'INCONCLUSIVE'
    console.log(
      `CONTROL ${control}: a broadcast without a topic reaches an opted-out contact`
    )
    console.log(
      `FILTER  ${filter}: a broadcast with a topic skips a contact opted out of it`
    )
    if (control === 'INCONCLUSIVE' || filter === 'INCONCLUSIVE') {
      console.log(
        `Re-read later: the recipient lists of ${a.id} and ${b.id} may still be filling.`
      )
    }
    if (filter === 'FAIL') process.exitCode = 1
    else if (control !== 'PASS' || filter !== 'PASS') process.exitCode = 2
  } finally {
    for (const email of [IN, OUT]) await resend.contacts.remove({ email })
    for (const email of parked) {
      const { error } = await resend.contacts.segments.add({
        email,
        segmentId: TEST_SEGMENT,
      })
      console.log(`restore ${email} to Test: ${error ? error.message : 'ok'}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
