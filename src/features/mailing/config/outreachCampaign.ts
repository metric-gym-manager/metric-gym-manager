/**
 * The introduction series to gyms that have never heard of Metric Gym OS
 * (owner request, 2026-10-06): four emails, one a week, sent by the daily
 * `send-outreach` cron. Each recipient gets them in order, a week apart, and
 * then no more.
 *
 * 1. "Tired of chasing payments?" — the SMS that brought in calls.
 * 2. The reminders — what members are sent, and when.
 * 3. The money — what members owe against what was collected.
 * 4. Getting started — off the register book in an afternoon; the last one.
 *
 * Every figure comes from the configs the website uses (`pricing.ts`,
 * `site.ts`) and every claim is one the product backs. It shows who owes,
 * sends SMS reminders and receipts, and compares what is owed with what was
 * collected — it does not collect money (HomePage.test.tsx bans that claim).
 * Reminder timings follow ReminderConfig: monthly members 3 days before and
 * on the due day, longer plans 7 days before too, an overdue reminder once.
 *
 * Every email says where the address came from and which of the four it is,
 * and carries the recipient's own /unsubscribe link (Marketing topic). It
 * goes out from go.metricgymos.com, so a cold list's complaints can never
 * touch the domain that carries customer email.
 *
 * Email HTML is its own surface: tables and inline styles. Colours come from
 * the design tokens where one exists; WhatsApp's teal is WhatsApp's.
 */
import { darkColors, primitiveColors } from '@/components/ui/tokens'
import {
  LITE_MEMBER_LIMIT,
  TRIAL_DAYS,
  formatLkr,
  lowestMonthlyPriceLkr,
} from '@/features/marketing/config/pricing'
import {
  CONTACT,
  LEGAL_NAME,
  POSTAL_ADDRESS,
  SITE_NAME,
  SITE_URL,
} from '@/features/marketing/config/site'
import { MAILING_REPLY_TO } from './MailingConfig'

/**
 * Outreach's own sending domain (Resend, verified 2026-10-06). Every email it
 * sends is outreach, which is how a bounce or complaint is recognised as one.
 */
export const OUTREACH_DOMAIN = 'go.metricgymos.com'

/** Outreach's own sending address. */
export const OUTREACH_FROM = `Metric Gym OS <hello@${OUTREACH_DOMAIN}>`
export const OUTREACH_REPLY_TO = MAILING_REPLY_TO

/**
 * The `mailto:` in every outreach email's List-Unsubscribe header. Mail apps
 * that unsubscribe by sending an email (Apple Mail among them) write here;
 * Resend receives it and the webhook opts the sender out. Normal replies
 * still go to `OUTREACH_REPLY_TO`, read by a person.
 */
export const OUTREACH_UNSUBSCRIBE_ADDRESS = `unsubscribe@${OUTREACH_DOMAIN}`

/** Where the safety brake's alert, the weekly summary and forwarded mail go. */
export const OUTREACH_OWNER_EMAIL = MAILING_REPLY_TO

/**
 * The safety brake: the campaign pauses itself, and emails the owner, before
 * mail providers start treating the domain as a spammer's. Counted from the
 * campaign's start, or from the owner's last `--resume`.
 *
 * - Spam complaints: Gmail asks senders to stay under 0.3% of mail marked as
 *   spam. On a list of about a hundred, one complaint is already 1%; a second
 *   is a pattern, not an accident.
 * - Hard bounces: Resend asks for under 4% across the account. Outreach is
 *   paused above 5% of its own sends, judged once there are enough sends for
 *   a share to mean something.
 */
export const OUTREACH_BRAKE = {
  complaints: 2,
  bounceRate: 0.05,
  minSendsForBounceRate: 40,
} as const

/** The weekly summary goes on this day (0 Sunday … 6 Saturday), Sri Lanka time. */
export const OUTREACH_SUMMARY_WEEKDAY = 1

/** The campaign's key in `outreach_recipients`. */
export const OUTREACH_CAMPAIGN = 'intro-2026-10'

/**
 * No email of the campaign goes before this moment: the owner reviews the
 * imported list first (the first send was promised for Tuesday 13 October,
 * 10:00 Sri Lanka time).
 */
export const OUTREACH_STARTS_AT = new Date('2026-10-13T04:00:00Z')

