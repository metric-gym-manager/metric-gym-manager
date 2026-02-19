import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { addMonths } from 'date-fns';

const createInstallmentSchema = z.object({
  template_id: z.string().uuid(),
  template_name: z.string().min(1),
  total_amount: z.number().positive(),
  installment_count: z.number().int().min(2),
  interval_months: z.number().int().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

// GET /api/members/[id]/installments
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const { id: memberId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('member_installments')
      .select(`
        *,
        installment_payments(*)
      `)
      .eq('member_id', memberId)
      .eq('gym_id', gymProfile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch installments' }, { status: 500 });
  }
}

// POST /api/members/[id]/installments
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const { id: memberId } = await params;
    const body = await request.json();
    const validated = createInstallmentSchema.parse(body);

    const supabase = await createClient();
    const amountPerInstallment = Math.round((validated.total_amount / validated.installment_count) * 100) / 100;

    // Create the member installment record
    const { data: installment, error: installmentError } = await supabase
      .from('member_installments')
      .insert({
        gym_id: gymProfile.id,
        member_id: memberId,
        template_id: validated.template_id,
        template_name: validated.template_name,
        total_amount: validated.total_amount,
        installment_count: validated.installment_count,
        amount_per_installment: amountPerInstallment,
        installments_paid: 0,
        status: 'active',
      })
      .select()
      .single();

    if (installmentError) throw installmentError;

    // Generate installment payment slots
    const startDate = new Date(validated.start_date);
    const paymentSlots = Array.from({ length: validated.installment_count }, (_, i) => ({
      installment_id: installment.id,
      gym_id: gymProfile.id,
      installment_number: i + 1,
      amount: amountPerInstallment,
      due_date: addMonths(startDate, i * validated.interval_months).toISOString().split('T')[0],
      status: 'pending',
    }));

    const { error: paymentsError } = await supabase
      .from('installment_payments')
      .insert(paymentSlots);

    if (paymentsError) throw paymentsError;

    return NextResponse.json({ success: true, data: installment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create installment plan' }, { status: 500 });
  }
}
