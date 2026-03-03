# Database Migration Guide

## Migration: Add gym_id to payments table

### Why This Migration Is Needed
The `payments` table was missing the `gym_id` column, which is critical for:
- Multi-tenant data isolation
- Efficient RLS (Row Level Security) policies
- Proper payment tracking per gym

### How to Apply

#### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Navigate to: SQL Editor → New query

2. **Copy and Execute Migration**
   - Open file: `supabase/migrations/20260303000001_add_gym_id_to_payments.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run" or press Ctrl+Enter

3. **Verify Success**
   - Check that no errors appear
   - Verify the `payments` table now has a `gym_id` column

#### Option 2: Supabase CLI (Advanced)

```bash
# If you have Supabase CLI installed
supabase db push
```

### After Migration

Once the migration is applied, run the backfill script to add initial payment records:

```bash
npx tsx scripts/backfill-initial-payments.ts
```

This will:
- Add payment records for all existing members who don't have one
- Use the member's registration date as the payment date
- Apply any discounts that were active at registration
- Associate payments with the correct gym

### Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove RLS policies
DROP POLICY IF EXISTS "Gym owners can view their gym payments" ON payments;
DROP POLICY IF EXISTS "Gym owners can insert their gym payments" ON payments;
DROP POLICY IF EXISTS "Gym owners can update their gym payments" ON payments;
DROP POLICY IF EXISTS "Gym owners can delete their gym payments" ON payments;

-- Drop indexes
DROP INDEX IF EXISTS idx_payments_gym_id;
DROP INDEX IF EXISTS idx_payments_gym_member;

-- Remove column
ALTER TABLE payments DROP COLUMN IF EXISTS gym_id;
```

### Troubleshooting

**Error: "column gym_id already exists"**
- Migration was already applied
- No action needed, proceed to backfill

**Error: "cannot execute UPDATE in a read-only transaction"**
- Switch to a writable SQL editor session
- Ensure you're using the service role key

**Error: "violates not-null constraint"**
- Some payments don't have a corresponding member
- Clean up orphaned payments first:
  ```sql
  DELETE FROM payments WHERE member_id NOT IN (SELECT id FROM members);
  ```
