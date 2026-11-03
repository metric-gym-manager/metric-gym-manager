/**
 * Do the automated reminders follow an edit made in the member modal?
 *
 * The edit form changes a member's phone number, plan amount, plan type and
 * discount; the reminders cron reads members when it runs. This composes the
 * real `UpdateMemberProfile` and the real `SendAutomatedReminders` over one
 * in-memory member store, so a field either reaches the text or it does not.
 *
 * What it cannot see: Supabase. The store stands in for the `members` table, so
 * RLS, column defaults and the real query text are out of reach — those need a
 * live stack.
 */

import { UpdateMemberProfile } from '@/features/members/services/UpdateMemberProfile'
import { SendAutomatedReminders } from '@/features/sms/services/SendAutomatedReminders'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import type { IMemberRepository } from '@/features/members/services/IMemberRepository'
import {
  SMSDeliveryStatus,
  type ISMSRepository,
} from '@/features/sms/services/ISMSRepository'
import type {
  ISMSProvider,
  SMSSendResult,
} from '@/features/sms/services/ISMSProvider'
import type { IGymDirectory } from '@/features/sms/services/IGymDirectory'
import type { IDiscountDirectory } from '@/features/sms/services/IDiscountDirectory'
import {
  makeSubscription,
  mockSubscriptionRepo,
} from '@/features/subscriptions/tests/subscription-mocks'

const GYM_ID = 'gym-1'
const MEMBER_ID = 'member-1'
const OLD_PHONE = '+94770000001'
const NEW_PHONE = '+94771234567'
const DISCOUNT_ID = 'discount-10'

/** A stand-in for the `members` table that writes only what it is told to. */
function createMemberStore(initial: Member) {
  let stored = initial
  return {
    get current() {
      return stored
    },
    repo: {
      findById: jest.fn(async (id: string) =>
        id === stored.id ? stored : null
      ),
      findByPhoneNumber: jest.fn(async (phone: string) =>
        stored.phoneNumber === phone ? stored : null
      ),
      // Mirrors the real method: profile columns only, the rest stays live.
      updateProfile: jest.fn(async (edited: Member) => {
        stored = Member.fromDatabase({
          ...stored.toDatabase(),
          name: edited.name,
          phoneNumber: edited.phoneNumber,
          planType: edited.planType,
          planAmount: edited.planAmount,
          discountId: edited.discountId,
          recurringDiscount: edited.recurringDiscount,
        })
        return stored
      }),
      findAllActiveMembers: jest.fn(async () => [stored]),
      findActiveMembers: jest.fn(async () => [stored]),
    } as unknown as jest.Mocked<IMemberRepository>,
  }
}

function build(options: { providerResults?: SMSSendResult[] } = {}) {
  const store = createMemberStore(
    Member.fromDatabase({
      id: MEMBER_ID,
      gymId: GYM_ID,
      memberNumber: 7,
      name: 'Fathima Herath',
      phoneNumber: OLD_PHONE,
      planType: PlanType.Monthly,
      planAmount: 2000,
      discountId: null,
      recurringDiscount: false,
      status: MemberStatus.Active,
      registeredDate: new Date('2026-01-01'),
      membershipStartDate: new Date('2026-01-01'),
      // Yesterday: a deterministic "overdue" reminder whatever today is.
      nextDueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    })
  )

  // The log, as the cron's duplicate check sees it.
  const logged: Array<{
    memberId: string
    smsType: string
    phoneNumber: string
    messageBody: string
    deliveryStatus: SMSDeliveryStatus
  }> = []
  const smsRepo = {
    existsForToday: jest.fn(async (memberId: string, smsType: string) =>
      logged.some(
        (row) =>
          row.memberId === memberId &&
          row.smsType === smsType &&
          row.deliveryStatus !== SMSDeliveryStatus.Failed
      )
    ),
    create: jest.fn(async (row: (typeof logged)[number]) => {
      logged.push(row)
      return { id: `log-${logged.length}` }
    }),
  } as unknown as jest.Mocked<ISMSRepository>

  const queued = [...(options.providerResults ?? [])]
  const smsProvider = {
    send: jest.fn(
      async (): Promise<SMSSendResult> =>
        queued.shift() ?? { success: true, messageId: 'msg-1' }
    ),
  } as unknown as jest.Mocked<ISMSProvider>

  const subscriptionRepo = mockSubscriptionRepo()
  subscriptionRepo.findByGymId.mockResolvedValue(
    makeSubscription({ gymId: GYM_ID })
  )

  const gymDirectory: IGymDirectory = {
    findNamesByIds: async (ids) => new Map(ids.map((id) => [id, 'Iron House'])),
  }
  const discountDirectory: IDiscountDirectory = {
    findPercentagesByIds: async (ids) =>
      new Map(ids.filter((id) => id === DISCOUNT_ID).map((id) => [id, 10])),
  }

  return {
    store,
    logged,
    smsProvider,
    edit: new UpdateMemberProfile(store.repo),
    reminders: new SendAutomatedReminders(
      store.repo,
      smsRepo,
      smsProvider,
      subscriptionRepo,
      gymDirectory,
      discountDirectory
    ),
  }
}

