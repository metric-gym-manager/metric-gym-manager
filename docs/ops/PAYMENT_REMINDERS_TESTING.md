# Payment Reminders - Comprehensive Testing Guide

## Overview

This document describes the comprehensive testing strategy for the Payment Reminders feature, including automatic reminder logic, SMS logging, and frontend display.

## Test Scenarios

### 1. Daily Members (NO Automatic Reminders)

**Rule:** Daily members should receive NO automatic payment reminders.

| Scenario          | Days Until Due | Expected SMS | Reason                                         |
| ----------------- | -------------- | ------------ | ---------------------------------------------- |
| Daily - 7 Days    | +7             | NONE         | Daily members excluded from all auto-reminders |
| Daily - 3 Days    | +3             | NONE         | Daily members excluded from all auto-reminders |
| Daily - Due Today | 0              | NONE         | Daily members excluded from all auto-reminders |
| Daily - Overdue   | -2             | NONE         | Daily members excluded from all auto-reminders |

**Frontend Display:**

- All 3 status columns (7-day, 3-day, due-date) should show: ❌ **N/A**

---

### 2. Monthly Members (3-Day & Due-Date Only)

**Rule:** Monthly members receive 3-day and due-date reminders only (NO 7-day reminder).

| Scenario            | Days Until Due | Expected SMS    | Reason                                   |
| ------------------- | -------------- | --------------- | ---------------------------------------- |
| Monthly - 7 Days    | +7             | NONE            | Monthly members don't get 7-day reminder |
| Monthly - 3 Days    | +3             | `reminder_3day` | Monthly members get 3-day reminder       |
| Monthly - Due Today | 0              | `due_today`     | Monthly members get due-date reminder    |
| Monthly - Overdue   | -5             | `overdue`       | Monthly members get overdue reminder     |

**Frontend Display:**

- **7-day column:** ❌ **N/A** (not applicable for monthly)
- **3-day column:**
  - Before 3-day mark: ⚠️ **Not sent**
  - At 3-day mark: ✅ **Sent** (after cron runs)
- **Due-date column:**
  - Before due date: ⚠️ **Not sent**
  - On due date: ✅ **Sent** (after cron runs)

---

### 3. Annual Members (ALL Reminders)

**Rule:** Annual members receive all 3 reminders: 7-day, 3-day, and due-date.

| Scenario           | Days Until Due | Expected SMS    | Reason                               |
| ------------------ | -------------- | --------------- | ------------------------------------ |
| Annual - 7 Days    | +7             | `reminder_7day` | Annual members get 7-day reminder    |
| Annual - 3 Days    | +3             | `reminder_3day` | Annual members get 3-day reminder    |
| Annual - Due Today | 0              | `due_today`     | Annual members get due-date reminder |
| Annual - Overdue   | -3             | `overdue`       | Annual members get overdue reminder  |

**Frontend Display:**

- **7-day column:**
  - Before 7-day mark: ⚠️ **Not sent**
  - At 7-day mark: ✅ **Sent**
  - After 7-day mark (if not sent): ⚠️ **Not sent**
- **3-day column:** ⚠️ **Not sent** or ✅ **Sent** (depending on timing)
- **Due-date column:** ⚠️ **Not sent** or ✅ **Sent** (depending on timing)

---

### 4. 3-Months & 6-Months Members (ALL Reminders)

**Rule:** Same as annual - receive all 3 reminders.

| Scenario            | Days Until Due | Expected SMS    |
| ------------------- | -------------- | --------------- |
| 3-Month - 7 Days    | +7             | `reminder_7day` |
| 3-Month - 3 Days    | +3             | `reminder_3day` |
| 6-Month - Due Today | 0              | `due_today`     |

---

## Backend Flow Testing

### 1. Cron Job Execution

**Endpoint:** `POST /api/cron/send-reminders`

**Process:**

1. Fetch all gyms
2. For each gym:
   - Fetch all active members (excluding installment plan members)
   - Calculate days until due for each member
   - **Apply plan-specific logic:**
     - **Daily:** Skip all reminders
     - **Monthly:** Skip if 7-day window, send if 3-day/due/overdue
     - **Others:** Send all applicable reminders
3. Send SMS via text.lk (or mock in dev)
4. Log each SMS to `sms_logs` table
5. Return summary statistics

**Expected Output:**

