/**
 * Content stress fixtures (mobile rebuild plan §28).
 *
 * Seeded through the app's **own APIs** on the E2E Enterprise gym — never by
 * writing rows — and idempotent by name, so every viewport run can call
 * `ensureStressFixtures` and the second call costs a handful of GETs.
 *
 * ## What the API will and will not accept
 *
 * Two §28 values cannot be seeded, because the Zod schemas the routes enforce
 * cap them: `addMemberSchema` limits `planAmount`/`paymentAmount` to
 * 1,000,000, and `createAnnouncementSchema` limits a message to 160
 * characters. Seeding past those would mean bypassing validation, which is
 * exactly the door the fixtures must not open. So the seed carries the
 * largest values the product accepts (a 1,000,000 plan and payment; a 160-char
 * message with newlines), and the over-limit values — 12,345,678 /
 * 99,999,999, the 320-char SMS, the 20-character phone string, the
 * 128 / 1,024 tab badges — are exported in {@link TEST_ONLY_RENDER} for the
 * jsdom primitive tests, which render props directly. Recorded as an
 * implementation exception in the tracker.
 *
 * ## What each fixture is for (§28)
 *
 * | Fixture                                   | Validates                              |
 * | ----------------------------------------- | -------------------------------------- |
 * | 29-char member name, on a 40-char discount| `ListRow` clamp, AppBar/modal title, meta truncation |
 * | 1,000,000 plan + payment                  | value column width, KPI wrap, breakdown|
 * | 300 members, 100 of them overdue          | pagination, list height, probe runtime |
 * | one member 299+ days overdue              | status line "N DAYS AGO" width         |
 * | one 6-month member started 2026-08-16     | the fixed "2027-02-16" due date        |
 * | a member registered in the last 7 days    | NEW badge + status badge stacking      |
 * | announcement with newlines                | delivery-log clamp + expand            |
 * | empty remarks / no discount / no photo    | "—" rendering (every bulk member)      |
 * | two row actions                           | dense button wrap at 320 (every due)   |
 *
 * The NEW-badge member is the one fixture that ages out: `isNewMember` reads
 * `created_at` against a 7-day window, so when the seeded member is older
 * than that it is deleted and re-registered through the same routes.
 */

import type { APIRequestContext } from '@playwright/test'

// ── Names are the idempotency key. Keep them unlikely to collide. ──────────

export const STRESS = {
  /** 30 characters (§28 says 29; this is the plan's own name, verbatim). */
  longName: 'Wickramasinghe Arachchige Dona',
  /** Exactly 40 characters. */
  longDiscountName: 'Long-Standing Member Loyalty Reward Rate',
  longDiscountPercent: 10,
  /** The largest amount `addMemberSchema` accepts. */
  maxAmount: 1_000_000,
  maxAmountMember: 'Stress Max Amount Member',
  /** ≥ 299 days overdue at seed time (a three-digit "DAYS AGO"). */
  overdueDays: 299,
  overdueMember: 'Stress 299 Days Overdue',
  /** 6-month plan from 2026-08-16 → next due 2027-02-16 (blueprint §26). */
  fixedDueMember: 'Stress Fixed Due 2027-02-16',
  fixedDueStart: '2026-08-16',
  /** Registered within `NEW_MEMBER_DAYS`; refreshed when it ages out. */
  newBadgeMember: 'Stress New Badge Member',
  newBadgeWindowDays: 7,
  /** Bulk population: `bulkCount` members, the first `dueCount` overdue. */
  bulkPrefix: 'Stress Member',
  bulkCount: 300,
  dueCount: 100,
  /** ≤ 160 characters, with newlines (the announcement cap). */
  announcement:
    'Gym closed tomorrow for maintenance.\nWe reopen Monday at 6 AM.\nThank you for your patience.',
} as const

/**
 * §28 values the product's validation will not accept from a client. They
 * exist for jsdom tests that render a primitive with these props directly.
 */
export const TEST_ONLY_RENDER = {
  /** 20 characters. Sri Lankan numbers are fixed-length; this is not one. */
  phone20: '+94 77 123 4567 x999',
  planAmount: 12_345_678,
  paymentAmount: 99_999_999,
  /** 320 characters: two SMS segments. */
  sms320: (
    'Reminder: your membership at Metric Gym is due for renewal this week. ' +
    'Please visit the front desk or reply to this message to renew. ' +
    'Bring your member ID. Thank you for training with us and see you soon at the gym!'
  )
    .padEnd(320, ' Stay strong.')
    .slice(0, 320),
  tabCounts: [128, 1024] as const,
} as const

