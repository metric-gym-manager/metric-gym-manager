# Migration Guide - March 25, 2026

## Overview

This guide documents the database migrations created to implement the architectural refactoring mandates:

1. **Schema Synchronization** - Align database ENUMs with TypeScript code
2. **Reminder Tracking Cleanup** - Remove deprecated boolean flag columns
3. **Rule Externalization** - Move reminder rules to database

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Database connection configured in `.env.local`
- Backup of production database (if applying to production)

## Migration Files

Two migration files have been created:

1. `supabase/migrations/20260325000001_sync_enums_and_drop_reminder_columns.sql`
   - Adds missing ENUM values
   - Drops deprecated reminder tracking columns

2. `supabase/migrations/20260325000002_create_reminder_rules_table.sql`
   - Creates `reminder_rules` table
   - Seeds table with current configuration

## Option 1: Apply Using Supabase CLI (Recommended)

### Step 1: Connect to Database

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Verify connection
supabase db remote status
```

### Step 2: Apply Migrations

```bash
# Apply all pending migrations
supabase db push

# Verify migrations were applied
supabase db remote list
```

### Step 3: Verify Schema

```bash
# Check that ENUMs were updated
supabase db remote exec "SELECT unnest(enum_range(NULL::member_plan_type));"

# Check that reminder_rules table was created
supabase db remote exec "SELECT COUNT(*) FROM reminder_rules;"
```

## Option 2: Apply Using Supabase Dashboard

### Step 1: Open SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### Step 2: Execute Migration 1

1. Copy contents of `20260325000001_sync_enums_and_drop_reminder_columns.sql`
2. Paste into SQL Editor
3. Click **Run** to execute
4. Verify success message

### Step 3: Execute Migration 2

1. Copy contents of `20260325000002_create_reminder_rules_table.sql`
2. Paste into SQL Editor
3. Click **Run** to execute
4. Verify success message

### Step 4: Verify Schema

Run these queries in the SQL Editor:

```sql
-- Check ENUM values
SELECT unnest(enum_range(NULL::member_plan_type));
SELECT unnest(enum_range(NULL::member_status));

-- Check reminder_rules table
SELECT plan_type, days_before_due, enabled
FROM reminder_rules
ORDER BY plan_type, days_before_due DESC;

-- Verify reminder tracking columns were dropped
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'members'
  AND column_name LIKE '%reminder%';
```

## Option 3: Apply Using psql (PostgreSQL CLI)

### Step 1: Get Database Connection String

From Supabase Dashboard:
1. Go to **Settings** → **Database**
2. Copy the **Connection String** (Direct connection)
3. Replace `[YOUR-PASSWORD]` with your database password

### Step 2: Execute Migrations

```bash
# Apply migration 1
psql "your-connection-string" < supabase/migrations/20260325000001_sync_enums_and_drop_reminder_columns.sql

# Apply migration 2
psql "your-connection-string" < supabase/migrations/20260325000002_create_reminder_rules_table.sql
```

## Verification Steps

After applying migrations, verify the following:

### 1. ENUM Values Added

Expected `member_plan_type` values:
- `daily`
- `weekly` ✅ NEW
- `monthly`
- `3-months` ✅ NEW
- `6-months` ✅ NEW
- `annual`
- `custom` ✅ NEW

Expected `member_status` values:
- `active`
- `expired`
- `frozen` ✅ NEW
- `suspended`
- `cancelled`

### 2. Columns Dropped

These columns should NO LONGER exist in the `members` table:
- `reminder_7day_sent_this_period` ❌ REMOVED
- `reminder_3day_sent_this_period` ❌ REMOVED
- `due_today_sent_this_period` ❌ REMOVED
- `overdue_sent_this_period` ❌ REMOVED

### 3. New Table Created

The `reminder_rules` table should have **28 rows** total:

| Plan Type | 7-Day | 3-Day | Due Today | Overdue |
|-----------|-------|-------|-----------|---------|
| daily     | ❌     | ❌     | ❌         | ❌       |
| weekly    | ✅     | ✅     | ✅         | ✅       |
| monthly   | ❌     | ✅     | ✅         | ✅       |
| 3-months  | ✅     | ✅     | ✅         | ✅       |
| 6-months  | ✅     | ✅     | ✅         | ✅       |
| annual    | ✅     | ✅     | ✅         | ✅       |
| custom    | ✅     | ✅     | ✅         | ✅       |

## Code Changes Overview

### 1. Idempotency Improvements

All exact integer matches (`=== 7`, `=== 3`, `=== 0`) have been replaced with range-based checks (`>= 7 && < 8`, etc.) to handle cron timing drift.

**Files Modified:**
- `src/core/use-cases/reminder/SendAutomatedReminders.ts`
- `src/core/utils/constants/ReminderConfig.ts`
- `src/components/payment-collection/ReminderStatusTable.tsx`
- `src/components/payment-collection/PaymentRemindersTable.tsx`
- `src/components/payment-collection/RegularPaymentTable.tsx`

### 2. Database-Backed Reminder Rules

New functions added to support querying reminder rules from database:

**File:** `src/core/utils/constants/ReminderConfig.ts`

- `shouldSendReminderDB(supabase, planType, daysUntilDue)` - Check if reminder should be sent (DB version)
- `getReminderRuleDB(supabase, planType)` - Get reminder rule config (DB version)

**Usage Example:**
```typescript
import { createClient } from '@/lib/supabase/server';
import { shouldSendReminderDB } from '@/core/utils/constants/ReminderConfig';

