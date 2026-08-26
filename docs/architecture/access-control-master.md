# Access Control — Master Reference

> **This is the single source of truth for the VFT/ZKTeco biometric door
> integration.** It supersedes nothing and replaces nothing — the detailed
> documents it points at are still authoritative on their own subjects — but if
> you are starting a new session on this feature, **read this first and read it
> whole.** Everything a new session needs to avoid re-deriving, re-deciding, or
> re-breaking is here.
>
> **Status as of 2026-08-23:** backend complete, UI complete, 293 tests green,
> migrations applied to production. **Not yet exercised against real hardware or
> the vendor simulator.** Blocked on one product decision before enrolment can
> ship (§7.1).

---

## 0. How to use this document

| If you are…                              | Read                                           |
| ---------------------------------------- | ---------------------------------------------- |
| Starting fresh on this feature           | §1 → §2 → §4 → §7                              |
| About to change how access is decided    | §2, §5, §6 — then `domain/AccessDecision.ts`   |
| About to touch the vendor client         | §3 in full                                     |
| Preparing for the simulator session      | §3.10, §7.3, then `vft-simulator-test-plan.md` |
| Wondering why something is written oddly | §6 — it is probably a fix for a real defect    |
| Adding a feature                         | §9 first. Those are the traps.                 |

**Companion documents** (this one summarises them; they hold the detail):

| Document                                              | Holds                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `docs/architecture/access-control-integration.md`     | The full design: schema, routes, architecture compliance, audit history |
| `docs/architecture/access-control-ui-and-capacity.md` | Enrolment flow rationale, capacity/eviction policy derivation           |
| `docs/integrations/vft/vft-api-assumptions.md`        | Evidence-graded assumptions A1–A10 with containment analysis            |
| `docs/integrations/vft/vft-simulator-test-plan.md`    | The hardware session checklist — Parts A–H, ~90 items                   |
| `docs/integrations/vft/vft-call-briefing.md`          | The questions asked of VFT and how to position them                     |
| `docs/integrations/vft/vft-integration-questions.md`  | The original written question set                                       |
| `.claude/rules/architecture.md` Pattern Index 2.20    | The binding one-paragraph rule                                          |

---

## 1. The one-paragraph summary

Gyms on the **Enterprise** tier can connect ZKTeco fingerprint terminals sold
and supported by VFT. When a member pays, we push their paid-through date to the
reader as a **validity period**; the reader admits them from its own clock until
that date. When a member is cancelled we **block** them and **revoke the
template from the device** while leaving the vendor's central copy intact, so
eviction and return are reversible without re-enrolment. All hardware traffic
goes through a database outbox drained every five minutes; scans come back on a
webhook. The gym sees three screens: setup, a daily operations dashboard, and a
per-member panel. **Nothing we do gates a door in real time.**

---

## 2. The design principle — read this before changing anything

**The terminal is the authority, not us.**

We push each member's paid-through window as a device validity period and the
reader enforces entry from its own RTC. Three consequences, and every design
decision in this feature descends from at least one of them:

1. **Expiry survives total sync failure.** If our servers are down, every
   member's access still expires correctly on their paid-through date. The worst
   sustained outage degrades us to "expiry works, new payments don't extend" —
   recoverable, not dangerous.
2. **Our downtime can never lock a gym out of its own building.** We are not in
   the entry path. This is why a suspended _SaaS_ subscription skips a gym in
   the reconciler rather than revoking its members — a billing lapse must not
   lock members out.
3. **Blocks are explicit commands, never the absence of a grant.** A dropped
   message cannot silently grant access.

The failure-direction rule that follows:

> **Where an assumption could fail, it must fail toward refusing access — except
> where refusing would lock out a paying member, in which case it must be loud.**

**Access verdicts derive from `next_due_date`, not from `members.status`.** This
is why `reconcile-access` runs at **18:30 UTC (00:00 Sri Lanka time)**, the real
lockout boundary — _outside_ the pinned member-status cron chain, and it must
**not** be added to `cron-schedule-order.test.ts`.

---

## 3. Vendor knowledge — everything we know about VFT / ZKTeco

### 3.1 What the VFT API actually is

A thin REST wrapper over **ZKTeco's PUSH (ADMS) protocol** — published,
reverse-engineered, and implemented in multiple open-source libraries. Every
endpoint maps onto a documented PUSH primitive:

