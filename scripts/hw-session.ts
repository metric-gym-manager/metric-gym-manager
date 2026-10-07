/**
 * Hardware session console — the one tool the on-site door-hardware rounds use.
 *
 * Runbook: docs/architecture/access-control-hardware-session.md
 * Tasks:   docs/architecture/access-control-hardware-runbook.json
 *
 * ## Why one guarded CLI rather than ad-hoc SQL
 *
 * The rounds run against PRODUCTION — Titan Fitness, two real readers at VFT
 * — and are driven by a session that should never improvise a write. Every
 * observation the runbook asks for is one command here, and every write is
 * fenced three ways:
 *
 *   1. Only Titan Fitness, and only members whose name starts `HW Test `. A
 *      real member cannot be addressed at all, by name, number or id.
 *   2. Only the two campaign readers, by letter.
 *   3. Nothing writes without `--apply`; without it a write command prints
 *      what it would do and stops (the repo convention, cf. vft-lifecycle).
 *
 * Vendor credentials come from `.env.local` (`VFT_PROBE_*`) and are injected
 * into the real use cases through a read-only proxy — the stored ciphertext is
 * readable only by the environment whose key wrote it (finding F12), and this
 * script can never write a credential back (the trap that took production
 * offline for 25 days).
 *
 * ## Commands
 *
 *   snapshot                         read-only: readers, HW members, scans, jobs, vendor queue
 *   watch-events [--since 2m] [--timeout 120] [--all]
 *   watch-queue  --reader A|B [--since 5m] [--timeout 180]
 *   set-dates    --member "HW Test 1" [--due D] [--start D] [--apply]
 *                D = YYYY-MM-DD | today | yesterday | tomorrow | +N | -N   (gym-local days)
 *   drain        [--crash-after N] [--apply]   run the real outbox drain once, now
 *   reconcile    [--apply]           run the real nightly reconcile for Titan, now
 *   vendor       <validperiod|block|grant|sync> --member M --reader A|B [--start YYYYMMDD --end YYYYMMDD] [--apply]
 *   vendor       events-pull --reader A|B [--apply]
 *   enrol        --member M --reader A|B [--consent] [--apply]
 *   withdraw     --member M [--apply]          consent withdrawal, as the panel's Remove fingerprint
 *   race         <consent|enrol-both|enrol-two|enrol-vs-cancel|double-cancel> --member M [--member2 M] [--reader A|B] [--consent] [--apply]
 *   ambiguous    <enrol|sync> --member M [--reader A|B] [--consent] [--apply]
 *   coverage                         offline: every catalogue case has exactly one disposition
 *
 * Usage: npx tsx scripts/hw-session.ts <command> [options]
 */

import { config } from 'dotenv'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SupabaseAccessControlRepository } from '../src/features/access-control/services/SupabaseAccessControlRepository'
import type { IAccessControlRepository } from '../src/features/access-control/services/IAccessControlRepository'
import { SyncMemberAccess } from '../src/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '../src/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '../src/features/access-control/services/EvictInactiveSubjects'
import { DrainAccessSyncQueue } from '../src/features/access-control/services/DrainAccessSyncQueue'
import { ReconcileMemberAccess } from '../src/features/access-control/services/ReconcileMemberAccess'
import { ManageMemberBiometric } from '../src/features/access-control/services/ManageMemberBiometric'
import { SupabaseGymSubscriptionRepository } from '../src/features/subscriptions/services/SupabaseGymSubscriptionRepository'
import { CancelMember } from '../src/features/members/services/CancelMember'
import { SuspendMember } from '../src/features/members/services/SuspendMember'
import { MemberStatus } from '../src/features/members/config/StatusConfig'
import { SupabaseMemberRepository } from '../src/features/members/services/SupabaseMemberRepository'
import {
  classifyDeviceEvent,
  describeDeviceEvent,
} from '../src/features/access-control/config/DeviceEventCodes'
import {
  AccessSyncStatus,
  DEVICE_OFFLINE_AFTER_SECONDS,
} from '../src/features/access-control/config/AccessControlConfig'
import { VftAccessControlProvider } from '../src/lib/access-control/VftAccessControlProvider'
import type {
  AccessCredentials,
  IAccessControlProvider,
} from '../src/lib/access-control/IAccessControlProvider'

config({ path: '.env.local' })

// ============================================================
// The fence
// ============================================================

/** Titan Fitness — the gym both campaign readers are registered to. */
const TITAN_GYM_ID = '481599f6-5134-4152-83b2-6e2dd10e3018'

/** The only member names any write here will touch. */
const TEST_MEMBER_PREFIX = 'HW Test '

const READERS = { A: 'NYU7251900066', B: 'NYU7254500734' } as const
type ReaderLetter = keyof typeof READERS

/** Gym-local offset (Asia/Colombo has no DST). */
const SLT_OFFSET_MINUTES = 330

/** The vendor's "never happened" timestamp. */
const VENDOR_NEVER = '01/01/1999'

const EVIDENCE_DIR = resolve('backups/hw-session')

// ============================================================
// Arguments
// ============================================================

const argv = process.argv.slice(2)
const command = argv[0] ?? ''
const positional = argv[1] && !argv[1].startsWith('--') ? argv[1] : ''

function arg(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1]
  }
  const inline = argv.find((a) => a.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : undefined
}

const flag = (name: string): boolean => argv.includes(`--${name}`)
const apply = flag('apply')

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

// ============================================================
// Clients
// ============================================================

function requireEnv(name: string): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) fail(`${name} is not set in .env.local`)
  return value
}

const supabase: SupabaseClient = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const credentials: AccessCredentials = {
  baseUrl: requireEnv('VFT_API_BASE_URL'),
  email: requireEnv('VFT_PROBE_EMAIL'),
  password: process.env.VFT_PROBE_PASSWORD ?? '',
  areaId: 1,
}
if (!credentials.password) fail('VFT_PROBE_PASSWORD is not set in .env.local')

const provider = new VftAccessControlProvider()

/**
 * The real repository with two changes: Titan's credentials come from
 * `.env.local`, and credentials can never be written. Any other gym gets no
 * credentials at all, so nothing here can act for a gym it was not built for.
 */