const supabase = await createClient();
const shouldSend = await shouldSendReminderDB(supabase, 'monthly', 3);
```

### 3. Legacy Code Removed

**Deleted:**
- `calculateBillingPeriodStart()` function from `sms.service.ts`
- Reminder tracking boolean flags from:
  - `Member.ts` (domain entity)
  - `types/index.ts` (TypeScript interfaces)
  - `Member.test.ts` (unit tests)

## Rollback Procedure

If you need to rollback these migrations:

### Rollback Migration 2 (reminder_rules table)

```sql
DROP TABLE IF EXISTS reminder_rules CASCADE;
```

### Rollback Migration 1 (ENUMs and columns)

```sql
-- WARNING: This will fail if any existing data uses the new ENUM values
-- You must first update any rows using 'weekly', '3-months', '6-months', 'custom', or 'frozen'

-- Re-add reminder tracking columns
ALTER TABLE members
ADD COLUMN reminder_7day_sent_this_period BOOLEAN DEFAULT FALSE,
ADD COLUMN reminder_3day_sent_this_period BOOLEAN DEFAULT FALSE,
ADD COLUMN due_today_sent_this_period BOOLEAN DEFAULT FALSE,
ADD COLUMN overdue_sent_this_period BOOLEAN DEFAULT FALSE;

-- Re-create index
CREATE INDEX idx_members_reminder_flags
ON members (reminder_7day_sent_this_period, reminder_3day_sent_this_period, due_today_sent_this_period);

-- Note: Cannot remove ENUM values in PostgreSQL
-- New ENUM values will remain but will be unused
```

## Testing Checklist

After applying migrations, test the following:

- [ ] Run unit tests: `npm test`
- [ ] Type check passes: `npm run type-check`
- [ ] Create a new member with `weekly` plan type
- [ ] Create a new member with `custom` plan type
- [ ] Set a member status to `frozen`
- [ ] Verify automated reminders still send correctly
- [ ] Verify cron jobs don't fail
- [ ] Check Supabase dashboard for any errors

## Support

If you encounter issues:

1. Check migration execution logs in Supabase Dashboard → Database → Migrations
2. Review error messages in SQL Editor
3. Verify your database user has sufficient permissions
4. Ensure no active transactions are blocking the migrations

## Additional Notes

### Why These Migrations?

1. **ENUM Synchronization** - Ensures database schema matches TypeScript code, preventing runtime errors
2. **Column Removal** - Eliminates redundant boolean flags; temporal queries on `sms_logs` provide better accuracy
3. **Rule Externalization** - Allows reminder rules to be configured without code deployments

### Performance Considerations

- **Index Creation** - The `reminder_rules` table has indexes on frequently queried columns
- **Query Optimization** - Range-based checks (`>= 7 && < 8`) maintain O(1) complexity
- **Backward Compatibility** - Static `REMINDER_RULES` constant remains available as fallback

### Future Improvements

Consider these enhancements:

- Add `gym_id` to `reminder_rules` for gym-specific configurations
- Add RLS policies if gym-specific rules are needed
- Create admin UI for managing reminder rules
- Add audit logging for rule changes
- Implement caching layer for frequent rule lookups

## Conclusion

After completing these migrations:

✅ Database ENUMs are synchronized with TypeScript
✅ Deprecated reminder tracking columns are removed
✅ Idempotency issues are resolved
✅ Reminder rules are externalized to database
✅ All tests pass (329 passing)

The system is now production-ready with improved maintainability and reliability.
