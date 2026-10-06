# Automated Cron Jobs

This document describes the automated cron jobs for the Gym Management SaaS platform.

## Overview

Cron jobs run automatically to handle:

1. **Daily SMS Reminders** - Send payment reminders to members
2. **Status Updates** - Expire members the day after their due date
3. **Cancellation** - Cancel members 14+ days past due

There is no member-archival job. `archive-old-members` was scheduled monthly
but was only ever a stub answering 501; it was removed on 2026-10-06.

SaaS billing jobs (`charge-renewals`, `process-dunning`, `process-trial-expiry`)
are documented in `docs/reference/SAAS_SUBSCRIPTION_IMPLEMENTATION.md`.

## Cron Schedule

**Vercel evaluates cron expressions in UTC.** The schedule column is the source
of truth; Sri Lanka local time (UTC+5:30) is shown for convenience only.

| Job                      | Schedule      | Time (UTC)  | Time (Sri Lanka) | Frequency  |
| ------------------------ | ------------- | ----------- | ---------------- | ---------- |
| Update Expired Status    | `0 0 * * *`   | 00:00       | 5:30 AM          | Daily      |
| Expire Suspended Members | `15 0 * * *`  | 00:15       | 5:45 AM          | Daily      |
| Cancel Overdue Members   | `30 0 * * *`  | 00:30       | 6:00 AM          | Daily      |
| Charge Renewals          | `30 0 * * *`  | 00:30       | 6:00 AM          | Daily      |
| Process Dunning          | `45 0 * * *`  | 00:45       | 6:15 AM          | Daily      |
| Process Trial Expiry     | `50 0 * * *`  | 00:50       | 6:20 AM          | Daily      |
| Send Reminders           | `30 3 * * *`  | 03:30       | 9:00 AM          | Daily      |
| Reconcile Access         | `30 18 * * *` | 18:30       | 12:00 AM (next)  | Daily      |
| Drain Access Sync        | `*/5 * * * *` | every 5 min | every 5 min      | 5-minutely |
| Sync Marketing Contacts  | `0 1 * * *`   | 01:00       | 6:30 AM          | Daily      |
| Purge Access Events      | `0 2 * * *`   | 02:00       | 7:30 AM          | Daily      |
| Send Announcements       | `0 4 * * *`   | 04:00       | 9:30 AM          | Daily      |
| Send Outreach            | `30 4 * * *`  | 04:30       | 10:00 AM         | Daily      |

### Member-status chain — ORDER MATTERS

The first three jobs form a dependency chain and must run in this order:

```
00:00  update-expired-status      Active    -> Expired    (feeder)
00:15  expire-suspended-members   Suspended -> Expired    (feeder)
00:30  cancel-overdue-members     Expired   -> Cancelled  (consumer)
```

`cancel-overdue-members` only ever reads members that are **already** Expired,
so both feeders must complete before it. Scheduling a feeder after the sweep
does not lose anyone — the sweep is date-based, not incremental — but every
member that feeder produces waits an extra full day to be cancelled. This
ordering is pinned by `src/app/api/cron/__tests__/cron-schedule-order.test.ts`.

`cancel-overdue-members` and `charge-renewals` share the 00:30 slot; they touch
disjoint tables (members vs. SaaS billing) and are safe to run concurrently.

### `reconcile-access` sits OUTSIDE that chain — deliberately

It runs at 18:30 UTC, six hours _before_ `update-expired-status`, and that is
correct rather than an oversight.

The access decision (`resolveAccessDecision`) derives expiry from
**`next_due_date`**, not from `members.status`. So it reaches the right verdict
whether or not the status chain has run yet — there is no ordering dependency
to preserve.

That independence is what frees the job to sit where it actually needs to be:
18:30 UTC is **00:00 Sri Lanka time**, and the whole point of the job is to
assert the lockout boundary at local midnight. A membership paid through the
15th admits the member for all of the 15th and refuses them from the 16th at
midnight _local_. Moving it into the 00:00 UTC block would apply that boundary
5½ hours late, every day, for every member.

