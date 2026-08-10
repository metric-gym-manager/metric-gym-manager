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

Priority order. If the call runs short, 1–4 are the ones that matter.

**Q1. What's the maximum length of the user ID (`EmpId` / `Pin`) on the readers
you deploy — and what happens if we send one that's too long?**
_Why it matters, if they ask:_ "We assign every member a numeric ID from our
side. If it silently truncates, two members could collide and the wrong person
gets in."
_What good looks like:_ a specific number. Also ask **which reader models** they
deploy.

**Q2. Do we get separate API credentials per gym, or one account for all of
them?**
_Why:_ "We're multi-tenant. If it's one shared account, we need to know whether
one gym's operator can see or change another gym's members."
_Follow-up:_ "Is `EmpId` unique across the whole account, or per area?"

**Q3. When we send a command, how do we know the reader actually applied it — as
opposed to it just being queued?**
_Why:_ "We need to know a member's access really changed, not just that we asked
for it."
_Follow-up:_ "If the reader is offline, is the command held and delivered when it
reconnects? For how long?"

**Q4. Is the validity end date inclusive?**
Say it concretely — this one is easy to get a clear answer on:

> "If we set a member's end date to the 15th, do they still get in during the day
> on the 15th, or are they blocked from the start of the 15th?"
> _Why:_ "Our members are paid through their due date. If it's exclusive we'd lock
> everyone out a day early."

**Q5. How is the attendance webhook secured, and can we get a separate callback
URL per gym?**
_Why:_ "We couldn't find a signature or auth header in the documentation. We plan
to use a secret token in the URL — we want to confirm that's the right approach."
_Follow-up:_ "Do you retry failed deliveries? Can the same scan arrive twice?"

**Q6. Can you send us the code tables for `CheckingStatus`, `VerifyType` and
`Event`?**
This is a documentation request, not a question — easy for them to say yes to.
_Follow-up:_ "Does a **refused** scan generate an event, or only successful
entries?"

**Q7. When staff enrol a fingerprint at the reader, do they pick a member record
we've already sent, or do they create one and type in an ID at the device?**
_Why:_ "We assign the IDs from our side. If staff key in their own at the
terminal, the two won't match."

**And the ask that saves the most time:**

> "Can we get a test account and one spare terminal for our staging environment?
> Most of these would be faster for us to verify ourselves than for you to write
> up."

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
