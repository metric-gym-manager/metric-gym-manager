import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { addMemberSchema } from '@/features/members/schemas/member.schemas';
import { createMember } from '@/features/members/services/member.service';
import { sendSMS } from '@/features/sms/services/sms.service';
import { z } from 'zod';

const bulkCreateSchema = z.object({
  members: z.array(addMemberSchema).min(1).max(50),
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

    // Process all members in parallel
    const results: BulkResult[] = await Promise.allSettled(
      validated.members.map(async (memberInput, index) => {
        const member = await createMember(gymProfile.id, memberInput);

        // Send welcome SMS — fire and forget
        sendSMS(gymProfile.id, member.id, 'welcome').catch((err) =>
          console.error(`Welcome SMS failed for member ${member.id}:`, err)
        );

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
