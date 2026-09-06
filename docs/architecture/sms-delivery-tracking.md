# SMS Delivery Tracking

> On-demand reference. Companion to `sms-logging.md` (§2.7), which covers _writing_
> the log. This one covers what happens to a row **after** the send: the delivery
> receipt, the member-facing history, and the constraints that make both work.

---

## 1. What was wrong (audit, 2026-09-05)

The prompt was "the tracking is not very reliable and not robust". It was neither
of those things — it had **never worked once**.

```
sms_logs · 1,151 rows · 2026-02-14 → 2026-09-05

  sent       1,137   the column DEFAULT; every one has a vendor message id
  failed        14   all send-time failures, none has a vendor id
  delivered      0   never, in seven months
```

`delivery_status` defaults to `'sent'`. Every dispatched message was still sitting
on that default, because three independent defects each made the delivery webhook
impossible, and a fourth made the read endpoint impossible.

| #   | Defect                                                                                       | Consequence                                                                       |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | The history read selected **`created_at`**, a column `sms_logs` does not have                | `GET /api/members/[id]/sms-history` returned **500 on every call it ever served** |
| 2   | The delivery update wrote **`updated_at`**, also non-existent                                | PostgREST rejected it; the webhook 500'd and text.lk retried forever              |
| 3   | The update used a **session client** from a webhook, and `sms_logs` has **no UPDATE policy** | RLS refuses the write for any caller                                              |
| 4   | The update ran **without `.select()`**                                                       | PostgREST reports _no error_ for an update matching zero rows                     |

**3 and 4 together are the dangerous part, and they dictate the fix order.** Fixing
the column alone would have stopped the 500s and started a _silent_ failure
instead: the RLS refusal would have looked like success, and the handler would
have logged `✓ Updated SMS … to delivered` while changing nothing. This is the
same class §2.21 records for access control — "an RLS-denied DELETE reports
success having removed nothing".

### Why it drifted

The same two enums were declared in **three** places, none agreeing:

| Declaration                  | `sms_type`                          | `delivery_status`             |
| ---------------------------- | ----------------------------------- | ----------------------------- |
| `types/index.ts`             | 7 values (correct)                  | missing `pending`             |
| `schemas/sms.schemas.ts`     | **5** — no `welcome`/`reactivation` | missing `pending`             |
| `services/ISMSRepository.ts` | 3 values the DB never had           | had `pending`, the DB did not |

`types/index.ts` also declared `SMSLog.created_at`. Nothing type-checked those
declarations against the table — the Supabase clients carry no generated
`Database` generic, so every `.select()` and `.update()` is an unchecked string —
so the phantom column propagated straight into a query. The same class had already
caused two production insert failures, each patched afterwards by a migration
(`welcome` 20260309000001, `reactivation` 20260802000001).

---

## 2. The design now

### One owner per enum

`features/sms/config/SmsConfig.ts` owns `SmsDeliveryStatus` and `SmsType` (R5).
`schemas/`, `types/` and the repository port all derive from it, and Zod validates
with `z.nativeEnum()` rather than a second hand-listed set (rule 2.2). The four
reminder kinds are still owned by `ReminderConfig.ts` and composed in, so a
reminder kind is named in exactly one place.

### One writer

`SupabaseSMSRepository` is the only module that writes `sms_logs`. It declares
`SMS_LOG_COLUMNS` once — the sole place allowed to know the physical schema — and
a narrower `MEMBER_SMS_HISTORY_COLUMNS` for the gym-facing projection.

Before this, four modules wrote the table with different column sets and different
clients. `announcement.service.ts` used `void supabase.from('sms_logs').insert()`
— fire-and-forget, comment and all — so the insert could lose its race with the
end of the request, and its retry path threw _before_ logging, meaning a failed
retry left no trace at all.

### `error_message` never reaches a gym manager

It carries raw provider text. Rule 2.8 keeps that on `/system-health`. The
exclusion is in the **SQL projection**, not a post-fetch delete, so the value never
enters the process that serialises the response.

