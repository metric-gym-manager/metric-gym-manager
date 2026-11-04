/**
 * Fixed API payloads for the 1366 desktop regression baselines.
 *
 * The baselines used to be live screenshots of the E2E gym, and live data
 * decays: the nightly crons expired and then cancelled the 300 seeded stress
 * members, so a re-baseline in November 2026 pictured one renewal row where
 * the September one had a hundred (release-1.6.2-inverted-check.md R4).
 * Keeping the members "paid" through the app is not side-effect free — a
 * payment texts a receipt, and the E2E gym has a live door-access account —
 * so the spec now intercepts the screens' own API calls and answers them from
 * one synthetic gym, on a frozen clock.
 *
 * Every payload is built by the product's own producers where one exists
 * (`serializeMemberForAPI`, `computeMemberAnalytics`, `countOverdueTiers`,
 * `effectivePlanAmount`, `resolveAccessDecision`) and typed by the producer's
 * return type where one is exported, so a payload that drifts from the API is
 * a `tsc` failure rather than a picture of a screen that cannot exist.
 *
 * Only `/api/auth/profile` reaches the real server: the shell is rendered
 * server-side from the signed-in gym, and the client copy must agree with it.
 * Any other request the spec did not expect is recorded and fails the test.
 *
 * **The frozen clock is the browser's alone.** The dev server is shared and
 * renders today's date, so every server-rendered date ("Revenue · October",
 * the month pickers) differs from the client's, and React regenerates those
 * trees on the client with a hydration error. That error is made by this
 * setup, not by the product: the picture is the client render, the one a user
 * sees when both sides agree. `hide-dev-overlay.css` keeps the error count
 * out of the screenshot. Freezing the server too would need a dev server of
 * its own, and this directory refuses a second one.
 */

import type { Page, Route } from '@playwright/test'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import { serializeMemberForAPI } from '@/features/members/utils/serializeMemberForAPI'
import { effectivePlanAmount } from '@/features/members/utils/effectivePlanAmount'
import { computeMemberAnalytics } from '@/features/analytics/utils/aggregate'
import { countOverdueTiers } from '@/features/revenue/domain/OverdueTiers'
import { ReminderType } from '@/features/sms/config/ReminderConfig'
import {
  describeAccessDenial,
  resolveAccessDecision,
} from '@/features/access-control/domain/AccessDecision'
import { formatCalendarDate } from '@/features/access-control/utils/getGymToday'
import type { DashboardMetrics } from '@/features/revenue/services/metrics.service'
import type { ReminderQueueResult } from '@/features/sms/services/reminder-queue.service'
import type { MonthlyRevenueResponse } from '@/features/revenue/types'
import type { AnalyticsRange } from '@/features/analytics/types'
import type { MemberDetailResponse, Payment } from '@/features/members/types'
import type { MemberAccessStatus } from '@/features/access-control/types'
import type { PlanEnrolment } from '@/features/members/services/member-queries.service'
import { STRESS } from './stress-fixtures'

type Reports =
  typeof import('@/features/payments/services/payment-reports.service')
type CollectedPayments = Awaited<ReturnType<Reports['getCollectedPayments']>>
type RegularPayments = Awaited<ReturnType<Reports['getRegularPayments']>>

/** The frozen "now": 15 October 2026, 10:00 in Colombo. */
export const FIXED_NOW = new Date('2026-10-15T04:30:00.000Z')
const TODAY = '2026-10-15'
const GYM_OPENED = '2025-06-01'

const GYM_ID = '00000000-0000-4000-8000-0000000e2e00'
const DISCOUNT = {
  id: '00000000-0000-4000-8000-00000000d15c',
  discount_name: STRESS.longDiscountName,
  discount_percentage: STRESS.longDiscountPercent,
}

// ── Calendar arithmetic on YYYY-MM-DD, in UTC ────────────────────────────────

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function addMonths(iso: string, months: number): string {
  const [y, m, day] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate()
  target.setUTCDate(Math.min(day, last))
  return target.toISOString().slice(0, 10)
}

