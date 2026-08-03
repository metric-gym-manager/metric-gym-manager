# Questions for VFT — GYM API v2.0 integration

> Companion to `docs/architecture/access-control-integration.md`.
> Source material reviewed: **VFT_GYM_API_Documentation.pdf** (11 pp.) and
> **VFT_GYM_API_V2.0.postman_collection.json**.
>
> Q1–Q4 are **hard blockers**: we cannot design the database or ship Phase 2
> without them. Q5–Q9 change how much reliability code we write. Q10–Q13 are
> confirmations where the PDF and the Postman collection disagree with each
> other, so we cannot tell which is current.
>
> Each question states *why we're asking* and *what we'll assume if we don't
> hear back*, so silence still lets us move — just at more risk.

---

## Copy-paste version (send this)

Hi — we're integrating the VFT GYM API v2.0 into our gym-management platform
(multi-tenant SaaS; each gym is a separate customer). We've worked through the
v2.0 PDF and the Postman collection. Thirteen questions, roughly in priority
order.

---

### Blockers

**Q1 — One API account per gym, or one shared account for all of them?**
Our platform runs many independent gyms. Can you issue **separate API
credentials per gym**, so each gym's devices and users are isolated from every
other gym's?

If it must be a single shared account, then: is `EmpId` a **single global
namespace** across every device and area on that account? And is there any
per-area or per-account scoping that would stop Gym A's staff from seeing or
modifying Gym B's users?

*Why:* it decides our entire data model and our tenant-isolation story. With
per-gym accounts we can use each gym's own member numbering; with one shared
account we must allocate and police globally unique IDs ourselves.

**Q2 — What are the exact constraints on `EmpId`?**
Maximum length, allowed characters (digits only, or alphanumeric?), and is it
the ZKTeco `Pin` field directly? Is there a maximum number of employees per
device or per account?

*Why:* our internal member IDs are UUIDs and clearly won't fit. We need to know
what we're allowed to generate before we generate it.

**Q3 — How is the attendance webhook secured, and how do we configure it?**
The collection shows the platform POSTing an event array to
`{your_webhook_url}`, but we couldn't find any authentication on it — no
signature, no token, no secret.

- Can you send a **custom header** (e.g. `X-Api-Key`) or an **HMAC signature**
  with each webhook call?
- Can the callback URL be configured **per gym / per account**, so each of our
  tenants gets a distinct URL?
- Do you **retry** failed deliveries? How many times, over what window, and
  what response do you expect from us to count as success?
- Can the same event be delivered **more than once**?

*Why:* without authentication, anyone who learns the URL can forge check-ins
into a customer's account. We plan to put an unguessable token in the URL path,
but we'd much rather also verify a header or signature.

**Q4 — How do we know a command actually reached the device?**
`POST /api/devicecmd/*` appears to enqueue a command that the device later
collects. Our reading is that HTTP 200 means *queued*, not *applied*.

- Is that correct?
- Is `GET /api/devicecmd/{DevSN}` returning nothing for a command the only
  signal that it was delivered — or is there a per-command **status/result**
  field we can poll?
- Is there a webhook or callback when a command succeeds or fails on the device?
- How long do undelivered commands stay queued before you discard them?
- If a device is **offline** when we send `validperiod` or `accessblock`, does
  it receive the command when it reconnects, or is it lost?

*Why:* this is the difference between "we can prove the door is in sync" and
"we hope it is". It directly determines how we detect and repair drift.

---

### Reliability and correctness

**Q5 — What do `CheckingStatus`, `VerifyType` and `Event` mean?**
The webhook example carries `"CheckingStatus": "0"`, `"VerifyType": "1"`,
`"Event": "3"`. Could you send the **full code tables** for all three?

Specifically: which values mean entry vs exit, which mean *access denied*
(expired or blocked user), and which mean face vs fingerprint vs card vs PIN?

*Why:* without these we can record that *something* happened at the door but
can't tell an admitted member from a rejected one — which is most of the value.

**Q6 — What does an error response look like?**
The documentation shows only success payloads. Could you give us the HTTP
status codes and error body format for: bad credentials, expired/invalid token,
unknown `DevSN`, unknown `EmpId`, malformed body, and device unreachable?

