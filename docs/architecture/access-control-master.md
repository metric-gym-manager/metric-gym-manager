# Access Control — Master Reference

> **This is the single source of truth for the VFT/ZKTeco biometric door
> integration.** It supersedes nothing and replaces nothing — the detailed
> documents it points at are still authoritative on their own subjects — but if
> you are starting a new session on this feature, **read this first and read it
> whole.** Everything a new session needs to avoid re-deriving, re-deciding, or
> re-breaking is here.
>
> **Status as of 2026-08-28:** backend complete, UI complete, tests green, all
> migrations applied, and **shipped to production** — `www.metricgymos.com`
> serves the feature and the webhook answers on it. **All four product
> decisions are made and built** (§7.1). The Playwright suite reaches a green
> run (§4.7). **VFT has supplied the API collection and both code tables**
> (§3.11); every endpoint we call is verified against it. **Still not exercised
> against real hardware or the vendor simulator**, which remains the critical
> path (§7.3) — and now needs only credentials (§8.5, B1).

---

## 0. How to use this document

| If you are…                              | Read                                                            |
| ---------------------------------------- | --------------------------------------------------------------- |
| **Asking "what is left to do?"**         | **§8.5 — workload, blockers, and who owns each**                |
| **Talking to VFT**                       | **§8.6 — what to ask for, what to give them**                   |
| **Calling a vendor endpoint**            | **`docs/integrations/vft/vft-api-reference.md` — vendor fact**  |
| **Handling an event or return code**     | **`docs/integrations/vft/vft-code-tables.md` — all 248 codes**  |
| Starting fresh on this feature           | §1 → §2 → §4 → §7                                               |
| About to change how access is decided    | §2, §5, §6 — then `domain/AccessDecision.ts`                    |
| About to touch the vendor client         | §3 in full                                                      |
| Preparing for the simulator session      | §8.4 (the gate), §3.10, §7.3, then `vft-simulator-test-plan.md` |
| Wondering why something is written oddly | §6 — it is probably a fix for a real defect                     |
| Adding a feature                         | §9 first. Those are the traps.                                  |
| Touching enrolment, retention or billing | §7.1 — those decisions are made; do not reopen                  |

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

| #   | Assumption                                                | Grade                              | If wrong                                                                                                                                          |
| --- | --------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Personnel ID numeric, 1–79,999,999                        | **B → A** (VFT: numeric, 15 chars) | Exhaustion (loud, slow), not truncation (silent). Cap is one constant.                                                                            |
| A2  | Devices acknowledge with a return code                    | **A — CONFIRMED**                  | Degrade to disappearance-as-completion — the earlier design, still works                                                                          |
| A3  | Device poll interval ~30 s                                | **B**                              | The UI copy is wrong, not the security                                                                                                            |
| A4  | Device-local enrolments reach the platform                | **B/C**                            | Cannot confirm enrolment programmatically; **the door still works**, because access is governed by the validity window, not our flag              |
| A5  | `EndDate` inclusive, evaluated on-device                  | **A — CONFIRMED**                  | _Was_ the highest-blast-radius assumption. Now fact.                                                                                              |
| A6  | Enrolment API-triggered, completed at terminal            | **A — CONFIRMED**                  | Both paths exist; VFT confirmed the API one is intended                                                                                           |
| A7  | Reverse reconciliation                                    | design decision                    | —                                                                                                                                                 |
| A8  | Attendance code tables                                    | **B → now A**                      | Superseded by the full 128-code table (§3.6)                                                                                                      |
| A9  | `AreaID` is a filter, **not** an authorization boundary   | **A — CONFIRMED** (default 1)      | We were merely stricter than necessary — costs nothing to be wrong                                                                                |
| A10 | `accessblock` can be disturbed by later user-table writes | **C/D**                            | The guard costs nothing; the failure it prevents (silently un-suspending barred members nightly) is one we would never detect from inside the app |

**Still genuinely unknown:** token expiry duration, and the real `Pin` width on
K40/F18 firmware. (VFT's 15-character answer is the _platform_ limit; the
firmware limit may be stricter, which is why the allocator stays at 79,999,999.)

---

### 3.11 The vendor documentation, and what it settled

VFT supplied the `VFT_GYM_API_V2.0` Postman collection, the 165-code event
table and the 83-code return-value table on **2026-08-28**. All three are in
`docs/integrations/vft/`:

| File                             | What it is                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `vft-gym-api-v2-collection.json` | The collection, importable, verbatim                                                             |
| `vft-api-reference.md`           | Endpoint contract, webhook payload, field limits, casing traps — **vendor fact, outranks §3.10** |
| `vft-code-tables.md`             | Both code tables in full, with our classification beside each                                    |

**All 17 endpoints we call match the collection exactly**, casing included —
verified 2026-08-28. The two-step VFT described on the call (`AddEmployee`
writes to their servers, a second call pushes to a reader) is already how
`Provision` → `SyncToDevice` works.

**It settled the "device timeout, 2 minutes" question.** That is return code
`-725`, _"it times out when the device waits for the result"_ — a value the
vendor reports, not a silent expiry. Already classified `Retryable`.

**It also found a live defect.** 38 of the 165 event codes were unclassified
and fell through to `Other`, among them **219** (a genuine entry) and **75** (a
genuine refusal). Because `codesForKind` is pushed to the database as an
`IN (...)`, those appeared in the check-in log's All view and in **none** of its
Entries / Refusals / Alerts filters. Worse, `vendorTables.test.ts` claimed to
assert full coverage — its own transcription of the table had been trimmed to
fit the implementation. Both are fixed; the test now asserts the table's size
before asserting anything about it (§6, D5; trap 25).

**Three capabilities we did not know existed** are recorded in §4 of the
reference: `GetEventsbyDevSN` (a pull path for attendance — the only recovery
route for scans lost while our webhook was down), `EnrollFace`, and
command-queue deletion.

---

## 4. What is built — complete inventory

### 4.1 Database — 5 migrations, 6 tables, 5 functions

| Migration                                               | Contents                                                                                                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260810000001_create_access_control.sql`              | 6 tables, subject-id sequence, enqueue trigger, RLS                                                                                                                                           |
| `20260810000002_access_control_functions.sql`           | `allocate_access_subject_id`, `claim_access_sync_jobs`, `recount_device_templates`                                                                                                            |
| `20260810000003_reclaim_stale_sync_jobs.sql`            | `reclaim_stale_access_sync_jobs`                                                                                                                                                              |
| `20260812000001_per_device_templates.sql`               | **D1 fix** — `synced_device_serials TEXT[]`, `on_device` becomes `GENERATED ALWAYS AS (CARDINALITY(...) > 0) STORED`, per-serial recount                                                      |
| `20260813000001_lock_down_access_control_functions.sql` | **Security fix** — `REVOKE ALL … FROM PUBLIC, anon, authenticated` on all 5 SECURITY DEFINER functions; `GRANT EXECUTE … TO service_role`                                                     |
| `20260826000001_add_biometric_consent.sql`              | `members.biometric_consent_at` — the enrolment gate. `register_member_guarded` deliberately **not** touched                                                                                   |
| `20260826000002_access_event_retention.sql`             | `idx_access_events_created_at` — global, oldest-first, and keyed on `created_at` rather than the device's clock (C1); both existing indexes lead with a tenant column the purge cannot supply |

**All applied to production (`kcafbafxjjrksicwewmp`) and verified**, including
the two dated 2026-08-26. Supabase advisors are clean of everything this
feature introduced.

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

**Services (15):** `SyncMemberAccess`, `DrainAccessSyncQueue`,
`ReconcileMemberAccess`, `RecordAccessEvents`, `EvictInactiveSubjects`,
`OperateDevice`, `VerifyAccessAccount`, `ManageMemberBiometric`,
`GetMemberAccessStatus`, `RefreshDeviceStatus`, `DetectBiometricEnrolment`,
`PushRename`, `PurgeExpiredAccessEvents`, `provisionMemberAccessBestEffort`,
plus the Supabase repository. Composition through `services/factory.ts` (R7).

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
POST     /api/access-control/members/[id]/sync|enrol   enrol carries `consent`
GET      /api/access-control/members/[id]/enrolment
DELETE   /api/access-control/members/[id]/biometric
POST     /api/webhooks/access-control/[token]           always-200
GET      /api/admin/system-health/access-control        SaaS-admin only; raw vendor detail
```