const sentTo = (provider: jest.Mocked<ISMSProvider>) =>
  provider.send.mock.calls.map(([args]) => (args as { to: string }).to)

const sentText = (provider: jest.Mocked<ISMSProvider>) =>
  provider.send.mock.calls.map(
    ([args]) => (args as { message: string }).message
  )

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('reminders after an edit in the member modal', () => {
  it('texts the new phone number, and not the old one', async () => {
    const { edit, reminders, smsProvider } = build()

    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      phoneNumber: NEW_PHONE,
    })
    await reminders.execute()

    expect(sentTo(smsProvider)).toEqual([NEW_PHONE])
  })

  it('logs the reminder against the new phone number', async () => {
    const { edit, reminders, logged } = build()

    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      phoneNumber: NEW_PHONE,
    })
    await reminders.execute()

    expect(logged.map((row) => row.phoneNumber)).toEqual([NEW_PHONE])
  })

  it('quotes the new plan amount', async () => {
    const { edit, reminders, smsProvider } = build()

    await edit.execute({ memberId: MEMBER_ID, gymId: GYM_ID, planAmount: 3500 })
    await reminders.execute()

    const [text] = sentText(smsProvider)
    expect(text).toContain('Rs.3,500')
    expect(text).not.toContain('Rs.2,000')
  })

  it('quotes the amount after a recurring discount that was just applied', async () => {
    const { edit, reminders, smsProvider } = build()

    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      planAmount: 4000,
      discountId: DISCOUNT_ID,
      recurringDiscount: true,
    })
    await reminders.execute()

    expect(sentText(smsProvider)[0]).toContain('Rs.3,600')
  })

  it('quotes the full amount again once the discount is removed', async () => {
    const { edit, reminders, smsProvider } = build()

    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      planAmount: 4000,
      discountId: DISCOUNT_ID,
      recurringDiscount: true,
    })
    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      discountId: null,
    })
    await reminders.execute()

    expect(sentText(smsProvider)[0]).toContain('Rs.4,000')
  })

  it('uses the new name', async () => {
    const { edit, reminders, smsProvider } = build()

    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      name: 'Fathima Perera',
    })
    await reminders.execute()

    expect(sentText(smsProvider)[0]).toContain('Fathima Perera')
    expect(sentText(smsProvider)[0]).not.toContain('Herath')
  })

  it('names the new plan in the text', async () => {
    const { edit, reminders, smsProvider } = build()

    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      planType: PlanType.Annual,
      planAmount: 24000,
    })
    await reminders.execute()

    expect(sentText(smsProvider)[0]).toMatch(/annual|12-month|year/i)
    expect(sentText(smsProvider)[0]).toContain('Rs.24,000')
  })

  it('retries a failed reminder to the corrected number on the same day', async () => {
    // The usual reason a reminder fails is a wrong number. The first run fails
    // against it; the desk fixes the number; the next run must reach the new one.
    const { edit, reminders, smsProvider } = build({
      providerResults: [{ success: false, error: 'Invalid number' }],
    })

    await reminders.execute()
    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      phoneNumber: NEW_PHONE,
    })
    await reminders.execute()

    expect(sentTo(smsProvider)).toEqual([OLD_PHONE, NEW_PHONE])
  })

  it('does not send a second reminder of the same kind in one day, even to a new number (by design)', async () => {
    // One reminder per member per type per day. If the first one was
    // delivered, correcting the number afterwards does not resend it.
    const { edit, reminders, smsProvider } = build()

    await reminders.execute()
    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      phoneNumber: NEW_PHONE,
    })
    await reminders.execute()

    expect(sentTo(smsProvider)).toEqual([OLD_PHONE])
  })

  it('leaves the due date and status alone, so the edit changes only what was edited', async () => {
    const { edit, store } = build()
    const before = store.current

    await edit.execute({
      memberId: MEMBER_ID,
      gymId: GYM_ID,
      phoneNumber: NEW_PHONE,
    })

    expect(store.current.status).toBe(before.status)
    expect(store.current.nextDueDate).toEqual(before.nextDueDate)
  })
})
