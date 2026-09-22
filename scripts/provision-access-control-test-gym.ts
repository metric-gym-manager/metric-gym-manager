/**
 * Provision the E2E Enterprise gym against the real VFT account.
 *
 * Writes the vendor account (base URL + credentials, encrypted) and registers
 * the two physical readers, going through `SupabaseAccessControlRepository` —
 * the same path the Settings screen uses — rather than hand-writing rows, so
 * the encryption, the upsert semantics and the unique-serial constraint are all
 * exercised as they will be in production.
 *
 * ## Readers are registered DISABLED
 *
 * This gym has 351 seeded members. `reconcile-access` runs nightly and enqueues
 * a job per member needing sync; with an active reader and working credentials
 * that becomes **351 subjects pushed onto physical hardware** overnight,
 * against readers whose template capacity we do not know, and removing them
 * again is a manual cleanup on the vendor console.
 *
 * So both readers land `is_active = false`. Nothing targets an inactive reader:
 * `listActiveDeviceSerials` filters them out, so `SyncMemberAccess` returns
 * idle and the reconciler has nothing to do. Enabling one is a deliberate first
 * step of the campaign, not a side effect of setup — pass `--enable A` or
 * `--enable B` (or use the Settings screen) when the campaign starts.
 *
 * Credentials come from the environment and are never printed, logged or
 * written anywhere but the encrypted column.
 *
 * ## ⚠ Running this overwrites PRODUCTION's readable credential
 *
 * There is one ciphertext in the database and it can only be read by the
 * environment whose `ACCESS_CONTROL_ENCRYPTION_KEY` wrote it. Local and
 * production hold **different keys** (measured 2026-09-22: production could
 * not decrypt a credential this script had written, and every
 * `reconcile_member` job had been dead-lettering on it for 25 days).
 *
 * So `--apply` from a laptop re-encrypts with the laptop's key and leaves
 * production unable to read its own credentials — silently, because a
 * Supabase write that succeeds says nothing about who can decrypt it later.
 * The repair is to re-enter them through the deployed app, which is what
 * `PUT /api/access-control/account` does with production's key.
 *
 * `--apply` therefore refuses unless `ALLOW_CREDENTIAL_OVERWRITE=1` is set.
 *
 * Usage:
 *   npx tsx scripts/provision-access-control-test-gym.ts            # show current state
 *   npx tsx scripts/provision-access-control-test-gym.ts --apply    # write it
 *   npx tsx scripts/provision-access-control-test-gym.ts --enable A # activate one reader
 *   npx tsx scripts/provision-access-control-test-gym.ts --disable B
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { SupabaseAccessControlRepository } from '../src/features/access-control/services/SupabaseAccessControlRepository'
import { VftAccessControlProvider } from '../src/lib/access-control/VftAccessControlProvider'

config({ path: '.env.local' })

/** The seeded Enterprise gym the E2E suite and this campaign both use. */
const GYM_ID = 'e0d0a7f9-094c-474c-9277-21cdf1b0bffd'

/**
 * The two physical readers, as the vendor reports them.
 *
 * `role` is ours — the campaign's Device A / Device B. `vendorName` is what
 * VFT holds, recorded so the two can be told apart on their console.
 */
const READERS = [
  {
    role: 'A',
    serial: 'NYU7251900066',
    vendorName: 'Device1',
    deviceName: 'Device A (test)',
  },
  {
    role: 'B',
    serial: 'NYU7254500734',
    vendorName: 'Device2',
    deviceName: 'Device B (test)',
  },
] as const

/** Colombo. The vendor sent `TimeZone: null`, so this is ours to state. */
const TIMEZONE_OFFSET_MINUTES = 330

/** The vendor's own area for both readers, read from `Area.AreaID`. */
const AREA_ID = 1

