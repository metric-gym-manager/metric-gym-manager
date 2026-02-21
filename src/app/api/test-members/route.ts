import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const gymId = '481599f6-5134-4152-83b2-6e2dd10e3018';

    console.log('Querying members for gym:', gymId);

    const { data: members, error } = await supabase
      .from('members')
      .select(`
        id,
        name,
        phone_number,
        next_due_date,
        member_installments(id, status)
      `)
      .eq('gym_id', gymId)
      .eq('status', 'active');

    console.log('Members query result:', {
      count: members?.length,
      error: error?.message,
    });

    if (members) {
      console.log('Sample member:', members[0]);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const membersWithDueDates = members?.map(m => {
      const dueDate = new Date(m.next_due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        name: m.name,
        next_due_date: m.next_due_date,
        days_until_due: daysUntilDue,
        has_installments: (m.member_installments as any)?.length > 0,
      };
    });

    return NextResponse.json({
      success: true,
      totalMembers: members?.length || 0,
      members: membersWithDueDates,
      error: error?.message || null,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
