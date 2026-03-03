import { NextRequest, NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/features/sms/services/sms.service';

// PATCH /api/installment-payments/[id]
// Marks an installment payment slot as paid and updates the parent plan progress
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymProfile, error: authError } = await getApiGymProfile();

    if (authError) {
      return authError;
    }

    const { id: paymentId } = await params;
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // Single query: payment slot + plan details + member + gym name
    const { data: payment, error: fetchError } = await supabase
      .from('installment_payments')
      .select(`
        id,
        installment_id,
        gym_id,
        status,
        installment_number,
        amount,
        member_installments!inner (
          id,
          template_name,
          installment_count,
          installments_paid,
          status,
          members!inner (
            id,
            name,
            gym:gyms!inner (gym_name)
          )
        )
      `)
      .eq('id', paymentId)
      .eq('gym_id', gymProfile!.id)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json(
        { success: false, error: 'Installment payment not found' },
        { status: 404 }
      );
    }

    if (payment.status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'This installment has already been paid' },
        { status: 409 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = (payment.member_installments as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = (plan.members as any);
    const gymName: string = member.gym?.gym_name ?? '';
    const memberId: string = member.id;
    const memberName: string = member.name;

    const newPaidCount: number = plan.installments_paid + 1;
    const isCompleted: boolean = newPaidCount >= plan.installment_count;

    // Parallel writes: mark slot paid + update plan progress
    const [slotResult, planResult] = await Promise.all([
      supabase
        .from('installment_payments')
        .update({ status: 'paid', paid_date: today })
        .eq('id', paymentId),
      supabase
        .from('member_installments')
        .update({
          installments_paid: newPaidCount,
          status: isCompleted ? 'completed' : plan.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plan.id)
        .eq('gym_id', gymProfile!.id),
    ]);

    if (slotResult.error) throw new Error(slotResult.error.message);
    if (planResult.error) throw new Error(planResult.error.message);

    // Fire-and-forget receipt SMS — never blocks the response
    const completionNote = isCompleted
      ? ' Your installment plan is now fully paid!'
      : '';
    const receiptMessage =
      `Dear ${memberName}, installment #${payment.installment_number} of ` +
      `${plan.installment_count} (LKR ${Number(payment.amount).toFixed(2)}) ` +
      `for '${plan.template_name}' has been collected.` +
      `${completionNote} Thank you - ${gymName}`;

    sendSMS(gymProfile!.id, memberId, 'receipt', receiptMessage).catch((err) =>
      console.error('Installment receipt SMS failed:', err)
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          paymentId,
          paidDate: today,
          planCompleted: isCompleted,
          installmentsPaid: newPaidCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Mark installment paid error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to mark installment as paid' },
      { status: 500 }
    );
  }
}