/** One period of a plan, forwards (`k` > 0) or backwards. */
function addPeriods(iso: string, plan: PlanType, k: number): string {
  switch (plan) {
    case PlanType.Daily:
      return addDays(iso, k)
    case PlanType.Weekly:
      return addDays(iso, 7 * k)
    case PlanType.ThreeMonths:
      return addMonths(iso, 3 * k)
    case PlanType.SixMonths:
      return addMonths(iso, 6 * k)
    case PlanType.Annual:
      return addMonths(iso, 12 * k)
    default:
      return addMonths(iso, k)
  }
}

const uuid = (prefix: string, n: number) =>
  `00000000-0000-4000-${prefix}-${String(n).padStart(12, '0')}`

// ── One synthetic gym ────────────────────────────────────────────────────────

interface Seed {
  name: string
  plan: PlanType
  amount: number
  status: MemberStatus
  /** The day the member first walked in. */
  registered: string
  nextDue: string
  discount?: boolean
}

interface FixtureMember {
  id: string
  number: number
  seed: Seed
  start: string
  createdAt: string
  phone: string
  /** Paid periods, oldest first: [paid on, covers until]. */
  periods: [string, string][]
}

function bulkSeed(i: number): Seed {
  const plan =
    i % 25 === 0
      ? PlanType.Annual
      : i % 25 === 1
        ? PlanType.SixMonths
        : // A weekly member is never weeks ahead, so only among those due
          // within the week or already overdue.
          i % 10 === 9 && i < STRESS.dueCount + 34
          ? PlanType.Weekly
          : PlanType.Monthly
  const amount =
    plan === PlanType.Annual
      ? 36_000
      : plan === PlanType.SixMonths
        ? 18_000
        : plan === PlanType.Weekly
          ? 1_200
          : 3_500
  // 100 expired, overdue by 1–13 days (the cron cancels at 14, so no more);
  // 34 due this week; the rest due later.
  const nextDue =
    i < STRESS.dueCount
      ? addDays(TODAY, -(1 + (i % 13)))
      : i < STRESS.dueCount + 34
        ? addDays(TODAY, (i - STRESS.dueCount) % 8)
        : addDays(TODAY, 8 + (i % 50))
  return {
    name: `${STRESS.bulkPrefix} ${String(i + 1).padStart(3, '0')}`,
    plan,
    amount,
    status: i < STRESS.dueCount ? MemberStatus.Expired : MemberStatus.Active,
    // Joined across the gym's first sixteen months, June 2025 onwards.
    registered: addDays(GYM_OPENED, Math.floor(i * 1.6)),
    nextDue,
  }
}

/**
 * Members who stopped paying during 2026 and were cancelled by the overdue
 * cron. Without them the year has no churn to speak of, and with the gym's
 * whole base joining inside the window its rates divide by almost nobody.
 */
function formerSeed(i: number): Seed {
  return {
    name: `Former Member ${String(i + 1).padStart(2, '0')}`,
    plan: PlanType.Monthly,
    amount: 3_500,
    status: MemberStatus.Cancelled,
    registered: addDays(GYM_OPENED, i * 5),
    nextDue: addDays('2026-01-10', i * 12),
  }
}

/**
 * The established base: joined in 2025, still paying, next due beyond this
 * week. A gym carrying a hundred overdue members has several hundred who are
 * not, and the analytics divide by them.
 */
function baseSeed(i: number): Seed {
  return {
    name: `Member ${String(i + 1).padStart(3, '0')}`,
    plan: PlanType.Monthly,
    amount: 3_500,
    status: MemberStatus.Active,
    registered: addDays(GYM_OPENED, Math.floor(i * 0.53)),
    nextDue: addDays(TODAY, 8 + (i % 30)),
  }
}

