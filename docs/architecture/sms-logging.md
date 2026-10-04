# SMS Error Logging Pattern (§2.7)

> On-demand reference. Not auto-injected.
> **Rule:** Every SMS send logs success and failure to the DB. No silent fire-and-forget.

> **Updated 2026-09-05.** Two corrections after an audit of this exact path.
>
> **1. The code samples below predate the feature-first refactor.** They named
> `src/core/use-cases/…` and `src/infrastructure/di/Container.ts`, layers R1 now
> forbids and that no longer exist. Paths are corrected in place; the pattern
> they teach — inject `ISMSRepository`, await the write, record `error_message`
> — is unchanged and correct.
>
> **2. `sms_logs` has exactly one writer: `SupabaseSMSRepository`.** Do not add a
> second. Until 2026-09-05 there were four, and the drift between them was the
> defect: `announcements` inserted with `void supabase.from('sms_logs').insert()`
> — literally the fire-and-forget this rule forbids, comment and all — and
> neither it nor `sms.service` recorded `error_message`, so 5 of 14 production
> failures had no reason attached. Log through the repository, from a use case,
> awaited.
>
> **3. Writes need a service-role client.** The table has SELECT and INSERT
> policies and **no UPDATE policy**, so a session client's update is refused by
> RLS — and PostgREST reports _no error_ for an update that matched no rows. The
> delivery webhook therefore logged success and returned 200 while changing
> nothing, for every receipt the vendor sent over seven months. `ISMSRepository.
updateDeliveryStatus` returns rows-affected precisely so that a no-op cannot
> be mistaken for a write. See `docs/architecture/sms-delivery-tracking.md`.

> **Updated 2026-10-03.** Two more changes on the send side.
>
> **1. Registration now awaits the welcome SMS.** `RegisterMember` sent it
> fire-and-forget (`this.sendWelcomeSMS(...).catch(...)`). On Vercel the
> function can be frozen once the response is sent, and about a third of
> registrations had no `welcome` row in `sms_logs`: 15 of 46 registrations at
> customer gyms between 2026-08-19 and 2026-10-03 (test gyms left out, as they
> register through mock SMS). The desk, bulk and QR
> routes all run this use case. It now follows `CollectPayment`:
> `try { await this.sendWelcomeSMS(...) } catch { console.error }`, so the
> send and its log row complete before `execute()` returns, and a failed SMS
> still never fails the registration.
>
> With that change, every automated send path awaits its send and its log
> write: welcome, receipt, welcome back, day pass and the four reminders.
> **Correction, 2026-10-04:** until that date a _failed_ reminder was never
> logged. `SendAutomatedReminders.sendReminder` threw before its insert, so
> its `failed` branch was dead code. It now logs `failed` with the reason
> before re-throwing, and `existsForToday` counts only rows that did not fail,
> so a same-day re-run still retries the member. The welcome, receipt and
> day-pass senders now also build their text inside the `try`: a template
> that throws is logged as `failed` (with an empty `message_body`), never a
> silently skipped text. `RegisterMember.test.ts` pins the welcome path. Its provider resolves on a
> `setTimeout` tick, so an un-awaited send fails the suite. Past
> registrations were **not** backfilled: whether those texts went out is
> unknown, and a row written now would invent a record.
>
> **Gyms that must never be texted (2026-10-04).** `SMS_DISABLED_GYM_IDS`
> (comma-separated gym ids, set in Vercel) is enforced in `sendSmsViaTextLk`,
> the one function every real text passes through. `gymId` is a required field
> of `SendSmsParams` and `SMSMessage`, so no caller can skip the check. A
> refused text returns `SMS disabled for this gym`, which the caller logs as
> `failed`. The reminders cron skips those gyms up front so they leave no daily
> failed rows. It exists for the E2E test gyms: they live in production with
> valid-format seeded numbers, and the cron sent them 310 real texts.
>
> **Announcements have their own type (2026-10-04).** `announcement.service`
> logged every announcement as `welcome`, because `sms_type` had no value for
> it. 401 announcement texts therefore sat in members' histories as welcomes:
> 50 real ones in one gym, and 351 mock-mode rows in an E2E gym. The member
> history screen, meanwhile, labelled every `welcome` row "Announcement".
> Migration `20261004000001` adds `announcement`, and `20261004000002`
> relabels the old rows. A welcome always starts "Welcome" and names one
> member; an announcement's body is shared across members. Both signatures
> selected the same 401 rows. The enum contract (`supabase/expected-enums.json`,
> `enum-parity.test.ts`, `npm run db:audit`) carries the value on all three
> sides. Announcement _sends_ are still fire-and-forget: see HANDOFF §6.
>
> **2. Every automated text comes from one template module**,
> `src/features/sms/config/SmsTemplates.ts`, and names the gym (SEO-053). The
> sender ID is platform-wide, so the text is the only place a member learns
> which gym is writing. Do not build message strings in a use case.
> `messageBody` in the log is exactly the text the provider was given.
>
> Known gap: the text.lk provider has no request timeout. A hung gateway now
> holds a registration, as it already held a payment.

---

### 2.7 SMS Error Logging Pattern

**CRITICAL RULE**: All SMS sending operations MUST log both success and failure outcomes to the database to eliminate silent failures and provide complete audit trails.

#### ❌ WRONG: Fire-and-Forget with Console Logging Only

```typescript
// ❌ NEVER implement SMS sending with only console logging
private async sendReceiptSMS(member: Member, amount: number): Promise<void> {
  try {
    const message = this.generateMessage(member, amount);
    const result = await this.smsProvider.send({
      to: member.phoneNumber,
      message,
    });

    if (!result.success) {
      console.error('Receipt SMS failed:', result.error);
      // TODO: Log to monitoring service
    }
  } catch (error) {
    console.error('Exception sending receipt SMS:', error);
    // Don't throw - this is a non-critical operation
  }
}
```

