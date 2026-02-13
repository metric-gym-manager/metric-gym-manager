# Environment Variables Setup Guide

This guide will help you fill in the values in your `.env.local` file.

## 📋 Required Variables

### 1. Supabase Configuration

**Where to find these values:**
1. Go to https://app.supabase.com
2. Select your project
3. Go to **Project Settings** (gear icon) → **API**

```env
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
```
- Copy the **Project URL** value

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- Copy the **anon** **public** key (under "Project API keys")
- This is safe to expose in the browser

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- Copy the **service_role** **secret** key
- ⚠️ **CRITICAL**: Never expose this in browser code or commit to Git
- This key bypasses Row Level Security

---

### 2. Application Settings

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
```
- For local development: `http://localhost:3001` (or whatever port your app runs on)
- For production: `https://your-domain.vercel.app`

```env
NODE_ENV=development
```
- Keep as `development` for local development
- Vercel automatically sets this to `production` when deployed

---

### 3. Feature Flags

```env
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```
- Set to `true` if you want to enable analytics tracking
- Keep as `false` for now

```env
ENABLE_REAL_SMS=false
```
- Set to `false` to use **mock SMS** (logs to console, no real SMS sent)
- Set to `true` when you have text.lk credentials and want to send real SMS
- **Recommended**: Keep as `false` until you're ready to go live

---

### 4. Cron Secret (Required)

```env
CRON_SECRET=your-cron-secret-key-here
```

**How to generate:**
1. Open a terminal (Git Bash, PowerShell, or Command Prompt)
2. Run one of these commands:

**Git Bash / Linux / Mac:**
```bash
openssl rand -base64 32
```

**PowerShell (Windows):**
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

**Online Generator (if openssl not available):**
- Go to https://generate-random.org/api-token-generator
- Generate a 32-character token
- Use that value

3. Copy the generated string and paste it as your `CRON_SECRET`

**Example output:**
```
Xk8f2Jm9Lp4Qr7Nt5Wv3Zx1Cy6Bh0Dg8Af=
```

---

## 🔐 Optional: SMS Provider (text.lk)

**Only required if you set `ENABLE_REAL_SMS=true`**

### Getting text.lk API Credentials

1. **Sign up for text.lk:**
   - Go to https://www.text.lk
   - Create an account
   - Purchase SMS credits

2. **Get your API key:**
   - Login to text.lk dashboard
   - Go to API section
   - Copy your API key

3. **Get your Sender ID:**
   - Request a Sender ID approval from text.lk
   - This is the name that appears as the sender (e.g., "YourGym")
   - Usually takes 1-2 business days for approval

4. **Add to .env.local:**
```env
TEXT_LK_API_KEY=your-textlk-api-key-here
TEXT_LK_SENDER_ID=YourGymName
```

**For now, keep `ENABLE_REAL_SMS=false` and test with mock SMS!**

---

## 🗄️ Optional: Database Direct Connection

**Only needed if you want to run migrations directly or use a database GUI**

```env
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Where to find this:**
1. Go to Supabase Dashboard → **Project Settings** → **Database**
2. Scroll to **Connection string** → **URI**
3. Copy the connection string
4. Replace `[YOUR-PASSWORD]` with your database password

**Example:**
```
postgresql://postgres:mySecretPassword@db.abcdefghijklmnop.supabase.co:5432/postgres
```

---

## ✅ Verification Checklist

After filling in all values, verify your setup:

### 1. Check Required Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set (long JWT token)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (long JWT token)
- [ ] `CRON_SECRET` is generated and set

### 2. Test the Connection
1. Restart your dev server:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

2. Open http://localhost:3001
3. Try to register a new account
4. If it works, your Supabase connection is correct! ✅

### 3. Check Console Output
When you perform actions (add member, collect payment, etc.), you should see:
- Mock SMS logs in the console (if `ENABLE_REAL_SMS=false`)
- Database queries working without errors

---

## 🚨 Security Reminders

1. **Never commit `.env.local` to Git**
   - It's already in `.gitignore`
   - Contains sensitive secrets

2. **Never expose `SUPABASE_SERVICE_ROLE_KEY`**
   - Only use on the server side
   - Never send to browser/client

3. **Regenerate secrets if exposed**
   - If you accidentally commit secrets, regenerate them in Supabase
   - Generate a new `CRON_SECRET`

4. **Use different secrets for production**
   - Development and production should have different values
   - Configure production secrets in Vercel dashboard

---

## 📝 Example Filled .env.local

Here's what your file should look like (with fake values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDAwMDAwMCwiZXhwIjoxOTU1NTc2MDAwfQ.example-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NzYwMDB9.example-service-role-key

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3001
NODE_ENV=development

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
ENABLE_REAL_SMS=false

# Cron Jobs
CRON_SECRET=Xk8f2Jm9Lp4Qr7Nt5Wv3Zx1Cy6Bh0Dg8Af=
```

---

## 🆘 Troubleshooting

### Issue: "Invalid API key" or "Failed to fetch"
**Solution:** Double-check your Supabase URL and keys are correct

### Issue: "Unauthorized" errors
**Solution:** Make sure you've applied all database migrations in Supabase

### Issue: App not loading
**Solution:** Check the browser console for errors, ensure the dev server is running

### Issue: Can't find Supabase keys
**Solution:**
1. Go to https://app.supabase.com
2. Select your project (or create one if you haven't)
3. Settings (gear icon) → API

---

## 🚀 Ready to Go!

Once your `.env.local` is configured:
1. Restart the dev server
2. Open http://localhost:3001
3. Start testing!

If you run into any issues, check the console output for error messages.