| VFT endpoint                 | Underlying PUSH mechanism                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| `POST /api/devicecmd`        | server queues `C:<CmdID>:<TYPE> <params>`                        |
| `GET /api/devicecmd/{DevSN}` | commands awaiting the device's `GET /iclock/getrequest?SN=` poll |
| `validperiod`                | `DATA UPDATE user … StartTime=… EndTime=…`                       |
| `enrollfinger`               | `C:<id>:ENROLL_FP`                                               |
| webhook attendance array     | device `POST /iclock/cdata?table=ATTLOG`                         |

So the risk is **not** "guessing at a black box" — it is "relying on a documented
protocol whose _wrapper_ we have not exercised". Ordinary integration risk.

**Commands are queued, not applied.** HTTP 200 confirms queuing only. There is no
per-command success callback in the wrapper we can see; queue drainage plus the
`Return` code is the completion signal. This is the entire reason the outbox
exists.

### 3.2 Authentication

- `POST /api/user/` `{email, password}` → `{token}`
- Token is sent back on every request as the **`ApiToken`** header — note the
  casing; VFT's own PDF §1.3 flags this as an inconsistency with `apitoken`.
- `GET /api/user/auth` validates a token.
- **Tokens stay valid until expiry; a new sign-in does not invalidate prior
  ones** (VFT confirmed). Concurrent serverless instances are therefore safe.
  Expiry _duration_ is still unstated → we refresh on 401 and retry once.

### 3.3 Endpoint map — verified path-for-path against the Postman collection

| Area                                 | Endpoints                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                                 | `POST /api/user/`, `GET /api/user/auth`, logout                                                                                                    |
| Topology                             | `/api/area`, `/api/device` (`DevSN`, `DevName`, `TimeZone` as minutes e.g. `"330"`, `AreaID`, `IsReboot`)                                          |
| Subjects ("employees" = our members) | `/api/template*` — `EmpId`, `EmpName`, `AreaID`                                                                                                    |
| Template sync                        | `/api/template/syncall \| syncone \| syncsometoall \| syncsometoone`                                                                               |
| Template removal                     | `DELETE /api/template/fromdev/{id}` (clears from devices, **keeps** the record) · `DELETE /api/template/{id}` (deletes employee **and** templates) |
| Rename subject                       | `PUT /api/template/edit/{id}` — body `{EmpName}` only                                                                                              |
| Rename device                        | `PUT /api/device/{DevSN}` — body `{DevName}` only                                                                                                  |
| Access commands                      | `/api/devicecmd/*` — `validperiod`, `accessgrant`, `accessblock`, `dooropen`, `reboot`, `events`, `enrollface`, `enrollfinger`                     |
| Queue inspection                     | `GET /api/devicecmd/{DevSN}`, plus delete of queued commands                                                                                       |
| Raw escape hatch                     | `POST /api/devicecmd` `{DevSN, Type:"General", Content:"<ZKTeco command string>"}`                                                                 |

**We deliberately do not build on the raw escape hatch.** Unvalidated, untyped,
firmware-specific. The typed endpoints cover every flow.

**Neither rename body carries `AreaID`.** The collection shows it commented out
as a sibling on the device one; sending it would turn a cosmetic edit into a
silent re-areaing. Pinned by assertion in `VendorWriteBack.test.ts`.

### 3.4 The inbound webhook

The platform POSTs an **array** of attendance events to a URL we supply:

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

Every field arrives as a **string**, numeric codes included, so each is coerced
explicitly. `AttTime` is **device-local** and converted using that device's
stored `timezone_offset_minutes`, never a global constant.

**Security:** one platform-wide path token (`/api/webhooks/access-control/[token]`)
is the _only_ credential — **no signature scheme exists** in this API. The gym is
resolved from `device_serial`, **never** from the payload body. Always-200 for
business outcomes so a retrying platform cannot be made to hammer us.

### 3.5 Return codes — the full 83-code table, classified

Source: VFT's transcribed PDF, supplied in full. Implemented in
`src/lib/access-control/returnCodes.ts`.

