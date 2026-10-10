/**
 * Hardware session console — the one tool both door-hardware tracks use.
 *
 * Brief:  docs/architecture/access-control-hardware-session.md
 * Tasks:  docs/architecture/access-control-hardware-runbook.json
 *         (`task <ID> --as <agent>` prints one; never read the JSON whole)
 *
 * ## Why one guarded CLI rather than ad-hoc SQL
 *
 * Both tracks run against PRODUCTION — Titan Fitness, a real gym, and two real
 * readers at VFT — and are driven by sessions that must never improvise a
 * write. Every observation the runbook asks for is one command here, and every
 * write is fenced:
 *
 *   1. Only Titan Fitness, and only members whose name starts `HW Test `. A
 *      real member cannot be addressed at all, by name, number or id.
 *   2. Only the two campaign readers, by letter. The desk commands reach only
 *      the two E2E gyms, through a dev server on this machine.
 *   3. Nothing writes without `--apply`; without it a write prints what it
 *      would do and stops (the repo convention, cf. vft-lifecycle).
 *   4. Every command names its agent (`--as`), and the agent plus the current
 *      phase decide what it may touch — below.
 *   5. No member command here can text anyone. Members are created on the
 *      daily plan, which `REMINDER_RULES` never reminds, and registration and
 *      payment run with a suppressed SMS provider — the app's own buttons for
 *      those send real texts, so the runbook never presses them.
 *
 * Vendor credentials come from `.env.local` (`VFT_PROBE_*`) and are injected
 * into the real use cases through a read-only proxy — the stored ciphertext is
 * readable only by the environment whose key wrote it (finding F12), and this
 * script can never write a credential back (the trap that took production
 * offline for 25 days). It also never deletes a vendor subject.
 *
 * ## Who may do what: `--as <agent>` and the phase
 *
 * The remote track runs several agents at once against the same two readers,
 * so the console — not their good behaviour — keeps them apart. The phase is
 * in `backups/hw-session/phase.json`; only `phase set` moves it.
 *
 *   agent      members it owns (in phase)              reader-wide + outbox      vendor pace
 *   physical   HW Test 1–4 (physical)                  yes (physical)            4/s
 *   lead       HW Test 5–10 (idle), 9–10 (parallel)    idle; open+soak parallel  1/s
 *   outbox     HW Test 5–6 (parallel)                  no                        1.5/s
 *   lifecycle  HW Test 7–8 (parallel)                  no                        1.5/s
 *   api        none — E2E gyms via the local server    no                        none
 *   evidence   none — read-only                        no                        none
 *   exclusive  HW Test 5–10 (exclusive)                yes (exclusive)           4/s
 *
 * The paces sum to 4/s in the parallel phase (lead + outbox + lifecycle),
 * under the 5/s production's own drain assumes (`VENDOR_MAX_REQUESTS_PER_SECOND`;
 * the vendor documents no limit).
 *
 * "Reader-wide" is anything that acts on a whole reader or on the shared
 * outbox: drain, reconcile, open, reboot, free-space, capacity, events-pull,
 * an enrolment on a real reader (it holds the reader until a finger or the
 * timeout), reclaim, forget/register, and the vendor load tests.
 *
 * ## Commands (all take --as <agent>; writes take --apply)
 *
 *   help                               this list
 *   phase [set idle|physical|parallel|exclusive]
 *   task <ID> | tasks [--agent A]      read the runbook one task at a time
 *   record --task ID --status S --outcome "…" [--case ID=verdict]… [--finding "…"]… [--obs "…"]… [--artifact P]…
 *   results [--emit-batch [--tracker]] [--mark-synced FILE]
 *
 *   snapshot [--events N --jobs N --queue N]       readers, members, scans, jobs, vendor
 *   watch-events [--since 2m] [--timeout 120] [--all] [--member M] [--code C]
 *   watch-queue  --reader A|B [--since 5m] [--timeout 180] [--member M | --subject N]
 *   jobs [--member M] [--limit 20] [--wait S]     --wait: until none is pending/in flight/failed
 *
 *   create-members --from N --to N     daily plan, 1 LKR, texts suppressed, pushed to both readers
 *   park --member M | --mine           suspend → cancel → push (nobody active overnight)
 *   unpark --member M | --mine         reactivate, due +200 days → push
 *   pay | suspend | cancel | reactivate [--due D] --member M [--no-push]   real use cases, then push
 *   push | resend --member M [--vendor-url U]       sync (resend = forced, as the panel's button)
 *   rename --member M --to "HW Test N …"            rename and push the name to the readers
 *   set-dates --member M [--due D] [--start D]      D = YYYY-MM-DD | today | yesterday | tomorrow | +N | -N
 *   vendor validperiod|block|grant|sync --member M --reader A|B [--start YYYYMMDD --end YYYYMMDD]
 *   vendor events-pull --reader A|B
 *   enrol --member M --reader A|B [--consent] [--vendor-url U [--fail-consent-write]]
 *   withdraw --member M                consent withdrawal, as the panel's Remove fingerprint
 *   race <scenario> --member M [--member2 M] [--reader A|B] [--consent] [--vendor-url U]
 *        consent | enrol-both | enrol-two | enrol-vs-cancel | double-cancel | pay-vs-dates | trio
 *   ambiguous enrol --member M [--reader A|B] [--consent]
 *   ambiguous push --member M --lose <provider method> [--force]
 *
 *   drain [--crash-after N | --crash-on-complete] [--vendor-url U]
 *   reconcile                          the real nightly reconcile for Titan, now
 *   reclaim --older-than S             return stale in_flight jobs to pending
 *   open | reboot --reader A|B
 *   free-space                         refuses if a real member would be evicted
 *   capacity --reader A|B [--set N | --clear]
 *   forget --reader B | register --reader B         unlink / re-link a reader in our records
 *   burst sync --member M --count K [--force] --approved
 *   soak --member M --minutes 60       lead: an hour of re-sends and door opens
 *
 *   stub --port P --mode M             a fake vendor on 127.0.0.1 (modes: see `stub --help`)
 *   stub-log --port P [--since 5m]     what the stub received
 *   stub-mode --port P --mode M | stub-stop --port P
 *
 *   devserver start|stop|status|log [--grep X] [--tail N]     next dev on :3100, mock provider
 *   api <METHOD> <path> --user enterprise|lite|anon|tampered|expired [--body JSON | --body-gen long-name|big] [--find TEXT]
 *           ({{E2E_ENTERPRISE_EMAIL}} in a body is filled from .env.local)
 *   webhook --serial S|--unknown [--subject N --event C --verify V --time T] [--events N | --same N | --body-gen bad-event|huge|claims-titan]
 *           [--token good|wrong|empty|short]
 *           [--body-file F] [--content-type T] [--repeat K]
 *   burst webhook|api … --count K
 *   tier --gym enterprise|lite [--to T --status S | --restore]  (E2E gyms only)
 *   e2e-account [--deactivate]
 *
 *   coverage                           offline: cases, simulator plan, ownership and scope
 *
 * Usage: npx tsx scripts/hw-session.ts <command> [options] --as <agent>
 */

import { config } from 'dotenv'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
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
import { PushRename } from '../src/features/access-control/services/PushRename'
import { SupabaseGymSubscriptionRepository } from '../src/features/subscriptions/services/SupabaseGymSubscriptionRepository'
import { CancelMember } from '../src/features/members/services/CancelMember'
import { SuspendMember } from '../src/features/members/services/SuspendMember'
import { ReactivateMember } from '../src/features/members/services/ReactivateMember'
import { RegisterMember } from '../src/features/members/services/RegisterMember'
import { MemberStatus } from '../src/features/members/config/StatusConfig'
import { PlanType } from '../src/features/members/config/PlanConfig'
import { SupabaseMemberRepository } from '../src/features/members/services/SupabaseMemberRepository'
import { CollectPayment } from '../src/features/payments/services/CollectPayment'
import { SupabasePaymentRepository } from '../src/features/payments/services/SupabasePaymentRepository'
import type {
  ISMSProvider,
  SMSMessage,
  SMSSendResult,
} from '../src/features/sms/services/ISMSProvider'
import type { ISMSRepository } from '../src/features/sms/services/ISMSRepository'
import {
  classifyDeviceEvent,
  describeDeviceEvent,
} from '../src/features/access-control/config/DeviceEventCodes'
import {
  AccessIntent,
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

/** The only gyms the desk commands reach (the Playwright fixtures). */
const E2E_GYMS = {
  enterprise: 'e0d0a7f9-094c-474c-9277-21cdf1b0bffd',
  lite: '3133db6c-55e1-4c30-a309-811e691f0be9',
} as const
type E2EGym = keyof typeof E2E_GYMS

/** The only member names any write here will touch. */
const TEST_MEMBER_PREFIX = 'HW Test '
const MAX_TEST_MEMBER = 10

const READERS = { A: 'NYU7251900077', B: 'NYU7254500734' } as const
type ReaderLetter = keyof typeof READERS

/** Gym-local offset (Asia/Colombo has no DST). */
const SLT_OFFSET_MINUTES = 330

/** The vendor's "never happened" timestamp. */
const VENDOR_NEVER = '01/01/1999'

/** How far ahead `unpark`/`create-members` put a member's due date. */
const PARKED_DUE_DAYS = 200

/** The desk commands' only target: a dev server on this machine. */
const DEV_PORT = 3100
const DEV_URL = `http://localhost:${DEV_PORT}`

const EVIDENCE_DIR = resolve('backups/hw-session')
const PHASE_FILE = resolve(EVIDENCE_DIR, 'phase.json')
const RESULTS_DIR = resolve(EVIDENCE_DIR, 'results')
const COOKIE_DIR = resolve(EVIDENCE_DIR, 'cookies')
const DEV_LOG = resolve(EVIDENCE_DIR, 'dev-server.log')
const DEV_PID = resolve(EVIDENCE_DIR, 'dev-server.pid')
const RUNBOOK_PATH = 'docs/architecture/access-control-hardware-runbook.json'
const CATALOGUE_PATH = 'docs/architecture/access-control-test-campaign.md'

// ============================================================
// Arguments
// ============================================================

const argv = process.argv.slice(2)
const command = argv[0] ?? 'help'

/** Options that take no value, so the word after one is a positional. */
const FLAGS_WITHOUT_VALUE = new Set([
  'apply',
  'all',
  'approved',
  'clear',
  'consent',
  'crash-on-complete',
  'deactivate',
  'emit-batch',
  'fail-consent-write',
  'force',
  'help',
  'late',
  'mine',
  'no-content-type',
  'no-push',
  'relogin',
  'restore',
  'tracker',
  'unknown',
])

const positionals = argv.slice(1).filter((a, i, all) => {
  if (a.startsWith('--')) return false
  const previous = all[i - 1]
  if (!previous || !previous.startsWith('--') || previous.includes('=')) {
    return true
  }
  return FLAGS_WITHOUT_VALUE.has(previous.slice(2))
})
const positional = positionals[0] ?? ''
const positional2 = positionals[1] ?? ''

function arg(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1]
  }
  const inline = argv.find((a) => a.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : undefined
}

/** Every value of a repeatable option. */
function args(name: string): string[] {
  const values: string[] = []
  argv.forEach((a, i) => {
    if (a === `--${name}` && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      values.push(argv[i + 1])
    } else if (a.startsWith(`--${name}=`)) {
      values.push(a.slice(name.length + 3))
    }
  })
  return values
}

const flag = (name: string): boolean => argv.includes(`--${name}`)
const apply = flag('apply')

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

// ============================================================
// Agents and phases
// ============================================================

const AGENT_NAMES = [
  'physical',
  'lead',
  'outbox',
  'lifecycle',
  'api',
  'evidence',
  'exclusive',
] as const
type AgentName = (typeof AGENT_NAMES)[number]

const PHASES = ['idle', 'physical', 'parallel', 'exclusive'] as const
type Phase = (typeof PHASES)[number]

interface AgentSpec {
  /** Vendor calls per second; 0 = this agent never calls the vendor. */
  rps: number
}