### The webhook

- **`createAdminClient()`.** Not a policy. `sms_logs` deliberately has no UPDATE
  policy, so no gym can forge a delivery status on its own rows; service-role
  bypasses RLS and is the only correct client (R7).
- **`updateDeliveryStatus` returns rows-affected.** This is the guard against the
  silent-success failure, and the reason the signature is not `Promise<void>`.
- **Terminal states are never regressed.** Vendor webhooks retry and can arrive out
  of order, so a late `SENT` must not downgrade a row already `delivered`.
- **Unknown vendor statuses write nothing.** The old `switch` ended
  `case 'SENT': case 'PENDING': default: → 'sent'`, so any status text.lk added
  later would have been recorded as a successful dispatch.
- **Always 200 for business outcomes** — unknown id, already-terminal row,
  unrecognised status, malformed payload. A retry cannot change any of them.
  Non-2xx is reserved for a bad signature (401) and unexpected exceptions (500).
- **Constant-time signature comparison.** `a !== b` on a hex digest leaks, through
  timing, how many leading characters of a forgery were right.

### `pending` is a real state

Added to the DB enum in `20260905000001`. TypeScript had declared it since the
port was written and Postgres rejected it. The vendor's `PENDING` — accepted, not
yet handed to the carrier — was previously collapsed onto `sent`, which made
"queued" and "dispatched" indistinguishable. In the UI, `pending` is amber and
`sent` is neutral; only `delivered` is green, because only `delivered` is
carrier-confirmed.

---

## 3. Verification (what was actually proved, 2026-09-05)

Unit tests cannot see any of the four original defects: they mock Supabase, so a
column that does not exist and an RLS refusal both look like success. The proof is
end-to-end, against the running app and the real database.

| Check                                | Result                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Signed receipt for a real message id | `{"outcome":"recorded","status":"delivered"}`                              |
| Database after it                    | `sent` → **`delivered`** — the first receipt this system has ever recorded |
| Forged signature                     | 401                                                                        |
| Unknown message id                   | 200 `no_matching_row`                                                      |
| Late `SENT` after `DELIVERED`        | 200 `no_matching_row`; row **still `delivered`**                           |
| Unrecognised status                  | 200 `unknown_status`; nothing written                                      |
| Malformed payload                    | 200 `invalid_payload`                                                      |
| `GET …/sms-history`                  | 200, correct page, no `error_message` in the payload                       |
| Foreign member id                    | 404                                                                        |
| `pageSize=9999`                      | 400                                                                        |

Done on the **seeded E2E gym's test member**, with one synthetic row inserted and
then deleted; `sms_logs` was returned to exactly 1,151 rows.

> **Note for whoever reads the counts next.** `delivered` is back to 0 because the
> verification row was removed, and the 1,137 historical rows can never be
> corrected — their receipts were discarded at the time and text.lk does not
> replay them. The number becomes meaningful only for messages sent from now on.

---

## 4. Traps

1. **The `@/features/sms` barrel is server-tainted.** It re-exports `sms.service`,
   which imports `@/lib/supabase/server` and therefore `next/headers`. A client
   component importing `MemberSmsHistory` from the barrel pulls server-only code
   into the browser bundle and fails the build. Deep-import
   `@/features/sms/components/MemberSmsHistory`. Same hazard rule 2.15 records for
   the auth barrel — and it was hit while building this feature.
2. **Never restore `.update()` without `.select()`** on this table. It is not a
   style preference; it is the difference between a write and a silent no-op.
3. **Never add an UPDATE policy to `sms_logs`** to "fix" a permission error. The
   absence is deliberate. Use the admin client.
4. **`max-width` on a `<td>` is ignored** unless the table is `table-layout:
fixed`. The message column overflowed the member drawer until the truncation
   moved to an inner block — invisible to jsdom, caught by looking at the screen.
