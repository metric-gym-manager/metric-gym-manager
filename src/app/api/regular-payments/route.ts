import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';

// GET /api/regular-payments?filter=overdue|due_today|upcoming|all&sortBy=due_date_asc|member_name
// Returns members with regular (non-installment) payments pending, joined with discount info.
export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') ?? 'overdue';
    const sortBy = searchParams.get('sortBy') ?? 'due_date_asc';

    // Fetch members who do NOT have an active installment plan,
    // joined with their discount info.
    const { data, error } = await supabase
      .from('members')
      .select(
        `
        id,
        name,
        phone_number,
        plan_type,
        plan_amount,
        discount_id,
        recurring_discount,
        next_due_date,
        status,
        discount:discounts(id, discount_name, discount_percentage),
        member_installments(id, status)
      `
      )
      .eq('gym_id', gymProfile.id)
      .in('status', ['active', 'expired']);

    if (error) throw new Error(error.message);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type RawRow = Record<string, any>;

    let rows = ((data ?? []) as RawRow[])
      // Exclude members with an active installment plan
      .filter((m) => {
        const installments = (m.member_installments as Array<{ id: string; status: string }> | null) ?? [];
        return !installments.some((inst) => inst.status === 'active');
      })
      .map((m) => {
        const dueDate = new Date(m.next_due_date as string);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.floor(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Compute effective payment amount (apply recurring discount if set)
        const discountObj = m.discount as { id: string; discount_name: string; discount_percentage: number } | null;
        const discountPct =
          m.recurring_discount && discountObj ? discountObj.discount_percentage : 0;
        const effectiveAmount = Math.round(
          (m.plan_amount as number) * (1 - discountPct / 100) * 100
        ) / 100;

        return {
          id: m.id as string,
          name: m.name as string,
          phoneNumber: m.phone_number as string,
          planType: m.plan_type as string,
          planAmount: m.plan_amount as number,
          discountId: m.recurring_discount && discountObj ? (m.discount_id as string) : null,
          discountName: discountObj?.discount_name ?? null,
          discountPct: discountPct > 0 ? discountPct : null,
          recurringDiscount: m.recurring_discount as boolean,
          effectiveAmount,
          nextDueDate: m.next_due_date as string,
          daysUntilDue,
          memberStatus: m.status as string,
        };
      });

    // Apply filter
    if (filter === 'overdue') {
      rows = rows.filter((r) => r.daysUntilDue < 0);
    } else if (filter === 'due_today') {
      rows = rows.filter((r) => r.daysUntilDue === 0);
    } else if (filter === 'upcoming') {
      rows = rows.filter((r) => r.daysUntilDue >= 1 && r.daysUntilDue <= 7);
    }
    // 'all' — no extra filter

    // Apply sort
    if (sortBy === 'member_name') {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // due_date_asc: most overdue first, then upcoming
      rows.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    }

    return NextResponse.json(
      { success: true, data: { payments: rows, totalCount: rows.length } },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET regular-payments error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch regular payments' },
      { status: 500 }
    );
  }
}
