# VFT GYM API v2.0 — vendor answers and resulting decisions

> Record of what VFT confirmed, plus the local-market context that narrowed the
> scope, and the decision taken in each case. Supersedes the question list and
> the outbound email (both in git history).
>
> Design: `docs/architecture/access-control-integration.md`.
>
> **Hardware:** ~90% fingerprint readers. **One gate per gym** (a single reader
> serves entry and exit). **One finger per member** (index finger, one hand).

---

## 1. Account structure and identity

| Asked | VFT answer | Decision |
| --- | --- | --- |
| Per-gym API credentials? | No native tenant isolation. A single JWT; isolation must be logical via `AreaID`, or by maintaining separate service credentials per tenant | Assume a **shared account**. `AreaID` is the tenant boundary — one per gym, mandatory on employee create |
| Is `EmpId` a flat namespace? | Yes — flat unless scoped by `AreaID` | Drives the decision below |
| `EmpId` constraints | Maps directly to ZKTeco `Pin`. Numeric strings only, up to 9 or 24 digits by model. **UUIDs cannot be used** | **Global Postgres sequence, ≤ 9 digits.** Never `member_number` |

**Why this matters more than it looks.** `members.member_number` is per-gym and
1-based, so every gym has a member `1`. On a flat `EmpId` namespace that is a
collision — and a collision here means *one gym's member opens another gym's
door*. The global sequence is correct whether or not VFT ever issues per-gym
credentials, so it is the only safe choice. The earlier `subject_id_strategy`
column is dropped: there is one strategy.

We stay inside **9 digits**, the narrowest documented limit, because we cannot
audit every hardware model a gym might own.

---

## 2. Fingerprint enrolment and templates

| Asked | VFT answer | Decision |
| --- | --- | --- |
| Where do templates live? | Centralised, in `templatev10`, exposed via `/api/template` | Confirmed — we hold no template data ourselves |
| Automatic propagation between devices? | **No.** Explicit `syncall` / `syncone` / `syncsometoall` / `syncsometoone` | Moot — **single gate per gym**. Port keeps the calls; nothing depends on them |
| Device replacement / template portability? | Supported: `syncone` at the new `DevSN` rewrites stored templates; compatible across standard ZKTeco readers on Template v10 | **Out of scope.** Good to know the escape hatch exists |
| `fingerId` semantics | Range 0–9, up to 10 fingers per `EmpId` | **One finger per member.** Schema records a single `finger_id`, not a set |
| Enrolment completion signal | None. `enrollfinger` queues a command; the reader enters enrolment mode on collection. Confirm by polling `GET /api/template` | **Pending until observed** — the rule 2.8 pending-vs-error distinction |
| Device capacity | Model-dependent (1,000–3,000 entry-level, 10,000+ high-end). Over capacity, the PUSH loop returns execution errors on sync | Detect from sync errors rather than proactive counting. Low risk at Sri Lankan gym sizes |
| Duplicate-finger detection | Handled at the sensor during local enrolment, if enabled in device firmware | **Not a concern** — one fingerprint per membership |
| Removing biometrics | `DELETE /api/template/fromdev/{id}` clears templates, keeps the employee. `DELETE /api/template/{id}` deletes both | **Adopted as a first-class flow** — see below |
| Remote enrolment from stored data | Physical enrolment required; raw upload possible via `DATA UPDATE tablename=templatev10` | **Treated as not possible.** No enrol-from-photo, ever |

### The confirmed enrolment flow

> **Part 1** — member is registered in our SaaS registry (existing desk or QR
> flow, no hardware).
> **Part 2** — staff walk them to the reader; their finger is scanned onto the
> device.

The UI must reflect exactly this: a member exists and is billable the moment
Part 1 completes, showing *Biometric: not enrolled* until Part 2 happens.

### Registry and biometric are separate lifecycles

A fingerprint must be removable **without** deleting the membership record —
and VFT supports precisely that split. So:

- `DELETE /api/access-control/members/[id]/biometric` → VFT
  `DELETE /api/template/fromdev/{id}`, clears `finger_enrolled`, **never**
  touches the `members` row;
- deleting a member's fingerprint is not an edit to their membership, which is
  why it is its own route rather than a flag on member update.

---

## 3. Webhook and events

| Asked | VFT answer | Decision |
| --- | --- | --- |
| Webhook authentication | None defined. Use **path-based secret tokens or IP whitelisting** | One platform-wide path token (≥128 bits, rotatable) + optional IP allowlist. Our original approach, now vendor-endorsed |
| Per-gym callback URL | Configured at **server/account level** | **One URL for all gyms.** Gym resolved from `DeviceID` → `access_devices` (hence its global uniqueness) |
| Code tables | `VerifyType` 1 Finger / 2 Card / 3 Password / 15 Face · `CheckingStatus` 0 In / 1 Out / 4 OT-In / 5 OT-Out · `Event` 3 Door Unlocked | Real `z.nativeEnum()` enums; raw payload still retained in `access_events.raw` |
| Denied-access events | **Not** pushed. They land in the device transaction table, reachable only by polling `DATA QUERY tablename=transaction` | **Not ingested** — see below |
| Retry / duplicate delivery | Not answered | Always-200 + idempotency on `(gym, device, subject, occurred_at)` — correct under any policy |

### Two consequences worth being explicit about

**We do not poll for denials.** When a membership is expired the gate simply
does not open and the reader shows an error on its own screen. Our database
already knows *why* — expired, suspended, cancelled, unverified — so the front
desk sees the real reason in our app the moment they look the member up.
Polling the vendor to be told something we already know would add a queued
command per device per interval for no information gain. `access_events`
records **successful entries only**.

