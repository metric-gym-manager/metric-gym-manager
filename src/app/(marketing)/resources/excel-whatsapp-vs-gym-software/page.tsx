import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ARTICLE_PATHS,
  CallToAction,
  FEATURE_PATHS,
  HUB_PATH,
  LITE_MEMBER_LIMIT,
  MarketingHero,
  MarketingSection,
  PRICE_CURRENCY,
  PRICING_PATH,
  PRICING_TIERS,
  Prose,
  RelatedPages,
  StructuredData,
  TRIAL_DAYS,
  articleJsonLd,
  buildPageMetadata,
  formatDisplayDate,
  formatLkr,
  getMarketingPage,
} from '@/features/marketing'

const PATH = ARTICLE_PATHS.compare
const PAGE = getMarketingPage(PATH)

export const metadata: Metadata = buildPageMetadata(PATH, { type: 'article' })

/**
 * "Excel and WhatsApp vs gym software" — the honest version (SEO_AUDIT.md §8).
 * Metric has no WhatsApp sender; this page says so, and
 * MarketingPages.test.tsx fails if it ever claims otherwise. Prices come from
 * the pricing config, never typed here.
 */
export default function ExcelWhatsAppComparison() {
  return (
    <>
      <StructuredData path={PATH} nodes={[articleJsonLd(PATH)]} />

      <MarketingHero
        path={PATH}
        eyebrow="Guide · Choosing software"
        title="Excel and WhatsApp, or gym software? An honest comparison"
        lead={
          <p>
            Plenty of gyms run well on a spreadsheet and a WhatsApp group. The
            useful question is not which is better in general, but when the
            spreadsheet stops keeping up with the gym. This page sets out what
            each does well, where it breaks, what dedicated software changes —
            and what Metric does not do. To start with the obvious one: Metric
            sends SMS, not WhatsApp.
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

      <MarketingSection title="What a spreadsheet and WhatsApp do well">
        <Prose>
          <ul>
            <li>
              <strong>They cost nothing extra</strong>, and everyone at the desk
              already knows how to use them.
            </li>
            <li>
              <strong>Members read WhatsApp.</strong> It is where they already
              are, they can reply, and a conversation about a missed payment can
              happen in the same thread.
            </li>
            <li>
              <strong>A spreadsheet holds anything.</strong> Add a column for
              locker numbers or injuries and it is there.
            </li>
          </ul>
          <p>
            None of this is a reason to switch away. A gym that is happy with
            its sheet and its group chat is not doing anything wrong.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Where it starts to break">
        <Prose>
          <p>
            A spreadsheet knows only what someone typed into it, and WhatsApp
            sends only what someone remembered to send. That holds while one
            person runs the desk and knows every member. It frays as the gym
            grows:
          </p>
          <ul>
            <li>
              <strong>Due dates are worked out by hand.</strong> Someone has to
              add a month to each payment date — and decide what a month after
              31 January is.
            </li>
            <li>
              <strong>Nothing changes on its own.</strong> A member who has not
              paid stays marked as paid until somebody checks the sheet.
            </li>
            <li>
              <strong>Reminders depend on memory.</strong> They go out when
              someone has time, from someone’s phone, and there is no record of
              who was reminded and who was missed.
            </li>
            <li>
              <strong>The money is hard to read.</strong> Adding up payments
              tells you what came in, not what members owed — the gap is what
              unpaid renewals cost you. The{' '}
              <Link href={ARTICLE_PATHS.revenue}>
                guide to billed and collected revenue
              </Link>{' '}
              explains the difference.
            </li>
            <li>
              <strong>Member numbers live on staff phones.</strong> When a staff
              member leaves, the contacts and the conversation history may leave
              with them.
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection title="What dedicated software changes">
        <Prose>
          <p>
            Gym software does the parts that depend on dates and memory. In
            Metric:
          </p>
          <ul>
            <li>
              Each member’s next due date is calculated from their plan, by
              calendar month — a month after 31 January is the last day of
              February.
            </li>
            <li>
              An unpaid membership expires the day after its due date, without
              anyone checking. The{' '}
              <Link href={ARTICLE_PATHS.overdue}>
                overdue memberships guide
              </Link>{' '}
              explains why there is no grace period.
            </li>
            <li>
              Renewal reminders go out on a schedule set by the plan, and every
              payment you record sends the member a receipt. See{' '}
              <Link href={FEATURE_PATHS.sms}>SMS reminders</Link>.
            </li>
            <li>
              Every message is logged against the member as sent, delivered or
              failed, so “I never got a reminder” can be checked.
            </li>
            <li>
              The revenue report sets what members owe this month against what
              you collected. See{' '}
              <Link href={FEATURE_PATHS.revenue}>revenue and analytics</Link>.
            </li>
            <li>
              On the Enterprise plan, fingerprint readers at the door follow
              each member’s paid-through date. See{' '}
              <Link href={FEATURE_PATHS.access}>access control</Link>.
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Why Metric sends SMS, not WhatsApp">
        <Prose>
          <p>
            Metric’s reminders, receipts and announcements go out as SMS through
            a Sri Lankan SMS gateway. An SMS reaches any mobile number, whether
            or not the member uses WhatsApp, and the carrier reports back
            whether each message was delivered — so every message is a record,
            not just a send.
          </p>
          <p>
            The trade-off is real. An SMS is plain text: no pictures, no read
            receipts — only delivered or failed — and members cannot reply to a
            reminder inside Metric. Many gyms keep WhatsApp for conversation and
            let the software handle the reminders and the records; the two do
            not compete.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="What it costs">
        <Prose>
          <p>
            Metric is billed monthly:{' '}
            {PRICING_TIERS.map((tier, i) => (
              <span key={tier.tier}>
                {i > 0 && (i === PRICING_TIERS.length - 1 ? ' and ' : ', ')}
                {tier.name} {PRICE_CURRENCY} {formatLkr(tier.monthlyPriceLkr)}
              </span>
            ))}{' '}
            a month. {PRICING_TIERS[0].name} covers up to {LITE_MEMBER_LIMIT}{' '}
            active members. Reminders, receipts and announcements by SMS are
            included in every plan, and you can try it free for {TRIAL_DAYS}{' '}
            days without payment details. The full comparison is on the{' '}
            <Link href={PRICING_PATH}>pricing page</Link>.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="When a spreadsheet is still enough">
        <Prose>
          <p>
            If every member pays you in person and you could name all of them
            without looking, a notebook or a sheet does the job. The case for
            software grows with three things: the number of members you can no
            longer keep in your head, the number of people working the desk, and
            the renewals that slipped because nobody chased them.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="What Metric does not do">
        <Prose>
          <p>Better to know before you start:</p>
          <ul>
            <li>It does not send WhatsApp messages — reminders are SMS.</li>
            <li>
              Members do not pay online; they pay at your desk and you record
              the payment.
            </li>
            <li>There is no member app; members get SMS.</li>
            <li>There is no class booking and no check-in.</li>
            <li>
              The app is in English; there is no Sinhala or Tamil version.
            </li>
            <li>
              There is one login per gym, with no separate staff accounts or
              permissions.
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection title="If you decide to move">
        <Prose>
          <p>
            Moving takes an afternoon: four details per member, entered in
            batches. The{' '}
            <Link href={ARTICLE_PATHS.move}>
              guide to moving your members off a register book or spreadsheet
            </Link>{' '}
            walks through it.
          </p>
        </Prose>
      </MarketingSection>

      <RelatedPages
        title="Keep reading"
        items={[
          {
            href: ARTICLE_PATHS.move,
            title: 'Moving your members off a register book or spreadsheet',
            summary: 'What to collect, which date to enter, what members get.',
          },
          {
            href: FEATURE_PATHS.sms,
            title: 'SMS reminders in Metric',
            summary: 'The schedule for every plan, and delivery tracking.',
          },
          {
            href: ARTICLE_PATHS.revenue,
            title: 'Billed vs collected: measuring gym revenue',
            summary: 'What a sum of payments does not tell you.',
          },
          {
            href: HUB_PATH,
            title: 'Gym management software for Sri Lanka',
            summary: 'Everything Metric does, with prices and setup.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
