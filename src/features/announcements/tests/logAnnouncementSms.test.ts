/**
 * @jest-environment node
 */

/**
 * Announcement SMS are logged as `announcement`.
 *
 * Until 2026-10-04 they were logged as `welcome` (the `sms_type` enum had no
 * announcement value), so 401 announcement texts sat in members' SMS history
 * as welcome messages and inflated every count of welcome texts sent.
 */

import { logAnnouncementSms } from '../services/announcement.service'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'
import type { ISMSRepository } from '@/features/sms/services/ISMSRepository'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

describe('logAnnouncementSms', () => {
  it('logs the message as an announcement', async () => {
    const smsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    } as unknown as jest.Mocked<ISMSRepository>

    await logAnnouncementSms(smsRepo, {
      memberId: 'm-1',
      gymId: 'gym-1',
      phoneNumber: '+94771234567',
      messageBody: 'Gym closed tomorrow.\n- Titan Fitness',
      deliveryStatus: SMSDeliveryStatus.Sent,
      textLkMessageId: 'vendor-1',
    })

    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        smsType: 'announcement',
        messageBody: 'Gym closed tomorrow.\n- Titan Fitness',
        deliveryStatus: SMSDeliveryStatus.Sent,
      })
    )
  })

  it('never fails the send when the log write fails', async () => {
    const smsRepo = {
      create: jest.fn().mockRejectedValue(new Error('insert refused')),
    } as unknown as jest.Mocked<ISMSRepository>

    await expect(
      logAnnouncementSms(smsRepo, {
        memberId: 'm-1',
        gymId: 'gym-1',
        phoneNumber: '+94771234567',
        messageBody: 'Hi',
        deliveryStatus: SMSDeliveryStatus.Failed,
        errorMessage: 'No credits',
      })
    ).resolves.toBeUndefined()
  })
})
