/**
 * The designs of the two announcement emails — the source of the Resend
 * templates `release-announcement` and `policy-update`.
 *
 * Written for gym owners, not developers: what changed in plain words, that
 * there is nothing to do, and how to reach a person. No version number in the
 * subject; it sits in the footer for support.
 *
 * `scripts/publish-email-templates.ts` creates or updates both in Resend and
 * publishes them; the Release workflow runs it whenever this file or the
 * shared frame (`utils/emailFrame.ts`) changes. The
 * placeholders are Resend's triple-brace variables: ours are filled by
 * `SendAnnouncements` (the contract is `ANNOUNCEMENT_VARIABLES`), and
 * `{{{contact.*}}}` by Resend, per recipient.
 *
 * Email HTML is its own rendering surface, like the QR poster: tables and
 * inline styles, no CSS variables. Colours come from the design tokens where
 * one exists. The frame, the button and the phone layout are shared with the
 * outreach series (`utils/emailFrame.ts`): one 560 px column on the desktop,
 * tighter padding and a full-width button on a phone, and the phone number
 * kept whole — `scripts/check-email-layout.ts` measures both.
 *
 * Client-safe: pure data.
 */
import {
  CONTACT,
  LEGAL_NAME,
  POSTAL_ADDRESS,
  SUPPORT_HOURS,
} from '@/features/marketing/config/site'
import {
  EMAIL_COLOURS,
  EMAIL_FONT,
  M,
  emailButton,
  emailDocument,
  keep,
} from '../utils/emailFrame'
import {
  ANNOUNCEMENT_TEMPLATE_ALIAS,
  ANNOUNCEMENT_VARIABLES,
  AnnouncementKind,
} from './AnnouncementConfig'

const PALETTE = EMAIL_COLOURS
const FONT = EMAIL_FONT

const ADDRESS = `${LEGAL_NAME} · ${POSTAL_ADDRESS.lines.join(' ')}`

/** "every day, 08:00–22:00 Sri Lanka time", mid-sentence. */
const HOURS =
  SUPPORT_HOURS.display.charAt(0).toLowerCase() + SUPPORT_HOURS.display.slice(1)

function button(href: string, label: string): string {
  return emailButton(href, label, {
    colour: PALETTE.brand,
    margin: '28px 0 8px',
    radius: 8,
    padding: '13px 24px',
    fontSize: 15,
    fontWeight: 600,
  })
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
    `${keep(CONTACT.phoneDisplay)}</a> (${HOURS}).</p>`
  )
}

interface LayoutParts {
  title: string
  preheader: string
  card: string
  footer: string
}

function layout({ title, preheader, card, footer }: LayoutParts): string {
  return emailDocument({
    title,
    preheader,
    body: card,
    card: 'padded',
    footer: `${footer}\n<br>${ADDRESS}`,
  })
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
    `<div class="${M.inset}" style="margin:0 0 20px;padding:16px 20px 4px;border-left:3px solid ${PALETTE.brand};border-radius:4px;` +
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
