/**
 * SMS templates — the one place automated member texts are worded.
 *
 * Every automated SMS names the gym (SEO-053): the sender ID is one
 * platform-wide value, so without the name a member cannot tell which gym is
 * texting them. The texts must also stay GSM-7, because a single em dash or
 * curly quote switches the whole message to UCS-2 — 70 characters a segment
 * instead of 160 — and multiplies what every gym pays per text.
 *
 * Segment budgets were agreed with the owner on 2026-10-03, measured against
 * production: gym names reach 20 characters, member names 27 at the 99th
 * percentile, plan amounts Rs.50,000 at the 99th percentile.
 */

import {
  SMS_DISCOUNT_NAME_MAX,
  SMS_GYM_NAME_MAX,
  dayPassSms,
  isGsm7,
  receiptSms,
  reminderSms,
  smsAmount,
  smsGymName,
  smsSegmentCount,
  welcomeBackSms,
  welcomeSms,
} from '../config/SmsTemplates'
import { ReminderType } from '../config/ReminderConfig'
import { PlanType } from '@/features/members/config/PlanConfig'

interface Fixture {
  gymName: string
  memberName: string
  planType: PlanType
  amount: number
  date: Date
  discount: { name: string; percentage: number }
}

/** What most texts look like. */
const TYPICAL: Fixture = {
  gymName: 'Titan Fitness',
  memberName: 'Nimal Perera',
  planType: PlanType.Monthly,
  amount: 4000,
  date: new Date(2026, 10, 15),
  discount: { name: 'Student', percentage: 10 },
}

/** The long tail: a gym name at the cap, a 99th-percentile member name. */
const LONG: Fixture = {
  gymName: 'Kotte Royal Fitness and Health', // 30 characters
  memberName: 'Nimal Perera Wickramasinghe', // 27 characters
  planType: PlanType.ThreeMonths,
  amount: 50000,
  date: new Date(2026, 10, 15),
  discount: { name: 'Students and Seniors', percentage: 15 }, // 20 characters
}

type Builder = (f: Fixture) => string

/** Every automated message, with its agreed segment budget. */
const TEMPLATES: [string, Builder, { typical: number; long: number }][] = [
  [
    'welcome',
    (f) =>
      welcomeSms({
        gymName: f.gymName,
        memberName: f.memberName,
        planType: f.planType,
        amountPaid: f.amount,
        nextDueDate: f.date,
      }),
    { typical: 2, long: 2 },
  ],
  [
    'welcome back',
    (f) =>
      welcomeBackSms({
        gymName: f.gymName,
        memberName: f.memberName,
        amountPaid: f.amount,
        nextDueDate: f.date,
      }),
    { typical: 1, long: 1 },
  ],
  [
    'receipt',
    (f) =>
      receiptSms({
        gymName: f.gymName,
        memberName: f.memberName,
        amountPaid: f.amount,
        nextDueDate: f.date,
      }),
    { typical: 1, long: 1 },
  ],
  [
    'receipt with discount',
    (f) =>
      receiptSms({
        gymName: f.gymName,
        memberName: f.memberName,
        amountPaid: f.amount,
        nextDueDate: f.date,
        discount: f.discount,
      }),
    { typical: 1, long: 2 },
  ],
  ...[ReminderType.SevenDay, ReminderType.ThreeDay, ReminderType.Overdue].map(
    (type): [string, Builder, { typical: number; long: number }] => [
      type,
      (f) =>
        reminderSms(type, {
          gymName: f.gymName,
          memberName: f.memberName,
          planType: f.planType,
          amount: f.amount,
          dueDate: f.date,
        }),
      { typical: 1, long: 2 },
    ]
  ),
  [
    ReminderType.DueToday,
    (f) =>
      reminderSms(ReminderType.DueToday, {
        gymName: f.gymName,
        memberName: f.memberName,
        planType: f.planType,
        amount: f.amount,
        dueDate: f.date,
      }),
    { typical: 1, long: 1 },
  ],
  [
    'day pass',
    (f) =>
      dayPassSms({
        gymName: f.gymName,
        memberName: f.memberName,
        amountPaid: f.amount,
        validUntil: f.date,
      }),
    { typical: 1, long: 1 },
  ],
]

