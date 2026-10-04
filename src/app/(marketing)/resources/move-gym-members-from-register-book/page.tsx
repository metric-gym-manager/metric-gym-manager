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
  PRICING_PATH,
  Prose,
  RelatedPages,
  StructuredData,
  articleJsonLd,
  buildPageMetadata,
  formatDisplayDate,
  getMarketingPage,
  sampleWelcomeSms,
} from '@/features/marketing'
import { PlanType } from '@/features/members/config/PlanConfig'
import { BULK_REGISTER_MAX_ROWS } from '@/features/members/schemas/member.schemas'
import { calculateNextDueDate } from '@/features/members/utils/calculateNextDueDate'

const PATH = ARTICLE_PATHS.move
const PAGE = getMarketingPage(PATH)

export const metadata: Metadata = buildPageMetadata(PATH, { type: 'article' })

/**
 * The worked example. The next due date comes from the same calculation
 * registration uses, and the welcome text from the same template registration
 * sends, so the sample message matches what a member receives. Local dates on
 * both sides: `calculateNextDueDate` and the template's date formatting both
 * work in local time, so the example reads the same whatever zone the build
 * runs in.
 */
const LAST_PAID = new Date(2026, 8, 20) // 20 September 2026
const NEXT_DUE = calculateNextDueDate(LAST_PAID, PlanType.Monthly)
const PROSE_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
})
const lastPaid = PROSE_DATE.format(LAST_PAID)
const nextDue = PROSE_DATE.format(NEXT_DUE)

/** RegisterMember's welcome text, filled in for the example member. */
const WELCOME_SMS = sampleWelcomeSms(NEXT_DUE)

