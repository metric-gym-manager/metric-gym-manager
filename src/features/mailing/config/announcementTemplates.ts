/**
 * The designs of the two announcement emails — the source of the Resend
 * templates `release-announcement` and `policy-update`.
 *
 * Written for gym owners, not developers: what changed in plain words, that
 * there is nothing to do, and how to reach a person. No version number in the
 * subject; it sits in the footer for support.
 *
 * `scripts/publish-email-templates.ts` creates or updates both in Resend and
 * publishes them; the Release workflow runs it whenever this file changes. The
 * placeholders are Resend's triple-brace variables: ours are filled by
 * `SendAnnouncements` (the contract is `ANNOUNCEMENT_VARIABLES`), and
 * `{{{contact.*}}}` by Resend, per recipient.
 *
 * Email HTML is its own rendering surface, like the QR poster: tables and
 * inline styles, no CSS variables, no classes. Colours come from the design
 * tokens where one exists. One 560 px column that shrinks on a phone — a fixed
 * width overflows a 390 px screen (measured 2026-10-06).
 *
 * Client-safe: pure data.
 */
import { primitiveColors } from '@/components/ui/tokens'
import {
  CONTACT,
  LEGAL_NAME,
  POSTAL_ADDRESS,
  SITE_NAME,
  SITE_URL,
  SUPPORT_HOURS,
} from '@/features/marketing/config/site'
import {
  ANNOUNCEMENT_TEMPLATE_ALIAS,
  ANNOUNCEMENT_VARIABLES,
  AnnouncementKind,
} from './AnnouncementConfig'

const PALETTE = {
  page: primitiveColors.neutral[50],
  card: '#ffffff',
  ink: primitiveColors.neutral[900],
  inkSoft: primitiveColors.neutral[600],
  line: primitiveColors.neutral[100],
  brand: primitiveColors.blue[700],
  // `blue.bg` (12 % brand) flattened onto white: Outlook ignores rgba().
  brandTint: '#e4e3ff',
} as const

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Keeps the inbox preview to the preheader, not the first words of the body. */
const PREVIEW_PADDING = '&#847;&zwnj;&nbsp;'.repeat(30)

const ADDRESS = `${LEGAL_NAME} · ${POSTAL_ADDRESS.lines.join(' ')}`

/** "every day, 08:00–22:00 Sri Lanka time", mid-sentence. */
const HOURS =
  SUPPORT_HOURS.display.charAt(0).toLowerCase() + SUPPORT_HOURS.display.slice(1)

function button(href: string, label: string): string {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">' +
    `<tr><td style="border-radius:8px;background:${PALETTE.brand}">` +
    `<a href="${href}" style="display:inline-block;padding:13px 24px;font-family:${FONT};` +
    `font-size:15px;font-weight:600;line-height:1.3;color:#ffffff;text-decoration:none;border-radius:8px">` +
    `${label}</a></td></tr></table>`
  )
}

function badge(text: string): string {
  return (
    `<span style="display:inline-block;padding:5px 11px;border-radius:999px;background:${PALETTE.brandTint};` +
    `color:${PALETTE.brand};font-family:${FONT};font-size:12px;font-weight:600;line-height:1.4;letter-spacing:0.02em">` +
    `${text}</span>`
  )
}

function paragraph(html: string, extra = ''): string {
  return (
    `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${PALETTE.ink};${extra}">` +
    `${html}</p>`
  )
}

function help(question: string): string {
  return (
    `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${PALETTE.line};font-family:${FONT};` +
    `font-size:14px;line-height:1.6;color:${PALETTE.inkSoft}">` +
    `${question} Just reply to this email — a real person reads every one. ` +
    `Or WhatsApp us on <a href="${CONTACT.whatsappUrl}" style="color:${PALETTE.brand};text-decoration:none;font-weight:600">` +
    `${CONTACT.phoneDisplay}</a> (${HOURS}).</p>`
  )
}

interface LayoutParts {
  title: string
  preheader: string
  card: string
  footer: string
}

function layout({ title, preheader, card, footer }: LayoutParts): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${PALETTE.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${preheader}${PREVIEW_PADDING}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALETTE.page}">
<tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${SITE_URL}/icon-192.png" width="30" height="30" alt="" style="display:block;border:0;outline:none;border-radius:7px"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-size:16px;font-weight:700;color:${PALETTE.ink}">${SITE_NAME}</td>
</tr></table>
</td></tr>
<tr><td style="background:${PALETTE.card};border:1px solid ${PALETTE.line};border-radius:14px;padding:32px 28px">
${card}
</td></tr>
<tr><td style="padding:22px 12px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${PALETTE.inkSoft};text-align:center">
${footer}
<br>${ADDRESS}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