**Problems**:

- SMS failures only visible in platform logs (Vercel, etc.)
- No database tracking of delivery status
- Cannot query failed SMS for retry or analysis
- Members don't know if critical messages weren't delivered
- Debugging requires searching through raw logs

#### ✅ CORRECT: Comprehensive Database Logging

**Step 1: Ensure Database Schema Has error_message Column**

```sql
-- supabase/migrations/YYYYMMDD_add_error_message_to_sms_logs.sql
ALTER TABLE sms_logs
ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN sms_logs.error_message IS 'Error message from SMS provider if delivery failed (NULL for successful deliveries)';
```

**Step 2: Add ISMSRepository Dependency to Use Case**

```typescript
// src/features/payments/services/CollectPayment.ts
export class CollectPayment {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly smsProvider: ISMSProvider,
    private readonly smsRepo: ISMSRepository // Add this dependency
  ) {}
}
```

**Step 3: Implement Comprehensive Error Logging**

```typescript
// src/features/payments/services/CollectPayment.ts
private async sendReceiptSMS(
  member: Member,
  amountPaid: number,
  nextDueDate: Date,
  discount?: DiscountInfo | null
): Promise<void> {
  const message = this.generateReceiptMessage(member, amountPaid, nextDueDate, discount);

  try {
    // Send SMS
    const result = await this.smsProvider.send({
      to: member.phoneNumber,
      message,
    });

    if (result.success) {
      // Log successful SMS to database
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType: 'receipt',
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: SMSDeliveryStatus.Sent,
        textLkMessageId: result.messageId || null,
        errorMessage: null,  // NULL for success
      });
    } else {
      // Log failed SMS to database with error message
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType: 'receipt',
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: SMSDeliveryStatus.Failed,
        textLkMessageId: null,
        errorMessage: result.error || 'Unknown error',  // Capture provider error
      });
      console.error('Receipt SMS failed:', result.error);
    }
  } catch (error) {
    // Log exception to database
    try {
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType: 'receipt',
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: SMSDeliveryStatus.Failed,
        textLkMessageId: null,
        errorMessage: error instanceof Error ? error.message : 'Exception sending SMS',
      });
    } catch (logError) {
      console.error('Failed to log SMS failure:', logError);
      // Last resort: at least console log the original error
    }
    console.error('Exception sending receipt SMS:', error);
    // Don't throw - this is a non-critical operation
  }
}
```

**Step 4: Wire it in the feature's factory**

```typescript
// src/features/payments/services/factory.ts — the DI container was dissolved in
// the 2026-07 feature-first refactor (R1/R7). Composition lives in each
// feature's factory.ts and takes the Supabase client the caller chose.
export class Container {
  getCollectPaymentUseCase(): CollectPayment {
    return new CollectPayment(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository() // Wire up SMS repository
    )
  }

  getRegisterMemberUseCase(): RegisterMember {
    return new RegisterMember(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository() // Wire up SMS repository
    )
  }
}
```

#### Benefits of This Pattern

1. **Complete Audit Trail**: Every SMS attempt logged with timestamp, status, and error details
2. **Failure Visibility**: Failed SMS visible in database queries and admin UI
3. **Debugging**: Error messages from SMS provider captured for troubleshooting
4. **Retry Capability**: Failed SMS can be identified and retried
5. **Historical Analysis**: Query patterns like "How many SMS failed last month?"
6. **Provider Accountability**: Track SMS provider reliability and error types

#### Querying SMS Logs

```sql
-- Get all failed SMS in last 7 days
SELECT
  member_id,
  sms_type,
  phone_number,
  sent_at,
  error_message
FROM sms_logs
WHERE delivery_status = 'failed'
  AND sent_at > NOW() - INTERVAL '7 days'
ORDER BY sent_at DESC;

-- Calculate SMS success rate by type
SELECT
  sms_type,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE delivery_status = 'sent') as successes,
  COUNT(*) FILTER (WHERE delivery_status = 'failed') as failures,
  -- 'delivered' is the carrier-confirmed state; 'sent' only means the provider
  -- accepted it, and 'pending' that it has not yet reached the carrier.
  ROUND(100.0 * COUNT(*) FILTER (WHERE delivery_status = 'delivered') / COUNT(*), 2) as delivered_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE delivery_status = 'failed') / COUNT(*), 2) as failure_rate
FROM sms_logs
WHERE sent_at > NOW() - INTERVAL '30 days'
GROUP BY sms_type
ORDER BY success_rate ASC;

-- Find members with failed welcome SMS (need manual follow-up)
SELECT DISTINCT
  m.id,
  m.name,
  m.phone_number,
  s.error_message,
  s.sent_at
FROM members m
JOIN sms_logs s ON m.id = s.member_id
WHERE s.sms_type = 'welcome'
  AND s.delivery_status = 'failed'
  AND m.registered_date > NOW() - INTERVAL '7 days'
ORDER BY s.sent_at DESC;
```

#### When to Use This Pattern

- ✅ All SMS sending operations (welcome, receipt, reminders)
- ✅ Critical notifications that members must receive
- ✅ Any fire-and-forget async operations with external dependencies
- ✅ Operations where failure would be silent without logging

#### When NOT to Use This Pattern

- ❌ Email sending (use dedicated email logging pattern)
- ❌ Internal notifications (use different logging mechanism)
- ❌ Operations that already have comprehensive error handling

---

---
