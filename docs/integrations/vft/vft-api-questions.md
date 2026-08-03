# VFT GYM API v2.0 — question rationale and fallback assumptions

> **The sendable text lives in `vft-api-questions-email.md`.** This file is the
> internal companion: why each question matters, what we will assume if it goes
> unanswered, and what breaks if that assumption is wrong. Numbering follows the
> email's sections so the two never drift.
>
> Integration design: `docs/architecture/access-control-integration.md`.
>
> **Hardware reality: ~90% fingerprint readers**, face units a small minority.
> That makes §2 (enrolment and templates) as blocking as §1, and it is the
> section the vendor documentation covers least.

---

## Priority

| Priority | Email section | Why |
| --- | --- | --- |
| **Blocking** | §1 account structure & `EmpId` | Determines the database schema and the tenant-isolation story |
| **Blocking** | §2 fingerprint enrolment & templates | Determines the enrolment workflow, and 2.3 carries real commercial risk |
| **High** | §3 webhook auth, §4 command delivery | Determines how much reliability and security code we write |
| **Medium** | §5 dates/timezones | One wrong assumption = visible lockouts on day one |
| **Low** | §6 doc contradictions | Cheap to resolve empirically if unanswered |

---

## Rationale and fallbacks

| Email ref | Why we're asking | Assumption if unanswered | Risk if wrong |
| --- | --- | --- | --- |
| **1.1–1.2** account isolation | Multi-tenant SaaS; one gym must never touch another's users | Per-gym accounts; `subject_id = members.member_number` | Rework of `member_access_subjects` + backfill; cross-tenant ID collisions until fixed |
| **1.3** `EmpId` constraints | Our IDs are UUIDs and cannot be pushed | Numeric, ≤ 9 digits (ZKTeco `Pin` convention) | **Highest-severity unknown.** Silent truncation → the wrong member gets access |
| **2.1** template storage location | Decides whether we hold any template state ourselves | Platform-side (implied by `/api/template` + `templatev10`) | If device-only, a device swap loses every enrolment |
| **2.2** propagation to other devices | Entry + exit turnstiles are the norm | **Not** automatic — we issue an explicit sync intent after every enrolment | Members enrolled at one door are rejected at the next |
| **2.3** device replacement | A reader dies; does the gym re-enrol everyone? | Templates are portable within a model family | **Biggest commercial risk.** Re-enrolling 500 members is not something we can ask a gym to do |
| **2.4** `fingerId` semantics | Drives the enrolment UI and re-enrol flow | Range 0–9, one call per finger, re-enrol overwrites | Enrolment silently fails or overwrites the wrong finger |
| **2.5** enrolment completion signal | Front desk needs "enrolled ✓" while the member is present | Poll `GET /api/template` and compare counts; ~60 s device timeout | Staff can't tell success from failure; members leave un-enrolled |
| **2.6** device capacity | ZKTeco units commonly cap at 1,500–3,000 templates | ~3,000; warn the gym at 80% | A large gym hits the cap and enrolments fail silently |
| **2.7** duplicate-finger detection | One membership shared between two people is common gym fraud | Not detected by the platform — we cannot detect it either | Revenue leakage the gym cannot see; worth surfacing if VFT does detect it |
| **2.8** re-enrol / removal | Poor-reading fingers are routine support work | `DELETE /api/template/fromdev/{id}` clears templates, keeps the employee | Support has no recovery path short of deleting the member |
| **2.9** enrol-from-stored-data | We already hold member photos | Impossible — enrolment is physical, at the device | We'd promise customers something we cannot deliver |
| **3.1–3.3** webhook security | Their spec ships with **no** auth at all, unlike text.lk/PayHere | 128-bit token in the URL path, always-200, dedupe on `(gym, device, subject, occurred_at)` | Forged check-ins; duplicate or lost attendance rows |
| **3.4–3.5** event code tables | Cannot classify entry/exit/denial without them | Store raw codes in `access_events.raw`, decode later | Phase 4 UI can't classify; no data lost |
| **4.1–4.3** command acknowledgement | 200 = queued, not applied | Queued-not-applied; drift detected by re-asserting against `listPendingCommands` | Reconciler either misses drift or re-sends endlessly |
| **4.4** error contract | Some failures must be retried, others never | Retry 5xx/timeout with backoff; never retry 4xx | Retry storms, or real failures silently swallowed |
| **4.5** rate limits / bulk | 500 members re-asserting daily = 500 calls | Serialise per gym, ~1 req/s, chunked reconciliation | Throttling or a ban during the daily re-assert |
| **4.6** token lifetime | Serverless = many concurrent instances | Cache per gym with TTL; re-sign-in once on 401 | Sign-in storms; instances invalidating each other's tokens |
| **5.1** `EndDate` inclusivity | Decides whether members are locked out a day early | **Inclusive** | Off-by-one lockouts — every gym notices immediately |
| **5.2** `AttTime` timezone | No offset in the sample | Gym-local (Asia/Colombo) → stored UTC | Attendance times wrong by hours |
| **6.1–6.6** doc contradictions | PDF and collection disagree | Follow the **Postman collection** — it's executable, so more likely current | Wasted debugging against a stale spec |

---

## Verify empirically on the first test device

Regardless of what comes back in writing, confirm these by hand — they are the
assumptions most likely to be wrong and most visible to end users:

1. **`EndDate` inclusivity (5.1).** Set a member to end today; confirm they get
   in today and are refused tomorrow.
2. **Cross-device propagation (2.2).** Enrol on device A, immediately present
   the same finger at device B without issuing any sync call.
3. **Offline command delivery (4.3).** Unplug a device, send `accessblock`,
   reconnect, confirm the block lands.
4. **Rejected-scan webhook (3.5).** Present an expired member's finger and see
   whether an event arrives, and with which codes.
5. **`EmpId` width (1.3).** Push a deliberately long value and check for
   truncation rather than an error.

---

## Consequences already folded into the design

- Enrolment is a **two-step, physically-present** flow — the UI must say so and
  cannot offer "enrol from photo".
- Because 2.2 is assumed *not* automatic, a successful enrolment enqueues a
  **template-propagation intent** to the gym's other devices through the same
  outbox as every other command.
- Because 2.5 has no completion callback, enrolment is modelled as **pending
  until observed**, which is exactly the pending-vs-error distinction rule 2.8
  requires.
