# Multi-Cycle Query Ordering Pattern (§2.10)

> On-demand reference. Not auto-injected.
> **Rule:** Sort time-series records by timestamp DESC before `.find()` to guarantee the most-recent record.

---

### 2.10 Multi-Cycle Query Ordering Pattern

**CRITICAL RULE**: When querying time-series data that may have multiple records per entity across different time periods (billing cycles, sessions, etc.), you MUST sort by timestamp in descending order BEFORE using `.find()` to ensure you retrieve the most recent record.

#### ❌ WRONG: Unordered Query with .find()

```typescript
// ❌ NEVER use .find() on unordered time-series data
export async function getReminderStatus(gymId: string) {
  const { data: members } = await supabase
    .from('members')
    .select(
      `
      id,
      name,
      sms_logs (
        sms_type,
        sent_at,
        delivery_status
      )
    `
    )
    .eq('gym_id', gymId)

  const reminderStatuses = members.map((member) => {
    // WRONG: No ordering - .find() returns arbitrary result
    const reminderLogs = (member.sms_logs || []).filter(
      (log) => log.sms_type === 'overdue'
    )

    // WRONG: May return old March log instead of new April log
    const overdue = reminderLogs.find((log) => log.sms_type === 'overdue')

    return {
      id: member.id,
      name: member.name,
      overdue_sent: overdue?.sent_at || null, // ❌ Stale data
    }
  })

  return reminderStatuses
}
```

**Problems**:

- Members with multiple billing cycles have multiple logs per type
- Database returns results in arbitrary order (no ORDER BY clause)
- JavaScript `.find()` returns first match in array order (not chronological)
- UI displays old data from previous billing cycle
- Users see "Not Sent" status even when recent reminder was delivered

**Example Bug Scenario**:

```typescript
// Member has 2 overdue reminder logs:
const smsLogs = [
  { sms_type: 'overdue', sent_at: '2026-03-15', delivery_status: 'sent' }, // March
  { sms_type: 'overdue', sent_at: '2026-04-10', delivery_status: 'sent' }, // April
]

// Without ordering, database may return in any order:
// Result 1: March log first → .find() returns March → UI shows old data ❌
// Result 2: April log first → .find() returns April → UI shows current data ✅

// INCONSISTENT BEHAVIOR - depends on database internals!
```

#### ✅ CORRECT: Sort Before Find

**Step 1: Add Sorting by Timestamp (Client-Side)**

```typescript
// src/features/sms/services/sms.service.ts
export async function getReminderStatus(gymId: string) {
  const { data: members } = await supabase
    .from('members')
    .select(
      `
      id,
      name,
      sms_logs (
        sms_type,
        sent_at,
        delivery_status
      )
    `
    )
    .eq('gym_id', gymId)

  const reminderStatuses = members.map((member) => {
    const REMINDER_TYPES = [
      'reminder_7day',
      'reminder_3day',
      'due_today',
      'overdue',
    ]

    // ✅ CORRECT: Sort by sent_at DESC before using .find()
    const reminderLogs = (member.sms_logs || [])
      .filter((log) => REMINDER_TYPES.includes(log.sms_type))
      .sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      )

    // Now .find() returns most recent log for each type
    const reminder7Day = reminderLogs.find(
      (log) => log.sms_type === 'reminder_7day'
    )
    const reminder3Day = reminderLogs.find(
      (log) => log.sms_type === 'reminder_3day'
    )
    const dueToday = reminderLogs.find((log) => log.sms_type === 'due_today')
    const overdue = reminderLogs.find((log) => log.sms_type === 'overdue')

    return {
      id: member.id,
      name: member.name,
      reminder_7day_sent: reminder7Day?.sent_at || null, // ✅ Current data
      reminder_3day_sent: reminder3Day?.sent_at || null, // ✅ Current data
      due_today_sent: dueToday?.sent_at || null, // ✅ Current data
      overdue_sent: overdue?.sent_at || null, // ✅ Current data
    }
  })

  return reminderStatuses
}
```

**Step 2: Alternative - Database-Level Ordering (Server-Side)**

```typescript
// If you need only the most recent log per type, use database ordering
const { data: latestOverdueLogs } = await supabase
  .from('sms_logs')
  .select('member_id, sent_at, delivery_status')
  .eq('gym_id', gymId)
  .eq('sms_type', 'overdue')
  .order('sent_at', { ascending: false })

// Group by member_id to get latest per member
const latestByMember = latestOverdueLogs.reduce((acc, log) => {
  if (!acc[log.member_id]) {
    acc[log.member_id] = log // First log is most recent due to ORDER BY
  }
  return acc
}, {})
```

**Step 3: Index for Performance**

