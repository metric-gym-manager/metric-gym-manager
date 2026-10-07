/**
 * The owner's own emails about outreach: the safety brake's alert and the
 * weekly summary. Plain and short — they are read on a phone between other
 * things — with the same numbers in the text and HTML parts.
 *
 * Email HTML is its own surface: tables and inline styles, colours from the
 * design tokens.
 */
import { primitiveColors } from '@/components/ui/tokens'
import {
  OUTREACH_BRAKE,
  OUTREACH_DOMAIN,
  OUTREACH_SEQUENCE_LENGTH,
} from '../config/outreachCampaign'
import type {
  OutreachEventCounts,
  OutreachStatus,
} from '../services/IOutreachLedger'

export interface ReportEmail {
  subject: string
  html: string
  text: string
}

const RESUME_COMMAND = 'npx tsx scripts/send-outreach.ts --resume'
const RESEND_EMAILS_URL = 'https://resend.com/emails'
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const C = {
  page: primitiveColors.neutral[50],
  card: '#ffffff',
  ink: primitiveColors.neutral[900],
  inkSoft: primitiveColors.neutral[600],
  line: primitiveColors.neutral[100],
  red: primitiveColors.red[700],
  green: primitiveColors.green[700],
  amber: primitiveColors.yellow[700],
} as const

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

/** `0.075` → `7.5%`. */
export function percent(part: number, whole: number): string {
  if (whole === 0) return '0%'
  return `${Math.round((part / whole) * 1000) / 10}%`
}

/** "7 October 2026, 10:02", Sri Lanka time. */
function when(at: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at)
}

type Row = [label: string, value: string]

interface Section {
  heading: string
  rows: Row[]
}

interface Body {
  title: string
  /** The status line under the title, coloured by `tone`. */
  status: string
  tone: 'good' | 'warn' | 'bad'
  paragraphs: string[]
  sections: Section[]
  /** Numbered steps; a step may END with the resume command, shown as a code line. */
  steps?: string[]
  footer: string
}

function layout(body: Body): string {
  const toneColour =
    body.tone === 'good' ? C.green : body.tone === 'warn' ? C.amber : C.red
  const p = (text: string, style = '') =>
    `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};${style}">${text}</p>`
  const code = (text: string) =>
    escape(text).replace(
      escape(RESUME_COMMAND),
      `<code style="display:block;margin:6px 0 0;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.5;background:${C.page};padding:6px 8px;border-radius:6px">${escape(RESUME_COMMAND).replace(/(--\w+)/g, '<span style="white-space:nowrap">$1</span>')}</code>`
    )
  const section = (s: Section) =>
    `<p style="margin:22px 0 6px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.inkSoft}">${escape(s.heading)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${s.rows
  .map(
    ([label, value]) =>
      `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:15px;color:${C.ink}">${escape(label)}</td><td align="right" style="padding:7px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:15px;font-weight:600;color:${C.ink};white-space:nowrap">${escape(value)}</td></tr>`
  )
  .join('\n')}
</table>`
  const steps = body.steps
    ? `<p style="margin:22px 0 6px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.inkSoft}">What to do</p>
<ol style="margin:0;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink}">
${body.steps.map((s) => `<li style="margin:0 0 8px">${code(s)}</li>`).join('\n')}
</ol>`
    : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(body.title)}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.card};border-radius:12px">
<tr><td style="padding:28px 24px">
<h1 style="margin:0 0 6px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.ink}">${escape(body.title)}</h1>
${p(escape(body.status), `font-weight:600;color:${toneColour}`)}
${body.paragraphs.map((text) => p(escape(text))).join('\n')}
${body.sections.map(section).join('\n')}
${steps}
<p style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.inkSoft}">${escape(body.footer)} <a href="${RESEND_EMAILS_URL}" style="color:${C.inkSoft}">Resend → Emails</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

function plainText(body: Body): string {
  const lines = [body.title, '', body.status, '']
  for (const paragraph of body.paragraphs) lines.push(paragraph, '')
  for (const s of body.sections) {
    lines.push(s.heading.toUpperCase())
    for (const [label, value] of s.rows) lines.push(`  ${label}: ${value}`)
    lines.push('')
  }
  if (body.steps) {
    lines.push('WHAT TO DO')
    body.steps.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`))
    lines.push('')
  }
  lines.push(`${body.footer} ${RESEND_EMAILS_URL}`)
  return lines.join('\n')
}

function render(subject: string, body: Body): ReportEmail {
  return { subject, html: layout(body), text: plainText(body) }
}

function countRows(counts: OutreachEventCounts): Row[] {
  return [
    ['Emails sent', String(counts.sent)],
    [
      'Bounced',
      counts.sent > 0
        ? `${counts.bounced} (${percent(counts.bounced, counts.sent)})`
        : String(counts.bounced),
    ],
    ['Spam complaints', String(counts.complained)],
    ['Unsubscribed', String(counts.unsubscribed)],
  ]
}

