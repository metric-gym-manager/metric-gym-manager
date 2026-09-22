/**
 * VFT GYM API v2.0 — read-only vendor probe.
 *
 * Purpose: obtain the account's device serial numbers (`DevSN`) from a real
 * VFT account, and — in the same round trip — prove that
 * `VftAccessControlProvider` actually understands what the live API returns.
 *
 * ## Why this goes through the real client rather than plain `fetch`
 *
 * `listDevices()` parses the response with Zod and, on a shape it does not
 * recognise, returns `[]` rather than throwing. Against a live account that is
 * indistinguishable from "this account owns no readers": no error, no log, an
 * empty device list on the dashboard, and every later command silently
 * targeting nothing. So the probe prints the **raw** payload beside the
 * **parsed** result and fails loudly when they disagree. That disagreement is
 * the single highest-value thing this script can find.
 *
 * ## Read-only, by construction
 *
 * Only `POST /api/user/` (sign-in) and three `GET`s are issued. Nothing here
 * enqueues a device command: no reboot, no door open, no enrolment, no
 * template write. Running it cannot change the state of a terminal.
 *
 * Usage:
 *   VFT_PROBE_EMAIL=… VFT_PROBE_PASSWORD=… npx tsx scripts/vft-probe.ts
 *   npx tsx scripts/vft-probe.ts --email … --password … [--base-url …] [--out path.json]
 *
 * Credentials are read from the environment (`.env.local` is loaded) or from
 * argv; they are never written to the output file. The bearer token is masked
 * in all output.
 *
 * Exit codes: 0 success · 1 usage/config · 2 vendor auth rejected · 3 request failed
 */

import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { AccessCredentials } from '../src/lib/access-control/IAccessControlProvider'
import {
  VendorAuthError,
  VendorRequestError,
  VftAccessControlProvider,
} from '../src/lib/access-control/VftAccessControlProvider'
import { VENDOR_REQUEST_TIMEOUT_MS } from '../src/lib/access-control/config'

config({ path: '.env.local' })

// ============================================================
// Arguments
// ============================================================

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]

  const inline = process.argv.find((a) => a.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : undefined
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

// Trimmed deliberately: a value pasted into a dashboard or an env file with a
// stray leading space is a real and very quiet failure mode.
const rawBaseUrl = arg('base-url') ?? process.env.VFT_API_BASE_URL ?? ''
const baseUrl = rawBaseUrl.trim()
const email = (arg('email') ?? process.env.VFT_PROBE_EMAIL ?? '').trim()
const password = arg('password') ?? process.env.VFT_PROBE_PASSWORD ?? ''
const outPath = resolve(arg('out') ?? `backups/vft-probe/${timestamp}.json`)

const problems: string[] = []
if (!baseUrl) problems.push('VFT_API_BASE_URL is not set (or pass --base-url)')
if (!email) problems.push('VFT_PROBE_EMAIL is not set (or pass --email)')
if (!password)
  problems.push('VFT_PROBE_PASSWORD is not set (or pass --password)')

if (problems.length > 0) {
  console.error('Cannot probe:\n' + problems.map((p) => `  • ${p}`).join('\n'))
  console.error(
    '\nAdd the vendor account credentials to .env.local (gitignored):\n' +
      '  VFT_PROBE_EMAIL=...\n  VFT_PROBE_PASSWORD=...\n' +
      '\nThese are probe-only variables. Production credentials are stored per gym,\n' +
      'encrypted, in access_control_accounts — never in an environment variable.'
  )
  process.exit(1)
}

if (rawBaseUrl !== rawBaseUrl.trim()) {
  console.warn(
    `⚠  VFT_API_BASE_URL has surrounding whitespace (${JSON.stringify(rawBaseUrl)}).\n` +
      '   dotenv and the URL constructor both tolerate it, but a hosting dashboard\n' +
      '   may not. Worth removing in .env.local and in Vercel.\n'
  )
}

const credentials: AccessCredentials = { baseUrl, email, password }
const provider = new VftAccessControlProvider()

// ============================================================
// Raw transport (read-only) — what the vendor actually sent
// ============================================================

interface RawResult {
  path: string
  status: number
  ok: boolean
  body: unknown
  bodyText?: string
  error?: string
}

async function rawGet(path: string, token: string): Promise<RawResult> {
  const url = new URL(path, baseUrl).toString()

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { ApiToken: token },
      signal: AbortSignal.timeout(VENDOR_REQUEST_TIMEOUT_MS),
    })

    const text = await response.text()

    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      // Not JSON. Keep the text — an HTML error page here is itself the finding.
      return {
        path,
        status: response.status,
        ok: response.ok,
        body: null,
        bodyText: text.slice(0, 2000),
        error: 'response was not JSON',
      }
    }

    return { path, status: response.status, ok: response.ok, body }
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Describe a payload's shape without printing account data. */
function describeShape(body: unknown): {
  shape: string
  count: number | null
  keys: string[]
} {
  if (Array.isArray(body)) {
    const first = body[0]
    return {
      shape: 'bare array',
      count: body.length,
      keys:
        first && typeof first === 'object'
          ? Object.keys(first as object).sort()
          : [],
    }
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const arrayKey = Object.keys(record).find((k) => Array.isArray(record[k]))

    if (arrayKey) {
      const rows = record[arrayKey] as unknown[]
      const first = rows[0]
      return {
        shape: `object with array under "${arrayKey}"`,
        count: rows.length,
        keys:
          first && typeof first === 'object'
            ? Object.keys(first as object).sort()
            : [],
      }
    }

    return {
      shape: 'object, no array member',
      count: null,
      keys: Object.keys(record).sort(),
    }
  }

  return { shape: typeof body, count: null, keys: [] }
}

