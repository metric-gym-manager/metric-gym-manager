# Access Control Integration (VFT GYM API v2.0)

> On-demand reference. Not auto-injected.
> **Status:** PLAN — nothing in this document is implemented yet.
> **Scope:** biometric door/turnstile hardware integration, the Enterprise-tier
> differentiator already declared in the `PlanRestrictions` capability matrix
> (`accessControlHardware`).

---

## 1. Why this fits where it fits

Two things are already in place and this integration must slot into them rather
than invent new mechanisms:

| Existing | Consequence for this work |
| --- | --- |
| `accessControlHardware` is a live key in `PlanRestrictions` (Enterprise only), with `Subscription.hasAccessControlHardware()` and the `FeatureGate` component already wired | The tier gate is **not** new code. Every route and use case reads the matrix; no ad-hoc `tier === 'enterprise'` conditionals (rule 2.13 / R5). |
| `ISMSProvider` + `IStorageProvider` ports, each with a real provider, a Mock fallback, and a `factory.ts` that picks by env var | The vendor API gets the **same** treatment: `IAccessControlProvider` port, `VftAccessControlProvider`, `MockAccessControlProvider`. No VFT noun ever leaks past the port. |
| Member lifecycle is a strict state machine (`StatusConfig.VALID_TRANSITIONS`), expiry is immediate with **no grace period**, and `next_due_date` is the paid-through date | Door access is a *pure projection* of member state. It gets a pure domain function, not scattered branching. |

The single most important discovery in the vendor API is
`POST /api/devicecmd/validperiod?DevSN=&EmployeeId=&StartDate=&EndDate=`. It
lets us push the member's **paid-through window down to the device**, so the
turnstile enforces expiry by itself even if our sync is down or the gym's
internet is out. That makes valid-period the *primary* mechanism and
grant/block the *secondary* one for immediate events (suspension, cancellation).

---

## 2. What the vendor API actually gives us

Base URL is per-deployment; auth is a JWT from sign-in sent back as a header.

**Auth** — `POST /api/user/` `{email,password}` → `{token}`;
`GET /api/user/auth` validates; logout invalidates.

**Topology** — Areas (`/api/area`) group Devices (`/api/device`:
`DevSN`, `DevName`, `TimeZone` as a minutes offset e.g. `"330"`, `AreaID`,
`IsReboot`).

**Subjects** — the API calls them *employees*, at `/api/template*`
(`EmpId`, `EmpName`, `AreaID`). For us an "employee" is a gym **member**.
Templates (biometric enrolments) are pushed to devices with
`/api/template/syncall | syncone | syncsometoall | syncsometoone`.

**Access commands** — all under `/api/devicecmd/*`:
`validperiod`, `accessgrant`, `accessblock`, `dooropen`, `reboot`, `events`,
`enrollface`, `enrollfinger`, plus list/delete of queued commands.

**Raw escape hatch** — `POST /api/devicecmd` with
`{DevSN, Type:"General", Content:"<ZKTeco command string>"}` (e.g.
`DATA UPDATE user Pin=…\tStartTime=…\tEndTime=…`). We will **not** build on
raw command strings: they are unvalidated, untyped, and device-firmware
specific. The typed endpoints cover every flow we need.

**Inbound webhook** — the device platform POSTs an *array* of attendance
events to a URL we supply:

```json
[{ "EmpId": "168", "AttTime": "2024-01-15 08:30:15",
   "CheckingStatus": "0", "VerifyType": "1", "Event": "3",
   "DeviceID": "QEM1253800017" }]
```

### 2.1 The two properties that drive the whole design

1. **Commands are queued, not applied synchronously.** `/api/devicecmd/*` puts
   a command in a queue the device polls; `GET /api/devicecmd/{DevSN}` lists
   what is still pending. **HTTP 200 means "queued", not "the door knows".**
   Anything built as fire-and-forget will silently drift out of sync the first
   time a device is offline. → we need an **outbox + reconciliation loop**, not
   direct calls.
