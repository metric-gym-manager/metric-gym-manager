import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { getReminderQueue } from '@/features/sms'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

// GET /api/reminders/queue?days=7&limit=8
// Upcoming automated payment reminders for the caller's gym, derived from active
// members' next_due_date + plan reminder thresholds (dashboard reminder-queue panel).
export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()

    const { days, limit } = querySchema.parse({
      days: request.nextUrl.searchParams.get('days') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    })

    const data = await getReminderQueue(gymProfile.id, {
      lookaheadDays: days,
      limit,
    })

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      )
    }
    console.error('GET reminders/queue error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reminder queue' },
      { status: 500 }
    )
  }
}
