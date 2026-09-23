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

async function depth(serial: string): Promise<number> {
  const commands = await provider.listPendingCommands(credentials, serial)
  return commands.length
}

const wait = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000))

async function main(): Promise<void> {
  token = await provider.signIn(credentials)
  console.log(`Signed in to ${credentials.baseUrl}\n`)

  console.log('Queue before:')
  for (const serial of SERIALS) {
    console.log(`  ${serial}  ${await depth(serial)} pending`)
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

  const queued: Record<string, number> = {}
  for (const serial of SERIALS) queued[serial] = await depth(serial)
  console.log(
    `\nQueued now: ${SERIALS.map((s) => `${s}=${queued[s]}`).join('  ')}`
  )

  console.log(
    `\nWatching for ${WATCH_SECONDS}s. A command that disappears was COLLECTED by the reader.\n`
  )

  for (
    let elapsed = CHECK_EVERY_SECONDS;
    elapsed <= WATCH_SECONDS;
    elapsed += CHECK_EVERY_SECONDS
  ) {
    await wait(CHECK_EVERY_SECONDS)

    const now: Record<string, number> = {}
    for (const serial of SERIALS) now[serial] = await depth(serial)

    console.log(
      `  +${String(elapsed).padStart(3)}s  ` +
        SERIALS.map((s) => `${s}=${now[s]}`).join('  ')
    )
  }

  console.log('\nVerdict:')
  for (const serial of SERIALS) {
    const left = await depth(serial)
    const collected = left < queued[serial]
    console.log(
      `  ${serial}  ${collected ? 'ONLINE — the reader collected its command' : 'NOT COLLECTED — the reader is not polling the vendor'}`
    )
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
