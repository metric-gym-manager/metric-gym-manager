/**
 * Payment Repository Interface (Port)
 *
 * Defines the contract for payment data access.
 */

import { Payment } from '@/core/domain/payment/Payment';
import { PlanType } from '@/features/members/config/PlanConfig';

/**
 * Payment query filters
 */
export interface PaymentFilters {
  /**
   * Gym ID (required for multi-tenancy)
   */
  gymId: string;

  /**
   * Filter by member ID
   */
  memberId?: string;

  /**
   * Filter by date range (start)
   */
  startDate?: Date;

  /**
   * Filter by date range (end)
   */
  endDate?: Date;

  /**
   * Pagination: page number (1-indexed)
   */
  page?: number;

  /**
   * Pagination: items per page
   */
  limit?: number;
}

/**
 * Revenue summary by plan type
 */
export interface RevenueByPlanType {
  planType: PlanType;
  totalRevenue: number;
  paymentCount: number;
}

/**
 * Payment Repository Interface
 *
 * This defines all data access operations for payments.
 *
 * @example
 * // Use in a use case
 * class CollectPayment {
 *   constructor(private paymentRepo: IPaymentRepository) {}
 *
 *   async execute(data: PaymentInput) {
 *     const payment = Payment.create(data);
 *     return await this.paymentRepo.create(payment);
 *   }
 * }
 */
export interface IPaymentRepository {
  /**
   * Find payment by ID
   *
   * @param id - Payment ID
   * @returns Payment if found, null otherwise
   */
  findById(id: string): Promise<Payment | null>;

  /**
   * Find all payments for a member
   *
   * Used for displaying payment history in member details.
   *
   * @param memberId - Member ID
   * @returns Array of payments sorted by date (newest first)
   */
  findByMemberId(memberId: string): Promise<Payment[]>;

  /**
   * Find all payments with filters
   *
   * @param filters - Query filters
   * @returns Array of payments
   */
  findAll(filters: PaymentFilters): Promise<Payment[]>;

  /**
   * Create a new payment
   *
   * @param payment - Payment entity to create
   * @returns Created payment with assigned ID
   */
  create(payment: Payment): Promise<Payment>;

  /**
   * Get total revenue for a gym in a date range
   *
   * Used for dashboard revenue statistics.
   *
   * @param gymId - Gym ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Total revenue amount
   */
  getTotalRevenue(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;

  /**
   * Get revenue breakdown by plan type
   *
   * Used for analytics and reporting.
   *
   * @param gymId - Gym ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Revenue summary by plan type
   */
  getRevenueByPlanType(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueByPlanType[]>;

  /**
   * Get payment count for a gym in a date range
   *
   * Used for dashboard statistics.
   *
   * @param gymId - Gym ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of payments
   */
  getPaymentCount(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;

  /**
   * Get recent payments for a gym
   *
   * Used for displaying recent activity on dashboard.
   *
   * @param gymId - Gym ID
   * @param limit - Maximum number of payments to return
   * @returns Array of recent payments
   */
  getRecentPayments(gymId: string, limit?: number): Promise<Payment[]>;

  /**
   * Get monthly revenue trend
   *
   * Used for revenue charts and analytics.
   *
   * @param gymId - Gym ID
   * @param months - Number of months to include
   * @returns Array of monthly revenue totals
   */
  getMonthlyRevenueTrend(
    gymId: string,
    months: number
  ): Promise<Array<{ month: string; revenue: number }>>;
}