*Why:* we retry some failures and must never retry others (e.g. "unknown
employee" should surface to staff, not retry forever).

**Q7 — Are there rate limits?**
Requests per second/minute/hour, per account or per device? Is there a **bulk**
way to set valid periods for many employees at once, or must we issue one
`validperiod` call per member?

*Why:* a gym with 500 members re-asserting daily is 500 calls. If there's a
batch endpoint we'd rather use it; if there's a limit we need to pace ourselves.

**Q8 — How long is the API token valid, and how should we refresh it?**
Does `POST /api/user/` invalidate a previously issued token? Can multiple
tokens be active at once for one account? Is there a refresh endpoint, or do we
re-sign-in? What exactly does an expired token return?

*Why:* we run on serverless infrastructure with many concurrent instances. If
each sign-in invalidates the last, instances will fight each other and we must
centralise token handling.

**Q9 — What timezone is `AttTime` in?**
The sample is `"2024-01-15 08:30:15"` with no offset. Is that device-local
time, account-local, or UTC? How does it relate to the device's `TimeZone`
field (e.g. `"330"`)?

Relatedly, for `validperiod`'s `StartDate` / `EndDate` (`YYYYMMDD`): is
`EndDate` **inclusive** — i.e. does a user with `EndDate=20260107` still get in
during the day on 7 January?

*Why:* `EndDate` inclusivity decides whether members are locked out a day
early. That's a support call from every gym on day one, so we'd rather be sure.

---

### Documentation confirmations

The PDF and the Postman collection disagree in a few places; we just need to
know which is current.

**Q10 — Header name.** The PDF uses lowercase `apitoken` for
`GET /api/user/auth` but `ApiToken` everywhere else. Is the header
case-insensitive, or must we match exactly per endpoint?

**Q11 — Logout method.** PDF says `GET /api/user/logout`; the collection sends
`POST`. Which is it?

**Q12 — Device update path.** The PDF documents `PUT /api/device/{id}` with
"id: Device ID (integer)", but the collection calls
`PUT /api/device/QEM1253800017` — a serial number. Is the path parameter the
integer id or the `DevSN`? Same question for `PUT /api/area/{id}`.

**Q13 — Employee create body.** The PDF's `POST /api/template/add` body is
`{EmpId, EmpName}`; the collection also sends `AreaID`. Is `AreaID` required?
What happens if it's omitted — does the user reach no devices at all?

Also, two small ones:
- `POST /api/area` in the PDF includes `"AreaID": "A01"` in the request body,
  but the collection omits it and `AreaID` appears to be a server-assigned
  integer elsewhere. Is `AreaID` client-supplied or server-generated?
- Is there a `DELETE` for areas and devices? Neither document shows one.

---

### One thing we want to confirm we've understood correctly

**Biometric enrolment is physical.** Our reading is that
`POST /api/devicecmd/enrollface` and `enrollfinger` put a **device** into
enrolment mode for a given employee, and the person must then present their
face/finger **at that device**. There is no endpoint to upload a face image or
a template from our side.

Is that right? We already store member photographs, and we want to be certain
we cannot (and should not tell customers we can) enrol from those.

If there *is* a way to push an image or template, we'd like the endpoint —
along with the supported formats and size limits.

---

## Internal notes (do not send)

Working assumptions if answers don't arrive — all of these are recorded in the
plan doc so they can be revisited when the vendor replies:

| Q | Assumption we'll build on | Risk if wrong |
| --- | --- | --- |
| Q1 | Per-gym accounts; `subject_id = members.member_number` | Rework of `member_access_subjects` + a backfill; cross-tenant ID collisions until fixed |
| Q2 | Numeric, ≤ 9 digits (ZKTeco `Pin` convention) | Silent truncation → wrong member gets access. **Highest-severity unknown.** |
| Q3 | 128-bit token in the webhook URL path, always-200, dedupe on `(gym, device, subject, occurred_at)` | Forged check-ins; duplicate or lost attendance rows |
| Q4 | Queued-not-applied; drift detected by re-asserting from `listPendingCommands` | Reconciler either misses drift or re-sends endlessly |
| Q5 | Store raw codes in `access_events.raw`, decode later | Phase 4 UI can't classify entry/exit/denial; no data lost |
| Q6 | Retry on 5xx/timeout with backoff; never retry 4xx | Retry storms, or real failures silently swallowed |
| Q7 | Serialise per gym, ~1 req/s, chunked reconciliation | Throttling or a ban during the daily re-assert |
| Q8 | Cache token per gym with TTL; re-sign-in once on 401 | Sign-in storms across serverless instances |
| Q9 | `AttTime` is gym-local (Asia/Colombo) → stored UTC; `EndDate` **inclusive** | Off-by-one lockouts — every gym notices immediately |
| Q10–Q13 | Follow the **Postman collection** (it's executable, so more likely current) than the PDF | Wasted debugging against a stale spec |

Verify Q9's `EndDate` inclusivity empirically on the first test device
regardless of the answer — it is the assumption most likely to be wrong and
most visible to end users.