function sessionRepository(): IAccessControlRepository {
  const repo = new SupabaseAccessControlRepository(supabase)

  return new Proxy(repo, {
    get(target, prop, receiver) {
      if (prop === 'getCredentials') {
        return async (gymId: string) =>
          gymId === TITAN_GYM_ID ? credentials : null
      }
      if (prop === 'saveCredentials') {
        return async () => {
          throw new Error('hw-session never writes vendor credentials')
        }
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

// ============================================================
// Time
// ============================================================

/** A gym-local wall-clock rendering, which is what the reader screen shows. */
function slt(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const local = new Date(date.getTime() + SLT_OFFSET_MINUTES * 60_000)
  return local.toISOString().replace('T', ' ').slice(0, 19)
}

function ago(value: string | null | undefined): string {
  if (!value) return ''
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 120) return `${seconds}s ago`
  if (seconds < 7200) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 172_800) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86_400)}d ago`
}

/** `90s`, `5m`, `2h`, `now` or an ISO instant. */
function parseSince(value: string | undefined, fallback: string): Date {
  const raw = (value ?? fallback).trim()
  if (raw === 'now') return new Date()
  const relative = raw.match(/^(\d+)([smh])$/)
  if (relative) {
    const unit = { s: 1_000, m: 60_000, h: 3_600_000 }[relative[2] as 's']
    return new Date(Date.now() - Number(relative[1]) * unit)
  }
  const instant = new Date(raw)
  if (Number.isNaN(instant.getTime())) fail(`Cannot read --since "${raw}"`)
  return instant
}

/** Today's date in the gym's own calendar, as YYYY-MM-DD. */
function gymToday(): string {
  return slt(new Date()).slice(0, 10)
}

/** `YYYY-MM-DD`, `today`, `yesterday`, `tomorrow`, `+N`, `-N` → YYYY-MM-DD. */
function resolveDay(value: string): string {
  const named: Record<string, number> = { today: 0, yesterday: -1, tomorrow: 1 }
  const offset =
    value in named
      ? named[value]
      : /^[+-]\d+$/.test(value)
        ? Number(value)
        : null

  if (offset !== null) {
    const base = new Date(`${gymToday()}T00:00:00Z`)
    base.setUTCDate(base.getUTCDate() + offset)
    return base.toISOString().slice(0, 10)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(
      `"${value}" is not a date (YYYY-MM-DD, today, yesterday, tomorrow, +N, -N)`
    )
  }
  return value
}

/** The vendor's `MM/DD/YYYY, HH:mm:ss` (gym-local) as an instant, or null for never. */
function vendorTime(value: unknown): Date | null {
  if (typeof value !== 'string' || value.startsWith(VENDOR_NEVER)) return null
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4}),? (\d{2}):(\d{2}):(\d{2})/
  )
  if (!match) return null
  const [, mm, dd, yyyy, hh, mi, ss] = match
  const asUtc = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss)
  return new Date(asUtc - SLT_OFFSET_MINUTES * 60_000)
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ============================================================
// Readers, members
// ============================================================

function readerSerial(value: string | undefined, required = true): string {
  if (!value) {
    if (required) fail('Name a reader: --reader A or --reader B')
    return ''
  }
  const upper = value.trim().toUpperCase()
  if (upper === 'A' || upper === 'B') return READERS[upper as ReaderLetter]
  const known = Object.values(READERS) as string[]
  if (known.includes(upper)) return upper
  return fail(`"${value}" is not a campaign reader. Use A or B.`)
}

function readerLetter(serial: string | null | undefined): string {
  if (serial === READERS.A) return 'A'
  if (serial === READERS.B) return 'B'
  return serial ?? '—'
}

interface DeviceRow {
  id: string
  device_serial: string
  device_name: string
  is_active: boolean
  last_seen_at: string | null
  clock_skew_seconds: number | null
  template_count: number
  template_capacity: number | null
}

async function titanDevices(): Promise<DeviceRow[]> {
  const { data, error } = await supabase
    .from('access_devices')
    .select(
      'id, device_serial, device_name, is_active, last_seen_at, clock_skew_seconds, template_count, template_capacity'
    )
    .eq('gym_id', TITAN_GYM_ID)
    .order('device_serial')
  if (error) fail(`access_devices: ${error.message}`)
  return (data ?? []) as DeviceRow[]
}

async function deviceIdFor(serial: string): Promise<string> {
  const device = (await titanDevices()).find((d) => d.device_serial === serial)
  if (!device) fail(`Reader ${serial} is not registered to Titan Fitness`)
  return device.id
}

interface SubjectRow {
  subject_id: number
  synced_device_serials: string[] | null
  finger_enrolled: boolean
  provisioned_at: string | null
  last_synced_valid_from: string | null
  last_synced_valid_to: string | null
  last_synced_blocked: boolean | null
  updated_at: string
}

interface MemberRow {
  id: string
  name: string
  member_number: number | null
  status: string
  membership_start_date: string | null
  next_due_date: string | null
  biometric_consent_at: string | null
  updated_at: string
  member_access_subjects: SubjectRow[] | SubjectRow | null
}

const MEMBER_COLUMNS =
  'id, name, member_number, status, membership_start_date, next_due_date, biometric_consent_at, updated_at, member_access_subjects(subject_id, synced_device_serials, finger_enrolled, provisioned_at, last_synced_valid_from, last_synced_valid_to, last_synced_blocked, updated_at)'

function subjectOf(member: MemberRow): SubjectRow | null {
  const s = member.member_access_subjects
  if (!s) return null
  return Array.isArray(s) ? (s[0] ?? null) : s
}

async function hwMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('members')
    .select(MEMBER_COLUMNS)
    .eq('gym_id', TITAN_GYM_ID)
    .like('name', `${TEST_MEMBER_PREFIX}%`)
    .order('name')
  if (error) fail(`members: ${error.message}`)
  return (data ?? []) as MemberRow[]
}

/**
 * Resolve `--member` to an HW test member, or refuse.
 *
 * Accepts "HW Test 1", "1", a member number or a member id — and in every case
 * re-checks gym and name prefix on the row itself, so no spelling of a real
 * member's identity gets through.
 */
async function hwMember(
  value: string | undefined,
  label = 'member'
): Promise<MemberRow> {
  if (!value) fail(`Name a test member: --${label} "HW Test 1"`)
  const wanted = /^\d$/.test(value) ? `${TEST_MEMBER_PREFIX}${value}` : value
  const column = /^[0-9a-f-]{36}$/i.test(wanted)
    ? 'id'
    : /^\d+$/.test(wanted)
      ? 'member_number'
      : 'name'

  const { data, error } = await supabase
    .from('members')
    .select(`${MEMBER_COLUMNS}, gym_id`)
    .eq('gym_id', TITAN_GYM_ID)
    .eq(column, wanted)
  if (error) fail(`members: ${error.message}`)

  const rows = (data ?? []) as Array<MemberRow & { gym_id: string }>
  if (rows.length !== 1) fail(`No single Titan member matches "${value}"`)

  const row = rows[0]
  if (row.gym_id !== TITAN_GYM_ID || !row.name.startsWith(TEST_MEMBER_PREFIX)) {
    fail(
      `REFUSED: "${row.name}" is not an HW test member. hw-session only touches members named "${TEST_MEMBER_PREFIX}…" in Titan Fitness.`
    )
  }
  return row
}

function heldBy(subject: SubjectRow | null): string {
  const held = subject?.synced_device_serials ?? []
  return held.length ? held.map(readerLetter).sort().join('+') : 'none'
}

// ============================================================
// Vendor (raw reads — the parsed client drops the fields we need to see)
// ============================================================

let vendorToken = ''

async function vendorGet(path: string): Promise<unknown> {
  if (!vendorToken) vendorToken = await provider.signIn(credentials)
  const response = await fetch(new URL(path, credentials.baseUrl).toString(), {
    headers: { ApiToken: vendorToken },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`GET ${path} → HTTP ${response.status}`)
  return response.json()
}

async function vendorPost(
  path: string
): Promise<{ status: number; text: string }> {
  if (!vendorToken) vendorToken = await provider.signIn(credentials)
  const response = await fetch(new URL(path, credentials.baseUrl).toString(), {
    method: 'POST',
    headers: { ApiToken: vendorToken },
    signal: AbortSignal.timeout(20_000),
  })
  return {
    status: response.status,
    text: (await response.text()).slice(0, 300),
  }
}

type VendorRow = Record<string, unknown>

const rows = (value: unknown): VendorRow[] =>
  Array.isArray(value) ? (value as VendorRow[]) : []

interface QueueEntry {
  id: number
  serial: string
  command: string
  commit: Date | null
  trans: Date | null
  response: Date | null
  processed: boolean
  returnValue: string
}

async function vendorQueue(serial: string): Promise<QueueEntry[]> {
  return rows(await vendorGet(`/api/devicecmd/${encodeURIComponent(serial)}`))
    .map((r) => ({
      id: Number(r.ID),
      serial: String(r.DevSN ?? serial),
      command: String(r.Command ?? ''),
      commit: vendorTime(r.CommitTime),
      trans: vendorTime(r.TransTime),
      response: vendorTime(r.ResponseTime),
      processed: String(r.IsProcessed) === '1',
      returnValue: String(r.ReturnValue ?? ''),
    }))
    .sort((a, b) => a.id - b.id)
}

function queueState(entry: QueueEntry): string {
  if (!entry.trans) return 'NEVER SENT'
  if (!entry.processed) return 'SENT, NOT DONE'
  if (!entry.response && !entry.returnValue) return 'SENT, NO REPLY'
  return 'DONE'
}

function returnCode(entry: QueueEntry): string {
  const match = entry.returnValue.match(/Return=(-?\d+)/)
  return match ? match[1] : '—'
}

// ============================================================
// Output
// ============================================================

function table(headers: string[], body: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.min(60, Math.max(h.length, ...body.map((r) => (r[i] ?? '').length)))
  )
  const line = (cells: string[]) =>
    '  ' +
    cells.map((c, i) => (c ?? '').slice(0, 60).padEnd(widths[i])).join('  ')
  console.log(line(headers))
  console.log('  ' + widths.map((w) => '─'.repeat(w)).join('  '))
  for (const row of body) console.log(line(row))
  if (body.length === 0) console.log('  (none)')
}

function heading(text: string): void {
  console.log(`\n■ ${text}`)
}

function saveEvidence(name: string, data: unknown): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = resolve(EVIDENCE_DIR, `${stamp}-${name}.json`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2))
  return path
}

function dryRun(description: string): void {
  console.log(
    `\nDRY RUN — would ${description}.\nRe-run with --apply to do it.\n`
  )
}

// ============================================================
// snapshot
// ============================================================

async function snapshot(): Promise<void> {
  const eventLimit = Number(arg('events') ?? 10)
  const jobLimit = Number(arg('jobs') ?? 10)
  const queueLimit = Number(arg('queue') ?? 8)

  console.log(
    `hw-session snapshot — ${slt(new Date())} SLT (gym today ${gymToday()})`
  )

  const devices = await titanDevices()
  heading('Our readers (what the dashboard derives its badges from)')
  table(
    [
      'Rdr',
      'Serial',
      'In use',
      'Presence',
      'Last contact',
      'Skew',
      'Templates',
    ],
    devices.map((d) => {
      const presence = !d.last_seen_at
        ? 'No contact yet'
        : (Date.now() - new Date(d.last_seen_at).getTime()) / 1000 <=
            DEVICE_OFFLINE_AFTER_SECONDS
          ? 'Online'
          : 'Not responding'
      return [
        readerLetter(d.device_serial),
        d.device_serial,
        d.is_active ? 'yes' : 'PAUSED',
        presence,
        d.last_seen_at
          ? `${slt(d.last_seen_at)} (${ago(d.last_seen_at)})`
          : '—',
        d.clock_skew_seconds === null ? '—' : `${d.clock_skew_seconds}s`,
        `${d.template_count}/${d.template_capacity ?? '?'}`,
      ]
    })
  )

  const members = await hwMembers()
  const memberIds = members.map((m) => m.id)
  heading(`HW test members (${members.length})`)
  table(
    [
      'Name',
      '#',
      'Status',
      'Start',
      'Due',
      'Consent',
      'Subject',
      'Held by',
      'Finger',
      'Window sent',
      'Blocked',
    ],
    members.map((m) => {
      const s = subjectOf(m)
      return [
        m.name,
        String(m.member_number ?? ''),
        m.status,
        m.membership_start_date ?? '—',
        m.next_due_date ?? '—',
        m.biometric_consent_at
          ? slt(m.biometric_consent_at).slice(0, 16)
          : 'none',
        s ? String(s.subject_id) : '—',
        heldBy(s),
        s ? (s.finger_enrolled ? 'YES' : 'no') : '—',
        s?.last_synced_valid_to
          ? `${s.last_synced_valid_from}→${s.last_synced_valid_to}`
          : '—',
        s ? String(s.last_synced_blocked) : '—',
      ]
    })
  )

  // The stop condition the runbook names: a member who is NOT an HW test
  // member changing during a session. Shown every time so it cannot be missed.
  const { data: others } = await supabase
    .from('member_access_subjects')
    .select('member_id, updated_at, members!inner(name)')
    .eq('gym_id', TITAN_GYM_ID)
    .not('members.name', 'like', `${TEST_MEMBER_PREFIX}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
  const newestOther = (others ?? [])[0] as { updated_at: string } | undefined
  console.log(
    `\n  Other (real) Titan subjects — newest change: ${newestOther ? `${slt(newestOther.updated_at)} (${ago(newestOther.updated_at)})` : 'none'}`
  )

  const { data: events } = await supabase
    .from('access_events')
    .select(
      'id, occurred_at, created_at, device_serial, subject_id, member_id, event_code, verify_type, raw'
    )
    .eq('gym_id', TITAN_GYM_ID)
    .order('created_at', { ascending: false })
    .limit(eventLimit)
  const nameById = new Map(members.map((m) => [m.id, m.name]))
  heading(`Latest scans stored (${(events ?? []).length}, newest first)`)
  table(
    [
      'Reader time (SLT)',
      'Stored (SLT)',
      'Rdr',
      'Subject',
      'Member',
      'Code',
      'Meaning',
      'Verify',
    ],
    (events ?? []).map((e) => {
      const code = Number(e.event_code)
      return [
        slt(e.occurred_at),
        slt(e.created_at),
        readerLetter(e.device_serial),
        String(e.subject_id),
        e.member_id
          ? (nameById.get(e.member_id) ?? 'real member')
          : 'Not recognised',
        String(e.event_code ?? '—'),
        Number.isFinite(code)
          ? `${classifyDeviceEvent(code)}: ${describeDeviceEvent(code)}`
          : '—',
        String(e.verify_type ?? '—'),
      ]
    })
  )

  const { data: jobs } = await supabase
    .from('access_sync_jobs')
    .select(
      'created_at, updated_at, member_id, intent, status, attempts, last_error, payload'
    )
    .eq('gym_id', TITAN_GYM_ID)
    .order('created_at', { ascending: false })
    .limit(jobLimit)
  const { count: deadCount } = await supabase
    .from('access_sync_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', AccessSyncStatus.Dead)
  heading(`Latest outbox jobs (dead jobs, all gyms: ${deadCount ?? '?'})`)
  table(
    ['Created (SLT)', 'Member', 'Intent', 'Status', 'Tries', 'Error'],
    (jobs ?? []).map((j) => [
      slt(j.created_at),
      j.member_id
        ? (nameById.get(j.member_id) ?? 'real member')
        : '(device op)',
      j.intent,
      j.status,
      String(j.attempts),
      (j.last_error ?? '').slice(0, 50),
    ])
  )

  const vendorDevices = rows(await vendorGet('/api/device'))
  heading('Vendor device records (counters VFT may now be filling in)')
  table(
    [
      'Rdr',
      'Vendor name',
      'LastRequestTime',
      'LastUpdateTime',
      'FpCount',
      'UserCount',
      'AttCount',
      'FaceCount',
    ],
    vendorDevices
      .filter((d) =>
        (Object.values(READERS) as string[]).includes(String(d.DevSN))
      )
      .map((d) => [
        readerLetter(String(d.DevSN)),
        String(d.DevName ?? ''),
        String(d.LastRequestTime ?? 'null'),
        String(d.LastUpdateTime ?? 'null'),
        String(d.FpCount ?? 'null'),
        String(d.UserCount ?? 'null'),
        String(d.AttCount ?? 'null'),
        String(d.FaceCount ?? 'null'),
      ])
  )

  const subjectIds = new Set(
    members.map((m) => subjectOf(m)?.subject_id).filter((v): v is number => !!v)
  )
  const templates = rows(await vendorGet('/api/template'))
  heading('Vendor subject records for HW members (central copy)')
  table(
    ['EmpId', 'EmpName', 'StartDate', 'EndDate', 'IsSync', 'IsDelete'],
    templates
      .filter((t) => subjectIds.has(Number(t.EmpId)))
      .map((t) => [
        String(t.EmpId),
        String(t.EmpName ?? ''),
        String(t.StartDate ?? 'null'),
        String(t.EndDate ?? 'null'),
        String(t.IsSync ?? 'null'),
        String(t.IsDelete ?? 'null'),
      ])
  )
  console.log(`  (${templates.length} subjects on the vendor account in total)`)

  const queues: Record<string, QueueEntry[]> = {}
  for (const [letter, serial] of Object.entries(READERS)) {
    const queue = await vendorQueue(serial)
    queues[letter] = queue
    const notDone = queue.filter((q) => queueState(q) !== 'DONE').length
    heading(
      `Reader ${letter} command queue — last ${queueLimit} (${notDone} not done of ${queue.length})`
    )
    table(
      ['ID', 'Committed (SLT)', 'Transmitted', 'State', 'Ret', 'Command'],
      queue
        .slice(-queueLimit)
        .map((q) => [
          String(q.id),
          slt(q.commit),
          q.trans ? slt(q.trans) : 'never',
          queueState(q),
          returnCode(q),
          q.command.slice(0, 60),
        ])
    )
  }

  const path = saveEvidence('snapshot', {
    at: new Date().toISOString(),
    devices,
    members,
    events,
    jobs,
    vendorDevices: vendorDevices.filter((d) =>
      (Object.values(READERS) as string[]).includes(String(d.DevSN))
    ),
    vendorTemplates: templates.filter((t) => subjectIds.has(Number(t.EmpId))),
    queues,
    memberIds,
  })
  console.log(`\nEvidence: ${path}\n`)
}

// ============================================================
// watch-events
// ============================================================

async function watchEvents(): Promise<void> {
  const since = parseSince(arg('since'), '2m')
  const timeoutSeconds = Number(arg('timeout') ?? 120)
  const keepWatching = flag('all')
  const members = await hwMembers()
  const nameById = new Map(members.map((m) => [m.id, m.name]))
  const seen = new Set<string>()
  const started = Date.now()
  let firstAt: number | null = null

  console.log(
    `Watching access_events for Titan since ${slt(since)} SLT, up to ${timeoutSeconds}s${keepWatching ? '' : ' (stops 15s after the first scan)'}…`
  )

  while ((Date.now() - started) / 1000 < timeoutSeconds) {
    const { data, error } = await supabase
      .from('access_events')
      .select(
        'id, occurred_at, created_at, device_serial, subject_id, member_id, event_code, verify_type, checking_status, raw'
      )
      .eq('gym_id', TITAN_GYM_ID)
      .gte('created_at', since.toISOString())
      .order('created_at')
    if (error) fail(`access_events: ${error.message}`)

    for (const e of data ?? []) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      firstAt ??= Date.now()
      const code = Number(e.event_code)
      const skew = Math.round(
        (new Date(e.occurred_at).getTime() - new Date(e.created_at).getTime()) /
          1000
      )
      console.log(
        `\n  ● SCAN  reader ${readerLetter(e.device_serial)}  subject ${e.subject_id}  ` +
          `${e.member_id ? (nameById.get(e.member_id) ?? 'REAL MEMBER') : 'Not recognised'}\n` +
          `    event ${e.event_code ?? '—'} = ${Number.isFinite(code) ? `${classifyDeviceEvent(code)} / ${describeDeviceEvent(code)}` : '—'}` +
          `   verify ${e.verify_type ?? '—'}   checking ${e.checking_status ?? '—'}\n` +
          `    reader clock ${slt(e.occurred_at)} SLT   stored ${slt(e.created_at)} SLT   (reader − stored = ${skew}s)\n` +
          `    raw fields: ${Object.keys((e.raw ?? {}) as object).join(', ')}`
      )
    }

    if (firstAt && !keepWatching && Date.now() - firstAt > 15_000) break
    await wait(4_000)
  }

  console.log(
    seen.size === 0
      ? `\nNO SCAN ARRIVED in ${timeoutSeconds}s. Check the Vercel log for "Access webhook delivery" before concluding nothing was sent.\n`
      : `\n${seen.size} scan(s) stored.\n`
  )
}