**State transitions get dedicated endpoints (rule 2.5).** The device `PATCH`
handles name and capacity only — nothing that could flip `is_active` as a side
effect of an edit nobody reviewed as a state change.

### 4.5 Crons

| Schedule      | Path                            | Job                                                                                                                                                 |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*/5 * * * *` | `/api/cron/drain-access-sync`   | Drain the outbox; refresh device presence; proactive capacity sweep                                                                                 |
| `30 18 * * *` | `/api/cron/reconcile-access`    | Nightly diff at 00:00 SLT — the real lockout boundary                                                                                               |
| `0 2 * * *`   | `/api/cron/purge-access-events` | Delete scans past `ACCESS_EVENT_RETENTION_DAYS`. Daily, because a monthly sweep would let data reach 13 months and make the published figure untrue |

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
| `ACCESS_EVENT_RETENTION_DAYS`     | 365                          | **The number published in the privacy policy.** Move one and the other has to move — a test asserts the constant is 365                               |
| `ACCESS_EVENT_PURGE_BATCH_SIZE`   | 500                          | An unbounded first `DELETE` after a year of collection is how a cron times out and makes no progress at all                                           |
| `ACCESS_EVENT_PURGE_MAX_BATCHES`  | 500                          | 250,000 rows a run; a larger backlog waits for tomorrow and the summary says so                                                                       |
| `ACCESS_EVENT_DELETE_CHUNK_SIZE`  | 100                          | **A transport limit, not a database one** (C2). `.in()` is a query string: 100 ids ≈ 3.9 KB, 500 ≈ 19.5 KB, gateways reject past ~8 KB                |

### 4.7 Tests — 371 across 26 suites

331 in 24 suites under `src/features/access-control/tests/` and
`src/lib/access-control/__tests__/`, plus two that live with the code they
guard: `access-control-crons.test.ts` (cron ordering) and
`BiometricConsentPersistence.test.ts` (the `members` row round-trip). §8.1
has the command that runs exactly this set.

Notable ones, because they encode decisions rather than behaviour:

| Suite                                       | Guards                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DoorAgreement.reverse.test.ts`             | Our idea of access still matches what a terminal would actually do. **Must stay green through any change.** |
| `InvertedAssumptions.reverse.test.ts`       | The five D-defects (§6)                                                                                     |
| `InvertedAssumptionsTwo.reverse.test.ts`    | The four N-defects (§6)                                                                                     |
| `vendorTables.test.ts`                      | Return/event code classification                                                                            |
| `useEnrolmentPoll.test.tsx`                 | Timeout ≠ failure, unmount stops polling                                                                    |
| `RegistrationAndLog.test.ts`                | Inline provision never throws; kind sets disjoint                                                           |
| `BillingLapseNeverLocksOut.reverse.test.ts` | A gym's unpaid invoice never reaches its members' door access — the drain stays billing-blind               |
| `BiometricConsent.test.ts`                  | **No enrolment command reaches a reader without a consent record** — and the write happens first            |
| `AccessEventRetention.test.ts`              | The published 12-month figure is the one actually enforced; batching walks a backlog from the old end       |
| `RemoteOpenPermission.test.tsx`             | The remote-open decision, so the permissive default is not read as an oversight and "tightened"             |
| `BiometricConsentPersistence.test.ts`       | (members) Consent survives an ordinary member edit — `update()` writes the whole row, not a patch           |

**E2E (Playwright), 15 tests across 3 specs** — 14 passing, 1 skipped by
design (2026-08-27). Runnable with no hardware and no
vendor, because `createAccessControlProvider()` returns the mock unless
`ACCESS_CONTROL_ENABLED=true`. Requires `E2E_ACCESS_CONTROL=1` and a seeded
Enterprise gym (`E2E_ENTERPRISE_GYM_EMAIL` / `_PASSWORD`); every spec skips
without them. Highest-value assertions: credentials are never read back; a
never-contacted reader reads "No contact yet" and not "Not responding"
(trap 9); the enrol button is inert until consent is ticked; no vendor return
code appears in the rendered text of either gym-facing screen.

> ⚠️ **The provider factory returns a NEW mock per request**, so nothing it
> holds in memory survives one HTTP call. `listSubjects` therefore always
> answers empty and enrolment detection can never flip `finger_enrolled` — the
> "Fingerprint registered" state cannot be reached from E2E at all. Do not try
> to force it: the options are global mock state (shared across the whole unit
> suite) or a test backdoor in the app, and both cost more than the coverage.
> That leg is covered by `useEnrolmentPoll.test.tsx` and the
> `DetectBiometricEnrolment` tests. The same lifetime is _why_ the trap-9
> assertion works — a reader is never marked seen, so `unknown` is its real
> and correct state.

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

**Enrolment.** Desk ticks the consent box → `members.biometric_consent_at` is
written **before** anything is dispatched → `enrollfinger` puts the reader into
enrolment mode → member presents a finger → `useEnrolmentPoll` polls
`/enrolment` until it appears. Detection is **additive only** — it can set
`finger_enrolled` true, never false (N3). With no consent on file the gate
refuses in `ManageMemberBiometric` (not the route), so no caller can route
around it, and the refusal is `BIOMETRIC_CONSENT_REQUIRED`/400 rather than a
502 — nothing failed at the reader.

**Withdrawal.** Removing a fingerprint is the withdrawal: `fromdev` revoke,
`finger_enrolled` false, subject off-device, **and `biometric_consent_at`
cleared**. The next enrolment has to ask again. A vendor refusal leaves the
consent standing — a template that may still be on the reader must not be held
under a permission we have already erased.

**Retention.** `purge-access-events` deletes scans older than
`ACCESS_EVENT_RETENTION_DAYS` (365) nightly, in batches, oldest first.

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

## 6. Defect history — twelve defects, found by inverting assumptions

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

### Third audit (2026-08-26) — the consent and retention work

Run before the migrations were applied, on the same principle.