2. **Biometric enrolment is physical.** `enrollface` / `enrollfinger` put a
   *device* into enrolment mode for a subject; the member must walk up to it.
   There is no "upload a face image" endpoint, so the member photos we already
   hold in R2 **cannot** be converted into templates. The UI must say so.

---

## 3. Target architecture

The code splits across **two** homes, and getting the split right is the single
most consequential structural decision here (see §9 for the audit that produced
it).

### 3.0 Where the vendor client lives — `lib/`, not the feature

R8 is explicit: *"`src/lib/` = third-party glue **only** … If it wraps an
external service or framework, it belongs here."* The repo has two precedents
and they disagree, so this needs deciding rather than copying:

| Precedent | Port location | Implementation location |
| --- | --- | --- |
| **PayHere** (external HTTP gateway) | `lib/payhere/IPaymentGateway.ts` | `lib/payhere/PayHereGateway.ts` + `config.ts` + `crypto.ts` |
| **R2 storage** (external HTTP service) | `lib/storage/IStorageProvider.ts` | `lib/storage/R2StorageProvider.ts` + `MockStorageProvider.ts` |
| **SMS** (Text.lk) | `features/sms/services/ISMSProvider.ts` | `features/sms/services/providers/` |

Two of three — and the literal text of R8 — put **both the port and the vendor
implementation in `lib/`**. SMS is the outlier. PayHere is also the closest
analogue by shape: an external gateway with credentials, a crypto helper, and
domain use-cases that consume it from `features/subscriptions/services/`.

**Decision: follow the PayHere/R2 precedent.** The directory is
capability-named with the vendor named only in the implementation file — the
`lib/storage/` + `R2StorageProvider.ts` shape — so a second vendor drops in
without a rename:

```
src/lib/access-control/                # third-party glue (R8)
  IAccessControlProvider.ts            # PORT — vendor-neutral vocabulary
  VftAccessControlProvider.ts          # VFT GYM API v2.0 client
  MockAccessControlProvider.ts         # used whenever ACCESS_CONTROL_ENABLED != true
  config.ts                            # base URL, timeouts, env reads
  crypto.ts                            # AES-256-GCM for vendor credentials (cf. lib/payhere/crypto.ts)
  index.ts
  __tests__/                           # jest-conventional, per R9
```

Nothing in `lib/access-control/` may contain gym business rules — no member
statuses, no due-date maths, no tier checks. It speaks HTTP and nothing else.

### 3.1 The feature

```
src/features/access-control/           # ALL business logic (R1)
  config/AccessControlConfig.ts        # enums (AccessIntent, AccessSyncStatus,
                                       #   DevicePurpose, AccessDenialReason),
                                       #   retry/backoff, VerifyType/Event code maps  — R5 owner
  domain/
    AccessDecision.ts                  # ← the heart: pure, no I/O
    AccessDevice.ts
  services/
    IAccessControlRepository.ts
    SupabaseAccessControlRepository.ts
    SyncMemberAccess.ts                # one member → device commands
    SyncGymDevices.ts                  # pull/reconcile device inventory
    DrainAccessSyncQueue.ts            # outbox drainer (cron)
    ReconcileMemberAccess.ts           # daily re-assert (cron)
    RecordAccessEvents.ts              # webhook ingestion
    OperateDevice.ts                   # remote unlock / reboot
    factory.ts                         # R7 — the ONLY place the provider is wired
  schemas/access-control.schemas.ts    # Zod for OUR inputs *and* for vendor responses
  utils/
    serializeAccessDeviceForAPI.ts     # rule 2.11 — never hand a raw entity to JSON
    serializeAccessEventForAPI.ts
  components/                          # devices panel, member access panel, enrolment dialog
  types/index.ts
  tests/
  index.ts                             # R4 — MUST exist from the first commit or arch:check fails
```