const AGENTS: Record<AgentName, AgentSpec> = {
  physical: { rps: 4 },
  lead: { rps: 1 },
  outbox: { rps: 1.5 },
  lifecycle: { rps: 1.5 },
  api: { rps: 0 },
  evidence: { rps: 0 },
  exclusive: { rps: 4 },
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** The HW Test numbers an agent may write to in a phase — and no others. */
function ownedNumbers(agent: AgentName, phase: Phase): number[] {
  switch (agent) {
    case 'physical':
      return phase === 'physical' ? range(1, 4) : []
    case 'lead':
      return phase === 'idle'
        ? range(5, 10)
        : phase === 'parallel'
          ? [9, 10]
          : []
    case 'outbox':
      return phase === 'parallel' ? [5, 6] : []
    case 'lifecycle':
      return phase === 'parallel' ? [7, 8] : []
    case 'exclusive':
      return phase === 'exclusive' ? range(5, 10) : []
    default:
      return []
  }
}

/** Reader-wide work: one agent at a time, decided by the phase. */
function mayUseReaders(agent: AgentName, phase: Phase, name: string): boolean {
  if (agent === 'physical') return phase === 'physical'
  if (agent === 'exclusive') return phase === 'exclusive'
  if (agent === 'lead') {
    return (
      phase === 'idle' ||
      (phase === 'parallel' && ['open', 'soak'].includes(name))
    )
  }
  return false
}

type Scope =
  | 'read'
  | 'record'
  | 'vendor-read'
  | 'local'
  | 'member'
  | 'reader'
  | 'desk'
  | 'lead'
  | 'phase'

/** Why `agent` may not run a command of `scope` in `phase`, or null if it may. */
function refusal(
  scope: Scope,
  agent: AgentName,
  phase: Phase,
  name: string
): string | null {
  switch (scope) {
    case 'read':
    case 'record':
      return null
    case 'vendor-read':
    case 'local':
      return AGENTS[agent].rps > 0
        ? null
        : `the ${agent} agent never calls the vendor`
    case 'member':
      return ownedNumbers(agent, phase).length > 0
        ? null
        : `the ${agent} agent owns no test member in the ${phase} phase`
    case 'reader':
      return mayUseReaders(agent, phase, name)
        ? null
        : `"${name}" acts on a whole reader or the shared outbox; ${readerOwner(phase)}`
    case 'desk':
      return (agent === 'api' && (phase === 'parallel' || phase === 'idle')) ||
        (agent === 'lead' && phase === 'idle')
        ? null
        : `desk commands belong to the api agent (parallel/idle phase) or the lead (idle phase)`
    case 'phase':
      // Not judged on the phase being LEFT: the physical session's first act
      // is idle → physical, which no check of the current phase can allow.
      // Which moves are legal is phaseMoveRefusal's rule (it needs the target).
      return agent === 'lead' || agent === 'physical'
        ? null
        : `only the lead (remote track) or the physical session moves the phase`
    case 'lead':
      return (agent === 'lead' && phase !== 'physical') ||
        (agent === 'physical' && phase === 'physical')
        ? null
        : `"${name}" belongs to the lead (remote track) or the physical session (its own phase)`
  }
}

/**
 * Why `who` may not move the phase `from` → `to`, or null if the move is legal.
 * The single rule for phase moves: `phase set` enforces it and `coverage`
 * proves that every runbook step which moves the phase is a legal move, from
 * the phase the step really starts in.
 */
function phaseMoveRefusal(
  who: AgentName,
  from: Phase,
  to: Phase
): string | null {
  if (who === 'physical') {
    const legal =
      (from === 'idle' && to === 'physical') ||
      (from === 'physical' && to === 'idle')
    if (legal) return null
    return from === 'parallel' || from === 'exclusive'
      ? `the remote track is running (phase ${from}). Never run both tracks at once`
      : `the physical session moves idle → physical at its start and physical → idle at its end, nothing else`
  }
  if (who === 'lead') {
    if (from === 'physical')
      return 'a physical session is running. Never run both tracks at once'
    if (to === 'physical')
      return 'only the physical session enters the physical phase'
    return null
  }
  return 'only the lead (remote track) or the physical session moves the phase'
}

function readerOwner(phase: Phase): string {
  return {
    idle: 'in the idle phase only the lead may',
    physical: 'in the physical phase only the physical session may',
    parallel:
      'in the parallel phase no agent may (the lead only opens doors, for its soak)',
    exclusive: 'in the exclusive phase only the exclusive agent may',
  }[phase]
}

/**
 * The scope of a command line, used both to gate this run and, by `coverage`,
 * to prove offline that no runbook step asks an agent for something the
 * console would refuse it.
 */
function scopeOf(name: string, line: string): Scope {
  const has = (pattern: RegExp) => pattern.test(line)
  switch (name) {
    case 'help':
    case 'task':
    case 'tasks':
    case 'coverage':
    case 'watch-events':
    case 'jobs':
      return 'read'
    case 'phase':
      return has(/\bset\b/) ? 'phase' : 'read'
    case 'record':
      return 'record'
    case 'results':
      return has(/--emit-batch|--mark-synced/) ? 'lead' : 'read'
    case 'snapshot':
    case 'watch-queue':
      return 'vendor-read'
    case 'capacity':
      return has(/--set|--clear/) ? 'reader' : 'read'
    case 'stub':
    case 'stub-log':
    case 'stub-mode':
    case 'stub-stop':
      return 'local'
    case 'set-dates':
    case 'push':
    case 'resend':
    case 'pay':
    case 'suspend':
    case 'cancel':
    case 'reactivate':
    case 'rename':
    case 'withdraw':
      return 'member'
    case 'vendor':
      return has(/\bevents-pull\b/) ? 'reader' : 'member'
    case 'enrol':
      return has(/--vendor-url/) ? 'member' : 'reader'
    case 'ambiguous':
      return has(/\bambiguous\s+enrol\b/) && !has(/--vendor-url/)
        ? 'reader'
        : 'member'
    case 'race':
      return has(/\b(double-cancel|pay-vs-dates)\b/) ||
        (has(/\b(trio|consent)\b/) && has(/--vendor-url/))
        ? 'member'
        : 'reader'
    case 'reconcile':
      return has(/--apply/) ? 'reader' : 'vendor-read'
    case 'drain':
    case 'open':
    case 'reboot':
    case 'free-space':
    case 'reclaim':
    case 'forget':
    case 'register':
    case 'soak':
      return 'reader'
    case 'burst':
      return has(/\bburst\s+sync\b/) ? 'reader' : 'desk'
    case 'devserver':
      return has(/\b(start|stop)\b/) ? 'lead' : 'desk'
    case 'api':
    case 'webhook':
    case 'tier':
    case 'e2e-account':
      return 'desk'
    case 'create-members':
    case 'park':
    case 'unpark':
      return 'lead'
    default:
      return 'reader'
  }
}

interface PhaseState {
  phase: Phase
  setBy: string
  at: string
}

function readPhase(): PhaseState {
  try {
    const state = JSON.parse(readFileSync(PHASE_FILE, 'utf8')) as PhaseState
    if ((PHASES as readonly string[]).includes(state.phase)) return state
  } catch {
    // No file yet: nobody has started a session.
  }
  return { phase: 'idle', setBy: '(default)', at: '' }
}

const NO_AGENT_NEEDED = new Set(['help', 'coverage'])
const agentArg = arg('as')
const agent: AgentName = (() => {
  if (NO_AGENT_NEEDED.has(command) && !agentArg) return 'evidence'
  if (!agentArg) {
    fail(
      `Name the agent running this: --as ${AGENT_NAMES.join('|')}. The runbook step you are following names it.`
    )
  }
  if (!(AGENT_NAMES as readonly string[]).includes(agentArg)) {
    fail(`"${agentArg}" is not an agent. One of: ${AGENT_NAMES.join(', ')}`)
  }
  return agentArg as AgentName
})()
const phaseState = readPhase()
const phase = phaseState.phase

function gate(scope: Scope = scopeOf(command, argv.join(' '))): void {
  const reason = refusal(scope, agent, phase, command)
  if (reason) fail(`REFUSED (${agent}, phase ${phase}): ${reason}.`)
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

let cachedCredentials: AccessCredentials | null = null

/** Titan's vendor credentials, or the stub's when `--vendor-url` is given. */
function credentials(): AccessCredentials {
  if (!cachedCredentials) {
    if (AGENTS[agent].rps === 0) {
      fail(`the ${agent} agent never calls the vendor`)
    }
    const password = process.env.VFT_PROBE_PASSWORD ?? ''
    if (!password) fail('VFT_PROBE_PASSWORD is not set in .env.local')
    cachedCredentials = {
      baseUrl: vendorUrlOverride() ?? requireEnv('VFT_API_BASE_URL'),
      email: requireEnv('VFT_PROBE_EMAIL'),
      password,
      areaId: 1,
    }
  }
  return cachedCredentials
}

/** `--vendor-url`, accepted only for a stub on this machine. */
function vendorUrlOverride(): string | undefined {
  const value = arg('vendor-url')
  if (!value) return undefined
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}\/?$/.test(value)) {
    fail('--vendor-url must be a stub on this machine: http://127.0.0.1:<port>')
  }
  return value.replace(/\/$/, '')
}
const usingStub = (): boolean => vendorUrlOverride() !== undefined

// Concurrent scenarios exist to dispatch at the same instant; pacing them
// would serialise exactly what they test.
const pacingEnabled = !['race', 'burst'].includes(command)
let paceChain: Promise<void> = Promise.resolve()
let lastVendorCall = 0

/** Keep this agent under its share of the vendor's (undocumented) rate. */
function pace(): Promise<void> {
  const rps = AGENTS[agent].rps
  if (!pacingEnabled || rps === 0) return Promise.resolve()
  const next = paceChain.then(async () => {
    const gap = 1000 / rps - (Date.now() - lastVendorCall)
    if (gap > 0) await wait(gap)
    lastVendorCall = Date.now()
  })
  paceChain = next.catch(() => undefined)
  return next
}

const VENDOR_METHODS = new Set([
  'signIn',
  'verifyCredentials',
  'listDevices',
  'upsertSubject',
  'renameSubject',
  'renameDevice',
  'revokeBiometrics',
  'syncSubjectsToDevice',
  'setValidPeriod',
  'grantAccess',
  'blockAccess',
  'listSubjects',
  'startFingerEnrolment',
  'openDoor',
  'rebootDevice',
  'listPendingCommands',
])

const rawProvider = new VftAccessControlProvider()

/** The real vendor client, paced, and unable to delete a vendor subject. */
const provider: IAccessControlProvider = new Proxy(rawProvider, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver)
    if (prop === 'removeSubject') {
      return async () => {
        throw new Error('hw-session never deletes a vendor subject')
      }
    }
    if (typeof value !== 'function') return value
    if (!VENDOR_METHODS.has(String(prop))) return value.bind(target)
    return async (...callArgs: unknown[]) => {
      await pace()
      return (value as (...a: unknown[]) => unknown).apply(target, callArgs)
    }
  },
}) as IAccessControlProvider

/**
 * The real repository with two changes: Titan's credentials (or the stub's)
 * come from here, and credentials can never be written. Any other gym gets no
 * credentials at all, so nothing here can act for a gym it was not built for.
 */
function sessionRepository(): IAccessControlRepository {
  const repo = new SupabaseAccessControlRepository(supabase)

  return new Proxy(repo, {
    get(target, prop, receiver) {
      if (prop === 'getCredentials') {
        return async (gymId: string) =>
          gymId === TITAN_GYM_ID ? credentials() : null
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

/**
 * Registration and payment send real texts through the app; here they go
 * nowhere. Nothing is logged to `sms_logs` either: a row would claim a text
 * that was never sent (rule 2.7 is about sends, and there is none).
 */
class SuppressedSmsProvider implements ISMSProvider {
  suppressed = 0

  async send(_message: SMSMessage): Promise<SMSSendResult> {
    this.suppressed += 1
    return { success: true, messageId: 'hw-session-suppressed' }
  }

  async sendBatch(messages: SMSMessage[]): Promise<SMSSendResult[]> {
    return Promise.all(messages.map((m) => this.send(m)))
  }

  isEnabled(): boolean {
    return false
  }

  getProviderName(): string {
    return 'hw-session (suppressed)'
  }
}

const suppressedSmsRepository = new Proxy({} as ISMSRepository, {
  get(_target, prop) {
    if (prop === 'create') {
      return async (log: Record<string, unknown>) => ({
        ...log,
        id: 'hw-session-not-logged',
      })
    }
    return () => {
      throw new Error(`hw-session's SMS log does not support ${String(prop)}`)
    }
  },
})

const memberRepo = new SupabaseMemberRepository(supabase)

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

/** A gym-local calendar day as the Date the domain expects (UTC midnight). */
const asDomainDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`)

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

/**
 * Production's drain runs on every five-minute mark. A test that needs the
 * outbox to itself — a crash, a reclaim, a stubbed vendor — starts clear of it.
 */
async function avoidCronBoundary(before = 30): Promise<void> {
  const intoCycle = (Date.now() / 1000) % 300
  if (intoCycle < 25 || intoCycle > 300 - before) {
    const pause = Math.ceil(
      (intoCycle > 300 - before ? 325 - intoCycle : 25 - intoCycle) * 1000
    )
    console.log(
      `  (waiting ${Math.round(pause / 1000)}s to stay clear of production's five-minute drain)`
    )
    await wait(pause)
  }
}

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

/** "HW Test 7 සිංහල" → 7. The number is the identity; the rest is free text. */
function testNumber(name: string): number | null {
  const match = name.match(/^HW Test (\d{1,2})(?:\s|$)/)
  return match ? Number(match[1]) : null
}

async function hwMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('members')
    .select(MEMBER_COLUMNS)
    .eq('gym_id', TITAN_GYM_ID)
    .like('name', `${TEST_MEMBER_PREFIX}%`)
    .order('name')
  if (error) fail(`members: ${error.message}`)
  return ((data ?? []) as MemberRow[]).filter(
    (m) => testNumber(m.name) !== null
  )
}

/** The HW members this agent owns in this phase. */
async function myMembers(): Promise<MemberRow[]> {
  const owned = ownedNumbers(agent, phase)
  return (await hwMembers()).filter((m) =>
    owned.includes(testNumber(m.name) ?? -1)
  )
}

/**
 * Resolve `--member` to an HW test member, or refuse.
 *
 * Accepts "HW Test 1", "1", a member number or a member id — and in every case
 * re-checks gym and name prefix on the row itself, so no spelling of a real
 * member's identity gets through. With `owned`, the member must also belong to
 * this agent in this phase: two agents never write to one member.
 */
async function hwMember(
  value: string | undefined,
  options: { label?: string; owned?: boolean } = {}
): Promise<MemberRow> {
  const label = options.label ?? 'member'
  const owned = options.owned ?? true
  if (!value) fail(`Name a test member: --${label} "HW Test 5"`)

  const index = value.match(/^(?:HW Test )?(\d{1,2})$/)
  if (
    index &&
    owned &&
    !ownedNumbers(agent, phase).includes(Number(index[1]))
  ) {
    fail(
      `REFUSED: HW Test ${index[1]} is not yours. In the ${phase} phase the ${agent} agent owns HW Test ${ownedNumbers(agent, phase).join(', ') || '(none)'}.`
    )
  }
  let rows: Array<MemberRow & { gym_id?: string }>
  if (index) {
    rows = (await hwMembers()).filter(
      (m) => testNumber(m.name) === Number(index[1])
    )
  } else {
    const column = /^[0-9a-f-]{36}$/i.test(value)
      ? 'id'
      : /^\d+$/.test(value)
        ? 'member_number'
        : 'name'
    const { data, error } = await supabase
      .from('members')
      .select(`${MEMBER_COLUMNS}, gym_id`)
      .eq('gym_id', TITAN_GYM_ID)
      .eq(column, value)
    if (error) fail(`members: ${error.message}`)
    rows = (data ?? []) as Array<MemberRow & { gym_id: string }>
  }
  if (rows.length !== 1)
    fail(`No single Titan HW test member matches "${value}"`)

  const row = rows[0]
  const number = testNumber(row.name)
  if ((row.gym_id && row.gym_id !== TITAN_GYM_ID) || number === null) {
    fail(
      `REFUSED: "${row.name}" is not an HW test member. hw-session only touches members named "${TEST_MEMBER_PREFIX}N" in Titan Fitness.`
    )
  }
  if (owned && !ownedNumbers(agent, phase).includes(number)) {
    fail(
      `REFUSED: ${row.name} is not yours. In the ${phase} phase the ${agent} agent owns HW Test ${ownedNumbers(agent, phase).join(', ') || '(none)'}.`
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
  if (!vendorToken) vendorToken = await provider.signIn(credentials())
  await pace()
  const response = await fetch(
    new URL(path, credentials().baseUrl).toString(),
    {
      headers: { ApiToken: vendorToken },
      signal: AbortSignal.timeout(20_000),
    }
  )
  if (!response.ok) throw new Error(`GET ${path} → HTTP ${response.status}`)
  return response.json()
}

async function vendorPost(
  path: string
): Promise<{ status: number; text: string }> {
  if (!vendorToken) vendorToken = await provider.signIn(credentials())
  await pace()
  const response = await fetch(
    new URL(path, credentials().baseUrl).toString(),
    {
      method: 'POST',
      headers: { ApiToken: vendorToken },
      signal: AbortSignal.timeout(20_000),
    }
  )
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

/** A command that names this subject, by whole number (12 never matches 1234). */
const mentionsSubject = (entry: QueueEntry, subjectIds: number[]): boolean =>
  subjectIds.some((id) =>
    new RegExp(`(?<!\\d)${id}(?!\\d)`).test(entry.command)
  )

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
  const path = resolve(EVIDENCE_DIR, agent, `${stamp}-${name}.json`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2))
  return path
}

function dryRun(description: string): void {
  console.log(
    `\nDRY RUN — would ${description}.\nRe-run with --apply to do it.\n`
  )
}

/** Never let a secret reach the terminal, wherever it turned up. */
function redact(text: string): string {
  let out = text
  for (const name of [
    'ACCESS_CONTROL_WEBHOOK_TOKEN',
    'VFT_PROBE_PASSWORD',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET',
    'E2E_ENTERPRISE_GYM_PASSWORD',
    'E2E_LITE_GYM_PASSWORD',
  ]) {
    const secret = (process.env[name] ?? '').trim()
    if (secret.length >= 8) out = out.split(secret).join(`<${name}>`)
  }
  return out
    .replace(
      /("(?:password|apiToken|token|access_token|refresh_token|secret)"\s*:\s*)"[^"]*"/gi,
      '$1"<redacted>"'
    )
    .replace(/(sb-[a-z0-9]+-auth-token[^=]*=)[^;\s]+/gi, '$1<redacted>')
}

// ============================================================
// help / phase
// ============================================================

function help(): void {
  const source = readFileSync(__filename, 'utf8')
  const block = source.slice(
    source.indexOf('## Who may do what'),
    source.indexOf('Usage:')
  )
  console.log(block.replace(/^ \* ?/gm, ''))
}

function phaseCommand(): void {
  if (positional !== 'set') {
    console.log(
      `Phase: ${phase}   (set by ${phaseState.setBy}${phaseState.at ? ` at ${slt(phaseState.at)} SLT` : ''})`
    )
    console.log(
      `  ${agent} owns HW Test ${ownedNumbers(agent, phase).join(', ') || '(none)'}; reader-wide work: ${mayUseReaders(agent, phase, 'drain') ? 'yes' : 'no'}`
    )
    return
  }
  gate('phase')
  const next = positional2 as Phase
  if (!(PHASES as readonly string[]).includes(next)) {
    fail(`phase set needs one of: ${PHASES.join(', ')}`)
  }
  const moveRefusal = phaseMoveRefusal(agent, phase, next)
  if (moveRefusal) {
    fail(
      `REFUSED: ${moveRefusal} (phase ${phase}, set by ${phaseState.setBy}${phaseState.at ? ` at ${slt(phaseState.at)} SLT` : ''}).`
    )
  }
  if (agent !== 'physical') {
    // The nightly reconcile (00:00 gym time) acts on every Titan member, the
    // agents' test members included. A phase must be able to finish before it.
    const latest =
      next === 'parallel' ? '15:00' : next === 'exclusive' ? '20:30' : null
    const now = slt(new Date()).slice(11, 16)
    if (latest && now >= latest && !flag('late')) {
      fail(
        `REFUSED: it is ${now} in Sri Lanka. The ${next} phase must start before ${latest} so the day ends before the 00:00 reconcile. Resume tomorrow, or — only on the owner's word — add --late.`
      )
    }
  }
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(
    PHASE_FILE,
    JSON.stringify(
      { phase: next, setBy: agent, at: new Date().toISOString() },
      null,
      2
    )
  )
  console.log(`✓ Phase ${phase} → ${next}.`)
}

// ============================================================
// The runbook: one task at a time, and results
// ============================================================

interface Step {
  who: 'operator' | 'claude'
  do: string
  cmd?: string
  expect?: string
}

interface Task {
  id: string
  track: 'physical' | 'remote'
  agent: AgentName
  phase: Phase
  band?: number
  order: number
  title: string
  why: string
  cases: string[]
  sim: string[]
  members: string[]
  requires: string[]
  depends_on: string[]
  preconditions: string[]
  steps: Step[]
  pass: string[]
  fail_if: string[]
  evidence: string[]
  restore: string[]
  stop_if: string[]
  est_minutes: number
  notes: string[]
}

interface Runbook {
  version: number
  tasks: Task[]
  coverage: Record<string, string>
  simulatorPlan: Record<string, string>
}

function loadRunbook(): Runbook {
  return JSON.parse(readFileSync(RUNBOOK_PATH, 'utf8')) as Runbook
}

function findTask(id: string | undefined): Task {
  if (!id) fail('Name a task: task OB-02')
  const task = loadRunbook().tasks.find((t) => t.id === id.toUpperCase())
  if (!task) fail(`No task "${id}" in the runbook`)
  return task
}

const TASK_STATUSES = ['pass', 'fail', 'partial', 'blocked', 'skipped'] as const
const CASE_VERDICTS = [
  'pass',
  'fail',
  'partial',
  'blocked',
  'na',
  'pinned',
  'gap',
] as const

interface ResultRecord {
  task: string
  agent: AgentName
  track: string
  status: (typeof TASK_STATUSES)[number]
  outcome: string
  caseResults: Record<string, string>
  findings: string[]
  observations: string[]
  artifacts: string[]
  at: string
  syncedAs?: string
  trackerSynced?: string[]
  history?: Array<Omit<ResultRecord, 'history'>>
}

function withoutHistory(record: ResultRecord): Omit<ResultRecord, 'history'> {
  const { history: _history, ...rest } = record
  return rest
}

const resultPath = (owner: string, taskId: string) =>
  resolve(RESULTS_DIR, owner, `${taskId}.json`)

function readResult(owner: string, taskId: string): ResultRecord | null {
  try {
    return JSON.parse(
      readFileSync(resultPath(owner, taskId), 'utf8')
    ) as ResultRecord
  } catch {
    return null
  }
}

function allResults(): ResultRecord[] {
  if (!existsSync(RESULTS_DIR)) return []
  const out: ResultRecord[] = []
  for (const owner of readdirSync(RESULTS_DIR)) {
    if (!(AGENT_NAMES as readonly string[]).includes(owner)) continue
    for (const file of readdirSync(resolve(RESULTS_DIR, owner))) {
      if (!file.endsWith('.json')) continue
      const record = readResult(owner, file.slice(0, -5))
      if (record) out.push(record)
    }
  }
  return out
}

function printTask(): void {
  const t = findTask(positional)
  const list = (title: string, items: string[]) => {
    if (!items.length) return
    console.log(`\n${title}`)
    items.forEach((i) => console.log(`  - ${i}`))
  }
  console.log(
    `■ ${t.id} · ${t.agent} · phase ${t.phase}${t.band ? ` · band ${t.band}` : ''} · ~${t.est_minutes} min`
  )
  console.log(`  ${t.title}`)
  console.log(`\nWhy: ${t.why}`)
  console.log(
    `\nCases: ${t.cases.join(', ') || '—'}   Sim: ${t.sim.join(', ') || '—'}   Members: ${t.members.join(', ') || '—'}`
  )
  if (t.depends_on.length) console.log(`Depends on: ${t.depends_on.join(', ')}`)
  if (t.requires.length) console.log(`Requires: ${t.requires.join(', ')}`)
  list('Preconditions:', t.preconditions)
  console.log('\nSteps:')
  t.steps.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.who}] ${s.do}`)
    if (s.cmd) console.log(`     $ ${s.cmd}`)
    if (s.expect) console.log(`     expect: ${s.expect}`)
  })
  list('PASS when:', t.pass)
  list('FAIL if:', t.fail_if)
  list('Record as evidence:', t.evidence)
  list('Restore:', t.restore)
  list('Stop if:', t.stop_if)
  list('Notes:', t.notes)
  const done = readResult(t.agent, t.id)
  console.log(
    `\nRecorded here: ${done ? `${done.status} at ${slt(done.at)} SLT — ${done.outcome.slice(0, 120)}` : 'nothing yet'}\n`
  )
}

function listTasks(): void {
  const wanted = arg('agent') ?? (agent === 'lead' ? undefined : agent)
  const runbook = loadRunbook()
  const tasks = runbook.tasks
    .filter((t) => !wanted || t.agent === wanted)
    .filter((t) => !arg('track') || t.track === arg('track'))
    .sort((a, b) => a.order - b.order)
  table(
    ['Task', 'Agent', 'Phase', 'Band', 'Min', 'Recorded', 'Title'],
    tasks.map((t) => {
      const r = readResult(t.agent, t.id)
      return [
        t.id,
        t.agent,
        t.phase,
        t.band ? String(t.band) : '',
        String(t.est_minutes),
        r ? `${r.status}${r.syncedAs ? '' : ' (unsynced)'}` : '—',
        t.title,
      ]
    })
  )
  const minutes = tasks.reduce((n, t) => n + t.est_minutes, 0)
  console.log(`\n  ${tasks.length} tasks, ~${minutes} min of work.\n`)
}

function record(): void {
  gate('record')
  const task = findTask(arg('task'))
  if (task.agent !== agent) {
    fail(
      `REFUSED: ${task.id} belongs to the ${task.agent} agent, not ${agent}. Two agents never record one task.`
    )
  }
  const status = arg('status') as ResultRecord['status']
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    fail(`--status must be one of: ${TASK_STATUSES.join(', ')}`)
  }
  const outcome = arg('outcome')
  if (!outcome)
    fail('--outcome "<one or two sentences: what was observed>" is required')

  const caseResults: Record<string, string> = {}
  for (const entry of args('case')) {
    const [id, verdict] = entry.split('=')
    if (!task.cases.includes(id)) {
      fail(
        `${id} is not one of ${task.id}'s cases (${task.cases.join(', ') || 'none'})`
      )
    }
    if (!(CASE_VERDICTS as readonly string[]).includes(verdict)) {
      fail(`Case verdict must be one of: ${CASE_VERDICTS.join(', ')}`)
    }
    caseResults[id] = verdict
  }
  const undecided = task.cases.filter((c) => !(c in caseResults))
  if (['pass', 'fail', 'partial'].includes(status) && undecided.length) {
    fail(
      `Give every case a verdict (--case ID=verdict): missing ${undecided.join(', ')}. Use =blocked for one you could not decide.`
    )
  }

  const previous = readResult(agent, task.id)
  const next: ResultRecord = {
    task: task.id,
    agent,
    track: task.track,
    status,
    outcome,
    caseResults,
    findings: args('finding'),
    observations: args('obs').map(redact),
    artifacts: args('artifact'),
    at: new Date().toISOString(),
    history: previous
      ? [...(previous.history ?? []), withoutHistory(previous)]
      : [],
  }
  const path = resultPath(agent, task.id)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(next, null, 2))
  console.log(
    `✓ ${task.id} recorded ${status}${previous ? ` (replaces ${previous.status} from ${slt(previous.at)} SLT)` : ''}. The lead syncs it to the tracker.`
  )
}

