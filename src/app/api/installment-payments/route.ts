import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';

// GET /api/installment-payments?filter=pending|overdue|all&sortBy=due_date_asc|member_name
export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') ?? 'pending';
    const sortBy = searchParams.get('sortBy') ?? 'due_date_asc';

    // Fetch all non-paid installment payments for this gym, joined with plan + member
    const { data, error } = await supabase
      .from('installment_payments')
      .select(
        `
        id,
        installment_number,
        amount,
        due_date,
        paid_date,
        status,
        member_installments!inner (
          id,
          template_name,
          installment_count,
          installments_paid,
          members!inner (
            id,
            name,
            phone_number,
            plan_type
          )
        )
      `
      )
      .eq('gym_id', gymProfile.id)
      .neq('status', 'paid');

    if (error) throw new Error(error.message);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Flatten and compute days overdue/upcoming
    // Supabase returns nested joins as arrays; cast via unknown to avoid strict overlap errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows = ((data ?? []) as unknown as {
      id: string;
      installment_number: number;
      amount: number;
      due_date: string;
      paid_date: string | null;
      status: string;
      member_installments: {
        id: string;
        template_name: string;
        installment_count: number;
        installments_paid: number;
        members: {
          id: string;
          name: string;
          phone_number: string;
          plan_type: string;
        };
      };
    }[]).map((row) => {
      const dueDate = new Date(row.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.floor(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: row.id,
        installmentNumber: row.installment_number,
        amount: row.amount,
        dueDate: row.due_date,
        daysUntilDue,
        status: daysUntilDue < 0 ? 'overdue' : row.status,
        planId: row.member_installments.id,
        templateName: row.member_installments.template_name,
        installmentCount: row.member_installments.installment_count,
        installmentsPaid: row.member_installments.installments_paid,
        memberId: row.member_installments.members.id,
        memberName: row.member_installments.members.name,
        phoneNumber: row.member_installments.members.phone_number,
        planType: row.member_installments.members.plan_type,
      };
    });

    // Apply filter
    if (filter === 'overdue') {
      rows = rows.filter((r) => r.daysUntilDue < 0);
    } else if (filter === 'upcoming') {
      rows = rows.filter((r) => r.daysUntilDue >= 0 && r.daysUntilDue <= 7);
    }
    // 'pending' = everything not paid (already filtered above), 'all' = same

    // Apply sort
    if (sortBy === 'member_name') {
      rows.sort((a, b) => a.memberName.localeCompare(b.memberName));
    } else {
      // due_date_asc: overdue first (most overdue first), then upcoming
      rows.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    }

    return NextResponse.json(
      { success: true, data: { payments: rows, totalCount: rows.length } },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET installment-payments error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch installment payments' },
      { status: 500 }
    );
  }
}
