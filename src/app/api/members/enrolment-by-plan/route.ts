import { NextResponse } from 'next/server'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { getEnrolmentByPlan } from '@/features/members/services/member-queries.service'

// GET /api/members/enrolment-by-plan
// Active-member enrolment counts grouped by plan type (Revenue breakdown column).
export async function GET() {
  try {
    const gymProfile = await getCurrentGymProfile()
    const data = await getEnrolmentByPlan(gymProfile.id)
    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('GET members/enrolment-by-plan error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch enrolment by plan' },
      { status: 500 }
    )
  }
}