```sql
-- supabase/migrations/YYYYMMDD_add_sms_logs_ordering_index.sql
CREATE INDEX IF NOT EXISTS idx_sms_logs_member_type_sent
  ON sms_logs (member_id, sms_type, sent_at DESC);

-- Speeds up queries filtering by member + type and ordering by sent_at
```

#### Benefits of This Pattern

1. **Consistent Behavior**: Always returns most recent record regardless of database order
2. **Multi-Cycle Support**: Works correctly for members with long payment histories
3. **Accurate UI**: Displays current billing cycle data, not stale historical data
4. **Type Safety**: TypeScript compiler ensures correct field access
5. **Performance**: Client-side sorting is fast for small datasets; use database ordering for large datasets
6. **Idempotency**: Most recent log correctly prevents duplicate operations

#### When to Use This Pattern

- ✅ SMS/email delivery tracking across multiple campaigns
- ✅ Payment history where members have recurring payments
- ✅ Session logs with multiple entries per user
- ✅ Audit trails with time-series events
- ✅ Any entity with multiple records per type over time

#### When NOT to Use This Pattern

- ❌ One-to-one relationships (user profile, settings)
- ❌ Entities guaranteed to have only one record per type
- ❌ Already using `LIMIT 1` with `ORDER BY` in database query
- ❌ Data that doesn't have temporal aspects

#### Common Mistakes

**Mistake 1: Using last array element without sorting**

```typescript
// ❌ WRONG - Assumes last element is most recent
const overdue = reminderLogs[reminderLogs.length - 1]

// ✅ CORRECT - Sort first, then access
const sortedLogs = reminderLogs.sort(
  (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
)
const overdue = sortedLogs[0]
```

**Mistake 2: Filtering then finding without sorting**

```typescript
// ❌ WRONG - Filter doesn't guarantee order
const overdueLogs = reminderLogs.filter((log) => log.sms_type === 'overdue')
const latest = overdueLogs[0] // May not be latest!

// ✅ CORRECT - Sort before filtering
const overdueLogs = reminderLogs
  .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
  .filter((log) => log.sms_type === 'overdue')
const latest = overdueLogs[0] // Guaranteed to be latest
```

**Mistake 3: Database ordering only one table in join**

```sql
-- ❌ WRONG - Ordering parent table doesn't order child table
SELECT
  members.id,
  sms_logs.sent_at
FROM members
LEFT JOIN sms_logs ON sms_logs.member_id = members.id
ORDER BY members.created_at DESC;  -- Only orders members, not sms_logs!

-- ✅ CORRECT - Order child table separately or use subquery
SELECT
  members.id,
  latest_sms.sent_at
FROM members
LEFT JOIN LATERAL (
  SELECT sent_at
  FROM sms_logs
  WHERE sms_logs.member_id = members.id
  ORDER BY sent_at DESC
  LIMIT 1
) latest_sms ON true;
```

#### Testing This Pattern

```typescript
describe('getReminderStatus', () => {
  it('returns most recent log when member has multiple billing cycles', async () => {
    // Setup: Member with March and April logs
    const member = await createMember({ name: 'Test User' })
    await createSMSLog({
      member_id: member.id,
      sms_type: 'overdue',
      sent_at: '2026-03-15', // Old billing cycle
    })
    await createSMSLog({
      member_id: member.id,
      sms_type: 'overdue',
      sent_at: '2026-04-10', // Current billing cycle
    })

    // Execute
    const statuses = await getReminderStatus(member.gym_id)

    // Assert: Should return April log, not March
    expect(statuses[0].overdue_sent).toBe('2026-04-10') // ✅ Not '2026-03-15'
  })

  it('handles single log correctly', async () => {
    const member = await createMember({ name: 'New User' })
    await createSMSLog({
      member_id: member.id,
      sms_type: 'overdue',
      sent_at: '2026-04-10',
    })

    const statuses = await getReminderStatus(member.gym_id)

    expect(statuses[0].overdue_sent).toBe('2026-04-10') // ✅ Works correctly
  })

  it('handles no logs correctly', async () => {
    const member = await createMember({ name: 'Fresh User' })

    const statuses = await getReminderStatus(member.gym_id)

    expect(statuses[0].overdue_sent).toBeNull() // ✅ No crash
  })
})
```

#### Real-World Impact

**Bug Example**: Gym Management SaaS (2026-04-10)

- **Issue**: Reminders tab always showed "Not Sent" despite successful SMS delivery
- **Root Cause**: Unordered query + `.find()` returned March log instead of April log
- **Users Affected**: All gyms with members having 2+ billing cycles
- **Impact**: Gym managers thought automated reminders were broken, lost trust in system
- **Fix**: Added `.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())`
- **Result**: UI now correctly shows current reminder status for all members

**Key Lesson**: Time-series data MUST be sorted before retrieval operations, especially in multi-tenant SaaS where entities accumulate records over months/years.

---
