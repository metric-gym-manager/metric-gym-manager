/**
 * The introduction email to gyms that have never heard of Metric Gym OS
 * (owner request, 2026-10-06), sent by `scripts/send-outreach.ts`.
 *
 * It echoes the SMS that brought in calls ("Tired of chasing payments?"), and
 * every figure comes from the configs the website uses (`pricing.ts`,
 * `site.ts`), so it cannot quote a price, limit or number the site does not.
 * It claims only what the product does: it shows who owes, sends SMS
 * reminders and receipts, and compares what is owed with what was collected —
 * it does not collect money (HomePage.test.tsx bans that claim).
 *
 * Outreach goes out from its own subdomain, go.metricgymos.com, so a cold
 * list's spam complaints can never touch the reputation of
 * updates.metricgymos.com, which carries release and policy emails to
 * customers. The footer says where the address came from and carries the
 * recipient's own /unsubscribe link (Marketing topic).
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

/** Outreach's own sending address (Resend domain verified 2026-10-06). */
export const OUTREACH_FROM = 'Metric Gym OS <hello@go.metricgymos.com>'
export const OUTREACH_REPLY_TO = MAILING_REPLY_TO

/** The campaign's key in `outreach_recipients`: one send per address. */
export const OUTREACH_CAMPAIGN = 'intro-2026-10'

/**
 * Sends per run. A new domain earns trust slowly: start small, run once a
 * day, and raise it only while bounces and complaints stay near zero.
 */
export const OUTREACH_DAILY_LIMIT = 50

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
const SUBJECT = 'Tired of chasing payments?'
const PREHEADER = `See who owes, let Metric send the SMS reminders, and know what you collected. From ${PRICE} a month.`
const DISCLOSURE =
  'We found your gym’s email address on a public page (its website or a business listing) and thought Metric Gym OS might help.'

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
  red: primitiveColors.red[400],
  amber: primitiveColors.yellow[500],
  green: primitiveColors.green[500],
  whatsapp: '#128c7e',
} as const

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const PREVIEW_PADDING = '&#847;&zwnj;&nbsp;'.repeat(30)

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function statusRow(dot: string, title: string, detail: string): string {
  return (
    '<tr>' +
    `<td width="14" style="vertical-align:top;padding-top:6px"><div style="width:9px;height:9px;border-radius:50%;background:${dot}"></div></td>` +
    `<td style="padding:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.45;color:${C.panelInk}">` +
    `<strong style="color:#ffffff">${title}</strong><br><span style="color:${C.panelInkSoft}">${detail}</span></td>` +
    '</tr>'
  )
}

function reason(n: number, title: string, body: string): string {
  return (
    '<tr>' +
    `<td width="40" style="vertical-align:top;padding:2px 0 18px"><div style="width:30px;height:30px;line-height:30px;border-radius:8px;background:${C.brandTint};color:${C.brand};text-align:center;font-family:Arial,sans-serif;font-size:15px;font-weight:700">${n}</div></td>` +
    `<td style="padding:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.inkSoft}">` +
    `<strong style="display:block;font-size:16px;color:${C.ink}">${title}</strong>${body}</td>` +
    '</tr>'
  )
}