```json
{
  "success": true,
  "data": {
    "totalSent": 8,
    "byType": {
      "reminder_7day": 3,
      "reminder_3day": 3,
      "due_today": 2,
      "overdue": 2,
      "receipt": 0
    },
    "errors": [],
    "duration": "2345ms"
  }
}
```

---

### 2. SMS Logs Verification

**Query:**

```sql
SELECT * FROM sms_logs
WHERE member_id = '<member_id>'
  AND sms_type IN ('reminder_7day', 'reminder_3day', 'due_today', 'overdue')
ORDER BY sent_at DESC;
```

**Expected Fields:**

- `id`: UUID
- `member_id`: UUID of member
- `gym_id`: UUID of gym
- `sms_type`: One of the reminder types
- `phone_number`: Member's phone (+94XXXXXXXXX)
- `message_body`: Full SMS text
- `sent_at`: Timestamp
- `delivery_status`: 'sent', 'delivered', or 'failed'
- `text_lk_message_id`: External provider ID (if real SMS enabled)

**Verification Checklist:**

- ✅ Daily members: 0 SMS logs (no reminders)
- ✅ Monthly at 7 days: 0 SMS logs (no 7-day reminder)
- ✅ Monthly at 3 days: 1 SMS log (`reminder_3day`)
- ✅ Annual at 7 days: 1 SMS log (`reminder_7day`)
- ✅ All SMS have correct `gym_id`, `member_id`, and `sms_type`

---

## Frontend Flow Testing

### 1. Payment Reminders Table

**Endpoint:** `GET /api/sms/reminders?filter=all&sortBy=due_date_asc`

**Test Cases:**

#### TC1: Daily Member Display

```
Member: "Daily Test - 3 Days"
Plan: Daily
Due In: 3 days

Expected Display:
├─ 7-Day Reminder: ❌ N/A
├─ 3-Day Reminder: ❌ N/A
└─ Due Date Reminder: ❌ N/A
```

#### TC2: Monthly Member (Before 3-Day Mark)

```
Member: "Monthly Test - 7 Days"
Plan: Monthly
Due In: 7 days

Expected Display:
├─ 7-Day Reminder: ❌ N/A (monthly don't get this)
├─ 3-Day Reminder: ⚠️ Not sent (will be sent at 3-day mark)
└─ Due Date Reminder: ⚠️ Not sent (will be sent on due date)
```

#### TC3: Monthly Member (At 3-Day Mark, After Cron)

```
Member: "Monthly Test - 3 Days"
Plan: Monthly
Due In: 3 days
Last Reminder: reminder_3day

Expected Display:
├─ 7-Day Reminder: ❌ N/A
├─ 3-Day Reminder: ✅ 3-Day (sent)
└─ Due Date Reminder: ⚠️ Not sent
```

#### TC4: Annual Member (At 7-Day Mark)

```
Member: "Annual Test - 7 Days"
Plan: Annual
Due In: 7 days
Last Reminder: reminder_7day

Expected Display:
├─ 7-Day Reminder: ✅ 7-Day (sent)
├─ 3-Day Reminder: ⚠️ Not sent
└─ Due Date Reminder: ⚠️ Not sent
```

---

### 2. Status Badge Logic

**Implementation:**

```typescript
function getSMSTypeStatus(
  reminder: MemberReminderStatus,
  targetDays: number,
  expectedType: string
): 'sent' | 'not_sent' | 'not_applicable' {
  const { days_until_due, last_reminder_type, plan_type } = reminder

  // Daily members: no automatic reminders
  if (plan_type === 'daily') {
    return 'not_applicable'
  }

  // Monthly members: no 7-day reminder
  if (plan_type === 'monthly' && expectedType === 'reminder_7day') {
    return 'not_applicable'
  }

  // Check if this reminder was sent
  if (days_until_due === targetDays && last_reminder_type === expectedType) {
    return 'sent'
  }

  // If we're past this reminder window and it wasn't sent
  if (days_until_due < targetDays) {
    return 'not_sent'
  }

  // Not yet time for this reminder
  return 'not_applicable'
}
```

**Test Matrix:**

