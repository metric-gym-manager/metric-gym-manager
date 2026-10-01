import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CallToAction,
  FEATURE_PATHS,
  FaqSection,
  HUB_PATH,
  MarketingHero,
  MarketingSection,
  Prose,
  RelatedPages,
  StructuredData,
  buildPageMetadata,
  type FaqItem,
} from '@/features/marketing'
import { MEMBER_CANCELLATION_OVERDUE_DAYS } from '@/features/members/config/StatusConfig'

const PATH = FEATURE_PATHS.payments

export const metadata: Metadata = buildPageMetadata(PATH)

const FAQ: FaqItem[] = [
  {
    question: 'Can members pay online?',
    answer: (
      <p>
        Not today. Members pay at your desk the way they already do; Metric
        records the payment and does everything that follows from it. That keeps
        your money flowing straight to you, with no gateway fees on membership
        payments.
      </p>
    ),
  },
  {
    question: 'Is there a grace period after the due date?',
    answer: (
      <p>
        No. A membership expires the day after its due date if it has not been
        paid, so your lists and your door reader never treat an unpaid member as
        paid. A member who pays late starts their new period on the day they
        pay.
      </p>
    ),
  },
  {
    question: 'What happens to members who never come back?',
    answer: (
      <p>
        After {MEMBER_CANCELLATION_OVERDUE_DAYS} days unpaid, Metric cancels the
        membership automatically, which takes the member out of your renewal
        lists. Nothing is deleted: if they return and pay, the same record is
        reactivated and they get a welcome-back SMS.
      </p>
    ),
  },
  {
    question: 'Does Metric issue receipts?',
    answer: (
      <p>
        Every recorded payment sends the member an SMS receipt with the amount,
        any discount applied and their next due date.
      </p>
    ),
  },
]

export default function PaymentCollectionPage() {
  return (
    <>
      <StructuredData path={PATH} />

      <MarketingHero
        path={PATH}
        eyebrow="Feature · Payment collection"
        title="Gym payment collection and renewals"
        lead={
          <p>
            You collect membership fees at the desk; Metric tells you who owes
            what and when, records each payment against the right membership,
            renews it from the correct date and texts the member a receipt.
          </p>
        }
      />

      <MarketingSection
        eyebrow="Renewals"
        title="One screen for who has to pay"
        intro={
          <p>
            The Renewals screen splits your members into three lists, so the
            desk always knows who to ask. Any member who is due or expired can
            be sent a reminder SMS on the spot from the same list.
          </p>
        }
      >
        <ul className="flex flex-col divide-y divide-line-subtle border-y border-line-subtle">
          {[
            [
              'Expired',
              'Members whose due date has passed without a payment, with how long they have been unpaid.',
            ],
            [
              'Expires this week',
              'Members due in the next seven days — the ones to catch while they are in the gym.',
            ],
            [
              'Collected',
              'Payments recorded this month, with the total collected so far.',
            ],
          ].map(([list, meaning]) => (
            <li
              key={list}
              className="flex flex-col gap-1 py-4 tablet:flex-row tablet:gap-6"
            >
              <h3 className="w-44 shrink-0 text-h2 text-ink">{list}</h3>
              <p className="text-body-lg text-ink-secondary">{meaning}</p>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection
        eyebrow="Recording a payment"
        title="What happens when you mark a member paid"
      >
        <Prose>
          <ol>
            <li>
              Metric takes the member’s plan amount, applies their recurring
              discount if they have one, and shows you the total before you
              confirm.
            </li>
            <li>
              It works out the next due date from the plan — by calendar month
              for monthly and longer plans — so renewals never drift.
            </li>
            <li>
              The membership becomes active again and next period’s reminders
              are reset.
            </li>
            <li>
              The member gets an SMS receipt — or, if they were cancelled or
              suspended, a welcome-back message with their new due date.
            </li>
            <li>The payment appears in your revenue figures straight away.</li>
          </ol>
          <p>
            Changing a returning member’s plan is part of the same step, so
            someone moving from monthly to three-month pays once and is dated
            correctly.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Late payments"
        title="No grace period means no guesswork"
      >
        <Prose>
          <p>
            Many gyms let unpaid members keep training because nobody notices
            the date has passed. In Metric a membership expires the day after
            its due date, the member moves to your Expired list, and — if you
            run fingerprint readers — the reader stops admitting them.
          </p>
          <p>
            The day before that happens, the member has already had their
            reminders: a week and three days ahead on longer plans, three days
            ahead on monthly plans, and a final message on the due date itself
            saying the membership expires today. The full schedule is on the{' '}
            <Link href={FEATURE_PATHS.sms}>SMS reminders</Link> page.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Day passes"
        title="Visitors without a membership"
      >
        <Prose>
          <p>
            A day pass is recorded as a one-off payment with its own receipt.
            Day-pass income is reported separately from membership revenue, so a
            busy weekend of visitors never makes your renewals look healthier
            than they are.
          </p>
        </Prose>
      </MarketingSection>

      <FaqSection items={FAQ} />

      <RelatedPages
        items={[
          {
            href: FEATURE_PATHS.revenue,
            title: 'Revenue and member analytics',
            summary: 'What members owe this month against what you collected.',
          },
          {
            href: FEATURE_PATHS.sms,
            title: 'SMS reminders',
            summary: 'The messages members get before and on their due date.',
          },
          {
            href: FEATURE_PATHS.membership,
            title: 'Membership management',
            summary: 'Plans, discounts, admission fees and member statuses.',
          },
          {
            href: HUB_PATH,
            title: 'The whole gym management system, end to end',
            summary: 'How payments fit with members, reminders and reports.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
