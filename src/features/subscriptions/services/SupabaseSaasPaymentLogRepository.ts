/**
 * Supabase implementation of ISaasPaymentLogRepository.
 *
 * insertIfNew is the webhook idempotency anchor (unique partial index on
 * payhere_payment_id). insertInvalid is the capped, never-throwing audit
 * path for signature-invalid/unattributable posts (plan C-20: global hourly
 * cap counted index-only via idx_saas_payment_logs_invalid_sig).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ISaasPaymentLogRepository,
  SaasPaymentLogInput,
  SaasPaymentLogRow,
} from './ISaasPaymentLogRepository';
import { INVALID_WEBHOOK_LOG_HOURLY_CAP } from '@/features/subscriptions/config/SubscriptionConfig';
import { DatabaseError } from '@/utils/errors';

interface DbRow {
  id: string;
  gym_id: string | null;
  order_id: string | null;
  payhere_payment_id: string | null;
  payhere_subscription_id: string | null;
  status_code: number;
  signature_valid: boolean;
  message_type: string | null;
  status_message: string | null;
  raw_payload: Record<string, string>;
  processed_at: string;
}

const UNIQUE_VIOLATION = '23505';

export class SupabaseSaasPaymentLogRepository implements ISaasPaymentLogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private toDomain(row: DbRow): SaasPaymentLogRow {
    return {
      id: row.id,
      gymId: row.gym_id,
      orderId: row.order_id,
      payherePaymentId: row.payhere_payment_id,
      payhereSubscriptionId: row.payhere_subscription_id,
      statusCode: row.status_code,
      signatureValid: row.signature_valid,
      messageType: row.message_type,
      statusMessage: row.status_message,
      rawPayload: row.raw_payload,
      processedAt: new Date(row.processed_at),
    };
  }

  private toInsertRow(input: SaasPaymentLogInput | (Omit<SaasPaymentLogInput, 'payherePaymentId'> & { payherePaymentId: string | null })) {
    return {
      gym_id: input.gymId,
      order_id: input.orderId,
      payhere_payment_id: input.payherePaymentId,
      payhere_subscription_id: input.payhereSubscriptionId,
      status_code: input.statusCode,
      signature_valid: input.signatureValid,
      message_type: input.messageType,
      status_message: input.statusMessage,
      raw_payload: input.rawPayload,
    };
  }

  async insertIfNew(input: SaasPaymentLogInput): Promise<boolean> {
    const { error } = await this.supabase
      .from('saas_payment_logs')
      .insert(this.toInsertRow(input));

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return false; // duplicate delivery — idempotent no-op
      }
      throw new DatabaseError(`Failed to log payment notification: ${error.message}`);
    }
    return true;
  }

  async insertInvalid(
    input: Omit<SaasPaymentLogInput, 'payherePaymentId'> & { payherePaymentId: string | null }
  ): Promise<void> {
    try {
      // C-20 global hourly cap: exact predicate of idx_saas_payment_logs_invalid_sig
      // so the count plans index-only and stays bounded (~cap rows) under flood.
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await this.supabase
        .from('saas_payment_logs')
        .select('id', { count: 'exact', head: true })
        .eq('signature_valid', false)
        .gt('processed_at', oneHourAgo);

      if (countError) {
        console.warn('saas_payment_logs invalid-audit cap check failed:', countError.message);
        return;
      }
      if ((count ?? 0) >= INVALID_WEBHOOK_LOG_HOURLY_CAP) {
        console.warn(
          `saas_payment_logs invalid-audit hourly cap (${INVALID_WEBHOOK_LOG_HOURLY_CAP}) reached — skipping audit insert`
        );
        return;
      }

      const { error } = await this.supabase
        .from('saas_payment_logs')
        .insert(this.toInsertRow(input));
      if (error && error.code !== UNIQUE_VIOLATION) {
        console.warn('saas_payment_logs invalid-audit insert failed:', error.message);
      }
    } catch (e) {
      // Best-effort by contract: never throw from the invalid-audit path
      console.warn(
        'saas_payment_logs invalid-audit unexpected failure:',
        e instanceof Error ? e.message : e
      );
    }
  }

  async listFailures(
    limit: number,
    offset: number
  ): Promise<{ rows: SaasPaymentLogRow[]; totalCount: number }> {
    const { data, error, count } = await this.supabase
      .from('saas_payment_logs')
      .select('*', { count: 'exact' })
      .or('status_code.lt.2,signature_valid.eq.false')
      .order('processed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError(`Failed to list billing failures: ${error.message}`);
    }
    return { rows: (data as DbRow[]).map((r) => this.toDomain(r)), totalCount: count ?? 0 };
  }

  async listByGym(
    gymId: string,
    page: number,
    limit: number
  ): Promise<{ rows: SaasPaymentLogRow[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    const { data, error, count } = await this.supabase
      .from('saas_payment_logs')
      .select('*', { count: 'exact' })
      .eq('gym_id', gymId)
      .eq('signature_valid', true)
      .order('processed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError(`Failed to list billing history: ${error.message}`);
    }
    return { rows: (data as DbRow[]).map((r) => this.toDomain(r)), totalCount: count ?? 0 };
  }

  async findLatestFailure(gymId: string): Promise<SaasPaymentLogRow | null> {
    const { data, error } = await this.supabase
      .from('saas_payment_logs')
      .select('*')
      .eq('gym_id', gymId)
      .eq('signature_valid', true)
      .lt('status_code', 2)
      .order('processed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to load latest billing failure: ${error.message}`);
    }
    return data ? this.toDomain(data as DbRow) : null;
  }
}
