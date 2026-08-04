# VFT — round 2 questions

> Follow-up after VFT's first reply (`vft-api-answers.md`). Three kinds of
> question: **(a)** raised by their answers, **(b)** asked in round 1 and not
> answered, **(c)** driven by the confirmed lockout rule (§3.4 of the plan).
>
> §1 is the new priority: the entire product promise now rests on a device
> refusing an expired member at midnight, using its own clock.
>
> Sendable text below the line; internal notes at the end.

---

**To:** [VFT technical contact]
**Subject:** VFT GYM API v2.0 — follow-up questions after your technical analysis

---

Hi [Name],

Thank you for the detailed answers — they resolved the account structure,
template handling and command delivery questions, and we've built the design
around them.

A second, shorter round. Most of these come out of your answers; a few were in
the first list and I think were missed.

Some context on why §1 matters so much to us: our members' access expires
**inclusively on their due date**. A member due on the 15th trains on the 15th
and is refused from **16th 00:00**. We're relying on the device to enforce that
boundary itself from the `EndDate` we push, rather than on our servers being
reachable at midnight — so the device's own timekeeping becomes load-bearing.

---

## 1. Device timekeeping and the expiry boundary

**1.1** How does a device keep its clock? NTP, sync from your server on each
PUSH poll, or manually set at installation? **If it drifts, what corrects it?**

**1.2** Is there an API call to read or set a device's current time? We'd like
to detect drift and alert the gym rather than discover it when a member is
wrongly admitted or refused.

**1.3** When you say `EndTime`/`EndDate` is inclusive through 23:59:59 — is
that evaluated against the **device's local clock** using its configured
`TimeZone` (e.g. `330`), or against server time? We want to be sure the cutover
happens at local midnight.

**1.4** What is the device's PUSH poll interval — how soon after we enqueue a
command does a healthy, online device typically collect it? Is it configurable?

*This sets what we can honestly promise staff when they suspend a member and
expect the door to stop admitting them.*

---

## 2. Tenancy under a shared account

You confirmed there's no native tenant isolation and that `AreaID` is the
scoping mechanism. We need to know how strong that boundary actually is.

**2.1** With one API token, is `AreaID` a **filter** or a **boundary**? That is:
can that token read, modify or delete employees and devices belonging to an
`AreaID` other than the one it's working with?

**2.2** Can two different `AreaID`s each hold an employee with the **same
`EmpId`**? Or is `EmpId` unique across the whole account regardless of area?

*If `EmpId` is unique per area, our ID allocation gets significantly simpler —
this is worth confirming precisely.*

**2.3** Is `DevSN` globally unique across your entire platform, not just within
an account? We identify which gym an incoming webhook event belongs to purely
from `DeviceID`, so a collision would misfile a check-in.

**2.4** Can areas be created via the API (`POST /api/area`), and is there any
practical limit on how many an account can hold? We'd create one per gym.

**2.5** Since the webhook callback is configured at account level: on a shared
account, will we receive attendance events for **every** area on it — including
gyms that aren't our customers? If so, is there a way to filter the callback by
area or device?

---

## 3. Command semantics

**3.1** For setting a member's validity window, which is canonical: the typed
`POST /api/devicecmd/validperiod?DevSN=&EmployeeId=&StartDate=&EndDate=` in the
Postman collection, or the raw
`DATA UPDATE user Pin=… StartTime=… EndTime=…` form your answer described? Are
they equivalent, and is either preferred or deprecated?

**3.2** Must an employee already be synced to a device before `validperiod`
will apply to them, or does it create the user record if absent? What's the
correct call order for a brand-new member?

**3.3** How do `accessgrant` / `accessblock` interact with `validperiod`?
Specifically: if we `accessblock` a member whose `EndDate` is still in the
future, does the block hold until an explicit `accessgrant` — and would a later
`validperiod` update silently undo it?

*We use `validperiod` for normal expiry and `accessblock` for immediate
suspensions, so the interaction between them matters.*

**3.4** Is there a **bulk** form of `validperiod` — one call covering many
employees, as `syncsometoall` does for templates? A 500-member gym re-asserting
daily is otherwise 500 individual calls.

**3.5** After `DELETE /api/template/fromdev/{id}` removes a member's
fingerprint, the employee record remains. Can that member still gain entry by
any other means — card, PIN, password — or are they effectively locked out until
re-enrolled?