function trackerStatus(verdict: string): { status: string; prefix: string } {
  switch (verdict) {
    case 'pass':
      return { status: 'pass', prefix: '' }
    case 'pinned':
      return {
        status: 'pass',
        prefix: 'PINNED (existing tests, not a live run): ',
      }
    case 'fail':
      return { status: 'fail', prefix: '' }
    case 'na':
      return { status: 'na', prefix: '' }
    case 'gap':
      return { status: 'blocked', prefix: 'GAP (nothing pins it): ' }
    case 'partial':
      return { status: 'blocked', prefix: 'PARTIAL: ' }
    default:
      return { status: 'blocked', prefix: '' }
  }
}

/**
 * Results reach the tracker as NEW documents only (`results/<task>~<stamp>`),
 * so a batch never needs a version and two agents can never overwrite each
 * other: the page shows the newest result per task.
 */
function results(): void {
  const all = allResults()
  const markFile = arg('mark-synced')

  if (markFile) {
    gate('lead')
    const batch = JSON.parse(readFileSync(markFile, 'utf8')) as {
      kind: 'runbook' | 'tracker'
      entries: Array<{
        owner: AgentName
        task: string
        docId: string
        caseId?: string
      }>
    }
    for (const entry of batch.entries) {
      const record = readResult(entry.owner, entry.task)
      if (!record) continue
      if (batch.kind === 'runbook') record.syncedAs = entry.docId
      else
        record.trackerSynced = [
          ...new Set([...(record.trackerSynced ?? []), entry.caseId ?? '']),
        ]
      writeFileSync(
        resultPath(entry.owner, entry.task),
        JSON.stringify(record, null, 2)
      )
    }
    console.log(
      `✓ Marked ${batch.entries.length} ${batch.kind} write(s) synced.`
    )
    return
  }

  if (flag('emit-batch')) {
    gate('lead')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dir = resolve(RESULTS_DIR, 'batches', stamp)
    mkdirSync(dir, { recursive: true })
    const writes: Array<{
      op: 'set'
      collection: string
      doc_id: string
      file_path: string
    }> = []
    const entries: Array<{
      owner: AgentName
      task: string
      docId: string
      caseId?: string
    }> = []
    const tracker = flag('tracker')

    for (const r of all) {
      if (writes.length >= 50) break
      if (!tracker) {
        if (r.syncedAs) continue
        const docId = `${r.task}~${r.at.replace(/[^0-9]/g, '').slice(0, 14)}`
        const file = resolve(dir, `${docId}.json`)
        const { history: _history, syncedAs: _s, trackerSynced: _t, ...doc } = r
        writeFileSync(
          file,
          JSON.stringify(
            { ...doc, attempt: (r.history ?? []).length + 1 },
            null,
            2
          )
        )
        writes.push({
          op: 'set',
          collection: 'results',
          doc_id: docId,
          file_path: file,
        })
        entries.push({ owner: r.agent, task: r.task, docId })
      } else {
        for (const [caseId, verdict] of Object.entries(r.caseResults)) {
          if (writes.length >= 50) break
          if ((r.trackerSynced ?? []).includes(caseId)) continue
          const mapped = trackerStatus(verdict)
          const file = resolve(dir, `${caseId}.json`)
          writeFileSync(
            file,
            JSON.stringify(
              {
                status: mapped.status,
                note: `${mapped.prefix}${r.task}: ${r.outcome}`.slice(0, 900),
                at: r.at,
                by: `hw-runbook/${r.agent}`,
              },
              null,
              2
            )
          )
          writes.push({
            op: 'set',
            collection: 'results',
            doc_id: caseId,
            file_path: file,
          })
          entries.push({ owner: r.agent, task: r.task, docId: caseId, caseId })
        }
      }
    }

    if (writes.length === 0) {
      console.log('Nothing new to sync.')
      return
    }
    const writesFile = resolve(dir, 'writes.json')
    const markFilePath = resolve(dir, 'mark.json')
    writeFileSync(writesFile, JSON.stringify(writes, null, 2))
    writeFileSync(
      markFilePath,
      JSON.stringify(
        { kind: tracker ? 'tracker' : 'runbook', entries },
        null,
        2
      )
    )
    console.log(
      `${writes.length} write(s) for the ${tracker ? 'campaign tracker' : 'runbook tracker'}.`
    )
    console.log(`  1. ArtifactData batch, writes = the array in: ${writesFile}`)
    console.log(
      tracker
        ? '     (tracker artifact https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC — a case that already has a row is refused: read it, then update it with its version, by hand)'
        : '     (runbook artifact https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL — every doc is new, so no if_version)'
    )
    console.log(
      `  2. Only after it succeeds: results --mark-synced ${markFilePath} --as ${agent}`
    )
    if (writes.length === 50)
      console.log('  3. Then run --emit-batch again: there may be more.')
    return
  }

  const runbook = loadRunbook()
  const byTask = new Map(all.map((r) => [`${r.agent}/${r.task}`, r]))
  const counts: Record<string, number> = {}
  for (const t of runbook.tasks) {
    const r = byTask.get(`${t.agent}/${t.id}`)
    const key = `${t.agent}:${r?.status ?? 'open'}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  heading('Recorded on this machine, by agent')
  table(
    [
      'Agent',
      'Tasks',
      'Pass',
      'Fail',
      'Partial',
      'Blocked',
      'Skipped',
      'Open',
      'Unsynced',
    ],
    AGENT_NAMES.map((a) => {
      const n = (s: string) => String(counts[`${a}:${s}`] ?? 0)
      const total = runbook.tasks.filter((t) => t.agent === a).length
      const unsynced = all.filter((r) => r.agent === a && !r.syncedAs).length
      return [
        a,
        String(total),
        n('pass'),
        n('fail'),
        n('partial'),
        n('blocked'),
        n('skipped'),
        n('open'),
        String(unsynced),
      ]
    })
  )
  const failing = all.filter((r) => r.status === 'fail' || r.findings.length)
  if (failing.length) {
    heading('Failures and findings')
    for (const r of failing) {
      console.log(
        `  ${r.task} (${r.agent}) ${r.status}: ${r.outcome.slice(0, 140)}`
      )
      r.findings.forEach((f) => console.log(`     finding: ${f.slice(0, 160)}`))
    }
  }
  console.log('')
}

// ============================================================
// snapshot
// ============================================================

async function snapshot(): Promise<void> {
  gate()
  const eventLimit = Number(arg('events') ?? 10)
  const jobLimit = Number(arg('jobs') ?? 10)
  const queueLimit = Number(arg('queue') ?? 8)
  // A shared-phase agent sees its own members only: the rest are someone
  // else's experiment, and reading them invites acting on them.
  const scoped = agent === 'outbox' || agent === 'lifecycle'

  console.log(
    `hw-session snapshot (${agent}, phase ${phase}) — ${slt(new Date())} SLT (gym today ${gymToday()})`
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

  const members = scoped ? await myMembers() : await hwMembers()
  const memberIds = members.map((m) => m.id)
  heading(`HW test members${scoped ? ' (yours)' : ''} (${members.length})`)
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

  // The stop condition every task names: a member who is NOT an HW test
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

  let eventQuery = supabase
    .from('access_events')
    .select(
      'id, occurred_at, created_at, device_serial, subject_id, member_id, event_code, verify_type, raw'
    )
    .eq('gym_id', TITAN_GYM_ID)
    .order('created_at', { ascending: false })
    .limit(eventLimit)
  if (scoped)
    eventQuery = eventQuery.in(
      'member_id',
      memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']
    )
  const { data: events } = await eventQuery
  const nameById = new Map((await hwMembers()).map((m) => [m.id, m.name]))
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

  let jobQuery = supabase
    .from('access_sync_jobs')
    .select(
      'created_at, updated_at, member_id, intent, status, attempts, last_error, payload'
    )
    .eq('gym_id', TITAN_GYM_ID)
    .order('created_at', { ascending: false })
    .limit(jobLimit)
  if (scoped)
    jobQuery = jobQuery.in(
      'member_id',
      memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']
    )
  const { data: jobs } = await jobQuery
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

  const vendorDevices = rows(await vendorGet('/api/device')).filter((d) =>
    (Object.values(READERS) as string[]).includes(String(d.DevSN))
  )
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
    vendorDevices.map((d) => [
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

  const subjectIds = members
    .map((m) => subjectOf(m)?.subject_id)
    .filter((v): v is number => !!v)
  const templates = rows(await vendorGet('/api/template'))
  heading('Vendor subject records for these members (central copy)')
  table(
    ['EmpId', 'EmpName', 'StartDate', 'EndDate', 'IsSync', 'IsDelete'],
    templates
      .filter((t) => subjectIds.includes(Number(t.EmpId)))
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
    const full = await vendorQueue(serial)
    const queue = scoped
      ? full.filter((q) => mentionsSubject(q, subjectIds))
      : full
    queues[letter] = queue
    const notDone = queue.filter((q) => queueState(q) !== 'DONE').length
    heading(
      `Reader ${letter} command queue${scoped ? ' (your subjects)' : ''} — last ${queueLimit} (${notDone} not done of ${queue.length})`
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
    agent,
    phase,
    devices,
    members,
    events,
    jobs,
    vendorDevices,
    vendorTemplates: templates.filter((t) =>
      subjectIds.includes(Number(t.EmpId))
    ),
    queues,
    memberIds,
  })
  console.log(`\nEvidence: ${path}\n`)
}

// ============================================================
// watch-events / watch-queue / jobs
// ============================================================

async function watchEvents(): Promise<void> {
  gate()
  const since = parseSince(arg('since'), '2m')
  const timeoutSeconds = Number(arg('timeout') ?? 120)
  const keepWatching = flag('all')
  const members = await hwMembers()
  const nameById = new Map(members.map((m) => [m.id, m.name]))
  const onlyMember = arg('member')
    ? await hwMember(arg('member'), { owned: false })
    : null
  const onlyCode = arg('code')
  const seen = new Set<string>()
  const started = Date.now()
  let firstAt: number | null = null

  console.log(
    `Watching access_events for Titan since ${slt(since)} SLT${onlyMember ? ` for ${onlyMember.name}` : ''}${onlyCode ? ` with event ${onlyCode}` : ''}, up to ${timeoutSeconds}s${keepWatching ? '' : ' (stops 15s after the first scan)'}…`
  )

  while ((Date.now() - started) / 1000 < timeoutSeconds) {
    let query = supabase
      .from('access_events')
      .select(
        'id, occurred_at, created_at, device_serial, subject_id, member_id, event_code, verify_type, checking_status, raw'
      )
      .eq('gym_id', TITAN_GYM_ID)
      .gte('created_at', since.toISOString())
      .order('created_at')
    if (onlyMember) query = query.eq('member_id', onlyMember.id)
    if (onlyCode) query = query.eq('event_code', Number(onlyCode))
    const { data, error } = await query
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

async function watchQueue(): Promise<void> {
  gate()
  const serial = readerSerial(arg('reader'))
  const since = parseSince(arg('since'), '5m')
  const timeoutSeconds = Number(arg('timeout') ?? 180)
  const started = Date.now()
  const last = new Map<number, string>()

  let subjectIds: number[] = []
  if (arg('member')) {
    const s = subjectOf(await hwMember(arg('member'), { owned: false }))
    if (!s) fail('That member has no subject id yet')
    subjectIds = [s.subject_id]
  } else if (arg('subject')) {
    subjectIds = [Number(arg('subject'))]
  } else if (agent === 'outbox' || agent === 'lifecycle') {
    subjectIds = (await myMembers())
      .map((m) => subjectOf(m)?.subject_id)
      .filter((v): v is number => !!v)
  }

  console.log(
    `Watching reader ${readerLetter(serial)} (${serial}) for commands committed since ${slt(since)} SLT${subjectIds.length ? ` naming subject ${subjectIds.join('/')}` : ''}, up to ${timeoutSeconds}s…`
  )

  let recent: QueueEntry[] = []
  while ((Date.now() - started) / 1000 < timeoutSeconds) {
    recent = (await vendorQueue(serial)).filter(
      (q) =>
        q.commit &&
        q.commit.getTime() >= since.getTime() - 60_000 &&
        (!subjectIds.length || mentionsSubject(q, subjectIds))
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
    console.log(
      '  No matching command was committed for this reader in that window.'
    )
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

async function jobs(): Promise<void> {
  gate()
  const limit = Number(arg('limit') ?? 20)
  const members = await hwMembers()
  const nameById = new Map(members.map((m) => [m.id, m.name]))
  const memberIds = arg('member')
    ? [(await hwMember(arg('member'), { owned: false })).id]
    : members.map((m) => m.id)
  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('access_sync_jobs')
      .select(
        'id, created_at, updated_at, member_id, device_id, intent, status, attempts, next_attempt_at, last_error'
      )
      .eq('gym_id', TITAN_GYM_ID)
      .in('member_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) fail(`access_sync_jobs: ${error.message}`)
    return data ?? []
  }

  // `--wait S`: block until none of these jobs is still waiting to run —
  // how a task waits for production's own drain to retry something.
  // `--wait S`: block until every member in scope has had a sync complete
  // since the wait began — or has nothing waiting at all. Not "until nothing
  // is pending": the claim takes ONE job per member per run
  // (DISTINCT ON member_id), so a member with several queued changes clears
  // one job every five minutes. Any processed job syncs the member's current
  // state, so the first one to finish is the retry a task waits for; the rest
  // are no-ops. Compared on the database's own clock, never this laptop's.
  const waitSeconds = Number(arg('wait') ?? 0)
  const unsettled = [
    AccessSyncStatus.Pending,
    AccessSyncStatus.InFlight,
    AccessSyncStatus.Failed,
  ] as string[]
  const finished = [
    AccessSyncStatus.Succeeded,
    AccessSyncStatus.Dead,
  ] as string[]
  let data = await fetchJobs()
  if (waitSeconds > 0) {
    const started = Date.now()
    const baseline = new Map<string, string>()
    for (const j of data) {
      const key = String(j.member_id)
      if (!baseline.has(key) || String(j.updated_at) > baseline.get(key)!) {
        baseline.set(key, String(j.updated_at))
      }
    }
    const waiting = () =>
      [
        ...new Set(
          data
            .filter((j) => unsettled.includes(j.status))
            .map((j) => String(j.member_id))
        ),
      ].filter(
        (memberId) =>
          !data.some(
            (j) =>
              String(j.member_id) === memberId &&
              finished.includes(j.status) &&
              String(j.updated_at) > (baseline.get(memberId) ?? '')
          )
      )
    while (waiting().length && (Date.now() - started) / 1000 < waitSeconds) {
      console.log(
        `  +${Math.round((Date.now() - started) / 1000)}s: waiting for a sync to complete for ${waiting()
          .map((id) => nameById.get(id) ?? 'a member')
          .join(', ')}…`
      )
      await wait(15_000)
      data = await fetchJobs()
    }
    const left = waiting()
    const queued = data.filter((j) => unsettled.includes(j.status)).length
    console.log(
      left.length
        ? `  NOT YET after ${waitSeconds}s: no sync has completed for ${left.map((id) => nameById.get(id) ?? 'a member').join(', ')}.`
        : `  ✓ Every member has had a sync complete since the wait began${queued ? ` (${queued} older job(s) still queued — production's drain takes one per member every 5 minutes; they are no-ops)` : ''}.`
    )
  }
  table(
    [
      'Job',
      'Created (SLT)',
      'Updated (SLT)',
      'Member',
      'Intent',
      'Status',
      'Tries',
      'Next try (SLT)',
      'Error',
    ],
    data.map((j) => [
      String(j.id).slice(0, 8),
      slt(j.created_at),
      slt(j.updated_at),
      j.member_id
        ? (nameById.get(j.member_id) ?? 'real member')
        : '(device op)',
      j.intent,
      j.status,
      String(j.attempts),
      slt(j.next_attempt_at),
      (j.last_error ?? '').slice(0, 40),
    ])
  )
  const { count } = await supabase
    .from('access_sync_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', AccessSyncStatus.Dead)
  console.log(`\n  Dead jobs, all gyms: ${count ?? '?'}\n`)
}

// ============================================================
// Member lifecycle — real use cases, texts suppressed
// ============================================================

/** Push one member now, as the inline provision after a change does. */
async function pushMember(memberId: string, force = false): Promise<void> {
  const result = await new SyncMemberAccess(
    sessionRepository(),
    provider
  ).execute({
    memberId,
    ...(force ? { force: true } : {}),
  })
  console.log(`  push${force ? ' (forced)' : ''}: ${JSON.stringify(result)}`)
}

async function writeDates(
  member: MemberRow,
  patch: { next_due_date?: string; membership_start_date?: string }
): Promise<void> {
  const { data, error } = await supabase
    .from('members')
    .update(patch)
    .eq('id', member.id)
    .eq('gym_id', TITAN_GYM_ID)
    .like('name', `${TEST_MEMBER_PREFIX}%`)
    .select('id')
  if (error) fail(`members update: ${error.message}`)
  if ((data ?? []).length !== 1)
    fail('The update matched no row — nothing changed.')
}

async function titanName(): Promise<string> {
  const { data } = await supabase
    .from('gyms')
    .select('gym_name')
    .eq('id', TITAN_GYM_ID)
    .single()
  return String(data?.gym_name ?? 'Titan Fitness')
}

/**
 * Create HW Test N…M through the real registration use case.
 *
 * Daily plan: `REMINDER_RULES[Daily]` sends nothing, ever, so the morning
 * reminder run cannot text a test member whatever its dates. The welcome text
 * goes to a suppressed provider. Phone numbers are synthetic and distinct
 * (duplicates are refused per gym).
 */
async function createMembers(): Promise<void> {
  gate('lead')
  const from = Number(arg('from'))
  const to = Number(arg('to') ?? arg('from'))
  if (!(from >= 1 && to <= MAX_TEST_MEMBER && from <= to)) {
    fail(`--from/--to must be within 1–${MAX_TEST_MEMBER}`)
  }
  const owned = ownedNumbers(agent, phase)
  const foreign = range(from, to).filter((n) => !owned.includes(n))
  if (foreign.length) {
    fail(
      `REFUSED: HW Test ${foreign.join(', ')} are not yours to create in the ${phase} phase.`
    )
  }

  const existing = await hwMembers()
  const due = resolveDay(`+${PARKED_DUE_DAYS}`)
  const plan = range(from, to).map((n) => {
    const found = existing.find((m) => testNumber(m.name) === n)
    return { n, found, phone: `+94700000${100 + n}` }
  })
  for (const p of plan) {
    console.log(
      p.found
        ? `  HW Test ${p.n}: exists (${p.found.status}, due ${p.found.next_due_date}) — skipped${p.found.status === 'cancelled' ? '; use unpark' : ''}`
        : `  HW Test ${p.n}: register (daily plan, 1 LKR, phone ${p.phone}, texts suppressed), due → ${due}, push to both readers`
    )
  }
  if (!apply) return dryRun('register those members and push them')

  const sms = new SuppressedSmsProvider()
  const register = new RegisterMember(
    memberRepo,
    new SupabasePaymentRepository(supabase),
    sms,
    suppressedSmsRepository
  )
  const gymName = await titanName()
  for (const p of plan) {
    if (p.found) continue
    const { member } = await register.execute({
      gymId: TITAN_GYM_ID,
      gymName,
      name: `${TEST_MEMBER_PREFIX}${p.n}`,
      phoneNumber: p.phone,
      planType: PlanType.Daily,
      planAmount: 1,
      membershipStartDate: asDomainDate(gymToday()),
      paymentAmount: 1,
      remarks: 'Door-hardware test member (hw-session). Never texted.',
    })
    const row = await hwMember(member.id, { owned: false })
    await writeDates(row, { next_due_date: due })
    await pushMember(member.id)
    const after = await hwMember(member.id, { owned: false })
    console.log(
      `✓ ${after.name} #${after.member_number} subject ${subjectOf(after)?.subject_id ?? '—'} held by ${heldBy(subjectOf(after))}`
    )
  }
  console.log(
    `  Texts suppressed: ${sms.suppressed}. Next: watch-queue --reader A and B.\n`
  )
}

