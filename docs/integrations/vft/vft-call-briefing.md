# VFT call — briefing sheet

> Keep this open during the call. Facts about our system are exact — they were
> read out of the codebase, not estimated.

---

## 1. Read this first: how to position yourself

**Don't pretend to be an engineer.** If they probe and it falls apart, you lose
credibility for the whole integration. You don't need to bluff — you have a
stronger, true position:

> "I'm the founder and product owner. The platform is built and running — I can
> answer anything about architecture and behaviour. For anything deep in their
> firmware I'll take it away and come back to you in writing."

That is completely normal on a vendor call. Founders run integration calls all
the time. What earns respect is **precise questions**, not jargon — and §3 gives
you seven precise ones.

Two rules for the hour:

- **Never guess at a number or a commitment.** "I'll confirm that in writing" is
  a professional answer. A wrong number that you later reverse is worse.
- **Write down anything you can't answer.** Say "let me note that" out loud. It
  reads as diligence, not ignorance.

---

## 2. Our stack — the answer to "what are you running?"

Say it in this order. It's about 20 seconds and covers 90% of what they'll ask.

> "It's a multi-tenant SaaS. **Next.js and TypeScript** on the front end,
> **PostgreSQL via Supabase** for the database and auth, hosted on **Vercel** as
> serverless functions. Each gym's data is isolated at the database level with
> row-level security. We already run scheduled jobs, SMS through **text.lk**, and
> card payments through **PayHere**."

Exact versions, if they push:

| Thing          | What we run                                        |
| -------------- | -------------------------------------------------- |
| Language       | TypeScript 5.7 (strict mode)                       |
| Framework      | Next.js 16, React 19                               |
| Runtime        | Node.js 18+                                        |
| Database       | PostgreSQL (Supabase), row-level security per gym  |
| Auth           | Supabase Auth (JWT)                                |
| Hosting        | Vercel — serverless functions, no always-on server |
| Scheduled jobs | Vercel Cron (daily + every-5-minutes)              |
| File storage   | Cloudflare R2                                      |
| Validation     | Zod on every API input                             |
| Tests          | Jest (unit/integration), Playwright (end-to-end)   |
| Timezone       | Asia/Colombo throughout                            |

**One thing to be careful about — outbound IP.** We're on serverless, so we do
**not** have a fixed outbound IP address. If they say "we'll allowlist your
server IP", that's a problem — tell them:

> "We're serverless, so we don't have a static outbound IP. We'd need token or
> key-based authentication rather than IP allowlisting."

(Their side allowlisting _their own_ outbound IPs for our webhook is fine — that
helps us. It's only _our_ IP that we can't pin down.)

---

## 3. The seven questions to ask