---

## 4. Still outstanding from the first round

**4.1 Rate limits** — any limits per second/minute/hour, per account or per
device? Even an informal "keep it under N/sec" would help us pace correctly.

**4.2 Error responses** — could you share the HTTP status codes and error body
format for: invalid credentials, expired token, unknown `DevSN`, unknown
`EmpId`, malformed body, and device unreachable? We need to retry some failures
and never retry others, and right now we're guessing from status codes alone.

**4.3 Token invalidation** — does calling `POST /api/user/` again invalidate a
previously issued token, or can several be valid at once? You recommended
central token storage for serverless, which we've done; we just need to know
whether a second sign-in would break the first.

**4.4 Webhook retries** — if our endpoint is down or returns an error, do you
retry? How many times and over what period? And can the same event be delivered
more than once?

**4.5 Enrolment timeout** — how long does a reader stay in enrolment mode after
collecting an `enrollfinger` command before it gives up?

---

## 5. Hardware specifics

**5.1** Which reader models are actually deployed with gyms in Sri Lanka? You
noted `EmpId`/`Pin` width is 9 or 24 digits depending on model — we'd rather
size to the real fleet than assume the narrowest limit.

**5.2** For those models: **fingerprint template capacity** per device, and what
a device reports when it's full.

**5.3** Is there a test/sandbox account and a spare device we could point a
staging environment at? Several of the above would be faster to settle with an
hour of hands-on testing than over email.

---

Thanks very much — happy to jump on a call for §1 and §2 if that's easier.

[Your name]
[Role] · [Company]
[Email] · [Phone]

---

## Internal notes (do not send)

### Why each question exists

| Q | Origin | What it changes |
| --- | --- | --- |
| 1.1–1.3 | The confirmed lockout rule | The whole expiry promise rides on device time. A device an hour slow admits an expired member for an extra hour, and nobody would notice |
| 1.4 | Their "queued, collected on poll" answer | Sets the honest wording for "suspend takes effect in ~N minutes" in the UI |
| 2.1–2.2 | Their "flat unless scoped by `AreaID`" answer | If `EmpId` is unique **per area**, we could drop the global sequence and use `member_number`. Worth knowing, but we build the global sequence either way — it's safe under both |
| 2.3 | Our webhook routes by `DeviceID` | A `DevSN` collision misfiles a check-in into the wrong gym |
| 2.4 | We need one area per gym | If area creation is manual/limited, onboarding becomes a support task |
| 2.5 | Account-level callback | Determines whether we're receiving other companies' attendance data, which has privacy implications beyond engineering |
| 3.1 | Their answer described raw `DATA UPDATE`; the collection has typed `validperiod` | If only the raw form works, the command string stays confined to `lib/access-control/` — no feature code touches it |
| 3.2 | Unstated ordering | Wrong order = a new member silently has no validity window |
| 3.3 | **The sharpest one.** | If a nightly `validperiod` re-assert clears an `accessblock`, our daily reconcile would silently un-suspend suspended members. That's a real defect we'd ship without asking |
| 3.4 | Never answered | Decides whether the daily reconcile is 1 call or 500 per gym |
| 3.5 | Their `fromdev` vs full-delete answer | Determines whether biometric revocation is genuinely a lockout |
| 4.1–4.5 | Round 1, unanswered | All currently mitigated by conservative defaults; answers let us relax them |
| 5.1–5.2 | Their "depends on model" answer | Lets us size `EmpId` and capacity to the real fleet instead of the worst case |
| 5.3 | — | Six of the open items are cheaper to measure than to ask |

### Priority if they'll only engage with a few

1. **3.3** — silent un-suspension is a correctness defect, not an unknown.
2. **1.1–1.3** — the expiry boundary is the product's core promise.
3. **2.1–2.2** — tenant isolation strength on a shared account.
4. **5.3** — a test device answers 1.3, 1.4, 3.1, 3.2, 3.3 and 4.5 in an afternoon.

### Nothing here blocks Phase 1

All of it lands in Phase 2–3. Current mitigations hold: conservative pacing,
retry only on 5xx/timeout, central cached token, always-200 webhook with
idempotency, 9-digit `EmpId` cap, and enrolment modelled as pending-until-observed.
