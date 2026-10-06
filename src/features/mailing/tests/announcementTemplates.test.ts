/**
 * @jest-environment node
 */
import {
  CONTACT,
  LEGAL_NAME,
  POSTAL_ADDRESS,
  SITE_URL,
} from '@/features/marketing/config/site'
import {
  ANNOUNCEMENT_TEMPLATE_ALIAS,
  ANNOUNCEMENT_VARIABLES,
  AnnouncementKind,
  ChangeCategory,
} from '../config/AnnouncementConfig'
import {
  ANNOUNCEMENT_TEMPLATES,
  templateVariableDeclarations,
} from '../config/announcementTemplates'
import {
  MailingTopic,
  preferencesLinkTemplate,
  unsubscribeLinkTemplate,
} from '../config/MailingConfig'
import { policyVariables, releaseVariables } from '../utils/announcementContent'
import { emptyChanges } from '../utils/changelog'
import { placeholdersIn, renderTemplate } from '../utils/renderTemplate'

/**
 * The two announcement emails are designed here and published to Resend
 * (`scripts/publish-email-templates.ts`). These tests hold the designs to the
 * pipeline's contract, so a design can never ask for a value the pipeline does
 * not fill — which would stop every send of that kind.
 */

const KINDS = Object.values(AnnouncementKind)

function release() {
  const changes = emptyChanges()
  changes[ChangeCategory.New] = [
    { text: 'Record a part payment from the member sheet.', details: [] },
  ]
  changes[ChangeCategory.Fixed] = [
    { text: 'Totals no longer count cancelled members.', details: [] },
  ]
  return releaseVariables({
    releases: [{ version: '1.1.0', date: '2026-10-06', changes }],
    previousVersion: '1.0.0',
    now: new Date('2026-10-06T04:00:00Z'),
  })
}

function policy() {
  return policyVariables({
    path: '/privacy',
    date: '2026-10-06',
    notify: true,
    summary: ['We now send two kinds of optional email.'],
  })
}

const VALUES = {
  [AnnouncementKind.Release]: release(),
  [AnnouncementKind.Policy]: policy(),
}

describe.each(KINDS)('the %s email', (kind) => {
  const template = ANNOUNCEMENT_TEMPLATES[kind]
  const declared = templateVariableDeclarations(kind)

  it('is published under the alias the pipeline fetches', () => {
    expect(template.alias).toBe(ANNOUNCEMENT_TEMPLATE_ALIAS[kind])
  })

  it('uses only variables the pipeline fills', () => {
    const contract = new Set<string>(ANNOUNCEMENT_VARIABLES[kind])
    for (const name of placeholdersIn(`${template.subject} ${template.html}`)) {
      expect(contract.has(name)).toBe(true)
    }
  })

  it('declares every variable of the contract to Resend', () => {
    expect(declared.map((v) => v.key).sort()).toEqual(
      [...ANNOUNCEMENT_VARIABLES[kind]].sort()
    )
    for (const v of declared) {
      expect(v.type).toBe(v.key.endsWith('_COUNT') ? 'number' : 'string')
    }
  })

  it('gives text no fallback, so an unfilled field stops the send instead of going out blank', () => {
    for (const v of declared.filter((d) => d.type === 'string')) {
      expect(v).not.toHaveProperty('fallbackValue')
    }
  })

  it('renders completely from real content, leaving only Resend its per-recipient fields', () => {
    const body = renderTemplate(template.html, VALUES[kind], [])
    const subject = renderTemplate(template.subject, VALUES[kind], [])
    expect(body.unresolved).toEqual([])
    expect(subject.unresolved).toEqual([])
    expect(body.html.match(/\{\{\{(?!contact\.)[^}]*\}\}\}/g)).toBeNull()
  })

  it('greets the gym by name, with a fallback for a contact without one', () => {
    expect(template.html).toContain('{{{contact.gym_name|there}}}')
  })

  it('names the sender and its postal address, as commercial email must', () => {
    expect(template.html).toContain(LEGAL_NAME)
    expect(template.html).toContain(POSTAL_ADDRESS.streetAddress)
  })

  it('offers the support WhatsApp number and hours in plain words', () => {
    expect(template.html).toContain(CONTACT.phoneDisplay)
    expect(template.html).toContain('every day, 08:00–22:00 Sri Lanka time')
  })

  it('lets a button label wrap without its lines colliding', () => {
    expect(template.html).not.toMatch(/<a [^>]*line-height:1;/)
  })

  it('fits a phone: one 560 px column that shrinks, nothing fixed wider than the logo', () => {
    expect(template.html).toContain('max-width:560px')
    for (const [, value] of template.html.matchAll(/\swidth="([^"]+)"/g)) {
      expect(value === '100%' || Number(value) <= 48).toBe(true)
    }
  })

  it('loads its logo from the public site over https', () => {
    expect(template.html).toContain(`src="${SITE_URL}/icon-192.png"`)
  })

  it('is a complete HTML document with a hidden preview line', () => {
    expect(template.html).toMatch(/^<!doctype html>/i)
    expect(template.html).toContain('display:none')
  })
})

describe('the release email', () => {
  const { html, subject } = ANNOUNCEMENT_TEMPLATES[AnnouncementKind.Release]

  it('leads with what changed, in words, not a version number', () => {
    expect(subject).toContain('{{{SUMMARY}}}')
    expect(subject).not.toContain('{{{VERSION}}}')
    expect(html).toContain('{{{CHANGES_HTML}}}')
  })

  it('tells the gym there is nothing to install', () => {
    expect(html).toMatch(/nothing to install/i)
  })

  it('links to the app and to the product-updates opt-out', () => {
    expect(html).toContain('href="{{{APP_URL}}}"')
    expect(html).toContain('href="{{{UNSUBSCRIBE_URL}}}"')
    expect(VALUES[AnnouncementKind.Release].UNSUBSCRIBE_URL).toBe(
      unsubscribeLinkTemplate(MailingTopic.Updates)
    )
  })
})

describe('the policy email', () => {
  const { html, subject } = ANNOUNCEMENT_TEMPLATES[AnnouncementKind.Policy]

  it('names the document in the subject', () => {
    expect(subject).toContain('{{{DOCUMENT_NAME}}}')
  })

  it('summarises the change and links to the full document', () => {
    expect(html).toContain('{{{SUMMARY_HTML}}}')
    expect(html).toContain('href="{{{DOCUMENT_URL}}}"')
    expect(html).toContain('{{{UPDATED_DATE}}}')
  })

  it('says why it cannot be switched off, and links to the other email choices', () => {
    expect(html).toMatch(/every Metric Gym OS account/i)
    expect(html).toContain('href="{{{PREFERENCES_URL}}}"')
    expect(VALUES[AnnouncementKind.Policy].PREFERENCES_URL).toBe(
      preferencesLinkTemplate()
    )
  })

  it('never offers an unsubscribe it cannot honour', () => {
    expect(html).not.toContain('{{{UNSUBSCRIBE_URL}}}')
    expect(html).not.toMatch(/unsubscribe/i)
  })
})
