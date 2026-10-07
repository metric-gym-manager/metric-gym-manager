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

### 💾 Backup Supabase (pre-refactor safety net)

Create a timestamped local copy of your remote Supabase database (schema + data + auth).

```bash
npm run backup:supabase
```

**Prerequisites:**

1. Add `SUPABASE_DB_URL` to `.env.local` (see `.env.example`)
   - Supabase Dashboard → **Project Settings** → **Database** → **Connection string** (URI, direct)
2. Or link the project: `npx supabase login` then `npx supabase link --project-ref <ref>`, then run:
   ```bash
   powershell -ExecutionPolicy Bypass -File scripts/backup-supabase.ps1 -Linked
   ```

**Output:** `backups/supabase/<timestamp>/` (gitignored — may contain production data)

**Includes:**

- `schema.sql` — live remote schema
- `data.sql` — application data
- `auth-data.sql` — auth users/identities
- `migrations/` — copy of repo migrations at backup time

**Not included:** Cloudflare R2 member photos, PayHere config, dashboard auth/SMTP settings.

---

### 🚪 VFT vendor probe (access control)

Read the device serials off a live VFT/ZKTeco account — and check that our
client still understands what that account returns.

```bash
npx tsx scripts/vft-probe.ts
```

**Prerequisites** in `.env.local` (gitignored):

```bash
VFT_API_BASE_URL=https://acccloudlk.com
VFT_PROBE_EMAIL=...        # probe-only; production credentials live per gym,
VFT_PROBE_PASSWORD=...     # encrypted, in access_control_secrets
```

**What it does:** signs in (`POST /api/user/`) through the real
`VftAccessControlProvider`, then issues three `GET`s — `/api/device`,
`/api/template`, `/api/devicecmd`. **Read-only by construction:** it enqueues no
device command, so running it cannot reboot a reader, open a door, or touch a
template.

**Why it prints the payload twice.** `listDevices()` parses with `safeParse` and
returns `[]` on a shape it does not recognise — which, against a live account,
is indistinguishable from "this gym owns no readers". The probe prints the raw
vendor payload beside the parsed result and fails loudly when they disagree.
That is not hypothetical: on its first run it found `"TimeZone": null` emptying
a two-reader account (master §6 V1).

Raw payloads are saved to `backups/vft-probe/<timestamp>.json` (gitignored).
Treat that file as account data — it holds serials and employee names.

---

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

### 📣 Releases and announcement emails

Run by `.github/workflows/release.yml` on every push to master; none needs running by hand.

- `release.js`: cuts a release from the commit types since the last tag (breaking → major, feat → minor, fix/perf → patch), writing `package.json`, `CHANGELOG.md` and the PWA version, then commits and tags. `--dry-run` prints the release it would cut.
- `wait-for-deployment.js <sha>`: waits until Vercel has that commit live in production.
- `trigger-announcements.js`: runs the announcement cron on production and reads its answer. It asks again while an older deployment answers, and fails on any failed email.
- `publish-email-templates.ts`: publishes the two email designs to Resend; `--check` reports drift.
- `check-email-layout.ts` (`npm run email:layout`): renders every email we send at phone and desktop widths in Chromium, and fails when a phone layout breaks; `--shots <dir>` saves the renders, `--compare <dir>` fails if a desktop render moved.
- `send-outreach.ts`: the introduction series to gyms from a CSV (dry run by default; `--import list.csv --apply` takes a list in, `--run --apply` sends the day's batch, `--test you@x --email 1-4` sends one copy to you, `--remove`, `--status`, `--pause "why"` / `--resume` for the safety brake, `--summary [--apply]` for the weekly summary).
- `send-announcements.ts`: the announcement cron by hand. It is a dry run by default and writes the emails to HTML files.

Design: `docs/architecture/marketing-email.md`, "Announcements".

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