// ============================================================
// watch-queue
// ============================================================

async function watchQueue(): Promise<void> {
  const serial = readerSerial(arg('reader'))
  const since = parseSince(arg('since'), '5m')
  const timeoutSeconds = Number(arg('timeout') ?? 180)
  const started = Date.now()
  const last = new Map<number, string>()

  console.log(
    `Watching reader ${readerLetter(serial)} (${serial}) for commands committed since ${slt(since)} SLT, up to ${timeoutSeconds}s…`
  )

  let recent: QueueEntry[] = []
  while ((Date.now() - started) / 1000 < timeoutSeconds) {
    recent = (await vendorQueue(serial)).filter(
      (q) => q.commit && q.commit.getTime() >= since.getTime() - 60_000
    )

    for (const q of recent) {
      const state = `${queueState(q)} ret=${returnCode(q)}`
      if (last.get(q.id) !== state) {
        last.set(q.id, state)
        console.log(
          `  +${String(Math.round((Date.now() - started) / 1000)).padStart(3)}s  #${q.id}  ${state.padEnd(22)}  ${q.command.slice(0, 70)}`
        )
      }
    }

    if (recent.length > 0 && recent.every((q) => queueState(q) === 'DONE'))
      break
    await wait(8_000)
  }

  console.log('\nVerdict:')
  if (recent.length === 0) {
    console.log('  No command was committed for this reader in that window.')
  }
  for (const q of recent) {
    const latency =
      q.trans && q.commit
        ? `${Math.round((q.trans.getTime() - q.commit.getTime()) / 1000)}s after commit`
        : ''
    console.log(
      `  #${q.id} ${queueState(q)} ${latency} ret=${returnCode(q)}  ${q.command.slice(0, 60)}`
    )
  }
  console.log('')
}

