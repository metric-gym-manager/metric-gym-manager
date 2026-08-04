# Access Control Integration (VFT GYM API v2.0)

> On-demand reference. Not auto-injected.
> **Status:** PLAN — nothing in this document is implemented yet. Vendor
> questions are **answered** (`docs/integrations/vft/vft-api-answers.md`), so
> Phase 1 is unblocked.
> **Hardware:** ~90% fingerprint readers, one gate per gym, one finger per
> member. Those three facts narrow the scope considerably — see §2.1.
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

### 2.1 The three properties that drive the whole design

*All three are now confirmed by VFT — see
`docs/integrations/vft/vft-api-answers.md` for the full reply.*

1. **Commands are queued, not applied synchronously.** `/api/devicecmd/*`
   enqueues a command the device collects on its next PUSH poll;
   `GET /api/devicecmd/{DevSN}` lists what is still pending.
   **HTTP 200 confirms queuing, not execution.** VFT confirmed that a device
   coming back online **fetches its queued buffer sequentially**, so commands
   issued to an offline device are *not* lost.

   That is better than feared, and it sharpens what the outbox is for: not
   guarding against loss in transit, but knowing **when a command has actually
   been applied**. Queue drainage is the only completion signal — there is no
   per-command status field and no success callback.

2. **Biometric enrolment is physical and two-part.** This is the confirmed
   operational flow, and it matches how Sri Lankan gyms already work:

   > **Part 1** — the member is registered in our SaaS registry (existing desk
   > or QR flow, no hardware involved).
   > **Part 2** — staff walk them to the fingerprint reader and their finger is
   > scanned onto the device.

   `enrollfinger` queues a command that puts the *device* into enrolment mode;
   the member must be standing at it. Enrolment has **no completion callback**,
   so it is modelled as *pending until observed* by polling `GET /api/template`
   — the pending-vs-error distinction of rule 2.8 again.

   **The estate is ~90% fingerprint readers**, so fingerprint is the primary
   flow and face is the exception. Two simplifications follow from local
   practice and are deliberate scope reductions:
   - **One finger per member** (the index finger of one hand). The API supports
     `fingerId` 0–9, but multi-finger enrolment is out of scope — the schema
     records a single finger, not a set.
   - **Single gate per gym** (one reader serving entry and exit). Cross-device
     template propagation and device-replacement migration are therefore *not*
     concerns for this build, even though VFT confirmed both are supported via
     `syncone` / `syncsometoone`. The port keeps the sync calls; nothing in the
     product depends on them.

3. **The registry and the biometric are separate lifecycles.** A member's
   fingerprint must be removable **without** deleting their membership record.
   VFT supports exactly this split:
   - `DELETE /api/template/fromdev/{id}` — clears templates from devices,
     **keeps** the employee record;
   - `DELETE /api/template/{id}` — deletes employee *and* templates.

   So revoking a biometric is a first-class operation in our app, independent
   of member status, and never touches the `members` row.

### 2.2 Confirmed code tables

VFT supplied these, so `config/AccessControlConfig.ts` gets real enums instead
of the "store raw, decode later" fallback the earlier draft assumed:

| Field | Values |
| --- | --- |
| `VerifyType` | `1` Fingerprint · `2` Card · `3` Password · `15` Face |
| `CheckingStatus` | `0` Check-In · `1` Check-Out · `4` Overtime In · `5` Overtime Out |
| `Event` | `3` Door Unlocked / Access Granted |

Validated with `z.nativeEnum()` (rule 2.2), with the raw payload still kept in
`access_events.raw` for values that appear later.

