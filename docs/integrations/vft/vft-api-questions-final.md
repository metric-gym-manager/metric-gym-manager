# VFT — final questions

> Everything else across two rounds is answered and built. These seven cannot be
> assumed: each one changes code or product behaviour if guessed wrong.
> Q1–Q4 block Phase 2.

---

**To:** [VFT technical contact]
**Subject:** VFT GYM API — seven final points before we build

Hi [Name],

Your last set closed almost everything. Seven items left that we can't safely
assume our way past — each one would send us down the wrong path if we guessed.
The first four block us.

---

**1. Exact `Pin` / `EmpId` maximum digits on MB20, K40, F18 and SpeedFace.**
Not the API limit — the firmware limit per model.
*Why:* we allocate member IDs from one sequence. If the real cap is 5 digits
that's 99,999 IDs total across every gym, and we need a different allocation
scheme before writing any of it. Also: does an over-length `Pin` error, or
truncate silently?

**2. Can you issue separate API credentials per gym — yes or no?**
*Why:* you confirmed `AreaID` is a filter rather than an authorization barrier,
and that a duplicate `EmpId` overwrites an existing user record. On a shared
account, one bug on our side silently modifies another gym's members. We need to
know which model we're building for.

**3. When does a command leave `GET /api/devicecmd/{DevSN}` — when the device
collects it, or when it has executed successfully?**
And where do we see the execution error codes you mentioned (e.g. template
writes to a full device)? Are they exposed via the API, or only on the terminal?
*Why:* queue drainage is our only completion signal. If entries clear on pickup
rather than on execution, we have no way to know a command actually applied —
and we'd need a different verification strategy entirely.

**4. How long do undelivered commands stay queued for an offline device?**
*Why:* a device off over a long weekend must still receive the blocks issued
while it was down. If the queue expires after N hours, we need to re-issue on
reconnect rather than rely on the buffer.

---

**5. On MB20 / K40 / F18 specifically: does a `validperiod` command clear an
active `accessblock`?**
*Why:* you flagged this as firmware-dependent. If it clears on these models,
suspension must go through template revocation — which means the member re-enrols
their finger when the suspension is lifted. That's a real difference in what we
tell gym staff, so we'd rather know than design around both.

**6. What does `GET /api/template` return per employee?**
Specifically: is there a per-finger record, an enrolment timestamp, or a
template count?
*Why:* it's our only way to confirm an enrolment succeeded. Without a timestamp
or count we can't distinguish "just enrolled" from "was already enrolled", and
front-desk staff get no confirmation while the member is still standing there.

**7. How long is the `ApiToken` valid?**
*Why:* you confirmed a new sign-in doesn't invalidate previous tokens, so we
cache per gym. Knowing the lifetime lets us refresh before expiry instead of
after a failure.

---

**One request:** you mentioned sandbox access and test hardware need manual
provisioning by your administrators. Could we start that now? A single test
terminal would let us verify Q1, Q3, Q5 and Q6 ourselves in an afternoon rather
than trading emails.

Thanks,

[Your name]
[Role] · [Company]

---

## Internal note

If answers don't come, these are the assumptions we'd proceed on — and the cost
of each being wrong:

| Q | Assumption | Cost if wrong |
| --- | --- | --- |
| 1 | 9 digits, no silent truncation | **Severe.** Truncation collides IDs → wrong member admitted. Or namespace exhausts at 99,999 and needs re-architecting mid-flight |
| 2 | Shared account | Isolation rests entirely on our repository scoping; one bug is cross-tenant |
| 3 | Clears on execution | We'd report "applied" when it only means "collected" — silent drift with no detection |
| 4 | Buffer held indefinitely | Blocks issued during an outage never land; expired members keep entering |
| 5 | It does clear the block | We use template revocation for all suspensions — safe, but costs a re-enrolment the member may not have needed |
| 6 | Template count is exposed | Enrolment confirmation degrades to "wait 60s and hope" |
| 7 | Refresh on 401 | Extra failed request per token cycle. Minor |

Q1 and Q3 are the two where proceeding on assumption is genuinely unwise: both
fail silently, and both fail at the door.
