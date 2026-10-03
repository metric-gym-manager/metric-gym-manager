import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ARTICLE_PATHS,
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

const PATH = FEATURE_PATHS.revenue

export const metadata: Metadata = buildPageMetadata(PATH)

const FAQ: FaqItem[] = [
  {
    question: 'Why doesn’t Metric divide annual memberships by twelve?',
    answer: (
      <>
        <p>
          Because an annual member does not pay you a twelfth of their fee each
          month. They pay once, in the month their year renews. Spreading that
          payment across the year produces a smooth “projected” figure that no
          month ever actually bills — and comparing real cash against it can
          show a gym collecting more than 100% of what it was owed.
        </p>
        <p>
          Metric bills each membership in the month it falls due, so the
          collection rate compares like with like. Our guide{' '}
          <Link href={ARTICLE_PATHS.revenue}>
            billed vs collected: measuring gym revenue
          </Link>{' '}
          works through an example.
        </p>
      </>
    ),
  },
  {
    question: 'Which members count as billed?',
    answer: (
      <p>
        Active and expired members — the ones who owe you money. Suspended and
        cancelled members are not billed.
      </p>
    ),
  },
  {
    question: 'Does Metric track attendance?',
    answer: (
      <p>
        On the Enterprise plan, every scan at your fingerprint reader is logged
        — entries and refusals — in the door activity log. See{' '}
        <Link href={FEATURE_PATHS.access}>access control</Link>.
      </p>
    ),
  },
]

export default function RevenueReportingPage() {
  return (
    <>
      <StructuredData path={PATH} />

      <MarketingHero
        path={PATH}
        eyebrow="Feature · Revenue and analytics"
        title="Gym revenue reporting and membership analytics"
        lead={
          <p>
            Two numbers matter every month: what your members owe for it, and
            what you have actually collected. Metric shows both side by side —
            and the member trends behind them.
          </p>
        }
      />

      <MarketingSection
        eyebrow="Revenue"
        title="Billed and collected, not “projected”"
      >
        <Prose>
          <p>
            <strong>Billed</strong> is what your active and expired members owe
            for the month, worked out from each member’s start date and plan
            length — a three-month member who joined in March is billed in
            March, June, September and December. <strong>Collected</strong> is
            what you have recorded as paid. The percentage collected tells you,
            at a glance, how much of this month’s money is still outstanding.
          </p>
          <p>
            Alongside them: your active member count, average revenue per
            member, a monthly chart of collected revenue, and a breakdown of the
            month by plan type, so you can see whether your monthly members or
            your annual ones carry the gym. Day passes are reported as one-off
            income, outside the collection rate.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Dashboard"
        title="The morning view"
        intro={
          <p>
            The dashboard is what the desk opens first: everything that needs
            attention today, without running a report.
          </p>
        }
      >
        <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
          {[
            ['Overdue members', 'Who has lapsed and needs a word at the desk.'],
            ['Expires this week', 'Who to catch before their date passes.'],
            ['Active members', 'Your paying membership right now.'],
            ['Reminder queue', 'Which reminders are going out next, to whom.'],
            [
              'Recent payments',
              'The latest payments recorded, as they happen.',
            ],
            [
              'Collected revenue',
              'Trailing months of collected revenue, charted.',
            ],
          ].map(([name, detail]) => (
            <li
              key={name}
              className="flex flex-col gap-1 rounded-lg border border-line-subtle bg-surface-panel p-4"
            >
              <h3 className="text-h2 text-ink">{name}</h3>
              <p className="text-sm text-ink-secondary">{detail}</p>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection
        eyebrow="Member analytics"
        title="Who joins, who renews, who leaves"
      >
        <Prose>
          <ul>
            <li>
              <strong>Renewal rate and churn rate</strong> for the period you
              choose, with the membership trend over time.
            </li>
            <li>
              <strong>New sign-ups</strong> this month, and this year against
              last year.
            </li>
            <li>
              <strong>At-risk members</strong>: active members grouped by how
              many days remain until their payment is due.
            </li>
            <li>
              <strong>Cohort retention</strong>: for each sign-up month, the
              share of members still active one, three, six and up to twelve
              months later — the clearest picture of whether new members stay.
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <FaqSection items={FAQ} />

      <RelatedPages
        items={[
          {
            href: ARTICLE_PATHS.revenue,
            title: 'Billed vs collected: measuring gym revenue',
            summary:
              'The method behind Metric’s revenue figures, with a worked example.',
          },
          {
            href: FEATURE_PATHS.payments,
            title: 'Payment collection and renewals',
            summary: 'Where the collected figure comes from.',
          },
          {
            href: FEATURE_PATHS.membership,
            title: 'Membership management',
            summary:
              'Plan lengths and statuses — the inputs to every figure here.',
          },
          {
            href: HUB_PATH,
            title: 'Metric for Sri Lankan gyms: the full overview',
            summary: 'Where the numbers come from, and what else Metric runs.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
