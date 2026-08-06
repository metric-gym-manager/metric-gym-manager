import { NextRequest, NextResponse } from 'next/server'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { createClient } from '@/lib/supabase/server'
import {
  createMemberAnalytics,
  memberAnalyticsQuerySchema,
} from '@/features/analytics'
import { ResponseBuilder, HTTP_STATUS } from '@/utils/api'

// ============================================================
// GET /api/analytics/members — member trends for one range/year
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()

    const searchParams = request.nextUrl.searchParams
    const params = memberAnalyticsQuerySchema.parse({
      range: searchParams.get('range') ?? '1M',
      year: Number(
        searchParams.get('year') ?? new Date().getFullYear().toString()
      ),
      metric: searchParams.get('metric') ?? undefined,
    })

    const supabase = await createClient()
    const data = await createMemberAnalytics(supabase).getMemberAnalytics(
      gymProfile.id,
      params.range,
      params.year
    )

    return NextResponse.json(ResponseBuilder.success(data), {
      status: HTTP_STATUS.OK,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Unauthorized' ||
        error.message === 'Gym profile not found')
    ) {
      return NextResponse.json(ResponseBuilder.unauthorized(), {
        status: HTTP_STATUS.UNAUTHORIZED,
      })
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        ResponseBuilder.badRequest('Invalid analytics parameters'),
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // Never leak technical detail to gym managers (rule 2.8).
    console.error('Member analytics API error:', error)
    return NextResponse.json(
      ResponseBuilder.internalError('Failed to load member analytics'),
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}
