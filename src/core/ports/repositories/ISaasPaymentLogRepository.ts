/**
 * SaaS Payment Log Repository Interface (Port)
 *
 * Audit log + idempotency anchor for PayHere webhook notifications, and the
 * authoritative source for the gym-facing billing history UI (plan C-12).
 */

export interface SaasPaymentLogInput {
  gymId: string | null;
  orderId: string | null;
  payherePaymentId: string;
  payhereSubscriptionId: string | null;
  statusCode: number;
  signatureValid: boolean;
  /** Recurring message_type, promoted column for classification (plan C-22) */
  messageType: string | null;
  /** Free-text PayHere status_message, admin-only surface */
  statusMessage: string | null;
  /** Full notification body. md5sig MUST be redacted before insert (plan C-24). */
  rawPayload: Record<string, string>;
}

export interface SaasPaymentLogRow {
  id: string;
  gymId: string | null;
  orderId: string | null;
  payherePaymentId: string | null;
  payhereSubscriptionId: string | null;
  statusCode: number;
  signatureValid: boolean;
  messageType: string | null;
  statusMessage: string | null;
  rawPayload: Record<string, string>;
  processedAt: Date;
}

export interface ISaasPaymentLogRepository {
  /**
   * Insert keyed on payhere_payment_id (idempotency anchor).
   *
   * @returns false when the payment id already exists (duplicate delivery), true when inserted
   */
  insertIfNew(input: SaasPaymentLogInput): Promise<boolean>;

  /**
   * Best-effort audit insert for signature-invalid / unattributable posts
   * (payment id may be absent). Never throws. Enforces the
   * INVALID_WEBHOOK_LOG_HOURLY_CAP global hourly cap (plan C-20): beyond the
   * cap the insert is skipped and a single console.warn is emitted.
   */
  insertInvalid(input: Omit<SaasPaymentLogInput, 'payherePaymentId'> & {
    payherePaymentId: string | null;
  }): Promise<void>;

  /**
   * Admin failures view (status_code < 2 OR signature_valid = false), newest first.
   */
  listFailures(limit: number, offset: number): Promise<{ rows: SaasPaymentLogRow[]; totalCount: number }>;

  /**
   * Gym-facing billing history, newest first (signature-valid rows only).
   */
  listByGym(gymId: string, page: number, limit: number): Promise<{ rows: SaasPaymentLogRow[]; totalCount: number }>;

  /**
   * Latest signature-valid failure row for a gym (feeds pastDueReason, plan C-22).
   */
  findLatestFailure(gymId: string): Promise<SaasPaymentLogRow | null>;
}