/** Emails in the series; a recipient gets each once, a week apart. */
export const OUTREACH_SEQUENCE_LENGTH = 4
export type OutreachStep = 1 | 2 | 3 | 4

/** The least time between two emails to the same address. */
export const OUTREACH_MIN_GAP_DAYS = 6

/**
 * Sends per daily run, at most. Individual emails count against Resend's
 * 100-a-day limit (measured 2026-10-06), so the run stays well under it and
 * leaves room for other email; a longer list simply takes more days, each
 * address still getting one email a week. A new domain earns trust slowly:
 * raise it only on a paid plan, while bounces and complaints stay near zero.
 */
export const OUTREACH_DAILY_LIMIT = 80

/** A recipient whose sends fail this many times in a row is stopped. */
export const OUTREACH_MAX_FAILURES = 3

/** WhatsApp chat with the demo request already typed. */
export const WHATSAPP_DEMO_URL = `${CONTACT.whatsappUrl}?text=${encodeURIComponent(
  "Hi, I'd like a free demo of Metric Gym OS"
)}`

/** `+94704379967` → `070 437 9967`, as people in Sri Lanka write it. */
const LOCAL_PHONE = `0${CONTACT.phoneE164.slice(3, 5)} ${CONTACT.phoneE164.slice(
  5,
  8
)} ${CONTACT.phoneE164.slice(8)}`

const PRICE = `Rs. ${formatLkr(lowestMonthlyPriceLkr())}`
const SIGN_UP_URL = `${SITE_URL}/register`

const C = {
  page: primitiveColors.neutral[50],
  card: '#ffffff',
  ink: primitiveColors.neutral[900],
  inkSoft: primitiveColors.neutral[600],
  inkFaint: primitiveColors.neutral[500],
  line: primitiveColors.neutral[100],
  brand: primitiveColors.blue[700],
  // `blue.bg` flattened onto white (Outlook ignores rgba), and a lighter tint
  // for small text on the brand blue.
  brandTint: '#e4e3ff',
  onBrandSoft: '#c9c8ff',
  panel: darkColors.surfaceCard,
  panelInk: primitiveColors.dark[50],
  panelInkSoft: primitiveColors.dark[200],
  panelTrack: primitiveColors.dark[700],
  red: primitiveColors.red[400],
  amber: primitiveColors.yellow[500],
  green: primitiveColors.green[500],
  whatsapp: '#128c7e',
} as const

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const PREVIEW_PADDING = '&#847;&zwnj;&nbsp;'.repeat(30)

function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// ── Building blocks ─────────────────────────────────────────────────────────

function hero(eyebrow: string, headline: string, intro: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="background:${C.brand};padding:36px 28px 32px">
<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.onBrandSoft}">${eyebrow}</p>
<h1 style="margin:0;font-family:${FONT};font-size:32px;line-height:1.15;font-weight:800;color:#ffffff">${headline}</h1>
<p style="margin:14px 0 0;font-family:${FONT};font-size:17px;line-height:1.55;color:${C.brandTint}">${intro}</p>
</td></tr>
</table>`
}

/** A dark panel styled like the product, with a caption above it. */
function panel(caption: string, inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;color:${C.inkSoft}">${caption}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.panel};border-radius:12px">
<tr><td style="padding:18px 20px 6px">${inner}</td></tr>
</table>
</td></tr>
</table>`
}

function statusRows(
  rows: [dot: string, title: string, detail: string][]
): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows
    .map(
      ([dot, title, detail]) =>
        `<tr><td width="14" style="vertical-align:top;padding-top:6px"><div style="width:9px;height:9px;border-radius:50%;background:${dot}"></div></td>` +
        `<td style="padding:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.45;color:${C.panelInk}">` +
        `<strong style="color:#ffffff">${title}</strong><br><span style="color:${C.panelInkSoft}">${detail}</span></td></tr>`
    )
    .join('')}</table>`
}

function numbered(items: [title: string, body: string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:20px 28px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items
    .map(
      ([title, body], i) =>
        `<tr><td width="40" style="vertical-align:top;padding:2px 0 18px"><div style="width:30px;height:30px;line-height:30px;border-radius:8px;background:${C.brandTint};color:${C.brand};text-align:center;font-family:Arial,sans-serif;font-size:15px;font-weight:700">${i + 1}</div></td>` +
        `<td style="padding:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.inkSoft}">` +
        `<strong style="display:block;font-size:16px;color:${C.ink}">${title}</strong>${body}</td></tr>`
    )
    .join('')}</table>
</td></tr>
</table>`
}

