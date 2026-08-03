# Email to VFT — ready to send

> This is the canonical sendable text. Rationale, fallback assumptions, and the
> internal risk table live in `vft-api-questions.md`; the integration design
> lives in `docs/architecture/access-control-integration.md`.
> Replace the bracketed placeholders before sending.

---

**To:** [VFT technical contact]
**Subject:** VFT GYM API v2.0 — integration questions (fingerprint devices, multi-tenant platform)

---

Hi [Name],

We're integrating the VFT GYM API v2.0 into our gym-management platform and
have worked through the v2.0 PDF and the Postman collection in detail. Thank
you for both — they got us most of the way.

Some context so the questions make sense: our platform is multi-tenant SaaS,
where each gym is a separate customer with its own members and its own devices.
The deployed hardware is roughly **90% fingerprint readers**, with face units a
small minority, so most of what follows is about fingerprint enrolment and
template handling.

Questions are grouped below. **Sections 1 and 2 are blocking us** — we can't
finalise the data model or the enrolment workflow without them. Everything else
affects how much reliability handling we build.

---

## 1. Account structure and member identity

**1.1** Can you issue **separate API credentials per gym**, so each gym's
devices and users are isolated from every other gym's? Our platform runs many
independent gyms and we'd strongly prefer hard isolation at the account level.

**1.2** If it has to be one shared account: is `EmpId` a **single global
namespace** across all devices and areas on that account? And is there any
per-area scoping that would prevent one gym's operators from seeing or
modifying another gym's users?

**1.3** What are the exact constraints on `EmpId` — maximum length, allowed
characters (digits only, or alphanumeric?), and is it the ZKTeco `Pin` field
directly? Is there a maximum number of employees per device or per account?

*Our internal member IDs are UUIDs, which clearly won't fit, so we need to know
what we're permitted to generate before we generate it.*

---

## 2. Fingerprint enrolment and templates

This is the area we understand least from the documentation, and it's the one
that most affects day-to-day gym operations.

**2.1 Where are templates stored?** When a member enrols a fingerprint at a
device, is the template stored **centrally on the VFT platform**, or only on
that physical device? The `/api/template` endpoints and the
`DATA QUERY tablename=templatev10` example suggest the platform holds them —
could you confirm?

**2.2 Do templates propagate automatically to a gym's other devices?** If a
member enrols at the entrance turnstile, do they immediately work at the exit
turnstile, or must we explicitly call `/api/template/syncsometoone` /
`syncsometoall` after every enrolment?

**2.3 What happens when a gym adds or replaces a device?** Can existing
templates be pushed to brand-new hardware, or does every member have to
re-enrol? Does this still work if the new unit is a **different model or
firmware** from the original?

*This is our single biggest commercial concern — asking 500 members to re-enrol
because a reader was replaced is not something we can put in front of a gym.*

**2.4 `fingerId` semantics.** What is the valid range (0–9?)? Does each finger
require a separate `enrollfinger` call? How many fingers can one employee
register? And if we call `enrollfinger` with a `fingerId` that already exists,
does it overwrite or return an error?

**2.5 How do we know an enrolment succeeded?** Our front-desk staff need a
clear "enrolled ✓" confirmation while the member is still standing there. Is
there a webhook or event when enrolment completes or fails, or must we poll
`GET /api/template` and compare template counts? How long does the device stay
in enrolment mode before it times out, and what happens if the member walks
away mid-enrolment?

**2.6 Device template capacity.** What is the maximum number of fingerprint
templates a device can hold? What happens when a gym reaches that limit — does
the sync return an error, or does it silently drop templates?

**2.7 Duplicate-finger detection.** Does the platform or the device reject
enrolling a fingerprint that is already registered to a **different** `EmpId`?
Sharing one membership between two people is a common problem in gyms, so if
you do detect this, we'd like to surface it.

**2.8 Re-enrolment and removal.** When a member's finger reads poorly and we
want to clear and re-capture it: what is the correct call? Does
`DELETE /api/template/fromdev/{id}` remove the templates from devices while
keeping the employee record, and is there a way to delete a **single** finger
rather than all of them?

**2.9 Confirming our understanding:** we read `enrollface` / `enrollfinger` as
putting a **device** into enrolment mode for a given employee, with the person
required to present their finger **at that device**. There is no way to enrol
from data we already hold, and no endpoint to upload a template or image.

Is that correct? And separately — is there any way to **export and re-import**
templates (for backup, or migrating a gym to new hardware)? That's really
question 2.3 from the other direction.

---

## 3. Attendance webhook