**Do not add it to `cron-schedule-order.test.ts`.** That test pins the
Active→Expired→Cancelled chain; adding this job would assert a dependency that
does not exist and would block the 18:30 slot. Its own schedule is pinned in
`src/app/api/cron/__tests__/access-control-crons.test.ts` instead.

> **IMPORTANT:** Vercel Cron invokes cron paths with an **HTTP GET** request
> (with `Authorization: Bearer <CRON_SECRET>` attached automatically when the
> `CRON_SECRET` environment variable is set on the project). All cron routes
> therefore run their job on GET as well as POST. POST remains available for
> manual/external triggering with the same bearer token.

## 1. Daily SMS Reminders

**Endpoint:** `GET|POST /api/cron/send-reminders`

### What It Does

Automatically sends payment reminders to all active members based on their due dates:

- **7-Day Notice**: Sent 7 days before due date
- **3-Day Notice**: Sent 3 days before due date
- **Due Today**: Sent on the due date
- **Overdue**: Sent for members past their due date

### Process Flow

1. Fetch all gyms from database
2. For each gym, fetch all active members
3. Calculate days until due for each member
4. Send appropriate SMS based on days until due
5. Log SMS to `sms_logs` table
6. Return summary of messages sent

### Response Example

```json
{
  "success": true,
  "data": {
    "totalSent": 42,
    "byType": {
      "reminder_7day": 15,
      "reminder_3day": 10,
      "due_today": 8,
      "overdue": 9,
      "receipt": 0
    },
    "errors": [],
    "duration": "1245ms"
  }
}
```

### SMS Message Formats

Built by `src/features/sms/config/SmsTemplates.ts`, the single source of the
wording (updated 2026-10-04). Every text names the gym, and the amount is what
the desk will charge: the plan amount less a recurring discount
(`effectivePlanAmount`). Gym names and discount percentages are each read once
per run, in batches of 100. Suspended gyms get no reminders, and neither do gyms
on `SMS_DISABLED_GYM_IDS` (the E2E test gyms): they are skipped up front and
counted in `membersSkippedSmsDisabled`.

**7-Day/3-Day:**

```
Hi John Doe, your monthly membership at PowerFit Gym is due on 20/02/2026 (Rs.5,000). Do not forget to renew and stay consistent!
```

**Due Today** — the due date is the member's last active day (expiry is
immediate the following day), so this is the final automated message they
receive while still a member:

```
Hi John Doe, your monthly membership at PowerFit Gym expires today (Rs.5,000). Renew today and stay consistent!
```

**Overdue:**

```
Hi John Doe, your monthly membership at PowerFit Gym has expired (due 13/02/2026, Rs.5,000). Renew soon and get back to training!
```

A failed send is logged to `sms_logs` as `failed` with its reason, and a
same-day re-run retries it: the duplicate check counts only rows that did not
fail.

> **Note:** with no grace period, an overdue member is flipped to "Expired" at
> 00:00 before the 03:30 reminder run, and reminders only go to Active members.
> The automated `overdue` reminder therefore no longer fires in practice; the
> type remains for manual sends from payment collection.

## 2. Update Expired Status

**Endpoint:** `GET|POST /api/cron/update-expired-status`

### What It Does

Updates member status from "Active" to "Expired" as soon as a member's due date
has passed. **There is no grace period.**

### Process Flow

1. Find all active members with `next_due_date < today`
2. Update their status to "expired" (via the `Member` state machine)
3. Update `updated_at` timestamp
4. Return count of updated members

### Response Example

```json
{
  "success": true,
  "data": {
    "totalUpdated": 5,
    "errors": [],
    "duration": "234ms"
  }
}
```

### Business Logic

- A member due **today** is still paid through today and stays "Active"
- From the day after `next_due_date`, status changes to "Expired" — no grace period
- Expiring frees the member's slot in the gym's active-member quota
- Expired members can still be reactivated by collecting payment

## 3. Cancel Overdue Members

**Endpoint:** `GET|POST /api/cron/cancel-overdue-members`

### What It Does

Cancels expired members who are 14 or more days past their due date.

### Process Flow