describe('SMS templates — agreed wording', () => {
  it('welcomes a new member to the named gym', () => {
    expect(TEMPLATES[0][1](TYPICAL)).toBe(
      "Welcome to Titan Fitness, Nimal Perera! Your monthly membership is active and we can't wait to see you training. Paid Rs.4,000. Next due 15/11/2026. Have a great time!"
    )
  })

  it('welcomes a returning member back', () => {
    expect(TEMPLATES[1][1](TYPICAL)).toBe(
      'Welcome back to Titan Fitness, Nimal Perera! Great to have you training again. Paid Rs.4,000. Next due 15/11/2026.'
    )
  })

  it('thanks the member on a receipt, with and without a discount', () => {
    expect(TEMPLATES[2][1](TYPICAL)).toBe(
      'Titan Fitness: thank you, Nimal Perera! Payment of Rs.4,000 received. Next due 15/11/2026. Keep up the great work!'
    )
    expect(TEMPLATES[3][1](TYPICAL)).toBe(
      'Titan Fitness: thank you, Nimal Perera! Payment of Rs.4,000 received (Student 10% off). Next due 15/11/2026. Keep up the great work!'
    )
  })

  it('words each reminder for its moment', () => {
    const reminder = (type: ReminderType) =>
      reminderSms(type, {
        gymName: TYPICAL.gymName,
        memberName: TYPICAL.memberName,
        planType: TYPICAL.planType,
        amount: TYPICAL.amount,
        dueDate: TYPICAL.date,
      })

    const before =
      'Hi Nimal Perera, your monthly membership at Titan Fitness is due on 15/11/2026 (Rs.4,000). Do not forget to renew and stay consistent!'
    expect(reminder(ReminderType.SevenDay)).toBe(before)
    expect(reminder(ReminderType.ThreeDay)).toBe(before)
    expect(reminder(ReminderType.DueToday)).toBe(
      'Hi Nimal Perera, your monthly membership at Titan Fitness expires today (Rs.4,000). Renew today and stay consistent!'
    )
    expect(reminder(ReminderType.Overdue)).toBe(
      'Hi Nimal Perera, your monthly membership at Titan Fitness has expired (due 15/11/2026, Rs.4,000). Renew soon and get back to training!'
    )
  })

  it('thanks the member for a day pass', () => {
    expect(TEMPLATES[TEMPLATES.length - 1][1](TYPICAL)).toBe(
      'Titan Fitness: thank you, Nimal Perera! Day pass of Rs.4,000 received, valid until 15/11/2026. Enjoy your workout!'
    )
  })
})

describe.each(TEMPLATES)('%s', (_name, build, budget) => {
  it.each([
    ['typical', TYPICAL],
    ['long', LONG],
  ] as const)('names the gym and the member (%s)', (_label, fixture) => {
    const text = build(fixture)
    expect(text).toContain(fixture.gymName)
    expect(text).toContain(fixture.memberName)
  })

  it('carries the amount', () => {
    expect(build(TYPICAL)).toContain('Rs.4,000')
  })

  it('never says "our gym"', () => {
    expect(build(TYPICAL).toLowerCase()).not.toContain('our gym')
  })

  it.each([
    ['typical', TYPICAL],
    ['long', LONG],
  ] as const)('is GSM-7 only (%s)', (_label, fixture) => {
    expect(isGsm7(build(fixture))).toBe(true)
  })

  it('stays within its agreed segment budget', () => {
    expect(smsSegmentCount(build(TYPICAL))).toBe(budget.typical)
    expect(smsSegmentCount(build(LONG))).toBeLessThanOrEqual(budget.long)
  })
})

describe('dates', () => {
  it.each(TEMPLATES.filter(([name]) => name !== ReminderType.DueToday))(
    '%s carries the date',
    (_name, build) => {
      expect(build(TYPICAL)).toContain('15/11/2026')
    }
  )
})

describe('plan wording', () => {
  it('uses the plan label in lower case', () => {
    expect(TEMPLATES[0][1](LONG)).toContain('Your 3-month membership')
  })

  it('says only "membership" for a custom plan', () => {
    const text = TEMPLATES[0][1]({ ...TYPICAL, planType: PlanType.Custom })
    expect(text).toContain('Your membership is active')
    expect(text.toLowerCase()).not.toContain('custom')
  })
})