Use-cases import the port from `@/lib/access-control`; the feature's
`factory.ts` is the only module that decides which implementation to construct,
exactly as `createSMSProvider` / `createStorageProvider` do today.

### 3.2 The port

Vendor-neutral on purpose — a future ZKTeco/Hikvision provider must drop in
without touching a use case. Note credentials are a parameter, not constructor
state: this is multi-tenant, one account per gym.

```ts
export interface IAccessControlProvider {
  getProviderName(): string
  isEnabled(): boolean

  listDevices(c: AccessCredentials): Promise<AccessDeviceInfo[]>
  registerDevice(c: AccessCredentials, d: NewDeviceInput): Promise<void>

  upsertSubject(c: AccessCredentials, s: SubjectInput): Promise<void>
  removeSubject(c: AccessCredentials, subjectId: string): Promise<void>
  syncSubjectsToDevice(c: AccessCredentials, serial: string, ids: string[]): Promise<void>

  setValidPeriod(c: AccessCredentials, p: ValidPeriodInput): Promise<void>
  grantAccess(c: AccessCredentials, t: SubjectOnDevice): Promise<void>
  blockAccess(c: AccessCredentials, t: SubjectOnDevice): Promise<void>

  startFaceEnrolment(c: AccessCredentials, t: SubjectOnDevice): Promise<void>
  startFingerEnrolment(c: AccessCredentials, t: SubjectOnDevice & { fingerId: number }): Promise<void>

  openDoor(c: AccessCredentials, serial: string): Promise<void>
  rebootDevice(c: AccessCredentials, serial: string): Promise<void>
  listPendingCommands(c: AccessCredentials, serial?: string): Promise<PendingCommand[]>
}
```

`VftAccessControlProvider` owns everything ugly: the `ApiToken` header (whose
casing the vendor docs contradict themselves on — send the documented casing
per endpoint, accept either), sign-in/refresh on 401, `YYYYMMDD` date
formatting, and **Zod-parsing every vendor response** rather than trusting its
shape (rule 2.2 / R13).

### 3.3 The domain core

```ts
// domain/AccessDecision.ts — pure, no I/O, exhaustively unit-tested
export function resolveAccessDecision(input: {
  status: MemberStatus
  membershipStartDate: Date
  nextDueDate: Date
  registrationSource: RegistrationSource
  verifiedAt: Date | null
  dayPassValidOn?: Date | null
}): { allowed: boolean; validFrom: Date | null; validTo: Date | null; reason: AccessDenialReason | null }
```

| Member state | Decision |
| --- | --- |
| `Active` | allow, `validFrom = membership_start_date`, `validTo = next_due_date` (paid-through, inclusive — matches the no-grace rule) |
| `Expired` | block (device self-expires anyway; we assert it) |
| `Suspended` | block **immediately** — this is the case that must not wait for a cron |
| `Cancelled` | block **and** remove the subject from devices |
| QR registration, `verified_at IS NULL` | block until the front desk verifies — a self-registered stranger must not get a door open |
| Day pass | allow for that day only (`validTo = today`) |

This function is the *only* place access policy exists. Everything else
transports its output.

---

## 4. Database schema

One migration, idempotent and replayable (R11).

```
access_control_accounts    gym_id UNIQUE, base_url, default_area_id, is_active,
                           last_verified_at, subject_id_strategy   -- NON-secret, gym-readable
access_control_secrets     account_id UNIQUE, email_ciphertext, password_ciphertext,
                           api_token_ciphertext, token_expires_at  -- service-role ONLY, no gym policies
access_devices             gym_id, device_serial, device_name, area_id, timezone_offset,
                           purpose('entry'|'exit'|'both'), is_active, last_seen_at, last_synced_at
member_access_subjects     gym_id, member_id UNIQUE, subject_id, face_enrolled,
                           finger_count, provisioned_at, last_synced_at, sync_state
access_sync_jobs           gym_id, member_id?, device_id?, intent, payload JSONB,
                           status('pending'|'in_flight'|'succeeded'|'failed'|'dead'),
                           attempts, next_attempt_at, last_error, provider_command_id
access_events              gym_id, member_id?, device_serial, subject_id, occurred_at,
                           direction, verify_type, event_code, raw JSONB
                           UNIQUE(gym_id, device_serial, subject_id, occurred_at)  -- idempotency
```