1. Calculate cutoff date (`MEMBER_CANCELLATION_OVERDUE_DAYS` = 14 days ago)
2. Find all expired members with `next_due_date <= cutoff_date`
3. Transition them to "cancelled" (via the `Member` state machine)
4. Return count and details of cancelled members

### Business Logic

- Threshold is **inclusive**: exactly 14 days overdue IS cancelled on that run
- Only "Expired" members are eligible — Active -> Cancelled is not a valid
  transition, which is why both feeders must run first (see the chain above)
- "Cancelled" is a terminal state and cannot be undone
- The sweep is date-based, not incremental: it re-evaluates every expired
  member on every run, so a missed night self-heals on the next one

## 4. Reconcile Access

**Endpoint:** `GET|POST /api/cron/reconcile-access`
**Schedule:** `30 18 * * *` — 18:30 UTC = **00:00 Sri Lanka time**

### What It Does

Enqueues sync work for members whose door access has changed — chiefly the ones
expiring at that exact moment.

### Why it diffs instead of re-asserting

The vendor exposes no bulk validity endpoint: re-pushing a window is one HTTP
call per member per device. Blindly refreshing a 500-member gym nightly would
be 500 calls to change nothing.

It is also not merely wasteful. Every validity write is another chance for
firmware to disturb an existing block, so writing only where something changed
shrinks that hazard as well.

### Process Flow

1. List gyms with access control configured
2. Skip any gym whose own SaaS subscription is not in good standing
3. Per gym, resolve each provisioned member's access decision
4. Compare against `last_synced_valid_from/to/blocked`
5. Enqueue only the members whose desired state differs

### Skipping a gym leaves its members' access intact

Note the effect is the _opposite_ of the SMS equivalent. Not sending an SMS
means the member hears nothing; not syncing means every member **keeps** the
access they already have, because the reader enforces the window from its own
clock. A gym's billing dispute must not lock out members who paid.

### Response Example

```json
{
  "success": true,
  "data": {
    "gymsConsidered": 4,
    "gymsSkippedBilling": 1,
    "membersChecked": 512,
    "membersEnqueued": 7,
    "errors": [],
    "duration": "1840ms"
  }
}
```

## 5. Drain Access Sync

**Endpoint:** `GET|POST /api/cron/drain-access-sync`
**Schedule:** `*/5 * * * *`

### What It Does

Drains the `access_sync_jobs` outbox onto the hardware. **This is the only
thing that moves queued changes to the readers** — without it the rows the
members trigger writes simply accumulate.

### Why every five minutes

Registrations and payments dispatch inline, so this is the retry and catch-up
path rather than the happy path. Five minutes means a member whose change
missed the inline attempt waits minutes rather than hours, without hammering
the vendor on a tighter loop for a case that mostly does not arise.

### Process Flow

1. **Reclaim** `in_flight` jobs abandoned by a killed run (older than 10 min)
2. **Claim** a batch, at most one job per member, oldest first
3. Route each job: member intents to `SyncMemberAccess`, device intents to
   `OperateDevice`
4. Settle: success, retry with backoff, or dead-letter
5. **Refresh device presence** from the vendor's own device list

### Why presence rides along here

Step 5 is not really a drain concern, but it belongs on this schedule. We stamp
`last_seen_at` whenever a scan arrives on the webhook — but scans only happen
when _members_ do, so a gym that closes at 10pm produces no contact overnight
and every reader would read "offline since 22:14" by morning.

That matters because the device card's whole job is to stop staff panicking
about an offline reader (the door keeps working from the terminal's own
records). A dashboard that cries wolf nightly teaches people to ignore it, and
then the one real outage is ignored too.

No vendor presence field is documented, so this takes an explicit online flag
if one is offered, a last-activity timestamp if not, and reports **unknown**
rather than inventing a verdict when neither arrives. A reader we have
registered that the vendor does not list at all is reported separately as
`devicesUnknownToVendor` — that is a configuration problem (wrong account,
mistyped serial), not an outage.

### Capacity reclamation on `-18`