const SEEDS: Seed[] = [
  ...Array.from({ length: 400 }, (_, i) => baseSeed(i)),
  ...Array.from({ length: STRESS.bulkCount }, (_, i) => bulkSeed(i)),
  ...Array.from({ length: 20 }, (_, i) => formerSeed(i)),
  {
    name: STRESS.longName,
    plan: PlanType.Monthly,
    amount: 3_500,
    status: MemberStatus.Active,
    registered: '2026-03-02',
    nextDue: addDays(TODAY, 12),
    discount: true,
  },
  {
    name: STRESS.maxAmountMember,
    plan: PlanType.Annual,
    amount: STRESS.maxAmount,
    status: MemberStatus.Active,
    registered: addDays(TODAY, -3),
    nextDue: addMonths(addDays(TODAY, -3), 12),
  },
  {
    name: STRESS.overdueMember,
    plan: PlanType.Monthly,
    amount: 3_500,
    status: MemberStatus.Cancelled,
    registered: '2025-11-20',
    nextDue: addDays(TODAY, -STRESS.overdueDays),
  },
  {
    name: STRESS.fixedDueMember,
    plan: PlanType.SixMonths,
    amount: 16_000,
    status: MemberStatus.Active,
    registered: STRESS.fixedDueStart,
    nextDue: '2027-02-16',
  },
  {
    name: STRESS.newBadgeMember,
    plan: PlanType.Weekly,
    amount: 1_200,
    status: MemberStatus.Active,
    registered: TODAY,
    nextDue: addDays(TODAY, 7),
  },
]

/** Walk back from the due date in whole periods to the registration. */
function paidPeriods(seed: Seed): [string, string][] {
  const starts: string[] = []
  let k = 1
  for (;;) {
    const start = addPeriods(seed.nextDue, seed.plan, -k)
    if (start < seed.registered && starts.length) break
    starts.unshift(start)
    if (start <= seed.registered) break
    k += 1
  }
  return starts.map((s) => [s, addPeriods(s, seed.plan, 1)])
}

const MEMBERS: FixtureMember[] = SEEDS.map((seed, i) => {
  const periods = paidPeriods(seed)
  return {
    id: uuid('8000', i + 1),
    number: i + 1,
    seed,
    start: periods[0][0],
    createdAt:
      seed.registered === TODAY
        ? new Date(FIXED_NOW.getTime() - 2 * 3_600_000).toISOString()
        : `${seed.registered}T03:00:00.000Z`,
    phone: `07${String(71_000_000 + i).padStart(8, '0')}`,
    periods,
  }
})

const amountOf = (m: FixtureMember) =>
  effectivePlanAmount({
    planAmount: m.seed.amount,
    recurringDiscount: Boolean(m.seed.discount),
    discountPercentage: m.seed.discount ? DISCOUNT.discount_percentage : null,
  })

/** Every payment the gym took, newest first. */
const PAYMENTS = MEMBERS.flatMap((m) =>
  m.periods.map(([paidOn, coversUntil], j) => ({
    id: uuid('9000', m.number * 100 + j),
    member: m,
    paidOn,
    coversUntil,
    amount: amountOf(m),
  }))
)
  .filter((p) => p.paidOn <= TODAY)
  .sort((a, b) => (a.paidOn < b.paidOn ? 1 : a.paidOn > b.paidOn ? -1 : 0))

function toEntity(m: FixtureMember): Member {
  const created = new Date(m.createdAt)
  return Member.fromDatabase({
    id: m.id,
    gymId: GYM_ID,
    memberNumber: m.number,
    name: m.seed.name,
    phoneNumber: m.phone,
    planType: m.seed.plan,
    planAmount: m.seed.amount,
    discountId: m.seed.discount ? DISCOUNT.id : null,
    recurringDiscount: Boolean(m.seed.discount),
    status: m.seed.status,
    registeredDate: new Date(`${m.start}T00:00:00Z`),
    membershipStartDate: new Date(`${m.start}T00:00:00Z`),
    nextDueDate: new Date(`${m.seed.nextDue}T00:00:00Z`),
    createdAt: created,
    updatedAt: created,
    photoPath: null,
    photoUpdatedAt: null,
    registrationSource: RegistrationSource.Manual,
    verifiedAt: null,
    remarks: null,
    acceptedTermsAt: created,
    acceptedGymRulesAt: created,
    biometricConsentAt: null,
  })
}