// Fields `deviceSchema` in VftAccessControlProvider knows about. Anything the
// vendor sends beyond these is information we are currently discarding.
const KNOWN_DEVICE_FIELDS = [
  'Area',
  'AreaID',
  'DevName',
  'DevSN',
  'IsOnline',
  'LastActivity',
  'LastRequestTime',
  'LastSeen',
  'TimeZone',
]

// ============================================================
// Run
// ============================================================

async function main(): Promise<void> {
  console.log('VFT vendor probe — read-only')
  console.log(`  base URL : ${baseUrl}`)
  console.log(`  account  : ${email}`)
  console.log(`  time     : ${new Date().toISOString()}\n`)

  // ---- 1. Sign in, through our own client ----
  let token: string
  try {
    token = await provider.signIn(credentials)
  } catch (error) {
    if (error instanceof VendorAuthError) {
      console.error(`✗ Sign-in failed: ${error.message}`)
      console.error(
        '\n  POST /api/user/ (the trailing slash is required) with {email, password}.\n' +
          '  A 404 here usually means the base URL is wrong; a 401 means the credentials are.'
      )
      process.exit(2)
    }
    console.error(
      `✗ Sign-in could not complete: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exit(3)
  }

  console.log(
    `✓ Sign-in accepted — token ${token.length} chars, starts ${token.slice(0, 4)}…\n`
  )

  // ---- 2. Devices: raw, then parsed ----
  const rawDevices = await rawGet('/api/device', token)

  if (!rawDevices.ok) {
    console.error(
      `✗ GET /api/device → HTTP ${rawDevices.status}${rawDevices.error ? ` (${rawDevices.error})` : ''}`
    )
    if (rawDevices.bodyText) console.error(rawDevices.bodyText)
    process.exit(3)
  }

  const shape = describeShape(rawDevices.body)
  console.log('GET /api/device')
  console.log(`  raw shape   : ${shape.shape}`)
  console.log(`  raw count   : ${shape.count ?? 'n/a'}`)
  console.log(`  row fields  : ${shape.keys.join(', ') || '(none)'}`)

  const devices = await provider.listDevices(credentials)
  console.log(`  parsed count: ${devices.length}\n`)

  // The trap this script exists for.
  if ((shape.count ?? 0) > 0 && devices.length === 0) {
    console.error(
      '✗ SCHEMA MISMATCH — the vendor returned devices and our client parsed none.\n' +
        '  `deviceListSchema` accepts a bare array or `{ devices: [...] }`; the live\n' +
        '  payload is neither, or a row is missing the required `DevSN`.\n' +
        `  Live shape: ${shape.shape}; row fields: ${shape.keys.join(', ')}.\n` +
        '  Fix the schema in src/lib/access-control/VftAccessControlProvider.ts.\n' +
        `  Raw payload saved to ${outPath}.`
    )
  }

  const unknownFields = shape.keys.filter(
    (k) => !KNOWN_DEVICE_FIELDS.includes(k)
  )
  if (unknownFields.length > 0) {
    console.warn(
      `⚠  Fields the vendor sends that our schema ignores: ${unknownFields.join(', ')}\n` +
        '   Check whether any is the presence/last-seen signal (simulator test A-2).\n'
    )
  }

  if (devices.length === 0) {
    console.log('  No devices on this account.\n')
  } else {
    console.log('Device serials (DevSN) — this is what VFT asked for:\n')
    for (const device of devices) {
      console.log(`  ${device.serial}`)
      console.log(`      name      : ${device.name}`)
      console.log(`      areaId    : ${device.areaId ?? '(none)'}`)
      console.log(
        `      timezone  : ${device.timezoneOffsetMinutes ?? '(not reported)'} minutes`
      )
      console.log(
        `      online    : ${device.online === null ? 'unknown (vendor sent no presence field)' : device.online}`
      )
      console.log(
        `      last seen : ${device.lastSeenAt ? device.lastSeenAt.toISOString() : '(not reported)'}`
      )
      console.log('')
    }
  }

  // ---- 3. Subjects and queued commands (both read-only, both informative) ----
  const rawSubjects = await rawGet('/api/template', token)
  const subjectShape = describeShape(rawSubjects.body)
  const subjects = rawSubjects.ok
    ? await provider.listSubjects(credentials)
    : []

  console.log('GET /api/template  (employees already on the account)')
  console.log(`  http        : ${rawSubjects.status}`)
  console.log(`  raw shape   : ${subjectShape.shape}`)
  console.log(`  raw count   : ${subjectShape.count ?? 'n/a'}`)
  console.log(`  row fields  : ${subjectShape.keys.join(', ') || '(none)'}`)
  console.log(`  parsed count: ${subjects.length}`)
  if ((subjectShape.count ?? 0) > 0 && subjects.length === 0) {
    console.error(
      '  ✗ SCHEMA MISMATCH on subjects — see the device note above; same class of bug.'
    )
  }
  console.log('')

  const rawCommands = await rawGet('/api/devicecmd', token)
  const commandShape = describeShape(rawCommands.body)
  console.log(
    'GET /api/devicecmd  (queue depth — non-zero means commands are waiting)'
  )
  console.log(`  http        : ${rawCommands.status}`)
  console.log(`  raw shape   : ${commandShape.shape}`)
  console.log(`  raw count   : ${commandShape.count ?? 'n/a'}`)
  console.log(`  row fields  : ${commandShape.keys.join(', ') || '(none)'}`)
  console.log('')

  // ---- 4. Persist the raw evidence ----
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        baseUrl,
        account: email,
        signIn: { ok: true, tokenLength: token.length },
        raw: {
          devices: rawDevices,
          subjects: rawSubjects,
          commands: rawCommands,
        },
        parsed: {
          devices: devices.map((d) => ({
            ...d,
            lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
          })),
          subjects,
        },
      },
      null,
      2
    ) + '\n'
  )

  console.log(`Raw payloads saved to ${outPath} (backups/ is gitignored).`)
  console.log(
    'Treat that file as account data: it contains serials and employee names.'
  )
}

main().catch((error) => {
  if (error instanceof VendorRequestError) {
    console.error(`✗ Vendor returned HTTP ${error.status}: ${error.message}`)
    process.exit(3)
  }
  console.error(error)
  process.exit(3)
})