**Secrets split is deliberate.** Gym owners need to see *whether* access control
is configured and when it last verified; they must never be able to read back
the stored vendor password or token. Splitting the secret columns into a table
with RLS enabled and **no gym-side policies at all** (service-role only) is the
same shape as the `gym_registration_links` no-UPDATE precedent, and is more
robust than column-level filtering. Ciphertext is AES-256-GCM under
`ACCESS_CONTROL_ENCRYPTION_KEY`, encrypted/decrypted in server code only.

RLS everywhere else: gym owners `SELECT` their own devices, subjects and
events; all writes go through service-role server code.

### 4.1 Enqueue by trigger, not by call site

Access intents are enqueued into `access_sync_jobs` by an `AFTER UPDATE/INSERT`
trigger on `members`, firing when `status`, `next_due_date`,
`membership_start_date` or `verified_at` changes.

This is the right call over sprinkling `enqueue()` into the seven member use
cases, because:

- it catches **every** path — routes, crons, and any future SQL-side change —
  so the outbox cannot be bypassed;
- `RegisterMember`, `CancelMember`, `SuspendMember` etc. stay untouched, which
  keeps `features/members` deletable in isolation (R2) and its routes thin (R6);
- it mirrors the existing `sync_gym_member_count` trigger precedent.

The trigger only *enqueues* — it never calls out and never writes
`members.status`, so it does not repeat the mistake migration
`20260727000002` reverted.

Latency is covered by a hybrid: the trigger guarantees eventual delivery, and
the suspend/cancel/verify routes additionally kick a best-effort immediate
drain for that one member so the door reacts in seconds.

---

## 5. Routes

All dashboard routes: session auth → gym ownership → **`accessControlHardware`
capability check from `PlanRestrictions`** → Zod → one factory call (R6).
Responses via `ResponseBuilder` (rule 2.3).

```
GET|PUT   /api/access-control/account               # configure credentials (write-only secrets)
POST      /api/access-control/account/verify        # sign-in probe, sets last_verified_at
GET|POST  /api/access-control/devices
PATCH     /api/access-control/devices/[id]          # NON-state props only: name, purpose (rule 2.5.1)
DELETE    /api/access-control/devices/[id]
POST      /api/access-control/devices/[id]/enable   # state transition → dedicated endpoint (rule 2.5)
POST      /api/access-control/devices/[id]/disable  # state transition → dedicated endpoint (rule 2.5)
POST      /api/access-control/devices/[id]/open     # remote unlock — audited, rate-limited
POST      /api/access-control/devices/[id]/reboot
POST      /api/access-control/members/[id]/sync     # force re-assert
POST      /api/access-control/members/[id]/enrol    # {method:'face'|'finger', deviceId, fingerId?}
GET       /api/access-control/events                # check-in log, paginated

POST      /api/webhooks/access-control/[token]      # inbound attendance events
GET|POST  /api/cron/drain-access-sync               # every 5 min
GET|POST  /api/cron/reconcile-access                # daily, AFTER update-expired-status
```

**No generic update endpoint may change device or access state** (rule 2.5).
Enabling/disabling a device and granting/blocking a member are transitions and
get their own operational endpoints; `PATCH` is limited to renaming and purpose,
which are plain property edits (rule 2.5.1). Every response is built with
`ResponseBuilder` and serialized through
`serializeAccessDeviceForAPI` / `serializeAccessEventForAPI` — a raw entity is
never handed to `JSON` (rule 2.11).

