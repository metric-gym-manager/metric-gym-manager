/**
 * Renders every email we send to people — the four outreach emails, the
 * release and policy announcements, and the owner's two outreach reports —
 * and measures each in Chromium at phone and desktop widths. Exits 1 when a
 * phone layout breaks. jsdom computes no geometry, so this is the only check
 * that sees an email the way a reader does (CLAUDE.md, Verification
 * Directive 1).
 *
 *   npm run email:layout -- [--shots <dir>] [--compare <dir>]
 *
 *   --shots <dir>    also write a full-page PNG per email and width
 *   --compare <dir>  the desktop renders (600 and 1100 px) must be
 *                    byte-identical to those in <dir>: a mobile change may
 *                    not move a pixel on the desktop
 *
 * Each email is measured twice: with its `<style>` block (Apple Mail, the
 * Gmail app, Outlook mobile), and with it stripped, as a mail app that drops
 * embedded CSS shows it. What fails:
 *
 * - sideways scrolling, at any width, in either mode;
 * - a `.m-keep` unit split across lines (a price, an amount, a phone
 *   number): inline `white-space:nowrap`, so it holds in both modes;
 * - a button on two lines, the price apart from "/ month", or a headline on
 *   more than three lines, with the mobile CSS;
 * - text squeezed into a column narrower than 220 px at 320 px wide, with
 *   the mobile CSS (the policy notice's bullets were 200 px).
 *
 * Design: docs/architecture/marketing-email.md, "Email layout".
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import { ANNOUNCEMENT_TEMPLATES } from '@/features/mailing/config/announcementTemplates'
import {
  AnnouncementKind,
  ChangeCategory,
} from '@/features/mailing/config/AnnouncementConfig'
import { outreachEmail } from '@/features/mailing/config/outreachCampaign'
import {
  policyVariables,
  releaseVariables,
} from '@/features/mailing/utils/announcementContent'
import {
  pausedAlertEmail,
  weeklySummaryEmail,
} from '@/features/mailing/utils/outreachReports'
import { renderTemplate } from '@/features/mailing/utils/renderTemplate'
import { LEGAL_CHANGES } from '@/features/marketing/config/legalChanges'

const PHONE_WIDTHS = [320, 360, 390]
const DESKTOP_WIDTHS = [600, 1100]
const MIN_TEXT_COLUMN_AT_320 = 220

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name)
  return at >= 0 ? process.argv[at + 1] : undefined
}

/** Resend fills `{{{contact.*}}}` per recipient; a long gym name stresses the layout. */
function asSent(html: string): string {
  return html.replace(
    /\{\{\{contact\.gym_name(\|[^}]*)?\}\}\}/g,
    'Iron Paradise Fitness Centre'
  )
}

function emails(): Record<string, string> {
  const release = renderTemplate(
    ANNOUNCEMENT_TEMPLATES[AnnouncementKind.Release].html,
    releaseVariables({
      releases: [
        {
          version: '1.3.0',
          date: '2026-10-20',
          changes: {
            [ChangeCategory.Important]: [],
            [ChangeCategory.New]: [
              {
                text: 'Members can now pay part of a fee and settle the rest later.',
                details: [],
              },
              {
                text: 'Door access shows who came in today, with a photo for each member.',
                details: [
                  'Works with every reader you have connected.',
                  'Updates every few seconds.',
                ],
              },
            ],
            [ChangeCategory.Improved]: [
              {
                text: 'The members list loads twice as fast on a phone.',
                details: [],
              },
            ],
            [ChangeCategory.Fixed]: [
              {
                text: 'Reminder SMS no longer go to members who have already paid.',
                details: [],
              },
            ],
            [ChangeCategory.Security]: [],
          },
        },
      ],
      previousVersion: '1.2.2',
      now: new Date('2026-10-20T04:00:00Z'),
    }),
    []
  )
  const policyChange = [...LEGAL_CHANGES].reverse().find((c) => c.notify)
  if (!policyChange) throw new Error('No policy change with notify: true')
  const policy = renderTemplate(
    ANNOUNCEMENT_TEMPLATES[AnnouncementKind.Policy].html,
    policyVariables(policyChange),
    []
  )
  for (const [name, rendered] of [
    ['release', release],
    ['policy', policy],
  ] as const) {
    if (rendered.unresolved.length > 0) {
      throw new Error(`${name}: unresolved ${rendered.unresolved.join(', ')}`)
    }
  }

  const unsubscribeUrl =
    'https://www.metricgymos.com/unsubscribe?email=owner%40gym.lk&token=abc&topic=marketing'
  const progress = [
    ...Array(70).fill({ status: 'active', step: 1 }),
    ...Array(4).fill({ status: 'active', step: 0 }),
    ...Array(3).fill({ status: 'unsubscribed', step: 1 }),
    ...Array(4).fill({ status: 'bounced', step: 1 }),
    { status: 'complained', step: 1 },
  ]
  return {
    'outreach-1': outreachEmail(1, { unsubscribeUrl }).html,
    'outreach-2': outreachEmail(2, { unsubscribeUrl }).html,
    'outreach-3': outreachEmail(3, { unsubscribeUrl }).html,
    'outreach-4': outreachEmail(4, { unsubscribeUrl }).html,
    release: asSent(release.html),
    policy: asSent(policy.html),
    'owner-summary': weeklySummaryEmail({
      campaign: 'intro-2026-10',
      now: new Date('2026-10-19T04:30:00Z'),
      week: {
        sent: 78,
        bounced: 4,
        complained: 1,
        unsubscribed: 3,
        suppressed: 0,
      },
      progress,
      paused: null,
    }).html,
    'owner-paused': pausedAlertEmail({
      campaign: 'intro-2026-10',
      reason: '2 spam complaints',
      pausedAt: new Date('2026-10-20T04:41:00Z'),
      resumedAt: null,
      counts: {
        sent: 156,
        bounced: 4,
        complained: 2,
        unsubscribed: 5,
        suppressed: 0,
      },
    }).html,
  }
}

