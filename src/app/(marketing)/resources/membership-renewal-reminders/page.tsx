import type { Metadata } from 'next'
import Link from 'next/link'
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

const PATH = ARTICLE_PATHS.reminders
const PAGE = getMarketingPage(PATH)

export const metadata: Metadata = buildPageMetadata(PATH, { type: 'article' })

export default function RenewalRemindersArticle() {
  return (
    <>
      <StructuredData path={PATH} nodes={[articleJsonLd(PATH)]} />

      <MarketingHero
        path={PATH}
        eyebrow="Guide · Renewals"
        title="When to send gym membership renewal reminders"
        lead={
          <p>
            Remind members on long plans a week before their due date, members
            on monthly plans three days before, and everyone once more on the
            due date itself. Do not remind members on daily passes at all. The
            reasoning below is what Metric’s own reminder schedule is built on,
            and it applies whatever system — or notebook — you use.
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

      <MarketingSection title="Why the timing depends on the plan">
        <Prose>
          <p>
            A reminder has one job: give the member enough time to arrange the
            payment before the membership lapses. How much time that takes
            depends on two things — how large the amount is, and how often the
            member pays it.
          </p>
          <h3>Monthly members: three days, then the due date</h3>
          <p>
            A monthly member pays the same amount every month, so the date is
            already part of their routine. A reminder a week ahead arrives when
            a quarter of their month is still left, and with twelve renewals a
            year it quickly becomes a message they learn to ignore. Three days’
            notice and a message on the day are enough.
          </p>
          <h3>Three-month, six-month and annual members: a week ahead</h3>
          <p>
            Members on longer plans pay a larger amount, months apart. A week’s
            notice gives them time to budget for it; a second message three days
            out catches anyone who put it off; the due-date message makes the
            deadline explicit.
          </p>
          <h3>Daily members: no reminders</h3>
          <p>
            A daily pass renews every day. Reminding someone the day before they
            pay for one session is noise, so Metric sends none.
          </p>
          <p>
            Metric applies exactly these rules automatically. The full table for
            every plan type is on the{' '}
            <Link href={FEATURE_PATHS.sms}>SMS reminders</Link> page.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="What a reminder should say">
        <Prose>
          <p>
            Short, specific and impossible to misread. Every reminder needs four
            things: the member’s name, their plan, the date, and the amount. The
            message on the due date should also state the consequence plainly.
            These are the texts Metric sends:
          </p>
          <ul>
            <li>
              <strong>Before the due date:</strong> “Dear Nimal, your Monthly
              membership payment is due on 15/11/2026. Amount: Rs.4000.00. Thank
              you.”
            </li>
            <li>
              <strong>On the due date:</strong> “Dear Nimal, your Monthly
              membership expires today. Amount: Rs.4000.00. Please pay today to
              stay active. Thank you.”
            </li>
          </ul>
          <p>
            Notice what is missing: no links to click, no promotional copy and
            no guilt. A renewal reminder is a service message, and it works best
            when it reads like one.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Send at a civil hour">
        <Prose>
          <p>
            Metric’s reminder run starts at 9:00 in the morning, Sri Lanka time
            — late enough not to wake anyone, early enough that a member can pay
            on the way to the gym the same day. Whatever hour you choose, keep
            it the same every day so members know what to expect.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="After the due date, switch from texts to a person">
        <Prose>
          <p>
            In Metric a membership expires the day after its due date, so the
            due-date message is the last automated reminder. From then on the
            member appears on the Expired list, with how many days it has been.
          </p>
          <p>
            That is deliberate. By this point the member has had two or three
            reminders; another text is unlikely to change anything. A short
            conversation at the desk or on the phone can find out what a text
            cannot — that they are travelling, injured, or unhappy with
            something you can fix.
          </p>
          <p>
            What happens next — when to cancel, and how a late payment is dated
            — is in{' '}
            <Link href={ARTICLE_PATHS.overdue}>
              when to expire and when to cancel an overdue membership
            </Link>
            .
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Close the loop with a receipt">
        <Prose>
          <p>
            When the member pays, confirm it. A receipt that states the amount
            and the next due date — “Dear Nimal, payment of Rs.4000.00 received.
            Next due date: 15/12/2026. Thank you!” — settles any later question
            about whether they paid, and tells them when the next reminder will
            come.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Check delivery, not just sending">
        <Prose>
          <p>
            A sent message is not a delivered one. Numbers change, phones are
            switched off, and a member who never received a reminder will
            rightly say so. Metric records every message against the member and
            updates it to delivered or failed from the carrier’s delivery
            report, so a failed reminder is a prompt to update a phone number
            rather than a mystery.
          </p>
          <h3>Checklist</h3>
          <ul>
            <li>
              Long plans: remind seven and three days ahead, and on the day.
            </li>
            <li>Monthly plans: three days ahead, and on the day.</li>
            <li>Daily passes: no reminders.</li>
            <li>Name, plan, date and amount in every message; no links.</li>
            <li>The same sending time every day.</li>
            <li>After expiry, a person follows up — not another text.</li>
            <li>A receipt for every payment, with the next due date.</li>
            <li>Watch for failed deliveries and fix the numbers.</li>
          </ul>
        </Prose>
      </MarketingSection>

      <RelatedPages
        title="Keep reading"
        items={[
          {
            href: FEATURE_PATHS.sms,
            title: 'SMS reminders in Metric',
            summary:
              'The full schedule for every plan type, and delivery tracking.',
          },
          {
            href: FEATURE_PATHS.payments,
            title: 'Payment collection and renewals',
            summary:
              'What happens when the member pays — and when they do not.',
          },
          {
            href: ARTICLE_PATHS.revenue,
            title: 'Billed vs collected: measuring gym revenue',
            summary: 'How to tell whether reminders are bringing the money in.',
          },
          {
            href: HUB_PATH,
            title: 'The gym management system these rules run in',
            summary: 'Reminders, receipts and renewals, set up once.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