When a reader answers "device storage is full", the drain does not simply
dead-letter the job. It:

1. Records `template_capacity = template_count` — "full" means the current
   count _is_ the limit, and this is the only way the system ever learns it
2. Evicts inactive members (cancelled first, then longest-expired)
3. **Reschedules** the job, so the member who triggered it gets on at the next
   pass rather than waiting for someone to notice a dead job

If nothing can be freed — every remaining member on the reader can currently
enter — it dead-letters and a person is told. That is a second-reader
conversation, not something to solve by locking out someone who paid.

Note the ordering dependency: the proactive nightly capacity check in
`reconcile-access` **cannot fire until this has happened at least once**,
because `slotsToReclaim` refuses to guess at an unknown capacity. That is
deliberate — guessing a limit could evict members from a reader with plenty of
room.

Step 1 comes first on purpose. A serverless invocation killed mid-drain
(timeout, deploy, OOM) leaves its claimed jobs `in_flight`, and the claim
function only picks up `pending` and `failed` — so without the reclaim those
members would never sync again and nothing would say so. Every run heals the
previous run's casualties.

### Retry vs. dead-letter

Vendor return codes are classified, not treated alike. A transient fault
("no response from device") is rescheduled with backoff; a permanent one
("command not supported") or one needing a person ("device storage full") is
dead-lettered immediately, because retrying buries the real problem behind
noise.

A run that dead-letters work needing a person is logged as a **failure** even
though the run itself succeeded, so it surfaces on `/system-health` rather than
sitting quietly inside a green result.

### Response Example

```json
{
  "success": true,
  "data": {
    "reclaimed": 0,
    "claimed": 12,
    "succeeded": 11,
    "retrying": 1,
    "deadLettered": 0,
    "needingAttention": 0,
    "errors": [],
    "duration": "3120ms"
  }
}
```

## 6. Send Announcements

**Endpoint**: `/api/cron/send-announcements`
**Schedule**: daily at 04:00 UTC (9:30 AM Sri Lanka), after `sync-marketing-contacts` (01:00) so the "Product updates" segment is current.

### What It Does

- Compiles a **release email** from the deployed version's `CHANGELOG.md` section. If several versions were deployed since the last announcement, they go out as one email.
- Compiles a **policy notice** from the newest `notify: true` entry in `features/marketing/config/legalChanges.ts`.
- Fills each into its Resend template, sends a preview to the Test segment at once, and schedules the real broadcast to the gyms **24 hours later**. Cancel it in Resend to stop it.
- Never announces anything twice: `mailing_announcements` is unique on `(kind, ref)`.

Logged to `cron_logs` as a **failure** when an email could not be rendered, previewed or scheduled. A missing template is not a failure, only a summary entry ("template not ready"), because nothing is sent until the owner publishes it. The full design is in `docs/architecture/marketing-email.md`, "Announcements".

## 7. Send Outreach

**Endpoint**: `/api/cron/send-outreach`
**Schedule**: daily at 04:30 UTC (10:00 AM Sri Lanka), from 13 Oct 2026 (`OUTREACH_STARTS_AT`).

Sends each address in `outreach_recipients` its next email of the four-email introduction series, at least 6 days after the last: one a week per address, never more than four. It runs daily, because individual emails count against Resend's 100-a-day limit; each run sends at most 80. Anyone who unsubscribed, by the footer link or a mail app's one-click button, or whose contact was deleted, is dropped for good, and anyone who became a gym or a demo request ends the series. Every email is tagged in Resend (`kind=outreach`, `campaign`, `email`). The run is logged to `cron_logs`, as a failure when any email failed. Design: `docs/architecture/marketing-email.md`, "Outreach".

## Security

All cron endpoints are protected with Bearer token authentication:

```bash
Authorization: Bearer <CRON_SECRET>
```

### Setup

1. Generate a secure secret:

   ```bash
   openssl rand -base64 32
   ```

2. Add to environment variables:

   ```env
   CRON_SECRET=your-generated-secret-here
   ```

3. Configure in Vercel:
   - Go to Project Settings → Environment Variables
   - Add `CRON_SECRET` with your generated value