| #      | Inverted assumption                                    | The defect                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C1** | "The device's timestamp tells us how old a scan is"    | The purge keyed on `occurred_at`, which is the **reader's own clock**. A reset RTC or a mis-entered offset dates today's scans a year back, so the first run deletes them the same night — irreversibly, reported as an ordinary `deleted: N`. Now keyed on `created_at`, which is ours and cannot be wrong. |
| **C2** | "A batch that fits in the database fits in a request"  | `.in()` puts every id in the **query string**. 500 UUIDs is a 19.5 KB request line; an nginx-family gateway rejects past ~8 KB with a 414, so the first run at any gym with a real backlog would fail entirely. Reads stay at 500, deletes now chunk at 100 (~3.9 KB).                                       |
| **C3** | "Our enrolment path is the only way a template exists" | The gate covers what we dispatch. A fingerprint enrolled at the terminal's own admin menu still reaches `DetectBiometricEnrolment`, which is additive (N3) and sets `finger_enrolled` with nobody having been asked. Not suppressed — the template is real, so the panel now shows it as needing attention.  |

**C1 and C2 were both invisible to the forward tests, and C2 was invisible to
the doubles as well** — the fake has no transport, so no repository-level test
could have caught a URL-length limit. It is asserted directly against the
constant instead. The same lesson as the tenth finding above, one layer out:
**a double cannot fail in a way it does not model.**

**The consent timestamp is the gym's attestation, not proof.** It records that
the gym said the member agreed, exactly as `accepted_terms_at` does. Nothing in
a client-server system can prove a human was asked, and the field must not be
described as though it does.

### Fourth audit (2026-08-27) — found by the E2E suite's first green run

Not by inverting an assumption this time. By running the thing.

| #      | Inverted assumption                            | The defect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E1** | "A route that reads as this gym can write too" | `access_devices` is SELECT-only for gym owners, and five routes wrote through the caller's session client — `POST /devices`, `enable`, `disable`, `unlink`, `PATCH`. **Registering, renaming, pausing and forgetting a reader were all broken in production.** Unit tests mock the repository, so RLS never ran there and every one of them passed. See trap 21.                                                                                                                                                                                                     |
| **E2** | "Rendering the time is harmless"               | The dashboard header stamped the clock to the minute during SSR, so any load crossing a minute boundary mismatched on hydration and React discarded the tree — for every user, on the busiest page. It was the server's clock besides, printed under an IST label. See trap 22.                                                                                                                                                                                                                                                                                      |
| **E3** | "Only _values_ can mismatch on hydration"      | `FeatureGate` chose the tree's **shape** — nothing, the children, or the upsell — from query state that is not guaranteed identical on the server and in the hydrating client render. React found children where it had rendered a placeholder and threw the subtree away, on **every gated page**. A structural mismatch is E2 wearing different clothes, and `isLoading` is not a hydration-safe discriminator. Both now go through `useIsHydrated`.                                                                                                               |
| **E4** | "An intermittent test failure is flakiness"    | `forgetReader`'s confirm step matched `/forget\|remove\|confirm/i` **page-wide**, which also matches every row's `aria-label="Forget <name>"` trigger. `.last()` is the dialog's button only after the portal mounts; a tick earlier it is the last row's trigger, so cleanup clicked the wrong reader and the intended one survived. It presented as ~1-in-4 flakiness and got likelier with every extra reader on the page. **A locator that can resolve to the control that opened the dialog is not a race, it is a bug** — scope to the dialog and wait for it. |

**Both were live, user-facing, and sitting under passing tests.** E1 was
invisible because the doubles do not enforce RLS; E2 because no unit test
renders the page twice and compares. That is the same lesson as the tenth
finding and C2, arriving a third time from a third direction: **a test can only
fail in a way its substitutes model.** The E2E suite is the only thing in this
repo that runs the real policies against the real renderer, which is the entire
argument for having paid to get it green.

---

## 7. What is NOT built

### 7.1 Product decisions — all four made and built (2026-08-26/27)

1. **Biometric consent. ✅ DECIDED — enrolment is no longer blocked.** Consent is
   captured at the **enrolment dialog**, which is the moment of collection, and
   recorded on `members.biometric_consent_at` alongside the two registration
   consents. The gate lives in `ManageMemberBiometric`, not the route, and fails
   closed. Removing the fingerprint clears the timestamp — that is the
   withdrawal record. The privacy policy now carries a Biometric Data section
   (what is collected, that no template ever reaches us, how to withdraw, and
   that a fingerprint is never a condition of membership), mirrored in
   `docs/legal/privacy-policy.txt`.

   > **Deliberately NOT captured at registration**, despite the earlier note
   > here asking for a registration field. Three reasons, and reverse them
   > before adding a tick to the sign-up forms: consent to a purpose that does
   > not exist yet (almost no gym owns a reader) is not meaningful consent; it
   > would be NULL for every member who registered before this shipped —
   > exactly the members a gym enrols first, so the enrolment gate is needed
   > regardless; and it would mean a v7 of `register_member_guarded`, which is
   > the quota-critical insert path, for no gain. The column sits next to the
   > other two consents; only the capture point differs.

2. **May front-desk staff open a door remotely? ✅ DECIDED — yes.** Any user
   with the capability may, which is the behaviour that already shipped. It is
   the remedy when a paid-up member's finger will not read, and routing it
   through an owner is how the button ends up unused and the door ends up
   propped open. There is also nobody to distinguish: **a gym is one Supabase
   user (`gyms.user_id`)**, so "owner" and "front desk" are the same login and
   no role check exists that could express a narrower rule. `canRemoteOpen`
   stays as an addressable prop in case per-user roles ever arrive; do not
   "tighten" its default. `RemoteOpenPermission.test.tsx` pins this so the
   permissive default is not mistaken for an oversight. The offsetting control
   is audit, not permission — the actor on the `access_sync_jobs` row plus
   event **8** back from the reader.

3. **A gym stops paying _us_ — do its members lose the door? ✅ DECIDED — no,
   never.** The service withheld from a non-paying gym is the dashboard, not
   the building. Treating a lapsed gym like a cancelled member would refuse
   every one of its members in person, over an invoice dispute they are not
   party to and cannot resolve.

   Two paths, and the difference between them is the decision:
   - The **nightly reconcile skips** a lapsed gym (`gymsSkippedBilling`). It is
     a diff, so skipping changes nothing on the hardware — every member keeps
     the window their reader already holds and the reader keeps enforcing it
     from its own clock. Skipping is a `continue`, never a "block everyone"
     branch.
   - The **outbox drain does not consult billing at all**, and must not start.
     So a member who renews _during_ the lapse still gets their validity period
     pushed and still gets in. Adding a standing check to the drain looks like
     an obvious saving and would lock out exactly the people this protects.

   `past_due` is not yet a lapse — the 7-day grace still counts as good
   standing. Nothing in `features/subscriptions` can reach the outbox; it owns
   the `accessControlHardware` entitlement flag and nothing else.
   `BillingLapseNeverLocksOut.reverse.test.ts` pins all three.

4. **Event retention. ✅ DECIDED — 12 months.** `ACCESS_EVENT_RETENTION_DAYS`
   = 365, swept nightly by `purge-access-events` and stated in the privacy
   policy. **The constant and the published figure are one decision in two
   places** — a test asserts the constant is 365 precisely so moving it forces
   someone past the policy text.

### 7.2 Engineering — known gaps, none blocking