| Class            | Count         | Outbox behaviour                                                                                              |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| `Success`        | `Return >= 0` | Job succeeds                                                                                                  |
| `Retryable`      | 28            | Reschedule with backoff `[30, 120, 600, 1800, 7200]s`                                                         |
| `Permanent`      | 31            | Dead-letter immediately — retrying buries the real problem                                                    |
| `NeedsAttention` | 12            | Dead-letter and surface (e.g. `-18` full terminal)                                                            |
| `Benign`         | 2             | Not a failure at all                                                                                          |
| **Unknown**      | —             | **Falls through to `Retryable`** — bounded retries beat dead-lettering a transient, and backoff caps the cost |

**73 codes classified, 71 with plain-language descriptions.** Descriptions are
**SaaS-admin only** (rule 2.9) — a gym manager never sees a vendor code.

Codes worth knowing by heart:

| Code   | Meaning                            | Class                                                  |
| ------ | ---------------------------------- | ------------------------------------------------------ |
| `-2`   | No response from device            | Retryable                                              |
| `-18`  | **Terminal template storage full** | NeedsAttention → triggers capacity learning + eviction |
| `-13`  | Command does not exist             | Permanent                                              |
| `-708` | Unsupported command                | Permanent                                              |

### 3.6 Event codes — the full 128-code table, classified

Source: VFT's transcribed PDF, supplied in full. Implemented in
`src/features/access-control/config/DeviceEventCodes.ts`.

