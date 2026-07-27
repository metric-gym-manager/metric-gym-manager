# Automated Cron Jobs

This document describes the automated cron jobs for the Gym Management SaaS platform.

## Overview

Cron jobs run automatically to handle:

1. **Daily SMS Reminders** - Send payment reminders to members
2. **Status Updates** - Expire members the day after their due date
3. **Cancellation** - Cancel members 14+ days past due
4. **Member Archival** - Archive inactive members after 2 years

SaaS billing jobs (`charge-renewals`, `process-dunning`, `process-trial-expiry`)
are documented in `docs/reference/SAAS_SUBSCRIPTION_IMPLEMENTATION.md`.

## Cron Schedule

**Vercel evaluates cron expressions in UTC.** The schedule column is the source
of truth; Sri Lanka local time (UTC+5:30) is shown for convenience only.

| Job                      | Schedule     | Time (UTC)   | Time (Sri Lanka) | Frequency |
| ------------------------ | ------------ | ------------ | ---------------- | --------- |
| Update Expired Status    | `0 0 * * *`  | 00:00        | 5:30 AM          | Daily     |
| Expire Suspended Members | `15 0 * * *` | 00:15        | 5:45 AM          | Daily     |
| Cancel Overdue Members   | `30 0 * * *` | 00:30        | 6:00 AM          | Daily     |
| Charge Renewals          | `30 0 * * *` | 00:30        | 6:00 AM          | Daily     |
| Process Dunning          | `45 0 * * *` | 00:45        | 6:15 AM          | Daily     |
| Process Trial Expiry     | `50 0 * * *` | 00:50        | 6:20 AM          | Daily     |
| Send Reminders           | `30 3 * * *` | 03:30        | 9:00 AM          | Daily     |
| Archive Members          | `0 1 1 * *`  | 01:00 on 1st | 6:30 AM on 1st   | Monthly   |

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

**7-Day/3-Day:**

```
Dear John Doe, your Monthly membership at PowerFit Gym is due on 20/02/2026. Amount: Rs.5000.00. Thank you.
```

**Due Today** — the due date is the member's last active day (expiry is
immediate the following day), so this is the final automated message they
receive while still a member:

```
Dear John Doe, your Monthly membership expires today. Amount: Rs.5000.00. Please pay today to stay active. Thank you.
```

**Overdue:**

```
Dear John Doe, your Monthly membership at PowerFit Gym was due on 13/02/2026. Amount: Rs.5000.00. Please make payment. Thank you.
```

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

## 4. Archive Old Members

**Endpoint:** `GET|POST /api/cron/archive-old-members`

### What It Does

Archives (soft deletes) expired members who haven't been updated in 2 years.

### Process Flow

1. Calculate cutoff date (2 years ago)
2. Find all expired members with `updated_at < cutoff_date`
3. Change their status to "cancelled" (soft delete)
4. Update `updated_at` timestamp
5. Return count of archived members

### Response Example

```json
{
  "success": true,
  "data": {
    "totalArchived": 3,
    "errors": [],
    "duration": "187ms"
  }
}
```

### Business Logic

- Only expired members are archived
- 2-year grace period before archival
- Soft delete preserves payment history for revenue reports
- Archived members have status "cancelled"

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

# Archive old members
curl http://localhost:3000/api/cron/archive-old-members
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

# Archive old members
curl -X POST https://your-app.vercel.app/api/cron/archive-old-members \
  -H "Authorization: Bearer your-cron-secret"
```

## Vercel Configuration

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-expired-status",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/expire-suspended-members",
      "schedule": "15 0 * * *"
    },
    {
      "path": "/api/cron/cancel-overdue-members",
      "schedule": "30 0 * * *"
    },
    {
      "path": "/api/cron/send-reminders",
      "schedule": "30 3 * * *"
    },
    {
      "path": "/api/cron/archive-old-members",
      "schedule": "0 1 1 * *"
    }
  ]
}
```

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
   Message: Dear John Doe, your Monthly membership...
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
- `src/app/api/cron/archive-old-members/route.ts` - Archive endpoint
- `vercel.json` - Cron configuration
- `.env.example` - Environment variable template
