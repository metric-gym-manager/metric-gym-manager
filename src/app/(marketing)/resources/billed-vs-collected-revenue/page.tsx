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
  formatLkr,
  getMarketingPage,
} from '@/features/marketing'

const PATH = ARTICLE_PATHS.revenue
const PAGE = getMarketingPage(PATH)

export const metadata: Metadata = buildPageMetadata(PATH, { type: 'article' })

/**
 * A made-up gym, used only to show the arithmetic. Every figure below is
 * computed from these inputs, so the worked example cannot contradict itself.
 */
const EXAMPLE = {
  monthlyMembers: 40,
  monthlyFee: 4000,
  monthlyPaid: 36,
  annualMembers: 12,
  annualFee: 36000,
  annualDueThisMonth: 2,
  annualPaidThisMonth: 2,
}

const billedMonthly = EXAMPLE.monthlyMembers * EXAMPLE.monthlyFee
const billedAnnual = EXAMPLE.annualDueThisMonth * EXAMPLE.annualFee
const billed = billedMonthly + billedAnnual
const runRate = billedMonthly + (EXAMPLE.annualMembers * EXAMPLE.annualFee) / 12
const collected =
  EXAMPLE.monthlyPaid * EXAMPLE.monthlyFee +
  EXAMPLE.annualPaidThisMonth * EXAMPLE.annualFee
const pct = (part: number, whole: number) =>
  `${((part / whole) * 100).toFixed(1)}%`

export default function BilledVsCollectedArticle() {
  return (
    <>
      <StructuredData path={PATH} nodes={[articleJsonLd(PATH)]} />

      <MarketingHero
        path={PATH}
        eyebrow="Guide · Revenue"
        title="Billed vs collected: measuring a gym’s monthly revenue"
        lead={
          <p>
            Billed revenue is what your members owe for a month; collected
            revenue is what you actually received. Compare the two and you know
            how much of the month’s money is still outstanding. Compare cash
            against a smoothed “projection” instead, and the numbers can tell
            you that you collected more than everything you were owed.
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

      <MarketingSection title="Two numbers, two questions">
        <Prose>
          <ul>
            <li>
              <strong>Billed:</strong> what did my members owe me for this
              month?
            </li>
            <li>
              <strong>Collected:</strong> what did I actually receive?
            </li>
          </ul>
          <p>
            Collected divided by billed is your <strong>collection rate</strong>
            . It can only be read honestly if “billed” means money that was
            genuinely due this month.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="The trap: dividing annual plans by twelve">
        <Prose>
          <p>
            A common shortcut turns every plan into a monthly figure — an annual
            fee divided by twelve, a weekly fee times four — and calls the total
            “projected” or “expected” revenue. It is a fair way to value a
            membership base. It is the wrong thing to compare cash against,
            because annual members do not pay a twelfth each month. They pay
            once, in the month their year renews.
          </p>
          <p>
            Take an illustrative gym with {EXAMPLE.monthlyMembers} monthly
            members at LKR {formatLkr(EXAMPLE.monthlyFee)} and{' '}
            {EXAMPLE.annualMembers} annual members at LKR{' '}
            {formatLkr(EXAMPLE.annualFee)}, {EXAMPLE.annualDueThisMonth} of whom
            renew this month. {EXAMPLE.monthlyPaid} of the monthly members pay,
            and both annual renewals pay.
          </p>
        </Prose>
        <div className="pt-6">
          <TableContainer className="relative bg-surface-panel">
            <Table>
              <caption className="sr-only">
                Collection rate against billed revenue and against a run-rate,
                for an illustrative gym
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Measure</TableHead>
                  <TableHead numeric>LKR</TableHead>
                  <TableHead numeric>Collected as %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Billed this month</TableCell>
                  <TableCell numeric>{formatLkr(billed)}</TableCell>
                  <TableCell numeric>{pct(collected, billed)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>“Projected” run-rate</TableCell>
                  <TableCell numeric>{formatLkr(runRate)}</TableCell>
                  <TableCell numeric>{pct(collected, runRate)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Collected</TableCell>
                  <TableCell numeric className="font-medium">
                    {formatLkr(collected)}
                  </TableCell>
                  <TableCell numeric>—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </div>
        <div className="pt-6">
          <Prose>
            <p>
              Against what was billed, the gym collected{' '}
              {pct(collected, billed)}: four monthly members still owe. Against
              the run-rate it “collected” {pct(collected, runRate)} — a figure
              that hides those four members entirely, and would swing the other
              way in a month with no annual renewals.
            </p>
          </Prose>
        </div>
      </MarketingSection>

      <MarketingSection title="How to work out billed revenue for a month">
        <Prose>
          <ol>
            <li>
              Take the members who owe you money: active members, and expired
              members who have not paid. Leave out suspended and cancelled
              members.
            </li>
            <li>
              For each one, list their billing dates: the start date, then every
              plan period after it. A three-month member who joined on 15 March
              is billed on 15 March, 15 June, 15 September and 15 December.
            </li>
            <li>
              If a billing date falls in the month, add that member’s fee for
              the period, after any recurring discount.
            </li>
          </ol>
          <h3>Why not just count who is due this month?</h3>
          <p>
            Because the next due date moves when a member pays. Someone who paid
            early for this month already shows next month’s date, so a list of
            “members due this month” quietly drops everyone who paid on time —
            the opposite of what you want to measure. Billing dates worked out
            from the start date do not move.
          </p>
          <h3>Where day passes go</h3>
          <p>
            Day-pass income is real money, but nobody was billed for it in
            advance. Report it separately, outside the collection rate, so a
            busy weekend of visitors does not make renewals look healthier than
            they are.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Reading your collection rate">
        <Prose>
          <p>
            Below 100% means money is still outstanding; the gap is the members
            on your expired list. The useful signal is the trend: compare the
            same point in each month, and look at who is unpaid rather than the
            percentage alone.
          </p>
          <p>
            Metric calculates billed revenue this way for every gym, shows it
            beside collected revenue and the collection rate, and breaks the
            month down by plan type — see{' '}
            <Link href={FEATURE_PATHS.revenue}>
              revenue and member analytics
            </Link>
            .
          </p>
        </Prose>
      </MarketingSection>

      <RelatedPages
        title="Keep reading"
        items={[
          {
            href: FEATURE_PATHS.revenue,
            title: 'Revenue and member analytics in Metric',
            summary: 'Billed, collected and the member trends behind them.',
          },
          {
            href: ARTICLE_PATHS.reminders,
            title: 'When to send renewal reminders',
            summary: 'The schedule that keeps the collection rate up.',
          },
          {
            href: FEATURE_PATHS.payments,
            title: 'Payment collection and renewals',
            summary: 'Recording payments so the collected figure is right.',
          },
          {
            href: HUB_PATH,
            title: 'A gym management system that does this arithmetic',
            summary: 'Billed and collected revenue, worked out for every gym.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
