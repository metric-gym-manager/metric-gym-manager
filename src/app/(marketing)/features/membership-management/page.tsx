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
  CallToAction,
  FEATURE_PATHS,
  FaqSection,
  HUB_PATH,
  LITE_MEMBER_LIMIT,
  MarketingHero,
  MarketingSection,
  PRICING_PATH,
  Prose,
  RelatedPages,
  StructuredData,
  buildPageMetadata,
  type FaqItem,
} from '@/features/marketing'
import { PLAN_CONFIGS, PlanType } from '@/features/members/config/PlanConfig'
import { MEMBER_CANCELLATION_OVERDUE_DAYS } from '@/features/members/config/StatusConfig'

const PATH = FEATURE_PATHS.membership

export const metadata: Metadata = buildPageMetadata(PATH)

/** How each plan moves the next due date — read from PLAN_CONFIGS. */
function renewalRule(type: PlanType): string {
  const { durationMethod, durationValue } = PLAN_CONFIGS[type]
  if (type === PlanType.Custom) return 'Set per member'
  const unit =
    durationMethod === 'day'
      ? 'day'
      : durationMethod === 'month'
        ? 'month'
        : 'year'
  const n = durationValue
  const span = `${n} calendar ${unit}${n === 1 ? '' : 's'}`
  return unit === 'day'
    ? `${n} day${n === 1 ? '' : 's'} later`
    : `${span} later, same date`
}

const STATUSES = [
  [
    'Active',
    'Paid up. Counts toward your plan’s active-member limit and gets reminders.',
  ],
  [
    'Expired',
    'The due date passed without a payment. Shown on your Expired list the next morning.',
  ],
  [
    'Suspended',
    'On hold — for a policy reason or because the member asked to pause.',
  ],
  [
    'Cancelled',
    `Left, or unpaid for ${MEMBER_CANCELLATION_OVERDUE_DAYS} days. The record and history stay; a payment reactivates it.`,
  ],
] as const

const FAQ: FaqItem[] = [
  {
    question: 'Do expired or cancelled members count toward the Lite limit?',
    answer: (
      <p>
        No. Only active members count. Lite covers up to {LITE_MEMBER_LIMIT}{' '}
        active members at a time; Pro and Enterprise have no limit. Your full
        history of past members is kept whatever your plan. See{' '}
        <Link href={PRICING_PATH}>pricing</Link>.
      </p>
    ),
  },
  {
    question: 'Do members need to download an app?',
    answer: (
      <p>
        No. Members register by scanning your QR poster with their phone camera,
        and they receive reminders and receipts by SMS. Only your staff sign in
        to Metric.
      </p>
    ),
  },
  {
    question: 'Can I record a one-day visitor without making them a member?',
    answer: (
      <p>
        Yes. Day passes are recorded as one-off payments with a receipt, and
        they are reported separately from membership revenue.
      </p>
    ),
  },
]

export default function MembershipManagementPage() {
  const plans = Object.keys(PLAN_CONFIGS) as PlanType[]
  return (
    <>
      <StructuredData path={PATH} />

      <MarketingHero
        path={PATH}
        eyebrow="Feature · Membership management"
        title="Gym membership management software"
        lead={
          <p>
            Every member, their plan, what they pay and when they are next due —
            in one record that the rest of Metric works from. Reminders,
            renewals, revenue figures and the door reader all read the same
            membership, so they always agree.
          </p>
        }
      />

      <MarketingSection
        eyebrow="Plans"
        title="Seven plan types, at your prices"
        intro={
          <p>
            Set your own price for each plan in Membership Setup. The plan
            decides how a payment moves the member’s next due date — by calendar
            month, not a fixed 30 days, so a member who joins on the 15th stays
            due on the 15th.
          </p>
        }
        width="wide"
      >
        <TableContainer className="relative max-w-3xl bg-surface-panel">
          <Table>
            <caption className="sr-only">
              Plan types and how each one renews
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Next due date after a payment</TableHead>
                <TableHead>Recurring discounts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((type) => (
                <TableRow key={type}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {PLAN_CONFIGS[type].label.replace(/ Plan$/, '')}
                  </TableCell>
                  <TableCell>{renewalRule(type)}</TableCell>
                  <TableCell>
                    {PLAN_CONFIGS[type].supportsRecurringDiscount
                      ? 'Yes'
                      : 'No'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div className="max-w-3xl pt-6">
          <Prose>
            <p>
              <strong>Discounts</strong> you define — a student rate, a couples
              rate — are applied at payment and snapshotted on the payment, so
              changing a discount later never rewrites what a member already
              paid. <strong>Admission fees</strong> are set once for the gym and
              added to a new member’s first payment when you enable them.
            </p>
          </Prose>
        </div>
      </MarketingSection>

      <MarketingSection
        eyebrow="Statuses"
        title="A status for every member, kept up to date for you"
        intro={
          <p>
            Statuses change on their own as due dates pass, so the members list
            you open in the morning is already correct.
          </p>
        }
      >
        <ul className="flex flex-col divide-y divide-line-subtle border-y border-line-subtle">
          {STATUSES.map(([status, meaning]) => (
            <li
              key={status}
              className="flex flex-col gap-1 py-4 tablet:flex-row tablet:gap-6"
            >
              <h3 className="w-32 shrink-0 text-h2 text-ink">{status}</h3>
              <p className="text-body-lg text-ink-secondary">{meaning}</p>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection
        eyebrow="Self-registration"
        title="Let new members register themselves"
      >
        <Prose>
          <p>
            Metric generates a branded QR poster for your gym. A new member
            scans it with their phone, enters their name and mobile number,
            picks a plan, can take a selfie for their record, and accepts your
            gym rules and Metric’s terms. Their screen then shows the amount to
            pay at the desk — the plan price plus your admission fee, worked out
            by Metric rather than typed by the member.
          </p>
          <p>
            Self-registered members appear with a <strong>NEW</strong> badge
            until your staff confirm them, so nobody is treated as a paid member
            before they have paid.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Your existing members"
        title="Bring your members over in one sitting"
      >
        <Prose>
          <p>
            Add members one at a time, or many at once in the bulk-entry grid:
            set the plan, start date and discount for every row in one step,
            then adjust the rows that differ. Search by name or phone number and
            filter by status to find anyone in seconds.
          </p>
          <p>
            Member photos are stored with the record, so the desk can see who is
            who.
          </p>
        </Prose>
      </MarketingSection>

      <FaqSection items={FAQ} />

      <RelatedPages
        items={[
          {
            href: FEATURE_PATHS.payments,
            title: 'Payment collection and renewals',
            summary:
              'How a payment renews a membership and what happens when it is late.',
          },
          {
            href: FEATURE_PATHS.sms,
            title: 'SMS reminders',
            summary: 'The reminder schedule each plan type receives.',
          },
          {
            href: FEATURE_PATHS.access,
            title: 'Fingerprint access control',
            summary: 'Let the membership record decide who the door admits.',
          },
          {
            href: HUB_PATH,
            title: 'Gym management software for Sri Lankan gyms',
            summary:
              'Members are where it starts — the whole system, with pricing and setup.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