const monthOf = (iso: string) => iso.slice(0, 7)
const isBillable = (m: FixtureMember) =>
  m.seed.status === MemberStatus.Active ||
  m.seed.status === MemberStatus.Expired
const daysUntil = (iso: string) =>
  Math.round(
    (new Date(`${iso}T00:00:00Z`).getTime() -
      new Date(`${TODAY}T00:00:00Z`).getTime()) /
      86_400_000
  )

// ── Payloads ─────────────────────────────────────────────────────────────────

function membersList(params: URLSearchParams) {
  const page = Number(params.get('page') ?? 1)
  const limit = Number(params.get('limit') ?? 20)
  const search = (params.get('search') ?? '').toLowerCase()
  const status = params.get('status')
  const rows = MEMBERS.filter(
    (m) =>
      (!search ||
        m.seed.name.toLowerCase().includes(search) ||
        m.phone.includes(search)) &&
      (!status || m.seed.status === status)
  ).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return {
    members: rows
      .slice((page - 1) * limit, page * limit)
      .map((m) =>
        serializeMemberForAPI(toEntity(m), m.seed.discount ? DISCOUNT : null)
      ),
    totalCount: rows.length,
    page,
    totalPages: Math.max(1, Math.ceil(rows.length / limit)),
  }
}

function memberDetail(m: FixtureMember) {
  const member: MemberDetailResponse['member'] & Record<string, unknown> = {
    id: m.id,
    gym_id: GYM_ID,
    member_number: m.number,
    name: m.seed.name,
    phone_number: m.phone,
    // No seed is on a custom plan, the one value this column type excludes.
    plan_type: m.seed.plan as MemberDetailResponse['member']['plan_type'],
    plan_amount: m.seed.amount,
    discount_id: m.seed.discount ? DISCOUNT.id : null,
    recurring_discount: Boolean(m.seed.discount),
    status: m.seed.status,
    registered_date: m.start,
    membership_start_date: m.start,
    next_due_date: m.seed.nextDue,
    created_at: m.createdAt,
    updated_at: m.createdAt,
    photo_path: null,
    photo_updated_at: null,
    registration_source: 'manual',
    verified_at: null,
    remarks: null,
    accepted_terms_at: m.createdAt,
    accepted_gym_rules_at: m.createdAt,
    biometric_consent_at: null,
    discount: m.seed.discount ? DISCOUNT : undefined,
  }
  const payments: (Payment & { gym_id: string; admission_fee: number })[] =
    PAYMENTS.filter((p) => p.member === m).map((p) => ({
      id: p.id,
      member_id: m.id,
      payment_date: p.paidOn,
      amount_paid: p.amount,
      discount_applied: m.seed.discount ? DISCOUNT.discount_name : null,
      discount_percentage: m.seed.discount
        ? DISCOUNT.discount_percentage
        : null,
      next_due_date_calculated: p.coversUntil,
      created_at: `${p.paidOn}T04:00:00.000Z`,
      gym_id: GYM_ID,
      payment_type: 'plan_payment',
      admission_fee: 0,
    }))
  return { member, payments }
}