// ============================================================
// set-dates
// ============================================================

async function setDates(): Promise<void> {
  const member = await hwMember(arg('member'))
  const due = arg('due') ? resolveDay(arg('due')!) : undefined
  const start = arg('start') ? resolveDay(arg('start')!) : undefined
  if (!due && !start) fail('Give --due and/or --start')

  console.log(
    `${member.name}: start ${member.membership_start_date} → ${start ?? '(unchanged)'}, due ${member.next_due_date} → ${due ?? '(unchanged)'}`
  )
  if (!apply)
    return dryRun('write those dates; the trigger then enqueues an outbox job')

  const before = new Date().toISOString()
  const patch: Record<string, string> = {}
  if (due) patch.next_due_date = due
  if (start) patch.membership_start_date = start

  const { data, error } = await supabase
    .from('members')
    .update(patch)
    .eq('id', member.id)
    .eq('gym_id', TITAN_GYM_ID)
    .like('name', `${TEST_MEMBER_PREFIX}%`)
    .select('id, membership_start_date, next_due_date')
  if (error) fail(`members update: ${error.message}`)
  if ((data ?? []).length !== 1)
    fail('The update matched no row — nothing changed.')

  await wait(1_500)
  const { data: jobs } = await supabase
    .from('access_sync_jobs')
    .select('id, status, created_at, payload')
    .eq('member_id', member.id)
    .gte('created_at', before)
  console.log(
    `✓ Written. Outbox jobs enqueued by the trigger: ${(jobs ?? []).length}`
  )
  console.log(
    '  Next: `drain --apply` to push it now, or wait ≤5 min for the cron.\n'
  )
}

