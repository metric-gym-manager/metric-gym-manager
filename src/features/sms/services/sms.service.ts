import { createClient } from '@/lib/supabase/server'
import type { SMSType, SMSLog, MemberReminderStatus } from '../types'
import type { ManualSmsType } from '../config/SmsConfig'
import type { ReminderFiltersInput } from '../schemas/sms.schemas'
import { sendSmsViaTextLk } from './textlk.service'
import { createSMSRepository } from './factory'
import { SMSDeliveryStatus } from './ISMSRepository'
import { ReminderType } from '../config/ReminderConfig'
import { effectivePlanAmount } from '@/features/members/utils/effectivePlanAmount'
import { reminderSms, welcomeBackSms, welcomeSms } from '../config/SmsTemplates'

// ============================================================
// SEND SMS (WITH REAL SMS INTEGRATION VIA text.lk)
// ============================================================

export async function sendSMS(
  gymId: string,
  memberId: string,
  smsType: ManualSmsType,
  customMessage?: string,
  paymentAmount?: number
): Promise<SMSLog> {
  const supabase = await createClient()

  // Get member details including gym name via join
  const { data: member } = await supabase
    .from('members')
    .select('*, gyms(gym_name), discount:discounts(discount_percentage)')
    .eq('id', memberId)
    .eq('gym_id', gymId)
    .single()

  if (!member) {
    throw new Error('Member not found')
  }

  const gymName = (member.gyms as { gym_name: string } | null)?.gym_name ?? ''

  // Format message based on SMS type
  const messageBody =
    customMessage || formatSMSMessage(smsType, member, gymName, paymentAmount)

  // Check if real SMS is enabled via feature flag
  const useRealSms = process.env.ENABLE_REAL_SMS === 'true'

  let deliveryStatus: 'sent' | 'delivered' | 'failed' = 'sent'
  let textLkMessageId: string | null = null
  let errorMessage: string | null = null

  if (useRealSms) {
    // Send SMS via text.lk API
    console.log('📱 [REAL SMS] Sending via text.lk:')
    console.log(`   To: ${member.phone_number}`)
    console.log(`   Type: ${smsType}`)
    console.log(`   Message: ${messageBody}`)

    const result = await sendSmsViaTextLk({
      to: member.phone_number,
      message: messageBody,
    })

    if (result.success) {
      textLkMessageId = result.message_id ?? null
      deliveryStatus = 'sent'
      console.log(
        `   ✓ SMS sent via text.lk (ID: ${result.message_id ?? 'N/A'})`
      )
      if (result.balance !== undefined) {
        console.log(`   Balance: ${result.balance} credits`)
      }
    } else {
      deliveryStatus = 'failed'
      // Kept, not just printed: `error_message` is what /system-health shows an
      // operator, and rule 2.7 requires the failure reason to reach the database.
      // Previously this line was the only record that a send had failed and why.
      errorMessage = result.error ?? 'Unknown provider error'
      console.error(`   ✗ SMS failed: ${result.error}`)
    }
  } else {
    // Mock SMS sending - just log to console
    console.log('📱 [MOCK SMS] Sending SMS:')
    console.log(`   To: ${member.phone_number}`)
    console.log(`   Type: ${smsType}`)
    console.log(`   Message: ${messageBody}`)
  }

  // Logged through the SMS repository rather than by a second inline insert, so
  // `sms_logs` has one writer that knows its own columns (R5). The session
  // client is correct here — a gym manager triggers this, and the table's INSERT
  // policy checks `auth.uid()`.
  const created = await createSMSRepository(supabase).create({
    memberId,
    gymId,
    smsType,
    phoneNumber: member.phone_number,
    messageBody,
    sentAt: new Date(),
    deliveryStatus: deliveryStatus as SMSDeliveryStatus,
    textLkMessageId,
    errorMessage,
  })

  console.log(`   ✓ SMS logged to database (ID: ${created.id})`)

  // Mapped back to the row shape this function has always returned, so
  // `POST /api/sms/send` keeps its response contract.
  return {
    id: created.id,
    member_id: created.memberId,
    gym_id: created.gymId,
    sms_type: created.smsType,
    phone_number: created.phoneNumber,
    message_body: created.messageBody,
    sent_at: created.sentAt.toISOString(),
    delivery_status: created.deliveryStatus,
    text_lk_message_id: created.textLkMessageId,
    error_message: created.errorMessage,
  } satisfies SMSLog
}

// ============================================================
// GET REMINDER STATUS
// ============================================================