function accessStatus(m: FixtureMember): MemberAccessStatus {
  const decision = resolveAccessDecision({
    status: m.seed.status,
    membershipStartDate: new Date(`${m.start}T00:00:00Z`),
    nextDueDate: new Date(`${m.seed.nextDue}T00:00:00Z`),
    registrationSource: RegistrationSource.Manual,
    verifiedAt: null,
    today: FIXED_NOW,
  })
  return {
    memberId: m.id,
    subjectId: null,
    allowed: decision.allowed,
    explanation: decision.allowed
      ? 'Access is active'
      : describeAccessDenial(decision.reason),
    fingerEnrolled: false,
    biometricConsentAt: null,
    validFrom: decision.validFrom
      ? formatCalendarDate(decision.validFrom)
      : null,
    validTo: decision.validTo ? formatCalendarDate(decision.validTo) : null,
    syncPending: false,
    syncFailed: false,
  }
}

function collected(month: string): CollectedPayments {
  const payments = PAYMENTS.filter((p) => monthOf(p.paidOn) === month).map(
    (p) => ({
      paymentId: p.id,
      memberId: p.member.id,
      memberName: p.member.seed.name,
      phoneNumber: p.member.phone,
      planType: p.member.seed.plan,
      memberCreatedAt: p.member.createdAt,
      amountPaid: p.amount,
      discountName: p.member.seed.discount ? DISCOUNT.discount_name : null,
      discountPct: p.member.seed.discount ? DISCOUNT.discount_percentage : null,
      paymentDate: p.paidOn,
      nextDueDate: p.coversUntil,
      photoPath: null,
      photoUpdatedAt: null,
      payment_id: p.id,
      member_id: p.member.id,
      member_name: p.member.seed.name,
      phone_number: p.member.phone,
      plan_type: p.member.seed.plan,
      amount_paid: p.amount,
      discount_name: p.member.seed.discount ? DISCOUNT.discount_name : null,
      discount_pct: p.member.seed.discount
        ? DISCOUNT.discount_percentage
        : null,
      payment_date: p.paidOn,
      next_due_date: p.coversUntil,
    })
  )
  const revenueByPlanType: Record<string, number> = {}
  for (const p of payments) {
    revenueByPlanType[p.planType] =
      (revenueByPlanType[p.planType] ?? 0) + p.amountPaid
  }
  return {
    payments,
    summary: {
      totalRevenue: payments.reduce((s, p) => s + p.amountPaid, 0),
      paymentCount: payments.length,
      revenueByPlanType,
    },
    totalCount: payments.length,
  } as CollectedPayments
}

function regularPayments(): RegularPayments {
  const payments = MEMBERS.filter(isBillable)
    .map((m) => ({
      id: m.id,
      name: m.seed.name,
      phoneNumber: m.phone,
      planType: m.seed.plan as string,
      planAmount: m.seed.amount,
      discountId: m.seed.discount ? DISCOUNT.id : null,
      discountName: m.seed.discount ? DISCOUNT.discount_name : null,
      discountPct: m.seed.discount ? DISCOUNT.discount_percentage : null,
      recurringDiscount: Boolean(m.seed.discount),
      effectiveAmount: amountOf(m),
      nextDueDate: m.seed.nextDue,
      daysUntilDue: daysUntil(m.seed.nextDue),
      memberStatus: m.seed.status as string,
      photoPath: null,
      photoUpdatedAt: null,
    }))
    .sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : 1))
  return { payments, totalCount: payments.length }
}

const ACTIVE = MEMBERS.filter((m) => m.seed.status === MemberStatus.Active)

function dashboardMetrics(): DashboardMetrics {
  const dueThisWeek = ACTIVE.filter((m) => {
    const d = daysUntil(m.seed.nextDue)
    return d >= 0 && d <= 7
  })
  return {
    overdueMembers: countOverdueTiers(
      MEMBERS.map((m) => ({
        status: m.seed.status,
        next_due_date: m.seed.nextDue,
      })),
      TODAY
    ),
    revenueThisMonth: collected(monthOf(TODAY)).summary.totalRevenue,
    membersDueThisWeek: {
      count: dueThisWeek.length,
      totalAmount: dueThisWeek.reduce((s, m) => s + amountOf(m), 0),
    },
    activeMembers: ACTIVE.length,
  }
}