export interface StressSeedReport {
  created: string[]
  skipped: string[]
  failed: string[]
  memberCount: number
}

// ── Small API layer over the app's routes ───────────────────────────────────

interface ApiMember {
  id: string
  name: string
  createdAt: string
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

const daysAgo = (n: number) => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

/** A monthly plan is due one month after it starts. */
const monthBefore = (d: Date) => {
  const c = new Date(d)
  c.setUTCMonth(c.getUTCMonth() - 1)
  return c
}

/** Deterministic, valid (07x) and unique per index. */
const phoneFor = (i: number) => `0779${String(100_000 + i).padStart(6, '0')}`

async function expectOk(
  res: { ok(): boolean; status(): number; text(): Promise<string> },
  what: string
): Promise<void> {
  if (!res.ok()) {
    throw new Error(
      `${what}: ${res.status()} ${(await res.text()).slice(0, 300)}`
    )
  }
}

async function findMembers(
  api: APIRequestContext,
  search: string
): Promise<ApiMember[]> {
  const out: ApiMember[] = []
  for (let page = 1; page <= 20; page += 1) {
    const res = await api.get('/api/members', {
      params: { search, limit: 100, page },
    })
    await expectOk(res, `GET /api/members?search=${search}`)
    const body = (await res.json()) as {
      data: { members: ApiMember[]; totalPages: number }
    }
    out.push(...body.data.members)
    if (page >= body.data.totalPages) break
  }
  return out
}

interface RegisterInput {
  name: string
  phoneNumber: string
  planType: 'daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual'
  planAmount: number
  membershipStartDate: string
  discountId?: string
  recurringDiscount?: boolean
}

const registrationBody = (m: RegisterInput) => ({
  ...m,
  paymentAmount: m.planAmount,
  acceptedTerms: true,
  acceptedGymRules: true,
})

async function registerOne(
  api: APIRequestContext,
  m: RegisterInput
): Promise<void> {
  const res = await api.post('/api/members', { data: registrationBody(m) })
  await expectOk(res, `POST /api/members (${m.name})`)
}

/** Up to 50 per request — the bulk route's own limit. */
async function registerMany(
  api: APIRequestContext,
  members: RegisterInput[]
): Promise<{ succeeded: string[]; failed: string[] }> {
  const succeeded: string[] = []
  const failed: string[] = []
  for (let i = 0; i < members.length; i += 50) {
    const batch = members.slice(i, i + 50)
    const res = await api.post('/api/members/bulk', {
      data: { members: batch.map(registrationBody) },
    })
    await expectOk(res, 'POST /api/members/bulk')
    const body = (await res.json()) as {
      data: {
        results: Array<{ name: string; success: boolean; error?: string }>
      }
    }
    for (const r of body.data.results) {
      if (r.success) succeeded.push(r.name)
      else failed.push(`${r.name}: ${r.error ?? 'failed'}`)
    }
  }
  return { succeeded, failed }
}

async function ensureDiscount(
  api: APIRequestContext,
  report: StressSeedReport
): Promise<string> {
  const list = await api.get('/api/billing-setup/discounts')
  await expectOk(list, 'GET /api/billing-setup/discounts')
  const body = (await list.json()) as {
    data: Array<{ id: string; discount_name: string }>
  }
  const existing = body.data.find(
    (d) => d.discount_name === STRESS.longDiscountName
  )
  if (existing) {
    report.skipped.push(`discount "${STRESS.longDiscountName}"`)
    return existing.id
  }
  const res = await api.post('/api/billing-setup/discounts', {
    data: {
      discount_name: STRESS.longDiscountName,
      discount_percentage: STRESS.longDiscountPercent,
      is_active: true,
    },
  })
  await expectOk(res, 'POST /api/billing-setup/discounts')
  const created = (await res.json()) as { data: { id: string } }
  report.created.push(`discount "${STRESS.longDiscountName}"`)
  return created.data.id
}

async function ensureAnnouncement(
  api: APIRequestContext,
  report: StressSeedReport
): Promise<void> {
  const list = await api.get('/api/announcements')
  await expectOk(list, 'GET /api/announcements')
  const body = (await list.json()) as { data: Array<{ message: string }> }
  if (body.data.some((a) => a.message === STRESS.announcement)) {
    report.skipped.push('announcement with newlines')
    return
  }
  // Mocked SMS only (ENABLE_REAL_SMS=false); the rows land in sms_logs.
  const res = await api.post('/api/announcements', {
    data: { message: STRESS.announcement, audience: 'all' },
  })
  await expectOk(res, 'POST /api/announcements')
  report.created.push('announcement with newlines')
}

async function ensureNamedMember(
  api: APIRequestContext,
  report: StressSeedReport,
  existing: Map<string, ApiMember>,
  m: RegisterInput
): Promise<void> {
  if (existing.has(m.name)) {
    report.skipped.push(m.name)
    return
  }
  await registerOne(api, m)
  report.created.push(m.name)
}

/**
 * Seed every §28 fixture that the API accepts; skip whatever already exists.
 *
 * @param api - A request context that shares the signed-in gym's cookies
 *   (`page.request` after `loginAsEnterpriseGym`).
 */
export async function ensureStressFixtures(
  api: APIRequestContext
): Promise<StressSeedReport> {
  const report: StressSeedReport = {
    created: [],
    skipped: [],
    failed: [],
    memberCount: 0,
  }

  const discountId = await ensureDiscount(api, report)

  // One search covers every named fixture ("Stress …") and the long name.
  const stress = await findMembers(api, 'Stress')
  const named = new Map<string, ApiMember>()
  for (const m of stress) named.set(m.name, m)
  for (const m of await findMembers(api, STRESS.longName)) named.set(m.name, m)

  // Long name + 40-char discount, recurring so the name shows on the member.
  await ensureNamedMember(api, report, named, {
    name: STRESS.longName,
    phoneNumber: phoneFor(1),
    planType: 'monthly',
    planAmount: 3_500,
    membershipStartDate: ymd(daysAgo(10)),
    discountId,
    recurringDiscount: true,
  })

  // Largest amount the schema allows.
  await ensureNamedMember(api, report, named, {
    name: STRESS.maxAmountMember,
    phoneNumber: phoneFor(2),
    planType: 'annual',
    planAmount: STRESS.maxAmount,
    membershipStartDate: ymd(daysAgo(3)),
  })

  // 299+ days overdue: monthly, started a month before the due date.
  await ensureNamedMember(api, report, named, {
    name: STRESS.overdueMember,
    phoneNumber: phoneFor(3),
    planType: 'monthly',
    planAmount: 3_500,
    membershipStartDate: ymd(monthBefore(daysAgo(STRESS.overdueDays))),
  })

  // Fixed due date 2027-02-16.
  await ensureNamedMember(api, report, named, {
    name: STRESS.fixedDueMember,
    phoneNumber: phoneFor(4),
    planType: '6-months',
    planAmount: 16_000,
    membershipStartDate: STRESS.fixedDueStart,
  })

  // NEW badge: must have been created within the window; refresh otherwise.
  const newBadge = named.get(STRESS.newBadgeMember)
  const ageDays = newBadge
    ? (Date.now() - new Date(newBadge.createdAt).getTime()) / 86_400_000
    : Infinity
  if (newBadge && ageDays > STRESS.newBadgeWindowDays - 1) {
    const del = await api.delete(`/api/members/${newBadge.id}`)
    await expectOk(del, `DELETE /api/members/${newBadge.id}`)
    named.delete(STRESS.newBadgeMember)
    report.created.push(
      `${STRESS.newBadgeMember} (refreshed: ${Math.floor(ageDays)}d old)`
    )
  }
  await ensureNamedMember(api, report, named, {
    name: STRESS.newBadgeMember,
    phoneNumber: phoneFor(5),
    planType: 'weekly',
    planAmount: 1_200,
    membershipStartDate: ymd(daysAgo(0)),
  })

  // Bulk population: 300 members, the first 100 overdue by 1–200 days, the
  // rest active with a due date inside the next month.
  const have = new Set(
    stress
      .map((m) => m.name)
      .filter((n) => n.startsWith(`${STRESS.bulkPrefix} `))
  )
  const missing: RegisterInput[] = []
  for (let i = 0; i < STRESS.bulkCount; i += 1) {
    const name = `${STRESS.bulkPrefix} ${String(i + 1).padStart(3, '0')}`
    if (have.has(name)) continue
    const overdue = i < STRESS.dueCount
    const start = overdue
      ? monthBefore(daysAgo(1 + ((i * 2) % 200)))
      : daysAgo(i % 28)
    missing.push({
      name,
      phoneNumber: phoneFor(100 + i),
      planType: 'monthly',
      planAmount: 3_500,
      membershipStartDate: ymd(start),
    })
  }
  if (missing.length) {
    const { succeeded, failed } = await registerMany(api, missing)
    report.created.push(`${succeeded.length} bulk members`)
    report.failed.push(...failed)
  } else {
    report.skipped.push(`${STRESS.bulkCount} bulk members`)
  }

  await ensureAnnouncement(api, report)

  report.memberCount = (await findMembers(api, 'Stress')).length
  return report
}