| Gap                                                            | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E2E covers the three screens, not the hardware                 | `tests/e2e/access-control-{setup,dashboard,member}.spec.ts` — 15 tests against `MockAccessControlProvider`, no hardware or vendor needed. Gated on `E2E_ACCESS_CONTROL=1` + a seeded **Enterprise** gym. The "Fingerprint registered" state is **unreachable from E2E** (see §4.7) and stays unit-covered.                                                                                                                                                                                                                                                                                                                                                                     |
| ~~`npm run build` unverified~~ **Resolved**                    | Verified 2026-08-27: exits 0, 93 static pages, all routes compiled, TypeScript clean. The earlier Google Fonts failure was the sandbox's network, not `layout.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ~~Hydration mismatch on `/settings/access-control`~~ **Fixed** | Was structural, not textual: `FeatureGate` decides the _shape_ of the tree from query state, and query state is not guaranteed identical on the server and in the hydrating client render, so React found children where it had rendered a placeholder and discarded the subtree. Pinned with `useIsHydrated` (defect E3, §6). It affected **every gated page**, not only this one.                                                                                                                                                                                                                                                                                            |
| ~~E2E cleanup is intermittently flaky~~ **Fixed**              | It was never flakiness. `forgetReader` confirmed with a page-wide `getByRole('button', { name: /forget\|remove\|confirm/i }).last()`, and that pattern **also matches every row's `aria-label="Forget <name>"` trigger** — three decoys on the shared gym. `.last()` is the dialog's button only once the Radix portal has mounted; resolve it a tick earlier and it is the _last row's trigger_, so the helper opened a second reader's dialog and the one it meant to remove survived. Now scoped to `getByRole('dialog')` and matched on the exact label, with the opening click retried until the dialog is actually up. Three consecutive clean runs. See defect E4 (§6). |
| ~~The E2E suite has never run green~~ **Resolved**             | Green on 2026-08-27: **14 passed, 1 honest skip**, after eleven causes (§8.3). Needs `workers: 1` — every spec shares one seeded gym. **Still read `error-context.md` before the stack trace; it found all eleven.**                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Repo-wide Prettier drift** (not this feature)                | `npm run format` rewrites ~284 files nobody touched, so anyone who runs it buries their own diff. See §7.4 — it has a required order, and doing it inside a feature branch is what makes it dangerous.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Multi-finger enrolment                                         | Deliberate scope reduction — one finger per member. The API supports `fingerId` 0–9; the schema records a single finger.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Cross-device template migration                                | Deliberate — single gate per gym assumed. The port keeps `syncone`/`syncsometoone`; nothing in the product depends on them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Manual "mark as enrolled" fallback                             | The A4 containment plan names it; not built. Only needed if templates never surface via the wrapper.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Occupancy / time-in-gym                                        | **Deliberately never.** With one reader serving entry and exit, `CheckingStatus` reports the device's configured mode, not reality. Events are **visits**, not paired sessions. Building this would be inventing data the hardware does not have.                                                                                                                                                                                                                                                                                                                                                                                                                              |

**What the E2E suite cost, and bought.** Getting it green took eleven causes
(§8.3), and almost none of them were about door hardware. It found: silently
skipping Playwright specs, unlabelled form fields across all five auth pages, a
port collision that substituted a different application for the app under test,
permanent generated-file churn from `npm run dev`, seeded auth rows that no
Supabase API could read, a 17-byte AES key, **five device routes whose writes
RLS had been refusing in production**, and a dashboard clock that broke
hydration on every minute boundary for every user.

That last pair is the argument for the suite. Both were live user-facing
defects, both sat in code with passing unit tests, and neither was reachable by
any test that mocks its repository or never renders the page. The cost was a
day of environment archaeology; the return was the only instrument in this repo
that can see them.

The accessibility fix went beyond auth — every filter and bulk-import form in
the product was announcing its controls as unnamed — and is now enforced
repo-wide by `jsx-a11y/label-has-associated-control`.

None of that is access-control work. All of it was in the way of proving
access-control work.

### 7.3 Cannot be resolved without hardware

The simulator session plan is `vft-simulator-test-plan.md` — Parts A–H, ~90
items, with a "if you only get an hour, do these eight" list at the end.
**Check §8.4 before booking the session**: its pre-flight gate is only partly
met, and the two items still open (a real `VFT_API_BASE_URL`, and a publicly
reachable webhook URL) are procurement and deployment, not code.

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

### 7.4 The repo-wide Prettier drift — queued, with a required order

Not access-control work, recorded here because this is the document the next
session reads and because the fourth E2E defect is its first step.

**The state:** `npm run format` rewrites roughly **284 files nobody touched**.
The tree has never been Prettier-clean at HEAD — `semi: false` was adopted
after a large amount of code already existed — so the first person to run the
command silently reformats the repo underneath their own change. That happened
during this branch and cost a revert of 314 files.

**Why it was not fixed here:** a formatting commit touching 284 files inside a
54-file feature branch makes the feature unreviewable. It needs its own branch
and its own PR, reviewed as "no behaviour changed" and nothing else.

**The order matters, and step 1 is not optional:**

1. **`.prettierignore` for generated outputs — first.** `public/service-worker.js`
   is emitted by `scripts/generate-pwa-assets.js` with semicolons; the committed
   copy has had Prettier run over it. They disagree permanently, so **every**
   `npm run dev` leaves the file modified (trap 20). Formatting the repo before
   ignoring it re-creates the churn immediately and makes step 2 look like it
   failed. Rule 2.19 applies: edit the generator, never the output — and here,
   do neither; ignore it.
2. **One formatting-only commit.** `npm run format`, nothing else in the diff,
   a commit message that says so.
3. **`npm run format:check` in CI**, so the drift cannot come back. Without
   this step the other three decay.
4. **`.git-blame-ignore-revs`** carrying that commit's SHA, so `git blame` keeps
   pointing at whoever wrote each line rather than at the reformat.

---

## 8. Verification — current state and how to re-run it

### 8.1 The checks that pass

```bash
npm run arch:check && npx tsc --noEmit && npm test && npm run lint
```

Access-control's own share of that suite, if you want it alone:

```bash
npx jest src/features/access-control src/lib/access-control \
  src/app/api/cron/__tests__/access-control-crons.test.ts \
  src/features/members/tests/BiometricConsentPersistence.test.ts
```

### 8.2 The E2E suite — how to actually run it

**Green as of 2026-08-27: 14 passed, 1 skipped, 0 failed.** It took eleven
distinct causes to get there; §8.3 is the full history, and it is worth reading
before assuming a future red run is a bug in the specs. The skip is the
fingerprint-withdrawal test, and it is honest — see §8.3.

```bash
# 1. Browser + system libraries. The second command is the one people miss —
#    a missing libasound.so.2 fails before any spec is loaded.
npx playwright install chromium
npx playwright install-deps chromium

# 2. Nothing else may be listening on 3100 (see trap 19 — this is not
#    paranoia, it cost two debugging rounds), AND no dev server may be
#    orphaned from an earlier run (trap 24 — Next 16 allows one per
#    directory, and the failure names 3001, not 3100).
lsof -i :3100 || echo "3100 free"
pkill -f '^next-server' 2>/dev/null || echo "no orphaned dev server"

# 3. Run just the access-control specs.
npx playwright test access-control

# 4. Or all 26, including the billing suite that had also been skipping.
npm run test:e2e
```

**Prerequisites, all in `.env.local`** — Playwright loads that file itself now
(`loadEnvConfig`), so there is no second place to set them:

| Variable                                 | Why                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `E2E_ACCESS_CONTROL=1`                   | Without it all 15 specs skip — **and a skip reports green** (trap 17)                                                   |
| `E2E_ENTERPRISE_GYM_EMAIL` / `_PASSWORD` | A seeded gym on the **Enterprise** tier. `requireAccessControlGym` fails closed, so any other tier gets 403 everywhere. |
| `E2E_LITE_GYM_EMAIL` / `_PASSWORD`       | Optional. Only the "not entitled" spec uses it; it skips cleanly without.                                               |
| `ACCESS_CONTROL_ENABLED` **unset**       | Or `false` — the code tests `=== 'true'`, so the two are identical. The specs assume `MockAccessControlProvider`.       |
| `ACCESS_CONTROL_ENCRYPTION_KEY`          | Must **base64-decode to exactly 32 bytes** (44 chars). A short key throws in `getKey()` and every credential save 500s. |
| `E2E_PORT`                               | Optional override if 3100 is taken.                                                                                     |

The seeded gyms need more than a row in `gyms`. Both of these bit a full
session, and neither is visible from the app:

- **`gyms.email_verified` must be `true`.** It is an app column, not Supabase
  auth state — `auth.service.ts` computes `requiresEmailVerification` from it
  and the login route answers 403. Confirming the address in Supabase, or
  turning email confirmation off in the dashboard, does nothing to it.
- **Never `INSERT` the auth user by hand.** A direct insert leaves
  `confirmation_token`, `recovery_token`, `email_change` and
  `email_change_token_new` NULL, GoTrue cannot scan those rows into its
  non-nullable Go strings, and _every_ lookup of that user fails. Use the Admin
  API, or set the four columns to `''`.

**Verify the run is real before trusting it.** The output must say tests
_passed_, not _skipped_:

```bash
npx playwright test access-control --list   # should print 15 tests
```

**When it fails, read this first — before the stack trace:**

```
test-results/<spec-name>/error-context.md
```

Its ARIA snapshot is what identified the Remotion collision, and it stayed the
only useful instrument through all eleven causes: it was the snapshot that
showed the login page already logged in, the presence badge plainly rendered
while the locator called it missing, and the consent checkbox present in a
panel the spec had decided was empty. The stack trace pointed at the helper
every time. **Read the snapshot first, every time.**

| Check              | State                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| `arch:check`       | ✅ feature-first invariants hold                                         |
| `tsc --noEmit`     | ✅ zero errors                                                           |
| `npm test`         | ✅ 1,330 passing, 7 skipped (333 in access-control)                      |
| `npm run lint`     | ✅ zero errors (13 pre-existing warnings, none from this feature)        |
| `npm run build`    | ⚠️ never verified — Google Fonts is unreachable from the build sandboxes |
| **Playwright E2E** | ✅ **14 passed, 1 honest skip** (2026-08-27) — ~2.6 min, one worker      |
| Supabase advisors  | ✅ nothing new; the pre-existing INFO/WARN set is unchanged              |

### 8.3 What it took to get green — eleven causes

Kept in full, because the shape of this list is the lesson: **each cause hid
the next, and the failure they presented was almost never the failure they
were.** Nothing here was found by reasoning about the specs; every one came
from reading `error-context.md`.

Causes 1–4 were found on 2026-08-27 before the suite had ever reached an
assertion:

1. **Playwright never loaded `.env.local`**, so every env-gated spec skipped —
   and a skip reports green. The billing specs had presumably been skipping
   since they were written. Fixed with Next's own `loadEnvConfig`.
2. **The login helper could not fill the form**, because the auth pages'
   labels were not associated with their inputs (§9, trap 17). `getByLabel`
   matched nothing.
3. **A Remotion studio was listening on port 3000.** `reuseExistingServer`
   adopted it as the app under test and asked it for `/login`; it answered
   "Composition with ID login not found". The E2E server now runs on 3100.
4. **Missing Chromium system libraries** on the dev machine
   (`npx playwright install-deps chromium`).

Causes 5–11 were found the same day, in the session that finished the job:

5. **The seeded auth users had NULL token columns.** They had been created by a
   direct `INSERT` into `auth.users`, which leaves `confirmation_token`,
   `recovery_token`, `email_change` and `email_change_token_new` NULL. GoTrue
   scans those into non-nullable Go strings, so every lookup of those rows
   errored — and `auth.service.ts` maps _any_ auth error to "Invalid username
   or password". It looked exactly like a wrong password for hours. The tell
   was the Admin API failing too, with `Database error finding users`.
6. **`gyms.email_verified` was `false`.** An app-level column, unrelated to
   Supabase auth state; the login route answers 403 `email_verification_required`
   regardless of what the dashboard's email-confirmation setting says.
7. **`ACCESS_CONTROL_ENCRYPTION_KEY` decoded to 17 bytes, not 32**, so every
   vendor-credential save 500'd in `getKey()` — which is the first thing every
   spec does.
8. **Device writes were denied by RLS.** `access_devices` carries a SELECT-only
   policy, and five routes wrote through the caller's session client:
   `POST /devices`, `enable`, `disable`, `unlink`, and the `PATCH`. **This was
   a live product bug, not a test problem** — registering, renaming, pausing or
   forgetting a reader was broken in production too, and the unit tests could
   not see it because they mock the repository, so RLS never runs. Fixed by
   using `createAdminClient()` for the write while keeping the session-client
   `findDeviceById(gymId, id)` ownership check, which is the pattern
   `account/route.ts` already documented.
9. **Four locators were ambiguous or mis-scoped.** A bare-string `getByText`
   matches case-insensitively on a substring, so `'Connected'` also matched the
   heading "No readers connected"; and `filter({ hasText })...last()` resolves
   to the _innermost_ div holding the text, which excluded the very badge and
   controls being asserted. Compounded by the shared gym (below), which puts
   several readers on the page at once.
10. **Branches read `count()` before `dynamic()` chunks had rendered.** The
    member modal and its access panel are lazy imports, so a zero meant "not
    loaded yet" and was indistinguishable from "no consent gate offered". One
    such branch resolved to `test.skip` — trap 17 again, from the inside.
11. **Roughly twenty sign-ins per run hit Supabase's per-IP token rate limit.**
    Past the limit it answers 429, which surfaces — once more — as "Invalid
    username or password" for a credential that is perfectly valid, drifting
    between tests as the quota is reached at different points. **Still
    unfixed, and deliberately so.** Caching the session cookies and replaying
    them is the obvious remedy and it is a trap: Supabase rotates refresh
    tokens, so a replayed pair retires the one the next test needs, reuse
    detection revokes the session family, and the page then renders from a
    cookie middleware accepts while every API call beneath it answers
    Unauthorized. Measured, it took the suite from 14 passing to 6 and
    Unauthorized responses from 2 to 12; re-capturing the cookies after each
    replay did not help. The note in `helpers/billing.ts` records this so it is
    not retried. The real fix is `storageState` seeded once per project, or a
    gym per worker. Until then, space the runs out.

**Two settings the suite now depends on**, both in `playwright.config.ts`:
`workers: 1`, because every spec in `tests/e2e` drives the _same_ seeded gym
and parallel files corrupt each other's state rather than running in isolation;
and `timeout: 120_000`, because the server under test is `next dev` and first
touch of a route compiles it on demand. Real isolation would need a gym per
worker — a seeding change, not a config one.