function reminderQueue(limit: number): ReminderQueueResult {
  const fires: [number, ReminderType][] = [
    [7, ReminderType.SevenDay],
    [3, ReminderType.ThreeDay],
    [0, ReminderType.DueToday],
  ]
  const entries = ACTIVE.flatMap((m) =>
    fires
      .map(([before, type]) => ({
        memberId: m.id,
        memberName: m.seed.name,
        planType: m.seed.plan as string,
        reminderType: type,
        scheduledInDays: daysUntil(m.seed.nextDue) - before,
        nextDueDate: m.seed.nextDue,
        amount: amountOf(m),
      }))
      .filter((e) => e.scheduledInDays >= 0 && e.scheduledInDays <= 7)
  ).sort((a, b) => a.scheduledInDays - b.scheduledInDays)
  return { entries: entries.slice(0, limit), total: entries.length }
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function monthlyRevenue(): MonthlyRevenueResponse {
  const thisMonth = monthOf(TODAY)
  const historicalData = Array.from({ length: 10 }, (_, i) => {
    const key = `2026-${String(i + 1).padStart(2, '0')}`
    return {
      year: 2026,
      month: i + 1,
      monthLabel: `${MONTHS[i]} 2026`,
      collectedRevenue: PAYMENTS.filter(
        (p) => monthOf(p.paidOn) === key
      ).reduce((s, p) => s + p.amount, 0),
    }
  })
  const collectedNow = historicalData[9].collectedRevenue
  // Owed this month: what was collected, plus what billable members still
  // owe for a due date that falls in it.
  const stillOwed = MEMBERS.filter(
    (m) => isBillable(m) && monthOf(m.seed.nextDue) === thisMonth
  ).reduce((s, m) => s + amountOf(m), 0)
  const total = PAYMENTS.reduce((s, p) => s + p.amount, 0)
  return {
    currentMonth: {
      billedRevenue: collectedNow + stillOwed,
      collectedRevenue: collectedNow,
      planCollectedRevenue: collectedNow,
      oneOffRevenue: 0,
      overdueMemberCount: dashboardMetrics().overdueMembers.count,
    },
    historicalData,
    metrics: {
      totalActiveMembers: ACTIVE.length,
      totalRevenueSinceInception: total,
      averageRevenuePerMember: total / ACTIVE.length,
    },
  }
}

function enrolmentByPlan(): PlanEnrolment[] {
  const counts = new Map<string, number>()
  for (const m of ACTIVE)
    counts.set(m.seed.plan, (counts.get(m.seed.plan) ?? 0) + 1)
  return [...counts.entries()]
    .map(([planType, activeCount]) => ({ planType, activeCount }))
    .sort((a, b) => b.activeCount - a.activeCount)
}

function memberAnalytics(range: AnalyticsRange, year: number) {
  const data = computeMemberAnalytics(
    MEMBERS.map((m) => ({
      id: m.id,
      status: m.seed.status,
      registeredDate: m.start,
      nextDueDate: m.seed.nextDue,
    })),
    PAYMENTS.map((p) => ({
      memberId: p.member.id,
      paymentDate: p.paidOn,
      coversUntil: p.coversUntil,
    })),
    {
      range,
      year,
      todayIso: TODAY,
      gymCreatedIso: `${GYM_OPENED}T00:00:00.000Z`,
    }
  )
  return { ...data, generatedAt: FIXED_NOW.toISOString() }
}

const SUBSCRIPTION = {
  subscriptionTier: 'enterprise',
  subscription_tier: 'enterprise',
  subscriptionStatus: 'active',
  subscription_status: 'active',
  memberCount: ACTIVE.length,
  member_count: ACTIVE.length,
  memberLimit: null,
  member_limit: null,
  currentPeriodEnd: null,
  current_period_end: null,
  trialEndsAt: null,
  trial_ends_at: null,
  graceEndsAt: null,
  grace_ends_at: null,
  pastDueReason: null,
  past_due_reason: null,
  canAddMember: true,
  capabilities: {
    automatedReminders: true,
    announcements: true,
    accessControlHardware: true,
  },
  remainingMemberSlots: null,
  remaining_member_slots: null,
  isComplimentary: true,
  is_complimentary: true,
  hasSavedCard: false,
  has_saved_card: false,
}

// ── The interceptor ──────────────────────────────────────────────────────────

/**
 * A stub that answers instantly is not a network: the client's first render
 * would carry data the server's could not have had, and the hydration
 * mismatch is one no user can reach.
 */
const LATENCY_MS = 120

const ok = (data: unknown, meta?: Record<string, unknown>) => ({
  success: true,
  data,
  ...(meta ? { meta } : {}),
})

/** The payload a GET would receive, or undefined when none is stubbed. */
export function fixtureAnswer(url: URL): unknown | undefined {
  const p = url.pathname
  const q = url.searchParams
  const detail = p.match(/^\/api\/members\/([^/]+)\/detail$/)
  const access = p.match(/^\/api\/access-control\/members\/([^/]+)$/)
  if (detail || access) {
    const m = MEMBERS.find((x) => x.id === (detail ?? access)![1])
    if (!m) return undefined
    return ok(detail ? memberDetail(m) : accessStatus(m))
  }
  switch (p) {
    case '/api/members':
      return ok(membersList(q))
    case '/api/dashboard/metrics':
      return ok(dashboardMetrics())
    case '/api/reminders/queue':
      return ok(reminderQueue(Number(q.get('limit') ?? 8)))
    case '/api/payment-collection/collected':
      return ok(collected(q.get('month') ?? monthOf(TODAY)))
    case '/api/regular-payments':
      return ok(regularPayments())
    case '/api/revenue/monthly':
      return ok(monthlyRevenue())
    case '/api/members/enrolment-by-plan':
      return ok(enrolmentByPlan())
    case '/api/analytics/members':
      return ok(
        memberAnalytics(
          (q.get('range') ?? 'YTD') as AnalyticsRange,
          Number(q.get('year') ?? 2026)
        )
      )
    case '/api/settings/subscription':
      return ok(SUBSCRIPTION, {
        litePriceLkr: 4_900,
        proPriceLkr: 9_900,
        enterprisePriceLkr: 19_900,
        timestamp: FIXED_NOW.toISOString(),
      })
    case '/api/billing-setup/plans':
      return ok([])
    case '/api/billing-setup/discounts':
      return ok([
        {
          ...DISCOUNT,
          gym_id: GYM_ID,
          is_active: true,
          created_at: '2026-01-05T03:00:00.000Z',
          updated_at: '2026-01-05T03:00:00.000Z',
        },
      ])
    case '/api/billing-setup/admission-fee':
      return ok({ admission_fee: 0, admission_fee_enabled: false })
    case '/api/access-control/devices':
      return ok([])
    default:
      return undefined
  }
}

/** Requests the spec did not expect, so a test can fail on them. */
export interface Unexpected {
  calls: string[]
}

/**
 * Freeze the clock and answer the screens' API calls from the fixture gym.
 *
 * @param page - The signed-in page the spec screenshots.
 * @returns The list of unexpected requests, filled as they happen.
 */
export async function useDesktopFixtures(page: Page): Promise<Unexpected> {
  const unexpected: Unexpected = { calls: [] }
  await page.clock.setFixedTime(FIXED_NOW)
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/auth/profile') return route.continue()
    const body = request.method() === 'GET' ? fixtureAnswer(url) : undefined
    if (body === undefined) {
      unexpected.calls.push(`${request.method()} ${url.pathname}${url.search}`)
      return route.abort()
    }
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
    return route.fulfill({ json: body })
  })
  return unexpected
}

/** The fixture member the member-detail baseline opens. */
export const DETAIL_MEMBER = STRESS.longName