function button(href: string, label: string, colour: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
<tr><td style="border-radius:10px;background:${colour}">
<a href="${attr(href)}" style="display:inline-block;padding:15px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.3;color:#ffffff;text-decoration:none;border-radius:10px;text-align:center">${label}</a>
</td></tr>
</table>`
}

/** The price and the WhatsApp call to action; `primary` may lead instead. */
function offer(primary?: { href: string; label: string }): string {
  const whatsapp = attr(WHATSAPP_DEMO_URL)
  const first = primary
    ? button(primary.href, primary.label, C.brand)
    : button(WHATSAPP_DEMO_URL, 'Book a free demo on WhatsApp', C.whatsapp)
  const second = primary
    ? `or ask us anything on WhatsApp: <a href="${whatsapp}" style="color:${C.whatsapp};font-weight:700;text-decoration:none;white-space:nowrap">${LOCAL_PHONE}</a>`
    : `or message us on <a href="${whatsapp}" style="color:${C.whatsapp};font-weight:700;text-decoration:none;white-space:nowrap">${LOCAL_PHONE}</a>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:4px 28px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:12px">
<tr><td align="center" style="padding:24px 20px 26px">
<p style="margin:0;font-family:${FONT};font-size:14px;color:${C.inkSoft}">From</p>
<p style="margin:2px 0 4px;font-family:${FONT};font-size:32px;line-height:1.1;font-weight:800;color:${C.ink}">${PRICE}<span style="font-size:16px;font-weight:600;color:${C.inkSoft}"> / month</span></p>
<p style="margin:0 0 20px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.inkSoft}">Up to ${LITE_MEMBER_LIMIT} active members · ${TRIAL_DAYS}&#8209;day&nbsp;free&nbsp;trial</p>
${first}
<p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.inkSoft}">${second}</p>
</td></tr>
</table>
</td></tr>
</table>`
}

function signOff(lead: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 28px 30px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.inkSoft}">
${lead} Just reply to this email if you have a question — a real person reads every one.<br><br>
<span style="color:${C.ink};font-weight:600">The ${SITE_NAME} team</span><br>
<a href="${SITE_URL}" style="color:${C.brand};text-decoration:none;font-weight:600">metricgymos.com</a>
</td></tr>
</table>`
}

function disclosure(step: OutreachStep): string {
  return (
    `We found your gym’s email address on a public page (its website or a business listing) and thought ${SITE_NAME} might help. ` +
    `This is email ${step} of 4, one a week.`
  )
}

interface Draft {
  subject: string
  preheader: string
  body: string
  /** The plain-text version's own lines, above the shared footer. */
  textLines: string[]
}

function render(step: OutreachStep, draft: Draft, unsubscribeUrl: string) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${draft.subject}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${draft.preheader}${PREVIEW_PADDING}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}">
<tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${SITE_URL}/icon-192.png" width="30" height="30" alt="" style="display:block;border:0;outline:none;border-radius:7px"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.ink}">${SITE_NAME}</td>
</tr></table>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;overflow:hidden">
${draft.body}
</td></tr>
<tr><td style="padding:22px 12px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.inkSoft};text-align:center">
${disclosure(step)} Not interested? <a href="${attr(unsubscribeUrl)}" style="color:${C.inkSoft};text-decoration:underline">Unsubscribe</a> and we won’t email you again.<br>
${LEGAL_NAME} · ${POSTAL_ADDRESS.lines.join(' ')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    draft.subject,
    '',
    ...draft.textLines,
    '',
    `From ${PRICE} a month. Up to ${LITE_MEMBER_LIMIT} active members, ${TRIAL_DAYS}-day free trial.`,
    `Book a free demo on WhatsApp: ${WHATSAPP_DEMO_URL}`,
    `Or message us on ${LOCAL_PHONE}.`,
    '',
    `The ${SITE_NAME} team — ${SITE_URL}`,
    '',
    '—',
    `${disclosure(step)} Not interested? Unsubscribe and we won’t email you again: ${unsubscribeUrl}`,
    `${LEGAL_NAME}, ${POSTAL_ADDRESS.lines.join(' ')}`,
  ].join('\n')

  return { subject: draft.subject, html, text }
}