**The one skip is honest.** `says removing a fingerprint also withdraws the
consent` skips because there is no fingerprint to remove: the mock's
`listSubjects` always answers empty, so enrolment detection can never flip
`finger_enrolled`, and the "Remove fingerprint" control never renders. This is
the limitation the helpers already document, and it is covered by
`useEnrolmentPoll.test.tsx` and the `DetectBiometricEnrolment` unit tests. It
was verified against the database rather than assumed — the seeded member shows
`finger_enrolled = false` with `biometric_consent_at` set, which is also
positive evidence the consent path really ran.

### 8.4 Readiness for the simulator session (2026-08-27)

The plan is `docs/integrations/vft/vft-simulator-test-plan.md`. Its pre-flight
table is the gate, and this is where each item actually stands. **Two of the six
were broken until today**, and both would have ended the session inside the
first ten minutes with a symptom that looks like the vendor's fault:

| #      | Pre-flight item                                   | State                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | `ACCESS_CONTROL_ENABLED=true`, `VFT_API_BASE_URL` | ❌ **Blocked.** The flag is `false` and the URL is still the placeholder `https://vft.example.com`. Needs the real simulator endpoint — nothing else can be tested until it exists.                                                                                                                                                                             |
| **P2** | `ACCESS_CONTROL_ENCRYPTION_KEY`, 32 bytes         | ✅ **Fixed today.** It decoded to **17 bytes**, so `getKey()` threw and _no gym could save vendor credentials at all_ (cause 7, §8.3). Every command would have failed before reaching the vendor.                                                                                                                                                              |
| **P3** | Webhook token + callback URL registered           | ⚠️ **A public URL now exists and answers; the token is unverified in the cloud.** See §8.6 for the URL. `ACCESS_CONTROL_WEBHOOK_TOKEN` must be set in the environment that serves it — unset makes `getWebhookPathToken()` return `null` and the endpoint refuses _everything_, which is byte-identical to a wrong token (both 401). Check it, do not infer it. |
| **P4** | Enterprise test gym                               | ✅ Seeded and proven: `e2e-enterprise@metricgym.test`, tier `enterprise`, status `active`, one member.                                                                                                                                                                                                                                                          |
| **P5** | Two readers registered                            | ✅ **Fixed today.** Reader registration was refused by RLS on every attempt (defect E1, §6) — `POST /devices` wrote through the caller's session client against a SELECT-only table. P5 was unreachable.                                                                                                                                                        |
| **P6** | SQL console on the outbox and events              | ✅ Available.                                                                                                                                                                                                                                                                                                                                                   |

**So: the software is ready; the integration is not.** Everything on our side
of the boundary now works against the mock — all three screens, the outbox, the
consent gate, credential storage, reader registration — and is proven by 15 E2E
tests and 1,330 unit tests. What is missing is entirely on the vendor/infra side
of the line: **a real simulator URL (P1) and a publicly reachable webhook
endpoint (P3).** Neither is code. Until P1 exists there is nothing to point at,
and until P3 exists the single most valuable question in the plan — A-1, whether
refused scans reach the webhook at all — cannot be asked.

**The lesson worth carrying into the session.** P2 and P5 were both invisible
from the outside: the code was written, reviewed, merged and unit-tested, and
both defects sat underneath passing tests until something actually exercised
them end to end. Assume the same is true of the assumptions in §3.10 that are
still graded B or C. Work Part A top to bottom before anything else, exactly as
the plan says, and treat a green result as evidence rather than confirmation.

### 8.5 Remaining workload and blockers (2026-08-27)

The honest shape of it: **the build is done, the proving is not.** Every line of
this feature is written, merged and covered; almost nothing about how it behaves
against a real terminal has been observed. What follows is everything left,
split by who can actually move it.

#### Blockers — none of them code, none of them ours

