# Automated Cron Jobs

This document describes the automated cron jobs for the Gym Management SaaS platform.

## Overview

Three cron jobs run automatically to handle:
1. **Daily SMS Reminders** - Send payment reminders to members
2. **Status Updates** - Mark overdue members as expired
3. **Member Archival** - Archive inactive members after 2 years

## Cron Schedule

All times are configured for **Sri Lanka Time (UTC+5:30)**:

| Job | Schedule | Time (Sri Lanka) | Time (UTC) | Frequency |
|-----|----------|------------------|------------|-----------|
| Send Reminders | `30 3 * * *` | 9:00 AM | 3:30 AM | Daily |
| Update Status | `30 18 * * *` | 12:00 AM (midnight) | 6:30 PM (previous day) | Daily |
| Archive Members | `30 19 1 * *` | 1:00 AM on 1st | 7:30 PM on 1st | Monthly |

> **IMPORTANT:** Vercel Cron invokes cron paths with an **HTTP GET** request
> (with `Authorization: Bearer <CRON_SECRET>` attached automatically when the
> `CRON_SECRET` environment variable is set on the project). All cron routes
> therefore run their job on GET as well as POST. POST remains available for
> manual/external triggering with the same bearer token.

## 1. Daily SMS Reminders

**Endpoint:** `GET|POST /api/cron/send-reminders`

### What It Does
Automatically sends payment reminders based on members' due dates:

- **7-Day Notice**: Sent 7 days before due date
- **3-Day Notice**: Sent 3 days before due date
- **Expires Today** (`due_today`): Sent on the due date — "your membership expires today". Members are flipped to `expired` by the midnight expiry cron before this job runs, so this notice is sent to expired members whose `next_due_date` is today (and to any still-active member due today)
- **Overdue**: Sent for active members past their due date (edge case only — e.g. if the expiry cron did not run; members expired before today are never re-messaged)

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

**Expires Today:**
```
Dear John Doe, your Monthly membership expires today. Amount: Rs.5000.00. Please make payment to continue. Thank you.
```

**Overdue:**
```
Dear John Doe, your Monthly membership at PowerFit Gym was due on 13/02/2026. Amount: Rs.5000.00. Please make payment. Thank you.
```

## 2. Update Expired Status

**Endpoint:** `GET|POST /api/cron/update-expired-status`

### What It Does
Updates member status from "Active" to "Expired" as soon as the membership lapses — i.e. for members whose `next_due_date` is today or earlier. There is **no grace period**.

### Process Flow
1. Get today's date (00:00:00)
2. Find all active members with `next_due_date <= today`
3. Update their status to "expired"
4. Update `updated_at` timestamp
5. Return count of updated members

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
- Members expire immediately when their membership lapses (`next_due_date` reached) — there is no overdue grace window
- Expired members can still be reactivated by collecting payment, or granted single-day access via a day pass
- Members flipped to expired still receive their "membership expires today" SMS: the reminders job (which runs later the same morning) includes expired members whose `next_due_date` is today
- Receipt SMS are unaffected — they are sent on every payment collection and day pass regardless of member status

## 3. Archive Old Members

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
      "path": "/api/cron/cancel-overdue-members",
      "schedule": "15 0 * * *"
    },
    {
      "path": "/api/cron/expire-suspended-members",
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
