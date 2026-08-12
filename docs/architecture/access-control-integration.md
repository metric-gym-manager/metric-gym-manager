# Access Control Integration (VFT GYM API v2.0)

> On-demand reference. Not auto-injected.
> **Status:** PLAN — nothing in this document is implemented yet.
>
> ⚠️ **Provenance: VFT has not been asked anything yet.** Every statement here
> about how the VFT API behaves is a **working assumption**, derived from the
> v2.0 PDF, the Postman collection, and general ZKTeco/ADMS behaviour. None of
> it is a vendor commitment. Assumptions and their blast radius are listed in
> `docs/integrations/vft/vft-api-assumptions.md`; the questions that would
> confirm them are in `vft-integration-questions.md`. Treat anything marked
> **unverified** as provisional until VFT replies or we test it on hardware.
>
> **Hardware:** ~90% fingerprint readers, one gate per gym, one finger per
> member. Those three are confirmed by the product owner — see §2.1.
> **Scope:** biometric door/turnstile hardware integration, the Enterprise-tier
> differentiator already declared in the `PlanRestrictions` capability matrix
> (`accessControlHardware`).

---

## 1. Why this fits where it fits

Two things are already in place and this integration must slot into them rather
than invent new mechanisms:

| Existing                                                                                                                                                                    | Consequence for this work                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessControlHardware` is a live key in `PlanRestrictions` (Enterprise only), with `Subscription.hasAccessControlHardware()` and the `FeatureGate` component already wired | The tier gate is **not** new code. Every route and use case reads the matrix; no ad-hoc `tier === 'enterprise'` conditionals (rule 2.13 / R5).                            |
| `ISMSProvider` + `IStorageProvider` ports, each with a real provider, a Mock fallback, and a `factory.ts` that picks by env var                                             | The vendor API gets the **same** treatment: `IAccessControlProvider` port, `VftAccessControlProvider`, `MockAccessControlProvider`. No VFT noun ever leaks past the port. |
| Member lifecycle is a strict state machine (`StatusConfig.VALID_TRANSITIONS`), expiry is immediate with **no grace period**, and `next_due_date` is the paid-through date   | Door access is a _pure projection_ of member state. It gets a pure domain function, not scattered branching.                                                              |

The single most important discovery in the vendor API is
`POST /api/devicecmd/validperiod?DevSN=&EmployeeId=&StartDate=&EndDate=`. It
lets us push the member's **paid-through window down to the device**, so the
turnstile enforces expiry by itself even if our sync is down or the gym's
internet is out. That makes valid-period the _primary_ mechanism and
grant/block the _secondary_ one for immediate events (suspension, cancellation).

---

## 2. What the vendor API actually gives us

Base URL is per-deployment; auth is a JWT from sign-in sent back as a header.

**Auth** — `POST /api/user/` `{email,password}` → `{token}`;
`GET /api/user/auth` validates; logout invalidates.

**Topology** — Areas (`/api/area`) group Devices (`/api/device`:
`DevSN`, `DevName`, `TimeZone` as a minutes offset e.g. `"330"`, `AreaID`,
`IsReboot`).

**Subjects** — the API calls them _employees_, at `/api/template*`
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

**Inbound webhook** — the device platform POSTs an _array_ of attendance
events to a URL we supply:

```json
[
  {
    "EmpId": "168",
    "AttTime": "2024-01-15 08:30:15",
    "CheckingStatus": "0",
    "VerifyType": "1",
    "Event": "3",
    "DeviceID": "QEM1253800017"
  }
]
```

### 2.1 The three properties that drive the whole design

_All three are **working assumptions**, not vendor statements — see
`docs/integrations/vft/vft-api-assumptions.md`._

1. **Commands are queued, not applied synchronously.** `/api/devicecmd/*`
   enqueues a command the device collects on its next PUSH poll;
   `GET /api/devicecmd/{DevSN}` lists what is still pending.
   **HTTP 200 confirms queuing, not execution.** We assume (**unverified**) that a device
   coming back online **fetches its queued buffer sequentially**, so commands
   issued to an offline device are _not_ lost.

   That is better than feared, and it sharpens what the outbox is for: not
   guarding against loss in transit, but knowing **when a command has actually
   been applied**. Queue drainage is the only completion signal — there is no
   per-command status field and no success callback.

2. **Biometric enrolment is physical, two-part, and — critically — appears to be
   driven from the terminal, not from software.**

   **Observed firsthand** at a gym running this hardware (the strongest evidence
   we have on any point in this document): a staff member walked the new member
   to the wall-mounted reader, **pressed buttons on the device itself** to begin
   enrolment, the finger was placed three times, and it was confirmed with the
   OK key. No software was involved at any visible point.

   Three captures is the standard ZKTeco template-building sequence, so this
   reads as an ordinary device-local admin-menu enrolment — **not** the
   `POST /api/devicecmd/enrollfinger` path the Postman collection exposes.

   > **Part 1** — the member is registered in our registry (existing desk or QR
   > flow, no hardware involved).
   > **Part 2** — staff walk them to the reader and enrol the finger **at the
   > device**.

   **This inverts our role in Part 2.** The earlier draft assumed we _trigger_
   enrolment via `enrollfinger` and then wait. If enrolment is started at the
   terminal, we trigger nothing — our only job is to **detect** that it
   happened. `POST /api/access-control/members/[id]/enrol` therefore becomes
   optional (a convenience for gyms whose staff prefer to start it from the
   desk), not the primary path, and it must not be the only way a member can
   become enrolled.

   Detection is by polling `GET /api/template`, which makes that endpoint's
   response shape load-bearing rather than incidental — hence the sharpened
   question to VFT. Enrolment stays modelled as _pending until observed_
   (rule 2.8).

   ⚠️ **The risk this surfaces: who assigns the `EmpId`?** Our design allocates
   member ids from a global sequence and pushes them down (§6). That only holds
   if staff at the terminal **select an employee record we already created**. If
   the terminal lets an operator key in an id and create a user locally, we get
   device-side records our system has never heard of — and worse, ids that can
   **collide with our sequence** and silently overwrite a real member. Nothing in
   our code can prevent that; it is a device-configuration and staff-training
   matter. This is the single most important thing to establish before Phase 3,
   and it is why the enrolment question to VFT leads with it.

   The mitigation, if operators can create users locally: reconcile in the other
   direction too — pull `GET /api/template` and flag any device-side `EmpId` that
   does not correspond to one of our subjects, rather than assuming our view is
   complete.

   **The estate is ~90% fingerprint readers**, so fingerprint is the primary
   flow and face is the exception. Two simplifications follow from local
   practice and are deliberate scope reductions:
   - **One finger per member** (the index finger of one hand). The API supports
     `fingerId` 0–9, but multi-finger enrolment is out of scope — the schema
     records a single finger, not a set.
   - **Single gate per gym** (one reader serving entry and exit). Cross-device
     template propagation and device-replacement migration are therefore _not_
     concerns for this build, even though both are probably supported via
     `syncone` / `syncsometoone`. The port keeps the sync calls; nothing in the
     product depends on them.

3. **The registry and the biometric are separate lifecycles.** A member's
   fingerprint must be removable **without** deleting their membership record.
   The endpoints suggest the API supports this split (**unverified**):
   - `DELETE /api/template/fromdev/{id}` — clears templates from devices,
     **keeps** the employee record;
   - `DELETE /api/template/{id}` — deletes employee _and_ templates.

   So revoking a biometric is a first-class operation in our app, independent
   of member status, and never touches the `members` row.

### 2.2 Assumed code tables

These are **assumed** ZKTeco defaults, **not vendor-supplied**. If VFT confirms
them, `config/AccessControlConfig.ts` can hold real enums; until then the raw
payload is retained in `access_events.raw` and decoding stays provisional:

| Field            | Values                                                            |
| ---------------- | ----------------------------------------------------------------- |
| `VerifyType`     | `1` Fingerprint · `2` Card · `3` Password · `15` Face             |
| `CheckingStatus` | `0` Check-In · `1` Check-Out · `4` Overtime In · `5` Overtime Out |
| `Event`          | `3` Door Unlocked / Access Granted                                |

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

R8 is explicit: _"`src/lib/` = third-party glue **only** … If it wraps an
external service or framework, it belongs here."_ The repo has two precedents
and they disagree, so this needs deciding rather than copying:

| Precedent                              | Port location                           | Implementation location                                       |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **PayHere** (external HTTP gateway)    | `lib/payhere/IPaymentGateway.ts`        | `lib/payhere/PayHereGateway.ts` + `config.ts` + `crypto.ts`   |
| **R2 storage** (external HTTP service) | `lib/storage/IStorageProvider.ts`       | `lib/storage/R2StorageProvider.ts` + `MockStorageProvider.ts` |
| **SMS** (Text.lk)                      | `features/sms/services/ISMSProvider.ts` | `features/sms/services/providers/`                            |

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
  syncSubjectsToDevice(
    c: AccessCredentials,
    serial: string,
    ids: string[]
  ): Promise<void>

  setValidPeriod(c: AccessCredentials, p: ValidPeriodInput): Promise<void>
  grantAccess(c: AccessCredentials, t: SubjectOnDevice): Promise<void>
  blockAccess(c: AccessCredentials, t: SubjectOnDevice): Promise<void>

  startFingerEnrolment(
    c: AccessCredentials,
    t: SubjectOnDevice & { fingerId: number }
  ): Promise<void>
  startFaceEnrolment(c: AccessCredentials, t: SubjectOnDevice): Promise<void>

  openDoor(c: AccessCredentials, serial: string): Promise<void>
  rebootDevice(c: AccessCredentials, serial: string): Promise<void>
  listPendingCommands(
    c: AccessCredentials,
    serial?: string
  ): Promise<PendingCommand[]>
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
}): {
  allowed: boolean
  validFrom: Date | null
  validTo: Date | null
  reason: AccessDenialReason | null
}
```

The Colombo-aware `today` comes from a small pure helper in
`features/access-control/utils/`. It lives in the feature rather than
`src/utils/date/` because only this feature needs it today (R8 — don't promote
a single-feature helper to shared utils speculatively). When the app-wide
timezone correction described in §3.4 happens, that helper is the natural thing
to promote.

| Member state                           | Decision                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Active`                               | allow, `validFrom = membership_start_date`, `validTo = next_due_date` (paid-through, inclusive — matches the no-grace rule) |
| `Expired`                              | block (device self-expires anyway; we assert it)                                                                            |
| `Suspended`                            | block **immediately** — this is the case that must not wait for a cron                                                      |
| `Cancelled`                            | block **and** remove the subject from devices                                                                               |
| QR registration, `verified_at IS NULL` | block until the front desk verifies — a self-registered stranger must not get a door open                                   |
| Day pass                               | allow for that day only (`validTo = today`)                                                                                 |

This function is the _only_ place access policy exists. Everything else
transports its output.

**Invariant that follows — and it guards a defect we cannot rule out.** The
reconciler pushes _the decision_, never a blanket "refresh everyone's
`validperiod`". A suspended member whose `next_due_date` is still in the future
resolves to `allowed: false`, so the reconciler issues `accessblock` for them
and **no `validperiod` at all**.

This is no longer hypothetical. Assumed behaviour (**unverified**):

> `accessblock` updates privilege flags in device memory. Re-issuing a
> `validperiod` command or updating user properties **can re-write user record
> flags on specific firmware builds, potentially clearing an active block
> state.** To ensure deterministic suspensions … avoid sending subsequent
> `validperiod` updates to blocked IDs.

A naive nightly refresh would therefore **un-suspend suspended members** —
silently, nightly, on some firmware but not others, with the door as the only
evidence. Two defences, both adopted:

1. **Never send `validperiod` to a blocked subject.** Guaranteed by driving
   every write from `resolveAccessDecision`, and asserted directly in the
   reconciler's unit tests rather than left as an emergent property.
2. **Template revocation for hard suspensions.** The likely deterministic route: `DELETE /api/template/fromdev/{id}` removes the fingerprint
   itself, so no privilege flag can be flipped back by a later write. Used for
   `Cancelled` and for administrative suspensions, where re-enrolment on return
   is acceptable. Ordinary expiry keeps using the validity window, which needs
   no command at all.

**Corollary — never issue a second credential.** After template revocation, _"if card numbers, PINs, or passwords remain assigned to
that `EmpId`, access via those secondary vectors remains active"_. We therefore
**never set `CardNo` or `Password`** on a subject: the fingerprint is the sole
credential, which is the only thing that makes revocation a true lockout. The
raw ZKTeco examples in the vendor docs do set `Password=…` — that form must
never be copied.

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
involved.** The _device_ enforces `EndDate` from its own clock at local
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
_blocked — expired_ from 00:00 regardless of what the status column still says.
App and door agree at every instant. The status cron becomes bookkeeping (quota
counting, the cancellation chain) rather than the thing that gates the door.

#### Why we do _not_ move the existing cron to local midnight

Moving `update-expired-status` to 18:30 UTC (= 00:00 SLT) looks like the
obvious fix. It would break two things:

1. **The date maths is server-local, i.e. UTC.** `UpdateExpiredStatus` does
   `new Date(); today.setHours(0,0,0,0)` → midnight **UTC**; the SQL helper
   `get_overdue_members()` uses `CURRENT_DATE`, also UTC. Fired at 18:30 UTC on
   the 15th, the UTC date is _still the 15th_ while Sri Lanka is already on the
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

#### What we do instead: put the _new_ cron at local midnight

`reconcile-access` is new code with no legacy coupling, so it is scheduled at
**`30 18 * * *` (18:30 UTC = 00:00 SLT)** and computes "today" in
**Asia/Colombo**, not server-local. That buys the thing that actually matters:

**An explicit `accessblock` is clock-independent.** The device obeys a command;
it does not evaluate a date. So a job firing at local midnight that pushes
blocks for the members who just expired closes the gap left by a **drifting
device clock** — a reader running an hour slow would otherwise keep admitting
them for that hour, and nobody would notice.

General ZKTeco behaviour suggests (**unverified**): validity bounds are _"evaluated entirely on
the device's local processor using its internal RTC and configured `TimeZone`
offset … access termination occurs at 23:59:59 local device time without
requiring real-time server connectivity."_ That is §3.4 working as designed.

**The poll interval is 5–30 seconds**, so a block reaches an online device in
well under a minute. The UI can honestly tell staff a suspension takes effect
"within about a minute" rather than hedging.

Two honest limits remain: it only helps devices that are **online and polling**,
and a **fast** clock locks members out early, which no cron of ours can prevent.

#### Detecting clock drift without an API for it

We have found **no endpoint to read or set device time** (**unverified**) — drift is
corrected during PUSH sync only _"if server time parameters are active"_, or by
configuring NTP on the hardware itself. So we cannot query a device's clock.

We can, however, **infer** it from data we already ingest. Every webhook event
carries `AttTime` in device-local time, and we know the device's `TimeZone`
offset. Comparing the normalised `AttTime` against our own receipt timestamp
yields the device's skew for free, on every scan. Persistent skew beyond a
threshold raises a `/system-health` alert for the SaaS admin and a sanitized
"device clock needs attention" note for the gym (rules 2.8/2.9).

This costs one comparison per event, needs no extra vendor calls, and turns an
invisible failure mode into a monitored one. Sri Lanka has no DST, which removes
the other half of the problem.

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

- **`area_id` is the tenant boundary, not a default.** We assume (**unverified**) the API has
  no native tenant isolation — a single JWT sees everything, and `EmpId` is a
  **flat identifier** unless scoped by `AreaID`. Each gym therefore gets its own
  `AreaID`, and we assume it is required on employee creation.
- **`device_serial` is globally unique, not per-gym.** It is how we route
  inbound webhook events back to a gym (§5.1), so it cannot collide.
- **`subject_id` is `BIGINT` from a global sequence** and globally unique —
  never `member_number`. See §6.

Dropped from the earlier draft: `purpose` on devices and `enrolled_finger_ids[]`
on subjects. Sri Lankan gyms run **one gate** and record **one finger**, so both
were modelling flexibility nobody uses. A single `finger_id` records which
finger was scanned.

**Secrets split is deliberate.** Gym owners need to see _whether_ access control
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

The trigger only _enqueues_ — it never calls out and never writes
`members.status`, so it does not repeat the mistake migration
`20260727000002` reverted.

Latency is covered by a hybrid: the trigger guarantees eventual delivery, and
the suspend/cancel/verify routes additionally kick a best-effort immediate
drain for that one member. With VFT's confirmed 5–30 s poll interval, the door
reacts in under a minute.

### 4.2 The queue drains **in order, serialized per member**

Expected provisioning sequence (**unverified**):

> Standard ZKTeco firmware requires a user profile (`Pin`) to exist in device
> memory before validity periods can be bound to it.
> **1.** Provision the employee profile and sync it to the device.
> **2.** Issue the `validperiod` command.

So a new member's intents form an ordered chain — `upsertSubject` →
`syncSubjectsToDevice` → `setValidPeriod` → (physical) `startFingerEnrolment` —
and running them concurrently would land `validperiod` against a profile the
device does not yet hold. It would fail silently, leaving a member with a
fingerprint and no validity window: refused at the door with no obvious cause.

`DrainAccessSyncQueue` therefore processes **at most one in-flight job per
member**, in `created_at` order, and a failed job blocks its own member's chain
(not the whole queue) until it succeeds or dead-letters. Different members drain
in parallel. This is a correctness requirement, not a throughput preference, and
it is a property the drainer's tests assert directly.

### 4.3 The reconciler enqueues **diffs, not everything**

There appears to be **no bulk validity endpoint** (**unverified**) — re-asserting is one call
per member per device. At the confirmed ceiling of _"under 10 requests per
second"_ (we pace at ~5/s for margin), re-asserting a 500-member gym nightly
would be ~100 seconds of pure churn for, on a typical night, a handful of actual
changes.

So `ReconcileMemberAccess` compares each member's resolved decision against the
last-synced state recorded on `member_access_subjects` and enqueues **only the
differences**. Nightly volume becomes proportional to members whose access
actually changed — normally those expiring at midnight.

This also shrinks the §3.3 hazard surface: every `validperiod` write is a chance
to clear a block on some firmware, so writing only when something changed means
strictly fewer opportunities for that bug to exist at all.

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

There is deliberately **no `DELETE /devices/[id]`**: No device or area delete endpoint appears to exist. `/unlink` removes the device from our database only,
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
_before_ the status chain — and enforce the lockout at local midnight (§3.4).
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

Two working assumptions shape this design (**both unverified**):

> **Auth:** no header signature is defined for incoming push webhooks.
> Verification requires **path-based secret tokens or IP whitelisting**.
>
> **Routing:** the callback is configured **at server/account level**.

So the per-gym callback URL is _not_ available on a shared account — there is
**one** endpoint receiving events for every gym. That kills the per-gym path
token as a routing mechanism, though not as an auth mechanism:

- **One platform-wide path token** (≥128 bits, rotatable) authenticates the
  endpoint — the standard approach for a webhook with no signature scheme.
- **The gym is resolved from `DeviceID`** (the `DevSN`) via `access_devices`,
  which is why that column is globally unique (§4). An event for an unknown
  serial is logged and dropped, never guessed at.
- **Optional IP allowlist** as a second factor, the other mechanism VFT
  suggested, once we know their egress addresses.
- Rate limiting, strict Zod parsing of the array, per-event idempotency on
  `UNIQUE(gym_id, device_serial, subject_id, occurred_at)`, and an
  **always-200** contract — the same contract the PayHere webhook follows.

**Security consequence worth stating plainly:** on a shared account we receive
attendance events for _every_ gym on that account, including any that are not
our customers. We store only events whose `DevSN` maps to a device we know, and
the ingestion path never trusts a gym id from the payload.

### 5.2 Denied scans are not ingested — deliberately

We assume rejections (expired validity, unknown template) do **not**
arrive on the webhook. They land in the device transaction table, reachable
only by polling `DATA QUERY tablename=transaction` — a raw, queued command.

We are not building that polling loop, because we do not need it. Your
description of the member experience is the reason:

> When a membership is expired, the gate simply does not open and the reader
> shows an error on its screen.

Our database already knows _why_ — expired, suspended, cancelled, unverified.
The front desk sees the real reason in our app the moment they look the member
up; the member sees the device error at the gate. Polling the vendor to be told
something we already know would add a queued command per device per interval
for no information gain.

`access_events` therefore records **successful entries only**. If denial
analytics are ever wanted, the transaction-table poll is the documented way in.

---

## 6. Identity mapping — settled

Working assumption on the two facts that decide this (**unverified**):

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

| If VFT issues…                  | Global sequence still correct?                 |
| ------------------------------- | ---------------------------------------------- |
| separate credentials per gym    | Yes — IDs are merely sparse, which is harmless |
| one shared account for all gyms | Yes — and it is the _only_ safe option         |

Because VFT offered per-gym credentials as an option rather than a product
feature, the shared-account case must be assumed. The earlier
`subject_id_strategy` column is therefore deleted: there is one strategy.

This is reinforced by the assumption that We assume (**unverified**) `EmpId` is unique
**account-wide**, and that reusing one across areas _"will overwrite or mutate
the existing user record"_ — so a collision does not error, it **silently
overwrites another gym's member**. The global sequence is mandatory.

**9 digits, not 24.** The ceiling varies by hardware model and we cannot audit
every unit a gym might own, so we stay inside the narrowest documented limit.
A sequence starting at 100000 leaves headroom for ~999 million members.

**Verify truncation empirically** on the first test device: push a 9-digit
`EmpId` and confirm the device stores it whole rather than silently truncating.
Silent truncation is the failure mode that grants the wrong member access, and
it is invisible until someone walks through a door they shouldn't.

The fleet is **assumed** to be **MB20, K40, F18 and SpeedFace** terminals.
K40 and F18 are older entry-level units, and some of their firmware builds cap
the user `Pin` well below 9 digits. **If the real cap turns out to be 5 digits,
the global namespace is only 99,999 subjects across every gym on the account** —
which is a genuine ceiling, not a theoretical one. In that case the options are
recycling ids from long-cancelled members, or per-gym accounts (which resets the
namespace per account). This is the strongest technical argument for §6.1 below.

### 6.1 `AreaID` is a filter, not a security boundary

This is the most security-significant assumption in the whole design, and it is **unverified**:

> `AreaID` functions as a **logical filter, not a strict multi-tenant
> authorization barrier**. An `APIToken` issued for the account has **full
> administrative access to query, modify, or delete records across all
> `AreaID` records** unless the client application explicitly scopes every
> request payload.

Combined with the assumption that `EmpId` is unique **account-wide**, and
reusing one across areas _"will overwrite or mutate the existing user record"_ —
this means: on a shared account, **our application code is the only thing
standing between one gym and another gym's members and doors.** A scoping bug
does not produce an error; it silently mutates another tenant's data.

Three consequences, all binding:

1. **Credentials never reach a gym user.** Already the design (§4: secrets in a
   service-role-only table, AES-256-GCM, no gym-side read policy). This answer
   is why that is non-negotiable rather than merely tidy — anyone holding the
   credentials holds every gym on the account.
2. **Every identifier sent to the provider is resolved from our own database
   under RLS — never from request input.** A route accepts a `memberId`; the
   repository resolves gym → `area_id` → `subject_id` → `device_serial` from
   rows the session's RLS already permits. The provider is never handed an id
   that came off the wire. This is the single invariant that makes the shared
   account survivable, and it belongs in the repository layer where it cannot
   be forgotten per-route.
3. **Per-gym accounts become a commercial ask, not just an architectural
   preference.** Technically we can operate on a shared account; the isolation
   simply rests entirely on us. Given (1), (2), and the possible 5-digit `Pin`
   ceiling above, it is worth pressing VFT for per-gym credentials as a
   contractual matter.

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
blocked at 16th 00:00 _while `status` is still `Active`_ (the pre-cron window —
the case where app and door would otherwise disagree);
`YYYYMMDD` formatting and the inclusive paid-through boundary;
retry/backoff maths; Zod parsing of vendor responses _and_ of malformed ones;
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

| #      | Finding                                                                                                                                                                                                                                                                           | Resolution                                                                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1** | The first draft put `IAccessControlProvider` and the VFT client inside `features/access-control/services/providers/`, copying the SMS layout. R8 says external-service wrappers belong in `lib/`, and both PayHere and R2 put the **port itself** there too — SMS is the outlier. | Split into `src/lib/access-control/` (port, VFT client, Mock, config, crypto) and `src/features/access-control/` (domain, use-cases, repository, factory). §3.0 |
| **F2** | The first draft exposed `PATCH /devices/[id]` as a general update endpoint, which would let a device be enabled/disabled through a generic write — rule 2.5 forbids exactly that.                                                                                                 | Dedicated `/enable` + `/disable` transition endpoints; `PATCH` reduced to name/purpose per rule 2.5.1. §5                                                       |

### Rule-by-rule

| Rule                          | Status                                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** one architecture       | ✅ no `core/`/`infrastructure/`/`presentation/`/`services/`; logic in `features/`, glue in `lib/`. `arch:check` clean.                                                                                                                    |
| **R2** deletable in isolation | ✅ after the §9 composition rule — no feature imports access-control. ⚠️ one honest caveat below.                                                                                                                                         |
| **R3** internal shape         | ✅ only canonical folders (`config/ domain/ services/ schemas/ utils/ components/ types/ tests/`).                                                                                                                                        |
| **R4** `index.ts` barrel      | ✅ — and it must land in the **first** Phase-1 commit, or the pre-commit `arch:check` fails.                                                                                                                                              |
| **R5** single ownership       | ✅ `MemberStatus`/`PlanType` imported from `features/members/config/`, `SaasTier` from `SubscriptionConfig.ts`, `accessControlHardware` read from `PlanRestrictions`. New enums owned solely by `AccessControlConfig.ts`. No duplication. |
| **R6** thin routes            | ✅ auth → capability check → Zod → one factory call. No new R6 exception is requested.                                                                                                                                                    |
| **R7** factory composition    | ✅ `services/factory.ts` is the only wiring point; session vs service-role client specified per route (§5).                                                                                                                               |
| **R8** layer discipline       | ✅ **after F1**. `lib/` holds zero gym rules; `utils/` stays pure; feature UI stays in the feature.                                                                                                                                       |
| **R9** tests with code        | ✅ locations pinned in §8.                                                                                                                                                                                                                |
| **R10** clean root/docs       | ✅ this doc is in `docs/architecture/`; vendor questions in `docs/integrations/vft/`. No root files.                                                                                                                                      |
| **R11** migrations            | ✅ single unique-timestamp migration, `CREATE TABLE IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` before create, empty-DB replayable.                                                                                                          |
| **R12** commits/releases      | ✅ Conventional Commits; no version bump, no CHANGELOG release edit, no tags.                                                                                                                                                             |
| **R13** types & validation    | ✅ `strict`, zero `any` (vendor responses parsed from `unknown`), Zod on every input, **`z.nativeEnum()`** for the new domain enums (rule 2.2), `ResponseBuilder` + serializers (rules 2.3 / 2.11).                                       |
| **2.6** cron logging          | ✅ both crons via `CronLogger`.                                                                                                                                                                                                           |
| **2.8 / 2.9** error surfacing | ✅ pending ≠ error; sanitized for gym managers, raw for SaaS admins.                                                                                                                                                                      |
| **2.10** query ordering       | ✅ `access_events` and `access_sync_jobs` are time-series — "latest" reads always `ORDER BY … DESC` in SQL before any `.find()`.                                                                                                          |
| **2.13** tier gating          | ✅ capability read from the `PlanRestrictions` matrix only; no `tier === 'enterprise'` anywhere.                                                                                                                                          |
| **2.17** design system        | ✅ §9.                                                                                                                                                                                                                                    |

### Honest caveat on R2

The outbox is enqueued by a trigger on the `members` table (§4.1), so the
_database_ carries a dependency that the _code_ does not. Deleting
`features/access-control/` would leave an orphan trigger behind. R2 governs
code coupling — and by that measure the design is clean, since `features/members`
contains zero references to access-control. To keep the DB honest too:

- the trigger function no-ops when the gym has no `access_control_accounts` row,
  so it is inert for every non-Enterprise gym;
- feature removal ships a paired teardown migration, noted here so it is not
  discovered later.

### Follow-ups this integration owed the rulebook — **done**

All three landed with the routes and crons:

1. ✅ `access-control` added to the feature lists in `CLAUDE.md`,
   `.claude/rules/architecture.md` §1.1, and the canonical structure block of
   `feature-first-growth-rules.md`;
2. ✅ Pattern Index row **2.18** added in `.claude/rules/architecture.md`,
   pointing at this file — added only now that the code exists, since that
   index lists enforced rules rather than plans;
3. ✅ both cron jobs added to `docs/ops/CRON_JOBS.md` and `vercel.json` —
   `drain-access-sync` (every 5 min) and `reconcile-access` (`30 18 * * *`,
   00:00 SLT). `CRON_JOBS.md` records **why** `reconcile-access` sits outside
   the pinned member-status chain (§3.4/§5): it is date-driven, not
   status-driven, so it has no ordering dependency and must not be added to
   `cron-schedule-order.test.ts`. Its schedule is pinned in
   `src/app/api/cron/__tests__/access-control-crons.test.ts` instead.

---

## 11. Phasing

Each phase ships and is independently useful; nothing before Phase 2 touches
the network.

| Phase | Content                                                                                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | **Send `vft-integration-questions.md` and request test hardware.** Runs in parallel with Phase 1 — Phase 1 touches no network, so it is not blocked. Phase 2 is. |
| **1** | Migration, config, `resolveAccessDecision`, port, Mock provider, repository, factory, unit tests. Zero network.                                                  |
| **2** | `VftAccessControlProvider`, credentials + device settings UI behind `FeatureGate`, "verify connection".                                                          |
| **3** | Member sync: trigger outbox, drain + reconcile crons, member access panel, enrolment trigger, `/system-health` surfacing.                                        |
| **4** | Attendance webhook + check-in log UI — a genuinely new capability (the app has no attendance data today).                                                        |
| **5** | Remote unlock, reboot, device command console, audit trail.                                                                                                      |

---

## 12. What is still open

VFT's full reply and the resulting decisions are recorded in
**`docs/integrations/vft/vft-api-assumptions.md`**. Nothing outstanding blocks
Phase 1. What remains:

**Operational parameters — now quantified, and built to them**

| Parameter          | VFT's answer                                                                     | Built as                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Rate limit         | Undocumented; keep **under 10 req/s**                                            | Pace at ~5/s for margin; diff-based reconcile (§4.3) keeps volume low anyway                                                         |
| Error responses    | Undocumented; standard `401` / `400` / `500`                                     | Retry `500` + timeouts with backoff; never retry `400`; on `401` refresh the token once, then retry once                             |
| Token invalidation | Tokens stay valid until expiry; a new sign-in does **not** invalidate prior ones | Concurrent serverless instances are safe. Per-gym cached token, refresh on `401`. Expiry duration still unstated → proactive refresh |
| Webhook retries    | Undocumented; ack immediately with `200`                                         | Always-200 + idempotency constraint — correct under any retry policy                                                                 |
| Enrolment timeout  | **30–60 s** of sensor inactivity                                                 | ~60 s countdown in the enrolment dialog, then poll `GET /api/template` to confirm                                                    |
| Poll interval      | **5–30 s**                                                                       | "Takes effect within about a minute" is an honest promise to staff                                                                   |
| Device capacity    | 1,000–3,000 templates; PUSH loop returns error codes when full                   | Detect from sync errors; warn the gym before the cap                                                                                 |
| Bulk validity      | **No bulk endpoint**                                                             | One call per member/device → §4.3 diff-based reconcile is a requirement, not an optimisation                                         |

**Still genuinely unknown:** token expiry duration, and the real `Pin` width on
K40/F18 firmware (§6).

**To verify on the first test device** — cheaper to measure than to ask again.
We assume (**unverified**) sandbox/test hardware needs manual provisioning by their admins,
so **request it now**; it gates nothing but shortens Phase 2 considerably.

1. **`EmpId` width on a K40 or F18** — does a 9-digit id store whole, or
   truncate? Highest severity in the whole integration: truncation grants the
   wrong member access and is invisible until someone walks through a door they
   shouldn't. If the real cap is 5 digits, §6's global namespace is 99,999 and
   the allocation strategy has to change.
2. **`EndDate` inclusivity** — VFT says inclusive through 23:59:59 local;
   confirm a member whose window ends today still gets in today.
3. **The §3.3 firmware hazard** — on the actual fleet, does a `validperiod`
   write clear an active `accessblock`? Our invariant makes this unreachable,
   but knowing the answer tells us whether template revocation is _required_ for
   suspensions or merely belt-and-braces.
4. **Command acknowledgement** — that a command really does vanish from
   `GET /api/devicecmd/{DevSN}` once applied, since that is our only completion
   signal.
5. **Offline buffering** — unplug, send `accessblock`, reconnect, confirm it lands.
6. **Clock skew detection** — that normalised `AttTime` minus receipt time is a
   usable drift signal in practice (§3.4).

**Ours to decide, not VFT's**

1. ~~**Member stops paying — do they get locked out?**~~ **Settled: yes**, from
   00:00 the day after `next_due_date` (§3.4). Already what the design produces.

   ⚠️ **Separate and still open — the _gym_ stops paying _us_.** That is a
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
4. **Per-gym VFT credentials — now a commercial ask, not just a preference.**
   The working assumptions are that `AreaID` is a filter and not an authorization
   boundary (§6.1), that `EmpId` is unique account-wide and reusing one
   _overwrites another tenant's user record_, and that the deployed fleet may
   cap `Pin` well below 9 digits. Each of those, on its own, is survivable; the
   combination means a single scoping bug in our code can silently mutate
   another gym's members, and a single leaked credential exposes every gym at
   once. Worth pressing VFT on contractually, even though the design works
   without it.

**Explicitly out of scope** (your calls, recorded so they are not re-litigated):
multi-finger enrolment, cross-device template propagation, device-replacement
migration, duplicate-finger detection, and template upload/restore. VFT
confirmed raw template upload is technically possible via
`DATA UPDATE tablename=templatev10`, so backup/restore remains available later
if it is ever wanted — but nothing in this build depends on it.

Internal product/legal decisions — ours, not the vendor's:

1. **Gym stops paying — do members get locked out?** Suspending a _gym's_ SaaS
   subscription and mass-blocking its members at the door is a physical-safety
   and reputational risk. Recommendation: **stop syncing, leave devices in
   their last known state**, and show the gym a banner. Needs an explicit
   product call before Phase 3.
2. **Biometric data is sensitive personal data.** Face and fingerprint
   templates live on the vendor's devices, but _we_ trigger enrolment, so the
   privacy policy needs a biometric-processing disclosure and registration
   needs an access-control consent alongside the existing `accepted_terms_at` /
   `accepted_gym_rules_at`. Settle before Phase 3 ships.
3. **Remote door-open is physical security.** Enterprise-only, gym-owner-only,
   rate-limited, and every invocation audited with actor and timestamp.
4. **Identity strategy** (§6) — depends on VFT Q1, but the call is ours.
