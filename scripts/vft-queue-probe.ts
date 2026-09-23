/**
 * Are the readers actually online? — the campaign's tier-B gate.
 *
 * Everything that drives a door goes through the vendor's command queue: we
 * POST a command, it sits there, and the terminal collects it on its next poll.
 * If the terminals are not talking to the vendor, every one of those commands
 * sits until it times out at `-725`, and no amount of application testing will
 * reveal it. The device list does not answer this: `LastRequestTime` was null
 * on both readers, which is the vendor declining to say.
 *
 * So: queue one command, then watch the queue. Collected means online.
 *
 * ## Why the events pull
 *
 * `POST /api/devicecmd/events?DevSN=` asks a terminal to upload its stored
 * attendance log. It is the only command in the collection that changes
 * nothing about the reader — no door opens, nothing reboots, no template or
 * validity window is touched. If a reader has been scanning while we were not
 * listening, this is also the one call that could recover those scans.
 *
 * Usage:
 *   npx tsx scripts/vft-queue-probe.ts            # look at the queue only
 *   npx tsx scripts/vft-queue-probe.ts --queue    # queue a pull and watch it
 */

import { config } from 'dotenv'
import { VftAccessControlProvider } from '../src/lib/access-control/VftAccessControlProvider'
import type { AccessCredentials } from '../src/lib/access-control/IAccessControlProvider'

config({ path: '.env.local' })

const SERIALS = ['NYU7251900066', 'NYU7254500734'] as const

/** Long enough for a PUSH-protocol poll (~30s) with room to spare. */
const WATCH_SECONDS = 150
const CHECK_EVERY_SECONDS = 15

const credentials: AccessCredentials = {
  baseUrl: (process.env.VFT_API_BASE_URL ?? '').trim(),
  email: (process.env.VFT_PROBE_EMAIL ?? '').trim(),
  password: process.env.VFT_PROBE_PASSWORD ?? '',
  areaId: 1,
}

const provider = new VftAccessControlProvider()
const queue = process.argv.includes('--queue')
let token = ''

async function raw(
  method: string,
  path: string
): Promise<{ status: number; text: string }> {
  const res = await fetch(new URL(path, credentials.baseUrl).toString(), {
    method,
    headers: { ApiToken: token },
    signal: AbortSignal.timeout(15_000),
  })

  return { status: res.status, text: (await res.text()).slice(0, 200) }
}

/** The 'never happened' placeholder the vendor uses for an unset timestamp. */
const NEVER = '01/01/1999'

interface QueueEntry {
  Command?: string
  CommitTime?: string
  TransTime?: string
  IsProcessed?: number | string
  ReturnValue?: string
}

/**
 * The queue as the vendor describes it, not merely how long it is.
 *
 * A collected command is NOT removed from the listing: it stays with
 * `IsProcessed` flipped to 1 and the terminal's reply in `ReturnValue`.
 * Counting rows therefore reports "not collected" for a reader that answered
 * instantly - which is exactly the wrong answer to take into a hardware
 * session, and is what this probe reported before it was corrected.
 */
async function entries(serial: string): Promise<QueueEntry[]> {
  // Deliberately NOT via `raw()`: that helper truncates bodies to 200
  // characters so they can be printed, and a truncated JSON array fails to
  // parse and reads as an empty queue. Which is how this probe briefly
  // reported both readers unreachable while one was answering in the same
  // second it was asked.
  const res = await fetch(
    new URL(`/api/devicecmd/${serial}`, credentials.baseUrl).toString(),
    { headers: { ApiToken: token }, signal: AbortSignal.timeout(15_000) }
  )

  try {
    const parsed: unknown = await res.json()
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : []
  } catch {
    return []
  }
}

/** Collected means the device actually took it, whatever the depth says. */
function collected(entry: QueueEntry): boolean {
  return (
    String(entry.IsProcessed) === '1' ||
    (typeof entry.TransTime === 'string' && !entry.TransTime.startsWith(NEVER))
  )
}

function describe(list: QueueEntry[]): string {
  if (list.length === 0) return 'empty'
  const done = list.filter(collected).length
  return `${list.length} queued, ${done} collected`
}

const wait = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000))

async function main(): Promise<void> {
  token = await provider.signIn(credentials)
  console.log(`Signed in to ${credentials.baseUrl}\n`)

  console.log('Queue before:')
  for (const serial of SERIALS) {
    console.log(`  ${serial}  ${describe(await entries(serial))}`)
  }

  if (!queue) {
    console.log('\nRead-only. Re-run with --queue to queue an events pull.')
    return
  }

  console.log('\nQueueing an attendance pull on each reader (changes nothing):')
  for (const serial of SERIALS) {
    const r = await raw('POST', `/api/devicecmd/events?DevSN=${serial}`)
    console.log(`  ${serial}  HTTP ${r.status}  ${r.text}`)
  }

  console.log(
    `\nWatching for up to ${WATCH_SECONDS}s. Collected = IsProcessed 1, or TransTime set.\n`
  )

  for (
    let elapsed = 0;
    elapsed <= WATCH_SECONDS;
    elapsed += CHECK_EVERY_SECONDS
  ) {
    if (elapsed > 0) await wait(CHECK_EVERY_SECONDS)

    const line: string[] = []
    let allCollected = true

    for (const serial of SERIALS) {
      const list = await entries(serial)
      line.push(`${serial}=${describe(list)}`)
      if (!list.length || !list.every(collected)) allCollected = false
    }

    console.log(`  +${String(elapsed).padStart(3)}s  ${line.join('   ')}`)
    if (allCollected) break
  }

  console.log('\nVerdict:')
  for (const serial of SERIALS) {
    const list = await entries(serial)
    const done = list.filter(collected)

    if (done.length > 0) {
      const last = done[done.length - 1]
      console.log(
        `  ${serial}  ONLINE - collected at ${last.TransTime}, replied ${last.ReturnValue || '(no value)'}`
      )
    } else {
      console.log(
        `  ${serial}  NOT REACHING THE VENDOR - TransTime still ${NEVER}, nothing transmitted`
      )
    }
  }

  console.log(
    '\nIf nothing was collected: the readers are not reaching acccloudlk.com.\n' +
      'That is a network or provisioning question for VFT, not an application one,\n' +
      'and no amount of testing on our side can move past it.'
  )
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