**Client selection (R7):** dashboard routes pass the session `createClient()`
so RLS scopes the gym; the webhook and both crons pass `createAdminClient()`.

**Cron ordering is load-bearing.** `update-expired-status` flips Active →
Expired; `reconcile-access` must run after it, or the day's expiries won't
reach the doors until the following run.

Both crons use `CronLogger` (rule 2.6). What each audience sees is deliberately
different (rules 2.8 / 2.9):

- **Gym managers** get sanitized state only — "Device offline, last seen 2 h
  ago", "Access update pending". Never a vendor error string, HTTP status, or
  stack trace.
- **SaaS admins** get the raw truth on `/system-health`: `last_error`, attempt
  counts, dead-lettered jobs, provider payloads.

And because every command is queued, **pending is not failure** (rule 2.8): a
job awaiting device pickup renders as in-progress, and only an exhausted retry
budget or an explicit vendor error renders as an error state.

### 5.1 The webhook needs authentication we have to invent

The vendor spec ships the webhook with **no signature and no auth header** —
unlike text.lk (HMAC) and PayHere. Anyone who learns the URL could forge
check-ins. Mitigation:

- an unguessable per-gym token in the **path**, reusing the
  `gym_registration_links` token pattern (≥128 bits, rotatable);
- an optional `ACCESS_CONTROL_WEBHOOK_SECRET` header check, enabled if the
  vendor confirms custom headers are supported (open question Q2);
- per-token rate limiting, strict Zod parsing of the array, per-event
  idempotency on `UNIQUE(gym_id, device_serial, subject_id, occurred_at)`, and
  an **always-200** contract so the vendor does not retry-storm us — the same
  contract the PayHere webhook already follows.

---

## 6. Identity mapping — the one thing to decide before coding

Vendor `EmpId` is a short string backed by a ZKTeco `Pin` (numeric, limited
width). Our member IDs are UUIDs and **cannot** be pushed.

We already have `members.member_number` — a per-gym 1-based sequence — which is
the natural `EmpId`… but it is only unique *within a gym*. So:

- **Recommended: one VFT account per gym.** `subject_id = member_number`.
  Namespaces are naturally isolated, a compromised credential blasts one
  tenant, and it matches how gyms buy hardware. Requires the vendor to issue
  per-gym accounts.
- **Fallback: one shared VFT account.** Needs a global `subject_id` sequence
  stored in `member_access_subjects` — never derivable from `member_number`,
  and multi-tenant isolation then rests entirely on our own code.

`subject_id_strategy` on the account row keeps both viable, but the schema
should be built for the per-gym default.

---

## 7. Configuration

```bash
ACCESS_CONTROL_ENABLED=false           # master switch; false ⇒ MockAccessControlProvider
ACCESS_CONTROL_PROVIDER=vft            # vft | mock
VFT_API_BASE_URL=https://…
ACCESS_CONTROL_ENCRYPTION_KEY=         # 32-byte base64, AES-256-GCM for vendor credentials
ACCESS_CONTROL_WEBHOOK_SECRET=         # optional inbound header check
```

Mock-by-default mirrors `createSMSProvider` / `createStorageProvider`: local and
CI runs never touch real hardware.

---

## 8. Testing (70/20/10)

**Unit** — `resolveAccessDecision` across the full status × dates × verified ×
day-pass matrix; `YYYYMMDD` formatting and the inclusive paid-through boundary;
retry/backoff maths; Zod parsing of vendor responses *and* of malformed ones;
webhook payload normalisation including duplicate events; credential
encrypt/decrypt round-trip.

**Integration** — every route for happy path, Zod rejection, non-owner gym
(403), and **non-Enterprise tier (403)**; outbox enqueue fires on each member
transition; webhook idempotency; VFT calls mocked with MSW.

**E2E** — configure account → register a device → register a member → member
appears provisioned with the correct validity window.

