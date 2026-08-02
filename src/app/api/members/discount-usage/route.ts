import { NextResponse } from 'next/server'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { getDiscountUsage } from '@/features/members/services/member-queries.service'

// GET /api/members/discount-usage
// Active-member count per discount id (Billing-Setup discounts "In use" column).
export async function GET() {
  try {
    const gymProfile = await getCurrentGymProfile()
    const data = await getDiscountUsage(gymProfile.id)
    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('GET members/discount-usage error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discount usage' },
      { status: 500 }
    )
  }
}