**3.1 How is the webhook authenticated?** The collection shows the platform
POSTing an event array to `{your_webhook_url}`, but we couldn't find any
authentication — no signature, no token, no secret. Can you send a **custom
header** (e.g. `X-Api-Key`) or an **HMAC signature** with each call?

**3.2** Can the callback URL be configured **per gym / per account**, so each
of our customers has a distinct endpoint?

**3.3** Do you **retry** failed deliveries — how many times, over what window,
and what response counts as success? Can the same event be delivered more than
once?

**3.4 What do `CheckingStatus`, `VerifyType` and `Event` mean?** The example
carries `"CheckingStatus": "0"`, `"VerifyType": "1"`, `"Event": "3"`. Could you
send the **full code tables** for all three? In particular, which values
indicate entry vs exit, and which indicate **access denied**?

**3.5** Does the webhook fire when a fingerprint is **rejected** — both for an
unrecognised finger and for a recognised member whose access has expired or
been blocked? Being able to tell a member "your membership expired on the 3rd"
instead of "the door didn't open" makes a real difference at the front desk.

---

## 4. Command delivery and reliability

**4.1 How do we know a command actually reached the device?** Our reading is
that `POST /api/devicecmd/*` enqueues a command the device later collects, so
HTTP 200 means *queued*, not *applied*. Is that right?

**4.2** Is a command disappearing from `GET /api/devicecmd/{DevSN}` the only
signal it was delivered, or is there a per-command **status or result** field
we can poll? Is there a callback when a command succeeds or fails on the device?

**4.3** If a device is **offline** when we send `validperiod` or `accessblock`,
does it receive the command once it reconnects, or is it lost? How long do
undelivered commands stay queued?

**4.4 What does an error response look like?** The documentation shows only
success payloads. Could you provide the HTTP status codes and error body format
for: bad credentials, expired token, unknown `DevSN`, unknown `EmpId`,
malformed body, and device unreachable? We need to retry some failures and
never retry others.

**4.5 Are there rate limits** (per second/minute/hour, per account or per
device)? And is there a **bulk** way to set valid periods for many employees at
once, or must we issue one `validperiod` call per member? A 500-member gym
re-asserting daily is a lot of individual calls.

**4.6 Token lifetime.** How long is the token from `POST /api/user/` valid?
Does signing in again invalidate the previous token, or can several be active
at once? Is there a refresh endpoint, and what does an expired token return?

*We run on serverless infrastructure with many concurrent instances, so if each
sign-in invalidates the last, we need to handle tokens centrally.*

---

## 5. Dates and time zones

**5.1** Is `validperiod`'s `EndDate` (`YYYYMMDD`) **inclusive**? That is, does a
member with `EndDate=20260107` still get in during the day on 7 January?

*This one matters a lot to us — it's the difference between members being
locked out on the day they've paid for and not.*

**5.2** What time zone is the webhook's `AttTime` in? The sample
(`"2024-01-15 08:30:15"`) has no offset. Is it device-local, account-local, or
UTC — and how does it relate to the device's `TimeZone` field (e.g. `"330"`)?

---

## 6. Documentation clarifications

The PDF and the Postman collection differ in a few places, so we're not sure
which is current.

**6.1 Header name** — the PDF uses lowercase `apitoken` for
`GET /api/user/auth` but `ApiToken` elsewhere. Is the header case-insensitive,
or must we match exactly per endpoint?

**6.2 Logout method** — PDF says `GET /api/user/logout`; the collection sends
`POST`. Which is correct?

**6.3 Device update path** — the PDF documents `PUT /api/device/{id}` with "id:
Device ID (integer)", but the collection calls `PUT /api/device/QEM1253800017`,
a serial number. Which is it? Same question for `PUT /api/area/{id}`.

**6.4 Employee create body** — the PDF's `POST /api/template/add` body is
`{EmpId, EmpName}`; the collection also sends `AreaID`. Is `AreaID` required,
and what happens if it's omitted — does the member reach no devices at all?

**6.5 Area creation** — the PDF's `POST /api/area` body includes
`"AreaID": "A01"`, but the collection omits it and `AreaID` appears to be a
server-assigned integer elsewhere. Is it client-supplied or server-generated?

**6.6** Is there a `DELETE` for areas and for devices? We couldn't find one in
either document.

---

That's everything. If it's easier to work through the fingerprint and template
questions (section 2) on a call, we're happy to set one up — and if you have a
test account and a spare device we could point a staging environment at, that
would answer several of these faster than email.

Thanks very much,

[Your name]
[Role] · [Company]
[Email] · [Phone]
