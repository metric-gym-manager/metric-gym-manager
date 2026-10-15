import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ARTICLE_PATHS,
  CallToAction,
  FEATURE_PATHS,
  FITNESS_EMPIRE,
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

const PATH = ARTICLE_PATHS.fitnessEmpire
const PAGE = getMarketingPage(PATH)

export const metadata: Metadata = buildPageMetadata(PATH, { type: 'article' })

/**
 * SEO-042: one named case study, Fitness Empire only. Every figure comes from
 * `FITNESS_EMPIRE`, which holds the snapshot the owner approved; the page
 * states nothing the gym does not use (no door readers, no QR sign-up) and no
 * money amounts.
 */
const F = FITNESS_EMPIRE
const n = (value: number) => value.toLocaleString('en-US')

export default function FitnessEmpireCaseStudy() {
  return (
    <>
      <StructuredData path={PATH} nodes={[articleJsonLd(PATH)]} />

      <MarketingHero
        path={PATH}
        eyebrow={`Case study · ${F.locality}`}
        title={`${F.name}, ${F.locality}: seven months on Metric`}
        lead={
          <p>
            {F.name} is a gym on {F.street} in {F.locality}, run by {F.owner}.
            It moved its members onto Metric on{' '}
            {formatDisplayDate(F.onMetricSince)}. These are its figures as of{' '}
            {formatDisplayDate(F.asOf)}, read from Metric’s own records with the
            gym’s permission.
          </p>
        }
      >
        <p className="font-mono text-metadata uppercase text-ink-muted">
          Published{' '}
          <time dateTime={PAGE.published}>
            {PAGE.published && formatDisplayDate(PAGE.published)}
          </time>{' '}
          · Figures as of{' '}
          <time dateTime={F.asOf}>{formatDisplayDate(F.asOf)}</time>
        </p>
      </MarketingHero>

      <MarketingSection title="The gym">
        <Prose>
          <p>
            {F.name} sells monthly memberships: of the {n(F.members.registered)}{' '}
            members registered on Metric since it joined, all but{' '}
            {n(F.members.notMonthly)} are on a monthly plan. On{' '}
            {formatDisplayDate(F.asOf)}, {n(F.members.active)} of them were
            active.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="The texts the desk no longer sends by hand">
        <Prose>
          <p>
            Every text below went out automatically from the gym’s account,
            without anyone at the desk typing it. The{' '}
            <Link href={ARTICLE_PATHS.reminders}>reminder schedule</Link> is the
            one Metric runs for every monthly member.
          </p>
          <ul>
            <li>
              {n(F.texts.welcome)} welcome texts, one for each new member.
            </li>
            <li>
              {n(F.texts.receipt)} receipts, sent when a payment is recorded,
              with the next due date.
            </li>
            <li>
              {n(F.texts.threeDayReminder)} reminders three days before a due
              date.
            </li>
            <li>
              {n(F.texts.dueTodayReminder)} reminders on the due date itself.
            </li>
            <li>
              {n(F.texts.overdueNotice)} notices to members whose payment was
              overdue.
            </li>
            <li>
              {n(F.texts.reactivation)} welcome-back texts to members who
              returned.
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection title="The desk’s month">
        <Prose>
          <p>
            Payments are recorded at the desk as members pay. {F.name} recorded
            about {n(F.paymentsRecorded.marchToJulyMonthly)} payments a month
            from March to July, {n(F.paymentsRecorded.august)} in August and{' '}
            {n(F.paymentsRecorded.september)} in September.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="When members pay">
        <Prose>
          <p>
            From April to September, {n(F.renewals.count)} renewals were
            recorded. {F.renewals.onOrBeforeDuePercent}% were recorded on or
            before the day they were due, and {F.renewals.withinAWeekPercent}%
            within a week of it. What happens to the rest is set out in{' '}
            <Link href={ARTICLE_PATHS.overdue}>
              when to expire or cancel an overdue membership
            </Link>
            .
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="In the owner’s words">
        <Prose>
          <blockquote>
            <p>“{F.quote}”</p>
            <p>
              — {F.owner}, owner, {F.name}, {F.locality}
            </p>
          </blockquote>
        </Prose>
      </MarketingSection>

      <MarketingSection title="How these figures were counted">
        <Prose>
          <p>
            Every figure was read from {F.name}’s records in Metric on{' '}
            {formatDisplayDate(F.asOf)}, with the gym’s permission. They count
            records, so a renewal’s date is the day the desk recorded the
            payment, which can be later than the day the member paid.{' '}
            {n(F.renewals.duplicatesRemoved)} payments recorded twice on the
            same day were removed before the renewal figures were worked out.
          </p>
          <p>
            Three things are left out on purpose: whether each text was
            delivered, because the SMS gateway does not report that back to
            Metric; any comparison with how the gym ran before, because there
            are no earlier records in Metric to compare with; and money amounts,
            which are the gym’s own business.
          </p>
        </Prose>
      </MarketingSection>

      <RelatedPages
        title="Keep reading"
        items={[
          {
            href: FEATURE_PATHS.sms,
            title: 'SMS reminders in Metric',
            summary: 'The schedule behind the texts above, for every plan.',
          },
          {
            href: FEATURE_PATHS.payments,
            title: 'Payment collection and renewals',
            summary:
              'How a payment at the desk becomes a receipt and a due date.',
          },
          {
            href: ARTICLE_PATHS.move,
            title: 'Moving members off a register book',
            summary:
              'How a gym brings its members onto Metric in the first place.',
          },
          {
            href: HUB_PATH,
            title: 'The gym management system Fitness Empire runs on',
            summary: 'Members, payments, reminders and revenue in one place.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