describe('smsGymName', () => {
  it('trims and collapses whitespace', () => {
    expect(smsGymName('  LifeLine   Fitness ')).toBe('LifeLine Fitness')
  })

  it(`caps a long name at ${SMS_GYM_NAME_MAX} characters, at the last whole word`, () => {
    const name = smsGymName(
      'The Kotte Royal Fitness and Health Centre of Excellence'
    )
    expect(name.length).toBeLessThanOrEqual(SMS_GYM_NAME_MAX)
    expect(name).toBe('The Kotte Royal Fitness and')
  })

  it('keeps the whole cap when it falls exactly on a word boundary', () => {
    expect(smsGymName('Kotte Royal Fitness and Health Gym')).toBe(
      'Kotte Royal Fitness and Health'
    )
  })

  it('drops a dangling symbol left at the cut', () => {
    expect(smsGymName('Iron Paradise Fitness Centre & Spa')).toBe(
      'Iron Paradise Fitness Centre'
    )
  })

  it('keeps closing punctuation that belongs to the name', () => {
    expect(smsGymName('Royal Fitness Centre (Kandy) Main Branch')).toBe(
      'Royal Fitness Centre (Kandy)'
    )
  })

  it('hard-cuts rather than keep less than half the cap', () => {
    expect(smsGymName(`Gym ${'Y'.repeat(40)}`)).toBe(`Gym ${'Y'.repeat(26)}`)
  })

  it('never splits an emoji in half', () => {
    const name = smsGymName(`${'X'.repeat(29)}💪💪`)
    expect(Array.from(name)).toHaveLength(SMS_GYM_NAME_MAX)
    expect(name).toBe(`${'X'.repeat(29)}💪`)
    // No lone surrogate: every high surrogate is followed by a low one.
    expect(name).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })

  it('does not leave a trailing space where the cap falls on one', () => {
    expect(smsGymName(`${'A'.repeat(29)} Gym`)).toBe('A'.repeat(29))
  })

  it('straightens smart quotes and dashes so the text stays GSM-7', () => {
    const name = smsGymName('Mike’s “Iron” Gym – Kandy')
    expect(name).toBe('Mike\'s "Iron" Gym - Kandy')
    expect(isGsm7(name)).toBe(true)
  })

  it('caps the gym name inside a built message too', () => {
    const text = TEMPLATES[2][1]({ ...TYPICAL, gymName: 'X'.repeat(80) })
    expect(text.startsWith(`${'X'.repeat(SMS_GYM_NAME_MAX)}: thank you`)).toBe(
      true
    )
  })

  it('cleans the member name the same way, without a cap', () => {
    const text = TEMPLATES[2][1]({
      ...TYPICAL,
      memberName: ' Ruwan   D’Silva  Jayasuriya Wickramasinghe Bandara ',
    })
    expect(text).toContain(
      "thank you, Ruwan D'Silva Jayasuriya Wickramasinghe Bandara!"
    )
  })
})

describe('discount names on a receipt', () => {
  const receipt = (name: string) =>
    TEMPLATES[3][1]({ ...TYPICAL, discount: { name, percentage: 10 } })

  it(`keeps a production name that the ${SMS_DISCOUNT_NAME_MAX}-character cap ends on a word`, () => {
    // The longest discount name in production on 2026-10-04 (40 characters).
    expect(receipt('Long-Standing Member Loyalty Reward Rate')).toContain(
      'received (Long-Standing Member 10% off).'
    )
  })

  it('cuts a long name at the last whole word', () => {
    expect(receipt('Early Bird Student Discount')).toContain(
      'received (Early Bird Student 10% off).'
    )
  })
})

describe('smsAmount', () => {
  it.each([
    [4000, 'Rs.4,000'],
    [800, 'Rs.800'],
    [2975.5, 'Rs.2,975.50'],
    [1000000, 'Rs.1,000,000'],
    [0.5, 'Rs.0.50'],
  ])('formats %p as %s', (amount, expected) => {
    expect(smsAmount(amount)).toBe(expected)
  })
})

describe('isGsm7 / smsSegmentCount', () => {
  it('rejects an em dash, a curly quote and an emoji', () => {
    expect(isGsm7('Thank you — see you')).toBe(false)
    expect(isGsm7('Mike’s Gym')).toBe(false)
    expect(isGsm7('Great work 💪')).toBe(false)
  })

  it('accepts the GSM-7 basic and extension tables', () => {
    expect(isGsm7("Rs.4,000 (10% off): can't wait! @ £ é")).toBe(true)
    expect(isGsm7('{curly} [square] ~ | ^ € \\')).toBe(true)
  })

  it('fits 160 GSM-7 characters in one segment and splits at 161', () => {
    expect(smsSegmentCount('a'.repeat(160))).toBe(1)
    expect(smsSegmentCount('a'.repeat(161))).toBe(2)
    expect(smsSegmentCount('a'.repeat(306))).toBe(2)
    expect(smsSegmentCount('a'.repeat(307))).toBe(3)
  })

  it('counts an extension character as two', () => {
    expect(smsSegmentCount(`${'a'.repeat(158)}€`)).toBe(1)
    expect(smsSegmentCount(`${'a'.repeat(159)}€`)).toBe(2)
  })

  it('falls back to UCS-2 limits for any non-GSM character', () => {
    expect(smsSegmentCount(`${'a'.repeat(69)}—`)).toBe(1)
    expect(smsSegmentCount(`${'a'.repeat(70)}—`)).toBe(2)
  })
})
