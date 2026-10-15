import '@testing-library/jest-dom'
import { cleanup, render } from '@testing-library/react'
import type { Metadata } from 'next'
import type { ComponentType } from 'react'
import {
  ARTICLE_PATHS,
  FEATURE_PATHS,
  FITNESS_EMPIRE,
  MARKETING_PAGES,
  ORGANIZATION_ID,
  LITE_MEMBER_LIMIT,
  PRICING_TIERS,
  SOCIAL_PROFILES,
  TRIAL_DAYS,
  SOFTWARE_ID,
  buildPageMetadata,
  breadcrumbTrail,
  formatLkr,
  getMarketingPage,
} from '@/features/marketing'
import {
  receiptSms,
  reminderSms,
  welcomeSms,
} from '@/features/sms/config/SmsTemplates'
import { ReminderType } from '@/features/sms/config/ReminderConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import { calculateNextDueDate } from '@/features/members/utils/calculateNextDueDate'
import { ACCESS_EVENT_RETENTION_DAYS } from '@/features/access-control/config/AccessControlConfig'
import { reminderRunTimeSriLanka } from '@/test-utils/reminderRunTime'
import MarketingLayout from '../layout'
import HubPage, {
  metadata as hubMeta,
} from '../gym-management-software-sri-lanka/page'
import MembershipPage, {
  metadata as membershipMeta,
} from '../features/membership-management/page'
import PaymentsPage, {
  metadata as paymentsMeta,
} from '../features/payment-collection/page'
import SmsPage, { metadata as smsMeta } from '../features/sms-reminders/page'
import RevenuePage, {
  metadata as revenueMeta,
} from '../features/revenue-reporting/page'
import AccessPage, {
  metadata as accessMeta,
} from '../features/access-control/page'
import PricingPage, { metadata as pricingMeta } from '../pricing/page'
import AboutPage, { metadata as aboutMeta } from '../about/page'
import ContactPage, { metadata as contactMeta } from '../contact/page'
import ResourcesPage, { metadata as resourcesMeta } from '../resources/page'
import RemindersArticle, {
  metadata as remindersMeta,
} from '../resources/membership-renewal-reminders/page'
import RevenueArticle, {
  metadata as revenueArticleMeta,
} from '../resources/billed-vs-collected-revenue/page'
import FitnessEmpireCaseStudy, {
  metadata as fitnessEmpireMeta,
} from '../resources/fitness-empire-case-study/page'
import OverdueArticle, {
  metadata as overdueArticleMeta,
} from '../resources/overdue-gym-memberships/page'
import MoveArticle, {
  metadata as moveArticleMeta,
} from '../resources/move-gym-members-from-register-book/page'
import CompareArticle, {
  metadata as compareArticleMeta,
} from '../resources/excel-whatsapp-vs-gym-software/page'
import ChooseArticle, {
  metadata as chooseArticleMeta,
} from '../resources/choosing-gym-management-software-sri-lanka/page'

/**
 * Screen tests for the public marketing pages (UI3). jsdom has no layout, so
 * these prove what a crawler reads — one H1, the registry's metadata, valid
 * JSON-LD, links that resolve, a sane heading outline — never how a page
 * looks. Appearance is checked in a browser (docs/seo/SEO_AUDIT.md §Verification).
 */
const PAGES: [string, ComponentType, Metadata][] = [
  ['/gym-management-software-sri-lanka', HubPage, hubMeta],
  [FEATURE_PATHS.membership, MembershipPage, membershipMeta],
  [FEATURE_PATHS.payments, PaymentsPage, paymentsMeta],
  [FEATURE_PATHS.sms, SmsPage, smsMeta],
  [FEATURE_PATHS.revenue, RevenuePage, revenueMeta],
  [FEATURE_PATHS.access, AccessPage, accessMeta],
  ['/pricing', PricingPage, pricingMeta],
  ['/about', AboutPage, aboutMeta],
  ['/contact', ContactPage, contactMeta],
  ['/resources', ResourcesPage, resourcesMeta],
  [ARTICLE_PATHS.reminders, RemindersArticle, remindersMeta],
  [ARTICLE_PATHS.overdue, OverdueArticle, overdueArticleMeta],
  [ARTICLE_PATHS.move, MoveArticle, moveArticleMeta],
  [ARTICLE_PATHS.compare, CompareArticle, compareArticleMeta],
  [ARTICLE_PATHS.choose, ChooseArticle, chooseArticleMeta],
  [ARTICLE_PATHS.revenue, RevenueArticle, revenueArticleMeta],
  [ARTICLE_PATHS.fitnessEmpire, FitnessEmpireCaseStudy, fitnessEmpireMeta],
]

