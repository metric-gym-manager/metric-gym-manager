# Manual scripts

One-off operational/debug scripts run by hand — **not** wired into `package.json`,
CI, or any automated flow. Read a script before running it.

⚠️ **Cautions**
- Several target **live endpoints** (`http://localhost:3000/api/...`) or a real
  database and may **create or mutate data**.
- Some embed **hardcoded IDs / phone numbers** from a specific environment —
  review and edit before use; do not assume they point at your data.
- Never commit real member data (names, phone numbers) alongside these scripts.

| Script | Purpose |
|---|---|
| `test-reminder.js` | Hit the local `send-reminders` cron endpoint and print the result |
| `test-welcome-sms.js` | POST a member to the local API to trigger a welcome SMS |
| `create-test-member.js` | Create a throwaway member for manual testing |
| `identify-gym.js` | Look up gym details (may contain a hardcoded gym id) |
| `backfill-initial-payments.ts` | One-off data backfill of initial payment rows |
