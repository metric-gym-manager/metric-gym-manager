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

A new, deletable feature folder — `src/features/access-control/` — following
the canonical shape (R1–R4):

```
src/features/access-control/
  config/AccessControlConfig.ts        # enums, retry/backoff, VerifyType/Event code maps
  domain/
    AccessDecision.ts                  # ← the heart: pure, no I/O
    AccessDevice.ts
  services/
    IAccessControlProvider.ts          # PORT — vendor-neutral vocabulary
    providers/VftAccessControlProvider.ts
    providers/MockAccessControlProvider.ts
    IAccessControlRepository.ts
    SupabaseAccessControlRepository.ts
    SyncMemberAccess.ts                # one member → device commands
    SyncGymDevices.ts                  # pull/reconcile device inventory
    DrainAccessSyncQueue.ts            # outbox drainer (cron)
    ReconcileMemberAccess.ts           # daily re-assert (cron)
    RecordAccessEvents.ts              # webhook ingestion
    OperateDevice.ts                   # remote unlock / reboot
    factory.ts
  schemas/access-control.schemas.ts    # Zod for OUR inputs *and* for vendor responses
  components/                          # devices page, member access panel, enrolment dialog
  types/index.ts
  tests/
  index.ts
```

### 3.1 The port

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

### 3.2 The domain core

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
GET|PUT   /api/access-control/account              # configure credentials (write-only secrets)
POST      /api/access-control/account/verify       # sign-in probe, sets last_verified_at
GET|POST  /api/access-control/devices
PATCH|DELETE /api/access-control/devices/[id]
POST      /api/access-control/devices/[id]/open    # remote unlock — audited, rate-limited
POST      /api/access-control/devices/[id]/reboot
POST      /api/access-control/members/[id]/sync    # force re-assert
POST      /api/access-control/members/[id]/enrol   # {method:'face'|'finger', deviceId, fingerId?}
GET       /api/access-control/events               # check-in log, paginated

POST      /api/webhooks/access-control/[token]     # inbound attendance events
GET|POST  /api/cron/drain-access-sync              # every 5 min
GET|POST  /api/cron/reconcile-access               # daily, AFTER update-expired-status
```

**Cron ordering is load-bearing.** `update-expired-status` flips Active →
Expired; `reconcile-access` must run after it, or the day's expiries won't
reach the doors until the following run.

Both crons use `CronLogger` (rule 2.6) and surface into the SaaS-admin
`/system-health` dashboard alongside SMS failures — stuck/dead sync jobs and
unreachable devices are exactly the infra detail that belongs there and **not**
in front of gym managers (rule 2.9 / 2.8).

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

---

## 9. Phasing

Each phase ships and is independently useful; nothing before Phase 2 touches
the network.

| Phase | Content |
| --- | --- |
| **0** | Vendor clarifications (§10) + the identity decision (§6). Runs in parallel with Phase 1. |
| **1** | Migration, config, `resolveAccessDecision`, port, Mock provider, repository, factory, unit tests. Zero network. |
| **2** | `VftAccessControlProvider`, credentials + device settings UI behind `FeatureGate`, "verify connection". |
| **3** | Member sync: trigger outbox, drain + reconcile crons, member access panel, enrolment trigger, `/system-health` surfacing. |
| **4** | Attendance webhook + check-in log UI — a genuinely new capability (the app has no attendance data today). |
| **5** | Remote unlock, reboot, device command console, audit trail. |

---

## 10. Open questions

Blocking or near-blocking, for the vendor unless noted:

1. **Per-gym accounts?** (§6) — the one answer that changes the schema.
2. **Webhook auth** — can the platform send a custom header or signature, and
   can the callback URL be set per gym?
3. **Undocumented code tables** — `CheckingStatus`, `VerifyType`, `Event`. We
   cannot classify entry vs exit vs denial without them.
4. **Command acknowledgement** — is a command disappearing from
   `GET /api/devicecmd/{DevSN}` the only "applied" signal, or is there a
   per-command status? This decides how the reconciler detects drift.
5. **Error contract** — no status codes, error bodies, or rate limits are
   documented anywhere in the PDF or collection.
6. **Doc contradictions to confirm:** `apitoken` vs `ApiToken` header casing;
   logout `GET` (PDF) vs `POST` (collection); device update by integer id (PDF)
   vs by `DevSN` (collection); `AreaID` present in the collection's
   employee-create body but absent from the PDF's.
7. **`AttTime` has no timezone.** Assume gym-local (Asia/Colombo) and store
   UTC — needs confirmation against a device set to a non-local `TimeZone`.

Internal product/legal decisions:

8. **Gym stops paying — do members get locked out?** Suspending a *gym's* SaaS
   subscription and mass-blocking its members at the door is a physical-safety
   and reputational risk. Recommendation: **stop syncing, leave devices in
   their last known state**, and show the gym a banner. Needs an explicit
   product call.
9. **Biometric data is sensitive personal data.** Face and fingerprint
   templates live on the vendor's devices, but *we* trigger enrolment, so the
   privacy policy needs a biometric-processing disclosure and registration
   needs an access-control consent alongside the existing `accepted_terms_at` /
   `accepted_gym_rules_at`. Should be settled before Phase 3 ships.
10. **Remote door-open is physical security.** Enterprise-only, gym-owner-only,
    rate-limited, and every invocation audited with actor and timestamp.
