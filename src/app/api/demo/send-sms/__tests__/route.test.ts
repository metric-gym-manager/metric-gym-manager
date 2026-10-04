/**
 * @jest-environment node
 */

/**
 * POST /api/demo/send-sms — the demo account's tool for showing a gym the
 * SMS a member receives. It must send the product's real wording, so it
 * builds every text with the shared SmsTemplates; it used to keep a third,
 * older copy ("Dear …, Thank you - Gym") that no member receives.
 *
 * text.lk is module-mocked: nothing here can reach the real gateway.
 */

import { NextRequest } from 'next/server'

const sendSmsViaTextLk = jest.fn()
jest.mock('@/features/sms/services/textlk.service', () => ({
  sendSmsViaTextLk: (...args: unknown[]) => sendSmsViaTextLk(...args),
}))

const getCurrentGymProfile = jest.fn()
jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: () => getCurrentGymProfile(),
}))

import { POST } from '../route'
import {
  receiptSms,
  reminderSms,
  welcomeSms,
} from '@/features/sms/config/SmsTemplates'
import { ReminderType } from '@/features/sms/config/ReminderConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import { calculateNextDueDate } from '@/features/members/utils/calculateNextDueDate'

const DEMO_EMAIL = 'demo@example.com'
const NOW = new Date(2026, 9, 4, 10, 0, 0)

const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest('http://localhost/api/demo/send-sms', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  )

const body = (type: string) => ({
  name: 'Nimal',
  phone: '+94771234567',
  gymName: 'Lotus Gym',
  type,
  fee: '45000',
})

const party = { gymName: 'Lotus Gym', memberName: 'Nimal' }

describe('POST /api/demo/send-sms', () => {
  const env = { ...process.env }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask'] })
    process.env.DEMO_TOOLS_ALLOWED_EMAIL = DEMO_EMAIL
    process.env.ENABLE_REAL_SMS = 'true'
    getCurrentGymProfile.mockResolvedValue({ email: DEMO_EMAIL })
    sendSmsViaTextLk.mockReset()
    sendSmsViaTextLk.mockResolvedValue({ success: true, message_id: 'm-1' })
  })

  afterEach(() => {
    jest.useRealTimers()
    process.env = { ...env }
  })

  it('sends the real welcome text', async () => {
    const res = await post(body('welcome'))

    expect(res.status).toBe(200)
    expect(sendSmsViaTextLk).toHaveBeenCalledWith({
      to: '+94771234567',
      message: welcomeSms({
        ...party,
        planType: PlanType.Annual,
        amountPaid: 45000,
        nextDueDate: calculateNextDueDate(NOW, PlanType.Annual),
      }),
    })
  })

  it('sends the real 7-day reminder', async () => {
    const dueDate = new Date(NOW)
    dueDate.setDate(dueDate.getDate() + 7)

    await post(body('due'))

    expect(sendSmsViaTextLk).toHaveBeenCalledWith({
      to: '+94771234567',
      message: reminderSms(ReminderType.SevenDay, {
        ...party,
        planType: PlanType.Annual,
        amount: 45000,
        dueDate,
      }),
    })
  })

  it('sends the real receipt', async () => {
    await post(body('receipt'))

    expect(sendSmsViaTextLk).toHaveBeenCalledWith({
      to: '+94771234567',
      message: receiptSms({
        ...party,
        amountPaid: 45000,
        nextDueDate: calculateNextDueDate(NOW, PlanType.Annual),
      }),
    })
  })

  it('never sends the retired wording', async () => {
    for (const type of ['welcome', 'due', 'receipt']) {
      await post(body(type))
    }
    for (const [{ message }] of sendSmsViaTextLk.mock.calls) {
      expect(message).not.toMatch(/^Dear |Thank you - |Amount paid:/)
      expect(message).toContain('Lotus Gym')
    }
  })

  it('refuses a caller with no session (401) and sends nothing', async () => {
    getCurrentGymProfile.mockRejectedValue(new Error('Unauthorized'))

    const res = await post(body('welcome'))

    expect(res.status).toBe(401)
    expect(sendSmsViaTextLk).not.toHaveBeenCalled()
  })

  it('refuses any account but the demo one (403) and sends nothing', async () => {
    getCurrentGymProfile.mockResolvedValue({ email: 'owner@gym.lk' })

    const res = await post(body('welcome'))

    expect(res.status).toBe(403)
    expect(sendSmsViaTextLk).not.toHaveBeenCalled()
  })

  it('rejects an unknown message type (400) and sends nothing', async () => {
    const res = await post(body('promo'))

    expect(res.status).toBe(400)
    expect(sendSmsViaTextLk).not.toHaveBeenCalled()
  })
})