**Locations (R9):** feature unit tests in `src/features/access-control/tests/`;
vendor-client tests in `src/lib/access-control/__tests__/`; route tests in
`src/app/api/access-control/__tests__/`; E2E in the top-level `tests/`.

---

## 9. UI (rule 2.17)

All access-control screens compose the Metric Design System downward — L2
primitives (`@/components/ui`) and L3 composites
(`@/components/common/composites`) only. Concretely: the device list and the
check-in log are `DataTable`s, the remote-unlock confirmation is the existing
L3 `ConfirmDialog` (via `useConfirmDialog`), and every screen sits inside
`FeatureGate feature="accessControlHardware"`. **No new foundational pattern is
forked** — no bespoke table, dialog, or button variant. Feature UI lives in
`features/access-control/components/` (L4), never in shared
`src/components/` (R8).

**Composition direction matters for R2.** The member detail screen needs an
access panel, but `features/members` must not import `features/access-control`
— that would make members undeletable-in-isolation. The panel lives in
`features/access-control/components/MemberAccessPanel.tsx` and is composed at
the **page level** (L5), so the dependency arrow points page → access-control,
never members → access-control.

---

## 10. Architecture compliance audit

Checked against `.claude/rules/architecture.md` and
`docs/architecture/feature-first-growth-rules.md`. Two findings were real and
this document has been corrected for both.

### Findings (corrected above)

| # | Finding | Resolution |
| --- | --- | --- |
| **F1** | The first draft put `IAccessControlProvider` and the VFT client inside `features/access-control/services/providers/`, copying the SMS layout. R8 says external-service wrappers belong in `lib/`, and both PayHere and R2 put the **port itself** there too — SMS is the outlier. | Split into `src/lib/access-control/` (port, VFT client, Mock, config, crypto) and `src/features/access-control/` (domain, use-cases, repository, factory). §3.0 |
| **F2** | The first draft exposed `PATCH /devices/[id]` as a general update endpoint, which would let a device be enabled/disabled through a generic write — rule 2.5 forbids exactly that. | Dedicated `/enable` + `/disable` transition endpoints; `PATCH` reduced to name/purpose per rule 2.5.1. §5 |

### Rule-by-rule

| Rule | Status |
| --- | --- |
| **R1** one architecture | ✅ no `core/`/`infrastructure/`/`presentation/`/`services/`; logic in `features/`, glue in `lib/`. `arch:check` clean. |
| **R2** deletable in isolation | ✅ after the §9 composition rule — no feature imports access-control. ⚠️ one honest caveat below. |
| **R3** internal shape | ✅ only canonical folders (`config/ domain/ services/ schemas/ utils/ components/ types/ tests/`). |
| **R4** `index.ts` barrel | ✅ — and it must land in the **first** Phase-1 commit, or the pre-commit `arch:check` fails. |
| **R5** single ownership | ✅ `MemberStatus`/`PlanType` imported from `features/members/config/`, `SaasTier` from `SubscriptionConfig.ts`, `accessControlHardware` read from `PlanRestrictions`. New enums owned solely by `AccessControlConfig.ts`. No duplication. |
| **R6** thin routes | ✅ auth → capability check → Zod → one factory call. No new R6 exception is requested. |
| **R7** factory composition | ✅ `services/factory.ts` is the only wiring point; session vs service-role client specified per route (§5). |
| **R8** layer discipline | ✅ **after F1**. `lib/` holds zero gym rules; `utils/` stays pure; feature UI stays in the feature. |
| **R9** tests with code | ✅ locations pinned in §8. |
| **R10** clean root/docs | ✅ this doc is in `docs/architecture/`; vendor questions in `docs/integrations/vft/`. No root files. |
| **R11** migrations | ✅ single unique-timestamp migration, `CREATE TABLE IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` before create, empty-DB replayable. |
| **R12** commits/releases | ✅ Conventional Commits; no version bump, no CHANGELOG release edit, no tags. |
| **R13** types & validation | ✅ `strict`, zero `any` (vendor responses parsed from `unknown`), Zod on every input, **`z.nativeEnum()`** for the new domain enums (rule 2.2), `ResponseBuilder` + serializers (rules 2.3 / 2.11). |
| **2.6** cron logging | ✅ both crons via `CronLogger`. |
| **2.8 / 2.9** error surfacing | ✅ pending ≠ error; sanitized for gym managers, raw for SaaS admins. |
| **2.10** query ordering | ✅ `access_events` and `access_sync_jobs` are time-series — "latest" reads always `ORDER BY … DESC` in SQL before any `.find()`. |
| **2.13** tier gating | ✅ capability read from the `PlanRestrictions` matrix only; no `tier === 'enterprise'` anywhere. |
| **2.17** design system | ✅ §9. |