## Testing Cron Jobs

### Local Development (GET Method)

In development mode, you can manually trigger cron jobs via GET requests:

```bash
# Send reminders
curl http://localhost:3000/api/cron/send-reminders

# Update expired status
curl http://localhost:3000/api/cron/update-expired-status
```

**Note:** In production, GET requires the same `Authorization: Bearer <CRON_SECRET>`
header as POST (this is how Vercel Cron invokes the routes).

### Production Testing (POST Method)

Test with proper authorization:

```bash
# Send reminders
curl -X POST https://your-app.vercel.app/api/cron/send-reminders \
  -H "Authorization: Bearer your-cron-secret"

# Update expired status
curl -X POST https://your-app.vercel.app/api/cron/update-expired-status \
  -H "Authorization: Bearer your-cron-secret"
```

## Vercel Configuration

The cron jobs are configured in `vercel.json`, which is the source of truth for
paths and schedules; the table under "Cron Schedule" mirrors it.

### Vercel Cron Requirements

- Available on **Hobby plan and above**
- Maximum **20 cron jobs** per project
- Cron jobs run in **UTC timezone** (hence the time conversions)
- Each job has a **10-second timeout** on Hobby plan

### Monitoring

- View cron job logs in Vercel Dashboard → Deployments → Functions
- Check execution history and errors
- Set up alerts for failed executions

## SMS Mock Mode

Currently, SMS sending is in **mock mode**:

- Messages are logged to console
- Messages are saved to `sms_logs` table
- No actual SMS is sent via text.lk

### Console Output Example

```
📱 [MOCK SMS] Sending SMS:
   To: +94771234567
   Type: reminder_7day
   Message: Hi John Doe, your monthly membership at PowerFit Gym is due on...
   ✓ SMS logged to database (ID: abc-123)
```

### Enabling Real SMS

To switch to real SMS via text.lk:

1. Add text.lk credentials to environment:

   ```env
   TEXT_LK_API_KEY=your-api-key
   TEXT_LK_SENDER_ID=your-sender-id
   ENABLE_REAL_SMS=true
   ```

2. Update `sms.service.ts` to use text.lk API instead of mock logging

## Database Schema

### sms_logs Table

```sql
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY,
  member_id UUID REFERENCES members(id),
  gym_id UUID REFERENCES gyms(id),
  sms_type TEXT CHECK (sms_type IN ('reminder_7day', 'reminder_3day', 'due_today', 'overdue', 'receipt')),
  phone_number TEXT,
  message_body TEXT,
  sent_at TIMESTAMP,
  delivery_status TEXT CHECK (delivery_status IN ('sent', 'delivered', 'failed')),
  text_lk_message_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Troubleshooting

### Cron Job Not Running

1. Check Vercel deployment logs
2. Verify `CRON_SECRET` is set in environment variables
3. Ensure you're on a Vercel plan that supports cron jobs
4. Check cron schedule syntax in `vercel.json`

### SMS Not Sending

1. Check console logs for mock SMS output
2. Verify members have valid phone numbers (+94 format)
3. Check `sms_logs` table for entries
4. Review error messages in cron job response

### Wrong Timezone

- All schedules are in UTC
- Verify UTC conversion is correct for Sri Lanka (UTC+5:30)
- Adjust `vercel.json` schedules if needed

## Future Enhancements

- [ ] text.lk API integration (real SMS)
- [ ] Retry logic for failed SMS
- [ ] Rate limiting for SMS sending
- [ ] Email notifications for cron job failures
- [ ] Dashboard for cron job monitoring
- [ ] Configurable reminder schedules per gym
- [ ] A/B testing for SMS message formats

## Related Files

- `src/features/sms/services/reminder.service.ts` - Core reminder logic
- `src/features/sms/services/sms.service.ts` - SMS sending (mock)
- `src/app/api/cron/send-reminders/route.ts` - Reminder endpoint
- `src/app/api/cron/update-expired-status/route.ts` - Status update endpoint
- `vercel.json` - Cron configuration
- `.env.example` - Environment variable template