**Treat `CheckingStatus` as advisory, not as truth.** With one reader serving
both entry and exit, the device cannot reliably distinguish direction — it
reports whatever mode it is configured in. So we model `access_events` as a
stream of **visits**, not as paired in/out sessions, and we do not build
time-in-gym or occupancy features on it. Recording that would be inventing data
the hardware does not have.

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

  startFingerEnrolment(c: AccessCredentials, t: SubjectOnDevice & { fingerId: number }): Promise<void>
  startFaceEnrolment(c: AccessCredentials, t: SubjectOnDevice): Promise<void>

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
  /**
   * The gym's *local* calendar day (Asia/Colombo), supplied by the caller.
   * Never derived inside this function: `new Date()` here would silently make
   * the verdict server-timezone-dependent, which is the exact bug §3.4
   * describes. Passing it in keeps the function pure and the timezone explicit
   * at the boundary.
   */
  today: Date
}): { allowed: boolean; validFrom: Date | null; validTo: Date | null; reason: AccessDenialReason | null }
```

The Colombo-aware `today` comes from a small pure helper in
`features/access-control/utils/`. It lives in the feature rather than
`src/utils/date/` because only this feature needs it today (R8 — don't promote
a single-feature helper to shared utils speculatively). When the app-wide
timezone correction described in §3.4 happens, that helper is the natural thing
to promote.

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

**Invariant that follows — and it prevents a real defect.** The daily
reconciler pushes *the decision*, never a blanket "refresh everyone's
`validperiod`". A suspended member whose `next_due_date` is still in the future
resolves to `allowed: false`, so the reconciler issues `accessblock` for them
and no `validperiod` at all.

This matters because we do not yet know whether a later `validperiod` silently
clears an earlier `accessblock` on the device (round-2 question 3.1/3.3). If it
does, a naive nightly refresh would **un-suspend every suspended member** —
silently, nightly, and with the door as the only evidence. Driving every write
from `resolveAccessDecision` makes that unreachable regardless of how the
hardware behaves.

### 3.4 The lockout boundary — the rule the whole integration exists to enforce

**Stated precisely:** a member is admitted for the whole of their
`next_due_date` and refused from **00:00 the following day**.

> A member due on the **15th** may train on the 15th, right up to 23:59:59.
> From **16th 00:00** the gate refuses them.

This is the gym culture here, it is what `StatusConfig` already encodes (expiry
is immediate, with **no grace period**), and it needs no special handling: it is
what `validTo = next_due_date` produces once VFT's confirmed **inclusive
`EndDate` through 23:59:59** is applied. The 15th is pushed as `EndDate`, the
device admits through the 15th, and refuses from midnight.

**The valuable property: the door locks itself, on time, with no cron
involved.** The *device* enforces `EndDate` from its own clock at local
midnight. There is no window in which an expired member walks in because a job
hasn't run yet — and no dependency on our servers, our network, or the gym's
internet being up at midnight.

#### The subtlety: a 5.5-hour window where the app disagrees with the door

`update-expired-status` runs `0 0 * * *` — **00:00 UTC, which is 05:30 SLT.**
So between 00:00 and 05:30 local, the door has already refused the member while
`members.status` still reads `Active`. Safe direction (the door is stricter),
but staff seeing "Active" while a member is turned away at the gate is exactly
the confusion this integration must not create.

**Fix: the member access panel derives its state from `resolveAccessDecision`,
never from `members.status`.** The function takes `nextDueDate`, so it returns
*blocked — expired* from 00:00 regardless of what the status column still says.
App and door agree at every instant. The status cron becomes bookkeeping (quota
counting, the cancellation chain) rather than the thing that gates the door.

#### Why we do *not* move the existing cron to local midnight

Moving `update-expired-status` to 18:30 UTC (= 00:00 SLT) looks like the
obvious fix. It would break two things:

1. **The date maths is server-local, i.e. UTC.** `UpdateExpiredStatus` does
   `new Date(); today.setHours(0,0,0,0)` → midnight **UTC**; the SQL helper
   `get_overdue_members()` uses `CURRENT_DATE`, also UTC. Fired at 18:30 UTC on
   the 15th, the UTC date is *still the 15th* while Sri Lanka is already on the
   16th — so a member due the 15th fails the `next_due_date < today` test and is
   **not** expired. They would expire 24 hours late. That is worse than the
   5.5-hour cosmetic window it was meant to fix.
2. **The nightly status chain is ordered and pinned.**
   `update-expired-status` (00:00) and `expire-suspended-members` (00:15) feed
   `cancel-overdue-members` (00:30); `cron-schedule-order.test.ts` asserts this
   against `vercel.json`. Moving one feeder to 18:30 inverts the order — the
   test fails, and every newly-expired member waits an extra day to be
   cancelled. Moving the whole chain drags `charge-renewals`, `process-dunning`
   and `process-trial-expiry` with it.

Making the whole app Colombo-correct is worthwhile eventually — `getDaysUntilDue`
is UTC-based too, so the app's own day arithmetic is already off by one for
anyone using it between 00:00 and 05:30 SLT — but it is a timezone refactor
touching reminders, member display and revenue. It is not access-control work
and must not ride in on this branch.

#### What we do instead: put the *new* cron at local midnight

`reconcile-access` is new code with no legacy coupling, so it is scheduled at
**`30 18 * * *` (18:30 UTC = 00:00 SLT)** and computes "today" in
**Asia/Colombo**, not server-local. That buys the thing that actually matters:

**An explicit `accessblock` is clock-independent.** The device obeys a command;
it does not evaluate a date. So a job firing at local midnight that pushes
blocks for the members who just expired closes the gap left by a **drifting
device clock** — a reader running an hour slow would otherwise keep admitting
them for that hour, and nobody would notice.

Two honest limits: it only helps for devices that are **online and polling**
(bounded by the poll interval — round-2 question 1.4), and a **fast** clock
locks members out early, which no cron of ours can prevent. Device time sync
therefore remains a genuine operational dependency and stays as round-2
questions 1.1–1.3. Sri Lanka has no DST, which removes the other half of the
problem.

---

## 4. Database schema

One migration, idempotent and replayable (R11).

```
access_control_accounts    gym_id UNIQUE, base_url, area_id, is_active,
                           last_verified_at                        -- NON-secret, gym-readable