| Kind      | Count | Meaning                                                                                                                                      |
| --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Granted` | 24    | The door opened for someone                                                                                                                  |
| `Denied`  | 39    | Someone was refused                                                                                                                          |
| `Alarm`   | 8     | Needs urgent human attention                                                                                                                 |
| `System`  | 56    | Device/door state — health, not the member timeline                                                                                          |
| `Other`   | —     | **Defined by absence.** Every code we do not classify. Has no code list, so it cannot be an SQL filter — deliberately not offered in the UI. |

`codesForKind(kind)` returns the code list so the activity-log filter runs **in
SQL**. The four sets are asserted **disjoint** by test, so a filter cannot
double-count.

**Event `8` = "open the door remotely"** — this comes back through the webhook as
independent hardware confirmation that our remote-unlock actually happened.

### 3.7 Field limits (`src/lib/access-control/fieldLimits.ts`)

| Field              | Limit              | Handling                                                                                                                                   |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `EmpId`            | 15 chars           | `assertValidSubjectId` **throws** rather than truncating — silent truncation is the one failure mode that grants the _wrong_ member access |
| `EmpName`          | 24 chars           | `formatSubjectName` cuts on a word boundary and substitutes spaces with underscores                                                        |
| Personnel ID range | **1 – 79,999,999** | `MAX_SUBJECT_ID`, hard-capped in code and asserted in tests                                                                                |

### 3.8 Known vendor inconsistencies — reproduce them, do not "fix" them

1. **Parameter casing.** `validperiod`, `accessgrant`, `accessblock` take
   **`EmployeeId`** (capital E). `enrollfinger` and `enrollface` take
   **`employeeId`** (lowercase). **We reproduce this exactly.** It is not a bug
   in our client. Anyone "tidying" it will break enrolment.
2. **Header naming.** `ApiToken`, not `apitoken`. Flagged by VFT's own PDF §1.3.
3. **PDF vs collection drift.** The PDF documents logout as `GET` while the
   collection sends `POST`; §3.3 documents device update as
   `PUT /api/device/{id}` with an integer id while the collection uses the
   serial. **We follow the collection**, on the assumption it is more current.

### 3.9 VFT's answers — operational parameters, and what we built to them

| Parameter             | VFT's answer                                                               | Built as                                                             |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Rate limit            | Undocumented; keep **under 10 req/s**                                      | `VENDOR_MAX_REQUESTS_PER_SECOND = 5` for margin                      |
| Error responses       | Undocumented; standard `401`/`400`/`500`                                   | Retry 500 + timeouts; never retry 400; refresh token once on 401     |
| Token invalidation    | New sign-in does **not** invalidate prior tokens                           | Per-gym cached token, refresh on 401                                 |
| Webhook retries       | Undocumented; ack immediately with 200                                     | Always-200 + idempotency constraint — correct under any retry policy |
| Enrolment timeout     | **30–60 s** of sensor inactivity                                           | `ENROLMENT_POLL_TIMEOUT_MS = 120_000` (generous), polling every 3 s  |
| Poll interval         | **5–30 s**                                                                 | "Takes effect within about a minute" is the honest promise to staff  |
| Device capacity       | **1,000–3,000 templates**; PUSH loop returns error codes when full         | Learned from `-18`, or entered from the spec sheet                   |
| Bulk validity         | **No bulk endpoint**                                                       | Diff-based reconcile is a _requirement_, not an optimisation         |
| `EndDate` inclusivity | **"Expires on 15th means the member can walk in until 00:00 on the 16th"** | `validTo = next_due_date`                                            |

### 3.10 Evidence-graded assumptions — current state

Grades: **A** observed · **B** documented · **C** inferred · **D** guess.
**No grade-D assumption is allowed to gate door access.**

| #   | Assumption                                                | Grade             | If wrong                                                                                                                                          |
| --- | --------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Personnel ID numeric, 1–79,999,999                        | **B**             | Exhaustion (loud, slow), not truncation (silent). Cap is one constant.                                                                            |
| A2  | Devices acknowledge with a return code                    | **B**             | Degrade to disappearance-as-completion — the earlier design, still works                                                                          |
| A3  | Device poll interval ~30 s                                | **B**             | The UI copy is wrong, not the security                                                                                                            |
| A4  | Device-local enrolments reach the platform                | **B/C**           | Cannot confirm enrolment programmatically; **the door still works**, because access is governed by the validity window, not our flag              |
| A5  | `EndDate` inclusive, evaluated on-device                  | **A — CONFIRMED** | _Was_ the highest-blast-radius assumption. Now fact.                                                                                              |
| A6  | Enrolment API-triggered, completed at terminal            | **A — CONFIRMED** | Both paths exist; VFT confirmed the API one is intended                                                                                           |
| A7  | Reverse reconciliation                                    | design decision   | —                                                                                                                                                 |
| A8  | Attendance code tables                                    | **B → now A**     | Superseded by the full 128-code table (§3.6)                                                                                                      |
| A9  | `AreaID` is a filter, **not** an authorization boundary   | **C**             | We were merely stricter than necessary — costs nothing to be wrong                                                                                |
| A10 | `accessblock` can be disturbed by later user-table writes | **C/D**           | The guard costs nothing; the failure it prevents (silently un-suspending barred members nightly) is one we would never detect from inside the app |

**Still genuinely unknown:** token expiry duration, and the real `Pin` width on
K40/F18 firmware.

---

## 4. What is built — complete inventory

### 4.1 Database — 5 migrations, 6 tables, 5 functions

| Migration                                               | Contents                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `20260810000001_create_access_control.sql`              | 6 tables, subject-id sequence, enqueue trigger, RLS                                                                                       |
| `20260810000002_access_control_functions.sql`           | `allocate_access_subject_id`, `claim_access_sync_jobs`, `recount_device_templates`                                                        |
| `20260810000003_reclaim_stale_sync_jobs.sql`            | `reclaim_stale_access_sync_jobs`                                                                                                          |
| `20260812000001_per_device_templates.sql`               | **D1 fix** — `synced_device_serials TEXT[]`, `on_device` becomes `GENERATED ALWAYS AS (CARDINALITY(...) > 0) STORED`, per-serial recount  |
| `20260813000001_lock_down_access_control_functions.sql` | **Security fix** — `REVOKE ALL … FROM PUBLIC, anon, authenticated` on all 5 SECURITY DEFINER functions; `GRANT EXECUTE … TO service_role` |

**All applied to production (`kcafbafxjjrksicwewmp`) and verified.** Supabase
advisors are clean of everything this feature introduced.

| Table                     | Purpose                       | Notable                                                                                                |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `access_control_accounts` | Per-gym vendor account        | `last_verified_at` is the proof the credentials work                                                   |
| `access_control_secrets`  | Encrypted credentials         | **RLS enabled with NO policies** — service-role only. AES-256-GCM at rest.                             |
| `access_devices`          | Registered readers            | `template_count`, `template_capacity`, `clock_skew_seconds`, `last_seen_at`, `timezone_offset_minutes` |
| `member_access_subjects`  | Member ↔ `subject_id` mapping | `synced_device_serials[]`, `finger_enrolled`, `last_synced_valid_from/to/blocked`                      |
| `access_sync_jobs`        | **The outbox**                | DB-trigger enqueue, `FOR UPDATE SKIP LOCKED` claim, per-member serialisation                           |
| `access_events`           | Scans                         | Unique constraint gives idempotency; `raw` keeps the vendor payload for diagnosis                      |

### 4.2 `src/lib/access-control/` — stateful vendor glue (R8)

| File                           | Role                                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| `IAccessControlProvider.ts`    | The port — **19 methods**                                             |
| `VftAccessControlProvider.ts`  | Real client, verified path-for-path against the Postman collection    |
| `MockAccessControlProvider.ts` | Records commands; what every test drives                              |
| `returnCodes.ts`               | The 83-code table and its classification                              |
| `fieldLimits.ts`               | `EmpId`/`EmpName` limits, `formatSubjectName`, `assertValidSubjectId` |
| `crypto.ts`                    | AES-256-GCM credential encryption                                     |
| `rateLimit.ts`                 | Paces provider calls — stateful, hence `lib/` not `utils/`            |
| `config.ts`                    | Env reading, `ACCESS_CONTROL_ENABLED`                                 |

### 4.3 `src/features/access-control/`

**Domain (pure, unit-testable without a database):**

- `AccessDecision.ts` — **the sole authority on who may enter.** Both the sync
  path and the member panel call it, so the screen cannot disagree with the door.
- `AccessCommands.ts` — derives the command list from a decision + current state
- `EvictionPolicy.ts` — `selectEvictionCandidates`, `slotsToReclaim`

**Services (14):** `SyncMemberAccess`, `DrainAccessSyncQueue`,
`ReconcileMemberAccess`, `RecordAccessEvents`, `EvictInactiveSubjects`,
`OperateDevice`, `VerifyAccessAccount`, `ManageMemberBiometric`,
`GetMemberAccessStatus`, `RefreshDeviceStatus`, `DetectBiometricEnrolment`,
`PushRename`, `provisionMemberAccessBestEffort`, plus the Supabase repository.
Composition through `services/factory.ts` (R7).

**UI (6 components + 2 pages):**

| Surface                    | Components                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `/settings/access-control` | `AccessAccountCard`, `AccessReadersCard`                                               |
| `/access-control`          | `AccessControlDashboard`, `DeviceStatusCard`, `AccessActivityLog`                      |
| Member modal               | `MemberAccessPanel`, composed via an `accessSlot` prop from `member-modal.context.tsx` |

**Client layer:** `services/access-control.service.ts` (fetch + envelope) and
`hooks/useAccessControl.ts` (React Query + `useEnrolmentPoll`).

> ⚠️ **Both deep-import their types.** The feature barrel (`index.ts`) re-exports
> `services/factory`, which reaches `next/headers` through the Supabase server
> client — importing it from a client component fails the build. Same escape as
> rule 2.15's `getSafeRedirect`.

### 4.4 Routes — 16 gym-facing + 1 webhook + 1 admin

All gym-facing routes go through **`requireAccessControlGym`** (session + gym +
Enterprise capability, **fails closed**).

```
GET|PUT  /api/access-control/account
POST     /api/access-control/account/verify
GET|POST /api/access-control/devices
PATCH    /api/access-control/devices/[id]              rename + capacity
POST     /api/access-control/devices/[id]/enable|disable|unlink|open|reboot|free-space
GET      /api/access-control/events                     paged, kind-filtered
GET      /api/access-control/members/[id]               sanitized status
POST     /api/access-control/members/[id]/sync|enrol
GET      /api/access-control/members/[id]/enrolment
DELETE   /api/access-control/members/[id]/biometric
POST     /api/webhooks/access-control/[token]           always-200
GET      /api/admin/system-health/access-control        SaaS-admin only; raw vendor detail
```

**State transitions get dedicated endpoints (rule 2.5).** The device `PATCH`
handles name and capacity only — nothing that could flip `is_active` as a side
effect of an edit nobody reviewed as a state change.

### 4.5 Crons

| Schedule      | Path                          | Job                                                                 |
| ------------- | ----------------------------- | ------------------------------------------------------------------- |
| `*/5 * * * *` | `/api/cron/drain-access-sync` | Drain the outbox; refresh device presence; proactive capacity sweep |
| `30 18 * * *` | `/api/cron/reconcile-access`  | Nightly diff at 00:00 SLT — the real lockout boundary               |

Both log to the cron audit table (rule 2.6).

### 4.6 The tuned constants — and why each number is what it is

`src/features/access-control/config/AccessControlConfig.ts`

| Constant                          | Value                        | Reasoning                                                                                                                                             |
| --------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAX_SUBJECT_ID`                  | 79,999,999                   | ZKBioSecurity documented Personnel ID ceiling                                                                                                         |
| `GYM_TIMEZONE`                    | `Asia/Colombo`               | Access boundaries are gym-local calendar days                                                                                                         |
| `SYNC_RETRY_BACKOFF_SECONDS`      | `[30, 120, 600, 1800, 7200]` | 5 attempts over ~3 h                                                                                                                                  |
| `VENDOR_MAX_REQUESTS_PER_SECOND`  | 5                            | Half VFT's stated ceiling, for margin                                                                                                                 |
| `DEVICE_CLOCK_SKEW_ALERT_SECONDS` | 300                          | The door judges expiry from its own clock                                                                                                             |
| `STALE_JOB_RECLAIM_SECONDS`       | 600                          | Longer than a drain, shorter than a member noticing                                                                                                   |
| `DRAIN_BATCH_SIZE`                | 25                           |                                                                                                                                                       |
| `DEVICE_CAPACITY_EVICT_ABOVE`     | 0.85                         |                                                                                                                                                       |
| `DEVICE_CAPACITY_TARGET`          | 0.70                         |                                                                                                                                                       |
| `DRAIN_INTERVAL_SECONDS`          | 300                          | **Mirrors `vercel.json`. Declared here because the next line depends on it.**                                                                         |
| `DEVICE_OFFLINE_AFTER_SECONDS`    | `DRAIN_INTERVAL_SECONDS * 3` | **N2 fix.** They were equal, so every healthy reader flickered offline. A test asserts the inequality — retuning either in isolation fails the build. |
| `ENROLMENT_POLL_INTERVAL_MS`      | 3,000                        | A person is watching                                                                                                                                  |
| `ENROLMENT_POLL_TIMEOUT_MS`       | 120,000                      | Walk from desk to reader, with room                                                                                                                   |

