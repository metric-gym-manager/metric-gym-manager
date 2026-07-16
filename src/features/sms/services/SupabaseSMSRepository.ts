/**
 * Supabase SMS Repository Implementation
 *
 * Implements ISMSRepository using Supabase for SMS log storage.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ISMSRepository,
  type SMSLog,
  type CreateSMSLogProps,
  type SMSFilters,
  SMSDeliveryStatus,
  type SMSType,
} from '@/features/sms/services/ISMSRepository';

/**
 * Database row interface (snake_case from Supabase)
 */
interface SMSLogRow {
  id: string;
  member_id: string;
  gym_id: string;
  sms_type: string;
  phone_number: string;
  message_body: string;
  sent_at: string;
  delivery_status: string;
  text_lk_message_id: string | null;
  error_message: string | null;
}

/**
 * Supabase SMS Repository
 *
 * @example
 * const supabase = await createClient();
 * const smsRepo = new SupabaseSMSRepository(supabase);
 *
 * const log = await smsRepo.create({
 *   memberId: 'member-123',
 *   gymId: 'gym-456',
 *   smsType: 'receipt',
 *   phoneNumber: '+94771234567',
 *   messageBody: 'Payment received!',
 *   sentAt: new Date(),
 *   deliveryStatus: SMSDeliveryStatus.Sent,
 *   textLkMessageId: 'msg-789',
 *   errorMessage: null
 * });
 */
export class SupabaseSMSRepository implements ISMSRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Find SMS log by ID
   */
  async findById(id: string): Promise<SMSLog | null> {
    const { data, error } = await this.supabase
      .from('sms_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to find SMS log: ${error.message}`);
    }

    return data ? this.toDomain(data) : null;
  }

  /**
   * Find all SMS logs for a member
   */
  async findByMemberId(memberId: string): Promise<SMSLog[]> {
    const { data, error } = await this.supabase
      .from('sms_logs')
      .select('*')
      .eq('member_id', memberId)
      .order('sent_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch SMS logs for member: ${error.message}`);
    }

    return (data || []).map((row) => this.toDomain(row));
  }

  /**
   * Find all SMS logs with filters
   */
  async findAll(filters: SMSFilters): Promise<SMSLog[]> {
    const { gymId, memberId, smsType, deliveryStatus, startDate, endDate, page = 1, limit = 50 } = filters;

    let query = this.supabase
      .from('sms_logs')
      .select('*')
      .eq('gym_id', gymId);

    // Apply filters
    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    if (smsType) {
      query = query.eq('sms_type', smsType);
    }

    if (deliveryStatus) {
      query = query.eq('delivery_status', deliveryStatus);
    }

    if (startDate) {
      query = query.gte('sent_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('sent_at', endDate.toISOString());
    }

    // Order by sent date (newest first)
    query = query.order('sent_at', { ascending: false });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch SMS logs: ${error.message}`);
    }

    return (data || []).map((row) => this.toDomain(row));
  }

  /**
   * Create a new SMS log entry
   */
  async create(log: CreateSMSLogProps): Promise<SMSLog> {
    const row = this.toDatabase(log);

    const { data, error } = await this.supabase
      .from('sms_logs')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create SMS log: ${error.message}`);
    }

    return this.toDomain(data);
  }

  /**
   * Check if SMS was already sent today
   */
  async existsForToday(memberId: string, smsType: SMSType): Promise<boolean> {
    // Get today's start (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    const { data, error } = await this.supabase
      .from('sms_logs')
      .select('id')
      .eq('member_id', memberId)
      .eq('sms_type', smsType)
      .gte('sent_at', todayStart)
      .limit(1)
      .single();

    if (error) {
      // PGRST116 means no rows found
      if (error.code === 'PGRST116') {
        return false;
      }
      throw new Error(`Failed to check SMS existence: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Get SMS count by type for a gym
   */
  async countByType(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<SMSType, number>> {
    const { data, error } = await this.supabase
      .from('sms_logs')
      .select('sms_type')
      .eq('gym_id', gymId)
      .gte('sent_at', startDate.toISOString())
      .lte('sent_at', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to count SMS by type: ${error.message}`);
    }

    // Count each type
    const counts: Record<string, number> = {};
    (data || []).forEach((row) => {
      const type = row.sms_type;
      counts[type] = (counts[type] || 0) + 1;
    });

    return counts as Record<SMSType, number>;
  }

  /**
   * Get failed SMS logs
   */
  async getFailedMessages(gymId: string, limit: number = 50): Promise<SMSLog[]> {
    const { data, error } = await this.supabase
      .from('sms_logs')
      .select('*')
      .eq('gym_id', gymId)
      .eq('delivery_status', SMSDeliveryStatus.Failed)
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch failed SMS logs: ${error.message}`);
    }

    return (data || []).map((row) => this.toDomain(row));
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(
    messageId: string,
    status: SMSDeliveryStatus
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sms_logs')
      .update({
        delivery_status: status,
      })
      .eq('text_lk_message_id', messageId);

    if (error) {
      throw new Error(`Failed to update delivery status: ${error.message}`);
    }
  }

  /**
   * Get SMS stats for dashboard
   */
  async getStats(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    byType: Record<SMSType, number>;
  }> {
    const { data, error } = await this.supabase
      .from('sms_logs')
      .select('sms_type, delivery_status')
      .eq('gym_id', gymId)
      .gte('sent_at', startDate.toISOString())
      .lte('sent_at', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to get SMS stats: ${error.message}`);
    }

    // Calculate stats
    let totalSent = 0;
    let totalDelivered = 0;
    let totalFailed = 0;
    const byType: Record<string, number> = {};

    (data || []).forEach((row) => {
      totalSent++;

      if (row.delivery_status === SMSDeliveryStatus.Delivered) {
        totalDelivered++;
      } else if (row.delivery_status === SMSDeliveryStatus.Failed) {
        totalFailed++;
      }

      const type = row.sms_type;
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      byType: byType as Record<SMSType, number>,
    };
  }

  // ============================================================
  // MAPPING METHODS (Private)
  // ============================================================

  /**
   * Map database row to domain entity
   */
  private toDomain(row: SMSLogRow): SMSLog {
    return {
      id: row.id,
      memberId: row.member_id,
      gymId: row.gym_id,
      smsType: row.sms_type as SMSType,
      phoneNumber: row.phone_number,
      messageBody: row.message_body,
      sentAt: new Date(row.sent_at),
      deliveryStatus: row.delivery_status as SMSDeliveryStatus,
      textLkMessageId: row.text_lk_message_id,
      errorMessage: row.error_message,
    };
  }

  /**
   * Map domain props to database row
   */
  private toDatabase(props: CreateSMSLogProps): Omit<SMSLogRow, 'id'> {
    return {
      member_id: props.memberId,
      gym_id: props.gymId,
      sms_type: props.smsType,
      phone_number: props.phoneNumber,
      message_body: props.messageBody,
      sent_at: props.sentAt.toISOString(),
      delivery_status: props.deliveryStatus,
      text_lk_message_id: props.textLkMessageId,
      error_message: props.errorMessage,
    };
  }
}