Each one below gives you: **what we need**, **where it is (or isn't) in their own
documents**, **the question to say out loud**, and **why we're asking** — so when
they say "why do you need that?", you have an answer ready.

Naming the page or endpoint is what makes these land. It shows you've read their
material properly, which is worth more than any technical vocabulary.

If the call runs short, **Q1–Q4** are the ones that matter.

---

### Q1 · How long can a member ID be?

**What we need:** every member gets a number that we generate and send to the
reader. We need to know the maximum length before we start handing them out.

**In their docs:** the PDF has a "Field Specifications" table for **devices**
(§3.2 — `DevSN`, `DevName`, `TimeZone`, `AreaID`, `IsReboot`, with types and
whether each is required). **Section 5, Employee Management, has no equivalent
table.** `EmpId` just appears as `"166"` in the example body. The Postman
collection's _AddEmployee_ sends `"EmpId": "168"`. In §4.2 the same field appears
as the raw ZKTeco `Pin=8` and `Pin=1001`.

> **Ask:** "Your section 3.2 gives field specifications for devices — types,
> required, examples. Section 5 doesn't have the same for employees. What are the
> constraints on `EmpId`? Maximum length, digits only or alphanumeric? And if we
> send one that's too long, does the API reject it, or does the reader truncate
> it silently?"
>
> **Follow-up:** "Which reader models are actually deployed with gyms here? I
> assume the limit is per model."

**Why we're asking:** our internal member IDs can't go on a device, so we
generate numeric ones. If a value gets silently shortened, two members could end
up with the same ID on the reader — and the wrong person walks through the door.
That's not something we'd notice until it happened.

**A good answer is a number.** "It's the ZKTeco Pin field" is not enough on its
own — ask what the limit is on _their_ readers.

---

### Q2 · One account for all gyms, or one per gym?

**What we need:** we run many gyms on one platform. We need to know whether their
API keeps those gyms apart, or whether that's entirely our job.

**In their docs:** PDF §1.1 shows sign-in as a single email and password
returning one token. There's nothing about which devices or members that token
can reach. §2 introduces **Areas** (`/api/area`), and the Postman _AddEmployee_
attaches an employee to `"AreaID": 1` — so areas look like the grouping
mechanism, but nothing says whether they're a security boundary.

> **Ask:** "Can you issue separate API credentials per gym, or is the expected
> setup one account with an area per gym? And if it's one shared account — can a
> token issued for one area read or modify employees in a different area, or is
> it scoped?"
>
> **Follow-up:** "Is `EmpId` unique across the whole account, or per area? If two
> areas both use employee ID 100, is that two separate people or does one
> overwrite the other?"

**Why we're asking:** if one token reaches every gym on the account, then our
code is the only thing keeping one gym's staff away from another gym's members
and doors. We'd want to know that going in, and we'd design for it.

---

### Q3 · How do we know a command actually worked?

**What we need:** when we tell a reader "this member's access ends on the 15th",
we need to know it took effect — not just that the request was accepted.

**In their docs:** PDF §4.1 documents `POST /api/devicecmd`. The Postman
collection then has a whole **DeviceCommand** folder for _managing_ commands:
`GET /api/devicecmd` (list all), `GET /api/devicecmd/{DevSN}` (list for one
device), `DELETE /api/devicecmd/{id}`, and `DELETE /api/devicecmd` (delete all).
Being able to list and delete commands strongly implies they sit in a **queue**
waiting for the reader to collect them. But nothing in either document describes
a status, a result, or an error code per command.

> **Ask:** "The collection has endpoints to list and delete commands, which
> suggests they queue up until the device collects them. So when I get a 200 back
> from `/api/devicecmd`, does that mean queued or executed? And how do I confirm
> it actually ran — is a command disappearing from `GET /api/devicecmd/{DevSN}`
> the only signal, or is there a status or return code I've missed?"
>
> **Follow-up:** "If the reader is offline when we send something, is it held and
> delivered when it reconnects? And how long before you discard it?"

**Why we're asking:** if we suspend a member, we need to know the door really
stopped letting them in. "We asked" isn't the same as "it happened", and if
there's no confirmation available we'll design around that — but we need to know.

---

### Q4 · Does the end date include the last day?

**What we need:** a one-word answer, and it's the single most likely thing to go
wrong in front of real members.

**In their docs:** the Postman _SetValidTimePeriod_ request is
`POST /api/devicecmd/validperiod?DevSN=…&EmployeeId=168&StartDate=20251214&EndDate=20260107`.
PDF §4.2 shows the same thing as a raw command:
`DATA UPDATE user Pin=8 StartTime=20241010 EndTime=20251020`. **Neither says
whether the end date is inclusive.**

> **Ask:** "For `validperiod` — if I set a member's `EndDate` to the 15th, do they
> still get in during the day on the 15th, or are they blocked from the start of
> the 15th?"

**Why we're asking:** our members pay through a due date. If we set the 15th and
the reader blocks them on the 15th, every member gets locked out a day early —
and we'd hear about it from every gym at once.

**Push for a clear yes or no.** If they're unsure, that's the first thing we test
on a real terminal.

---

### Q5 · How is the attendance webhook secured?

**What we need:** their system will POST attendance data to a URL of ours. We
need to know how we can tell it's really them.

**In their docs:** the Postman collection's **WebhookCheck** folder posts an
array of scan records to `{your_webhook_url}` — and the request's header list is
**empty**. No signature, no API key, nothing. Compare that with every other
request in the collection, which carries `ApiToken`.

> **Ask:** "The webhook example in your collection posts to our URL with no
> headers at all — no signature or key. How is it authenticated? Can you send a
> custom header, or sign the payload? Our plan is to put a long secret token in
> the URL path, but I'd rather match whatever you already support."
>
> **Follow-up 1:** "Can the callback URL be set per gym, or is it one per
> account?"
> **Follow-up 2:** "Do you retry if our endpoint is down? And can the same scan
> arrive twice?"

**Why we're asking:** if anyone who learns the URL can post to it, they could
fake attendance records into a customer's account. And if you retry, we need to
handle the same scan arriving more than once without double-counting it.

---

### Q6 · What do the attendance codes mean?

**What we need:** a legend. This is a documentation request, so it's an easy yes.

**In their docs:** the WebhookCheck sample payload is
`{"EmpId":"168","AttTime":"2024-01-15 08:30:15","CheckingStatus":"0","VerifyType":"1","Event":"3","DeviceID":"QEM1253800017"}`.
We get the values `0`, `1` and `3` — but there's **no table anywhere in the PDF**
saying what they mean.

> **Ask:** "Could you send us the code tables for `CheckingStatus`, `VerifyType`
> and `Event`? The sample payload has values but no legend."
>
> **Follow-up:** "Does a **refused** scan produce an event — an expired member, or
> a finger the reader doesn't recognise — or do we only receive successful
> entries?"

**Why we're asking:** without the legend we can log that someone scanned, but not
whether they got in. And knowing whether refusals come through decides whether we
can show a gym "three people were turned away yesterday."

---

### Q7 · Who types in the member ID at enrolment?

**What we need:** to know whether the IDs we generate actually reach the reader,
or whether staff invent their own at the device.

**In their docs:** the collection has
`POST /api/devicecmd/enrollfinger?DevSN=…&employeeId=168&fingerId=1`, which
suggests we can start enrolment from software. But when we went through enrolment
at a gym using your hardware, a staff member did the whole thing at the
wall-mounted reader — pressed buttons on the device, finger three times, OK. No
software involved.

> **Ask:** "We've seen enrolment done entirely at the reader by staff, but your
> API also has `enrollfinger`. Which is the intended flow? And when staff enrol at
> the device, do they pick a member record we've already sent down, or do they
> create one there and key in the ID themselves?"
>
> **Follow-up:** "Once a fingerprint is enrolled at the reader, does it come back
> up to your platform — so we'd see it via `GET /api/template`?"

**Why we're asking:** we assign member IDs on our side and push them down. If
staff type their own numbers at the terminal, the two never line up — and we'd be
tracking a member the reader has never heard of.

---

### The ask that saves the most time

> "Could we get a test account and one spare terminal for a staging environment?
> Several of these would be faster for us to verify ourselves in an afternoon than
> for you to write up — and it means we come to you with specifics rather than
> questions."

---

### If they ask "why so detailed?"

> "We've built the integration already, against your documentation and the ZKTeco
> PUSH protocol. These are the handful of places where the docs don't settle it
> and guessing wrong would mean rebuilding rather than adjusting."

That's true, and it explains the specificity without overclaiming.

---

### Bonus: two inconsistencies worth mentioning

Dropping one of these in shows you've read closely. Use them lightly — the point
is credibility, not correcting them.

1. **Parameter casing.** In the collection, `validperiod`, `accessgrant` and
   `accessblock` all take **`EmployeeId`** with a capital E — but `enrollfinger`
   and `enrollface` take **`employeeId`** with a lowercase e. Worth asking which
   is correct, since one of them may just be tolerated.
2. **Your own PDF flags one.** §1.3 notes "Header naming inconsistency — uses
   `ApiToken` instead of `apitoken`". Also, §1.3 documents logout as **GET** while
   the collection sends **POST**, and §3.3 documents device update as
   `PUT /api/device/{id}` with an integer id while the collection calls
   `PUT /api/device/QEM1253800017` with a serial.

> "We're following the Postman collection wherever it differs from the PDF, on the
> assumption it's more current — tell me if that's wrong."

---

## 4. What they'll ask you — and your answers

**"Can you receive webhooks / do you have a public endpoint?"**

> "Yes. HTTPS endpoint, we'll give you the URL. We'll respond 200 immediately and
> process asynchronously."

**"How do you want to authenticate?"**

> "Email and password to get a token, then the token on each request — as in your
> documentation. We store credentials encrypted."

**"How many gyms / devices / members?"**
→ _You know this, I don't. Have the real numbers ready._ If unsure, give a range
and say you'll confirm.

**"How often will you call our API?"**

> "Low volume. A handful of calls when a member joins or pays, and a nightly
> reconciliation. We pace ourselves under 5 requests a second."

**"Do you need real-time access decisions?"**

> "No — and deliberately. We push each member's valid-until date to the reader and
> let the reader enforce it. So the door keeps working correctly even if our
> servers or the gym's internet are down."
> _(This is the strongest thing you can say on the call. It's good engineering and
> it tells them you're not going to blame them for outages.)_

**"What ID format will you use for members?"**

> "Numeric, allocated from our side, currently capped at 8 digits — which is why
> Q1 matters."

**"What's your timeline / when do you go live?"**
→ _Your call._ Safe answer: "The integration is built and tested against a mock.
We need a terminal to verify against before we enable it for a customer."

**"Who's doing the development?"**

> "I own the product and the architecture; the implementation is AI-assisted, and
> everything is code-reviewed and covered by an automated test suite."
> Honest, and increasingly ordinary. Don't be defensive about it.

**"Have you worked with ZKTeco before?"**

> "Not directly, but we've built the integration against the PUSH protocol
> documentation and our own reading of your API collection."

---

## 5. When you're stuck — exact phrases

Use these instead of guessing. All of them are normal, professional things to say:

- "Let me note that and come back to you in writing."
- "I'd want to check that against the code before I answer."
- "Can you walk me through how that works on your side?" _(turns it around, and
  you learn something)_
- "What would you recommend, given how other integrators have done it?"
- "Can you send that in writing after the call? I want to make sure we implement
  it exactly."
- "That's a good question — I don't want to give you a wrong number."

**If they go deep on firmware internals:** "That's below the level I work at —
who on your side owns the firmware, and can we get them on a follow-up?"

---

## 6. Don't agree to these on the call

- **A go-live date.** Not before you have a terminal to test against.
- **IP allowlisting for our outbound calls.** We can't provide a static IP.
- **Anything that requires storing member fingerprints ourselves.** Templates stay
  on their hardware — that keeps the legal exposure on their side of the line.
- **A single shared admin credential handed to gym staff.** If it reaches every
  gym on the account, only our servers should ever hold it.
- **Pricing or volume commitments** you haven't worked out.

---

## 7. After the call

Send a short email the same evening:

> "Thanks for your time. To confirm what we agreed: [1-line list]. Outstanding
> items you're coming back to me on: [list]. Please correct anything I've
> misremembered."

This is the single highest-value thing you can do. It creates a written record,
it's what a competent counterpart does, and it gets you the answers in writing
that a call doesn't.

---

## Cheat sheet — one line each

| If they ask             | Say                                                           |
| ----------------------- | ------------------------------------------------------------- |
| Backend?                | TypeScript, Next.js, PostgreSQL on Supabase, hosted on Vercel |
| Database?               | PostgreSQL, row-level security isolating each gym             |
| Static IP?              | No — serverless. We need token auth, not IP allowlisting      |
| Real-time entry checks? | No. We push valid-until dates; the reader enforces them       |
| Webhook ready?          | Yes, HTTPS, we respond 200 immediately                        |
| Member ID format?       | Numeric, ours, currently 8 digits max                         |
| Timezone?               | Asia/Colombo                                                  |
| Don't know?             | "Let me note that and come back to you in writing"            |