### 4.7 Tests — 293 across 20 suites

Notable ones, because they encode decisions rather than behaviour:

| Suite                                    | Guards                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DoorAgreement.reverse.test.ts`          | Our idea of access still matches what a terminal would actually do. **Must stay green through any change.** |
| `InvertedAssumptions.reverse.test.ts`    | The five D-defects (§6)                                                                                     |
| `InvertedAssumptionsTwo.reverse.test.ts` | The four N-defects (§6)                                                                                     |
| `vendorTables.test.ts`                   | Return/event code classification                                                                            |
| `useEnrolmentPoll.test.tsx`              | Timeout ≠ failure, unmount stops polling                                                                    |
| `RegistrationAndLog.test.ts`             | Inline provision never throws; kind sets disjoint                                                           |

### 4.8 Environment

```bash
ACCESS_CONTROL_ENABLED=false          # off ⇒ MockAccessControlProvider answers everything
VFT_API_BASE_URL=https://vft.example.com
ACCESS_CONTROL_ENCRYPTION_KEY=        # base64, 32 bytes — credentials cannot be stored without it
ACCESS_CONTROL_WEBHOOK_TOKEN=         # hex 64 — the ONLY webhook credential
```

---

## 5. The flows, end to end

**Registration → hardware.** Member created → DB trigger enqueues a job **and**
`provisionMemberAccessBestEffort` pushes inline, awaited but **never fatal**. A
gym must be able to sign someone up whether or not a door controller is
reachable. Deliberately **not** wired into bulk import (1000 inline vendor calls)
or QR self-registration (unverified members produce no commands).

**Payment → extended window.** `next_due_date` moves → trigger enqueues →
drain sends `validperiod`. The reader admits them through the new date.

**Cancellation → blocked + template revoked.** `accessblock` **plus**
`DELETE /api/template/fromdev/{id}`. **Never `RemoveSubject`** — the vendor keeps
the central copy, so eviction and return are reversible without re-enrolment.
A blocked subject is **never** sent a validity period (A10 guard).

**Enrolment.** Desk presses the button → `enrollfinger` puts the reader into
enrolment mode → member presents a finger → `useEnrolmentPoll` polls
`/enrolment` until it appears. Detection is **additive only** — it can set
`finger_enrolled` true, never false (N3).

**A scan.** Device → webhook → Zod parse → group by `DeviceID` → resolve gym from
`device_serial` → normalise `AttTime` by that device's offset → resolve member →
classify → insert (idempotent). Clock skew inferred from the **newest** scan in
the batch (D4).

**Capacity.** `-18` → recount the _refusing_ reader → record its limit → evict
in strict order: cancelled (oldest) → expired (longest) → suspended. **Never an
active member** — a shortfall is reported instead. That is a "buy a second
reader" conversation, not something to solve by locking out someone who paid.

> **Ordering insight worth keeping:** the proactive sweep **cannot fire until a
> `-18` has taught us a reader's limit**, because `slotsToReclaim` refuses to
> guess at unknown capacity. That is deliberate, not a bug — and it is exactly
> why manual capacity entry was added in B3.

---

## 6. Defect history — nine defects, found by inverting assumptions

**Do not reintroduce these.** Every one was invisible to forward tests and found
by asking "what if the opposite were true?".

| #      | Inverted assumption                                  | The defect                                                                                                                                     |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | "A gym has one reader"                               | Templates were tracked per member, not per device                                                                                              |
| **D2** | "The reconciler is entitled to run"                  | It was not gated on the Enterprise capability                                                                                                  |
| **D3** | "Pending covers every non-success"                   | A dead-lettered job read as allowed with nothing queued — green tick, closed door. `syncFailed` added.                                         |
| **D4** | "Any scan in a batch dates the batch"                | Skew measured from an arbitrary scan; now the **newest**, because batching can only make a reader look slow                                    |
| **D5** | "The event knows who it was"                         | Resolved member was not persisted                                                                                                              |
| **N1** | "A gym reporting a full reader has only one reader"  | `-18` stamped capacity on **every** reader. A roomy reader would record its _current count_ as its limit and be evicted from forever.          |
| **N2** | "Constants chosen separately can be read separately" | `DEVICE_OFFLINE_AFTER_SECONDS` equalled the drain interval → permanent offline flicker. Neither constant was wrong alone.                      |
| **N3** | "No template at the vendor means no fingerprint"     | Detection cleared `finger_enrolled` on a zero count — but a member evicted for capacity would then be told to re-scan a finger already on file |
| **N4** | "A reader never counted can be measured"             | Capacity learned from a count only written during eviction; the first `-18` found zero and recorded nothing                                    |

**A tenth finding was in the test doubles, not the code.** The fake repository's
`recountDeviceTemplates` returned a flat zero — a lie in exactly the direction
that mattered, since capacity learning reads that number. **A fake returning a
convenient constant can hide the bug you are hunting.**

---

## 7. What is NOT built

### 7.1 Blocking product decisions — these are yours, not engineering's

1. **Biometric consent. ⚠️ BLOCKS SHIPPING ENROLMENT.** Fingerprint templates are
   sensitive personal data and we now trigger collection from our own UI. The
   privacy policy needs a biometric-processing disclosure, and registration needs
   a consent field alongside `accepted_terms_at` / `accepted_gym_rules_at`. The
   enrolment dialog is the moment of collection, so this must land first.
2. **May front-desk staff open a door remotely?** Currently every user with the
   capability can. `DeviceStatusCard` already takes a `canRemoteOpen` prop
   (defaulting `true`) — restricting it is a one-line change plus a role check.
3. **Event retention.** Attendance data about identifiable people, currently kept
   forever. 12 months is the obvious candidate; the decision is yours.

### 7.2 Engineering — known gaps, none blocking

| Gap                                              | Note                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No E2E (Playwright) coverage                     | Unit + integration only. Worth adding once the simulator confirms the flows.                                                                                                                                                                      |
| `npm run build` unverified in CI-like conditions | Blocked in the sandbox by Google Fonts being unreachable — `layout.tsx` fetches Geist/Geist Mono/Inter at build time. **Those three are the only errors; no feature module failed to compile.** Run a real build before merge.                    |
| Multi-finger enrolment                           | Deliberate scope reduction — one finger per member. The API supports `fingerId` 0–9; the schema records a single finger.                                                                                                                          |
| Cross-device template migration                  | Deliberate — single gate per gym assumed. The port keeps `syncone`/`syncsometoone`; nothing in the product depends on them.                                                                                                                       |
| Manual "mark as enrolled" fallback               | The A4 containment plan names it; not built. Only needed if templates never surface via the wrapper.                                                                                                                                              |
| Occupancy / time-in-gym                          | **Deliberately never.** With one reader serving entry and exit, `CheckingStatus` reports the device's configured mode, not reality. Events are **visits**, not paired sessions. Building this would be inventing data the hardware does not have. |

### 7.3 Cannot be resolved without hardware

The simulator session plan is `vft-simulator-test-plan.md` — Parts A–H, ~90
items, with a "if you only get an hour, do these eight" list at the end.

**The single highest-priority unknown:**

> **A-1 — do refused scans reach the webhook at all?** If yes, the activity log's
> Refusals filter (already built, already server-side) starts working with no
> code change. If no, the log is entries-only. **Also check
> `POST /api/devicecmd/events`** — if refusals are _pullable_ from the
> transaction table, the answer changes from "cut the refusal rows" to "poll for
> them", which is a different design rather than a smaller one.

Then, in order: A-3 (`EndDate` inclusivity — highest blast radius), A-8 (does a
later write disturb a block — shaped the command derivation), C-1.3 (does an
offline reader still admit valid members — **the core premise**), B-9/B-10
(cancel then rejoin without re-enrolling — decides whether eviction is safe),
A-4 (who assigns the `EmpId` — decides whether our identity model holds), A-10
(timezone — a wrong reading makes every timestamp 5½ h out), G-1 (webhook
rejects a bad token).

---

## 8. Verification — current state and how to re-run it

```bash
npm run arch:check && npx tsc --noEmit && npm test && npm run lint
```

| Check             | State                                                             |
| ----------------- | ----------------------------------------------------------------- |
| `arch:check`      | ✅ feature-first invariants hold                                  |
| `tsc --noEmit`    | ✅ zero errors                                                    |
| `npm test`        | ✅ 1,221 passing, 7 skipped (293 in access-control)               |
| `npm run lint`    | ✅ zero errors (13 pre-existing warnings, none from this feature) |
| `npm run build`   | ⚠️ blocked in sandbox by Google Fonts only                        |
| Supabase advisors | ✅ clean of everything this feature introduced                    |

**Branch:** `claude/access-control-integration-h3lg91`.
Latest commits: `13f02c5` (simulator plan), `44a5b30` (UI), `cc45bd6` (backend
write-back), `f57a0af` (full code tables).

---

## 9. Traps for the next session

Ten things that will bite someone who does not know them.

1. **Do not import `@/features/access-control` from a client component.** The
   barrel is server-only. Deep-import from `utils/serializeAccessForAPI`,
   `config/`, or `types/`.
2. **Do not "fix" the `EmployeeId` / `employeeId` casing inconsistency.** It is
   the vendor's, we reproduce it deliberately, and correcting it breaks enrolment.
3. **Do not add `reconcile-access` to `cron-schedule-order.test.ts`.** It sits
   outside the pinned member-status chain on purpose — 18:30 UTC is 00:00 SLT,
   the real lockout boundary.
4. **Do not send a validity period to a blocked subject** (A10). Every write is
   driven by `resolveAccessDecision`, so a blanket refresh is unreachable by
   construction. Keep it that way.
5. **Do not use `RemoveSubject` for cancellation.** Block + `fromdev`. The
   central copy is what makes return reversible without re-enrolment.
6. **Never resolve a gym from a webhook payload.** Always from `device_serial`.
   The vendor token reaches every terminal on the account; our lookup is the only
   tenant boundary that exists.
7. **Never show a vendor return code to a gym manager** (rule 2.9). Raw detail is
   `/system-health` only.
8. **Pending is not failure, and failure is not "fine"** (rule 2.8). Both states
   exist for a reason — see D3.
9. **Presence has three states.** `unknown` is not `offline`. Collapsing them
   puts a false alarm on the screen built to prevent false alarms.
10. **Enrolment detection is additive only.** It may set `finger_enrolled` true,
    never false. Clearing has its own path, which knows it meant it.

---

## 10. One-line orientation

> A gym pays us; we tell a fingerprint reader how long that member may come in;
> the reader remembers, and enforces it from its own clock, whether or not we are
> still here.