| Plan Type | Days Until | Target: 7 | Target: 3 | Target: 0 |
| --------- | ---------- | --------- | --------- | --------- |
| Daily     | Any        | N/A       | N/A       | N/A       |
| Monthly   | 7          | N/A       | -         | -         |
| Monthly   | 3          | N/A       | ✅        | -         |
| Monthly   | 0          | N/A       | ⚠️        | ✅        |
| Annual    | 7          | ✅        | -         | -         |
| Annual    | 3          | ⚠️        | ✅        | -         |
| Annual    | 0          | ⚠️        | ⚠️        | ✅        |

---

### 3. SMS History Modal

**Endpoint:** `GET /api/members/:id/sms-history`

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "member": {
      "id": "uuid",
      "name": "Monthly Test - 3 Days",
      "phone_number": "+94771234567"
    },
    "smsLogs": [
      {
        "id": "uuid",
        "sms_type": "reminder_3day",
        "phone_number": "+94771234567",
        "message_body": "Dear Monthly Test - 3 Days...",
        "sent_at": "2026-03-09T03:30:00Z",
        "delivery_status": "sent",
        "text_lk_message_id": null
      }
    ],
    "totalCount": 1
  }
}
```

**Modal Display:**

- Shows only payment reminder SMS (filters out receipt, welcome)
- Table columns: Type | Sent At | Status | Message
- Type badge color-coded (7-day: blue, 3-day: amber, due: orange, overdue: red)
- Status badge: Sent (blue), Delivered (green), Failed (red)
- Message expandable via "View message" details

---

### 4. Manual Reminder Sending

**Endpoint:** `POST /api/sms/send`

**Request:**

```json
{
  "memberId": "uuid",
  "smsType": "reminder_7day"
}
```

**Test Case:**

1. Click "Send Now" button on "Monthly Test - 7 Days"
2. System determines SMS type based on `days_until_due`
3. SMS sent manually (bypasses cron logic)
4. SMS log created in database
5. "Sent X ago" indicator appears
6. History modal shows the manually sent SMS

**Verification:**

- ✅ SMS log created with correct type
- ✅ "Sent Xm ago" indicator shows in table
- ✅ Indicator updates to "Sent Xh ago" after time passes
- ✅ Manual SMS appears in history modal
- ✅ No errors in console

---

## Running the Tests

### Prerequisites

1. **Start development server:**

   ```bash
   npm run dev
   ```

2. **Ensure environment variables are set:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   CRON_SECRET=dev-secret-key
   ENABLE_REAL_SMS=false  # Use mock SMS for testing
   ```

### Execute Test Suite

```bash
npx tsx scripts/test-payment-reminders.ts
```

### Expected Output

```
╔════════════════════════════════════════════════════════════╗
║   PAYMENT REMINDERS COMPREHENSIVE TEST SUITE              ║
╚════════════════════════════════════════════════════════════╝

🧹 Cleaning up existing test members...
✓ Cleanup complete

📝 Creating test members...
✓ Created: Daily Test - 7 Days
  Plan: daily, Due: 2026-03-16 (7 days)
✓ Created: Daily Test - 3 Days
  Plan: daily, Due: 2026-03-12 (3 days)
...
✅ Created 17 test members

🚀 Simulating automated reminder cron job...
✓ Cron job completed successfully

Results: {
  "totalSent": 8,
  "byType": {
    "reminder_7day": 3,
    "reminder_3day": 3,
    "due_today": 2,
    "overdue": 2
  }
}

📊 Verifying SMS logs...

✅ Daily Test - 7 Days
   Expected: [NONE]
   Actual:   [NONE]
✅ Daily Test - 3 Days
   Expected: [NONE]
   Actual:   [NONE]
✅ Monthly Test - 7 Days
   Expected: [NONE]
   Actual:   [NONE]
✅ Monthly Test - 3 Days
   Expected: [reminder_3day]
   Actual:   [reminder_3day]
✅ Annual Test - 7 Days
   Expected: [reminder_7day]
   Actual:   [reminder_7day]
...

📈 Test Results: 17 passed, 0 failed

🖥️  Testing frontend display logic...
✓ Fetched 17 reminders from API

Testing: Daily Test - 7 Days
  Plan: daily, Days until due: 7
  Last reminder type: none
  Expected statuses: {"7day":"not_applicable","3day":"not_applicable","due":"not_applicable"}

Testing: Monthly Test - 3 Days
  Plan: monthly, Days until due: 3
  Last reminder type: reminder_3day
  Expected statuses: {"7day":"not_applicable","3day":"sent","due":"not_sent"}
...

🔧 Testing manual reminder send...
Sending manual reminder to: Monthly Test - 7 Days
✓ Manual reminder sent successfully
✓ SMS log created:
  Type: reminder_7day
  Sent at: 2026-03-09T04:15:30Z
  Status: sent

📜 Testing SMS History Modal data...
Fetching SMS history for: Monthly Test - 3 Days
✓ SMS History fetched successfully
  Member: Monthly Test - 3 Days (+94771234567)
  Total SMS logs: 1
  Payment reminders: 1
    - reminder_3day: sent at 3/9/2026, 9:45:30 AM

╔════════════════════════════════════════════════════════════╗
║   TEST SUITE COMPLETED                                     ║
╚════════════════════════════════════════════════════════════╝

📝 Summary:
  1. Test members created: ✓
  2. Cron job simulated: ✓
  3. SMS logs verified: ✓
  4. Frontend display tested: ✓
  5. Manual reminder tested: ✓
  6. SMS history modal tested: ✓

✨ All tests complete!
```

