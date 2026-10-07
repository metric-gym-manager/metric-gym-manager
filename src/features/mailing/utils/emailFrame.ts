/**
 * The frame every email to a person shares — the outreach series and the
 * release and policy announcements — and the phone layout on top of it.
 *
 * Email HTML is its own rendering surface: tables and inline styles. The
 * inline styles ARE the desktop layout, sized for one 560 px column. On a
 * phone a mail app leaves an email about 320–340 px, and those same paddings
 * and font sizes squeezed the text into 140–200 px columns, put headlines on
 * four lines and split "Rs. 2,990 / month" (measured 2026-10-07,
 * `scripts/check-email-layout.ts`). So:
 *
 * - `PHONE_STYLE` is one `@media (max-width: 480px)` block in `<head>`.
 *   Apple Mail, the Gmail app, Outlook mobile and Samsung Mail apply it; it
 *   only ever overrides on a phone (`!important` beats inline), so the
 *   desktop renders exactly as before. Elements opt in by class (`M`).
 * - What must never split — prices with their unit, phone numbers — is kept
 *   whole INLINE (`keep`), so it holds in a mail app that drops `<style>` too.
 *
 * The stylesheet never has two braces side by side: the announcement designs
 * are Resend templates, where `{{` opens a variable.
 *
 * Client-safe: pure strings.
 */
import { primitiveColors } from '@/components/ui/tokens'
import { SITE_NAME, SITE_URL } from '@/features/marketing/config/site'

export const EMAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Keeps the inbox preview to the preheader, not the first words of the body. */
export const EMAIL_PREVIEW_PADDING = '&#847;&zwnj;&nbsp;'.repeat(30)

export const EMAIL_COLOURS = {
  page: primitiveColors.neutral[50],
  card: '#ffffff',
  ink: primitiveColors.neutral[900],
  inkSoft: primitiveColors.neutral[600],
  inkFaint: primitiveColors.neutral[500],
  line: primitiveColors.neutral[100],
  brand: primitiveColors.blue[700],
  // `blue.bg` (12 % brand) flattened onto white: Outlook ignores rgba().
  brandTint: '#e4e3ff',
} as const

/** Below this width an email is on a phone. */
export const PHONE_MAX_WIDTH = 480

/** The classes the phone stylesheet targets; each only overrides on a phone. */
export const M = {
  /** The page gutter around the card. */
  outer: 'm-outer',
  /** A card that pads its own content (the announcements). */
  card: 'm-card',
  /** A full-width section's side padding (the outreach sections). */
  x: 'm-x',
  eyebrow: 'm-eyebrow',
  headline: 'm-h1',
  lead: 'm-lead',
  /** The padding inside a panel or box within a section. */
  inset: 'm-inset',
  price: 'm-price',
  /** Text that steps down to 14 px. */
  small: 'm-small',
  buttonTable: 'm-btn-t',
  button: 'm-btn',
  /** Never split across lines (a marker; the nowrap is inline). */
  keep: 'm-keep',
} as const

export const PHONE_STYLE = `<style>
@media only screen and (max-width: ${PHONE_MAX_WIDTH}px) {
  .${M.outer} { padding: 16px 8px 28px !important; }
  .${M.card} { padding: 24px 18px !important; }
  .${M.x} { padding-left: 18px !important; padding-right: 18px !important; }
  .${M.eyebrow} { font-size: 12px !important; letter-spacing: 0.05em !important; }
  .${M.headline} { font-size: 26px !important; line-height: 1.2 !important; }
  .${M.lead} { font-size: 16px !important; }
  .${M.inset} { padding-left: 10px !important; padding-right: 10px !important; }
  .${M.price} { font-size: 28px !important; }
  .${M.small} { font-size: 14px !important; }
  .${M.buttonTable} { width: 100% !important; }
  .${M.button} { display: block !important; padding-left: 10px !important; padding-right: 10px !important; font-size: 14px !important; text-align: center !important; }
}
</style>`

/**
 * Keep a short run of text on one line — in every mail app, with or without
 * the phone stylesheet.
 *
 * @param html - e.g. a price with its unit, or a phone number
 */
export function keep(html: string): string {
  return `<span class="${M.keep}" style="white-space:nowrap">${html}</span>`
}

/** Longer than this, two tied words could not fit a phone at headline size. */
const MAX_TIED_LENGTH = 15

/**
 * Tie the last two words of a short text together, so a narrow column never
 * leaves one word alone on the last line ("Renewals, churn and / retention").
 * Only when the pair is short: "chasing payments?" at 32 px is wider than a
 * phone that ignores the phone stylesheet. Plain text only.
 *
 * @example
 * noOrphan('Reminders go out on their own') // 'Reminders go out on their&nbsp;own'
 */
export function noOrphan(text: string): string {
  const last = text.lastIndexOf(' ')
  if (last <= 0) return text
  const before = text.lastIndexOf(' ', last - 1)
  if (text.length - before - 1 > MAX_TIED_LENGTH) return text
  return `${text.slice(0, last)}&nbsp;${text.slice(last + 1)}`
}

export interface EmailButtonStyle {
  colour: string
  /** The desktop table's margin, e.g. `28px 0 8px` or `0 auto`. */
  margin: string
  radius: number
  padding: string
  fontSize: number
  fontWeight: number
}

/**
 * A button: as styled on the desktop, full width on a phone so its label has
 * the whole column and stays on one line.
 *
 * @param href - Already attribute-safe
 * @param label - HTML
 */
export function emailButton(
  href: string,
  label: string,
  style: EmailButtonStyle
): string {
  return (
    `<table role="presentation" class="${M.buttonTable}" cellpadding="0" cellspacing="0" border="0" style="margin:${style.margin}">` +
    `<tr><td style="border-radius:${style.radius}px;background:${style.colour}">` +
    `<a href="${href}" class="${M.button}" style="display:inline-block;padding:${style.padding};font-family:${EMAIL_FONT};` +
    `font-size:${style.fontSize}px;font-weight:${style.fontWeight};line-height:1.3;color:#ffffff;text-decoration:none;` +
    `border-radius:${style.radius}px;text-align:center">${label}</a></td></tr></table>`
  )
}

export interface EmailDocument {
  title: string
  preheader: string
  /** The card's content. */
  body: string
  /**
   * `padded`: the card pads its content (32 × 28 px; 24 × 18 px on a phone).
   * `sections`: full-width sections pad themselves, with `M.x`.
   */
  card: 'padded' | 'sections'
  /** Below the card, centred and small. */
  footer: string
}

/**
 * A whole email: the head with the phone stylesheet, the preheader, the
 * logo row, the card and the footer.
 */
export function emailDocument(doc: EmailDocument): string {
  const C = EMAIL_COLOURS
  const card =
    doc.card === 'padded'
      ? `<tr><td class="${M.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:32px 28px">`
      : `<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;overflow:hidden">`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${doc.title}</title>
${PHONE_STYLE}
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${doc.preheader}${EMAIL_PREVIEW_PADDING}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}">
<tr><td align="center" class="${M.outer}" style="padding:28px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${SITE_URL}/icon-192.png" width="30" height="30" alt="" style="display:block;border:0;outline:none;border-radius:7px"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:${EMAIL_FONT};font-size:16px;font-weight:700;color:${C.ink}">${SITE_NAME}</td>
</tr></table>
</td></tr>
${card}
${doc.body}
</td></tr>
<tr><td style="padding:22px 12px 0;font-family:${EMAIL_FONT};font-size:12px;line-height:1.7;color:${C.inkSoft};text-align:center">
${doc.footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