const BRAKE_RULE =
  `The campaign pauses itself at ${OUTREACH_BRAKE.complaints} spam complaints, ` +
  `or when more than ${percent(OUTREACH_BRAKE.bounceRate, 1)} of its emails ` +
  `bounce (judged after ${OUTREACH_BRAKE.minSendsForBounceRate} sends).`

const FOOTER =
  'Bounces, spam complaints and unsubscribes are handled for you: those ' +
  'addresses are never emailed again. Every email is in'

export interface PausedAlertInput {
  campaign: string
  reason: string
  pausedAt: Date
  /** Counted since the start, or since the last resume. */
  counts: OutreachEventCounts
  resumedAt: Date | null
}

/** The safety brake's alert: what tripped it, what it protects, how to resume. */
export function pausedAlertEmail(input: PausedAlertInput): ReportEmail {
  return render(`Outreach paused: ${input.reason}`, {
    title: 'Outreach has paused itself',
    status: `Paused ${when(input.pausedAt)}: ${input.reason}.`,
    tone: 'bad',
    paragraphs: [
      `Nothing more of ${input.campaign} will be sent until you resume it.`,
      'Mail providers judge a sending domain by how many of its emails ' +
        `bounce or are marked as spam. Pausing now keeps ${OUTREACH_DOMAIN} ` +
        'in good standing, and with it the email your gyms rely on.',
    ],
    sections: [
      {
        heading: input.resumedAt
          ? `Since you resumed it on ${when(input.resumedAt)}`
          : 'Since the campaign started',
        rows: countRows(input.counts),
      },
    ],
    steps: [
      'See who bounced or complained: Resend → Emails, filtered by the tag kind = outreach.',
      `If the list looks right, resume it; the brake counts afresh from then: ${RESUME_COMMAND}`,
      'To end the campaign instead, do nothing: it stays paused.',
    ],
    footer: `${BRAKE_RULE} ${FOOTER}`,
  })
}

export interface WeeklySummaryInput {
  campaign: string
  now: Date
  /** The last 7 days. */
  week: OutreachEventCounts
  /** Every address of the campaign. */
  progress: { status: OutreachStatus; step: number }[]
  paused: { since: Date; reason: string } | null
}

/** The Monday summary: the week in numbers, and whether the campaign is running. */
export function weeklySummaryEmail(input: WeeklySummaryInput): ReportEmail {
  const tally = (status: OutreachStatus) =>
    input.progress.filter((r) => r.status === status).length
  const active = input.progress.filter((r) => r.status === 'active')
  const finished = active.length === 0
  const status = input.paused
    ? `Paused since ${when(input.paused.since)}: ${input.paused.reason}.`
    : finished
      ? 'Finished: every address has had all four emails, or has stopped.'
      : 'Running: the next emails go out on schedule.'
  const tone = input.paused ? 'bad' : finished ? 'warn' : 'good'

  const onStep: Row[] = []
  for (let step = 0; step < OUTREACH_SEQUENCE_LENGTH; step++) {
    const n = active.filter((r) => r.step === step).length
    if (n > 0) {
      onStep.push([
        step === 0
          ? 'Waiting for email 1'
          : `Had email ${step}, next is ${step + 1}`,
        String(n),
      ])
    }
  }

  const w = input.week
  const subject = input.paused
    ? `Outreach paused: ${input.paused.reason}`
    : `Outreach this week: ${w.sent} sent, ${plural(w.bounced, 'bounce')}, ${plural(w.complained, 'spam complaint')}`

  return render(subject, {
    title: `Outreach this week`,
    status,
    tone,
    paragraphs: [
      `${input.campaign}, the week to ${when(input.now)} (Sri Lanka time).`,
    ],
    sections: [
      { heading: 'Last 7 days', rows: countRows(w) },
      {
        heading: `Whole campaign (${plural(input.progress.length, 'address', 'addresses')})`,
        rows: [
          ...onStep,
          ['Had all four emails', String(tally('done'))],
          ['Unsubscribed', String(tally('unsubscribed'))],
          ['Bounced', String(tally('bounced'))],
          ['Spam complaints', String(tally('complained'))],
          ['Sends kept failing', String(tally('failed'))],
        ],
      },
    ],
    ...(input.paused
      ? {
          steps: [
            'See who bounced or complained: Resend → Emails, filtered by the tag kind = outreach.',
            `If the list looks right, resume it: ${RESUME_COMMAND}`,
          ],
        }
      : {}),
    footer: `${BRAKE_RULE} ${FOOTER}`,
  })
}