/** Every in-site destination a public page may link to. */
const KNOWN_ROUTES = new Set([
  ...MARKETING_PAGES.map((p) => p.path),
  '/login',
  '/register',
])

function renderInShell(Page: ComponentType) {
  return render(
    <MarketingLayout>
      <Page />
    </MarketingLayout>
  )
}

function jsonLdGraph(container: HTMLElement): Record<string, unknown>[] {
  const scripts = container.querySelectorAll(
    'script[type="application/ld+json"]'
  )
  expect(scripts).toHaveLength(1)
  const doc = JSON.parse(scripts[0].textContent ?? '')
  expect(doc['@context']).toBe('https://schema.org')
  return doc['@graph']
}

afterEach(cleanup)

describe.each(PAGES)('%s', (path, Page, metadata) => {
  it('renders exactly one <h1>', () => {
    const { container } = renderInShell(Page)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  it('exports the metadata registered for its path', () => {
    const type =
      getMarketingPage(path).kind === 'article' ? 'article' : 'website'
    expect(metadata).toEqual(buildPageMetadata(path, { type }))
  })

  it('emits one JSON-LD graph describing this page and its breadcrumb trail', () => {
    const { container } = renderInShell(Page)
    const graph = jsonLdGraph(container)
    const types = graph.map((n) => n['@type'])
    expect(types).toEqual(
      expect.arrayContaining([
        'Organization',
        'WebSite',
        'WebPage',
        'BreadcrumbList',
      ])
    )
    const webPage = graph.find((n) => n['@type'] === 'WebPage')
    expect(webPage?.url).toBe(`https://www.metricgymos.com${path}`)
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList')
    expect((crumbs?.itemListElement as unknown[]).length).toBe(
      breadcrumbTrail(path).length
    )
  })

  // A reference to an entity the page does not describe (WebPage `about` →
  // SoftwareApplication on a page that shows no product or prices) is a claim
  // the visible page does not make.
  it('references only entities defined in its own graph', () => {
    const { container } = renderInShell(Page)
    const graph = jsonLdGraph(container)
    const defined = new Set(graph.map((n) => n['@id']).filter(Boolean))
    const referenced: string[] = []
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(collect)
      if (value && typeof value === 'object') {
        const entries = Object.entries(value)
        if (entries.length === 1 && entries[0][0] === '@id') {
          referenced.push(String(entries[0][1]))
        } else entries.forEach(([, v]) => collect(v))
      }
    }
    graph.forEach(collect)
    expect(referenced.filter((id) => !defined.has(id))).toEqual([])
  })

  it('links only to pages that exist', () => {
    const { container } = renderInShell(Page)
    const internal = [...container.querySelectorAll('a[href^="/"]')].map(
      (a) => a.getAttribute('href') ?? ''
    )
    const broken = internal.filter(
      (href) => !KNOWN_ROUTES.has(href.split('#')[0])
    )
    expect(broken).toEqual([])
  })

  it('has a heading outline with no skipped levels', () => {
    const { container } = renderInShell(Page)
    const levels = [
      ...container.querySelectorAll('h1, h2, h3, h4, h5, h6'),
    ].map((h) => Number(h.tagName[1]))
    expect(levels[0]).toBe(1)
    levels.forEach((level, i) => {
      if (i > 0) expect(level).toBeLessThanOrEqual(levels[i - 1] + 1)
    })
  })

  /**
   * No link may be hidden from sighted visitors. A visually-hidden link is
   * hidden text to a search engine. The skip link is the one exception: it
   * becomes visible on focus and points inside the page.
   */
  it('hides no links', () => {
    const { container } = renderInShell(Page)
    const hidden = [...container.querySelectorAll('a')].filter(
      (a) => a.closest('.sr-only') && a.getAttribute('href') !== '#main'
    )
    expect(hidden).toEqual([])
  })
})

describe('the public site as a graph', () => {
  it('links every registered page from at least one other page', () => {
    const linked = new Set<string>()
    for (const [, Page] of PAGES) {
      const { container } = renderInShell(Page)
      container
        .querySelectorAll('a[href^="/"]')
        .forEach((a) =>
          linked.add((a.getAttribute('href') ?? '').split('#')[0])
        )
      cleanup()
    }
    const orphans = MARKETING_PAGES.map((p) => p.path).filter(
      (p) => !linked.has(p)
    )
    expect(orphans).toEqual([])
  })

  it('links the commercial hub from the body of every feature page, not only the footer', () => {
    for (const [path, Page] of PAGES.filter(([p]) =>
      p.startsWith('/features/')
    )) {
      const { container } = render(<Page />)
      // Rendered without the shell, so only the page's own links count.
      const toHub = container.querySelectorAll(
        'a[href="/gym-management-software-sri-lanka"]'
      )
      expect([path, toHub.length > 0]).toEqual([path, true])
      cleanup()
    }
  })
})

describe('what each page says it is about', () => {
  const subjectOf = (Page: ComponentType) =>
    jsonLdGraph(renderInShell(Page).container).find(
      (n) => n['@type'] === 'WebPage'
    )?.about

  it('names the product only where its prices are shown, the company on /about, and nothing on guides', () => {
    expect(subjectOf(HubPage)).toEqual({ '@id': SOFTWARE_ID })
    expect(subjectOf(PricingPage)).toEqual({ '@id': SOFTWARE_ID })
    expect(subjectOf(AboutPage)).toEqual({ '@id': ORGANIZATION_ID })
    expect(subjectOf(SmsPage)).toBeUndefined()
    expect(subjectOf(RemindersArticle)).toBeUndefined()
  })
})

/**
 * The Excel-and-WhatsApp guide compares Metric with WhatsApp by name, so it is
 * the page most likely to drift into a claim the product cannot keep: Metric
 * has no WhatsApp sender (HomePage.test.tsx pins the same on the homepage).
 * The guide must say so plainly, and quote prices from the pricing config.
 */
describe('the Excel and WhatsApp comparison', () => {
  const text = () => renderInShell(CompareArticle).container.textContent ?? ''

  it('says Metric sends SMS, not WhatsApp', () => {
    expect(text()).toMatch(/sends SMS, not WhatsApp/)
  })

  it.each([
    /WhatsApp (reminders|receipts|notifications|announcements)/i,
    /(reminders|receipts|announcements|messages) (by|on|via|over|through) WhatsApp/i,
    /Metric (sends|delivers)( your| its)?( reminders| receipts| messages)? (by |on |via |through )?WhatsApp/i,
  ])('never claims WhatsApp delivery (%s)', (pattern) => {
    expect(text()).not.toMatch(pattern)
  })

  it('quotes every plan price from the pricing config', () => {
    const body = text()
    for (const tier of PRICING_TIERS) {
      expect(body).toContain(formatLkr(tier.monthlyPriceLkr))
    }
  })
})

/**
 * The buying guide (SEO-065) states product facts and data-protection facts.
 * Prices, the Lite limit and the trial come from the pricing config; the data
 * protection section says only what /privacy already publishes (owner
 * decision, 2026-10-04), and links there. Like the comparison guide it must
 * never claim WhatsApp delivery.
 */
describe('the choosing-software guide', () => {
  const text = () => renderInShell(ChooseArticle).container.textContent ?? ''

  it('quotes every price, the Lite limit and the trial from the pricing config', () => {
    const body = text()
    for (const tier of PRICING_TIERS) {
      expect(body).toContain(
        `${tier.name} LKR ${formatLkr(tier.monthlyPriceLkr)}`
      )
    }
    expect(body).toContain(`up to ${LITE_MEMBER_LIMIT} active members`)
    expect(body).toContain(`free for ${TRIAL_DAYS} days`)
  })

  it('names the Act and links the privacy policy', () => {
    const { container } = renderInShell(ChooseArticle)
    expect(container.textContent).toContain(
      'Personal Data Protection Act, No. 9 of 2022'
    )
    expect(container.querySelector('main a[href="/privacy"]')).not.toBeNull()
  })

  it('states the fingerprint consent and scan-retention facts the product enforces', () => {
    const body = text()
    expect(body).toMatch(/consent is recorded before a fingerprint is enrolled/)
    expect(body).toContain(`deleted after ${ACCESS_EVENT_RETENTION_DAYS} days`)
  })

  it('says members pay at the desk', () => {
    expect(text()).toMatch(/Members do not pay online/)
  })

  it.each([
    /WhatsApp (reminders|receipts|notifications|announcements)/i,
    /(reminders|receipts|announcements|messages) (by|on|via|over|through) WhatsApp/i,
    /Metric (sends|delivers)( your| its)?( reminders| receipts| messages)? (by |on |via |through )?WhatsApp/i,
  ])('never claims WhatsApp delivery (%s)', (pattern) => {
    expect(text()).not.toMatch(pattern)
  })

  it('is linked from the body of the product page', () => {
    const { container } = renderInShell(HubPage)
    expect(
      container.querySelector(`main a[href="${ARTICLE_PATHS.choose}"]`)
    ).not.toBeNull()
  })
})

/**
 * Every profile the Organization markup lists in sameAs is also a visible
 * link on /contact, so the markup claims nothing the page does not show.
 */
describe('social profiles', () => {
  it('/contact links every profile listed in sameAs', () => {
    const { container } = renderInShell(ContactPage)
    for (const profile of SOCIAL_PROFILES) {
      expect(
        container.querySelector(`a[href="${profile.url}"]`)
      ).toHaveTextContent(profile.name)
    }
    expect(SOCIAL_PROFILES.length).toBeGreaterThan(0)
  })
})

/**
 * The owner decided (2026-10-04, SEO-038) not to name the access-control
 * hardware partner publicly. ZKTeco, the reader maker, may be named; the
 * partner is "our hardware partner" everywhere, registry text included.
 */
describe('the hardware partner is not named', () => {
  it.each(PAGES)('%s', (_path, Page) => {
    const text = renderInShell(Page).container.textContent ?? ''
    expect(text).not.toMatch(/\bVFT\b/i)
  })

  it('in any registry title or description', () => {
    for (const page of MARKETING_PAGES) {
      expect(`${page.title} ${page.description}`).not.toMatch(/\bVFT\b/i)
    }
  })
})

/**
 * Daily and weekly plans get no automated reminders (REMINDER_RULES; weekly
 * since the owner's decision of 2026-10-04). The SMS page's table renders
 * from the rules, and its sentence must name the same plans; the reminders
 * guide says Metric "applies exactly these rules", so it must agree too.
 */
describe('plans that get no reminders', () => {
  it('the SMS reminders page names daily and weekly', () => {
    const text = renderInShell(SmsPage).container.textContent ?? ''
    expect(text).toMatch(/Daily and weekly members get no reminders/)
  })

  it('the reminders guide names daily and weekly', () => {
    const text = renderInShell(RemindersArticle).container.textContent ?? ''
    expect(text).toMatch(/Daily and weekly members: no reminders/)
    expect(text).toMatch(/Daily and weekly plans: no reminders\./)
    expect(text).not.toMatch(/Daily passes: no reminders/)
  })
})

/**
 * The reminder run's time is stated on three public pages (and the sign-in
 * panel, pinned in AuthShell.test.tsx). It is derived here from the
 * send-reminders cron in vercel.json, so moving the cron fails these until
 * the copy follows.
 */
describe('the reminder run time', () => {
  const time = reminderRunTimeSriLanka()

  it.each([
    ['/features/sms-reminders', SmsPage, `starts at ${time} every morning`],
    [
      'the reminders guide',
      RemindersArticle,
      `starts at ${time} in the morning`,
    ],
    ['the buying guide', ChooseArticle, `starts at ${time} every morning`],
  ] as const)('%s states it', (_name, Page, phrase) => {
    const text = renderInShell(Page).container.textContent ?? ''
    expect(text.replace(/\s+/g, ' ')).toContain(phrase)
  })
})

/**
 * The overdue guide's dates are computed by the product's own payment rule
 * (calculateNextDueDateFromPayment), so the guide cannot describe a rule the
 * product does not run. Due 15 Nov: a late payer on 20 Nov is next due
 * 20 Dec; an early payer on 12 Nov keeps 15 Dec (owner decision, 2026-10-04).
 */
describe('the overdue memberships guide', () => {
  const text = () => renderInShell(OverdueArticle).container.textContent ?? ''

  it('dates a late payment from the payment day', () => {
    expect(text()).toMatch(/pays on 20 Nov is next due on 20 Dec/)
  })

  it('says an early payer keeps their due date', () => {
    expect(text()).toMatch(/pays early, on 12 Nov, is still next due on 15 Dec/)
  })
})

/**
 * The SMS samples on the public site are rendered from the same templates the
 * product sends (rule 2.23), so a wording change cannot leave a page quoting a
 * message no member receives. These expectations are computed from the
 * templates, not copied: a page that hard-codes a literal fails here the
 * moment the wording moves.
 */
describe('SMS samples on the public site', () => {
  const party = { gymName: 'Your Gym', memberName: 'Nimal' }
  const reminder = (type: ReminderType) =>
    reminderSms(type, {
      ...party,
      planType: PlanType.Monthly,
      amount: 4000,
      dueDate: new Date(2026, 10, 15),
    })
  const receipt = receiptSms({
    ...party,
    amountPaid: 4000,
    nextDueDate: new Date(2026, 11, 15),
  })

  it.each([
    ['/features/sms-reminders', SmsPage],
    ['/resources/membership-renewal-reminders', RemindersArticle],
  ] as const)(
    '%s quotes the reminders and the receipt verbatim',
    (_path, Page) => {
      const text = renderInShell(Page).container.textContent ?? ''
      expect(text).toContain(reminder(ReminderType.SevenDay))
      expect(text).toContain(reminder(ReminderType.DueToday))
      expect(text).toContain(receipt)
    }
  )

  it('the register-book guide quotes the welcome text verbatim', () => {
    const text = renderInShell(MoveArticle).container.textContent ?? ''
    expect(text).toContain(
      welcomeSms({
        ...party,
        planType: PlanType.Monthly,
        amountPaid: 4000,
        nextDueDate: calculateNextDueDate(
          new Date(2026, 8, 20),
          PlanType.Monthly
        ),
      })
    )
  })

  it.each(PAGES)(
    '%s never says a text leaves the gym unnamed',
    (_path, Page) => {
      const text = renderInShell(Page).container.textContent ?? ''
      expect(text).not.toMatch(/does not name your gym/i)
      expect(text).not.toMatch(/welcome to our gym/i)
    }
  )
})

/**
 * The Fitness Empire case study (SEO-042) names a real gym and its owner and
 * publishes their figures, so every figure is the one the owner approved on
 * 2026-10-15 (as of 2026-10-05, HANDOFF §6). The literals below ARE that
 * approval: a config change that alters a figure fails here instead of
 * reaching the page unapproved. Fitness Empire runs no door readers and no QR
 * sign-ups, and the page says nothing of either; nor does it carry review or
 * rating markup (rule 2.23).
 */
describe('the Fitness Empire case study', () => {
  const main = () =>
    renderInShell(FitnessEmpireCaseStudy).container.querySelector('main')
      ?.textContent ?? ''

  it('holds exactly the figures the owner approved', () => {
    expect(FITNESS_EMPIRE).toMatchObject({
      name: 'Fitness Empire',
      owner: 'Zulfi Ahamath',
      locality: 'Wattala',
      asOf: '2026-10-05',
      onMetricSince: '2026-02-28',
      members: { registered: 231, active: 134, notMonthly: 2 },
      paymentsRecorded: { marchToJulyMonthly: 90, august: 148, september: 166 },
      texts: {
        welcome: 127,
        receipt: 453,
        threeDayReminder: 301,
        dueTodayReminder: 221,
        overdueNotice: 122,
        reactivation: 42,
      },
      renewals: {
        count: 531,
        onOrBeforeDuePercent: 48.2,
        withinAWeekPercent: 81.5,
        duplicatesRemoved: 30,
      },
    })
  })

  it('states every figure, the date they are as of, and how they were counted', () => {
    const text = main()
    for (const figure of [
      '231',
      '134',
      '148',
      '166',
      '127',
      '453',
      '301',
      '221',
      '122',
      '42',
      '48.2%',
      '81.5%',
      '531',
      '30',
    ]) {
      expect([figure, text.includes(figure)]).toEqual([figure, true])
    }
    expect(text).toContain('5 October 2026')
    expect(text).toContain('28 February 2026')
    expect(text).toMatch(/How these figures were counted/)
  })

  it('quotes the owner word for word, attributed', () => {
    const text = main()
    expect(text).toContain(FITNESS_EMPIRE.quote)
    expect(FITNESS_EMPIRE.quote).toBe(
      'We cut our admin time by 80% in the first month. The automated reminders alone paid for the subscription.'
    )
    expect(text).toContain('Zulfi Ahamath')
  })

  it.each([
    /door/i,
    /fingerprint/i,
    /\bQR\b/,
    /reader/i,
    /rupee|LKR|Rs\.?\s?\d/i,
  ])(
    'claims nothing Fitness Empire does not use or did not approve (%s)',
    (pattern) => {
      expect(main()).not.toMatch(pattern)
    }
  )

  it('carries no review or rating markup', () => {
    const graphText = JSON.stringify(
      jsonLdGraph(renderInShell(FitnessEmpireCaseStudy).container)
    )
    expect(graphText).not.toMatch(/Review|aggregateRating|ratingValue/)
  })
})
