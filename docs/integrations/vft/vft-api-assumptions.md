# VFT / ZKTeco — evidence-graded assumptions

> **⚠️ Substantially superseded on 2026-08-28.** VFT supplied the
> `VFT_GYM_API_V2.0` Postman collection, the full event-code table and the full
> return-value table, and answered the field-limit and `AreaID` questions on a
> call. Endpoint paths, parameter casing, field limits and the webhook payload
> are now **fact**, recorded in
> [`vft-api-reference.md`](./vft-api-reference.md) and
> [`vft-code-tables.md`](./vft-code-tables.md). **Where this document disagrees
> with those, they win.** A1, A2, A8 and A9 below are resolved; A3, A4, A7 and
> A10 stand; token expiry remains the one genuinely open question.
>
> The rest is kept because it is the audit trail: it records what we believed
> before the vendor answered, which is what makes the design's containment
> choices legible. Every assumption below carries its **evidence grade**, the
> **decision** it drove, what **breaks if it is wrong**, and how the design
> **contains** that.
>
> Questions we would still like answered: `vft-integration-questions.md`.
> Design: `docs/architecture/access-control-integration.md`.
> **Single source of truth: `docs/architecture/access-control-master.md`** — start
> there; this document is its §3.10 in full.

## Why proceeding is reasonable

The VFT GYM API is a thin REST wrapper over **ZKTeco's PUSH (ADMS) protocol**,
which is not proprietary knowledge — it is published, reverse-engineered, and
implemented in numerous open-source libraries. Every endpoint in the Postman
collection maps onto a documented PUSH primitive:

| VFT endpoint                 | Underlying PUSH mechanism                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| `POST /api/devicecmd`        | server queues `C:<CmdID>:<TYPE> <params>`                        |
| `GET /api/devicecmd/{DevSN}` | commands awaiting the device's `GET /iclock/getrequest?SN=` poll |
| `validperiod`                | `DATA UPDATE user … StartTime=… EndTime=…`                       |
| `enrollfinger`               | `C:<id>:ENROLL_FP`                                               |
| webhook attendance array     | device `POST /iclock/cdata?table=ATTLOG`                         |

So the risk is not "we are guessing at a black box". It is "we are relying on a
documented protocol whose _wrapper_ we have not yet exercised". That is an
ordinary integration risk, and the design below is built to absorb it.

**Evidence grades**

- **A — Observed.** Seen firsthand on real hardware.
- **B — Documented.** In the ZKTeco PUSH/ADMS spec, official manuals, or
  multiple independent implementations.
- **C — Inferred.** Follows from A/B plus the VFT collection, but not directly
  attested.
- **D — Guess.** Reasonable, unattested. _No D assumption is allowed to gate
  door access._

---

## The assumptions

### A1 — Personnel ID is numeric, ≤ 9 chars, valid range 1–79,999,999 · **grade B → A (platform)**

**Resolved 2026-08-28.** VFT: `EmpId` is **numbers only (recommended), 15
characters maximum**. `EMP_ID_MAX_LENGTH = 15` records the platform limit.

ZKBioSecurity documents Personnel ID as max 9 characters with a valid range of
**1 to 79,999,999**. `EmpId` maps to this field.

Our allocator still caps at **79,999,999**, well inside VFT's 15 characters, and
that stays. 15 is the _platform's_ limit; the K40/F18 firmware limit is still
unconfirmed, and the two need not agree. Exhaustion is loud and slow;
truncation would be silent — so the conservative number is the right one to be
wrong with.

**Decision.** `subject_id` comes from a Postgres sequence starting at `100000`
and is **hard-capped at 79,999,999** in code, with the cap asserted in tests.
Never `member_number` (per-gym, so it collides on a flat namespace).

**If wrong (cap is lower, e.g. 5 digits on older K40/F18 firmware):** ~79.9M
addresses shrink to 99,999. Contained: the cap is one constant, ids are
allocated lazily _at first provisioning_ rather than at registration, and a
`subject_id` is released back when a member is purged. Changing the constant is
a one-line change plus a re-provision.

**Why this is safe to build on:** the failure is _exhaustion_, which is loud and
slow, not _truncation_, which is silent. We additionally verify the round-trip
(§ Verification) so truncation cannot pass unnoticed.

### A2 — Devices acknowledge command execution with a return code · **grade B → A — CONFIRMED**

**Resolved 2026-08-28.** VFT supplied the complete return-value table — 83
codes, transcribed in [`vft-code-tables.md`](./vft-code-tables.md). `>= 0` is
success exactly as assumed. Of particular note, `-725` _"it times out when the
device waits for the result"_ is the two-minute device timeout VFT described
verbally: it is **observable as a return code**, which is what lets the outbox
tell a missed command from a refused one.

This corrects an earlier assumption. The PUSH protocol has an explicit
acknowledgement path: after executing a command the device POSTs to
`/iclock/devicecmd?SN=<serial>` with `ID=<CmdID>&Return=<value>&CMD=<TYPE>`,
where `Return >= 0` means success and negative values are documented errors.