access_control_secrets     account_id UNIQUE, email_ciphertext, password_ciphertext,
                           api_token_ciphertext, token_expires_at  -- service-role ONLY, no gym policies
access_devices             gym_id, device_serial UNIQUE, device_name, area_id, timezone_offset,
                           is_active, last_seen_at, last_synced_at
member_access_subjects     gym_id, member_id UNIQUE, subject_id BIGINT UNIQUE,
                           finger_enrolled, finger_id, enrolled_at,
                           provisioned_at, last_synced_at, sync_state
access_sync_jobs           gym_id, member_id?, device_id?, intent, payload JSONB,
                           status('pending'|'in_flight'|'succeeded'|'failed'|'dead'),
                           attempts, next_attempt_at, last_error, provider_command_id
access_events              gym_id, member_id?, device_serial, subject_id, occurred_at,
                           checking_status, verify_type, event_code, raw JSONB
                           UNIQUE(gym_id, device_serial, subject_id, occurred_at)  -- idempotency

access_subject_id_seq      -- Postgres SEQUENCE, global across all gyms (see §6)
```

Three schema points come straight from VFT's answers:

- **`area_id` is the tenant boundary, not a default.** VFT confirmed the API has
  no native tenant isolation — a single JWT sees everything, and `EmpId` is a
  **flat identifier** unless scoped by `AreaID`. Each gym therefore gets its own
  `AreaID`, and it is mandatory on employee creation (per §6.4 of their reply).
- **`device_serial` is globally unique, not per-gym.** It is how we route
  inbound webhook events back to a gym (§5.1), so it cannot collide.
- **`subject_id` is `BIGINT` from a global sequence** and globally unique —
  never `member_number`. See §6.

Dropped from the earlier draft: `purpose` on devices and `enrolled_finger_ids[]`
on subjects. Sri Lankan gyms run **one gate** and record **one finger**, so both
were modelling flexibility nobody uses. A single `finger_id` records which
finger was scanned.

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
PATCH     /api/access-control/devices/[id]          # NON-state props only: name (rule 2.5.1)
POST      /api/access-control/devices/[id]/enable   # state transition → dedicated endpoint (rule 2.5)
POST      /api/access-control/devices/[id]/disable  # state transition → dedicated endpoint (rule 2.5)
POST      /api/access-control/devices/[id]/unlink   # removes from OUR db only — VFT has no device DELETE
POST      /api/access-control/devices/[id]/open     # remote unlock — audited, rate-limited
POST      /api/access-control/devices/[id]/reboot
POST      /api/access-control/members/[id]/sync     # force re-assert of validity window
POST      /api/access-control/members/[id]/enrol    # put the reader into enrolment mode (part 2 of §2.1)
DELETE    /api/access-control/members/[id]/biometric # clear the fingerprint, KEEP the member
GET       /api/access-control/events                # check-in log, paginated

POST      /api/webhooks/access-control/[token]      # inbound attendance events
GET|POST  /api/cron/drain-access-sync               # every 5 min
GET|POST  /api/cron/reconcile-access                # `30 18 * * *` = 18:30 UTC = 00:00 SLT (§3.4)
```