const RELEASE_HTML = layout({
  title: 'What’s new in Metric Gym OS',
  preheader: '{{{SUMMARY}}} — already live in your account.',
  card:
    badge('{{{RELEASE_TYPE}}}') +
    `<h1 style="margin:16px 0 14px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${PALETTE.ink}">` +
    'Here’s what’s new in Metric Gym OS</h1>' +
    paragraph(
      'Hi {{{contact.gym_name|there}}}, we’ve just made Metric Gym OS better for you. ' +
        'This update brings {{{SUMMARY}}}.'
    ) +
    `<p style="margin:0 0 8px;padding:12px 16px;border-radius:10px;background:${PALETTE.brandTint};` +
    `font-family:${FONT};font-size:14px;line-height:1.5;color:${PALETTE.ink}">` +
    '<strong>Nothing to install.</strong> The changes are already live — just open Metric Gym OS as usual.</p>' +
    `<div style="margin:8px 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${PALETTE.ink}">` +
    '{{{CHANGES_HTML}}}</div>' +
    button('{{{APP_URL}}}', 'Open Metric Gym OS') +
    help('Questions or ideas?'),
  footer:
    'Update {{{VERSION}}} · {{{RELEASE_DATE}}}<br>' +
    'You’re receiving this because your gym uses Metric Gym OS. ' +
    `<a href="{{{UNSUBSCRIBE_URL}}}" style="color:${PALETTE.inkSoft};text-decoration:underline">Stop product update emails</a>`,
})

const POLICY_HTML = layout({
  title: 'We’ve updated our {{{DOCUMENT_NAME}}}',
  preheader: 'A short, plain-English summary of what changed.',
  card:
    badge('Policy update') +
    `<h1 style="margin:16px 0 14px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${PALETTE.ink}">` +
    'We’ve updated our {{{DOCUMENT_NAME}}}</h1>' +
    paragraph(
      'Hi {{{contact.gym_name|there}}}, we’ve made some changes to our {{{DOCUMENT_NAME}}}, ' +
        'effective {{{UPDATED_DATE}}}. Here’s what’s different, in plain words:'
    ) +
    `<div style="margin:0 0 20px;padding:16px 20px 4px;border-left:3px solid ${PALETTE.brand};border-radius:4px;` +
    `background:${PALETTE.page};font-family:${FONT};font-size:15px;line-height:1.6;color:${PALETTE.ink}">` +
    '{{{SUMMARY_HTML}}}</div>' +
    paragraph(
      'You don’t need to do anything. We’re letting you know so there are no surprises.',
      'margin-bottom:0'
    ) +
    button('{{{DOCUMENT_URL}}}', 'Read the full {{{DOCUMENT_NAME}}}') +
    help('Questions about these changes?'),
  footer:
    'We send this notice to every Metric Gym OS account when one of our policies changes. ' +
    `<a href="{{{PREFERENCES_URL}}}" style="color:${PALETTE.inkSoft};text-decoration:underline">Choose which other emails you get</a>`,
})

export interface AnnouncementTemplateSource {
  alias: string
  /** The name shown in the Resend dashboard. */
  name: string
  subject: string
  html: string
}

export const ANNOUNCEMENT_TEMPLATES: Record<
  AnnouncementKind,
  AnnouncementTemplateSource
> = {
  [AnnouncementKind.Release]: {
    alias: ANNOUNCEMENT_TEMPLATE_ALIAS[AnnouncementKind.Release],
    name: 'Release announcement',
    subject: 'What’s new in Metric Gym OS: {{{SUMMARY}}}',
    html: RELEASE_HTML,
  },
  [AnnouncementKind.Policy]: {
    alias: ANNOUNCEMENT_TEMPLATE_ALIAS[AnnouncementKind.Policy],
    name: 'Policy update',
    subject: 'We’ve updated our {{{DOCUMENT_NAME}}}',
    html: POLICY_HTML,
  },
}

export type TemplateVariableDeclaration =
  | { key: string; type: 'string' }
  | { key: string; type: 'number'; fallbackValue: number }

/**
 * The variables a template declares in Resend: the whole contract for its
 * kind, counts as numbers.
 *
 * Text variables get NO fallback, deliberately: the render refuses to send a
 * placeholder left without a value, and an empty fallback would turn that
 * refusal into an email with a blank where the content should be. A missing
 * count reads 0, which is true.
 *
 * @param kind - Which template
 */
export function templateVariableDeclarations(
  kind: AnnouncementKind
): TemplateVariableDeclaration[] {
  return ANNOUNCEMENT_VARIABLES[kind].map((key) =>
    key.endsWith('_COUNT')
      ? { key, type: 'number' as const, fallbackValue: 0 }
      : { key, type: 'string' as const }
  )
}
