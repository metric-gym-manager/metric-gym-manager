# SMS Error Logging Pattern (§2.7)

> On-demand reference. Not auto-injected.
> **Rule:** Every SMS send logs success and failure to the DB. No silent fire-and-forget.

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
// src/core/use-cases/payment/CollectPayment.ts
export class CollectPayment {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly smsProvider: ISMSProvider,
    private readonly smsRepo: ISMSRepository  // Add this dependency
  ) {}
}
```

**Step 3: Implement Comprehensive Error Logging**

```typescript
// src/core/use-cases/payment/CollectPayment.ts
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

**Step 4: Update Dependency Injection Container**

```typescript
// src/infrastructure/di/Container.ts
export class Container {
  getCollectPaymentUseCase(): CollectPayment {
    return new CollectPayment(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository()  // Wire up SMS repository
    );
  }

  getRegisterMemberUseCase(): RegisterMember {
    return new RegisterMember(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository()  // Wire up SMS repository
    );
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
  ROUND(100.0 * COUNT(*) FILTER (WHERE delivery_status = 'sent') / COUNT(*), 2) as success_rate
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