`DELETE /members/[id]/biometric` maps to VFT's
`DELETE /api/template/fromdev/{id}` — templates off the reader, employee record
intact — and clears `finger_enrolled` on our side. It **never** touches the
`members` row. This is the registry/biometric separation from §2.1 property 3,
and it is why it is a route of its own rather than a flag on member update:
deleting someone's fingerprint is not an edit to their membership.

There is deliberately **no `DELETE /devices/[id]`**: VFT confirmed no device or
area delete endpoint exists. `/unlink` removes the device from our database only,
and the UI says so rather than implying the hardware was deprovisioned.

**No generic update endpoint may change device or access state** (rule 2.5).
Enabling/disabling a device and granting/blocking a member are transitions and
get their own operational endpoints; `PATCH` is limited to renaming and purpose,
which are plain property edits (rule 2.5.1). Every response is built with
`ResponseBuilder` and serialized through
`serializeAccessDeviceForAPI` / `serializeAccessEventForAPI` — a raw entity is
never handed to `JSON` (rule 2.11).

**Client selection (R7):** dashboard routes pass the session `createClient()`
so RLS scopes the gym; the webhook and both crons pass `createAdminClient()`.

**Correction to an earlier draft: there is _no_ ordering dependency on the
status chain.** This document previously claimed `reconcile-access` had to run
after `update-expired-status`. It does not, and the reason matters:
`resolveAccessDecision` derives expiry from **`next_due_date`**, not from
`members.status`. So the reconciler reaches the correct verdict whether or not
the status cron has run yet.

That is precisely what lets `reconcile-access` sit at 18:30 UTC — six hours
*before* the status chain — and enforce the lockout at local midnight (§3.4).
Suspensions and cancellations are status-driven, but those are admin actions
that reach the outbox through the trigger immediately, so they do not wait for a
cron either.

`reconcile-access` is therefore **excluded from
`cron-schedule-order.test.ts`**, which pins the Active→Expired→Cancelled chain.
Adding it there would assert a dependency that does not exist and would block
the 18:30 slot.

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

### 5.1 The webhook: one URL for every gym, routed by device serial

VFT confirmed two things that change this design from the earlier draft:

> **Auth:** no header signature is defined for incoming push webhooks.
> Verification requires **path-based secret tokens or IP whitelisting**.
>
> **Routing:** the callback is configured **at server/account level**.

So the per-gym callback URL is *not* available on a shared account — there is
**one** endpoint receiving events for every gym. That kills the per-gym path
token as a routing mechanism, though not as an auth mechanism:

- **One platform-wide path token** (≥128 bits, rotatable) authenticates the
  endpoint — this is VFT's own recommended approach, so we are not improvising.
- **The gym is resolved from `DeviceID`** (the `DevSN`) via `access_devices`,
  which is why that column is globally unique (§4). An event for an unknown
  serial is logged and dropped, never guessed at.