export default function MoveMembersArticle() {
  return (
    <>
      <StructuredData path={PATH} nodes={[articleJsonLd(PATH)]} />

      <MarketingHero
        path={PATH}
        eyebrow="Guide · Getting started"
        title="Moving your members off a register book or spreadsheet"
        lead={
          <p>
            Moving a gym’s members into software is an afternoon’s work, not a
            project. For each member you need four things: their name, their own
            mobile number, their plan, and the date their current period
            started. Enter them in batches, tell them a text is coming, and let
            new members register themselves from then on. This guide follows the
            steps in Metric; the preparation is the same in any system.
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

      <MarketingSection title="Set up your plans first">
        <Prose>
          <p>
            Before adding anyone, set your plans and their prices in Membership
            Setup — monthly, three-month, annual, whatever you sell — and any
            recurring discounts you give. The bulk-entry grid offers these plans
            and fills in each plan’s price, so a few minutes here saves typing
            the same amount two hundred times.
          </p>
          <p>
            A member who pays an old price is not a problem: the amount can be
            changed on that member’s row.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="What to collect for each member">
        <Prose>
          <ul>
            <li>
              <strong>Name</strong>, as you want it on reminders and receipts.
            </li>
            <li>
              <strong>Their own mobile number.</strong> Metric holds one member
              per number and refuses a second member with the same one, so a
              parent paying for two children cannot be entered twice under one
              phone. Numbers must be Sri Lankan mobiles; they can be written
              with or without the leading 0 or +94.
            </li>
            <li>
              <strong>Their plan</strong>, and the amount if it differs from the
              plan’s price.
            </li>
            <li>
              <strong>The date their current paid period started</strong> —
              usually the date of their last payment in the book.
            </li>
          </ul>
          <p>
            Go through the register once and write these down, or put them in a
            spreadsheet you can read from. If the book has no mobile number for
            a member, get one before you start typing: every member needs their
            own.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="The one date that matters">
        <Prose>
          <p>
            Metric works out each member’s next due date from the start date and
            the plan, exactly as it does for a new member. So enter the date of
            the member’s <strong>last payment</strong>, not the day they first
            joined the gym. A monthly member who last paid on {lastPaid} is next
            due on {nextDue}, and that payment is recorded on {lastPaid} — your
            history starts from the period they are in.
          </p>
          <p>
            A member whose period has already run out — someone the book shows
            as overdue — is added as active and becomes expired the next
            morning, which is what the book already says. They appear on your
            Expired list with the days since their due date.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Enter members in batches">
        <Prose>
          <p>
            The bulk-entry grid takes a row per member: name, mobile number,
            plan, amount, start date and discount. Set the most common plan,
            start date or discount once with Apply to All, then change only the
            rows that differ. Each row is checked before you submit; after you
            submit, every row says whether the member was added and, if not, why
            — a number already in use, for example.
          </p>
          <p>
            Before a batch can be registered, you confirm two things for it —
            that every member in it accepts Metric’s privacy policy and terms,
            and agrees to your gym’s rules — the same two confirmations as
            adding a single member. Collect that agreement from your members
            before you type them in.
          </p>
          <p>
            Submit up to {BULK_REGISTER_MAX_ROWS} members at a time. The grid
            works best on a computer; on a phone, Metric suggests a larger
            screen and still lets you open it.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Tell members a text is coming">
        <Prose>
          <p>Every member you add receives a welcome SMS straight away:</p>
          <blockquote>
            <p>“{WELCOME_SMS}”</p>
          </blockquote>
          <p>
            The message names your gym, but it comes from a shared sender name
            rather than your own number. Tell them before you start — a notice
            at the desk, or a message from the gym’s own phone — so the text is
            expected rather than suspicious.
          </p>
          <p>
            It also works as a check. A member whose due date is wrong will tell
            you, and it is easier to fix in the first week than at their first
            renewal. For members who are already overdue, the text will still
            say their membership is active; if that would confuse them, add them
            when they next come in to pay.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Check your plan’s member limit">
        <Prose>
          <p>
            Every member counts as active at the moment they are added — even
            one who will be expired the next morning. Metric’s Lite plan holds
            up to {LITE_MEMBER_LIMIT} active members and Pro has no limit; once
            a gym reaches its limit, further rows are refused with a message
            saying so. The plans are on the{' '}
            <Link href={PRICING_PATH}>pricing page</Link>.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="From now on, new members register themselves">
        <Prose>
          <p>
            Once your existing members are in, new ones need not be typed at
            all. Print your gym’s QR poster from Settings; a new member scans
            it, enters their name and mobile number, picks a plan, can take a
            selfie, and accepts your gym rules. Their screen shows the amount to
            pay — the plan price plus your admission fee, if you charge one.
          </p>
          <p>
            The record is created the moment they submit: active, with the
            payment recorded and a welcome SMS sent. So take the money at the
            desk there and then. Self-registered members carry a NEW badge until
            someone at the desk verifies the entry — check the new ones each day
            against the cash you took.
          </p>
          <p>
            The details are on the{' '}
            <Link href={FEATURE_PATHS.membership}>membership management</Link>{' '}
            page.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection title="Checklist">
        <Prose>
          <ul>
            <li>Plans, prices and discounts set up first.</li>
            <li>
              Name, own mobile number, plan and last payment date for each
              member.
            </li>
            <li>Start date = the date of their last payment.</li>
            <li>
              Up to {BULK_REGISTER_MAX_ROWS} members per batch, on a computer.
            </li>
            <li>
              Members’ agreement to the terms and your gym rules collected.
            </li>
            <li>Members told that a welcome text is coming.</li>
            <li>Plan limit checked before a large import.</li>
            <li>QR poster up for new members; NEW entries checked daily.</li>
          </ul>
        </Prose>
      </MarketingSection>

      <RelatedPages
        title="Keep reading"
        items={[
          {
            href: FEATURE_PATHS.membership,
            title: 'Membership management in Metric',
            summary:
              'Plans, discounts, admission fees and QR self-registration.',
          },
          {
            href: ARTICLE_PATHS.overdue,
            title: 'Overdue memberships: when to expire, when to cancel',
            summary: 'What happens to the members who were already overdue.',
          },
          {
            href: FEATURE_PATHS.payments,
            title: 'Payment collection and renewals',
            summary: 'Recording the payments that come after the move.',
          },
          {
            href: HUB_PATH,
            title: 'The gym management system you are moving into',
            summary: 'Members, renewals, SMS and revenue in one place.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