// ============================================================
// drain / reconcile
// ============================================================

async function drain(): Promise<void> {
  const { data: due, error } = await supabase
    .from('access_sync_jobs')
    .select('id, gym_id, member_id, status, next_attempt_at')
    .in('status', [AccessSyncStatus.Pending, AccessSyncStatus.Failed])
    .lte('next_attempt_at', new Date().toISOString())
  if (error) fail(`access_sync_jobs: ${error.message}`)

  const foreign = (due ?? []).filter((j) => j.gym_id !== TITAN_GYM_ID)
  console.log(`Due jobs: ${(due ?? []).length} (other gyms: ${foreign.length})`)
  if (foreign.length > 0) {
    fail(
      'REFUSED: jobs for another gym are due. A laptop drain must only ever process Titan work — let the cron handle this run.'
    )
  }
  if (!apply)
    return dryRun('claim and process those jobs now with the real drain')

  // `--crash-after N` kills this process the moment the Nth vendor command
  // has really been accepted — mid-batch, jobs still `in_flight`, our records
  // not yet written. That is a worker dying under load (REC-03/07, FAIL-08):
  // the next drain must reclaim the jobs after STALE_JOB_RECLAIM_SECONDS and
  // finish them, and the readers must end up correct.
  const crashAfter = arg('crash-after') ? Number(arg('crash-after')) : null
  if (crashAfter !== null && !(crashAfter >= 1)) {
    fail('--crash-after needs a whole number of commands, 1 or more')
  }
  let accepted = 0
  const commandMethods = new Set([
    'upsertSubject',
    'syncSubjectsToDevice',
    'setValidPeriod',
    'grantAccess',
    'blockAccess',
    'revokeBiometrics',
  ])
  const drainProvider =
    crashAfter === null
      ? provider
      : (new Proxy(provider, {
          get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver)
            if (typeof value !== 'function') return value
            if (!commandMethods.has(String(prop))) return value.bind(target)
            return async (...args: unknown[]) => {
              const outcome = await (
                value as (...a: unknown[]) => Promise<unknown>
              ).apply(target, args)
              accepted += 1
              console.log(
                `  vendor accepted command ${accepted}: ${String(prop)}`
              )
              if (accepted >= crashAfter) {
                console.log(
                  `\n✗ SIMULATED CRASH after ${accepted} accepted command(s). Jobs are left in_flight on purpose.\n`
                )
                process.exit(137)
              }
              return outcome
            }
          },
        }) as IAccessControlProvider)

  const repo = sessionRepository()
  const summary = await new DrainAccessSyncQueue(
    repo,
    new SyncMemberAccess(repo, drainProvider),
    new OperateDevice(repo, drainProvider),
    new EvictInactiveSubjects(repo, drainProvider),
    drainProvider
  ).execute()
  console.log('✓ Drain finished:', JSON.stringify(summary))
  console.log(
    '  Next: `watch-queue --reader A` / `--reader B` to see the readers collect it.\n'
  )
}

