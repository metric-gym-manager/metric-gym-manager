import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { addMemberSchema } from '@/features/members/schemas/member.schemas';
import { createMember } from '@/features/members/services/member.service';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/features/sms/services/sms.service';
import { addMonths } from 'date-fns';
import { z } from 'zod';

// Extend the base member schema with optional installment fields
const memberWithInstallmentSchema = addMemberSchema.extend({
  installmentTemplateId: z.string().uuid().nullable().optional(),
  installmentTemplateName: z.string().nullable().optional(),
  installmentTotalAmount: z.number().positive().nullable().optional(),
  installmentCount: z.number().int().min(2).nullable().optional(),
  installmentIntervalMonths: z.number().int().min(1).nullable().optional(),
});

const bulkCreateSchema = z.object({
  members: z.array(memberWithInstallmentSchema).min(1).max(50),
});

interface BulkResult {
  index: number;
  success: boolean;
  name: string;
  memberId?: string;
  error?: string;
}

// POST /api/members/bulk
export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    let validated: z.infer<typeof bulkCreateSchema>;
    try {
      validated = bulkCreateSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: 'Invalid input data', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    const supabase = await createClient();

    // Process all members in parallel; installment plans created inline for members that have one
    const results: BulkResult[] = await Promise.allSettled(
      validated.members.map(async (memberInput, index) => {
        const member = await createMember(gymProfile.id, memberInput);

        // Send welcome SMS — fire and forget
        sendSMS(gymProfile.id, member.id, 'welcome').catch((err) =>
          console.error(`Welcome SMS failed for member ${member.id}:`, err)
        );

        // Create installment plan if all required fields are present
        const {
          installmentTemplateId,
          installmentTemplateName,
          installmentTotalAmount,
          installmentCount,
          installmentIntervalMonths,
        } = memberInput;

        if (
          installmentTemplateId &&
          installmentTemplateName &&
          installmentTotalAmount &&
          installmentCount &&
          installmentIntervalMonths
        ) {
          const amountPerInstallment =
            Math.round((installmentTotalAmount / installmentCount) * 100) / 100;

          const { data: installment, error: instError } = await supabase
            .from('member_installments')
            .insert({
              gym_id: gymProfile.id,
              member_id: member.id,
              template_id: installmentTemplateId,
              template_name: installmentTemplateName,
              total_amount: installmentTotalAmount,
              installment_count: installmentCount,
              amount_per_installment: amountPerInstallment,
              installments_paid: 0,
              status: 'active',
            })
            .select()
            .single();

          if (instError || !installment) {
            throw new Error(`Member created but installment plan failed: ${instError?.message}`);
          }

          const startDate = new Date(memberInput.membershipStartDate);
          const paymentSlots = Array.from({ length: installmentCount }, (_, i) => ({
            installment_id: installment.id,
            gym_id: gymProfile.id,
            installment_number: i + 1,
            amount: amountPerInstallment,
            due_date: addMonths(startDate, i * installmentIntervalMonths)
              .toISOString()
              .split('T')[0],
            status: 'pending',
          }));

          const { error: slotsError } = await supabase
            .from('installment_payments')
            .insert(paymentSlots);

          if (slotsError) {
            throw new Error(`Installment slots failed: ${slotsError.message}`);
          }
        }

        return { index, success: true, name: memberInput.name, memberId: member.id };
      })
    ).then((settled) =>
      settled.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        return {
          index,
          success: false,
          name: validated.members[index].name,
          error:
            result.reason instanceof Error ? result.reason.message : 'Failed to create',
        };
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json(
      {
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            succeeded: successCount,
            failed: failureCount,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Bulk create members API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to process bulk registration' },
      { status: 500 }
    );
  }
}
