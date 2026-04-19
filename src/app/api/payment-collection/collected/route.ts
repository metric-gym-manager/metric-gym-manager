import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';

/**
 * Helper function to get the current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Helper function to get date range for a given month (YYYY-MM)
 */
function getMonthDateRange(month: string): { startDate: string; endDate: string } {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0); // Last day of month

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Helper function to calculate summary metrics from payments
 */
function calculateSummaryMetrics(payments: PaymentCollectedRow[]) {
  const totalRevenue = payments.reduce((sum, p) => sum + p.amountPaid, 0);
  const paymentCount = payments.length;

  const revenueByPlanType: Record<string, number> = {};
  payments.forEach((p) => {
    if (!revenueByPlanType[p.planType]) {
      revenueByPlanType[p.planType] = 0;
    }
    revenueByPlanType[p.planType] += p.amountPaid;
  });

  return {
    totalRevenue,
    paymentCount,
    revenueByPlanType,
  };
}

interface MemberData {
  id: string;
  name: string;
  phone_number: string;
  plan_type: string;
  discount_id: string | null;
  discount: DiscountData | null;
}

interface DiscountData {
  id: string;
  discount_name: string;
  discount_percentage: number;
}

interface PaymentRecord {
  id: string;
  member_id: string;
  amount_paid: number;
  payment_date: string;
  next_due_date_calculated: string;
  members: MemberData;
}

interface PaymentCollectedRow {
  paymentId: string;
  memberId: string;
  memberName: string;
  phoneNumber: string;
  planType: string;
  amountPaid: number;
  discountName: string | null;
  discountPct: number | null;
  paymentDate: string;
  nextDueDate: string;
}

// GET /api/payment-collection/collected?month=YYYY-MM&planType=monthly&search=name
// Returns collected payments for a specific month with summary metrics
export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month') ?? getCurrentMonth();
    const planType = searchParams.get('planType') ?? 'all';
    const search = searchParams.get('search') ?? '';

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        ResponseBuilder.badRequest('Invalid month format. Use YYYY-MM'),
        { status: 400 }
      );
    }

    const { startDate, endDate } = getMonthDateRange(month);

    // Build query for payments joined with members and discounts
    let query = supabase
      .from('payments')
      .select(
        `
        id,
        member_id,
        amount_paid,
        payment_date,
        next_due_date_calculated,
        members!inner (
          id,
          name,
          phone_number,
          plan_type,
          discount_id,
          discount:discounts (
            id,
            discount_name,
            discount_percentage
          )
        )
      `
      )
      .eq('gym_id', gymProfile.id)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .order('payment_date', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    // Type-safe data processing
    const payments = (data ?? []) as unknown as PaymentRecord[];

    let rows = payments.map((p) => {
      const member = p.members;
      const discountObj = member.discount;

      return {
        paymentId: p.id,
        memberId: member.id,
        memberName: member.name,
        phoneNumber: member.phone_number,
        planType: member.plan_type,
        amountPaid: p.amount_paid,
        discountName: discountObj?.discount_name ?? null,
        discountPct: discountObj?.discount_percentage ?? null,
        paymentDate: p.payment_date,
        nextDueDate: p.next_due_date_calculated,
        // Include snake_case for backward compatibility
        payment_id: p.id,
        member_id: member.id,
        member_name: member.name,
        phone_number: member.phone_number,
        plan_type: member.plan_type,
        amount_paid: p.amount_paid,
        discount_name: discountObj?.discount_name ?? null,
        discount_pct: discountObj?.discount_percentage ?? null,
        payment_date: p.payment_date,
        next_due_date: p.next_due_date_calculated,
      };
    });

    // Apply plan type filter
    if (planType !== 'all') {
      rows = rows.filter((r) => r.planType === planType);
    }

    // Apply client-side search filter (name or phone)
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.memberName.toLowerCase().includes(searchLower) ||
          r.phoneNumber.includes(search)
      );
    }

    // Calculate summary metrics
    const summary = calculateSummaryMetrics(rows);

    return NextResponse.json(
      ResponseBuilder.success({
        payments: rows,
        summary,
        totalCount: rows.length,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('GET payment-collection/collected error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to fetch collected payments',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}