export async function getReminderStatus(
  gymId: string,
  filters?: ReminderFiltersInput
): Promise<MemberReminderStatus[]> {
  const supabase = await createClient()

  // Get all active members with their SMS logs (ordered by most recent first)
  const { data: members, error } = await supabase
    .from('members')
    .select(
      `
      id,
      name,
      phone_number,
      plan_type,
      next_due_date,
      sms_logs (
        sms_type,
        sent_at,
        delivery_status
      )
    `
    )
    .eq('gym_id', gymId)
    .order('next_due_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch reminder status: ${error.message}`)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  interface ReminderLogRow {
    sms_type: SMSType
    sent_at: string
    delivery_status: NonNullable<MemberReminderStatus['last_delivery_status']>
  }

  interface ReminderMemberRow {
    id: string
    name: string
    phone_number: string
    plan_type: MemberReminderStatus['plan_type']
    next_due_date: string
    sms_logs: ReminderLogRow[] | null
  }

  // Process members and calculate days until due
  let reminderStatuses: MemberReminderStatus[] = (
    (members || []) as ReminderMemberRow[]
  ).map((member) => {
    const dueDate = new Date(member.next_due_date)
    dueDate.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.floor(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Only consider reminder-type SMS logs — receipt and welcome are transactional
    // and must not affect the auto-status indicator or the "Sent Xm ago" label.
    const REMINDER_TYPES = [
      'reminder_7day',
      'reminder_3day',
      'due_today',
      'overdue',
    ]
    const reminderLogs = (member.sms_logs || [])
      .filter((log) => REMINDER_TYPES.includes(log.sms_type))
      .sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      )

    const lastLog = reminderLogs.length > 0 ? reminderLogs[0] : null

    // Query each reminder type's most recent log (now sorted by sent_at DESC)
    const reminder7Day = reminderLogs.find(
      (log) => log.sms_type === 'reminder_7day'
    )
    const reminder3Day = reminderLogs.find(
      (log) => log.sms_type === 'reminder_3day'
    )
    const dueToday = reminderLogs.find((log) => log.sms_type === 'due_today')
    const overdue = reminderLogs.find((log) => log.sms_type === 'overdue')

    // Check for delivery failures (system errors) for each reminder type
    const reminder7DayError =
      reminder7Day?.delivery_status === 'failed' || false
    const reminder3DayError =
      reminder3Day?.delivery_status === 'failed' || false
    const dueTodayError = dueToday?.delivery_status === 'failed' || false

    return {
      id: member.id,
      name: member.name,
      phone_number: member.phone_number,
      plan_type: member.plan_type,
      next_due_date: member.next_due_date,
      days_until_due: daysUntilDue,
      last_reminder_sent: lastLog?.sent_at || null,
      last_reminder_type: lastLog?.sms_type || null,
      last_delivery_status: lastLog?.delivery_status || null,
      // Timestamp tracking for each reminder type
      reminder_7day_sent: reminder7Day?.sent_at || null,
      reminder_3day_sent: reminder3Day?.sent_at || null,
      due_today_sent: dueToday?.sent_at || null,
      overdue_sent: overdue?.sent_at || null,
      // Error tracking for each reminder type
      reminder_7day_error: reminder7DayError,
      reminder_3day_error: reminder3DayError,
      due_today_error: dueTodayError,
    }
  })

  // Apply filters
  if (filters?.filter) {
    switch (filters.filter) {
      case 'upcoming':
        reminderStatuses = reminderStatuses.filter(
          (r) => r.days_until_due >= 1 && r.days_until_due <= 7
        )
        break
      case 'due_today':
        reminderStatuses = reminderStatuses.filter(
          (r) => r.days_until_due === 0
        )
        break
      case 'overdue':
        reminderStatuses = reminderStatuses.filter((r) => r.days_until_due < 0)
        break
      // 'all' - no filtering
    }
  }

  // Apply sorting
  if (filters?.sortBy === 'last_reminder_desc') {
    reminderStatuses.sort((a, b) => {
      if (!a.last_reminder_sent) return 1
      if (!b.last_reminder_sent) return -1
      return (
        new Date(b.last_reminder_sent).getTime() -
        new Date(a.last_reminder_sent).getTime()
      )
    })
  } else {
    // Default: sort by due date (soonest first)
    reminderStatuses.sort((a, b) => a.days_until_due - b.days_until_due)
  }

  return reminderStatuses
}

// ============================================================
// FORMAT SMS MESSAGES
// ============================================================

interface SMSMemberFields {
  name: string
  next_due_date: string
  plan_amount: number
  plan_type: string
  recurring_discount?: boolean | null
  discount?: { discount_percentage: number } | null
}

/**
 * Text for a manual send (the "Send reminder" button on Payment Collection).
 *
 * Worded by the same `SmsTemplates` as the automated sends, so a reminder
 * reads the same whether the cron or the desk sent it.
 */
function formatSMSMessage(
  smsType: ManualSmsType,
  member: SMSMemberFields,
  gymName: string,
  paymentAmount?: number
): string {
  const dueDate = new Date(member.next_due_date)
  const party = { gymName, memberName: member.name }

  switch (smsType) {
    case 'welcome':
      return welcomeSms({
        ...party,
        planType: member.plan_type,
        amountPaid: paymentAmount || member.plan_amount,
        nextDueDate: dueDate,
      })

    case ReminderType.SevenDay:
    case ReminderType.ThreeDay:
    case ReminderType.DueToday:
    case ReminderType.Overdue:
      // The amount the desk will charge: plan less a recurring discount.
      return reminderSms(smsType, {
        ...party,
        planType: member.plan_type,
        amount: effectivePlanAmount({
          planAmount: member.plan_amount,
          recurringDiscount: Boolean(member.recurring_discount),
          discountPercentage: member.discount?.discount_percentage ?? null,
        }),
        dueDate,
      })

    case 'reactivation':
      return welcomeBackSms({
        ...party,
        amountPaid: paymentAmount || member.plan_amount,
        nextDueDate: dueDate,
      })
  }
}

// ============================================================
// CALCULATE BILLING PERIOD START
// ============================================================
