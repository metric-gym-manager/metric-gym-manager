# User-Facing Error Tracking Pattern (§2.8)

> On-demand reference. Not auto-injected.
> **Rule:** Distinguish pending vs. error states to end users; sanitize all technical detail before display.

---

### 2.8 User-Facing Error Tracking Pattern

**CRITICAL RULE**: When displaying SMS delivery status to end users (gym managers), you MUST differentiate between pending operations and system errors while sanitizing technical error details.

#### ❌ WRONG: Generic "Not Sent" Status

```typescript
// ❌ NEVER lump together pending and failed messages
interface ReminderStatus {
  reminder_7day_sent: string | null
  reminder_3day_sent: string | null
  // No error tracking - cannot distinguish between:
  // 1. "Not sent yet (pending)"
  // 2. "Attempted but failed (system error)"
}

function getStatus(sent: string | null): string {
  return sent ? 'Sent' : 'Not Sent' // WRONG - too ambiguous
}
```

**Problems**:

- Users cannot distinguish between scheduled vs failed messages
- No actionable guidance on what to do about errors
- Failed SMS deliveries appear identical to pending reminders
- Users may ignore critical errors thinking they're just pending

#### ✅ CORRECT: Explicit Error Tracking with Sanitization

**Step 1: Add Error Tracking to Type Definitions**

```typescript
// src/features/sms/types/index.ts
export interface MemberReminderStatus {
  // ... existing fields

  // Timestamp tracking for each reminder type
  reminder_7day_sent: string | null
  reminder_3day_sent: string | null
  due_today_sent: string | null

  // Error tracking for each reminder type
  reminder_7day_error: boolean // True if 7-day reminder delivery failed
  reminder_3day_error: boolean // True if 3-day reminder delivery failed
  due_today_error: boolean // True if due-today reminder delivery failed
}
```

**Step 2: Detect Errors in Backend Service**

```typescript
// src/features/sms/services/sms.service.ts
export async function getReminderStatus(
  gymId: string,
  filters?: ReminderFiltersInput
): Promise<MemberReminderStatus[]> {
  // ... fetch members and sms_logs

  const reminderStatuses = members.map((member) => {
    // Query each reminder type's most recent log
    const reminder7Day = reminderLogs.find(
      (log) => log.sms_type === 'reminder_7day'
    )
    const reminder3Day = reminderLogs.find(
      (log) => log.sms_type === 'reminder_3day'
    )
    const dueToday = reminderLogs.find((log) => log.sms_type === 'due_today')

    // Check for delivery failures (system errors) for each reminder type
    const reminder7DayError =
      reminder7Day?.delivery_status === 'failed' || false
    const reminder3DayError =
      reminder3Day?.delivery_status === 'failed' || false
    const dueTodayError = dueToday?.delivery_status === 'failed' || false

    return {
      // ... other fields
      reminder_7day_sent: reminder7Day?.sent_at || null,
      reminder_3day_sent: reminder3Day?.sent_at || null,
      due_today_sent: dueToday?.sent_at || null,

      // Populate error flags
      reminder_7day_error: reminder7DayError,
      reminder_3day_error: reminder3DayError,
      due_today_error: dueTodayError,
    }
  })

  return reminderStatuses
}
```

**Step 3: Map Error Flags to UI States**

```typescript
// src/components/payment-collection/PaymentRemindersTable.tsx
const getSMSTypeStatus = (
  reminder: MemberReminderStatus,
  _targetDays: number,
  expectedType: string
): 'sent' | 'not_sent' | 'not_applicable' | 'error' => {
  const {
    reminder_7day_error,
    reminder_3day_error,
    due_today_error,
    reminder_7day_sent,
    reminder_3day_sent,
    due_today_sent,
  } = reminder

  // Check for delivery failures (system errors) FIRST
  let hasError = false
  if (expectedType === 'reminder_7day') {
    hasError = reminder_7day_error
  } else if (expectedType === 'reminder_3day') {
    hasError = reminder_3day_error
  } else if (expectedType === 'due_today') {
    hasError = due_today_error
  }

  if (hasError) {
    return 'error' // Prioritize error state
  }

  // Check if reminder was sent successfully
  let wasSent = false
  if (expectedType === 'reminder_7day') {
    wasSent = !!reminder_7day_sent
  } else if (expectedType === 'reminder_3day') {
    wasSent = !!reminder_3day_sent
  } else if (expectedType === 'due_today') {
    wasSent = !!due_today_sent
  }

  if (wasSent) {
    return 'sent'
  }

  return 'not_sent' // Pending or missed window
}
```