- **Optional IP allowlist** as a second factor, the other mechanism VFT
  suggested, once we know their egress addresses.
- Rate limiting, strict Zod parsing of the array, per-event idempotency on
  `UNIQUE(gym_id, device_serial, subject_id, occurred_at)`, and an
  **always-200** contract — the same contract the PayHere webhook follows.

**Security consequence worth stating plainly:** on a shared account we receive
attendance events for *every* gym on that account, including any that are not
our customers. We store only events whose `DevSN` maps to a device we know, and
the ingestion path never trusts a gym id from the payload.

### 5.2 Denied scans are not ingested — deliberately

VFT confirmed that rejections (expired validity, unknown template) do **not**
arrive on the webhook. They land in the device transaction table, reachable
only by polling `DATA QUERY tablename=transaction` — a raw, queued command.

We are not building that polling loop, because we do not need it. Your
description of the member experience is the reason:

> When a membership is expired, the gate simply does not open and the reader
> shows an error on its screen.

Our database already knows *why* — expired, suspended, cancelled, unverified.
The front desk sees the real reason in our app the moment they look the member
up; the member sees the device error at the gate. Polling the vendor to be told
something we already know would add a queued command per device per interval
for no information gain.

`access_events` therefore records **successful entries only**. If denial
analytics are ever wanted, the transaction-table poll is the documented way in.

---

## 6. Identity mapping — settled

VFT confirmed the two facts that decide this:

> `EmpId` corresponds directly to the ZKTeco hardware `Pin`. Numeric strings
> only (up to 9 or 24 digits depending on model). **UUIDs cannot be used.**
>
> The API exposes no tenant-isolation endpoints. `EmpId` operates as a **flat
> identifier** unless explicitly scoped by `AreaID`.

**Decision: allocate `subject_id` from a single global Postgres sequence,
zero-padded to at most 9 digits. Never use `members.member_number`.**

`member_number` is per-gym and 1-based, so two gyms both have a member `1`. On
a flat `EmpId` namespace that is a collision — and a collision here means **one
gym's member opens another gym's door**. A global sequence costs nothing and is
correct under both deployment models:

| If VFT issues… | Global sequence still correct? |
| --- | --- |
| separate credentials per gym | Yes — IDs are merely sparse, which is harmless |
| one shared account for all gyms | Yes — and it is the *only* safe option |

Because VFT would not commit to per-gym credentials (they offered it as an
option, not a product feature), the shared-account case must be assumed. The
earlier `subject_id_strategy` column is therefore deleted: there is one strategy.

**9 digits, not 24.** The ceiling varies by hardware model and we cannot audit
every unit a gym might own, so we stay inside the narrowest documented limit.
A sequence starting at 100000 leaves headroom for ~999 million members.

**Verify truncation empirically** on the first test device: push a 9-digit
`EmpId` and confirm the device stores it whole rather than silently truncating.
Silent truncation is the failure mode that grants the wrong member access, and
it is invisible until someone walks through a door they shouldn't.

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
day-pass matrix, with the **midnight boundary of §3.4 as its own test group**:
due on the 15th ⇒ allowed at 15th 23:59:59, blocked at 16th 00:00:00, and
blocked at 16th 00:00 *while `status` is still `Active`* (the pre-cron window —
the case where app and door would otherwise disagree);
`YYYYMMDD` formatting and the inclusive paid-through boundary;
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
3. add the two new cron jobs to `docs/ops/CRON_JOBS.md` and `vercel.json` —
   `drain-access-sync` (every 5 min) and `reconcile-access` (`30 18 * * *`,
   00:00 SLT). Record in that doc **why** `reconcile-access` sits outside the
   pinned member-status chain (§3.4/§5): it is date-driven, not status-driven,
   so it has no ordering dependency and must not be added to
   `cron-schedule-order.test.ts`.

---

## 11. Phasing

Each phase ships and is independently useful; nothing before Phase 2 touches
the network.