**Decision.** Command completion is **not** inferred from disappearance alone.
`VftAccessControlProvider.listPendingCommands()` surfaces whatever return/result
field the wrapper exposes; the drainer treats an explicit non-negative return as
success, an explicit negative as failure, and _absence from the queue with no
return_ as the weaker "presumed applied" signal.

**If wrong (the VFT wrapper hides the return code):** we degrade to
disappearance-as-completion — the earlier design — which still works. This is
why the provider returns a discriminated result rather than a boolean.

### A3 — Device poll interval is ~30 s · **grade B**

The PUSH spec describes the device polling `GET /iclock/getrequest?SN=` at a
default interval commonly documented as 30 seconds (implementations report
5–30 s).

**Decision.** Suspension latency is presented to staff as **"within a minute"**,
never "instantly". The outbox drainer runs every 5 minutes for bulk work, with
an immediate best-effort dispatch on suspend/cancel.

**If wrong (slower):** the UI promise is wrong, not the security. The door still
closes; the copy is a constant.

### A4 — Fingerprint templates enrolled at the device reach the platform · **grade B/C**

Devices push enrolment data to the server over `POST /iclock/cdata`, and the
PUSH SDK documents devices sending fingerprint templates, face templates and
biophotos base64-encoded. Combined with **A6** (enrolment happens at the
terminal), this is what makes detection possible at all.

**Decision.** Enrolment is detected by polling `GET /api/template`, not by
triggering and assuming. `member_access_subjects.finger_enrolled` flips only on
positive observation.

**If wrong (templates never surface via the VFT wrapper):** we cannot confirm
enrolment programmatically. Contained: staff can mark a member enrolled manually
from the access panel, and the door still works — because **access is governed by
the validity window, not by our enrolment flag**. The flag is bookkeeping.

### A5 — `EndTime`/`EndDate` is inclusive, evaluated on-device · **grade A — CONFIRMED**

`DATA UPDATE user … StartTime=YYYYMMDD EndTime=YYYYMMDD` is a documented PUSH
user-table update, and validity is evaluated by the terminal's own firmware
against its RTC — which is why access control keeps working when the network is
down. Date-only bounds in this family are inclusive of the end date.

**Decision.** `validTo = next_due_date`. A member paid through the 15th is
admitted all of the 15th and refused from the 16th at 00:00 local.

**Confirmed by VFT on the call:** _"expires on 15th means the member can walk
in until 00:00 on the 16th."_ Exactly what `validTo = next_due_date` produces.
This was the highest-risk assumption in the integration — the one that would
have locked every member out a day early — and it is now fact. The dedicated
test group in `AccessDecision.test.ts` locks the behaviour in.

### A6 — Enrolment is API-triggered, then completed at the terminal · **grade A — CONFIRMED**

Directly observed: staff pressed buttons on the wall-mounted reader, the finger
was placed three times (the standard ZKTeco capture count), confirmed with OK.
No software involvement at any visible point.

**Revised after the call.** Both paths exist, and VFT confirmed the API one is
intended: calling `enrollfinger` makes the **terminal change state** — a prompt
appears on the reader — and the member then presents their finger there. What
was observed at the gym was staff using the device's own menu instead.

**Decision.** Our app **drives** enrolment (a button in the member modal), and
**detects** completion by polling. The trigger endpoint is no longer optional —
it is the primary flow. See `access-control-ui-and-capacity.md` §2.

**Sub-risk retired:** because we trigger enrolment against an `EmpId` we
allocated, staff never key in an identifier. The collision hedge in A7 stays as
a cheap safety net, not a necessity.

### A7 — Reverse reconciliation, because our view may be incomplete · **design decision**

Not an assumption — a hedge against A6's sub-risk. We pull `GET /api/template`
and flag any device-side `EmpId` with no corresponding subject, instead of
assuming our records are authoritative.

### A8 — Attendance code tables · **grade B**

Corrected by research. Earlier draft had `3 = Password`, which was wrong.

| Field                    | Values                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `VerifyType`             | **0** Password · **1** Fingerprint · **2** Card · **15** Face                              |
| `CheckingStatus` (State) | **0** CheckIn · **1** CheckOut · **2** BreakOut · **3** BreakIn · **4** OTIn · **5** OTOut |
| `Event`                  | `3` observed as door-unlock/granted in the VFT sample                                      |

**Decision.** Enums for `VerifyType` and `CheckingStatus`; `Event` stays
**unmapped** and raw, since only one sample value is attested (grade D — so it
gets no semantics). Raw payload always retained in `access_events.raw`.

**Direction is still advisory** regardless of the code table: with one reader
serving entry and exit, `CheckingStatus` reflects the device's configured mode,
not reality. Events are modelled as **visits**, not paired sessions.

