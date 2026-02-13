# Database Setup Guide

This guide will help you set up your Supabase database with all required tables and security policies.

## 📋 Prerequisites

- Supabase project created at https://app.supabase.com
- `.env.local` file configured with Supabase credentials

## 🗄️ Database Migrations

You need to apply all migrations in the `supabase/migrations/` directory.

### Method 1: Supabase Dashboard (Recommended for First-Time Setup)

1. **Go to SQL Editor:**
   - Open your Supabase project
   - Navigate to **SQL Editor** in the left sidebar

2. **Run migrations in order:**
   - Open each migration file from `supabase/migrations/` in this order:

   #### Migration 1: Core Schema
   ```
   supabase/migrations/20240210000000_initial_schema.sql
   ```
   - Creates gyms, members, payments, plan_types, discounts, sms_logs, otp_tokens tables
   - Sets up Row Level Security (RLS)

   #### Migration 2: Fix Users RLS
   ```
   supabase/migrations/20240210000002_fix_users_rls.sql
   ```
   - Updates RLS policies for proper authentication

   #### Migration 3: Simplify Auth Model
   ```
   supabase/migrations/20240210000003_simplify_auth_model.sql
   ```
   - Simplifies authentication model for better compatibility

3. **How to run each migration:**
   - Copy the SQL content from the migration file
   - Paste it into the SQL Editor in Supabase
   - Click **Run** button
   - Wait for "Success" message
   - Move to next migration

### Method 2: Supabase CLI (Advanced)

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run all pending migrations
supabase db push
```

## 📊 Verify Database Setup

After running migrations, verify the tables were created:

### 1. Check Tables List

Go to **Table Editor** in Supabase Dashboard. You should see:
- ✅ gyms
- ✅ members
- ✅ payments
- ✅ plan_types
- ✅ discounts
- ✅ sms_logs
- ✅ otp_tokens

### 2. Check RLS Policies

Go to **Authentication** → **Policies**. Each table should have RLS policies enabled.

### 3. Test with SQL Query

In SQL Editor, run:
```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected output:
```
discounts
gyms
members
otp_tokens
payments
plan_types
sms_logs
```

## 🔐 Authentication Setup

### Enable Email Provider

1. Go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. Configure email templates (optional):
   - **Confirm signup**: Customize the verification email
   - **Magic Link**: Customize the magic link email
   - **Reset Password**: Customize the password reset email

### Email Settings (Optional)

For production, you may want to configure a custom SMTP server:
1. Go to **Project Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Configure your email provider (e.g., SendGrid, AWS SES)

For development, use Supabase's default email provider (emails will be sent but may go to spam).

## 🧪 Test Database Connection

### From Your Application

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3001

3. Try to register a new account:
   - If registration works, your database is set up correctly! ✅
   - Check the `gyms` table in Supabase to see the new record

### From SQL Editor

Run this test query:
```sql
-- Test inserting a gym
INSERT INTO gyms (username, email, gym_name, gym_address)
VALUES ('testgym', 'test@example.com', 'Test Gym', '123 Test St')
RETURNING *;

-- View the inserted gym
SELECT * FROM gyms WHERE username = 'testgym';

-- Clean up (optional)
DELETE FROM gyms WHERE username = 'testgym';
```

## 🔧 Common Issues

### Issue: "permission denied for table gyms"
**Cause:** RLS policies not set up correctly
**Solution:** Re-run the RLS migration (`20240210000002_fix_users_rls.sql`)

### Issue: "relation 'members' does not exist"
**Cause:** Initial schema migration not applied
**Solution:** Run the first migration (`20240210000000_initial_schema.sql`)

### Issue: Can't insert data
**Cause:** RLS policies are blocking inserts
**Solution:** Make sure you're authenticated or temporarily disable RLS for testing:
```sql
ALTER TABLE gyms DISABLE ROW LEVEL SECURITY; -- For testing only!
```

### Issue: "duplicate key value violates unique constraint"
**Cause:** Trying to create a user that already exists
**Solution:** Use a different email/username or delete the existing record

## 📦 Database Schema Overview

### gyms
- Stores gym/business information
- Linked to Supabase Auth users
- Fields: gym_name, gym_address, gym_website, username, email, phone_number

### members
- Stores gym members
- Fields: name, phone_number, plan_type, plan_amount, discount_id, status, next_due_date
- RLS: Only the gym owner can access their members

### payments
- Stores payment history
- Fields: member_id, payment_date, amount_paid, discount_applied, next_due_date_calculated
- Used for revenue analytics

### plan_types
- Configurable plan types per gym
- Default types: monthly, daily, annual
- Fields: plan_type, default_amount, is_active

### discounts
- Discount presets per gym
- Fields: discount_name, discount_percentage, is_active

### sms_logs
- SMS delivery tracking
- Fields: member_id, sms_type, phone_number, message_body, delivery_status
- Used for payment collection tracking

### otp_tokens
- Stores OTP codes for phone login
- Fields: phone_number, otp_code, expires_at (60 seconds), used
- Auto-cleanup of expired tokens

## 🔄 Database Backup

It's recommended to enable automatic backups in production:

1. Go to **Project Settings** → **Database**
2. Scroll to **Backups**
3. Enable **Point-in-time Recovery** (requires Pro plan)

For free tier, you can manually export data:
1. Go to **Table Editor**
2. Select a table
3. Click **Export** → Choose format (CSV, JSON)

## 🚀 Ready for Production

Before deploying to production:

1. ✅ All migrations applied
2. ✅ RLS policies enabled and tested
3. ✅ Email provider configured
4. ✅ Backups enabled (if on Pro plan)
5. ✅ Connection pooling configured (if needed)
6. ✅ SSL enforced (enabled by default)

## 📝 Migration Files Reference

All migration files are in `supabase/migrations/`:

1. `20240210000000_initial_schema.sql` - Core database schema
2. `20240210000002_fix_users_rls.sql` - RLS policies fix
3. `20240210000003_simplify_auth_model.sql` - Auth model simplification

Run them in this order!

---

**Need help?** Check the console output for detailed error messages, or refer to Supabase docs at https://supabase.com/docs