async function reconcile(): Promise<void> {
  const real = sessionRepository()
  const enqueued: string[] = []
  const repo = apply
    ? real
    : new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === 'enqueue') {
            return async (_gymId: string, memberId: string | null) => {
              enqueued.push(memberId ?? '(device)')
            }
          }
          const value = Reflect.get(target, prop, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })

  const summary = await new ReconcileMemberAccess(
    repo,
    new SupabaseGymSubscriptionRepository(supabase),
    new EvictInactiveSubjects(repo, provider),
    provider
  ).execute({ gymId: TITAN_GYM_ID })

  console.log(
    `${apply ? '✓ Reconcile ran' : 'DRY RUN reconcile (nothing enqueued)'}:`,
    JSON.stringify(summary)
  )
  if (!apply) {
    const names = new Map((await hwMembers()).map((m) => [m.id, m.name]))
    console.log(
      `  Would enqueue: ${enqueued.map((id) => names.get(id) ?? `real member ${id}`).join(', ') || 'nobody'}`
    )
    console.log('  Re-run with --apply to enqueue for real.\n')
  }
}

// ============================================================
// vendor — one direct provider call, bypassing our records on purpose
// ============================================================

async function vendor(): Promise<void> {
  const op = positional
  const serial = readerSerial(arg('reader'))

  if (op === 'events-pull') {
    console.log(
      `Ask reader ${readerLetter(serial)} to upload its stored attendance log (changes nothing on the reader).`
    )
    if (!apply) return dryRun(`POST /api/devicecmd/events?DevSN=${serial}`)
    const result = await vendorPost(
      `/api/devicecmd/events?DevSN=${encodeURIComponent(serial)}`
    )
    console.log(
      `✓ HTTP ${result.status}  ${result.text}\n  Next: watch-queue and watch-events.\n`
    )
    return
  }

  const member = await hwMember(arg('member'))
  const subject = subjectOf(member)
  if (!subject) fail(`${member.name} has no subject id yet — sync them first`)
  const target = { deviceSerial: serial, subjectId: String(subject.subject_id) }

  const describe = `${op} for ${member.name} (subject ${subject.subject_id}) on reader ${readerLetter(serial)}`
  console.log(
    `${describe}.\n  ⚠ This bypasses our records deliberately: afterwards our DB and the reader may disagree.\n  Restore with the member panel's "Re-send to readers" (forced).`
  )

  let run: () => ReturnType<IAccessControlProvider['grantAccess']>
  switch (op) {
    case 'validperiod': {
      const startDate = arg('start')
      const endDate = arg('end')
      if (
        !startDate ||
        !endDate ||
        !/^\d{8}$/.test(startDate) ||
        !/^\d{8}$/.test(endDate)
      ) {
        fail('validperiod needs --start YYYYMMDD --end YYYYMMDD')
      }
      run = () =>
        provider.setValidPeriod(credentials, { ...target, startDate, endDate })
      break
    }
    case 'block':
      run = () => provider.blockAccess(credentials, target)
      break
    case 'grant':
      run = () => provider.grantAccess(credentials, target)
      break
    case 'sync':
      run = () =>
        provider.syncSubjectsToDevice(credentials, serial, [target.subjectId])
      break
    default:
      return fail(
        'vendor needs one of: validperiod, block, grant, sync, events-pull'
      )
  }

  if (!apply) return dryRun(describe)
  console.log(
    '✓ Outcome:',
    JSON.stringify(await run()),
    '\n  Next: watch-queue.\n'
  )
}