---

## Manual UI Testing Checklist

### Payment Reminders Tab

- [ ] Navigate to Payment Collection → Payment Reminders tab
- [ ] Verify table shows all active members
- [ ] Verify 3 status columns: 7-Day, 3-Day, Due Date
- [ ] Verify daily members show ❌ N/A for all columns
- [ ] Verify monthly members show ❌ N/A for 7-Day column
- [ ] Verify annual members show appropriate status per column
- [ ] Click row → Opens member details modal
- [ ] Click History icon → Opens SMS history modal
- [ ] Verify filters work (All, Upcoming, Due Today, Overdue)
- [ ] Verify sorting works (Due Date, Last Reminder)

### SMS History Modal

- [ ] Modal opens when clicking History icon
- [ ] Modal title shows member name and phone
- [ ] Table shows only payment reminder SMS (no receipts/welcome)
- [ ] Columns display: Type, Sent At, Status, Message
- [ ] Type badges are color-coded correctly
- [ ] Status badges match delivery status
- [ ] "View message" expands to show full SMS content
- [ ] Modal shows "No reminders sent" for members without SMS
- [ ] Total count at bottom matches SMS displayed

### Manual Reminder Sending

- [ ] Click "Send Now" button
- [ ] Button shows "Sending..." while pending
- [ ] Success toast appears after send
- [ ] "Sent Xm ago" indicator appears below button
- [ ] Indicator updates over time (Xm → Xh)
- [ ] Refresh page → Indicator still shows correctly
- [ ] SMS appears in history modal after manual send

---

## Troubleshooting

### Issue: Cron job returns 0 reminders sent

**Possible causes:**

1. No test members created
2. Test members not in correct due date windows
3. Test members have installment plans (excluded from regular reminders)

**Solution:** Run test script to create proper test data

### Issue: Daily members receiving reminders

**Cause:** Cron logic not checking plan_type correctly

**Fix:** Verify `reminder.service.ts` line 234 has daily plan check

### Issue: Monthly members receiving 7-day reminders

**Cause:** 7-day skip logic not working for monthly

**Fix:** Verify `reminder.service.ts` line 244 has monthly 7-day check

### Issue: SMS logs not showing in history

**Cause:** API filtering incorrectly or RLS policies blocking

**Solution:**

1. Check `/api/members/[id]/sms-history` returns data
2. Verify gym_id matches in both members and sms_logs
3. Check Supabase RLS policies on sms_logs table

---

## Conclusion

This comprehensive test suite validates:

✅ **Backend Logic:**

- Daily members excluded from all automatic reminders
- Monthly members excluded from 7-day reminders
- Annual/3-month/6-month members receive all reminders
- SMS correctly logged to database

✅ **Frontend Display:**

- Status badges show correct states
- N/A displayed for excluded reminder types
- "Sent X ago" indicator works
- Filters and sorting function properly

✅ **SMS History:**

- Modal shows complete payment reminder history
- Only payment reminders displayed (no receipts)
- Delivery status accurately shown

✅ **Manual Sending:**

- Manual reminders bypass plan restrictions
- SMS logs created correctly
- UI updates in real-time

All tests passing confirms the Payment Reminders feature is working as designed! 🎉