const apply = process.argv.includes('--apply')
const enableRole = argValue('--enable')
const disableRole = argValue('--disable')

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? (process.argv[index + 1] ?? null) : null
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local'
    )
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function main(): Promise<void> {
  const client = supabase()
  const repo = new SupabaseAccessControlRepository(client)

  const { data: gym } = await client
    .from('gyms')
    .select('gym_name, subscription_tier')
    .eq('id', GYM_ID)
    .maybeSingle()

  if (!gym) throw new Error(`Gym ${GYM_ID} not found`)

  console.log(
    `Gym: ${(gym as { gym_name: string }).gym_name} (${(gym as { subscription_tier: string }).subscription_tier})\n`
  )

  // ---- Activation toggles are a separate, deliberate action ----
  if (enableRole || disableRole) {
    const role = (enableRole ?? disableRole)!.toUpperCase()
    const reader = READERS.find((r) => r.role === role)
    if (!reader) throw new Error(`Unknown reader role "${role}" — use A or B`)

    const devices = await repo.listDevices(GYM_ID)
    const device = devices.find((d) => d.device_serial === reader.serial)
    if (!device) throw new Error(`Reader ${role} is not registered yet`)

    await repo.setDeviceActive(device.id, Boolean(enableRole))
    console.log(
      `Reader ${role} (${reader.serial}) is now ${enableRole ? 'ACTIVE' : 'inactive'}.`
    )

    if (enableRole) {
      console.log(
        '\n⚠  An active reader is a live sync target. The next reconcile-access run\n' +
          '   (18:30 UTC) will enqueue a job for every member needing sync on this gym.\n' +
          '   Confirm the intended blast radius before leaving it on overnight.'
      )
    }
    return
  }

  // ---- Current state ----
  const existingDevices = await repo.listDevices(GYM_ID)
  const { data: account } = await client
    .from('access_control_accounts')
    .select('base_url, area_id, is_active, updated_at')
    .eq('gym_id', GYM_ID)
    .maybeSingle()

  console.log('Current state')
  console.log(
    `  account : ${account ? `${(account as { base_url: string }).base_url} (active: ${(account as { is_active: boolean }).is_active})` : 'none'}`
  )
  console.log(`  readers : ${existingDevices.length}`)
  for (const device of existingDevices) {
    console.log(
      `      ${device.device_serial}  ${device.device_name}  active=${device.is_active}`
    )
  }
  console.log('')

  if (!apply) {
    console.log('Dry run. Re-run with --apply to write.')
    return
  }

  // ---- 1. Vendor account ----
  //
  // Guarded: see the header. Writing credentials from here encrypts them with
  // THIS environment's key, which is not production's — and production then
  // cannot read its own account until someone re-enters it through the app.
  if (process.env.ALLOW_CREDENTIAL_OVERWRITE !== '1') {
    throw new Error(
      'Refusing to overwrite the stored credentials.\n' +
        '\n' +
        'They are encrypted with the key of whichever environment last wrote them,\n' +
        "and production does not share this machine's key. Writing from here would\n" +
        'leave the deployed app unable to decrypt its own account, silently.\n' +
        '\n' +
        'To store credentials for PRODUCTION, use the deployed Settings screen\n' +
        '(or PUT /api/access-control/account against it).\n' +
        '\n' +
        "If you really mean to write them with this machine's key, re-run with\n" +
        'ALLOW_CREDENTIAL_OVERWRITE=1.'
    )
  }

  const baseUrl = (process.env.VFT_API_BASE_URL ?? '').trim()
  const email = (process.env.VFT_PROBE_EMAIL ?? '').trim()
  const password = process.env.VFT_PROBE_PASSWORD ?? ''

  if (!baseUrl || !email || !password) {
    throw new Error(
      'VFT_API_BASE_URL, VFT_PROBE_EMAIL and VFT_PROBE_PASSWORD must be set in .env.local'
    )
  }

  await repo.saveCredentials(GYM_ID, {
    baseUrl,
    email,
    password,
    areaId: AREA_ID,
  })
  console.log(`✓ Account saved — ${baseUrl}, area ${AREA_ID}`)

  // ---- 2. Prove the round trip, without printing anything secret ----
  const credentials = await repo.getCredentials(GYM_ID)
  if (!credentials) throw new Error('Credentials did not read back')

  const provider = new VftAccessControlProvider()
  const signedIn = await provider.verifyCredentials(credentials)

  console.log(
    `✓ Stored credentials decrypt and authenticate: ${signedIn ? 'yes' : 'NO'}`
  )

  if (!signedIn) {
    throw new Error(
      'Stored credentials did not authenticate — stopping before registering readers'
    )
  }

  const vendorDevices = await provider.listDevices(credentials)
  console.log(
    `✓ Vendor lists ${vendorDevices.length} reader(s): ${vendorDevices.map((d) => d.serial).join(', ')}\n`
  )

  // The preflight the campaign asks for: the serial we are about to register
  // must be one the vendor actually reports, not one we typed from a label.
  for (const reader of READERS) {
    if (!vendorDevices.some((d) => d.serial === reader.serial)) {
      throw new Error(
        `Reader ${reader.role} serial ${reader.serial} is not on the vendor account — refusing to register a serial the vendor does not know`
      )
    }
  }

  // ---- 3. Readers ----
  for (const reader of READERS) {
    const already = existingDevices.find(
      (d) => d.device_serial === reader.serial
    )

    if (already) {
      console.log(
        `• Reader ${reader.role} ${reader.serial} already registered (active=${already.is_active})`
      )
      continue
    }

    const device = await repo.registerDevice(GYM_ID, {
      deviceSerial: reader.serial,
      deviceName: reader.deviceName,
      areaId: AREA_ID,
      timezoneOffsetMinutes: TIMEZONE_OFFSET_MINUTES,
    })

    // Registered, then immediately parked. See the header: an active reader on
    // a 351-member gym is an overnight push of 351 subjects to real hardware.
    await repo.setDeviceActive(device.id, false)

    console.log(
      `✓ Reader ${reader.role} registered ${reader.serial} as "${reader.deviceName}" — INACTIVE`
    )
  }

  const finalDevices = await repo.listDevices(GYM_ID)
  console.log('\nFinal state')
  for (const device of finalDevices) {
    console.log(
      `  ${device.device_serial}  ${device.device_name}  active=${device.is_active}  tz=${device.timezone_offset_minutes}  area=${device.area_id}`
    )
  }

  console.log(
    '\nBoth readers are registered and parked. Enable one when the campaign starts:\n' +
      '  npx tsx scripts/provision-access-control-test-gym.ts --enable A'
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