/** Suspend → cancel, as the desk must (Active cannot go straight to Cancelled). */
async function cancelSafely(memberId: string): Promise<string> {
  const current = await memberRepo.findById(memberId, TITAN_GYM_ID)
  if (!current) throw new Error('member vanished')
  if (current.status === MemberStatus.Cancelled) return 'already cancelled'
  if (current.status === MemberStatus.Active) {
    await new SuspendMember(memberRepo).execute({
      memberId,
      gymId: TITAN_GYM_ID,
    })
  }
  await new CancelMember(memberRepo).execute({ memberId, gymId: TITAN_GYM_ID })
  return 'cancelled'
}

async function targets(): Promise<MemberRow[]> {
  if (flag('mine')) return myMembers()
  return [await hwMember(arg('member'))]
}

/** Nobody is left active overnight: cancelled members are never reminded or admitted. */
async function park(): Promise<void> {
  gate('lead')
  const list = await targets()
  list.forEach((m) =>
    console.log(
      `  ${m.name}: ${m.status} → cancelled, then push (block + template revoke)`
    )
  )
  if (!apply) return dryRun(`park ${list.length} member(s)`)
  for (const m of list) {
    console.log(`✓ ${m.name}: ${await cancelSafely(m.id)}`)
    await pushMember(m.id)
  }
  console.log('')
}

async function unpark(): Promise<void> {
  gate('lead')
  const list = await targets()
  const due = resolveDay(`+${PARKED_DUE_DAYS}`)
  list.forEach((m) =>
    console.log(`  ${m.name}: ${m.status} → active, due ${due}, then push`)
  )
  if (!apply) return dryRun(`unpark ${list.length} member(s)`)
  for (const m of list) {
    if (m.status !== MemberStatus.Active) {
      await new ReactivateMember(memberRepo).execute({
        memberId: m.id,
        gymId: TITAN_GYM_ID,
        newDueDate: asDomainDate(due),
      })
    } else {
      await writeDates(m, { next_due_date: due })
    }
    await pushMember(m.id)
    const after = await hwMember(m.id, { owned: false })
    console.log(
      `✓ ${after.name}: ${after.status}, due ${after.next_due_date}, held by ${heldBy(subjectOf(after))}`
    )
  }
  console.log('')
}

async function memberChange(): Promise<void> {
  gate()
  const member = await hwMember(arg('member'))
  const before = `${member.status}, due ${member.next_due_date}`
  let plan: string
  let run: () => Promise<unknown>
  const sms = new SuppressedSmsProvider()

  switch (command) {
    case 'pay': {
      const date = resolveDay(arg('date') ?? 'today')
      plan = `record a 1 LKR payment for ${member.name} dated ${date} (receipt text suppressed), then push`
      run = async () =>
        new CollectPayment(
          memberRepo,
          new SupabasePaymentRepository(supabase),
          sms,
          suppressedSmsRepository
        ).execute({
          gymId: TITAN_GYM_ID,
          gymName: await titanName(),
          memberId: member.id,
          paymentDate: asDomainDate(date),
          paymentAmount: 1,
        })
      break
    }
    case 'suspend':
      plan = `suspend ${member.name}, then push`
      run = () =>
        new SuspendMember(memberRepo).execute({
          memberId: member.id,
          gymId: TITAN_GYM_ID,
        })
      break
    case 'cancel':
      plan = `cancel ${member.name} (suspending first if active), then push`
      run = () => cancelSafely(member.id)
      break
    case 'reactivate': {
      const due = resolveDay(arg('due') ?? `+${PARKED_DUE_DAYS}`)
      plan = `reactivate ${member.name} with due ${due}, then push`
      run = () =>
        new ReactivateMember(memberRepo).execute({
          memberId: member.id,
          gymId: TITAN_GYM_ID,
          newDueDate: asDomainDate(due),
        })
      break
    }
    default:
      return fail(`unknown member change ${command}`)
  }

  // `--no-push` leaves the change to the outbox alone: the trigger's job, and
  // production's drain within five minutes — or an `ambiguous push` now.
  const noPush = flag('no-push')
  if (noPush)
    plan = plan.replace(
      ', then push',
      ' (no push: the outbox job waits for the drain)'
    )
  console.log(`${member.name} (${before}): ${plan}.`)
  if (!apply) return dryRun(plan)
  if (noPush) await avoidCronBoundary(75)
  await run()
  if (!noPush) await pushMember(member.id)
  const after = await hwMember(member.id, { owned: false })
  console.log(
    `✓ ${after.name}: ${after.status}, due ${after.next_due_date}, held by ${heldBy(subjectOf(after))}, blocked ${subjectOf(after)?.last_synced_blocked}${sms.suppressed ? ` (texts suppressed: ${sms.suppressed})` : ''}`
  )
  console.log('  Next: watch-queue on both readers.\n')
}