**`CheckingStatus` is advisory.** With one reader serving both entry and exit,
the device cannot reliably tell direction — it reports whatever mode it is in.
So the data is modelled as a stream of **visits**, not paired in/out sessions,
and no time-in-gym or occupancy feature is built on it. Anything else would be
inventing data the hardware does not have.

**Shared-account note:** one callback URL means we receive events for every gym
on the account, including non-customers. We store only events whose `DevSN`
maps to a device we know, and never trust a gym id from the payload.

---

## 4. Command delivery

| Asked | VFT answer | Decision |
| --- | --- | --- |
| Does 200 mean applied? | No — it confirms **queuing**. The command string is enqueued in the database | Outbox design confirmed correct |
| Offline devices | On reconnect the device **fetches its queued buffer sequentially** via the PUSH pull | Commands are **not lost**. The outbox exists to know when a command was *applied*, not to guard against loss |
| Per-command status | None beyond queue listing (`GET /api/devicecmd`, `/api/devicecmd/{DevSN}`) | Queue drainage is the only completion signal |
| Validity window | Described via raw `DATA UPDATE user Pin=… StartTime=… EndTime=…` | Prefer the typed `POST /api/devicecmd/validperiod` from the collection; **verify on the test device**. Raw strings stay confined to `lib/access-control/` |
| Token management | JWT from `POST /api/user/`, validated at `GET /api/user/auth`. Serverless needs central token state | Per-gym cached token with TTL, refresh once on 401. Vendor explicitly endorses central storage |
| Rate limits | Not answered | Pace at ~1 req/s per gym; chunk the daily reconcile |
| Error shapes | Not answered | Retry 5xx/timeouts with backoff; never retry 4xx; dead-letter after budget |

---

## 5. Dates and time zones

| Asked | VFT answer | Decision |
| --- | --- | --- |
| `EndDate` inclusive? | **Yes** — inclusive through 23:59:59 of the given date | Matches our assumption. `validTo = next_due_date` is correct as-is. Still worth confirming on hardware |
| `AttTime` timezone | Device-local, per the device's `TimeZone` (minutes from UTC, e.g. `330` = UTC+5:30) | Convert using the device's stored offset → persist UTC. Do not assume Asia/Colombo; read the device's own value |

The `AttTime` answer is a small but real correction to the earlier assumption:
the offset comes from the **device record**, not from a hardcoded gym timezone.

---

## 6. Documentation discrepancies — resolved

| Topic | Use |
| --- | --- |
| Auth header | `ApiToken` (headers are case-insensitive, but match the collection) |
| Logout | `POST /api/user/logout` |
| Device update path | `PUT /api/device/{DevSN}` — serial, not integer id |
| Employee create | **Include** `AreaID` (integer) for automatic area linkage |
| Area create | **Omit** `AreaID`; the backend assigns an integer |
| Deletion | `DELETE` exists **only** for employees, device templates, and command queues. **No area or device delete** |

The last row has a product consequence: `POST /devices/[id]/unlink` removes a
device from *our* database only, and the UI must say so rather than implying
the hardware was deprovisioned.

---

## 7. Verify on the first test device

Cheaper to measure than to ask again, in rough priority order:

1. **9-digit `EmpId`** stores whole, no silent truncation. *Highest severity —
   truncation grants the wrong member access, and it is invisible until someone
   walks through a door they shouldn't.*
2. **`EndDate` inclusivity** — a member whose window ends today still gets in
   today.
3. **`validperiod` typed endpoint** works, or we fall back to the raw
   `DATA UPDATE user` form.
4. **Command acknowledgement** — a command really does vanish from
   `GET /api/devicecmd/{DevSN}` once applied.
5. **Offline buffering** — unplug, send `accessblock`, reconnect, confirm it
   lands.
6. **Enrolment-mode timeout** — how long the reader waits before giving up.

---

## 8. Still ours to decide

1. ~~**Member stops paying — locked out?**~~ **Settled: yes.** A member is
   admitted for the whole of `next_due_date` and refused from **00:00 the next
   day** — due on the 15th means training on the 15th and refused from 16th
   00:00. This is local gym culture and it is exactly what the design already
   produces (`validTo = next_due_date` + VFT's inclusive `EndDate`). The
   *device* enforces it from its own clock, so the lockout does not wait for our
   daily cron. See §3.4 of the plan.

   ⚠️ **Separate and still open: the _gym_ stops paying _us_.** Different
   question — whether a whole gym's members lose door access because the gym's
   Metric subscription lapsed. Recommendation: **no**. Stop syncing, leave
   devices in their last known state, banner the gym. The members did nothing
   wrong, and mass-locking them over their gym's billing dispute is a
   physical-safety and reputational risk. Needs a product call before Phase 3.
2. **Biometric consent.** Fingerprint templates are sensitive personal data.
   They live on VFT's hardware, but we trigger enrolment — so the privacy policy
   needs a biometric disclosure and registration needs a consent alongside
   `accepted_terms_at` / `accepted_gym_rules_at`. Before Phase 3.
3. **Remote door-open** stays Enterprise-only, gym-owner-only, rate-limited,
   audited with actor and timestamp.

## 9. Explicitly out of scope

Recorded so they are not re-litigated: multi-finger enrolment, cross-device
template propagation, device-replacement migration, duplicate-finger detection,
denial-event ingestion, and template upload/restore.

VFT confirmed raw template upload is technically possible
(`DATA UPDATE tablename=templatev10`), so backup and restore remain available
later if ever wanted — but nothing in this build depends on it.