// ============================================================
// enrol — one real enrolment, outside the panel
// ============================================================

/**
 * The panel hides "Register fingerprint" once a member is registered, so the
 * already-enrolled case (ENR-07) and any enrolment that is not itself the
 * thing under test go through the real use case here instead.
 */
async function enrol(): Promise<void> {
  const member = await hwMember(arg('member'))
  const reader = readerSerial(arg('reader'))
  const plan = `put reader ${readerLetter(reader)} into enrol mode for ${member.name}${flag('consent') ? ', recording the consent the operator confirmed' : ''}`
  console.log(`Enrol: ${plan}.`)
  if (!apply) return dryRun(plan)

  const repo = sessionRepository()
  const result = await new ManageMemberBiometric(repo, provider).enrol({
    gymId: TITAN_GYM_ID,
    memberId: member.id,
    deviceId: await deviceIdFor(reader),
    ...(flag('consent') ? { consentGranted: true } : {}),
  })
  console.log('✓ Use case returned:', JSON.stringify(result))
  console.log(
    '  Next: watch-queue on that reader; the operator presents the finger when the reader prompts.\n'
  )
}

// ============================================================
// withdraw — the member takes back their consent, whatever the panel shows
// ============================================================

/**
 * The panel offers "Remove fingerprint" only once a finger is registered, so a
 * withdrawal DURING an enrolment (CONSENT-05) cannot be driven from it. This
 * calls the same use case the button does: fromdev revoke, flag cleared,
 * consent cleared.
 */
async function withdraw(): Promise<void> {
  const member = await hwMember(arg('member'))
  const plan = `withdraw ${member.name}'s fingerprint consent (fromdev revoke on every reader, flag and consent cleared)`
  console.log(`Withdraw: ${plan}.`)
  if (!apply) return dryRun(plan)

  const result = await new ManageMemberBiometric(
    sessionRepository(),
    provider
  ).clear(TITAN_GYM_ID, member.id)
  console.log('✓ Use case returned:', JSON.stringify(result))
  console.log('  Next: snapshot and watch-queue on both readers.\n')
}

// ============================================================
// race — real use cases fired concurrently
// ============================================================

