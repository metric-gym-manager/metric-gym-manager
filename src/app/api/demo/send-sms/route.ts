import { NextRequest, NextResponse } from 'next/server'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { sendSmsViaTextLk } from '@/features/sms/services/textlk.service'
import {
  receiptSms,
  reminderSms,
  welcomeSms,
} from '@/features/sms/config/SmsTemplates'
import { ReminderType } from '@/features/sms/config/ReminderConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import { calculateNextDueDate } from '@/features/members/utils/calculateNextDueDate'

// ============================================================
// POST /api/demo/send-sms - Demo SMS Sending (demo account only)
// ============================================================

/**
 * Demo endpoint for showcasing the SMS system during in-person gym visits.
 *
 * SECURITY: Restricted to the single designated demo account. The request must
 * carry a valid session whose gym-owner email matches DEMO_TOOLS_ALLOWED_EMAIL:
 *   - no session             -> 401
 *   - any other gym account  -> 403
 *   - env var unset           -> 403 (fail closed / disabled)
 *
 * This replaces the previous Host-header check, which was spoofable (a substring
 * match on a client-supplied header) and only incidentally blocked production.
 * The gate is now a real, verified identity, so the endpoint safely works from
 * both the live app and localhost — but only for the demo account.
 */
export async function POST(request: NextRequest) {
  // --- Authorization: designated demo account only ---
  const allowedEmail = process.env.DEMO_TOOLS_ALLOWED_EMAIL

  let gymProfile
  try {
    gymProfile = await getCurrentGymProfile()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (!allowedEmail || gymProfile.email !== allowedEmail) {
    return NextResponse.json(
      {
        success: false,
        error: 'This demo tool is not available for your account.',
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { name, phone, gymName, type, fee } = body

    // Validate inputs
    if (!name || !phone || !gymName || !type || !fee) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, phone, gymName, type, fee',
        },
        { status: 400 }
      )
    }

    // Validate phone format (+94XXXXXXXXX)
    const phoneRegex = /^\+94\d{9}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone format. Use: +94XXXXXXXXX' },
        { status: 400 }
      )
    }

    // Validate type
    if (!['welcome', 'due', 'receipt'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid type. Must be: welcome, due, or receipt',
        },
        { status: 400 }
      )
    }

    // Validate fee (must be a positive number)
    const feeNumber = parseFloat(fee)
    if (isNaN(feeNumber) || feeNumber <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid fee. Must be a positive number' },
        { status: 400 }
      )
    }

    // Format SMS message based on type
    const message = formatDemoMessage(type, name, gymName, feeNumber)

    // Check if real SMS is enabled
    const useRealSms = process.env.ENABLE_REAL_SMS === 'true'

    if (useRealSms) {
      // Send real SMS via text.lk
      console.log('📱 [DEMO - REAL SMS] Sending via text.lk:')
      console.log(`   To: ${phone}`)
      console.log(`   Type: ${type}`)
      console.log(`   Message: ${message}`)

      const result = await sendSmsViaTextLk({
        to: phone,
        message: message,
      })

      if (result.success) {
        console.log(`   ✓ SMS sent successfully (ID: ${result.message_id})`)
        if (result.balance !== undefined) {
          console.log(`   Balance: ${result.balance} credits`)
        }

        return NextResponse.json(
          {
            success: true,
            message: 'SMS sent successfully',
            messageId: result.message_id,
            balance: result.balance,
          },
          { status: 200 }
        )
      } else {
        console.error(`   ✗ SMS failed: ${result.error}`)
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to send SMS' },
          { status: 500 }
        )
      }
    } else {
      // Mock mode - just log to console
      console.log('📱 [DEMO - MOCK SMS] Would send:')
      console.log(`   To: ${phone}`)
      console.log(`   Type: ${type}`)
      console.log(`   Message: ${message}`)

      return NextResponse.json(
        {
          success: true,
          message: 'SMS sent successfully (mock mode)',
          mock: true,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Demo SMS API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * The demo text for each type, built by the product's own templates so a gym
 * sees exactly what its members will receive. The example member is on an
 * annual plan: paid today, next due a year from today; the reminder is the
 * 7-day notice an annual member gets.
 *
 * @param type - Which message to demonstrate
 * @param name - Example member name
 * @param gymName - The visited gym's name
 * @param fee - Example amount in LKR
 * @returns The SMS text
 */
function formatDemoMessage(
  type: 'welcome' | 'due' | 'receipt',
  name: string,
  gymName: string,
  fee: number
): string {
  const party = { gymName, memberName: name }
  const today = new Date()
  const nextDueDate = calculateNextDueDate(today, PlanType.Annual)

  switch (type) {
    case 'welcome':
      return welcomeSms({
        ...party,
        planType: PlanType.Annual,
        amountPaid: fee,
        nextDueDate,
      })

    case 'due': {
      const dueDate = new Date(today)
      dueDate.setDate(dueDate.getDate() + 7)
      return reminderSms(ReminderType.SevenDay, {
        ...party,
        planType: PlanType.Annual,
        amount: fee,
        dueDate,
      })
    }

    case 'receipt':
      return receiptSms({ ...party, amountPaid: fee, nextDueDate })
  }
}