const stripStyle = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, '')

interface Measures {
  overflow: number
  keepSplit: string[]
  buttons: { label: string; lines: number }[]
  priceLines: number[]
  headlineLines: number | null
  narrowest: { width: number; text: string } | null
}

async function measure(page: Page): Promise<Measures> {
  // tsx keeps function names with a `__name` helper the page does not have.
  await page.evaluate('window.__name = (f) => f')
  return page.evaluate(() => {
    const lines = (el: HTMLElement) => {
      const cs = getComputedStyle(el)
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2
      const box =
        el.getBoundingClientRect().height -
        parseFloat(cs.paddingTop) -
        parseFloat(cs.paddingBottom)
      return Math.round(box / lh)
    }
    const keepSplit = Array.from(
      document.querySelectorAll<HTMLElement>('.m-keep')
    )
      .filter((el) => {
        const tops = new Set(
          Array.from(el.getClientRects()).map((r) => Math.round(r.top))
        )
        return tops.size > 1
      })
      .map((el) => el.innerText)
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('a.m-btn')
    ).map((el) => ({ label: el.innerText.trim(), lines: lines(el) }))
    const priceLines = Array.from(
      document.querySelectorAll<HTMLElement>('.m-price')
    ).map(lines)
    const h1 = document.querySelector<HTMLElement>('h1')
    let narrowest: { width: number; text: string } | null = null
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>('p, li, td, div')
    )) {
      // A column is a block; an inline span is only as wide as its words.
      if (getComputedStyle(el).display === 'inline') continue
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim()
      if (own.length < 30) continue
      const width = el.getBoundingClientRect().width
      if (width > 0 && (!narrowest || width < narrowest.width)) {
        narrowest = { width: Math.round(width), text: own.slice(0, 40) }
      }
    }
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      keepSplit,
      buttons,
      priceLines,
      headlineLines: h1 ? lines(h1) : null,
      narrowest,
    }
  })
}

async function main() {
  const shots = flag('--shots')
  const compare = flag('--compare')
  if (shots) mkdirSync(shots, { recursive: true })
  const failures: string[] = []
  const browser = await chromium.launch()

  for (const [name, html] of Object.entries(emails())) {
    for (const styled of [true, false]) {
      const page = await browser.newPage({ deviceScaleFactor: 2 })
      // The logo from the repo, not the live site: a render must not depend
      // on the network (a refused fetch draws a broken image and fails the
      // desktop comparison for no reason of the layout's).
      await page.route('**/icon-192.png', (route) =>
        route.fulfill({ path: 'public/icon-192.png', contentType: 'image/png' })
      )
      const content = styled ? html : stripStyle(html)
      for (const width of [...PHONE_WIDTHS, ...DESKTOP_WIDTHS]) {
        await page.setViewportSize({ width, height: 900 })
        await page.setContent(content, { waitUntil: 'load' })
        const m = await measure(page)
        const at = `${name} @${width}${styled ? '' : ' (no <style>)'}`
        if (m.overflow > 0)
          failures.push(`${at}: scrolls sideways by ${m.overflow}px`)
        for (const unit of m.keepSplit)
          failures.push(`${at}: "${unit}" split across lines`)
        const phone = PHONE_WIDTHS.includes(width)
        if (styled && phone) {
          if (m.buttons.length === 0 && !name.startsWith('owner-')) {
            failures.push(`${at}: no .m-btn button found`)
          }
          for (const b of m.buttons) {
            if (b.lines > 1)
              failures.push(`${at}: button "${b.label}" on ${b.lines} lines`)
          }
          if (m.priceLines.some((n) => n > 1)) {
            failures.push(`${at}: the price and "/ month" on separate lines`)
          }
          if (m.headlineLines !== null && m.headlineLines > 3) {
            failures.push(`${at}: headline on ${m.headlineLines} lines`)
          }
          if (
            width === 320 &&
            m.narrowest &&
            m.narrowest.width < MIN_TEXT_COLUMN_AT_320
          ) {
            failures.push(
              `${at}: text squeezed to ${m.narrowest.width}px ("${m.narrowest.text}…")`
            )
          }
        }
        if (shots && styled) {
          const file = join(shots, `${name}-${width}.png`)
          const png = await page.screenshot({ fullPage: true })
          writeFileSync(file, png)
          if (compare && DESKTOP_WIDTHS.includes(width)) {
            const before = readFileSync(join(compare, `${name}-${width}.png`))
            if (!before.equals(png))
              failures.push(`${at}: desktop render changed`)
          }
        }
        console.log(
          `${at.padEnd(34)} overflow ${String(m.overflow).padStart(3)}  ` +
            `buttons ${m.buttons.map((b) => b.lines).join('/') || '-'}  ` +
            `h1 ${m.headlineLines ?? '-'}  narrowest ${m.narrowest?.width ?? '-'}`
        )
      }
      await page.close()
    }
  }
  await browser.close()

  if (failures.length > 0) {
    console.error(`\n${failures.length} problem(s):`)
    for (const f of failures) console.error(`  ${f}`)
    process.exit(1)
  }
  console.log('\nEvery email holds at every width.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
