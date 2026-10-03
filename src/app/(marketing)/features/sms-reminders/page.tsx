import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
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
  FaqSection,
  HUB_PATH,
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
import { REMINDER_RULES } from '@/features/sms/config/ReminderConfig'

const PATH = FEATURE_PATHS.sms

export const metadata: Metadata = buildPageMetadata(PATH)

/**
 * The schedule is rendered from REMINDER_RULES — the same rules the
 * send-reminders job runs — so this table cannot describe a schedule the
 * product does not keep.
 */
const SCHEDULE_COLUMNS = [
  { days: 7, label: '7 days before' },
  { days: 3, label: '3 days before' },
  { days: 0, label: 'On the due date' },
] as const

const FAQ: FaqItem[] = [
  {
    question: 'Do reminders go out on WhatsApp?',
    answer: (
      <p>
        No. Metric sends SMS, which reaches every phone without the member
        installing or opening anything. WhatsApp sending is not part of the
        product.
      </p>
    ),
  },
  {
    question: 'Can I change the wording of the reminders?',
    answer: (
      <p>
        Reminders and receipts use fixed wording so that every member gets the
        same clear message with their own plan, due date and amount.
        Announcements are written by you.
      </p>
    ),
  },
  {
    question: 'Do overdue members keep getting texts?',
    answer: (
      <p>
        No. A membership expires the day after its due date, so the due-date
        message is the last automated reminder. From then on the member is on
        your Expired list for a personal follow-up — a call from the desk
        usually works better than another text.
      </p>
    ),
  },
  {
    question: 'Are SMS messages included in the price?',
    answer: (
      <p>
        Automated reminders, receipts and bulk announcements are included in
        every plan. See <Link href={PRICING_PATH}>pricing</Link>.
      </p>
    ),
  },
]

export default function SmsRemindersPage() {
  const plans = (Object.keys(PLAN_CONFIGS) as PlanType[]).map((type) => ({
    type,
    // "Monthly", not "Monthly Plan": the column header already says Plan.
    label: PLAN_CONFIGS[type].label.replace(/ Plan$/, ''),
    days: REMINDER_RULES[type].reminderDays,
  }))

  return (
    <>
      <StructuredData path={PATH} />

      <MarketingHero
        path={PATH}
        eyebrow="Feature · SMS reminders"
        title="Automated SMS reminders for gym renewals"
        lead={
          <p>
            Metric texts each member before their membership runs out and on the
            day it is due, sends a receipt for every payment, and records
            whether each message was actually delivered — so renewals stop
            depending on someone remembering to call.
          </p>
        }
      />

      <MarketingSection
        eyebrow="Schedule"
        title="The reminder schedule, by plan length"
        intro={
          <p>
            Reminders are timed to the length of the plan. A monthly member
            hears from you twice; an annual member, who has a larger amount to
            plan for, hears a week ahead. Daily members get no reminders — their
            plan renews too often for reminders to help. The reminder run starts
            at 9:00 every morning, Sri Lanka time.
          </p>
        }
        width="wide"
      >
        <TableContainer className="relative max-w-3xl bg-surface-panel">
          <Table>
            <caption className="sr-only">
              Which automated reminders each plan type receives
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                {SCHEDULE_COLUMNS.map((c) => (
                  <TableHead key={c.days}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.type}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {p.label}
                  </TableCell>
                  {SCHEDULE_COLUMNS.map((c) => (
                    <TableCell key={c.days}>
                      {p.days.includes(c.days) ? (
                        <>
                          <Check
                            aria-hidden="true"
                            className="h-4 w-4 text-success"
                          />
                          <span className="sr-only">Sent</span>
                        </>
                      ) : (
                        <>
                          <Minus
                            aria-hidden="true"
                            className="h-4 w-4 text-ink-placeholder"
                          />
                          <span className="sr-only">Not sent</span>
                        </>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <p className="max-w-3xl pt-4 text-sm text-ink-muted">
          The reasoning behind this schedule is in our guide,{' '}
          <Link
            href={ARTICLE_PATHS.reminders}
            className="text-brand-link underline underline-offset-4 hover:text-brand-link-hover"
          >
            when to send gym membership renewal reminders
          </Link>
          .
        </p>
      </MarketingSection>

      <MarketingSection
        eyebrow="Messages"
        title="What members receive"
        intro={
          <p>
            Short, plain messages with the member’s own plan, date and amount.
            These are the actual texts.
          </p>
        }
      >
        <ul className="flex flex-col gap-3">
          {[
            [
              'Before the due date',
              'Dear Nimal, your Monthly membership payment is due on 15/11/2026. Amount: Rs.4000.00. Thank you.',
            ],
            [
              'On the due date',
              'Dear Nimal, your Monthly membership expires today. Amount: Rs.4000.00. Please pay today to stay active. Thank you.',
            ],
            [
              'When a payment is recorded',
              'Dear Nimal, payment of Rs.4000.00 received. Next due date: 15/12/2026. Thank you!',
            ],
          ].map(([when, text]) => (
            <li
              key={when}
              className="flex flex-col gap-2 rounded-lg border border-line-subtle bg-surface-panel p-4"
            >
              <span className="font-mono text-metadata uppercase text-ink-muted">
                {when}
              </span>
              <span className="font-mono text-sm text-ink">{text}</span>
            </li>
          ))}
        </ul>
        <p className="pt-4 text-sm text-ink-muted">
          Example member, plan and amounts. A member returning after
          cancellation gets a welcome-back message with their new due date
          instead of a plain receipt.
        </p>
      </MarketingSection>

      <MarketingSection eyebrow="Delivery" title="Know which messages arrived">
        <Prose>
          <p>
            Sending a text is not the same as delivering it. Every message
            Metric sends is logged against the member, and the SMS gateway’s
            delivery reports update it from <strong>sent</strong> to{' '}
            <strong>delivered</strong> or <strong>failed</strong>. A member’s
            message history is on their record, so when someone says they never
            got a reminder, you can check.
          </p>
          <p>
            Messages go out through a Sri Lankan SMS gateway, to the mobile
            number on the member’s record.
          </p>
          <p>
            Why SMS rather than WhatsApp, and what each is better at, is set out
            in{' '}
            <Link href={ARTICLE_PATHS.compare}>
              Excel and WhatsApp, or gym software?
            </Link>
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Announcements"
        title="One message to every member"
      >
        <Prose>
          <p>
            For closures, holiday hours or a new class, write an announcement
            once and send it to your members by SMS. Metric shows the send
            progressing and keeps a delivery log of every announcement.
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
              'What happens when the member pays: renewal dating, receipts and the Expired list.',
          },
          {
            href: FEATURE_PATHS.membership,
            title: 'Membership management',
            summary:
              'The plan types and due dates the reminder schedule is built on.',
          },
          {
            href: HUB_PATH,
            title: 'How Metric fits together: features, pricing, setup',
            summary: 'Reminders are one part of the system — here is the rest.',
          },
          {
            href: PRICING_PATH,
            title: 'Pricing',
            summary: 'Reminders and announcements are included in every plan.',
          },
        ]}
      />

      <CallToAction />
    </>
  )
}
