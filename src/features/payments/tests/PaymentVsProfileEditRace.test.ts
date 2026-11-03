/**
 * A payment and a profile edit landing in the same moment must both survive.
 *
 * Collecting a payment reads the member, computes the next due date, then
 * writes. It used to write the WHOLE member row back, so a profile edit made
 * between the read and the write (a new phone number, a changed fee) was put
 * back to what the payment had read. This drives that interleaving
 * deterministically: the edit lands while the payment holds its stale copy.
 *
 * The real `CollectPayment`, `IssueDayPass` and `UpdateMemberProfile` run over
 * one in-memory member store. The store stands in for the `members` table, so
 * RLS, column defaults and the real query text are out of reach; a live stack
 * is the only thing that can see those.
 */

import { CollectPayment } from '../services/CollectPayment'
import { IssueDayPass } from '../services/IssueDayPass'
import { UpdateMemberProfile } from '@/features/members/services/UpdateMemberProfile'
import { Member, type MemberProps } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { createMemberStore } from '@/test-utils/memberStore'

const GYM_ID = 'gym-1'
const MEMBER_ID = 'member-1'
const OLD_PHONE = '+94770000001'
const NEW_PHONE = '+94771234567'

const daysFromToday = (days: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

function memberFixture(overrides: Partial<MemberProps> = {}) {
  return Member.fromDatabase({
    id: MEMBER_ID,
    gymId: GYM_ID,
    memberNumber: 7,
    name: 'Fathima Herath',
    phoneNumber: OLD_PHONE,
    planType: PlanType.Monthly,
    planAmount: 3500,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Active,
    registeredDate: daysFromToday(-180),
    membershipStartDate: daysFromToday(-180),
    nextDueDate: daysFromToday(3),
    createdAt: daysFromToday(-180),
    updatedAt: daysFromToday(-180),
    ...overrides,
  })
}

function build(memberOverrides: Partial<MemberProps> = {}) {
  const store = createMemberStore(memberFixture(memberOverrides))
  const paymentRepo = { create: jest.fn(async (p: unknown) => p) }
  const smsProvider = {
    send: jest.fn(async () => ({ success: true, messageId: 'msg-1' })),
  }
  const smsRepo = { create: jest.fn(async () => ({ id: 'log-1' })) }

  return {
    store,
    paymentRepo,
    smsProvider,
    smsRepo,
    collect: new CollectPayment(
      store.repo as never,
      paymentRepo as never,
      smsProvider as never,
      smsRepo as never
    ),
    dayPass: new IssueDayPass(
      store.repo as never,
      paymentRepo as never,
      smsProvider as never,
      smsRepo as never
    ),
    edit: new UpdateMemberProfile(store.repo as never),
  }
}

const payment = {
  gymId: GYM_ID,
  gymName: 'Iron House',
  memberId: MEMBER_ID,
  paymentDate: daysFromToday(0),
  paymentAmount: 3500,
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('payment collection racing a profile edit', () => {
  it('keeps the edit and applies the payment', async () => {
    const { store, collect, edit } = build()
    const originalDue = store.current.nextDueDate

    store.duringNextRead(async () => {
      await edit.execute({
        memberId: MEMBER_ID,
        gymId: GYM_ID,
        name: 'Fathima Perera',
        phoneNumber: NEW_PHONE,
        planAmount: 4500,
      })
    })

    await collect.execute(payment)

    // The edit survived…
    expect(store.current.name).toBe('Fathima Perera')
    expect(store.current.phoneNumber).toBe(NEW_PHONE)
    expect(store.current.planAmount).toBe(4500)
    // …and so did the payment.
    expect(store.current.status).toBe(MemberStatus.Active)
    expect(store.current.nextDueDate.getTime()).toBeGreaterThan(
      originalDue.getTime()
    )
  })

  it('sends the receipt to the number the member has now', async () => {
    const { store, collect, edit, smsProvider } = build()

    store.duringNextRead(async () => {
      await edit.execute({
        memberId: MEMBER_ID,
        gymId: GYM_ID,
        name: 'Fathima Perera',
        phoneNumber: NEW_PHONE,
      })
    })

    await collect.execute(payment)

    const [sent] = smsProvider.send.mock.calls[0] as unknown as [
      { to: string; message: string },
    ]
    expect(sent.to).toBe(NEW_PHONE)
    expect(sent.message).toContain('Fathima Perera')
  })

  it('keeps a phone edit when the payment also switches the plan', async () => {
    // A reactivation is the only payment that switches the plan.
    const { store, collect, edit } = build({
      status: MemberStatus.Expired,
      nextDueDate: daysFromToday(-20),
    })

    store.duringNextRead(async () => {
      await edit.execute({
        memberId: MEMBER_ID,
        gymId: GYM_ID,
        phoneNumber: NEW_PHONE,
      })
    })

    await collect.execute({
      ...payment,
      planType: PlanType.Annual,
      planAmount: 40000,
    })

    expect(store.current.phoneNumber).toBe(NEW_PHONE)
    expect(store.current.planType).toBe(PlanType.Annual)
    expect(store.current.planAmount).toBe(40000)
    expect(store.current.status).toBe(MemberStatus.Active)
  })
})

describe('day pass racing a profile edit', () => {
  it('keeps the edit and applies the day pass', async () => {
    const { store, dayPass, edit } = build({
      status: MemberStatus.Expired,
      nextDueDate: daysFromToday(-10),
    })

    store.duringNextRead(async () => {
      await edit.execute({
        memberId: MEMBER_ID,
        gymId: GYM_ID,
        name: 'Fathima Perera',
        phoneNumber: NEW_PHONE,
      })
    })

    await dayPass.execute({
      gymId: GYM_ID,
      gymName: 'Iron House',
      memberId: MEMBER_ID,
      amount: 500,
    })

    expect(store.current.name).toBe('Fathima Perera')
    expect(store.current.phoneNumber).toBe(NEW_PHONE)
    expect(store.current.status).toBe(MemberStatus.Active)
  })
})