| #          | Blocker                                                                                                                                                                                                                  | Owner                | Blocks                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **B1**     | A real `VFT_API_BASE_URL` — simulator or hardware. Currently a placeholder.                                                                                                                                              | **VFT / commercial** | _Everything._ With `ACCESS_CONTROL_ENABLED=false` the mock answers and the session tests nothing.                             |
| ~~**B2**~~ | ~~A publicly reachable deployment~~ **Done** — the production alias serves the webhook and answers 401 on a bad token (§8.6). Registering the callback still needs B1.                                                   | Us — infra           | —                                                                                                                             |
| ~~**B3**~~ | ~~`npm run build` unverified~~ **Done 2026-08-27** — exits 0, 93 static pages, TypeScript clean.                                                                                                                         | Us                   | —                                                                                                                             |
| **B4**     | Access-control env vars proven present in the **deployed** environment, not just `.env.local` (§8.6, last table).                                                                                                        | **Us**               | Every inbound scan, and every credential save. A missing webhook token is a silent, indistinguishable 401.                    |
| **B5**     | ~~Merge this branch~~ **Done** — [#67] merged 2026-08-28. Still to do: **promote master onto the custom domains**, which remain pinned to a build ~20 days older than the feature and 404 on every access-control route. | **Us**               | A _permanent_ handover URL, and shipping to real gyms. Not needed for the simulator session, which can use the project alias. |

**B1 is the critical path and it is a vendor conversation.** B4 is minutes of
checking and is the one most likely to be skipped, because nothing about it
fails loudly. B5 is a release decision: the simulator session genuinely does
not need it, but the callback URL VFT registers is only permanent on the far
side of it — see the host table in §8.6.

#### Ours — worked through on 2026-08-27

| Task                                        | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verify a real production build (B3)         | ✅ **Done.** `npm run build` exits 0 — 93 static pages, every route compiled, TypeScript clean. The Google Fonts failure recorded in §7.2 was the sandbox, not the code. B3 is no longer a blocker for B2.                                                                                                                                                                                                                                                                                            |
| Repeatable **seed script** for the E2E gyms | ✅ **Done** — `scripts/seed-e2e-gyms.js`, also `npm run seed:e2e`. Idempotent, refuses any address outside `@metricgym.test`, and ends by actually signing in rather than assuming. It goes through `auth.admin.createUser`, so it cannot reproduce cause 5; verified against a throwaway account whose four token columns came back non-NULL. **Never seed these gyms by hand again.**                                                                                                               |
| `.prettierignore` for generated outputs     | ✅ **Done.** There was no `.prettierignore` at all. Now covers all three generator outputs — `public/manifest.json`, `public/service-worker.js` and **`src/lib/pwa-version.ts`**, the third of which trap 20 never mentioned — plus build artefacts and the lockfile.                                                                                                                                                                                                                                 |
| E2E auth via `storageState`                 | ❌ **Tried and reverted.** See the note in `helpers/billing.ts`. It only reaches fixture-created pages; these specs build their own contexts with `browser.newPage()` in `beforeAll`/`afterAll`, which do not inherit a project's `storageState`, so the run splits into seeded and anonymous halves and the cleanup helpers land on the anonymous side. 14 passing → 11. **A gym per worker is the better target** — it fixes the shared-state problem as well, which `storageState` does not touch. |

#### Gated on the session itself

Work Part A (10 items) **before** Parts B–H (~80). Part A results can change the
design rather than merely confirm it — A-1 in particular decides whether refusals
are cut from the log or polled from the transaction table, which is a different
design, not a smaller one.

Afterwards: upgrade the §3.10 evidence grades from the results; build the manual
"mark as enrolled" fallback **only if** A-5 shows device-local enrolments never
surface; and settle the two remaining genuine unknowns — token expiry duration,
and the real `Pin` width on K40/F18 firmware.

#### Not on the list, deliberately

Multi-finger enrolment, cross-device template migration, and occupancy /
time-in-gym are **decided against** (§7.2), not pending. Occupancy in particular
would mean inventing data the hardware does not have. The four §7.1 product
decisions are settled and closed — do not reopen them for the simulator session.

### 8.6 Vendor handover — what to ask VFT for, and what to give them

One conversation, in both directions. Everything below is derived from the code
that will consume it, not from the vendor's documentation.

> **Updated 2026-08-28 — the call happened.** VFT supplied the Postman
> collection and both code tables (§3.11) and answered items **3, 6 and 7**
> below. **Items 1, 2, 4 and 5 remain, and they are the whole critical path:
> without credentials and a serial, `ACCESS_CONTROL_ENABLED=true` has nothing
> to talk to.** The "give" half is now settled and live — see the host table
> further down.

#### Ask VFT for

| #   | Item                                                                                                          | Where it lands                                                                                                                             | Why it is not optional                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **API base URL** (simulator or live)                                                                          | The `baseUrl` field of the account form (`accessControlAccountSchema`); `VFT_API_BASE_URL` is only a fallback for single-deployment setups | Nothing can be tested without it. The current value is the placeholder `https://vft.example.com`                  |
| 2   | **Account login** — email + password                                                                          | `email` / `password` on the same form, AES-256-GCM at rest in `access_control_secrets`                                                     | This is the whole vendor identity; the client authenticates per gym and caches the bearer token                   |
| 3   | ~~**`AreaID`**~~ **Answered:** default **1**, "not currently relevant, added for future development"          | Optional `areaId` on the same form                                                                                                         | Organisational only — **never** a security boundary (A9, trap 6). Tenant scoping is ours regardless               |
| 4   | **Device serial(s)** — two if possible                                                                        | The "Connect a reader" form                                                                                                                | P5. Half the interesting failures only appear with two readers, and serials are how webhook events find their gym |
| 5   | **Confirmation the callback is live**                                                                         | Their account-level callback configuration                                                                                                 | Configured **per account, not per gym** — there is no per-gym URL to hand out                                     |
| 6   | **Token expiry duration** — _still open_                                                                      | Answer upgrades §3.10                                                                                                                      | Genuinely unknown. `TOKEN_CACHE_TTL_SECONDS` is a conservative 30 min guess; a 401 refresh covers being wrong     |
| 7   | **Real `Pin` width on K40/F18 firmware** — _platform limit answered (15, numeric); firmware limit still open_ | Answer upgrades §3.10                                                                                                                      | The other genuine unknown. Affects the personnel-id ceiling (A1)                                                  |

#### Give VFT

**The callback URL** — the only thing they need from us:

```
https://<host>/api/webhooks/access-control/<ACCESS_CONTROL_WEBHOOK_TOKEN>
```

**Which host — the part that is easy to get wrong.** Vercel hands out four
kinds of URL and they are not interchangeable. A callback is registered on the
vendor's account and then left alone for years, so the only acceptable choice
is one that no deployment can invalidate:

| Kind              | Example                                                   | Survives a push?                                                  |
| ----------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Per-deployment    | `gym-management-saas-iid3wbwxz-…vercel.app`               | **No.** Immutable, a new one per push. **Never hand this out.**   |
| Branch alias      | `gym-management-saas-git-master-…vercel.app`              | Yes — but it is named after a branch, and dies if the branch does |
| Project alias     | `gym-management-saas-shyans-projects-7b2901b0.vercel.app` | Yes — re-points itself to the current production deployment       |
| **Custom domain** | `www.metricgymos.com`                                     | Yes, and survives leaving Vercel entirely                         |

Give them the **custom domain**. It is the only one of the four that is ours
rather than the host's, so re-registration is never forced by a deployment, a
branch rename, or a change of platform:

```
https://www.metricgymos.com/api/webhooks/access-control/<ACCESS_CONTROL_WEBHOOK_TOKEN>
```

Two properties of that host, both measured on 2026-08-28:

- **`www`, not the apex.** `metricgymos.com`, `metricgymmanager.com` and
  `www.metricgymmanager.com` all answer **308** to `https://www.metricgymos.com/…`.
  A 308 preserves the method and the body, so a compliant client is fine — but
  embedded reader firmware frequently does not follow redirects at all, and a
  POST dropped on a redirect is the worst failure this endpoint has: nothing
  arrives and nothing is logged. Hand over the host that answers directly.
- **It is not serving this feature yet.** The custom domains are pinned to a
  build roughly twenty days old (`age: 1730334` on the CDN response), predating
  the entire integration, and they answer **404** on this path. Every
  production-target deployment on master — including the merge of [#67] —
  answers **401** on a bad token. The code is right; only the alias assignment
  is stale. **Promoting master onto the custom domains is the single action
  that makes the handover URL permanent.**

Until that promotion the **project alias** is a genuine stable interim, not a
per-deployment URL: it already answers 401, and it re-points itself on every
master deployment, so pushing changes during testing does not invalidate it.

```
https://gym-management-saas-shyans-projects-7b2901b0.vercel.app/api/webhooks/access-control/<token>
```

Registering twice — the interim now, the custom domain after promotion — is one
extra email. Registering a per-deployment URL is an email per push.

Tell them, because the protocol gives them no way to discover it:

- **`POST` only**, JSON body. Any other verb is not handled.
- **The path token is the entire credential.** The push protocol defines no
  header signature, so the URL must be treated as a secret and delivered
  accordingly — not pasted into a ticket. It is rotatable; rotating means
  re-registering with them.
- **We always answer `200`**, including for events we discard. A non-200 makes
  senders retry or disable the callback and neither helps; only genuine
  transient faults return `500` so the delivery repeats.
- **Events are matched on `device_serial`.** A serial we do not know is counted
  and dropped, never guessed at. On a shared account we will receive traffic
  for gyms that are not ours and will store none of it.
- If they _can_ send a fixed header, `ACCESS_CONTROL_WEBHOOK_SECRET` exists as
  an optional second factor. An IP allowlist is not practical — the host's
  egress addresses are not stable.

#### Still ours before the session — do not hand these to VFT

Setting the vendor's answers in `.env.local` is not enough; the environment
that actually serves the webhook needs them too:

| Variable                        | Consequence if missing in the deployed environment                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ACCESS_CONTROL_WEBHOOK_TOKEN`  | The endpoint refuses **every** event and logs "rejecting device events". Indistinguishable from a wrong token — both are 401   |
| `ACCESS_CONTROL_ENCRYPTION_KEY` | Must base64-decode to **exactly 32 bytes**, or no gym can save vendor credentials at all (cause 7)                             |
| `ACCESS_CONTROL_ENABLED=true`   | Left unset or `false`, every call goes to `MockAccessControlProvider` and the session tests nothing                            |
| `NEXT_PUBLIC_APP_URL`           | Not access-control, but adjacent: it builds Supabase confirmation links, PayHere return URLs and printed QR registration links |

**Merged:** [#63] on 2026-08-26 (the feature), [#65] on 2026-08-27 (the four
product decisions, the E2E suite, and the accessibility work), and [#67] on
2026-08-28 (the RLS write fix, the two hydration defects, and the first green
E2E run).

[#63]: https://github.com/metric-gym-manager/metric-gym-manager/pull/63
[#65]: https://github.com/metric-gym-manager/metric-gym-manager/pull/65
[#67]: https://github.com/metric-gym-manager/metric-gym-manager/pull/67

## 9. Traps for the next session

Twenty-five things that will bite someone who does not know them.

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
11. **Never dispatch an enrolment without a consent record**, and never write
    the record after the command. The gate is in `ManageMemberBiometric` so no
    caller can bypass it — do not "simplify" it up into the route. A consent
    with no template is harmless; a template with no consent is the failure the
    ordering exists to make impossible.
12. **`members.update()` writes the whole row, not a patch.** `biometric_consent_at`
    must stay in _both_ halves of `SupabaseMemberRepository`'s mapping. Drop it
    from the read side and every rename silently erases a consent record — no
    error, no symptom, and nobody finds out until someone asks for the proof.
    `BiometricConsentPersistence.test.ts` is the tripwire.
13. **`ACCESS_EVENT_RETENTION_DAYS` is a published promise, not a tuning knob.**
    It is the figure in the privacy policy. Changing it means changing the
    policy text in `src/app/privacy/page.tsx` _and_ `docs/legal/privacy-policy.txt`.
14. **Never purge on `occurred_at`** (C1). It is the reader's clock. Retention
    runs on `created_at`, which is when _we_ stored the row — the only clock in
    this system that cannot be wrong. Deletion does not come back, so this must
    fail toward keeping.
15. **`.in()` is a query-string filter, so an id list is a transport limit.**
    `ACCESS_EVENT_DELETE_CHUNK_SIZE` is sized for an ~8 KB request line (C2).
    Raising the read batch is safe; raising the chunk is not.
16. **Never give the drain a subscription repository.** A gym's billing lapse
    stops the nightly diff and nothing else; the outbox stays billing-blind so
    a member who renews mid-lapse still reaches the door (§7.1.3). "Stop doing
    vendor work for a gym that is not paying" is the plausible-sounding change
    that locks out paying members.
17. **A test that skips reports green.** Every env-gated Playwright spec in
    this repo was skipping silently — the access-control ones _and_ the
    billing ones — because Playwright's process never loaded `.env.local`.
    Months of "passing" runs had executed nothing. When a suite is suspiciously
    quiet, check it is running at all before trusting it.
18. **A lint rule that matches nothing is the same failure.** Both a11y rule
    landings in this branch were verified by deliberately breaking the code and
    watching the rule fire, then removing the break. Do that every time; a
    misconfigured `files:` scope fails silently and looks identical to success.
19. **`reuseExistingServer` does not check that the server is yours.** It
    adopts anything answering on the port. A Remotion studio on 3000 was taken
    as the app under test for two full debugging rounds. The E2E server runs on
    3100 (`E2E_PORT`) for that reason.
20. **`npm run dev` dirties `public/service-worker.js` every time.** The
    committed copy has had Prettier run over it; its generator emits
    semicolons. The two disagree permanently, so the file shows as modified
    after any dev run. Do not commit that churn — and fix it by adding the
    generated outputs to `.prettierignore`, not by reformatting the file again
    (rule 2.19: edit the generator, never the output).
21. **Every access-control table is SELECT-only for gym owners; writes go
    through `createAdminClient()`.** There are no INSERT/UPDATE/DELETE policies
    on `access_devices`, `access_control_accounts` or `member_access_subjects`,
    and `access_control_secrets` has no policies at all. Hand a route the
    caller's session client for a write and Postgres refuses the row. Five
    device routes shipped with exactly that bug and it reached production —
    registering, renaming, pausing and forgetting a reader were all broken —
    because **unit tests mock the repository, so RLS never executes there.**
    Only the E2E suite can catch this class. The pattern is: session client for
    the `findDeviceById(gymId, id)` ownership check, service-role for the write.
    Note also that an RLS-denied `DELETE` is not an error — it removes zero
    rows and reports success, so a "cleanup" that silently does nothing looks
    identical to one that worked.
22. **Nothing whose output depends on client-only state may decide what SSR
    renders — values _or_ structure.** Use `useIsHydrated()`
    (`src/hooks/useIsHydrated.ts`): it is `false` on the server and during the
    hydrating client render, `true` immediately after, so the two agree by
    construction and the real decision lands on the next render.
    - **Values.** A minute-precision clock mismatches whenever the render and
      the hydration fall either side of a minute boundary — and it is the
      _server's_ clock, not the viewer's. Take the value from `useNow`, and
      reserve the width so the late arrival does not shift the layout (E2).
    - **Structure.** A gate that renders different _trees_ depending on whether
      its data has loaded is the same bug: `isLoading` is not a hydration-safe
      discriminator, because the query need not be in the same state on both
      sides. That was `FeatureGate`, and it affected every gated page (E3).

    Do not reach for `setState` in an effect — `react-hooks/set-state-in-effect`
    rejects it — and do not reach for `suppressHydrationWarning`, which only
    silences the warning for text and leaves the server's value on screen.

23. **Never let a locator that confirms an action also match the control that
    started it.** `forgetReader` confirmed on `/forget|remove|confirm/i`
    page-wide, which matched every row's `aria-label="Forget <name>"` trigger
    as well as the dialog's button. Whether `.last()` found the right one
    depended on the portal having mounted, so cleanup silently clicked a
    different reader and presented as 1-in-4 flakiness for a day (E4). Scope to
    `getByRole('dialog')`, match the exact confirm label, and retry the opening
    click until the dialog is actually visible — a _visible_ trigger is not a
    _hydrated_ one.

24. **A leaked `next dev` blocks every later E2E run, and says so in terms of
    the wrong port.** Next 16 permits one dev server per directory; a server
    orphaned by a killed Playwright run makes the next `webServer` start fail
    with `Another next dev server is already running` naming **3001**, so
    §8.2's "check 3100 is free" does not catch it. Clear it with
    `pkill -f '^next-server'` before a run — and anchor the pattern, because a
    bare `pkill -f next-server` also matches the shell you typed it in and kills
    that instead.

25. **Never narrow a vendor-table transcription to make its coverage test
    pass.** `vendorTables.test.ts` asserts that every code VFT documents is
    classified. Its copy of the event table had been trimmed — 0–74 instead of
    0–80, 100–110 instead of 100–121, no 132/150 blocks, and 219 and 224
    explicitly filtered out of the 200 block as though the vendor had not
    defined them. So it asserted full coverage against 127 of 165 codes and
    passed with 38 unclassified, including a real entry and a real refusal that
    were consequently missing from the check-in log's filters. A coverage test
    whose expectation is edited to fit the code under test is worse than no
    coverage test: it reports the gap as closed. The suite now asserts the
    table's **size and its documented numbering gaps** (46, 238, 253) before it
    asserts anything about the codes — so trimming it fails loudly. The
    transcription's source of truth is
    `docs/integrations/vft/vft-code-tables.md`.

---

## 10. One-line orientation

> A gym pays us; we tell a fingerprint reader how long that member may come in;
> the reader remembers, and enforces it from its own clock, whether or not we are
> still here.