async function push(): Promise<void> {
  gate()
  const member = await hwMember(arg('member'))
  const force = command === 'resend'
  const plan = `${force ? 'force a re-send (the panel button)' : 'push'} for ${member.name}${usingStub() ? ' to the STUB vendor' : ''}`
  console.log(`${plan}.`)
  if (!apply) return dryRun(plan)
  await pushMember(member.id, force)
  console.log('  Next: watch-queue --member on both readers.\n')
}

async function rename(): Promise<void> {
  gate()
  const member = await hwMember(arg('member'))
  const to = arg('to') ?? ''
  if (
    testNumber(to) !== testNumber(member.name) ||
    !to.startsWith(TEST_MEMBER_PREFIX)
  ) {
    fail(
      `The new name must keep "${TEST_MEMBER_PREFIX}${testNumber(member.name)}" at the start: it is how the fence knows the member.`
    )
  }
  const plan = `rename ${member.name} → "${to}" and push the name to the readers`
  console.log(`${plan}.`)
  if (!apply) return dryRun(plan)
  const current = await memberRepo.findById(member.id, TITAN_GYM_ID)
  if (!current) fail('member vanished')
  await memberRepo.update(current.updateName(to))
  const pushed = await new PushRename(sessionRepository(), provider).member(
    TITAN_GYM_ID,
    member.id
  )
  const after = await hwMember(member.id, { owned: false })
  console.log(
    `✓ Now "${after.name}", consent ${after.biometric_consent_at ?? 'none'}. PushRename: ${JSON.stringify(pushed)}`
  )
  console.log('  Next: snapshot (vendor EmpName) and watch-queue.\n')
}

async function setDates(): Promise<void> {
  gate()
  const member = await hwMember(arg('member'))
  const due = arg('due') ? resolveDay(arg('due')!) : undefined
  const start = arg('start') ? resolveDay(arg('start')!) : undefined
  if (!due && !start) fail('Give --due and/or --start')

  console.log(
    `${member.name}: start ${member.membership_start_date} → ${start ?? '(unchanged)'}, due ${member.next_due_date} → ${due ?? '(unchanged)'}`
  )
  if (!apply)
    return dryRun('write those dates; the trigger then enqueues an outbox job')

  // The job this enqueues is meant for the command that follows it. Leave at
  // least 75 s before production's next drain, or that drain takes it first.
  await avoidCronBoundary(75)
  // New jobs are counted by id, not by time: this laptop's clock and the
  // database's disagree by more than the update takes.
  const jobIds = async () =>
    new Set(
      (
        (
          await supabase
            .from('access_sync_jobs')
            .select('id')
            .eq('member_id', member.id)
        ).data ?? []
      ).map((j) => String(j.id))
    )
  const existing = await jobIds()
  const patch: { next_due_date?: string; membership_start_date?: string } = {}
  if (due) patch.next_due_date = due
  if (start) patch.membership_start_date = start
  await writeDates(member, patch)

  await wait(1_500)
  const enqueued = [...(await jobIds())].filter((id) => !existing.has(id))
  console.log(
    `✓ Written. Outbox jobs enqueued by the trigger: ${enqueued.length}`
  )
  console.log(
    "  Next: `push --apply` to send it now, or wait ≤5 min for production's drain.\n"
  )
}

// ============================================================
// drain / reconcile / reclaim
// ============================================================

async function drain(): Promise<void> {
  gate()
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
  if (usingStub()) {
    const hwIds = new Set((await hwMembers()).map((m) => m.id))
    const real = (due ?? []).filter(
      (j) => !j.member_id || !hwIds.has(j.member_id)
    )
    if (real.length) {
      fail(
        `REFUSED: ${real.length} due job(s) are not HW test members'. A drain against the stub would fail a real member's change.`
      )
    }
  }
  if (!apply)
    return dryRun(
      `claim and process those jobs now with the real drain${usingStub() ? ' against the STUB vendor' : ''}`
    )

  // `--crash-after N` kills this process the moment the Nth vendor command
  // has really been accepted — mid-batch, jobs still `in_flight`, our records
  // not yet written. `--crash-on-complete` dies just after the first job is
  // marked done, before the batch returns. Both are a worker dying under load
  // (REC-03/07, OUT-13, FAIL-08): the next drain must reclaim and finish.
  const crashAfter = arg('crash-after') ? Number(arg('crash-after')) : null
  const crashOnComplete = flag('crash-on-complete')
  if (crashAfter !== null && !(crashAfter >= 1)) {
    fail('--crash-after needs a whole number of commands, 1 or more')
  }
  if (crashAfter !== null || crashOnComplete || usingStub())
    await avoidCronBoundary()

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
            return async (...callArgs: unknown[]) => {
              const outcome = await (
                value as (...a: unknown[]) => Promise<unknown>
              ).apply(target, callArgs)
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

  const base = sessionRepository()
  const repo = crashOnComplete
    ? (new Proxy(base, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver)
          if (prop !== 'completeJob' || typeof value !== 'function')
            return value
          return async (...callArgs: unknown[]) => {
            await (value as (...a: unknown[]) => Promise<void>).apply(
              target,
              callArgs
            )
            console.log(
              `\n✗ SIMULATED CRASH right after job ${String(callArgs[0]).slice(0, 8)} was marked ${String(callArgs[1])}.\n`
            )
            process.exit(137)
          }
        },
      }) as IAccessControlRepository)
    : base

  const summary = await new DrainAccessSyncQueue(
    repo,
    new SyncMemberAccess(repo, drainProvider),
    new OperateDevice(repo, drainProvider),
    new EvictInactiveSubjects(repo, drainProvider),
    drainProvider
  ).execute()
  console.log('✓ Drain finished:', JSON.stringify(summary))
  console.log('  Next: jobs, and watch-queue on both readers.\n')
}

async function reconcile(): Promise<void> {
  gate()
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
      `  Would enqueue: ${enqueued.map((id) => names.get(id) ?? 'a real member').join(', ') || 'nobody'}`
    )
    console.log('  Re-run with --apply to enqueue for real.\n')
  }
}

async function reclaim(): Promise<void> {
  gate()
  const olderThan = Number(arg('older-than'))
  if (!(olderThan >= 1)) fail('--older-than needs seconds, 1 or more')
  await avoidCronBoundary()
  const hwIds = new Set((await hwMembers()).map((m) => m.id))
  const { data, error } = await supabase
    .from('access_sync_jobs')
    .select('id, gym_id, member_id, intent, updated_at')
    .eq('status', AccessSyncStatus.InFlight)
  if (error) fail(`access_sync_jobs: ${error.message}`)
  const inFlight = data ?? []
  // A door open or restart can no longer run twice (the drain refuses any
  // attempt past the first), so reclaiming one is harmless and not "real".
  const runsOnce = (j: { member_id: string | null; intent: string }) =>
    j.member_id === null &&
    (j.intent === AccessIntent.OpenDoor ||
      j.intent === AccessIntent.RebootDevice)
  const real = inFlight.filter(
    (j) =>
      !runsOnce(j) &&
      (j.gym_id !== TITAN_GYM_ID || !j.member_id || !hwIds.has(j.member_id))
  )
  console.log(
    `In flight now: ${inFlight.length} (not HW test members': ${real.length})`
  )
  if (real.length)
    fail('REFUSED: a real job is in flight. Reclaiming it would run it twice.')
  if (!apply)
    return dryRun(`return in_flight jobs older than ${olderThan}s to pending`)
  const count = await sessionRepository().reclaimStaleJobs(olderThan)
  console.log(`✓ Reclaimed ${count} job(s). Next: drain --apply, jobs.\n`)
}

// ============================================================
// vendor — one direct provider call, bypassing our records on purpose
// ============================================================

async function vendor(): Promise<void> {
  gate()
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
  if (!subject) fail(`${member.name} has no subject id yet — push them first`)
  const target = { deviceSerial: serial, subjectId: String(subject.subject_id) }

  const describe = `${op} for ${member.name} (subject ${subject.subject_id}) on reader ${readerLetter(serial)}`
  console.log(
    `${describe}.\n  ⚠ This bypasses our records deliberately: afterwards our DB and the reader may disagree.\n  Restore with \`resend --member … --apply\` (forced).`
  )

  let run: () => Promise<unknown>
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
        provider.setValidPeriod(credentials(), {
          ...target,
          startDate,
          endDate,
        })
      break
    }
    case 'block':
      run = () => provider.blockAccess(credentials(), target)
      break
    case 'grant':
      run = () => provider.grantAccess(credentials(), target)
      break
    case 'sync':
      run = () =>
        provider.syncSubjectsToDevice(credentials(), serial, [target.subjectId])
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
// enrol / withdraw
// ============================================================

/**
 * The panel hides "Register fingerprint" once a member is registered, so the
 * already-enrolled case and any enrolment that is not itself the thing under
 * test go through the real use case here. With `--vendor-url` the command
 * goes to a stub instead of a reader: consent is written exactly as the real
 * path writes it, and no reader is held in enrol mode.
 */
