import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import {
  ARTICLE_PATHS,
  CallToAction,
  FEATURE_PATHS,
  HUB_PATH,
  MarketingHero,
  MarketingSection,
  Prose,
  RelatedPages,
  StructuredData,
  articleJsonLd,
  buildPageMetadata,
  formatDisplayDate,
  getMarketingPage,
} from '@/features/marketing'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MEMBER_CANCELLATION_OVERDUE_DAYS } from '@/features/members/config/StatusConfig'
import { calculateNextDueDateFromPayment } from '@/features/members/utils/calculateNextDueDate'
import { REMINDER_RULES } from '@/features/sms/config/ReminderConfig'

const PATH = ARTICLE_PATHS.overdue
const PAGE = getMarketingPage(PATH)

export const metadata: Metadata = buildPageMetadata(PATH, { type: 'article' })

/**
 * The worked example. Every date in the timeline is derived from the rules the
 * product runs on — the monthly reminder days, the no-grace expiry and the
 * cancellation constant — so the guide cannot drift from the product.
 */
const DAY_MS = 86_400_000
const EXAMPLE_DUE = Date.UTC(2026, 10, 15) // 15 November 2026
const LATE_PAYMENT_OFFSET = 5 // pays on the fifth day after the due date
const EARLY_PAYMENT_OFFSET = -3 // pays three days before the due date

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const day = (offset: number) =>
  SHORT_DATE.format(new Date(EXAMPLE_DUE + offset * DAY_MS))

/** The date the product stores after a payment on `offset` days from due. */
const nextDueAfterPaymentOn = (offset: number) =>
  SHORT_DATE.format(
    calculateNextDueDateFromPayment(
      new Date(EXAMPLE_DUE + offset * DAY_MS),
      new Date(EXAMPLE_DUE),
      PlanType.Monthly
    )
  )
const nextDueAfterLatePayment = nextDueAfterPaymentOn(LATE_PAYMENT_OFFSET)
const nextDueAfterEarlyPayment = nextDueAfterPaymentOn(EARLY_PAYMENT_OFFSET)

const advanceReminders = REMINDER_RULES[PlanType.Monthly].reminderDays.filter(
  (d) => d > 0
)

const TIMELINE: { when: string; what: string }[] = [
  ...advanceReminders.map((d) => ({
    when: day(-d),
    what: `Reminder SMS: the membership is due on ${day(0)}, with the amount.`,
  })),
  {
    when: day(0),
    what: 'Due-date SMS: the membership expires today. The member is still active — paid through today.',
  },
  {
    when: day(1),
    what: 'Expired. The member moves to the Expired list. Fingerprint readers stopped admitting them at midnight.',
  },
  {
    when: `${day(1)} – ${day(MEMBER_CANCELLATION_OVERDUE_DAYS - 1)}`,
    what: 'No more automated texts. Someone at the gym follows up in person.',
  },
  {
    when: day(MEMBER_CANCELLATION_OVERDUE_DAYS),
    what: `Cancelled, ${MEMBER_CANCELLATION_OVERDUE_DAYS} days after the due date. Out of the renewal lists; the record is kept.`,
  },
  {
    when: 'Any day they pay',
    what: `Active again, with a new period from that day — paying on ${day(LATE_PAYMENT_OFFSET)} makes the next due date ${nextDueAfterLatePayment}.`,
  },
]