### Honest caveat on R2

The outbox is enqueued by a trigger on the `members` table (§4.1), so the
*database* carries a dependency that the *code* does not. Deleting
`features/access-control/` would leave an orphan trigger behind. R2 governs
code coupling — and by that measure the design is clean, since `features/members`
contains zero references to access-control. To keep the DB honest too:

- the trigger function no-ops when the gym has no `access_control_accounts` row,
  so it is inert for every non-Enterprise gym;
- feature removal ships a paired teardown migration, noted here so it is not
  discovered later.

### Follow-ups this integration owes the rulebook

Landing Phase 1 must **also**:

1. add `access-control` to the feature lists in `CLAUDE.md`, in
   `.claude/rules/architecture.md` §1.1/§2.4, and in the canonical structure
   block of `feature-first-growth-rules.md` (they enumerate features by name);
2. add a Pattern Index row (`2.18`) in `.claude/rules/architecture.md` pointing
   at this file — **only once code exists**, since that index lists enforced
   rules, not plans;
3. document the two new cron jobs wherever the existing cron schedule is
   recorded, including the ordering constraint against `update-expired-status`.

---

## 11. Phasing

Each phase ships and is independently useful; nothing before Phase 2 touches
the network.

| Phase | Content |
| --- | --- |
| **0** | Vendor clarifications (§12) + the identity decision (§6). Runs in parallel with Phase 1. |
| **1** | Migration, config, `resolveAccessDecision`, port, Mock provider, repository, factory, unit tests. Zero network. |
| **2** | `VftAccessControlProvider`, credentials + device settings UI behind `FeatureGate`, "verify connection". |
| **3** | Member sync: trigger outbox, drain + reconcile crons, member access panel, enrolment trigger, `/system-health` surfacing. |
| **4** | Attendance webhook + check-in log UI — a genuinely new capability (the app has no attendance data today). |
| **5** | Remote unlock, reboot, device command console, audit trail. |

---

## 12. Open questions

**Questions for VFT** are maintained as a standalone, sendable document:
**`docs/integrations/vft/vft-api-questions.md`** (13 questions, each with why
it blocks us and what we will assume if unanswered). Q1–Q4 there are hard
blockers for Phase 2.

Internal product/legal decisions — ours, not the vendor's:

1. **Gym stops paying — do members get locked out?** Suspending a *gym's* SaaS
   subscription and mass-blocking its members at the door is a physical-safety
   and reputational risk. Recommendation: **stop syncing, leave devices in
   their last known state**, and show the gym a banner. Needs an explicit
   product call before Phase 3.
2. **Biometric data is sensitive personal data.** Face and fingerprint
   templates live on the vendor's devices, but *we* trigger enrolment, so the
   privacy policy needs a biometric-processing disclosure and registration
   needs an access-control consent alongside the existing `accepted_terms_at` /
   `accepted_gym_rules_at`. Settle before Phase 3 ships.
3. **Remote door-open is physical security.** Enterprise-only, gym-owner-only,
   rate-limited, and every invocation audited with actor and timestamp.
4. **Identity strategy** (§6) — depends on VFT Q1, but the call is ours.