async function race(): Promise<void> {
  const scenario = positional
  const member = await hwMember(arg('member'))
  const repo = sessionRepository()
  const biometric = new ManageMemberBiometric(repo, provider)
  const sync = new SyncMemberAccess(repo, provider)
  const memberRepo = new SupabaseMemberRepository(supabase)
  const cancel = new CancelMember(memberRepo)
  const suspend = new SuspendMember(memberRepo)
  const serialA = READERS.A
  const serialB = READERS.B
  const reader = readerSerial(arg('reader') ?? 'A')

  // `--consent` is the desk ticking the box: the operator confirms the person
  // whose finger it is agreed. Without it a member with no consent on file is
  // refused by the gate, exactly as the panel would refuse them.
  const consentFlag = flag('consent')
  const enrolOn = async (
    memberId: string,
    serial: string,
    consentGranted = consentFlag
  ) =>
    biometric.enrol({
      gymId: TITAN_GYM_ID,
      memberId,
      deviceId: await deviceIdFor(serial),
      ...(consentGranted ? { consentGranted } : {}),
    })

  // The domain's own path, the one the UI takes: Active cannot go straight to
  // Cancelled (StatusConfig), so an active member is suspended first. Each
  // step re-reads the member, so two racing cancellations meet the state
  // machine exactly as two staff pressing the buttons would.
  const cancelAndPush = async (memberId: string) => {
    try {
      const current = await memberRepo.findById(memberId, TITAN_GYM_ID)
      if (current?.status === MemberStatus.Active) {
        await suspend.execute({ memberId, gymId: TITAN_GYM_ID })
      }
      await cancel.execute({ memberId, gymId: TITAN_GYM_ID })
      return { cancelled: true, sync: await sync.execute({ memberId }) }
    } catch (error) {
      return {
        cancelled: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  let plan: string
  let fire: () => Promise<unknown[]>

  switch (scenario) {
    case 'consent':
      if (member.biometric_consent_at) {
        fail(
          `${member.name} already has consent on file — remove their fingerprint first (that clears it)`
        )
      }
      plan = `two simultaneous enrolments of ${member.name} on reader ${readerLetter(reader)}, both carrying consent`
      fire = () =>
        Promise.all([
          enrolOn(member.id, reader, true),
          enrolOn(member.id, reader, true),
        ])
      break
    case 'enrol-both':
      plan = `enrol ${member.name} on reader A and reader B at the same instant`
      fire = () =>
        Promise.all([enrolOn(member.id, serialA), enrolOn(member.id, serialB)])
      break
    case 'enrol-two': {
      const second = await hwMember(arg('member2'), 'member2')
      plan = `enrol ${member.name} and ${second.name} on reader ${readerLetter(reader)} at the same instant`
      fire = () =>
        Promise.all([enrolOn(member.id, reader), enrolOn(second.id, reader)])
      break
    }
    case 'enrol-vs-cancel':
      plan = `enrol ${member.name} on reader ${readerLetter(reader)} while cancelling them (suspend → cancel → immediate push)`
      fire = () =>
        Promise.all([enrolOn(member.id, reader), cancelAndPush(member.id)])
      break
    case 'double-cancel':
      plan = `cancel ${member.name} twice at the same instant, each followed by an immediate push`
      fire = () =>
        Promise.all([cancelAndPush(member.id), cancelAndPush(member.id)])
      break
    default:
      return fail(
        'race needs one of: consent, enrol-both, enrol-two, enrol-vs-cancel, double-cancel'
      )
  }

  console.log(`Race: ${plan}.`)
  if (!apply) return dryRun(plan)

  const started = Date.now()
  const results = await fire()
  console.log(`✓ Both settled in ${Date.now() - started}ms:`)
  results.forEach((r, i) => console.log(`  [${i + 1}] ${JSON.stringify(r)}`))

  const after = await hwMember(member.id)
  const s = subjectOf(after)
  console.log(
    `\nAfter: status ${after.status}, consent ${after.biometric_consent_at ?? 'none'}, held by ${heldBy(s)}, blocked ${s?.last_synced_blocked}`
  )
  console.log('  Next: snapshot, and watch-queue on the reader(s) involved.\n')
}

// ============================================================
// ambiguous — the vendor did it, and we were told it failed
// ============================================================

async function ambiguous(): Promise<void> {
  const kind = positional
  const member = await hwMember(arg('member'))
  const reader = readerSerial(arg('reader') ?? 'A')
  const repo = sessionRepository()

  // The real provider, except that after the chosen call genuinely reaches the
  // vendor, the answer is "lost": we throw as a timeout would.
  let armed = true
  const lossy = (lose: keyof IAccessControlProvider) =>
    new Proxy(provider, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (prop !== lose || typeof value !== 'function') {
          return typeof value === 'function' ? value.bind(target) : value
        }
        return async (...args: unknown[]) => {
          const outcome = await (
            value as (...a: unknown[]) => Promise<unknown>
          ).apply(target, args)
          if (armed) {
            armed = false
            console.log(
              `  (vendor really answered: ${JSON.stringify(outcome)} — now discarding it)`
            )
            throw new Error(
              'Simulated timeout after the vendor accepted the command'
            )
          }
          return outcome
        }
      },
    }) as IAccessControlProvider

  if (kind === 'enrol') {
    const plan = `enrol ${member.name} on reader ${readerLetter(reader)}, dispatch for real, then lose the reply`
    console.log(`Ambiguous: ${plan}.`)
    if (!apply) return dryRun(plan)
    try {
      const result = await new ManageMemberBiometric(
        repo,
        lossy('startFingerEnrolment')
      ).enrol({
        gymId: TITAN_GYM_ID,
        memberId: member.id,
        deviceId: await deviceIdFor(reader),
        ...(flag('consent') ? { consentGranted: true } : {}),
      })
      console.log('  Use case returned:', JSON.stringify(result))
    } catch (error) {
      console.log(
        `  Use case THREW: ${error instanceof Error ? error.message : error}`
      )
      console.log(
        '  → the desk would have seen the request fail. The reader is in enrol mode anyway.'
      )
    }
  } else if (kind === 'sync') {
    const plan = `force a re-send for ${member.name}; the first command reaches the vendor and its reply is lost`
    console.log(`Ambiguous: ${plan}.`)
    if (!apply) return dryRun(plan)
    const result = await new SyncMemberAccess(
      repo,
      lossy('syncSubjectsToDevice')
    ).execute({
      memberId: member.id,
      force: true,
    })
    console.log('  Use case returned:', JSON.stringify(result))
    console.log(
      '  → our record is NOT updated (partial run). The next forced re-send repeats the sequence.'
    )
  } else {
    return fail('ambiguous needs: enrol or sync')
  }
  console.log(
    '  Next: watch-queue on that reader, then follow the task steps.\n'
  )
}

// ============================================================
// coverage — offline
// ============================================================

function coverage(): void {
  const catalogue = readFileSync(
    'docs/architecture/access-control-test-campaign.md',
    'utf8'
  )
  const ids = [
    ...catalogue.matchAll(/^\|\s*`([A-Z0-9.]+(?:-\d+)?)`\s*\|/gm),
  ].map((m) => m[1])
  const unique = new Set(ids)
  if (unique.size !== ids.length) fail('The catalogue lists a case id twice')

  const runbook = JSON.parse(
    readFileSync(
      'docs/architecture/access-control-hardware-runbook.json',
      'utf8'
    )
  ) as {
    coverage: Record<string, string>
    tasks: Array<{ id: string; cases: string[] }>
  }

  const mapped = runbook.coverage
  const missing = ids.filter((id) => !(id in mapped))
  const unknown = Object.keys(mapped).filter((id) => !unique.has(id))
  const taskIds = new Set(runbook.tasks.map((t) => t.id))
  const danglingTask = Object.entries(mapped).filter(
    ([, d]) => d.startsWith('task:') && !taskIds.has(d.slice(5))
  )
  const unclaimed = Object.entries(mapped).filter(
    ([id, d]) =>
      d.startsWith('task:') &&
      !runbook.tasks.find((t) => t.id === d.slice(5))?.cases.includes(id)
  )

  const byKind: Record<string, number> = {}
  for (const d of Object.values(mapped)) {
    const kind = d.split(':')[0]
    byKind[kind] = (byKind[kind] ?? 0) + 1
  }

  console.log(
    `Catalogue cases: ${ids.length}   mapped: ${Object.keys(mapped).length}`
  )
  console.log(`By disposition: ${JSON.stringify(byKind)}`)
  if (missing.length)
    console.log(
      `✗ Not accounted for (${missing.length}): ${missing.join(', ')}`
    )
  if (unknown.length)
    console.log(`✗ Mapped but not in the catalogue: ${unknown.join(', ')}`)
  if (danglingTask.length)
    console.log(
      `✗ Mapped to a task that does not exist: ${danglingTask.map(([id, d]) => `${id}→${d}`).join(', ')}`
    )
  if (unclaimed.length)
    console.log(
      `✗ Mapped to a task whose cases[] omit it: ${unclaimed.map(([id, d]) => `${id}→${d}`).join(', ')}`
    )

  const ok =
    !missing.length &&
    !unknown.length &&
    !danglingTask.length &&
    !unclaimed.length
  console.log(
    ok
      ? `✓ Every one of the ${ids.length} cases has exactly one disposition.`
      : ''
  )
  if (!ok) process.exit(1)
}

// ============================================================

const commands: Record<string, () => Promise<void> | void> = {
  snapshot,
  'watch-events': watchEvents,
  'watch-queue': watchQueue,
  'set-dates': setDates,
  drain,
  reconcile,
  vendor,
  enrol,
  withdraw,
  race,
  ambiguous,
  coverage,
}

const run = commands[command]
if (!run) {
  console.error(
    `Unknown command "${command}". One of: ${Object.keys(commands).join(', ')}`
  )
  process.exit(1)
}

Promise.resolve(run()).catch((error) => {
  console.error(
    `\n✗ ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exit(1)
})
