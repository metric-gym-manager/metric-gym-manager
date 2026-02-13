# Development Utilities

Quick utility scripts for development and testing.

## Available Scripts

### 🧹 Clear Rate Limits
Clear OTP rate limits and get instructions for clearing Auth rate limits.

```bash
npm run dev:clear-limits
```

**What it does:**
- Deletes all OTP tokens (clears OTP rate limiting)
- Provides instructions for clearing Supabase Auth email rate limits

**When to use:**
- Hit "email rate limit exceeded" during registration testing
- Need to test OTP flow multiple times quickly
- Want to reset development database state

---

### 🗑️ Delete Test Users
Permanently delete all test users and their data.

```bash
npm run dev:delete-users
```

**What it does:**
- Lists all users in the database
- Asks for confirmation (`DELETE ALL`)
- Deletes all auth users and cascading data (gyms, plan_types, etc.)

**When to use:**
- Clean up after testing registration
- Reset database to fresh state
- Free up email addresses for re-testing

**⚠️ WARNING:** This is irreversible! Only use in development.

---

## Setup Requirements

Both scripts require a valid `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### Getting Your Service Role Key

1. Go to: https://app.supabase.com/project/[your-project]/settings/api
2. Click the **"Legacy API Keys"** tab (or "API Keys" for new format)
3. Copy the **service_role** key (NOT the anon key)
4. Add to `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-actual-service-role-key
```

**Important:**
- The service_role key is different from the anon key
- It has elevated privileges and bypasses RLS
- Never commit this to source control
- Never expose it in client-side code

---

## Troubleshooting

### "Missing Supabase credentials"
✅ Make sure `.env.local` has both:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### "Failed to clear OTP tokens"
✅ Check that the `otp_tokens` table exists in your database

### "Failed to delete users"
✅ Verify your service_role key is correct (not the anon key)

---

## Manual Alternatives

### Manually Clear Auth Rate Limits
If scripts don't work, you can disable email confirmations temporarily:

1. Go to: https://app.supabase.com/project/[your-project]/auth/providers
2. Disable "Enable email confirmations"
3. Test registration
4. Re-enable after testing

### Manually Delete Users via Supabase Dashboard
1. Go to: https://app.supabase.com/project/[your-project]/auth/users
2. Select users
3. Click "Delete selected users"