async function enrol(): Promise<void> {
  gate()
  const member = await hwMember(arg('member'))
  const reader = readerSerial(arg('reader'))
  const plan = `put reader ${readerLetter(reader)}${usingStub() ? ' (STUB vendor — no real reader)' : ''} into enrol mode for ${member.name}${flag('consent') ? ', recording the consent the operator confirmed' : ''}`
  // `--fail-consent-write` (stub only): the consent write throws, as a lost
  // database connection would. Nothing may reach a reader after that.
  const failConsent = flag('fail-consent-write')
  if (failConsent && !usingStub())
    fail(
      '--fail-consent-write needs --vendor-url (a stub): if the gate were broken, a real reader would act'
    )
  console.log(
    `Enrol: ${plan}${failConsent ? ' — with the consent write made to FAIL' : ''}.`
  )
  if (!apply) return dryRun(plan)

  const base = sessionRepository()
  const repo = failConsent
    ? (new Proxy(base, {
        get(target, prop, receiver) {
          if (prop === 'recordBiometricConsent') {
            return async () => {
              throw new Error(
                'Simulated consent write failure (hw-session --fail-consent-write)'
              )
            }
          }
          const value = Reflect.get(target, prop, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        },
      }) as IAccessControlRepository)
    : base

  const result = await new ManageMemberBiometric(repo, provider).enrol({
    gymId: TITAN_GYM_ID,
    memberId: member.id,
    deviceId: await deviceIdFor(reader),
    ...(flag('consent') ? { consentGranted: true } : {}),
  })
  console.log('✓ Use case returned:', JSON.stringify(result))
  console.log(
    usingStub()
      ? '  Next: stub-log to see the command, snapshot for consent.\n'
      : '  Next: watch-queue on that reader; the operator presents the finger when the reader prompts.\n'
  )
}

/**
 * The panel offers "Remove fingerprint" only once a finger is registered, so a
 * withdrawal DURING an enrolment cannot be driven from it. This calls the same
 * use case the button does: fromdev revoke, flag cleared, consent cleared.
 */
async function withdraw(): Promise<void> {
  gate()
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
  gate()
  const scenario = positional
  const member = await hwMember(arg('member'))
  const repo = sessionRepository()
  const biometric = new ManageMemberBiometric(repo, provider)
  const sync = new SyncMemberAccess(repo, provider)
  const reader = readerSerial(arg('reader') ?? 'A')
  const sms = new SuppressedSmsProvider()

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

  const settle = async (label: string, work: () => Promise<unknown>) => {
    try {
      return { [label]: await work() }
    } catch (error) {
      return {
        [label]: 'THREW',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const cancelAndPush = (memberId: string) =>
    settle('cancel', async () => ({
      result: await cancelSafely(memberId),
      sync: await sync.execute({ memberId }),
    }))

  let plan: string
  let fire: () => Promise<unknown[]>

  switch (scenario) {
    case 'consent':
      if (member.biometric_consent_at) {
        fail(
          `${member.name} already has consent on file — withdraw first (that clears it)`
        )
      }
      plan = `two simultaneous enrolments of ${member.name} on reader ${readerLetter(reader)}${usingStub() ? ' (STUB)' : ''}, both carrying consent`
      fire = () =>
        Promise.all([
          settle('enrol 1', () => enrolOn(member.id, reader, true)),
          settle('enrol 2', () => enrolOn(member.id, reader, true)),
        ])
      break
    case 'enrol-both':
      plan = `enrol ${member.name} on reader A and reader B at the same instant`
      fire = () =>
        Promise.all([
          settle('enrol A', () => enrolOn(member.id, READERS.A)),
          settle('enrol B', () => enrolOn(member.id, READERS.B)),
        ])
      break
    case 'enrol-two': {
      const second = await hwMember(arg('member2'), { label: 'member2' })
      plan = `enrol ${member.name} and ${second.name} on reader ${readerLetter(reader)} at the same instant`
      fire = () =>
        Promise.all([
          settle('enrol 1', () => enrolOn(member.id, reader)),
          settle('enrol 2', () => enrolOn(second.id, reader)),
        ])
      break
    }
    case 'enrol-vs-cancel':
      plan = `enrol ${member.name} on reader ${readerLetter(reader)} while cancelling them (suspend → cancel → immediate push)`
      fire = () =>
        Promise.all([
          settle('enrol', () => enrolOn(member.id, reader)),
          cancelAndPush(member.id),
        ])
      break
    case 'double-cancel':
      plan = `cancel ${member.name} twice at the same instant, each followed by an immediate push`
      fire = () =>
        Promise.all([cancelAndPush(member.id), cancelAndPush(member.id)])
      break
    case 'pay-vs-dates':
      plan = `record a payment for ${member.name} (text suppressed) while their due date is written to +30, at the same instant`
      fire = async () => {
        const gymName = await titanName()
        return Promise.all([
          settle('pay', () =>
            new CollectPayment(
              memberRepo,
              new SupabasePaymentRepository(supabase),
              sms,
              suppressedSmsRepository
            ).execute({
              gymId: TITAN_GYM_ID,
              gymName,
              memberId: member.id,
              paymentDate: asDomainDate(gymToday()),
              paymentAmount: 1,
            })
          ),
          settle('set-dates', () =>
            writeDates(member, { next_due_date: resolveDay('+30') })
          ),
        ])
      }
      break
    case 'trio': {
      if (!usingStub())
        fail(
          'trio needs --vendor-url (a stub): it must not hold a real reader in enrol mode'
        )
      const to =
        arg('to') ?? `${TEST_MEMBER_PREFIX}${testNumber(member.name)} trio`
      plan = `at the same instant: enrol ${member.name} with consent (STUB), rename to "${to}", record a payment`
      fire = async () => {
        const gymName = await titanName()
        const current = await memberRepo.findById(member.id, TITAN_GYM_ID)
        if (!current) throw new Error('member vanished')
        return Promise.all([
          settle('enrol', () => enrolOn(member.id, reader, true)),
          settle('rename', () => memberRepo.update(current.updateName(to))),
          settle('pay', () =>
            new CollectPayment(
              memberRepo,
              new SupabasePaymentRepository(supabase),
              sms,
              suppressedSmsRepository
            ).execute({
              gymId: TITAN_GYM_ID,
              gymName,
              memberId: member.id,
              paymentDate: asDomainDate(gymToday()),
              paymentAmount: 1,
            })
          ),
        ])
      }
      break
    }
    default:
      return fail(
        'race needs one of: consent, enrol-both, enrol-two, enrol-vs-cancel, double-cancel, pay-vs-dates, trio'
      )
  }

  console.log(`Race: ${plan}.`)
  if (!apply) return dryRun(plan)

  const started = Date.now()
  const outcomes = await fire()
  console.log(`✓ All settled in ${Date.now() - started}ms:`)
  outcomes.forEach((r, i) => console.log(`  [${i + 1}] ${JSON.stringify(r)}`))

  const after = await hwMember(member.id, { owned: false })
  const s = subjectOf(after)
  console.log(
    `\nAfter: "${after.name}" status ${after.status}, due ${after.next_due_date}, consent ${after.biometric_consent_at ?? 'none'}, held by ${heldBy(s)}, blocked ${s?.last_synced_blocked}`
  )
  console.log(
    '  Next: snapshot, jobs, and watch-queue on the reader(s) involved.\n'
  )
}

// ============================================================
// ambiguous — the vendor did it, and we were told it failed
// ============================================================

async function ambiguous(): Promise<void> {
  gate()
  const kind = positional
  const member = await hwMember(arg('member'))
  const reader = readerSerial(arg('reader') ?? 'A')
  const repo = sessionRepository()

  // The real provider, except that after the chosen call genuinely reaches the
  // vendor, the answer is "lost": we throw as a timeout would.
  let armed = true
  const lossy = (lose: string) =>
    new Proxy(provider, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (prop !== lose || typeof value !== 'function') {
          return typeof value === 'function' ? value.bind(target) : value
        }
        return async (...callArgs: unknown[]) => {
          const outcome = await (
            value as (...a: unknown[]) => Promise<unknown>
          ).apply(target, callArgs)
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
  } else if (kind === 'push') {
    const lose = arg('lose') ?? ''
    if (
      ![
        'upsertSubject',
        'syncSubjectsToDevice',
        'setValidPeriod',
        'grantAccess',
        'blockAccess',
        'revokeBiometrics',
      ].includes(lose)
    ) {
      fail(
        '--lose needs a command method: upsertSubject, syncSubjectsToDevice, setValidPeriod, grantAccess, blockAccess, revokeBiometrics'
      )
    }
    const force = flag('force')
    const plan = `${force ? 'forced ' : ''}push for ${member.name}; the first ${lose} reaches the vendor and its reply is lost`
    console.log(`Ambiguous: ${plan}.`)
    if (!apply) return dryRun(plan)
    try {
      const result = await new SyncMemberAccess(repo, lossy(lose)).execute({
        memberId: member.id,
        ...(force ? { force: true } : {}),
      })
      console.log('  Use case returned:', JSON.stringify(result))
      console.log(
        `  ${armed ? '→ no ' + lose + ' was needed, so nothing was lost. Change the member so this push needs one.' : '→ compare our record (snapshot) with the reader (watch-queue): the next push repeats what was lost.'}`
      )
    } catch (error) {
      console.log(
        `  Use case THREW: ${error instanceof Error ? error.message : error}`
      )
    }
  } else {
    return fail('ambiguous needs: enrol or push')
  }
  console.log(
    '  Next: watch-queue on the reader(s), then follow the task steps.\n'
  )
}

// ============================================================
// Reader-wide operations
// ============================================================

async function operate(): Promise<void> {
  gate()
  const serial = readerSerial(arg('reader'))
  const verb = command === 'open' ? 'open the door on' : 'restart'
  const plan = `${verb} reader ${readerLetter(serial)} (the Door Access page's button)`
  console.log(`${plan}.`)
  if (!apply) return dryRun(plan)
  const operateDevice = new OperateDevice(sessionRepository(), provider)
  const input = {
    gymId: TITAN_GYM_ID,
    deviceId: await deviceIdFor(serial),
    actorId: `hw-session:${agent}`,
  }
  const started = new Date()
  const result =
    command === 'open'
      ? await operateDevice.openDoor(input)
      : await operateDevice.reboot(input)
  console.log(`✓ ${JSON.stringify(result)} at ${slt(started)} SLT`)
  console.log(
    command === 'open'
      ? `  Next: watch-events --since ${started.toISOString()} --code 8 (the reader reports a remote open as event 8).\n`
      : '  Next: snapshot in ~90s (LastRequestTime gap = the restart), watch-queue.\n'
  )
}

async function freeSpace(): Promise<void> {
  gate()
  const repo = sessionRepository()
  const candidates = await repo.listEvictionCandidates(TITAN_GYM_ID)
  const hw = new Map((await hwMembers()).map((m) => [m.id, m.name]))
  const real = candidates.filter((c) => !hw.has(c.memberId))
  console.log(
    `Eviction candidates: ${candidates.length} (HW test: ${candidates.length - real.length}, real members: ${real.length})`
  )
  candidates
    .filter((c) => hw.has(c.memberId))
    .forEach((c) =>
      console.log(
        `  ${hw.get(c.memberId)} (${c.status}, due ${c.nextDueDate.toISOString().slice(0, 10)})`
      )
    )
  if (real.length) {
    fail(
      `REFUSED: "Free up space" would evict ${real.length} real member(s) of Titan from the readers. Record the count as the observation; do not run it.`
    )
  }
  if (!apply) return dryRun('run the real manual eviction for Titan')
  const summary = await new EvictInactiveSubjects(repo, provider).execute({
    gymId: TITAN_GYM_ID,
    reason: 'manual',
  })
  console.log('✓', JSON.stringify(summary), '\n')
}

async function capacity(): Promise<void> {
  gate()
  const serial = readerSerial(arg('reader'))
  const device = (await titanDevices()).find((d) => d.device_serial === serial)
  if (!device) fail('reader not registered')
  console.log(
    `Reader ${readerLetter(serial)}: templates ${device.template_count}, capacity ${device.template_capacity ?? 'unknown'}`
  )
  const set = arg('set')
  if (!set && !flag('clear')) return
  if (set && !(Number(set) >= 1)) fail('--set needs a whole number')
  const plan = set
    ? `record capacity ${set} for reader ${readerLetter(serial)}`
    : `forget reader ${readerLetter(serial)}'s capacity (back to unknown)`
  if (!apply) return dryRun(plan)
  if (set) {
    await sessionRepository().recordDeviceCapacity(serial, Number(set))
  } else {
    const { error } = await supabase
      .from('access_devices')
      .update({ template_capacity: null })
      .eq('gym_id', TITAN_GYM_ID)
      .eq('device_serial', serial)
    if (error) fail(error.message)
  }
  console.log(`✓ ${plan}.\n`)
}

/** Unlink / re-link a reader in OUR records (the vendor has no device delete). */
async function deviceLink(): Promise<void> {
  gate()
  const serial = readerSerial(arg('reader'))
  const repo = sessionRepository()
  const existing = (await titanDevices()).find(
    (d) => d.device_serial === serial
  )
  if (command === 'forget') {
    if (!existing) fail(`Reader ${readerLetter(serial)} is not linked to Titan`)
    const plan = `unlink reader ${readerLetter(serial)} (${existing.device_name}) from Titan — our records only`
    console.log(`${plan}.`)
    if (!apply) return dryRun(plan)
    saveEvidence(`forgotten-${readerLetter(serial)}`, existing)
    await repo.unlinkDevice(existing.id)
    console.log(
      `✓ Unlinked. Restore with: register --reader ${readerLetter(serial)} --apply --as ${agent}\n`
    )
    return
  }
  if (existing)
    fail(`Reader ${readerLetter(serial)} is already linked (id ${existing.id})`)
  const name =
    readerLetter(serial) === 'A' ? 'Device A (test)' : 'Device B (test)'
  const plan = `link reader ${readerLetter(serial)} to Titan again as "${name}"`
  console.log(`${plan}.`)
  if (!apply) return dryRun(plan)
  const device = await repo.registerDevice(TITAN_GYM_ID, {
    deviceSerial: serial,
    deviceName: name,
    timezoneOffsetMinutes: SLT_OFFSET_MINUTES,
  })
  console.log(
    `✓ Linked: new id ${device.id}. Every member's next push will include it.\n`
  )
}

// ============================================================
// burst / soak
// ============================================================

async function burst(): Promise<void> {
  gate()
  const kind = positional
  const count = Number(arg('count') ?? 0)
  if (!(count >= 2 && count <= 200)) fail('--count must be 2–200')

  if (kind === 'sync') {
    if (!flag('approved')) {
      fail(
        'burst sync loads a real reader. Pass --approved only when the owner approved this run (the lead names it in your brief).'
      )
    }
    const member = await hwMember(arg('member'))
    const force = flag('force')
    const plan = `${count} concurrent ${force ? 'forced ' : ''}pushes for ${member.name}${usingStub() ? ' (STUB)' : ' against the REAL readers'}`
    console.log(`${plan}.`)
    if (!apply) return dryRun(plan)
    const sync = new SyncMemberAccess(sessionRepository(), provider)
    const started = Date.now()
    const outcomes = await Promise.allSettled(
      Array.from({ length: count }, () =>
        sync.execute({ memberId: member.id, ...(force ? { force: true } : {}) })
      )
    )
    const sent = outcomes.reduce(
      (n, o) => n + (o.status === 'fulfilled' ? o.value.commandsSent : 0),
      0
    )
    const failures = outcomes.filter(
      (o) => o.status === 'rejected' || o.value.failures.length
    ).length
    console.log(
      `✓ ${count} pushes in ${Date.now() - started}ms: ${sent} commands sent, ${failures} with failures.`
    )
    return
  }

  if (kind === 'webhook' || kind === 'api') {
    const results: number[] = []
    const started = Date.now()
    const one =
      kind === 'webhook' ? () => postWebhook(true) : () => apiRequest(true)
    if (!apply)
      return dryRun(`send ${count} concurrent ${kind} requests to ${DEV_URL}`)
    await requireDevServer()
    const settled = await Promise.allSettled(
      Array.from({ length: count }, () => one())
    )
    for (const s of settled)
      results.push(s.status === 'fulfilled' ? s.value : -1)
    const byStatus: Record<string, number> = {}
    results.forEach(
      (r) => (byStatus[String(r)] = (byStatus[String(r)] ?? 0) + 1)
    )
    console.log(
      `✓ ${count} ${kind} requests in ${Date.now() - started}ms — by status: ${JSON.stringify(byStatus)} (-1 = network error)`
    )
    return
  }
  fail('burst needs: sync, webhook or api')
}

/**
 * SOAK-01 without a person: an hour of forced re-sends for one member and a
 * remote door open every third cycle, each checked end to end — the commands
 * collected by both readers, the open's event 8 back through the webhook.
 */
async function soak(): Promise<void> {
  gate()
  const minutes = Number(arg('minutes') ?? 60)
  const member = await hwMember(arg('member') ?? '10')
  const subject = subjectOf(member)
  if (!subject) fail(`${member.name} has no subject yet`)
  const plan = `soak for ${minutes} min: forced re-send of ${member.name} every 3 min, a door open every 9 min (alternating A/B)`
  console.log(`${plan}.`)
  if (!apply) return dryRun(plan)

  const repo = sessionRepository()
  const sync = new SyncMemberAccess(repo, provider)
  const operateDevice = new OperateDevice(repo, provider)
  const log = saveEvidence('soak-start', {
    at: new Date().toISOString(),
    member: member.name,
    minutes,
  })
  const lines: unknown[] = []
  const deadCount = async () =>
    (
      await supabase
        .from('access_sync_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', AccessSyncStatus.Dead)
    ).count ?? -1
  const deadAtStart = await deadCount()
  const end = Date.now() + minutes * 60_000
  let cycle = 0
  const totals = {
    pushes: 0,
    commandsSent: 0,
    collected: 0,
    notCollected: 0,
    opens: 0,
    opensSeen: 0,
    errors: 0,
    maxLatencyS: 0,
  }

  while (Date.now() < end) {
    cycle += 1
    const cycleStart = new Date()
    const entry: Record<string, unknown> = {
      cycle,
      at: cycleStart.toISOString(),
    }
    try {
      const result = await sync.execute({ memberId: member.id, force: true })
      totals.pushes += 1
      totals.commandsSent += result.commandsSent
      entry.push = {
        sent: result.commandsSent,
        failures: result.failures.length,
      }
      let openedOn: string | null = null
      if (cycle % 3 === 1) {
        openedOn = cycle % 2 === 1 ? READERS.A : READERS.B
        await operateDevice.openDoor({
          gymId: TITAN_GYM_ID,
          deviceId: await deviceIdFor(openedOn),
          actorId: 'hw-session:soak',
        })
        totals.opens += 1
        entry.open = readerLetter(openedOn)
      }
      await wait(90_000)
      for (const serial of Object.values(READERS)) {
        const mine = (await vendorQueue(serial)).filter(
          (q) =>
            q.commit &&
            q.commit.getTime() >= cycleStart.getTime() - 60_000 &&
            mentionsSubject(q, [subject.subject_id])
        )
        const done = mine.filter((q) => queueState(q) === 'DONE')
        totals.collected += done.length
        totals.notCollected += mine.length - done.length
        for (const q of done) {
          if (q.trans && q.commit)
            totals.maxLatencyS = Math.max(
              totals.maxLatencyS,
              Math.round((q.trans.getTime() - q.commit.getTime()) / 1000)
            )
        }
        entry[readerLetter(serial)] = `${done.length}/${mine.length} collected`
      }
      if (openedOn) {
        const { data } = await supabase
          .from('access_events')
          .select('id')
          .eq('gym_id', TITAN_GYM_ID)
          .eq('device_serial', openedOn)
          .eq('event_code', 8)
          .gte('created_at', cycleStart.toISOString())
        const seen = (data ?? []).length > 0
        if (seen) totals.opensSeen += 1
        entry.event8 = seen
      }
      entry.dead = await deadCount()
    } catch (error) {
      totals.errors += 1
      entry.error = error instanceof Error ? error.message : String(error)
    }
    lines.push(entry)
    console.log(`  ${slt(new Date()).slice(11)}  ${JSON.stringify(entry)}`)
    const sleep = cycleStart.getTime() + 180_000 - Date.now()
    if (sleep > 0 && Date.now() + sleep < end) await wait(sleep)
  }

  const deadAtEnd = await deadCount()
  const summary = { ...totals, cycles: cycle, deadAtStart, deadAtEnd }
  const path = saveEvidence('soak', { start: log, summary, lines })
  console.log(
    `\n✓ Soak finished: ${JSON.stringify(summary)}\nEvidence: ${path}\n`
  )
}

// ============================================================
// stub — a fake vendor on this machine
// ============================================================

const STUB_MODES = [
  'ok',
  'validation',
  '500',
  '500bare',
  '502',
  '429',
  'slow',
  'hang',
  'garbage',
  'bizfail',
  'auth',
] as const

function stub(): void {
  gate()
  if (flag('help') || !arg('port')) {
    console.log(`stub --port P --mode M [--delay MS]   (127.0.0.1 only; runs until stopped)
  ok          every command succeeds ({"message":"success"}); reads return []
  validation  500 {"message":"Validation error"} — the vendor's benign "already so"
  500         500 {"message":"Internal Server Error"} — a 500 that names a reason (our rule: permanent)
  500bare     500 with an empty body — the bare 500 our rule retries
  502 | 429   that HTTP status on every command (sign-in still works)
  slow        every command succeeds after --delay ms (default 12000; our client gives up at 15000)
  hang        commands never answer (our client times out)
  garbage     200 with an HTML body
  bizfail     200 {"message":"failed: invalid subject"} — valid HTTP, failed business result
  auth        sign-in AND every command answer 401 (credentials revoked)
Switch live: curl -X POST "http://127.0.0.1:P/__mode?m=500". Log: stub-log --port P.`)
    return
  }
  const port = Number(arg('port'))
  let mode = (arg('mode') ?? 'ok') as (typeof STUB_MODES)[number]
  const delay = Number(arg('delay') ?? 12_000)
  if (!(STUB_MODES as readonly string[]).includes(mode))
    fail(`--mode one of: ${STUB_MODES.join(', ')}`)
  const logPath = resolve(EVIDENCE_DIR, `stub-${port}.jsonl`)
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(logPath, '')
  writeFileSync(resolve(EVIDENCE_DIR, `stub-${port}.pid`), String(process.pid))

  createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => (body += chunk))
    request.on('end', () => {
      const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
      if (url.pathname === '/__mode') {
        mode = (url.searchParams.get('m') ?? mode) as typeof mode
        response.end(JSON.stringify({ mode }))
        return
      }
      const isSignIn = url.pathname.startsWith('/api/user')
      writeFileSync(
        logPath,
        JSON.stringify({
          at: new Date().toISOString(),
          mode,
          method: request.method,
          path: url.pathname,
          query: url.search,
          body: body.slice(0, 500),
        }) + '\n',
        { flag: 'a' }
      )
      const send = (
        status: number,
        payload: string,
        type = 'application/json'
      ) => {
        response.writeHead(status, { 'content-type': type })
        response.end(payload)
      }
      if (mode === 'auth') return send(401, '{"message":"Unauthorized"}')
      if (isSignIn) return send(200, JSON.stringify({ token: 'stub-token' }))
      if (request.method === 'GET') return send(200, '[]')
      switch (mode) {
        case 'ok':
          return send(200, '{"message":"success"}')
        case 'validation':
          return send(500, '{"message":"Validation error"}')
        case '500':
          return send(500, '{"message":"Internal Server Error"}')
        case '500bare':
          return send(500, '')
        case '502':
          return send(502, '<html>Bad Gateway</html>', 'text/html')
        case '429':
          return send(429, '{"message":"Too Many Requests"}')
        case 'slow':
          setTimeout(() => send(200, '{"message":"success"}'), delay)
          return
        case 'hang':
          return
        case 'garbage':
          return send(200, '<html><body>maintenance</body></html>', 'text/html')
        case 'bizfail':
          return send(200, '{"message":"failed: invalid subject"}')
        default:
          return send(200, '{"message":"success"}')
      }
    })
  }).listen(port, '127.0.0.1', () => {
    console.log(
      `Stub vendor on http://127.0.0.1:${port}, mode ${mode}. Log: ${logPath}. Ctrl-C (or stop the background task) to end.`
    )
  })
}

/** Switch a running stub's mode (instead of a hand-written curl). */
async function stubMode(): Promise<void> {
  gate()
  const port = Number(arg('port'))
  const mode = arg('mode') ?? ''
  if (!(STUB_MODES as readonly string[]).includes(mode))
    fail(`--mode one of: ${STUB_MODES.join(', ')}`)
  const response = await fetch(`http://127.0.0.1:${port}/__mode?m=${mode}`, {
    method: 'POST',
    signal: AbortSignal.timeout(5_000),
  })
  console.log(`✓ Stub on ${port}: ${await response.text()}`)
}

function stubStop(): void {
  gate()
  const port = Number(arg('port'))
  const pidPath = resolve(EVIDENCE_DIR, `stub-${port}.pid`)
  if (!existsSync(pidPath)) fail(`No stub pid file for port ${port}`)
  const pid = Number(readFileSync(pidPath, 'utf8'))
  try {
    process.kill(pid, 'SIGTERM')
    console.log(`✓ Stopped the stub on ${port} (pid ${pid}).`)
  } catch {
    console.log(`The stub on ${port} (pid ${pid}) was not running.`)
  }
}

function stubLog(): void {
  gate()
  const port = Number(arg('port'))
  const path = resolve(EVIDENCE_DIR, `stub-${port}.jsonl`)
  if (!existsSync(path)) fail(`No stub log for port ${port}`)
  const entries = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(
      (l) =>
        JSON.parse(l) as {
          at: string
          mode: string
          method: string
          path: string
          query: string
          body: string
        }
    )
  const since = arg('since') ? parseSince(arg('since'), '10m') : null
  const shown = entries.filter((e) => !since || new Date(e.at) >= since)
  table(
    ['At (SLT)', 'Mode', 'Method', 'Path', 'Query / body'],
    shown.slice(-Number(arg('tail') ?? 40)).map((e) => [
      slt(e.at).slice(11),
      e.mode,
      e.method,
      e.path,
      // A stub's recorded query/body can carry what a caller sent it, including
      // a credential (remote day F-15), so it goes through the same filter as
      // everything else this console prints.
      redact(e.query || e.body).slice(0, 60),
    ])
  )
  const commands = shown.filter(
    (e) => !e.path.startsWith('/api/user') && e.method !== 'GET'
  )
  console.log(
    `\n  ${shown.length} request(s), ${commands.length} command(s) (non-sign-in, non-GET).\n`
  )
}

// ============================================================
// Desk: the local dev server and the E2E gyms
// ============================================================

async function devServerUp(): Promise<boolean> {
  try {
    const response = await fetch(`${DEV_URL}/login`, {
      signal: AbortSignal.timeout(60_000),
      redirect: 'manual',
    })
    return response.status < 500
  } catch {
    return false
  }
}

async function requireDevServer(): Promise<void> {
  if (!(await devServerUp()))
    fail(
      `The dev server is not answering on ${DEV_URL}. The lead starts it: devserver start --as lead`
    )
}

async function devserver(): Promise<void> {
  const action = positional || 'status'
  gate(scopeOf('devserver', action))
  if (action === 'start') {
    if (await devServerUp()) {
      console.log(`Already answering on ${DEV_URL}.`)
      return
    }
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    const out = openSync(DEV_LOG, 'a')
    // The mock provider, whatever .env.local says: the desk never reaches VFT.
    // Webpack, not Turbopack: on 2026-10-07 Turbopack's next/font/google
    // resolution failed on this machine ("queries have exactly one entry") and
    // every page answered 500. The desk tests do not depend on the bundler.
    const child = spawn(
      'npx',
      ['next', 'dev', '--webpack', '-p', String(DEV_PORT)],
      {
        detached: true,
        stdio: ['ignore', out, out],
        env: { ...process.env, ACCESS_CONTROL_ENABLED: 'false' },
      }
    )
    child.unref()
    writeFileSync(DEV_PID, String(child.pid))
    console.log(
      `Started next dev --webpack (pid ${child.pid}, ACCESS_CONTROL_ENABLED=false) → ${DEV_LOG}. Waiting for it…`
    )
    for (let i = 0; i < 24; i += 1) {
      await wait(5_000)
      if (await devServerUp()) {
        console.log(`✓ Answering on ${DEV_URL}.`)
        return
      }
    }
    fail('It did not answer within two minutes — read devserver log.')
  }
  if (action === 'stop') {
    if (!existsSync(DEV_PID))
      fail('No pid file — was it started with devserver start?')
    const pid = Number(readFileSync(DEV_PID, 'utf8'))
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      process.kill(pid, 'SIGTERM')
    }
    console.log(`✓ Stopped pid ${pid}.`)
    return
  }
  if (action === 'log') {
    if (!existsSync(DEV_LOG)) fail('No dev server log yet')
    const needle = arg('grep')
    // Colour codes stripped; a match that opens an object (`… {`) brings the
    // whole block, because the delivery trace prints its counts one per line.
    const all = readFileSync(DEV_LOG, 'utf8')
      .replace(/\x1b\[[0-9;]*m/g, '')
      .split('\n')
    const blocks: string[] = []
    for (let i = 0; i < all.length; i += 1) {
      if (needle && !all[i].includes(needle)) continue
      let block = all[i]
      if (/\{\s*$/.test(all[i])) {
        while (i + 1 < all.length && !/^\}/.test(all[i])) {
          i += 1
          block += `\n${all[i]}`
        }
      }
      blocks.push(block)
    }
    console.log(redact(blocks.slice(-Number(arg('tail') ?? 40)).join('\n')))
    return
  }
  console.log(
    (await devServerUp())
      ? `✓ Answering on ${DEV_URL}.`
      : `Not answering on ${DEV_URL}.`
  )
}

type DeskUser = 'enterprise' | 'lite' | 'anon' | 'tampered' | 'expired'

async function cookiesFor(user: DeskUser): Promise<string> {
  if (user === 'anon') return ''
  const base = user === 'tampered' || user === 'expired' ? 'enterprise' : user
  const path = resolve(COOKIE_DIR, `${base}.txt`)
  let cookie = existsSync(path) ? readFileSync(path, 'utf8') : ''
  if (!cookie || flag('relogin')) {
    const email = requireEnv(
      base === 'enterprise' ? 'E2E_ENTERPRISE_GYM_EMAIL' : 'E2E_LITE_GYM_EMAIL'
    )
    const password = requireEnv(
      base === 'enterprise'
        ? 'E2E_ENTERPRISE_GYM_PASSWORD'
        : 'E2E_LITE_GYM_PASSWORD'
    )
    const response = await fetch(`${DEV_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    })
    if (response.status !== 200)
      fail(`Login as the E2E ${base} gym answered ${response.status}`)
    cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    mkdirSync(COOKIE_DIR, { recursive: true })
    writeFileSync(path, cookie, { mode: 0o600 })
  }
  // `tampered`: the cookie itself is garbage (a corrupted browser store).
  // `expired`: a well-formed session whose token no longer verifies and whose
  // refresh token is dead — what a real expired session looks like.
  if (user === 'tampered')
    return cookie.replace(/=([^;]{12})[^;]*/g, '=$1xxxxxxxxxxxx')
  if (user === 'expired') return expiredSession(cookie)
  return cookie
}

function expiredSession(cookie: string): string {
  const pairs = cookie
    .split('; ')
    .map(
      (c) => [c.slice(0, c.indexOf('=')), c.slice(c.indexOf('=') + 1)] as const
    )
  const auth = pairs
    .filter(([name]) => /^sb-.+-auth-token(\.\d+)?$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  if (!auth.length) fail('No Supabase session cookie to expire')
  const baseName = auth[0][0].replace(/\.\d+$/, '')
  const raw = auth.map(([, v]) => v).join('')
  if (!raw.startsWith('base64-'))
    fail('Unrecognised Supabase cookie format; use --user tampered')
  const session = JSON.parse(
    Buffer.from(raw.slice(7), 'base64url').toString('utf8')
  ) as Record<string, unknown>
  const token = String(session.access_token ?? '')
  session.access_token = `${token.slice(0, -12)}AAAAAAAAAAAA`
  session.refresh_token = 'hw-session-dead-refresh-token'
  session.expires_at = Math.floor(Date.now() / 1000) - 3600
  const rebuilt = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
  const others = pairs.filter(
    ([name]) => !/^sb-.+-auth-token(\.\d+)?$/.test(name)
  )
  return [
    ...others.map(([n, v]) => `${n}=${v}`),
    `${baseName}=${rebuilt}`,
  ].join('; ')
}

/**
 * The request body: `--body`, `--body-file`, or `--body-gen <kind>` for the
 * shapes too large to type. `{{E2E_ENTERPRISE_EMAIL}}` is filled from
 * `.env.local`, so no agent ever reads that file.
 */
function deskBody(): string | undefined {
  const generated: Record<string, () => string> = {
    'long-name': () => JSON.stringify({ deviceName: 'x'.repeat(10_000) }),
    big: () =>
      JSON.stringify({
        deviceSerial: 'HWBIG0001',
        deviceName: 'x'.repeat(2_000_000),
      }),
  }
  const kind = arg('body-gen')
  if (kind && !(kind in generated))
    fail(`--body-gen one of: ${Object.keys(generated).join(', ')}`)
  const raw = kind
    ? generated[kind]()
    : arg('body-file')
      ? readFileSync(arg('body-file')!, 'utf8')
      : arg('body')
  return raw
    ?.split('{{E2E_ENTERPRISE_EMAIL}}')
    .join(process.env.E2E_ENTERPRISE_GYM_EMAIL ?? '')
}

/**
 * A request that keeps the cached session current. Supabase rotates refresh
 * tokens: once the server refreshes a session it answers with new cookies and
 * the old refresh token dies, so a jar that ignored Set-Cookie would start
 * failing about an hour into a run.
 */
async function fetchWithJar(
  user: DeskUser,
  url: string,
  init: RequestInit
): Promise<Response> {
  const response = await fetch(url, init)
  if (user !== 'enterprise' && user !== 'lite') return response
  const fresh = response.headers.getSetCookie()
  if (!fresh.length) return response
  const path = resolve(COOKIE_DIR, `${user}.txt`)
  const jar = new Map(
    (existsSync(path) ? readFileSync(path, 'utf8') : '')
      .split('; ')
      .filter(Boolean)
      .map(
        (c) =>
          [c.slice(0, c.indexOf('=')), c.slice(c.indexOf('=') + 1)] as [
            string,
            string,
          ]
      )
  )
  for (const header of fresh) {
    const [pair, ...attributes] = header.split(';')
    const name = pair.slice(0, pair.indexOf('=')).trim()
    const value = pair.slice(pair.indexOf('=') + 1).trim()
    const expired =
      attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === ''
    if (expired) jar.delete(name)
    else jar.set(name, value)
  }
  writeFileSync(path, [...jar].map(([n, v]) => `${n}=${v}`).join('; '), {
    mode: 0o600,
  })
  return response
}

/** One request to the local dev server. Returns the status. */
async function apiRequest(quiet = false): Promise<number> {
  const method = (positional === 'api' ? positional2 : positional).toUpperCase()
  const path = command === 'burst' ? (arg('path') ?? '') : positional2
  const httpMethod =
    command === 'burst' ? (arg('method') ?? 'GET').toUpperCase() : method
  if (!path.startsWith('/'))
    fail('Give a path: api GET /api/access-control/devices --user enterprise')
  if (
    !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(httpMethod)
  )
    fail(`Unknown method ${httpMethod}`)
  const user = (arg('user') ?? 'enterprise') as DeskUser
  if (!['enterprise', 'lite', 'anon', 'tampered', 'expired'].includes(user))
    fail('--user enterprise|lite|anon|tampered|expired')
  const headers: Record<string, string> = {}
  const cookie = await cookiesFor(user)
  if (cookie) headers.cookie = cookie
  const bodyText = deskBody()
  // `--no-content-type` sends the body as raw bytes with no header at all
  // (a string body would make fetch add text/plain on its own).
  const noContentType = flag('no-content-type')
  const body =
    bodyText === undefined
      ? undefined
      : noContentType
        ? new TextEncoder().encode(bodyText)
        : bodyText
  if (bodyText !== undefined && !noContentType)
    headers['content-type'] = arg('content-type') ?? 'application/json'
  for (const h of args('header')) {
    const [k, ...v] = h.split(':')
    headers[k.trim()] = v.join(':').trim()
  }
  const started = Date.now()
  const response = await fetchWithJar(user, `${DEV_URL}${path}`, {
    method: httpMethod,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(60_000),
  })
  const text = await response.text()
  if (!quiet) {
    console.log(
      `${httpMethod} ${path} as ${user} → ${response.status} in ${Date.now() - started}ms${response.headers.get('location') ? ` → ${response.headers.get('location')}` : ''}`
    )
    console.log(
      `  content-type: ${response.headers.get('content-type') ?? '—'}`
    )
    const find = arg('find')
    if (find) {
      // Pages are large: report whether a phrase is there, and its context.
      const at = text.toLowerCase().indexOf(find.toLowerCase())
      console.log(
        at === -1
          ? `  "${find}": NOT FOUND in ${text.length} chars`
          : `  "${find}": found — …${redact(text.slice(Math.max(0, at - 120), at + 200)).replace(/\s+/g, ' ')}…`
      )
    } else {
      console.log(redact(text.slice(0, Number(arg('max') ?? 1500))))
    }
  }
  return response.status
}

async function api(): Promise<void> {
  gate()
  await requireDevServer()
  await apiRequest()
}

/** A serial the desk may post as: an E2E reader, or one nobody has registered. */
async function webhookSerial(): Promise<string> {
  if (flag('unknown')) return `HWUNKNOWN${Date.now().toString().slice(-6)}`
  const serial = (arg('serial') ?? '').trim()
  if (!serial) fail('--serial <an E2E reader serial> or --unknown')
  return checkDeskSerial(serial)
}

async function checkDeskSerial(serial: string): Promise<string> {
  if (
    (Object.values(READERS) as string[]).includes(serial.trim().toUpperCase())
  ) {
    fail(
      'REFUSED: that is a Titan reader. A synthetic scan would corrupt its presence and clock records (it did once).'
    )
  }
  const { data } = await supabase
    .from('access_devices')
    .select('gym_id, device_serial')
    .ilike('device_serial', serial.trim())
  const owners = (data ?? []).map((d) => d.gym_id as string)
  if (owners.some((g) => !Object.values(E2E_GYMS).includes(g as never))) {
    fail('REFUSED: that serial belongs to a gym other than the E2E gyms.')
  }
  return serial
}

/** POST one delivery to the local webhook. Returns the status. */
async function postWebhook(quiet = false): Promise<number> {
  const good = requireEnv('ACCESS_CONTROL_WEBHOOK_TOKEN')
  const tokenKind = arg('token') ?? 'good'
  const token = {
    good,
    wrong: 'f'.repeat(good.length),
    empty: '',
    short: good.slice(0, 16),
  }[tokenKind as 'good']
  if (token === undefined) fail('--token good|wrong|empty|short')
  let body: string
  let serial = '(from file)'
  const kind = arg('body-gen')
  if (kind) {
    serial = await webhookSerial()
    const time = slt(new Date())
    const generated: Record<string, () => unknown> = {
      'bad-event': () => [{ foo: 'bar', DeviceID: serial }],
      huge: () =>
        Array.from({ length: 5_000 }, (_, i) => ({
          EmpId: String(99990000 + i),
          AttTime: time,
          DeviceID: serial,
          Event: '0',
        })),
      'claims-titan': () => [
        {
          EmpId: '99999905',
          AttTime: time,
          DeviceID: serial,
          Event: '0',
          GymId: TITAN_GYM_ID,
          gym_id: TITAN_GYM_ID,
        },
      ],
    }
    if (!(kind in generated))
      fail(`--body-gen one of: ${Object.keys(generated).join(', ')}`)
    body = JSON.stringify(generated[kind]())
  } else if (arg('body-file')) {
    body = readFileSync(arg('body-file')!, 'utf8')
    // A file can name any serial; every one it names passes the same fence.
    for (const named of body.matchAll(/"DeviceID"\s*:\s*"([^"]*)"/g)) {
      await checkDeskSerial(named[1])
    }
  } else {
    serial = await webhookSerial()
    // `--events N` sends N DISTINCT scans (one second apart, newest first);
    // `--same N` sends one scan N times in a single delivery.
    const base = arg('time')
      ? new Date(`${arg('time')!.replace(' ', 'T')}Z`)
      : new Date(Date.now() + SLT_OFFSET_MINUTES * 60_000)
    const at = (offsetSeconds: number) =>
      new Date(base.getTime() - offsetSeconds * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19)
    const event = (offsetSeconds: number) => ({
      EmpId: String(arg('subject') ?? '99999901'),
      AttTime: at(offsetSeconds),
      DeviceID: serial,
      CheckingStatus: '0',
      VerifyType: String(arg('verify') ?? '1'),
      Event: String(arg('event') ?? '0'),
    })
    const same = Number(arg('same') ?? 0)
    body = JSON.stringify(
      same > 0
        ? Array.from({ length: same }, () => event(0))
        : Array.from({ length: Number(arg('events') ?? 1) }, (_, i) => event(i))
    )
  }
  const repeat = command === 'burst' ? 1 : Number(arg('repeat') ?? 1)
  let status = 0
  for (let i = 0; i < repeat; i += 1) {
    const response = await fetch(
      `${DEV_URL}/api/webhooks/access-control/${token}`,
      {
        method: 'POST',
        headers: { 'content-type': arg('content-type') ?? 'application/json' },
        body,
        signal: AbortSignal.timeout(60_000),
      }
    )
    status = response.status
    const text = await response.text()
    if (!quiet)
      console.log(
        `POST webhook (token ${tokenKind}, serial ${serial}${repeat > 1 ? `, #${i + 1}` : ''}) → ${status}  ${redact(text.slice(0, 300))}`
      )
  }
  if (!quiet)
    console.log(
      '  Next: devserver log --grep "Access webhook delivery" --as api\n'
    )
  return status
}

async function webhook(): Promise<void> {
  gate()
  if (arg('body-file') && !arg('body-gen')) {
    for (const named of readFileSync(arg('body-file')!, 'utf8').matchAll(
      /"DeviceID"\s*:\s*"([^"]*)"/g
    )) {
      await checkDeskSerial(named[1])
    }
  } else {
    await webhookSerial()
  }
  await requireDevServer()
  if (!apply)
    return dryRun(
      `POST ${arg('repeat') ?? 1} delivery(ies) to the LOCAL webhook`
    )
  await postWebhook()
}

async function tier(): Promise<void> {
  gate()
  const which = (arg('gym') ?? '') as E2EGym
  if (!(which in E2E_GYMS))
    fail('--gym enterprise|lite (the E2E gyms; nothing else)')
  const gymId = E2E_GYMS[which]
  const originals = resolve(EVIDENCE_DIR, 'tier-original.json')
  const { data, error } = await supabase
    .from('gyms')
    .select('subscription_tier, subscription_status')
    .eq('id', gymId)
    .single()
  if (error) fail(error.message)
  console.log(
    `E2E ${which} gym: tier ${data.subscription_tier}, status ${data.subscription_status}`
  )
  const saved = existsSync(originals)
    ? (JSON.parse(readFileSync(originals, 'utf8')) as Record<
        string,
        { subscription_tier: string; subscription_status: string }
      >)
    : {}
  let patch: { subscription_tier?: string; subscription_status?: string }
  if (flag('restore')) {
    if (!saved[which]) fail('Nothing saved to restore')
    patch = saved[which]
  } else {
    patch = {}
    if (arg('to')) patch.subscription_tier = arg('to')
    if (arg('status')) patch.subscription_status = arg('status')
    if (!Object.keys(patch).length) return
  }
  if (!apply)
    return dryRun(`set ${JSON.stringify(patch)} on the E2E ${which} gym`)
  if (!saved[which]) {
    saved[which] = {
      subscription_tier: data.subscription_tier,
      subscription_status: data.subscription_status,
    }
    writeFileSync(originals, JSON.stringify(saved, null, 2))
  }
  const { error: updateError } = await supabase
    .from('gyms')
    .update(patch)
    .eq('id', gymId)
  if (updateError) fail(updateError.message)
  console.log(
    `✓ E2E ${which} gym now ${JSON.stringify(patch)}${flag('restore') ? ' (restored)' : `. Restore: tier --gym ${which} --restore --apply --as ${agent}`}\n`
  )
}

async function e2eAccount(): Promise<void> {
  gate()
  const { data, error } = await supabase
    .from('access_control_accounts')
    .select('gym_id, is_active')
    .in('gym_id', Object.values(E2E_GYMS))
  if (error) fail(error.message)
  for (const row of data ?? []) {
    const name = Object.entries(E2E_GYMS).find(
      ([, id]) => id === row.gym_id
    )?.[0]
    console.log(
      `  E2E ${name} gym vendor account: is_active ${row.is_active}${row.is_active ? '   ← MUST be false: production would push its members to the real vendor' : ''}`
    )
  }
  // A gym with no row prints nothing above, which reads as "not checked".
  // Saying so is the difference between "no account" and "this printed
  // nothing" (remote day F-17).
  const present = new Set((data ?? []).map((row) => row.gym_id))
  for (const [name, id] of Object.entries(E2E_GYMS)) {
    if (!present.has(id)) console.log(`  E2E ${name} gym vendor account: none`)
  }
  if (!flag('deactivate')) return
  if (!apply)
    return dryRun("set is_active=false on the E2E gyms' vendor accounts")
  const { error: updateError } = await supabase
    .from('access_control_accounts')
    .update({ is_active: false })
    .in('gym_id', Object.values(E2E_GYMS))
  if (updateError) fail(updateError.message)
  console.log('✓ Deactivated.\n')
}

// ============================================================
// coverage — offline proof that the runbook is complete and conflict-free
// ============================================================

function coverage(): void {
  const catalogue = readFileSync(CATALOGUE_PATH, 'utf8')
  const ids = [
    ...catalogue.matchAll(/^\|\s*`([A-Z0-9.]+(?:-\d+)?)`\s*\|/gm),
  ].map((m) => m[1])
  const unique = new Set(ids)
  const problems: string[] = []
  if (unique.size !== ids.length)
    problems.push('The catalogue lists a case id twice')

  const runbook = loadRunbook()
  const taskById = new Map(runbook.tasks.map((t) => [t.id, t]))
  if (taskById.size !== runbook.tasks.length)
    problems.push('Two tasks share an id')

  // 1. Every case exactly one disposition, and a task that claims it.
  const mapped = runbook.coverage
  for (const id of ids)
    if (!(id in mapped)) problems.push(`case ${id}: no disposition`)
  for (const id of Object.keys(mapped))
    if (!unique.has(id))
      problems.push(`case ${id}: mapped but not in the catalogue`)
  for (const [id, d] of Object.entries(mapped)) {
    if (!d.startsWith('task:')) continue
    const task = taskById.get(d.slice(5))
    if (!task) problems.push(`case ${id}: mapped to missing task ${d}`)
    else if (!task.cases.includes(id))
      problems.push(`case ${id}: ${task.id}.cases omits it`)
  }
  const claimed = new Map<string, string>()
  for (const t of runbook.tasks) {
    for (const c of t.cases) {
      if (claimed.has(c))
        problems.push(`case ${c}: claimed by ${claimed.get(c)} and ${t.id}`)
      claimed.set(c, t.id)
      if (mapped[c] !== `task:${t.id}`)
        problems.push(
          `case ${c}: in ${t.id}.cases but mapped to "${mapped[c]}"`
        )
      if (!t.pass.some((p) => p.includes(`[${c}]`)))
        problems.push(`case ${c}: ${t.id} has no pass criterion tagged [${c}]`)
    }
  }

  // 2. The simulator plan: every item settled by a task, or explicitly not.
  const sims = runbook.simulatorPlan
  for (const [sim, d] of Object.entries(sims)) {
    if (!d.startsWith('task:')) continue
    const task = taskById.get(d.slice(5))
    if (!task) problems.push(`sim ${sim}: mapped to missing task ${d}`)
    else if (!task.sim.includes(sim))
      problems.push(`sim ${sim}: ${task.id}.sim omits it`)
  }
  for (const t of runbook.tasks) {
    for (const s of t.sim) {
      if (!(s in sims))
        problems.push(`sim ${s}: in ${t.id}.sim but not in the simulator plan`)
      else if (sims[s] !== `task:${t.id}`)
        problems.push(`sim ${s}: in ${t.id}.sim but mapped to "${sims[s]}"`)
    }
  }

  // 3. Ownership and scope: what each step asks of the console, the console
  //    would grant — so agents running at once can never collide.
  for (const t of runbook.tasks) {
    if (!(AGENT_NAMES as readonly string[]).includes(t.agent))
      problems.push(`${t.id}: unknown agent ${t.agent}`)
    if ((t.track === 'physical') !== (t.agent === 'physical'))
      problems.push(`${t.id}: track/agent mismatch`)
    if (!t.pass.length) problems.push(`${t.id}: no pass criteria`)
    for (const d of t.depends_on)
      if (!taskById.has(d)) problems.push(`${t.id}: depends on missing ${d}`)
    const owned = ownedNumbers(t.agent, t.phase)
    for (const m of t.members) {
      const n = testNumber(m)
      if (n === null || !owned.includes(n))
        problems.push(
          `${t.id}: ${m} is not owned by ${t.agent} in the ${t.phase} phase`
        )
    }
    for (const step of t.steps) {
      // A step that expects REFUSED is proving the fence: it must name its
      // agent like any other, but it is meant to ask for what is not granted.
      const provesRefusal = /\bREFUSED\b/.test(step.expect ?? '')
      for (const line of (step.cmd ?? '').split(/&&|\n/)) {
        const match = line.match(/hw-session\.ts\s+([a-z0-9-]+)/)
        if (!match) continue
        const name = match[1]
        if (!(name in COMMANDS)) {
          problems.push(`${t.id}: unknown command "${name}"`)
          continue
        }
        if (!NO_AGENT_NEEDED.has(name) && !line.includes(`--as ${t.agent}`)) {
          problems.push(`${t.id}: "${name}" step lacks --as ${t.agent}`)
        }
        if (provesRefusal) continue
        const reason = refusal(scopeOf(name, line), t.agent, t.phase, name)
        if (reason)
          problems.push(`${t.id}: "${name}" would be refused — ${reason}`)
        // A step that moves the phase must be a legal move FROM the phase it
        // really starts in. `t.phase` is where the task runs, which for the
        // step that enters the physical phase is not where it starts: the
        // physical session begins in idle. Checking the destination's phase
        // let a gate that could never be passed ship (the visit could not start).
        const move = line.match(/\bphase\s+set\s+([a-z]+)/)
        if (name === 'phase' && move) {
          const to = move[1] as Phase
          const from: Phase = to === 'physical' ? 'idle' : t.phase
          const bad = (PHASES as readonly string[]).includes(to)
            ? phaseMoveRefusal(t.agent, from, to)
            : `unknown phase "${to}"`
          if (bad)
            problems.push(
              `${t.id}: "phase set ${to}" is not a legal move from ${from} — ${bad}`
            )
          // …and the command's own gate must let this agent through while the
          // phase is still `from` (the original defect: it only did so once the
          // phase was already physical).
          const gated = refusal('phase', t.agent, from, 'phase')
          if (gated)
            problems.push(
              `${t.id}: "phase set ${to}" is refused at its start (phase ${from}) — ${gated}`
            )
        }
        for (const m of line.matchAll(
          /--member2?\s+"?(?:HW Test )?(\d{1,2})"?/g
        )) {
          if (!owned.includes(Number(m[1])))
            problems.push(
              `${t.id}: "${name}" names HW Test ${m[1]}, not ${t.agent}'s in ${t.phase}`
            )
        }
      }
    }
  }

  const byKind: Record<string, number> = {}
  for (const d of Object.values(mapped)) {
    const kind = d.startsWith('task:')
      ? `${taskById.get(d.slice(5))?.track ?? '?'}`
      : d.split(':')[0]
    byKind[kind] = (byKind[kind] ?? 0) + 1
  }
  const simKinds: Record<string, number> = {}
  for (const d of Object.values(sims)) {
    const kind = d.startsWith('task:')
      ? `${taskById.get(d.slice(5))?.track ?? '?'}`
      : d.split(':')[0]
    simKinds[kind] = (simKinds[kind] ?? 0) + 1
  }

  console.log(
    `Catalogue cases: ${ids.length}   mapped: ${Object.keys(mapped).length}   by disposition: ${JSON.stringify(byKind)}`
  )
  console.log(
    `Simulator plan: ${Object.keys(sims).length} items   by disposition: ${JSON.stringify(simKinds)}`
  )
  console.log(
    `Tasks: ${runbook.tasks.length}   ${AGENT_NAMES.map((a) => `${a} ${runbook.tasks.filter((t) => t.agent === a).length}`).join(', ')}`
  )
  if (problems.length) {
    console.log(`\n✗ ${problems.length} problem(s):`)
    problems.forEach((p) => console.log(`  - ${p}`))
    process.exit(1)
  }
  console.log(
    `✓ Every case and simulator item has exactly one disposition; every step's command, member and scope is one the console grants its agent in its phase.`
  )
}

