# VFT — integration questions (first contact)

> Ready to send. Replace the bracketed placeholders.
>
> Written as a first approach: it states what we are building, what we intend to
> do with the API, and asks only where a wrong assumption would cost real
> rework. Where we have a sensible default, we state it and ask for
> confirmation rather than asking open-ended — quicker for them to answer and it
> does not hand them our whole design to critique.

---

**To:** [VFT technical contact]
**Subject:** VFT GYM API v2.0 — integration questions

Hi [Name],

We're integrating the VFT GYM API v2.0 into [product name], a gym management
platform. We've worked through the v2.0 documentation and the Postman
collection, and have a design ready — but there are a few points the
documentation doesn't settle, and getting them wrong would mean rebuilding
rather than adjusting. Hence this list.

Some context so the questions make sense.

Our platform is multi-tenant: each gym is a separate customer, with its own
members and its own hardware. A typical site here is **one fingerprint terminal
at the entrance and a few hundred members**. Our system holds the membership
record and payment status.

The behaviour we need is simple to state: **a member is admitted through the
last day they have paid for, and refused from midnight that night.** A member
paid through the 15th trains on the 15th and is turned away from the 16th. So
our intent is to push each member's paid-through date to the terminal as a
validity window and let the terminal enforce it, rather than have our servers
gate every entry.

Questions grouped below. **1 to 4 are the ones we can't proceed without.**

---

## 1. Account structure and member identity

We plan to create one `AreaID` per gym, and to map each of our members to a
numeric `EmpId` that we allocate.

- Can you issue **separate API credentials per gym**, or is the expected model
  one account with multiple areas?
- Is `EmpId` unique **per account** or **per `AreaID`**? If the same `EmpId` is
  used in two different areas, what happens — separate records, or does one
  overwrite the other?
- What is the **maximum length and permitted character set** for `EmpId`? If we
  send a value that's too long, does the API reject it or does the terminal
  truncate it silently?

*Our member identifiers are UUIDs, so we have to generate `EmpId` values
ourselves. Whether we need them unique globally or only per gym changes how we
allocate them, and the length limit sets how many we can issue.*

## 2. Validity windows and expiry

We plan to call `POST /api/devicecmd/validperiod` with `StartDate` /`EndDate`
set from the member's paid-through date.

- Is `EndDate` **inclusive**? Does a member with `EndDate=20260115` get in
  during the day on 15 January?
- Is the check performed **on the terminal itself**, so it keeps working if the
  terminal loses its internet connection or our servers are unreachable?
- Is it evaluated against the **terminal's own clock and `TimeZone` setting**?
- How is the terminal's clock kept accurate — NTP, synchronised from your
  server, or set manually at installation? Can we **read or set it through the
  API**?

*Because the cutover lands at local midnight, a terminal with a drifting clock
would admit expired members or turn away paid ones. We'd like to detect that
rather than hear about it from a gym.*

## 3. Command delivery and confirmation

Our reading of `/api/devicecmd/*` is that it queues a command which the terminal
collects on its next poll, rather than applying it immediately.

- Is that right — does **HTTP 200 mean queued rather than executed**?
- **How do we confirm a command was actually applied?** Is a command
  disappearing from `GET /api/devicecmd/{DevSN}` the signal, and does it
  disappear when the terminal *collects* it or when it *succeeds*? Is there a
  status or result field we've missed?
- If the terminal is **offline** when we send a command, is it held and
  delivered on reconnect? **For how long** before it's discarded?

*We need to know when a member's access has genuinely changed on the hardware,
not just that we asked for it. If there's no positive confirmation available,
we'll design around that — but we'd rather know now.*

## 4. Suspensions

For an immediate suspension — a member barred mid-membership — we plan to use
`POST /api/devicecmd/accessblock`, keeping `validperiod` for ordinary expiry.

- Does a block **persist until an explicit `accessgrant`**?
- If we later send a `validperiod` update for that same `EmpId`, does it
  **clear the block**?

*If a validity update can undo a block, our nightly refresh would silently
un-suspend people. In that case we'd revoke the fingerprint instead — but that
means the member re-enrols when the suspension is lifted, so we'd like to know
which approach you'd recommend.*

---

## 5. Fingerprint enrolment

We've been through enrolment at a gym running your hardware. A staff member took
us to the wall-mounted terminal, pressed buttons **on the device itself** to
start enrolment, had the same finger placed three times, and confirmed with the
OK key. Nothing appeared to be initiated from software.

That raises the questions below, because our platform is the thing that assigns
member identifiers.

- Is enrolment **at the terminal** the expected flow, or is
  `POST /api/devicecmd/enrollfinger` an equally supported path? Which do you
  recommend for a system like ours?
- **When staff enrol at the terminal, do they select an employee record that is
  already on the device, or do they create one there and key in the ID?**
  This is the one that matters most to us. We assign each member a numeric
  `EmpId` and push it down; if operators key in their own IDs at the terminal
  instead, the two will not line up and we need to know that before we build the
  allocation.
- Does a fingerprint enrolled at the terminal get **uploaded back to the VFT
  platform** — on the device's next sync, or not at all?
- Once it has, does `GET /api/template` reflect it? What comes back per employee
  — a per-finger record, a template count, an enrolment timestamp?
- Does an employee need to be synced to the terminal (via
  `/api/template/syncsometoone`) before a `validperiod` command will bind to
  them?

*Enrolment happens at the wall, where our software can't see it. So we need to
detect it from the platform instead — the staff screen should flip from "not
enrolled" to "enrolled" on its own. Knowing what to poll, and how soon it shows
up, tells us whether that's achievable.*

## 6. Attendance webhook

- **How is the callback authenticated?** We couldn't find a signature or shared
  header in the documentation.
- Can the callback URL be configured **per gym or per area**, or is there one
  URL per account?
- Do you **retry** failed deliveries, and can the same event arrive twice?
- Could you send the **code tables** for `CheckingStatus`, `VerifyType` and
  `Event`? The samples show values (`0`, `1`, `3`) but not their meanings.
- Does a **refused** scan generate an event — an expired member, or an
  unrecognised finger — or only successful entries?

## 7. Operational limits

- Are there **rate limits**, per account or per terminal?
- How long is the `ApiToken` valid, and does signing in again **invalidate the
  previous token**? (We run on serverless infrastructure, so several processes
  may hold a token at once.)
- What do **error responses** look like — status codes and body — for an invalid
  token, an unknown `DevSN`, an unknown `EmpId`, and a malformed request?

## 8. Hardware

- Which **terminal models** are typically deployed with gyms here?
- What is the **fingerprint template capacity** per unit, and what does the
  terminal do when it's full?

---

Two closing notes.

We found a handful of places where the PDF and the Postman collection differ —
the auth header casing, the logout method, and whether the device update path
takes an integer id or the `DevSN`. **We're following the collection** on the
assumption it's the more current of the two; do correct us if that's wrong.

Finally: is there a **test account and a spare terminal** we could point a
staging environment at? Several of the questions above would be settled faster
by an afternoon of testing than by email, and it would save you the round trip.

Happy to get on a call if that's easier for any of this.

Thanks very much,

[Your name]
[Role] · [Company]
[Email] · [Phone]
