# Lead notification (demo requests)

> On-demand reference. Not auto-injected.

A demo request from the public site (`DemoModal` → `POST /api/public/leads`) is stored in `leads` and then **emailed to hello@metricgymos.com** (owner decision, 2026-10-05). Before this, a stored request was seen by nobody: no screen lists leads.

## How it works

- `SubmitLead` (`features/leads/services/SubmitLead.ts`) stores the lead, then **awaits** the email. A serverless function can be frozen once it has responded, which is how welcome texts were lost before they were awaited.
- The outcome is written to the row: `notified_at` when sent, `notification_error` (at most 500 characters) when not. **A failed email never fails the request.** The lead is already stored, and the visitor still gets the thank-you.
- `SmtpLeadNotifier` builds the message:
  - From: `Metric Gym OS <noreply@metricgymos.com>`;
  - To: `hello@metricgymos.com`;
  - **Reply-To: the visitor**, so replying from hello@ reaches them;
  - Subject: `Demo request: <name> (<gym>)`, with line breaks stripped;
  - plain-text body with every field, the plan label, the Sri Lanka time and the lead id.
- `lib/email/smtp.ts` is the SMTP glue (nodemailer): `smtp.gmail.com:465`, logging in as `SMTP_USER` with the app password `SMTP_PASS`, with bounded timeouts. Without either variable there is no mailer, and the outcome reads "Email not configured".
- The recording update uses `.select('id')` and requires exactly one row, so an update that matched nothing cannot pass for a write (rule 2.7's `sms_logs` lesson).

## The sender

The same Google Workspace account Supabase Auth uses: `admin@capitalistone.co`. It was renamed from `root@`, which is why auth email failed with 535 until 2026-10-05. Mail goes out as the verified alias `noreply@metricgymos.com`, so SPF, DKIM and DMARC pass as they do for auth email (`supabase/config.toml` records that setup). `hello@metricgymos.com` is an alias of the same account.

## Finding unsent leads

```sql
SELECT created_at, name, email, interest, notification_error
FROM leads
WHERE notified_at IS NULL
ORDER BY created_at DESC;
```

Rows with neither column set were stored before 2026-10-05.