// ============================================================

const COMMANDS: Record<string, () => Promise<void> | void> = {
  help,
  phase: phaseCommand,
  task: printTask,
  tasks: listTasks,
  record,
  results,
  snapshot,
  'watch-events': watchEvents,
  'watch-queue': watchQueue,
  jobs,
  'create-members': createMembers,
  park,
  unpark,
  pay: memberChange,
  suspend: memberChange,
  cancel: memberChange,
  reactivate: memberChange,
  push,
  resend: push,
  rename,
  'set-dates': setDates,
  vendor,
  enrol,
  withdraw,
  race,
  ambiguous,
  drain,
  reconcile,
  reclaim,
  open: operate,
  reboot: operate,
  'free-space': freeSpace,
  capacity,
  forget: deviceLink,
  register: deviceLink,
  burst,
  soak,
  stub,
  'stub-log': stubLog,
  'stub-mode': stubMode,
  'stub-stop': stubStop,
  devserver,
  api,
  webhook,
  tier,
  'e2e-account': e2eAccount,
  coverage,
}

// `... | head` closes the pipe while we are still writing; that is the reader
// being done, not an error worth a stack trace (remote day F-15).
process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EPIPE') process.exit(0)
  throw e
})

const run = COMMANDS[command]
if (!run) {
  console.error(
    `Unknown command "${command}". One of: ${Object.keys(COMMANDS).join(', ')}`
  )
  process.exit(1)
}

Promise.resolve(run()).catch((error) => {
  console.error(
    `\n✗ ${redact(error instanceof Error ? error.message : String(error))}\n`
  )
  process.exit(1)
})
