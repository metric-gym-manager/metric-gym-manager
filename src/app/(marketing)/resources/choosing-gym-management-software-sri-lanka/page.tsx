import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ARTICLE_PATHS,
  CallToAction,
  FEATURE_PATHS,
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
import { ACCESS_EVENT_RETENTION_DAYS } from '@/features/access-control/config/AccessControlConfig'

const PATH = ARTICLE_PATHS.choose
const PAGE = getMarketingPage(PATH)

export const metadata: Metadata = buildPageMetadata(PATH, { type: 'article' })

/** "Lite and Pro" — the tiers a gym can start on its own, from the pricing config. */
const TRIAL_TIERS = new Intl.ListFormat('en-GB', {
  type: 'conjunction',
}).format(
  PRICING_TIERS.filter((tier) => tier.selfServeTrial).map((tier) => tier.name)
)

/**
 * The buying guide (SEO_AUDIT.md §8, SEO-065): what a Sri Lankan gym should
 * check before choosing software, with Metric's own answers beside each.
 *
 * Every product fact is read from config or matches the code: prices, the
 * Lite limit and the trial from the pricing config, the scan retention from
 * ACCESS_EVENT_RETENTION_DAYS. The data-protection section states only what
 * Metric's published privacy policy already says (owner decision,
 * 2026-10-04) and links to it; it is a checklist, not legal advice.
 * MarketingPages.test.tsx pins the prices, the Act, the consent and retention
 * facts, and that the page never claims WhatsApp delivery.
 */
