import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiGymProfile } from '@/lib/middleware/api-auth'
import { createClient } from '@/lib/supabase/server'
import { createMemberRepository } from '@/features/members'
import { createMemberSmsHistoryReader } from '@/features/sms/services/factory'
import { smsHistoryQuerySchema } from '@/features/sms/schemas/sms.schemas'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

// ============================================================
// GET /api/members/[id]/sms-history — one member's SMS history
// ============================================================

/**
 * Thin by R6: authenticate, validate, one call into the feature.
 *
 * The previous handler built its own Supabase query through
 * `sms-history.service.ts`, outside the SMS repository, and selected a
 * `created_at` column `sms_logs` does not have — so this endpoint answered 500
 * on every request it ever served. That query now lives in
 * `SupabaseSMSRepository.findHistoryForMember`, which names its columns from one
 * declared set and projects away `error_message` (rule 2.8).
 *
 * The member lookup stays here as the tenant check: it is the documented
 * per-route ownership exception, and it distinguishes "no such member in this
 * gym" (404) from "this member has never been sent an SMS" (200, empty page).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params
    const { gymProfile, error: authError } = await getApiGymProfile()

    if (authError) {
      return authError
    }

    const query = smsHistoryQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const supabase = await createClient()

    const member = await createMemberRepository(supabase).findById(
      memberId,
      gymProfile!.id
    )

    if (!member) {
      return NextResponse.json(ResponseBuilder.notFound('Member not found'), {
        status: 404,
      })
    }

    const history = await createMemberSmsHistoryReader(supabase)(
      gymProfile!.id,
      memberId,
      { page: query.page, pageSize: query.pageSize }
    )

    return NextResponse.json(
      ResponseBuilder.success({
        member: {
          id: member.id,
          name: member.name,
          phoneNumber: member.phoneNumber,
        },
        entries: history.entries.map((entry) => ({
          ...entry,
          sentAt: entry.sentAt.toISOString(),
        })),
        totalCount: history.totalCount,
        page: history.page,
        pageSize: history.pageSize,
        pageCount: history.pageCount,
      }),
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        ResponseBuilder.badRequest('Invalid query parameters', {
          errors: error.errors,
        }),
        { status: 400 }
      )
    }

    console.error('Get SMS history API error:', error)

    return NextResponse.json(
      ResponseBuilder.internalError('Failed to fetch SMS history'),
      { status: 500 }
    )
  }
}