| Phase | Content |
| --- | --- |
| ~~**0**~~ | ~~Vendor clarifications~~ — **done**. VFT answered; the identity question (§6) is settled. Phase 1 is unblocked. |
| **1** | Migration, config, `resolveAccessDecision`, port, Mock provider, repository, factory, unit tests. Zero network. |
| **2** | `VftAccessControlProvider`, credentials + device settings UI behind `FeatureGate`, "verify connection". |
| **3** | Member sync: trigger outbox, drain + reconcile crons, member access panel, enrolment trigger, `/system-health` surfacing. |
| **4** | Attendance webhook + check-in log UI — a genuinely new capability (the app has no attendance data today). |
| **5** | Remote unlock, reboot, device command console, audit trail. |

---

## 12. What is still open

VFT's full reply and the resulting decisions are recorded in
**`docs/integrations/vft/vft-api-answers.md`**. Nothing outstanding blocks
Phase 1. What remains:

**Unanswered by VFT — mitigated, not blocking**

| Gap | Mitigation in place |
| --- | --- |
| Rate limits never specified | Pace at ~1 req/s per gym; chunk the daily reconcile |
| Error body shapes / status codes never specified | Retry 5xx and timeouts with backoff; never retry 4xx; dead-letter after the budget |
| Webhook retry & duplicate-delivery behaviour not stated | Always-200 plus the idempotency constraint — correct under any retry policy |
| Whether re-signin invalidates a prior token | Central per-gym cached token with TTL, refresh once on 401 (VFT explicitly endorsed central token storage for serverless) |
| Enrolment-mode timeout on the device | Enrolment shown as *pending*; staff can re-issue. Confirm the real timeout on the test device |

**To verify on the first test device** — cheaper to measure than to ask again:

1. **9-digit `EmpId`** stores whole, without silent truncation (§6). Highest
   severity: truncation grants the wrong member access.
2. **`EndDate` inclusivity** — VFT says inclusive through 23:59:59; confirm a
   member whose window ends today still gets in today.
3. **`validperiod` vs raw `DATA UPDATE user`** — the collection exposes the typed
   `POST /api/devicecmd/validperiod`, but VFT's answer described expiry via the
   raw `DATA UPDATE user Pin=… StartTime=… EndTime=…` form. Confirm the typed
   endpoint works; if it does not, the raw string stays confined to
   `lib/access-control/`, never leaking into the feature.
4. **Command acknowledgement** — that a command really does vanish from
   `GET /api/devicecmd/{DevSN}` once applied, since that is our only completion
   signal.
5. **Offline buffering** — unplug, send `accessblock`, reconnect, confirm it lands.

**Ours to decide, not VFT's**

1. ~~**Member stops paying — do they get locked out?**~~ **Settled: yes**, from
   00:00 the day after `next_due_date` (§3.4). Already what the design produces.

   ⚠️ **Separate and still open — the *gym* stops paying *us*.** That is a
   different question from member expiry: it asks whether a whole gym's members
   lose door access because the gym's own Metric subscription lapsed.
   Recommendation remains **no** — stop syncing, leave devices in their last
   known state, show the gym a banner. Mass-locking a gym's paying members over
   the gym's billing dispute is a physical-safety and reputational risk, and the
   members did nothing wrong. Needs a product call before Phase 3.
2. **Biometric consent.** Fingerprint templates are sensitive personal data.
   Even though they live on VFT's hardware, we trigger enrolment — so the
   privacy policy needs a biometric disclosure and registration needs a consent
   alongside `accepted_terms_at` / `accepted_gym_rules_at`. Settle before
   Phase 3.
3. **Remote door-open** stays Enterprise-only, gym-owner-only, rate-limited and
   audited with actor and timestamp.

**Explicitly out of scope** (your calls, recorded so they are not re-litigated):
multi-finger enrolment, cross-device template propagation, device-replacement
migration, duplicate-finger detection, and template upload/restore. VFT
confirmed raw template upload is technically possible via
`DATA UPDATE tablename=templatev10`, so backup/restore remains available later
if it is ever wanted — but nothing in this build depends on it.

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
