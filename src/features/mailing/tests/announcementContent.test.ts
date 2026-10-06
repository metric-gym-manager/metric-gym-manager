/**
 * @jest-environment node
 */
import { SITE_URL } from '@/features/marketing/config/site'
import {
  ANNOUNCEMENT_VARIABLES,
  AnnouncementKind,
  ChangeCategory,
} from '../config/AnnouncementConfig'
import {
  MailingTopic,
  preferencesLinkTemplate,
  unsubscribeLinkTemplate,
} from '../config/MailingConfig'
import {
  escapeHtml,
  policyVariables,
  previewBanner,
  releaseVariables,
} from '../utils/announcementContent'
import { emptyChanges, type ReleaseSection } from '../utils/changelog'

function section(
  version: string,
  date: string | null,
  changes: Partial<
    Record<ChangeCategory, { text: string; details?: string[] }[]>
  >
): ReleaseSection {
  const all = emptyChanges()
  for (const [category, items] of Object.entries(changes)) {
    all[category as ChangeCategory] = (items ?? []).map((i) => ({
      text: i.text,
      details: i.details ?? [],
    }))
  }
  return { version, date, changes: all }
}

const NOW = new Date('2026-10-21T04:00:00Z')

describe('escapeHtml', () => {
  it('escapes markup and template braces', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b> {{{contact.email}}}`)).toBe(
      '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt; &#123;&#123;&#123;contact.email&#125;&#125;&#125;'
    )
  })
})

describe('releaseVariables', () => {
  const releases = [
    section('1.2.0', '2026-10-20', {
      [ChangeCategory.New]: [
        { text: 'Record a part payment.' },
        { text: 'Billing:', details: ['Cancel <anytime>.'] },
      ],
      [ChangeCategory.Fixed]: [{ text: 'Totals are right.' }],
    }),
    section('1.1.1', '2026-10-12', {
      [ChangeCategory.Improved]: [{ text: 'Revenue loads faster.' }],
      [ChangeCategory.Fixed]: [{ text: 'Login remembers you.' }],
    }),
  ]
  const vars = releaseVariables({
    releases,
    previousVersion: '1.1.0',
    now: NOW,
  })

  it('fills every variable in the release contract, and nothing else', () => {
    expect(Object.keys(vars).sort()).toEqual(
      [...ANNOUNCEMENT_VARIABLES[AnnouncementKind.Release]].sort()
    )
  })

  it('names the newest version, its date, and the size of the change', () => {
    expect(vars.VERSION).toBe('1.2.0')
    expect(vars.RELEASE_DATE).toBe('20 October 2026')
    expect(vars.RELEASE_TYPE).toBe('New features')
  })

  it('merges every version in the digest, newest first', () => {
    expect(vars.FIXED_COUNT).toBe(2)
    const fixed = String(vars.FIXED_HTML)
    expect(fixed.indexOf('Totals are right.')).toBeLessThan(
      fixed.indexOf('Login remembers you.')
    )
  })

  it('counts the changes in words', () => {
    expect(vars.SUMMARY).toBe('2 new features, 1 improvement and 2 fixes')
  })

  it('lists each group with its details nested, escaped', () => {
    const html = String(vars.NEW_HTML)
    expect(html).toMatch(/^<ul[^>]*>/)
    expect(html).toContain('Record a part payment.')
    expect(html).toContain('Cancel &lt;anytime&gt;.')
    expect(html).not.toContain('<anytime>')
    expect(html.match(/<ul/g)).toHaveLength(2)
  })

  it('leaves an empty group empty, so a template can lay groups out itself', () => {
    expect(vars.SECURITY_HTML).toBe('')
    expect(vars.SECURITY_COUNT).toBe(0)
    expect(vars.IMPORTANT_HTML).toBe('')
  })

  it('puts only the groups that have changes into CHANGES_HTML, in order, with headings', () => {
    const html = String(vars.CHANGES_HTML)
    expect(html).toContain('>New<')
    expect(html).toContain('>Improved<')
    expect(html).toContain('>Fixed<')
    expect(html).not.toContain('>Security<')
    expect(html).not.toContain('>Important<')
    expect(html.indexOf('>New<')).toBeLessThan(html.indexOf('>Fixed<'))
  })

  it('carries no colour, so the template decides how it looks', () => {
    expect(String(vars.CHANGES_HTML)).not.toMatch(/color|#[0-9a-f]{3,6}\b|rgb/i)
  })

  it('links to the app and to the Updates opt-out', () => {
    expect(vars.APP_URL).toBe(`${SITE_URL}/dashboard`)
    expect(vars.UNSUBSCRIBE_URL).toBe(
      unsubscribeLinkTemplate(MailingTopic.Updates)
    )
  })

  it('calls a jump in the first number a major update', () => {
    const major = releaseVariables({
      releases: [
        section('2.0.0', '2026-11-01', {
          [ChangeCategory.Fixed]: [{ text: 'x.' }],
        }),
      ],
      previousVersion: '1.9.3',
      now: NOW,
    })
    expect(major.RELEASE_TYPE).toBe('Major update')
    expect(major.SUMMARY).toBe('1 fix')
  })

  it('dates a section without a date by today in Sri Lanka', () => {
    const undated = releaseVariables({
      releases: [
        section('1.3.0', null, { [ChangeCategory.Fixed]: [{ text: 'x.' }] }),
      ],
      previousVersion: '1.2.0',
      now: new Date('2026-10-21T20:00:00Z'), // 01:30 on the 22nd in Colombo
    })
    expect(undated.RELEASE_DATE).toBe('22 October 2026')
  })
})

describe('policyVariables', () => {
  const vars = policyVariables({
    path: '/privacy',
    date: '2026-10-06',
    notify: true,
    summary: ['We email you <less>.', 'Policy notices go to everyone.'],
  })

  it('fills every variable in the policy contract, and nothing else', () => {
    expect(Object.keys(vars).sort()).toEqual(
      [...ANNOUNCEMENT_VARIABLES[AnnouncementKind.Policy]].sort()
    )
  })

  it('names the document and links to it', () => {
    expect(vars.DOCUMENT_NAME).toBe('Privacy Policy')
    expect(vars.DOCUMENT_URL).toBe(`${SITE_URL}/privacy`)
    expect(vars.UPDATED_DATE).toBe('6 October 2026')
  })

  it('gives the summary as an escaped list and as plain text', () => {
    expect(vars.SUMMARY_HTML).toMatch(
      /^<ul[^>]*><li[^>]*>We email you &lt;less&gt;\.<\/li>/
    )
    expect(vars.SUMMARY_TEXT).toBe(
      'We email you &lt;less&gt;. Policy notices go to everyone.'
    )
  })

  it('links to the preferences page without promising to stop this notice', () => {
    expect(vars.PREFERENCES_URL).toBe(preferencesLinkTemplate())
  })
})

describe('previewBanner', () => {
  const banner = previewBanner('release-1.2.0', '2026-10-22T04:00:00.000Z')

  it('says when the gyms get it, in Sri Lanka time, and which broadcast to cancel', () => {
    expect(banner).toContain('22 October 2026 at 09:30')
    expect(banner).toContain('Sri Lanka time')
    expect(banner).toContain('release-1.2.0')
    expect(banner).toContain('https://resend.com/broadcasts')
  })

  it('sits centred at the width of an email, with a gutter on a phone', () => {
    expect(banner).toMatch(/max-width:560px/)
    expect(banner).toMatch(/margin:16px auto/)
    expect(banner).toMatch(/^<div style="padding:0 16px">/)
  })
})