function html(unsubscribeUrl: string): string {
  const unsubscribe = escapeAttribute(unsubscribeUrl)
  const whatsapp = escapeAttribute(WHATSAPP_DEMO_URL)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${PREHEADER}${PREVIEW_PADDING}</div>
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="background:${C.brand};padding:36px 28px 32px">
<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.onBrandSoft}">For gym owners in Sri Lanka</p>
<h1 style="margin:0;font-family:${FONT};font-size:34px;line-height:1.15;font-weight:800;color:#ffffff">${SUBJECT}</h1>
<p style="margin:14px 0 0;font-family:${FONT};font-size:17px;line-height:1.55;color:${C.brandTint}">${SITE_NAME} shows you who owes, sends the reminders for you, and tells you what you’ve collected — so you can spend your time on the gym floor, not the register book.</p>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;color:${C.inkSoft}">What you see when you open Metric <span style="color:${C.inkFaint}">(example)</span></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.panel};border-radius:12px">
<tr><td style="padding:18px 20px 6px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${statusRow(C.red, '4 members overdue', 'Reminder SMS already sent')}
${statusRow(C.amber, '7 memberships end this week', 'Each gets a reminder before the due date')}
${statusRow(C.green, 'Rs. 186,500 collected this month', 'Against what members owe, at a glance')}
</table>
</td></tr>
</table>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:20px 28px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${reason(1, 'Know who owes, instantly', 'Who has expired, who expires this week, and who is overdue — no more flipping through the register.')}
${reason(2, 'Reminders go out on their own', 'SMS reminders timed to each member’s plan, and an SMS receipt every time you record a payment.')}
${reason(3, 'See the money clearly', 'What members owe this month against what you actually collected.')}
</table>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:4px 28px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:12px">
<tr><td align="center" style="padding:24px 20px 26px">
<p style="margin:0;font-family:${FONT};font-size:14px;color:${C.inkSoft}">From</p>
<p style="margin:2px 0 4px;font-family:${FONT};font-size:32px;line-height:1.1;font-weight:800;color:${C.ink}">${PRICE}<span style="font-size:16px;font-weight:600;color:${C.inkSoft}"> / month</span></p>
<p style="margin:0 0 20px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.inkSoft}">Up to ${LITE_MEMBER_LIMIT} active members · ${TRIAL_DAYS}&#8209;day&nbsp;free&nbsp;trial</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
<tr><td style="border-radius:10px;background:${C.whatsapp}">
<a href="${whatsapp}" style="display:inline-block;padding:15px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.3;color:#ffffff;text-decoration:none;border-radius:10px;text-align:center">Book a free demo on WhatsApp</a>
</td></tr>
</table>
<p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.inkSoft}">or message us on <a href="${whatsapp}" style="color:${C.whatsapp};font-weight:700;text-decoration:none">${LOCAL_PHONE}</a></p>
</td></tr>
</table>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 28px 30px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.inkSoft}">
Built in Sri Lanka, for Sri Lankan gyms. Just reply to this email if you have a question — a real person reads every one.<br><br>
<span style="color:${C.ink};font-weight:600">The ${SITE_NAME} team</span><br>
<a href="${SITE_URL}" style="color:${C.brand};text-decoration:none;font-weight:600">metricgymos.com</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:22px 12px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.inkSoft};text-align:center">
${DISCLOSURE} Not interested? <a href="${unsubscribe}" style="color:${C.inkSoft};text-decoration:underline">Unsubscribe</a> and we won’t email you again.<br>
${LEGAL_NAME} · ${POSTAL_ADDRESS.lines.join(' ')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function text(unsubscribeUrl: string): string {
  return [
    SUBJECT,
    '',
    `${SITE_NAME} shows you who owes, sends the reminders for you, and tells you what you’ve collected — so you can spend your time on the gym floor, not the register book.`,
    '',
    '1. Know who owes, instantly: who has expired, who expires this week, and who is overdue.',
    '2. Reminders go out on their own: SMS reminders timed to each member’s plan, and an SMS receipt for every payment you record.',
    '3. See the money clearly: what members owe this month against what you actually collected.',
    '',
    `From ${PRICE} a month. Up to ${LITE_MEMBER_LIMIT} active members, ${TRIAL_DAYS}-day free trial.`,
    '',
    `Book a free demo on WhatsApp: ${WHATSAPP_DEMO_URL}`,
    `Or message us on ${LOCAL_PHONE}.`,
    '',
    'Built in Sri Lanka, for Sri Lankan gyms. Just reply if you have a question.',
    `The ${SITE_NAME} team — ${SITE_URL}`,
    '',
    '—',
    `${DISCLOSURE} Not interested? Unsubscribe and we won’t email you again: ${unsubscribeUrl}`,
    `${LEGAL_NAME}, ${POSTAL_ADDRESS.lines.join(' ')}`,
  ].join('\n')
}

/**
 * The introduction email for one recipient.
 *
 * @param input.unsubscribeUrl - The recipient's own /unsubscribe link
 * @returns Subject, HTML and plain-text bodies
 */
export function introCampaignEmail(input: { unsubscribeUrl: string }): {
  subject: string
  html: string
  text: string
} {
  return {
    subject: SUBJECT,
    html: html(input.unsubscribeUrl),
    text: text(input.unsubscribeUrl),
  }
}
