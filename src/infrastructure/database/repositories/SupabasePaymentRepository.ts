/**
 * Supabase Payment Repository Implementation
 *
 * Implements IPaymentRepository using Supabase as the data source.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Payment, PaymentType } from '@/core/domain/payment/Payment';
import {
  IPaymentRepository,
  type PaymentFilters,
  type RevenueByPlanType,
} from '@/core/ports/repositories/IPaymentRepository';
import { PlanType } from '@/core/utils/constants/PlanConfig';

/**
 * Database row interface (snake_case from Supabase)
 */
interface PaymentRow {
  id: string;
  member_id: string;
  gym_id: string;
  payment_date: string;
  amount_paid: number;
  discount_applied: string | null;
  discount_percentage: number | null;
  next_due_date_calculated: string;
  created_at: string;
  payment_type: string;
}

/**
 * Supabase Payment Repository
 *
 * @example
 * const supabase = await createClient();
 * const paymentRepo = new SupabasePaymentRepository(supabase);
 *
 * const payment = Payment.create({ ... });
 * const savedPayment = await paymentRepo.create(payment);
 */
export class SupabasePaymentRepository implements IPaymentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Find payment by ID
   */
  async findById(id: string): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to find payment: ${error.message}`);
    }

    return data ? this.toDomain(data) : null;
  }

  /**
   * Find all payments for a member
   */
  async findByMemberId(memberId: string): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('member_id', memberId)
      .order('payment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch payments for member: ${error.message}`);
    }

    return (data || []).map((row) => this.toDomain(row));
  }

  /**
   * Find all payments with filters
   */
  async findAll(filters: PaymentFilters): Promise<Payment[]> {
    const { gymId, memberId, startDate, endDate, page = 1, limit = 50 } = filters;

    let query = this.supabase
      .from('payments')
      .select('*')
      .eq('gym_id', gymId);

    // Apply filters
    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    if (startDate) {
      const startDateStr = startDate.toISOString().split('T')[0];
      query = query.gte('payment_date', startDateStr);
    }

    if (endDate) {
      const endDateStr = endDate.toISOString().split('T')[0];
      query = query.lte('payment_date', endDateStr);
    }

    // Order by payment date (newest first)
    query = query.order('payment_date', { ascending: false });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }

    return (data || []).map((row) => this.toDomain(row));
  }

  /**
   * Create a new payment
   */
  async create(payment: Payment): Promise<Payment> {
    const row = this.toDatabase(payment);

    // Remove id and created_at - these are auto-generated
    const { id: _id, created_at: _createdAt, ...insertData } = row;

    const { data, error } = await this.supabase
      .from('payments')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return this.toDomain(data);
  }

  /**
   * Get total revenue for a gym in a date range
   */
  async getTotalRevenue(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('payments')
      .select('amount_paid')
      .eq('gym_id', gymId)
      .gte('payment_date', startDateStr)
      .lte('payment_date', endDateStr);

    if (error) {
      throw new Error(`Failed to get total revenue: ${error.message}`);
    }

    // Sum all amounts
    const totalRevenue = (data || []).reduce(
      (sum, row) => sum + (row.amount_paid || 0),
      0
    );

    return totalRevenue;
  }

  /**
   * Get revenue breakdown by plan type
   */
  async getRevenueByPlanType(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueByPlanType[]> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Join with members table to get plan type
    const { data, error } = await this.supabase
      .from('payments')
      .select(`
        amount_paid,
        members!inner(plan_type)
      `)
      .eq('gym_id', gymId)
      .gte('payment_date', startDateStr)
      .lte('payment_date', endDateStr);

    if (error) {
      throw new Error(`Failed to get revenue by plan type: ${error.message}`);
    }

    // Group by plan type and sum revenue
    const revenueMap = new Map<PlanType, { totalRevenue: number; paymentCount: number }>();

    interface RevenueJoinRow {
      amount_paid: number | null;
      members: { plan_type: string } | { plan_type: string }[] | null;
    }

    ((data || []) as RevenueJoinRow[]).forEach((row) => {
      const memberRelation = Array.isArray(row.members) ? row.members[0] : row.members;
      const planType = memberRelation?.plan_type as PlanType;
      const amount = row.amount_paid || 0;

      if (planType) {
        const existing = revenueMap.get(planType) || { totalRevenue: 0, paymentCount: 0 };
        revenueMap.set(planType, {
          totalRevenue: existing.totalRevenue + amount,
          paymentCount: existing.paymentCount + 1,
        });
      }
    });

    // Convert map to array
    return Array.from(revenueMap.entries()).map(([planType, stats]) => ({
      planType,
      totalRevenue: stats.totalRevenue,
      paymentCount: stats.paymentCount,
    }));
  }

  /**
   * Get payment count for a gym in a date range
   */
  async getPaymentCount(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { count, error } = await this.supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .gte('payment_date', startDateStr)
      .lte('payment_date', endDateStr);

    if (error) {
      throw new Error(`Failed to get payment count: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get recent payments for a gym
   */
  async getRecentPayments(gymId: string, limit: number = 10): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('gym_id', gymId)
      .order('payment_date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent payments: ${error.message}`);
    }

    return (data || []).map((row) => this.toDomain(row));
  }

  /**
   * Get monthly revenue trend
   */
  async getMonthlyRevenueTrend(
    gymId: string,
    months: number
  ): Promise<Array<{ month: string; revenue: number }>> {
    // Calculate start date (N months ago)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('payments')
      .select('payment_date, amount_paid')
      .eq('gym_id', gymId)
      .gte('payment_date', startDateStr)
      .lte('payment_date', endDateStr)
      .order('payment_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get monthly revenue trend: ${error.message}`);
    }

    // Group payments by month
    const monthlyRevenueMap = new Map<string, number>();

    (data || []).forEach((row) => {
      // Extract YYYY-MM from payment_date
      const month = row.payment_date.substring(0, 7); // "2024-03"
      const amount = row.amount_paid || 0;

      const existing = monthlyRevenueMap.get(month) || 0;
      monthlyRevenueMap.set(month, existing + amount);
    });

    // Convert map to sorted array
    return Array.from(monthlyRevenueMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // ============================================================
  // MAPPING METHODS (Private)
  // ============================================================

  /**
   * Map database row to domain entity
   *
   * @param row - Database row
   * @returns Domain Payment entity
   */
  private toDomain(row: PaymentRow): Payment {
    return Payment.fromDatabase({
      id: row.id,
      memberId: row.member_id,
      gymId: row.gym_id,
      paymentDate: new Date(row.payment_date),
      amountPaid: row.amount_paid,
      discountApplied: row.discount_applied,
      discountPercentage: row.discount_percentage,
      nextDueDateCalculated: new Date(row.next_due_date_calculated),
      createdAt: new Date(row.created_at),
      paymentType: (row.payment_type as PaymentType) ?? PaymentType.PlanPayment,
    });
  }

  /**
   * Map domain entity to database row
   *
   * @param payment - Domain Payment entity
   * @returns Database row
   */
  private toDatabase(payment: Payment): PaymentRow {
    const props = payment.toDatabase();

    return {
      id: props.id,
      member_id: props.memberId,
      gym_id: props.gymId,
      payment_date: props.paymentDate.toISOString().split('T')[0],
      amount_paid: props.amountPaid,
      discount_applied: props.discountApplied,
      discount_percentage: props.discountPercentage,
      next_due_date_calculated: props.nextDueDateCalculated.toISOString().split('T')[0],
      created_at: props.createdAt.toISOString(),
      payment_type: props.paymentType ?? PaymentType.PlanPayment,
    };
  }
}