export default function ChoosingGymSoftware() {
  return (
    <>
      <StructuredData path={PATH} nodes={[articleJsonLd(PATH)]} />

      <MarketingHero
        path={PATH}
        eyebrow="Guide · Choosing software"
        title="Choosing gym management software in Sri Lanka"
        lead={
          <p>
            Most gym software looks alike in a demo. The differences that matter
            show up later: what it costs in rupees as the gym grows, how members
            actually pay, whether reminders reach them, and how their data is
            handled under Sri Lankan law. This guide lists what to check, with
            Metric’s own answers beside each point so you have something to
            compare against.
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

      <MarketingSection title="Start with how your gym runs">
        <Prose>
          <p>
            Before you look at features, write down five things. Every vendor
            will answer them differently, and they decide which differences
            matter to you.
          </p>
          <ul>
            <li>
              <strong>How members pay</strong> — cash or card at the desk, bank
              transfer, or online.
            </li>
            <li>
              <strong>Which plans you sell</strong> — day passes, weekly,
              monthly, three-month, six-month or annual memberships.
            </li>
            <li>
              <strong>How many active members you have</strong>, and how many
              you expect in a year.
            </li>
            <li>
              <strong>Who works the desk</strong> — just you, or several staff
              who each need their own login.
            </li>
            <li>
              <strong>Whether the door should follow payments</strong>, with a
              fingerprint reader that lets members in only while they are paid
              up.
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Compare prices in rupees, at your size">
        <Prose>
          <p>
            Ask for a monthly price in rupees, what it covers, and what happens
            when you outgrow it. A price per member grows with every sign-up; a
            price per tier changes only when you cross a limit.
          </p>
          <p>
            For comparison, Metric is billed monthly:{' '}
            {PRICING_TIERS.map((tier, i) => (
              <span key={tier.tier}>
                {i > 0 && (i === PRICING_TIERS.length - 1 ? ' and ' : ', ')}
                {tier.name} {PRICE_CURRENCY} {formatLkr(tier.monthlyPriceLkr)}
              </span>
            ))}{' '}
            a month. {PRICING_TIERS[0].name} covers up to {LITE_MEMBER_LIMIT}{' '}
            active members; expired and cancelled members do not count towards
            the limit. SMS reminders, receipts and announcements are included in
            every plan. {TRIAL_TIERS} can be tried free for {TRIAL_DAYS} days
            without payment details. The details are on the{' '}
            <Link href={PRICING_PATH}>pricing page</Link>.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Check how members will pay">
        <Prose>
          <p>
            Most Sri Lankan gyms are paid at the desk, so the question that
            matters is how quickly a desk payment is recorded and what the
            member gets back. If a vendor offers online payments, ask which
            payment provider takes them and who pays its fees.
          </p>
          <p>
            Members do not pay online in Metric. They pay at your desk, you
            record the payment, and Metric texts them a receipt with their next
            due date. A member who pays before their due date keeps it, so
            paying early never costs them days. Your own Metric subscription is
            paid by card through PayHere, and Metric never sees the card number.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Check that reminders reach members">
        <Prose>
          <p>
            Reminders are where software earns its price, so ask four questions:
            which number or name the texts come from, whether each text names
            your gym, when they are sent, and whether they cost extra.
          </p>
          <p>
            In Metric, texts come from one sender name shared by every gym on
            the platform, so every message names your gym in its text. The
            reminder run starts at 9:00 every morning, Sri Lanka time, and the
            schedule follows the plan length: a week ahead for long plans, three
            days ahead for monthly ones, and on the due date. Daily and weekly
            members get no reminders. Messages are in English. The full schedule
            is on the <Link href={FEATURE_PATHS.sms}>SMS reminders</Link> page.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Check how member data is protected">
        <Prose>
          <p>
            Sri Lanka’s Personal Data Protection Act, No. 9 of 2022, gives your
            members rights over the data kept about them: to see it (Section
            13), to withdraw their consent or object (Section 14), to have it
            corrected (Section 15), and to have it erased in the cases the Act
            sets out (Section 16). A member can complain to the Data Protection
            Authority of Sri Lanka. Whatever system you choose, you should be
            able to find, correct and remove one member’s records when asked.
          </p>
          <ul>
            <li>
              <strong>Collect only what you need.</strong> Metric does not ask
              for National Identity Card numbers or home addresses and
              discourages collecting them: they serve no purpose in running a
              membership, and collecting them may go against the Act’s
              data-minimisation requirements.
            </li>
            <li>
              <strong>Fingerprints need explicit consent.</strong> Biometric
              data is special-category data under the Act. In Metric, a member’s
              consent is recorded before a fingerprint is enrolled, and giving a
              fingerprint is never a condition of membership. The fingerprint
              template is created on the reader and held by the hardware
              provider; Metric never receives it. Door scans are deleted after{' '}
              {ACCESS_EVENT_RETENTION_DAYS} days.
            </li>
            <li>
              <strong>Ask where the data is kept.</strong> Each gym’s data in
              Metric is walled off in the database, so one gym can never read
              another’s members. Some of Metric’s service providers process data
              outside Sri Lanka, under contractual safeguards consistent with
              Section 26 of the Act.
            </li>
          </ul>
          <p>
            Metric’s <Link href="/privacy">privacy policy</Link> sets out how it
            handles gym and member data. This guide is a checklist, not legal
            advice.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Decide whether the door should follow payments">
        <Prose>
          <p>
            If members walk in past an empty desk, a fingerprint reader can do
            the checking. Ask two questions of any system that offers it: does
            the door update itself when a member pays or lapses, and does it
            still work when the internet is down?
          </p>
          <p>
            On the Enterprise plan, Metric connects to ZKTeco fingerprint
            readers from our hardware partner. Each payment sends the member’s
            paid-through date to the reader, which refuses entry after it using
            its own clock, so the door keeps following payments offline. See{' '}
            <Link href={FEATURE_PATHS.access}>access control</Link>.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Questions to ask every vendor">
        <Prose>
          <ul>
            <li>
              What does it cost a month in rupees for my number of members?
            </li>
            <li>
              Are SMS reminders and receipts included, or charged per text?
            </li>
            <li>Does every text name my gym?</li>
            <li>
              How is a desk payment recorded, and what does the member get?
            </li>
            <li>
              What happens to a member’s due date if they pay early or late?
            </li>
            <li>
              Can I find, correct and delete one member’s data when they ask?
            </li>
            <li>Where is the data stored, and who else processes it?</li>
            <li>
              Is a fingerprint ever required, and how is consent recorded?
            </li>
            <li>Can I try it with my own members before I pay?</li>
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection title="What Metric does not do">
        <Prose>
          <ul>
            <li>It does not send WhatsApp messages — reminders are SMS.</li>
            <li>There is no member app and no online payment for members.</li>
            <li>There is no class booking and no check-in.</li>
            <li>The app is in English only.</li>
            <li>
              There is one login per gym, with no separate staff accounts.
            </li>
          </ul>
          <p>
            If you run the gym on a spreadsheet today, the{' '}
            <Link href={ARTICLE_PATHS.compare}>
              honest comparison of Excel and WhatsApp with gym software
            </Link>{' '}
            helps decide whether to switch at all.
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
            href: PRICING_PATH,
            title: 'Metric pricing',
            summary: 'Monthly prices in rupees for every plan.',
          },
          {
            href: ARTICLE_PATHS.reminders,
            title: 'When to send renewal reminders',
            summary: 'How the reminder schedule follows plan length.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