### A9 — `AreaID` is a filter, not an authorization boundary · **grade C → A — CONFIRMED**

**Resolved 2026-08-28.** VFT: the default `AreaID` is **1**, and it is _"not
currently relevant — added for future development"_. Organisational, exactly as
assumed, and not a boundary of any kind. We were right to treat it as zero
isolation, and there is now no reason to revisit that.

The PUSH protocol has no tenant concept — a device belongs to a server, and an
ADMS account addresses all its devices. Areas are an organisational field.

**Decision.** Treated as **zero isolation**. Every identifier reaching the
provider is resolved from our own database under RLS, never from request input.
Credentials never reach a gym user.

**If wrong (it does isolate):** we were merely stricter than necessary. This
assumption is safe _because_ being wrong costs nothing.

### A10 — `accessblock` state can be disturbed by later user-table writes · **grade C/D**

`accessblock` and `validperiod` both write the device user record. Whether one
clobbers the other's flags is firmware-specific and we cannot attest it.

**Decision.** Never send `validperiod` to a subject that resolves to blocked.
Every write is driven by `resolveAccessDecision`, so a blanket refresh is
unreachable by construction.

**Why this is the right call even at grade D:** the guard costs nothing, and the
failure it prevents — silently un-suspending barred members nightly — is one we
would likely never detect from inside the app.

---

## The design principle these feed

**Where an assumption could fail, it must fail toward refusing access, never
toward granting it — except where refusing would lock out a paying member, in
which case it must be loud.**

Concretely:

- **The device's validity window is the primary authority.** If our sync dies
  completely, every member's access still expires correctly on their paid-through
  date, because the terminal enforces it from its own RTC with no network. The
  worst sustained outage degrades us to "expiry works, new payments don't extend"
  — recoverable, not dangerous.
- **Our database is never the thing that opens a door.** We push windows and
  blocks; we never gate an entry in real time. So our downtime cannot lock a gym
  out of its own building.
- **Blocks are explicit commands, not the absence of a grant.** A dropped
  message cannot silently grant access.
- **No grade-D assumption gates access.** A8's `Event` mapping and A6's
  sub-risk are the only Ds, and both are confined to bookkeeping.

---

## Verification on the first live terminal

The build is complete and testable without any of these; these are the checks
that convert grades B/C into A. In priority order:

1. **A5 — `EndDate` inclusivity.** Set a member to end today; confirm entry
   today and refusal tomorrow. _One-line fix if wrong; most visible failure._
2. **A1 — id round-trip.** Provision a 8-digit id (e.g. `79999999`), read it
   back via `GET /api/template`, confirm it is unchanged. _Detects silent
   truncation, which is the only failure here that grants wrong access._
3. **A2 — return codes.** Send a `validperiod`, inspect `GET /api/devicecmd`
   before and after the device picks it up; look for a return/result field.
4. **A4 — enrolment visibility.** Enrol at the terminal, poll `GET /api/template`,
   measure how long until it appears.
5. **A6 sub-risk — who assigns the id.** Watch a real enrolment: does the
   operator pick our pushed record or type an id?
6. **A3 — poll latency.** Time a `accessblock` from dispatch to effect.

Each maps to a test in `features/access-control/tests/` that currently asserts
the _assumed_ behaviour — so when hardware contradicts one, the failing test
tells you exactly what to change.

---

## Sources

**Primary — vendor-supplied, 2026-08-28.** These outrank everything below.

- `VFT_GYM_API_V2.0` Postman collection → [`vft-gym-api-v2-collection.json`](./vft-gym-api-v2-collection.json)
- Event Codes table (165 codes) → [`vft-code-tables.md`](./vft-code-tables.md)
- Command Return Values table (83 codes) → same file
- Verbal answers on the integration call → [`vft-api-reference.md`](./vft-api-reference.md)

**Secondary — research, used before the vendor answered.**

- [ZKTeco PUSH SDK communication protocol](https://www.scribd.com/document/695654988/PUSH-SDK-Communication-Protocol-V2-0-1)
- [HTTP PUSH SDK 2.0.1 (PDF)](http://f02.s.alicdn.com/kf/HTB1PANmFVXXXXaCXVXX.PRXFXXXk.pdf)
- [ZKBioSecurity user manual — Personnel ID limits](https://www.zkteco.co.za/softwarenew/user_manuals/ZKBioSecurity_3.2.0_user_manual.pdf)
- [zk-protocol reverse-engineered spec](https://github.com/adrobinoga/zk-protocol/blob/master/protocol.md)
- [zkteco-adms (Go implementation)](https://github.com/s0x90/zkteco-adms)
- [go-zkteco — attendance log VerifyType/State codes](https://pkg.go.dev/github.com/farizfadian/go-zkteco)
- [ZKTeco ADMS protocol overview](https://www.linkedin.com/pulse/zkteco-adms-protocol-link-your-zk-device-server-herbin-tsobeng-qg0ze)
