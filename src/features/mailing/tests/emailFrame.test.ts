/**
 * @jest-environment node
 */
import { CONTACT } from '@/features/marketing/config/site'
import { AnnouncementKind } from '../config/AnnouncementConfig'
import { ANNOUNCEMENT_TEMPLATES } from '../config/announcementTemplates'
import { outreachEmail } from '../config/outreachCampaign'
import {
  M,
  PHONE_STYLE,
  emailDocument,
  keep,
  noOrphan,
} from '../utils/emailFrame'
import { placeholdersIn } from '../utils/renderTemplate'

/**
 * The phone layout every email to a person shares (owner request,
 * 2026-10-07: "they are broken into different lines on mobile"). jsdom has
 * no layout, so the geometry is measured by `scripts/check-email-layout.ts`
 * in Chromium; this pins what that measurement relies on, on every commit.
 */
const OUTREACH = ([1, 2, 3, 4] as const).map(
  (step) =>
    [
      `outreach email ${step}`,
      outreachEmail(step, {
        unsubscribeUrl:
          'https://www.metricgymos.com/unsubscribe?email=a%40b.lk&token=t&topic=marketing',
      }).html,
    ] as const
)
const ANNOUNCEMENTS = Object.values(AnnouncementKind).map(
  (kind) => [`${kind} announcement`, ANNOUNCEMENT_TEMPLATES[kind].html] as const
)
const ALL = [...OUTREACH, ...ANNOUNCEMENTS]

describe('the phone stylesheet', () => {
  it('only applies on a phone, so the desktop renders as before', () => {
    expect(PHONE_STYLE).toMatch(
      /^<style>\s*@media only screen and \(max-width: 480px\) \{[\s\S]*\}\s*<\/style>$/
    )
    // Every rule inside the one media query.
    expect(PHONE_STYLE.match(/@media/g)).toHaveLength(1)
  })

  it('never puts two braces side by side: the announcements are Resend templates, where {{ opens a variable', () => {
    expect(PHONE_STYLE).not.toMatch(/\{\{|\}\}/)
  })

  it.each(ALL)('%s carries it in its head', (_name, html) => {
    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toContain(PHONE_STYLE)
  })
})

describe('every email', () => {
  it.each(ALL)('%s has full-width-on-a-phone buttons', (_name, html) => {
    const tables = html.match(new RegExp(`class="${M.buttonTable}"`, 'g')) ?? []
    const links = html.match(new RegExp(`class="${M.button}"`, 'g')) ?? []
    expect(tables.length).toBeGreaterThan(0)
    expect(links).toHaveLength(tables.length)
  })

  it.each(ALL)('%s fits under Gmail’s 102 KB clipping limit', (_name, html) => {
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(102 * 1024)
  })

  it.each(ALL)(
    '%s puts its content in the phone-aware frame',
    (_name, html) => {
      expect(html).toContain(`class="${M.outer}"`)
    }
  )
})

describe('what must never split across lines', () => {
  const kept = (html: string, text: string) => {
    const everywhere = html.split(text).length - 1
    const whole =
      html.split(
        `<span class="${M.keep}" style="white-space:nowrap">${text}</span>`
      ).length - 1
    return { everywhere, whole }
  }

  it.each(OUTREACH)(
    '%s keeps the phone number and the price whole',
    (_name, html) => {
      const phone = kept(html, '070 437 9967')
      expect(phone.everywhere).toBeGreaterThan(0)
      expect(phone.whole).toBe(phone.everywhere)
      expect(html).toMatch(
        /<span class="m-keep" style="white-space:nowrap">Rs\. [\d,]+<\/span>/
      )
      expect(html).toContain(keep('/ month'))
    }
  )

  it.each(ANNOUNCEMENTS)('%s keeps the phone number whole', (_name, html) => {
    const phone = kept(html, CONTACT.phoneDisplay)
    expect(phone.everywhere).toBe(1)
    expect(phone.whole).toBe(1)
  })
})

describe('the announcement templates', () => {
  it.each(ANNOUNCEMENTS)(
    '%s gains no variables from the layout',
    (_name, html) => {
      for (const name of placeholdersIn(html)) {
        expect(name).toMatch(/^[A-Z_]+$|^contact\./)
      }
    }
  )
})

describe('noOrphan', () => {
  it('ties the last two words, so one word is never alone on a line', () => {
    expect(noOrphan('Renewals, churn and retention')).toBe(
      'Renewals, churn and&nbsp;retention'
    )
  })

  it('leaves a pair too long to fit a phone at headline size', () => {
    expect(noOrphan('Tired of chasing payments?')).toBe(
      'Tired of chasing payments?'
    )
  })

  it('leaves one word alone', () => {
    expect(noOrphan('Hello')).toBe('Hello')
  })
})

describe('emailDocument', () => {
  it('pads the card itself, or leaves its sections to pad themselves', () => {
    const doc = (card: 'padded' | 'sections') =>
      emailDocument({
        title: 't',
        preheader: 'p',
        body: 'B',
        card,
        footer: 'F',
      })
    expect(doc('padded')).toContain(`class="${M.card}"`)
    expect(doc('sections')).not.toContain(`class="${M.card}"`)
  })
})