**Step 4: Render Error State with Actionable Guidance**

```typescript
// src/components/payment-collection/PaymentRemindersTable.tsx
import { AlertOctagon } from 'lucide-react';

const renderSMSStatusBadge = (
  status: 'sent' | 'not_sent' | 'not_applicable' | 'error',
  reminder: MemberReminderStatus,
  targetDays: number
) => {
  // Error: System error occurred during SMS delivery
  if (status === 'error') {
    return (
      <div
        className="flex items-center gap-1.5 text-xs font-medium text-red-600"
        title="System error occurred. Click 'Send Now' to retry."
      >
        <AlertOctagon className="h-3.5 w-3.5" />
        <span>Error</span>
      </div>
    );
  }

  // ... handle other states (sent, pending, disabled)
};
```

**Step 5: Sanitize Error Messages (Defense-in-Depth)**

**API Layer Protection**:

```typescript
// src/app/api/members/[id]/sms-history/route.ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Explicitly exclude 'error_message' to prevent exposing technical infrastructure details
  const { data: smsLogs, error: logsError } = await supabase
    .from('sms_logs')
    .select(
      'id, sms_type, phone_number, message_body, sent_at, delivery_status, text_lk_message_id, created_at'
    )
    // NOTE: 'error_message' field intentionally omitted
    .eq('member_id', memberId)
    .eq('gym_id', gymProfile.id)
    .order('sent_at', { ascending: false })

  return NextResponse.json({ data: { smsLogs } })
}
```

**Type Layer Protection**:

```typescript
// Frontend type definition
interface SMSLog {
  id: string
  sms_type: string
  phone_number: string
  message_body: string // ✅ User-facing message only
  sent_at: string
  delivery_status: 'sent' | 'delivered' | 'failed'
  text_lk_message_id: string | null
  // NO error_message field - prevents accidental exposure
}
```

**UI Layer Protection**:

```typescript
// SMSHistoryModal.tsx
<div className="mt-2 p-3 rounded-md bg-gray-50 text-sm text-gray-700">
  {log.message_body}  {/* Only render user-facing message */}
</div>
```

#### UI State Matrix

| State        | Badge Color              | Icon               | Text        | Tooltip                                                 | Action        |
| ------------ | ------------------------ | ------------------ | ----------- | ------------------------------------------------------- | ------------- |
| **Sent**     | Green (`text-green-700`) | `CheckCircle2`     | "Sent"      | -                                                       | None          |
| **Pending**  | Gray (`text-gray-500`)   | `Clock`            | "Pending"   | -                                                       | Wait          |
| **Not Sent** | Amber (`text-amber-600`) | `AlertCircle`      | "Not Sent"  | -                                                       | Manual review |
| **Disabled** | Gray (`text-gray-400`)   | `XCircle`          | "Disabled"  | -                                                       | None          |
| **Error**    | **Red (`text-red-600`)** | **`AlertOctagon`** | **"Error"** | **"System error occurred. Click 'Send Now' to retry."** | **Retry**     |

#### Benefits of This Pattern

1. **Clear Error Visibility**: Users can immediately identify failed SMS deliveries
2. **Actionable Guidance**: Tooltip instructs users to retry via "Send Now" button
3. **Security**: Technical error messages (stack traces, API keys, database errors) hidden from end users
4. **Defense-in-Depth**: Triple-layer protection (API, Type, UI) prevents error message leakage
5. **Better UX**: Users understand system state and know how to resolve issues
6. **Debugging Support**: Errors tracked in database for admin/developer analysis

#### When to Use This Pattern

- ✅ User-facing dashboards showing system operation status
- ✅ SMS/email delivery tracking interfaces
- ✅ Any UI where users need to distinguish between pending and failed operations
- ✅ Systems where users can retry failed operations manually

#### When NOT to Use This Pattern

- ❌ Admin/developer dashboards (can show full error details)
- ❌ Internal monitoring tools (use full error messages)
- ❌ Operations with no user-facing retry mechanism
- ❌ Systems where all errors auto-retry without user intervention

---