export default function OverdueMembershipsArticle() {
  return (
    <>
      <StructuredData path={PATH} nodes={[articleJsonLd(PATH)]} />

      <MarketingHero
        path={PATH}
        eyebrow="Guide · Renewals"
        title="Overdue gym memberships: when to expire, when to cancel"
        lead={
          <p>
            Expire an unpaid membership the day after its due date, with no
            grace period. Cancel it {MEMBER_CANCELLATION_OVERDUE_DAYS} days
            after the due date if nothing has been paid. When a member pays
            late, start their new period on the day they pay. These are the
            rules Metric runs on, and the reasoning holds whatever system — or
            register book — you use.
          </p>
        }
      >
        <p className="font-mono text-metadata uppercase text-ink-muted">
          Published{' '}
          <time dateTime={PAGE.published}>
            {PAGE.published && formatDisplayDate(PAGE.published)}
          </time>{' '}
          · Metric Gym OS
        </p>
      </MarketingHero>

      <MarketingSection title="Expire on the day after the due date">
        <Prose>
          <p>
            A membership paid up to the 15th covers the 15th. From the 16th, a
            member who has not paid is no longer a paying member, and the
            simplest honest thing is for your records to say so.
          </p>
          <p>
            A grace period sounds kind, but it moves the deadline without
            telling anyone. Members learn that the real due date is a week later
            than the one they were given, staff have to remember who is inside
            the grace window, and the list of paid-up members stops being true.
            Most unpaid days at a gym are not a decision by the member — they
            are a date nobody noticed.
          </p>
          <p>
            Expiry is not a penalty. It is a status: nothing is charged and
            nothing is deleted. It only stops your lists — and, if you run
            fingerprint readers, your door — from treating an unpaid member as
            paid. In Metric the due-date reminder says it plainly: the
            membership expires today, please pay today to stay active.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="An expired member is still a member">
        <Prose>
          <p>
            An expired member has not left. In Metric they sit on the Expired
            list with the number of days since their due date, and what they owe
            for the month still counts in your revenue report — the gap between
            what members owe and what you have collected is exactly the money
            still out on the floor. The{' '}
            <Link href={ARTICLE_PATHS.revenue}>
              guide to billed and collected revenue
            </Link>{' '}
            explains how to read it.
          </p>
          <p>
            By now the member has had their reminders, so another text rarely
            changes anything. This is the time for a person: a word at the desk
            or a phone call finds out what a message cannot — that they are
            travelling, injured, short until pay day, or unhappy with something
            you can fix. The{' '}
            <Link href={ARTICLE_PATHS.reminders}>renewal reminder guide</Link>{' '}
            covers the messages that come before.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="When they pay late, start the new period that day">
        <Prose>
          <p>
            When an expired member pays, Metric starts their new period on the
            day they pay. A monthly member who was due on {day(0)} and pays on{' '}
            {day(LATE_PAYMENT_OFFSET)} is next due on {nextDueAfterLatePayment}.
          </p>
          <p>
            Paying early works the other way: the member keeps their due date. A
            monthly member due on {day(0)} who pays early, on{' '}
            {day(EARLY_PAYMENT_OFFSET)}, is still next due on{' '}
            {nextDueAfterEarlyPayment} — paying ahead never costs them days.
          </p>
          <p>
            The alternative — dating the new period from the missed due date —
            charges the member for days they could not use the gym, and it
            usually ends in an argument at the desk. Starting from the payment
            day keeps the rule simple to explain: you pay for the month you get.
          </p>
          <p>
            The trade-off is real and worth knowing: the days a membership sat
            expired are not billed to anyone. That is one more reason to follow
            up early rather than late. When you record a payment, enter the date
            the member actually paid, so their next due date is right.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        title={`Cancel after ${MEMBER_CANCELLATION_OVERDUE_DAYS} days`}
      >
        <Prose>
          <p>
            Two weeks is long enough to cover a trip, an illness or a late pay
            day, and short enough that your renewal lists stop filling with
            people who have already left. In Metric, a membership still unpaid{' '}
            {MEMBER_CANCELLATION_OVERDUE_DAYS} days after its due date is
            cancelled automatically: the member drops out of the renewal lists
            and out of what members owe each month, so your figures describe the
            gym you actually have.
          </p>
          <p>
            Cancelling is not deleting. The member’s record, payments and
            message history stay. If they come back and pay, the same record is
            reactivated and they get a welcome-back SMS with their new due date.
            If you run fingerprint readers, a cancelled member is blocked at the
            door, and a returning member walks back in without enrolling their
            finger again.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="One member’s timeline" width="wide">
        <TableContainer className="relative max-w-3xl bg-surface-panel">
          <Table>
            <caption className="sr-only">
              What happens to a monthly member who does not pay on the due date
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>What happens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIMELINE.map((row) => (
                <TableRow key={row.when}>
                  <TableCell className="whitespace-nowrap align-top font-medium">
                    {row.when}
                  </TableCell>
                  <TableCell className="align-top">{row.what}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <p className="max-w-3xl pt-4 text-sm text-ink-muted">
          A monthly member due on {day(0)}. Members on longer plans also get a
          reminder a week ahead; daily members get none. The full schedule is on
          the <Link href={FEATURE_PATHS.sms}>SMS reminders</Link> page.
        </p>
      </MarketingSection>

      <MarketingSection title="Checklist">
        <Prose>
          <ul>
            <li>A membership is paid through its due date, and no further.</li>
            <li>Expire it the day after — no grace period.</li>
            <li>The due-date reminder says it expires today.</li>
            <li>After expiry, a person follows up — not another text.</li>
            <li>A late payer’s new period starts on the day they pay.</li>
            <li>
              Cancel after {MEMBER_CANCELLATION_OVERDUE_DAYS} days unpaid, and
              keep the record.
            </li>
            <li>A returning member is reactivated, not registered again.</li>
          </ul>
        </Prose>
      </MarketingSection>

      <RelatedPages
        title="Keep reading"
        items={[
          {
            href: FEATURE_PATHS.payments,
            title: 'Payment collection and renewals',
            summary: 'Recording a payment, and the Due and Expired lists.',
          },
          {
            href: ARTICLE_PATHS.reminders,
            title: 'When to send renewal reminders',
            summary: 'The messages a member gets before the due date.',
          },
          {
            href: ARTICLE_PATHS.revenue,
            title: 'Billed vs collected: measuring gym revenue',
            summary: 'How much of what members owe actually comes in.',
          },
          {
            href: HUB_PATH,
            title: 'The gym management system these rules run in',
            summary: 'Expiry, cancellation and renewals, applied every day.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