// ── The four emails ─────────────────────────────────────────────────────────

const DRAFTS: Record<OutreachStep, Draft> = {
  1: {
    subject: 'Tired of chasing payments?',
    preheader: `See who owes, let Metric send the SMS reminders, and know what you collected. From ${PRICE} a month.`,
    body:
      hero(
        'For gym owners in Sri Lanka',
        'Tired of chasing payments?',
        `${SITE_NAME} shows you who owes, sends the reminders for you, and tells you what you’ve collected — so you can spend your time on the gym floor, not the register book.`
      ) +
      panel(
        `What you see when you open Metric <span style="color:${C.inkFaint}">(example)</span>`,
        statusRows([
          [C.red, '4 members overdue', 'Reminder SMS already sent'],
          [
            C.amber,
            '7 memberships end this week',
            'Each gets a reminder before the due date',
          ],
          [
            C.green,
            'Rs. 186,500 collected this month',
            'Against what members owe, at a glance',
          ],
        ])
      ) +
      numbered([
        [
          'Know who owes, instantly',
          'Who has expired, who expires this week, and who is overdue — no more flipping through the register.',
        ],
        [
          'Reminders go out on their own',
          'SMS reminders timed to each member’s plan, and an SMS receipt every time you record a payment.',
        ],
        [
          'See the money clearly',
          'What members owe this month against what you actually collected.',
        ],
      ]) +
      offer() +
      signOff('Built in Sri Lanka, for Sri Lankan gyms.'),
    textLines: [
      `${SITE_NAME} shows you who owes, sends the reminders for you, and tells you what you’ve collected — so you can spend your time on the gym floor, not the register book.`,
      '',
      '1. Know who owes, instantly: who has expired, who expires this week, and who is overdue.',
      '2. Reminders go out on their own: SMS reminders timed to each member’s plan, and an SMS receipt for every payment you record.',
      '3. See the money clearly: what members owe this month against what you actually collected.',
    ],
  },

  2: {
    subject: 'Let Metric send the payment reminders',
    preheader:
      'Members get a text before their fee is due, on the day, and if they miss it — and a receipt when they pay.',
    body:
      hero(
        'Reminders, handled',
        'No more “your fees are due” conversations',
        `${SITE_NAME} texts each member before their fee is due, on the due day, and once if they miss it — timed to their own plan — and sends an SMS receipt the moment you record a payment.`
      ) +
      panel(
        `A monthly member’s month <span style="color:${C.inkFaint}">(example)</span>`,
        statusRows([
          [
            C.amber,
            '3 days before',
            'A friendly reminder that the fee is coming up',
          ],
          [C.amber, 'On the due day', 'A reminder that today is the day'],
          [
            C.red,
            'If it’s missed',
            'One overdue reminder, so you don’t have to ask',
          ],
          [C.green, 'When they pay', 'An SMS receipt with their next due date'],
        ])
      ) +
      numbered([
        [
          'Timed to each plan',
          'Monthly members hear from you 3 days before and on the day; members on longer plans get a reminder a week ahead too.',
        ],
        [
          'Every message tracked',
          'See which reminders were delivered and which failed, member by member.',
        ],
        [
          'Tell everyone at once',
          'Closed for a holiday or a new class starting? Send one SMS announcement to all your members.',
        ],
      ]) +
      offer() +
      signOff(
        'Your members stay reminded, and you stay out of awkward conversations.'
      ),
    textLines: [
      `${SITE_NAME} texts each member before their fee is due, on the due day, and once if they miss it — timed to their own plan — and sends an SMS receipt the moment you record a payment.`,
      '',
      '1. Timed to each plan: monthly members hear from you 3 days before and on the day; longer plans get a reminder a week ahead too.',
      '2. Every message tracked: see which reminders were delivered and which failed.',
      '3. Tell everyone at once: send one SMS announcement to all your members.',
    ],
  },

  3: {
    subject: 'Do you know what your gym collected this month?',
    preheader:
      'What every member owes this month, next to what you actually collected — on one screen.',
    body:
      hero(
        'Your numbers, clearly',
        'What you’re owed, and what you collected',
        `${SITE_NAME} works out what every member owes this month from their plan, and puts it next to the payments you’ve recorded — so you see your month as it happens, not at the end of it.`
      ) +
      panel(
        `This month at a glance <span style="color:${C.inkFaint}">(example)</span>`,
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 4px;font-family:${FONT};font-size:14px;color:${C.panelInkSoft}">Members owe this month</td><td align="right" style="padding:0 0 4px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff">Rs. 240,000</td></tr>
<tr><td style="padding:0 0 12px;font-family:${FONT};font-size:14px;color:${C.panelInkSoft}">Collected so far</td><td align="right" style="padding:0 0 12px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.green}">Rs. 186,500</td></tr>
<tr><td colspan="2" style="padding:0 0 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;background:${C.panelTrack}"><tr><td style="width:78%;height:10px;border-radius:6px;background:${C.green};font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
<tr><td colspan="2" style="padding:0 0 14px;font-family:${FONT};font-size:13px;color:${C.panelInkSoft}">78% collected · 6 members still to pay</td></tr>
</table>`
      ) +
      numbered([
        [
          'Owed versus collected',
          'Worked out from each member’s plan — so you know what this month should bring in.',
        ],
        [
          'Who still has to pay, by name',
          'Overdue members listed, with their reminders already on the way.',
        ],
        [
          'Renewals, churn and retention',
          'See which months members stay and which they leave, so you can act early.',
        ],
      ]) +
      offer() +
      signOff(
        'The numbers you’d otherwise add up by hand at the end of the month.'
      ),
    textLines: [
      `${SITE_NAME} works out what every member owes this month from their plan, and puts it next to the payments you’ve recorded — so you see your month as it happens.`,
      '',
      '1. Owed versus collected: worked out from each member’s plan.',
      '2. Who still has to pay, by name, with reminders already on the way.',
      '3. Renewals, churn and retention: see which months members stay and which they leave.',
    ],
  },

  4: {
    subject: 'Off the register book in an afternoon',
    preheader: `Add your members, put up a QR poster, and start a ${TRIAL_DAYS}-day free trial — we’ll help on WhatsApp.`,
    body:
      hero(
        'Getting started',
        'From register book to Metric in one afternoon',
        `Moving your gym onto ${SITE_NAME} is quicker than it sounds — and you can try everything free for ${TRIAL_DAYS} days.`
      ) +
      numbered([
        [
          'Start your free trial',
          `Sign up at metricgymos.com — ${TRIAL_DAYS} days free, no card needed to look around.`,
        ],
        [
          'Add your members',
          'Bring them all in at once from a spreadsheet, or add them one by one.',
        ],
        [
          'Put up your QR poster',
          'New members scan it and register themselves from their own phone.',
        ],
        [
          'Let it run',
          'Reminders, receipts and your monthly numbers take care of themselves.',
        ],
      ]) +
      offer({
        href: SIGN_UP_URL,
        label: `Start your ${TRIAL_DAYS}-day free trial`,
      }) +
      signOff(
        'This is the last email in this short series — if now isn’t the right time, that’s fine, and we won’t keep writing.'
      ),
    textLines: [
      `Moving your gym onto ${SITE_NAME} is quicker than it sounds — and you can try everything free for ${TRIAL_DAYS} days.`,
      '',
      `1. Start your free trial: ${SIGN_UP_URL}`,
      '2. Add your members: all at once from a spreadsheet, or one by one.',
      '3. Put up your QR poster: new members register themselves from their own phone.',
      '4. Let it run: reminders, receipts and your monthly numbers take care of themselves.',
      '',
      'This is the last email in this short series. If now isn’t the right time, that’s fine, and we won’t keep writing.',
    ],
  },
}

/**
 * One email of the series for one recipient.
 *
 * @param step - Which email, 1 to 4
 * @param input.unsubscribeUrl - The recipient's own /unsubscribe link
 * @returns Subject, HTML and plain-text bodies
 */
export function outreachEmail(
  step: OutreachStep,
  input: { unsubscribeUrl: string }
): { subject: string; html: string; text: string } {
  return render(step, DRAFTS[step], input.unsubscribeUrl)
}
