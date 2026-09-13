/**
 * The mobile probe (mobile rebuild plan §17; touch rule §15.1).
 *
 * Measures a rendered route in a real browser and reports everything the
 * plan's Definition of Done forbids. jsdom computes no geometry, so none of
 * these rules can live in a Jest test — this is the instrument the audit was
 * measured with, made repeatable. Every number here was a real defect on the
 * pre-rebuild phone: a 754 px bottom bar in a 390 px viewport, tables 767 px
 * wide, 26 px row buttons, "20000" rendered as "0000".
 *
 * The probe **reports**; the spec decides what fails. Phase 0 asserts the
 * desktop tier clean and only records the phone tier, because today's phone
 * routes are known to fail (audit §D) and the point of the baseline is to
 * watch the numbers fall phase by phase. A route joins the strict set when
 * its phase rebuilds it.
 *
 * Rules (each maps to one field of {@link ProbeReport}):
 *
 * 1. **Page overflow** — `documentElement.scrollWidth` must equal the viewport
 *    width. The page never scrolls sideways.
 * 2. **Beyond the viewport** — no element inside the scope (`<main>` by
 *    default) may extend past the viewport's edges unless it sits inside a
 *    sanctioned scroller. On the phone tier that is only a `data-scroll="x"`
 *    container (`Tabs` lists and the bulk-import fallback, plan §14, §25.1);
 *    on the desktop tier any `overflow-x: auto|scroll` container counts,
 *    because plan §4 has tablet tables scrolling in their containers and
 *    §5.20 sanctions it for genuinely tabular data.
 * 3. **Internal overflow** — no container inside the scope may hold content
 *    wider than itself unless it is a sanctioned scroller (same tier rule as
 *    2). A clip container (`overflow: hidden|clip`) is never sanctioned. On
 *    phones this is where the audit's overflowing tables hid: the page width
 *    stayed at 390 while `overflow-x-auto` wrappers swallowed 767 px tables
 *    with no visual cue.
 * 4. **Touch** (phone tier only) — the §15.1 rule, verbatim: every
 *    interactive element ≥ 40 px tall and wide; elements **without**
 *    `data-dense` ≥ 44 px tall; inline text links exempt via an allow-list of
 *    selectors but still ≥ 24 px tall (WCAG 2.5.8). Checkbox/radio controls
 *    are measured on the wrapping `<label>` when one exists (control 24, label
 *    44). No phase may introduce a third threshold.
 * 5. **Named controls** — every icon-only button or link has an accessible
 *    name (plan §28, last row).
 * 6. **Bottom navigation** (phone tier only) — `nav[aria-label="Workspace"]`
 *    must not scroll: `scrollWidth === clientWidth`. Today's bar is the
 *    nine-item scroller the audit measured; the rebuilt `BottomNav` keeps the
 *    same landmark, so the rule reads both.
 * 7. **Fixed / sticky inventory** — every `position: fixed|sticky` element,
 *    with its box. Informational: the spec compares it with the plan's list
 *    (§25.1 "Sticky / fixed") rather than asserting a count.
 * 8. **Axis ticks** — every Recharts axis tick label must lie inside its own
 *    `<svg>`; a tick that starts left of the surface is the clipped "0000".
 * 9. **Clipped text** — a single-line (`white-space: nowrap`) text element
 *    whose `scrollWidth` exceeds its `clientWidth` without
 *    `text-overflow: ellipsis` is silently cut mid-glyph.
 *
 * Everything is measured from the DOM with `getBoundingClientRect` and the
 * scroll metrics, at `scrollX === 0`. Elements hidden from layout (no client
 * rects, `visibility: hidden`, inside `aria-hidden`) are skipped everywhere.
 */

import type { Page } from '@playwright/test'

/** §15.1 thresholds. Mirror the `touch` (44) and `touch-sm` (40) tokens. */
export const TOUCH_PRIMARY_PX = 44
export const TOUCH_DENSE_PX = 40
export const INLINE_LINK_MIN_PX = 24

/**
 * Selectors whose `<a href>` matches count as text-only inline links (§15.1,
 * "Text-only inline link"): exempt from the box rule, held to the 24 px line
 * box. Prose containers, plus an explicit opt-in for a link a later phase
 * places inside a caption (the members row's `tel:` link, plan §9.4).
 */
export const INLINE_LINK_ALLOW: readonly string[] = [
  'p a[href]',
  'small a[href]',
  'label a[href]',
  'figcaption a[href]',
  'a[href][data-inline-link]',
]

export interface ProbeOptions {
  /**
   * Root for rules 2, 3 and 9. `main` by default; pass `[role="dialog"]` to
   * probe an open overlay, which is portalled outside `<main>`.
   */
  scope?: string
  /** Override the tier the viewport width would otherwise decide. */
  tier?: 'phone' | 'desktop'
}

export interface ProbeBox {
  /** A short, human-readable handle: tag, id, first classes, text. */
  el: string
  x: number
  y: number
  width: number
  height: number
}

export interface TouchViolation extends ProbeBox {
  dense: boolean
  inline: boolean
  /** Which threshold was missed. */
  rule: 'dense-min' | 'primary-height' | 'inline-line-box'
  name: string
}

export interface OverflowBox extends ProbeBox {
  scrollWidth: number
  clientWidth: number
  overflowX: string
}

export interface FixedBox extends ProbeBox {
  position: 'fixed' | 'sticky'
}

export interface TickClip {
  text: string
  /** Pixels the label starts left of (negative) or ends right of its svg. */
  overshoot: number
}

export interface ProbeReport {
  route: string
  viewport: { width: number; height: number }
  tier: 'phone' | 'desktop'
  scope: string
  page: { scrollWidth: number; innerWidth: number }
  /** Outermost elements past the viewport edge (rule 2). */
  beyondViewport: ProbeBox[]
  /** Every element past the edge, descendants included. */
  beyondViewportTotal: number
  internalOverflow: OverflowBox[]
  touch: TouchViolation[]
  unnamed: ProbeBox[]
  bottomNav: { scrollWidth: number; clientWidth: number } | null
  fixedSticky: FixedBox[]
  axisTicks: { total: number; clipped: TickClip[] }
  clippedText: OverflowBox[]
  /** How many interactive elements the touch rule looked at. */
  interactiveCount: number
}

/**
 * Run every rule against the page as it is now. Callers wait for the route's
 * data to land first — a skeleton passes every rule.
 */
export async function probePage(
  page: Page,
  route: string,
  { scope = 'main', tier }: ProbeOptions = {}
): Promise<ProbeReport> {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('probePage: the page has no viewport size')
  const resolvedTier = tier ?? (viewport.width < 768 ? 'phone' : 'desktop')

  const args = {
    route,
    scope,
    tier: resolvedTier,
    thresholds: {
      primary: TOUCH_PRIMARY_PX,
      dense: TOUCH_DENSE_PX,
      inline: INLINE_LINK_MIN_PX,
    },
    inlineAllow: [...INLINE_LINK_ALLOW],
  }

  return page.evaluate((a) => {
    // ── Everything below runs in the browser. Keep it dependency-free. ──
    type Box = {
      el: string
      x: number
      y: number
      width: number
      height: number
    }

    const round = (n: number) => Math.round(n * 10) / 10

    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const cls = (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((c) => `.${c}`)
        .join('')
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
      const label = el.getAttribute('aria-label')
      const hint = label ? ` [aria-label="${label}"]` : ''
      return `${tag}${id}${cls}${hint}${text ? ` "${text.slice(0, 32)}"` : ''}`
    }

    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect()
      return {
        el: describe(el),
        x: round(r.left + window.scrollX),
        y: round(r.top + window.scrollY),
        width: round(r.width),
        height: round(r.height),
      }
    }

    // Visually hidden on purpose (Tailwind `sr-only` and the like): a 1×1
    // clipped box that exists for screen readers. Not a layout defect.
    const isVisuallyHidden = (el: HTMLElement, cs: CSSStyleDeclaration) =>
      cs.clip === 'rect(0px, 0px, 0px, 0px)' ||
      cs.clipPath === 'inset(50%)' ||
      (el.offsetWidth <= 1 &&
        el.offsetHeight <= 1 &&
        cs.overflow === 'hidden' &&
        cs.position === 'absolute')

    const isRendered = (el: Element): boolean => {
      if (!(el instanceof HTMLElement)) return false
      if (el.closest('[aria-hidden="true"]')) return false
      if (el.getClientRects().length === 0) return false
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return false
      if (isVisuallyHidden(el, cs)) return false
      return true
    }

    // What may scroll sideways depends on the tier. On phones only a
    // container marked `data-scroll="x"` may (plan §24 "Mobile quality"); on
    // the desktop tier any `overflow-x: auto|scroll` container may, because
    // §4 has tablet tables scrolling in their containers and §5.20 sanctions
    // it for genuinely tabular data. A clip container (`hidden`/`clip`) is
    // never sanctioned: its content is cut, not reachable.
    const isScroller = (el: Element) =>
      /^(auto|scroll)$/.test(getComputedStyle(el).overflowX)
    const inSanctionedScroller = (el: Element): boolean => {
      if (el.closest('[data-scroll="x"]')) return true
      if (a.tier !== 'desktop') return false
      let node: Element | null = el.parentElement
      while (node && node !== document.body) {
        if (isScroller(node)) return true
        node = node.parentElement
      }
      return false
    }

    const vw = window.innerWidth
    const root = document.querySelector(a.scope)
    const scoped: Element[] = root ? Array.from(root.querySelectorAll('*')) : []

    // 1. Page overflow ------------------------------------------------------
    const pageMetrics = {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: vw,
    }

    // 2. Beyond the viewport ------------------------------------------------
    // Outermost offenders only: a 767 px table lists once, not once per cell.
    // `beyondViewportTotal` keeps the raw count for the record.
    const beyondViewport: Box[] = []
    const flagged: Element[] = []
    let beyondViewportTotal = 0
    for (const el of scoped) {
      if (!isRendered(el) || inSanctionedScroller(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      if (r.right > vw + 1 || r.left < -1) {
        beyondViewportTotal += 1
        if (flagged.some((anc) => anc.contains(el))) continue
        flagged.push(el)
        beyondViewport.push(box(el))
      }
    }

    // 3. Internal overflow (scroll and clip containers) ---------------------
    const hasOnlyText = (el: Element) =>
      el.childNodes.length > 0 &&
      Array.from(el.childNodes).every((n) => n.nodeType === Node.TEXT_NODE)

    const internalOverflow: Array<
      Box & { scrollWidth: number; clientWidth: number; overflowX: string }
    > = []
    for (const el of scoped) {
      if (!isRendered(el) || inSanctionedScroller(el)) continue
      if (el.getAttribute('data-scroll') === 'x') continue
      const cs = getComputedStyle(el)
      if (!/^(auto|scroll|hidden|clip)$/.test(cs.overflowX)) continue
      if (a.tier === 'desktop' && isScroller(el)) continue // sanctioned (§4)
      if (hasOnlyText(el)) continue // rule 9's territory
      if (el.scrollWidth > el.clientWidth + 1) {
        internalOverflow.push({
          ...box(el),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: cs.overflowX,
        })
      }
    }

    // 4. Touch (phone tier only) --------------------------------------------
    const INTERACTIVE =
      'a[href], button, input:not([type="hidden"]), select, textarea, ' +
      '[role="button"], [role="link"], [role="tab"], [role="menuitem"], ' +
      '[role="checkbox"], [role="radio"], [role="switch"], [role="option"], ' +
      '[tabindex]:not([tabindex="-1"])'
    // Composite containers (a tablist, a radiogroup) are focus groups, not
    // targets; their items are measured individually.
    const CONTAINER_ROLES =
      /^(tablist|radiogroup|group|menu|menubar|listbox|toolbar|region)$/
    const interactive = Array.from(document.body.querySelectorAll(INTERACTIVE))
      .filter(isRendered)
      .filter((el) => !CONTAINER_ROLES.test(el.getAttribute('role') ?? ''))
      // A control inside a labelled wrapper is measured on the wrapper below;
      // don't count the inner control twice.
      .filter((el) => {
        if (!(el instanceof HTMLInputElement)) return true
        if (el.type !== 'checkbox' && el.type !== 'radio') return true
        return el.closest('label') === null
      })

    const accessibleName = (el: Element): string => {
      const aria = el.getAttribute('aria-label')
      if (aria) return aria
      const by = el.getAttribute('aria-labelledby')
      if (by) {
        const names = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .filter(Boolean)
        if (names.length) return names.join(' ')
      }
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (text) return text
      const title = el.getAttribute('title')
      if (title) return title
      const img = el.querySelector('img[alt]')
      if (img?.getAttribute('alt')) return img.getAttribute('alt') as string
      const svgLabel = el.querySelector('svg[aria-label]')
      if (svgLabel) return svgLabel.getAttribute('aria-label') as string
      const svgTitle = el.querySelector('svg > title')
      if (svgTitle?.textContent) return svgTitle.textContent.trim()
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        const lab = el.id
          ? document.querySelector(`label[for="${el.id}"]`)
          : null
        if (lab?.textContent?.trim()) return lab.textContent.trim()
      }
      return ''
    }

    const touch: Array<
      Box & {
        dense: boolean
        inline: boolean
        rule: 'dense-min' | 'primary-height' | 'inline-line-box'
        name: string
      }
    > = []
    const labelled = new Set<Element>()

    if (a.tier === 'phone') {
      for (const el of interactive) {
        labelled.add(el)
        const b = box(el)
        const dense = el.closest('[data-dense]') !== null
        const inline =
          el instanceof HTMLAnchorElement &&
          a.inlineAllow.some((sel) => el.matches(sel))
        const name = accessibleName(el)

        if (inline) {
          if (b.height < a.thresholds.inline)
            touch.push({ ...b, dense, inline, rule: 'inline-line-box', name })
          continue
        }
        if (b.width < a.thresholds.dense || b.height < a.thresholds.dense) {
          touch.push({ ...b, dense, inline, rule: 'dense-min', name })
          continue
        }
        if (!dense && b.height < a.thresholds.primary) {
          touch.push({ ...b, dense, inline, rule: 'primary-height', name })
        }
      }
      // A label wrapping a checkbox/radio is the hit area (§15.1: control
      // 24 px, label 44 px); the inner control was skipped above.
      for (const lab of Array.from(
        document.body.querySelectorAll('label')
      ).filter(isRendered)) {
        if (!lab.querySelector('input[type="checkbox"], input[type="radio"]'))
          continue
        if (labelled.has(lab)) continue
        labelled.add(lab)
        const b = box(lab)
        const dense = lab.closest('[data-dense]') !== null
        const name = accessibleName(lab)
        if (b.width < a.thresholds.dense || b.height < a.thresholds.dense) {
          touch.push({ ...b, dense, inline: false, rule: 'dense-min', name })
        } else if (!dense && b.height < a.thresholds.primary) {
          touch.push({
            ...b,
            dense,
            inline: false,
            rule: 'primary-height',
            name,
          })
        }
      }
    }

    // 5. Named controls -----------------------------------------------------
    const unnamed: Box[] = []
    for (const el of interactive) {
      if (!(
        el instanceof HTMLButtonElement ||
        el instanceof HTMLAnchorElement ||
        el.getAttribute('role') === 'button'
      ))
        continue
      if (!accessibleName(el)) unnamed.push(box(el))
    }

    // 6. Bottom navigation --------------------------------------------------
    // The desktop sidebar shares the "Workspace" landmark; the bottom bar is
    // the one that is fixed.
    const nav = Array.from(
      document.querySelectorAll('nav[aria-label="Workspace"]')
    ).find((n) => isRendered(n) && getComputedStyle(n).position === 'fixed')
    const bottomNav = nav
      ? { scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth }
      : null

    // 7. Fixed / sticky inventory --------------------------------------------
    const fixedSticky: Array<Box & { position: 'fixed' | 'sticky' }> = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (!isRendered(el)) continue
      const pos = getComputedStyle(el).position
      if (pos === 'fixed' || pos === 'sticky')
        fixedSticky.push({ ...box(el), position: pos })
    }

    // 8. Axis ticks -----------------------------------------------------------
    const ticks = Array.from(
      document.querySelectorAll(
        'svg.recharts-surface text.recharts-cartesian-axis-tick-value'
      )
    )
    // Measure against whatever actually clips: the svg when its overflow is
    // hidden (the SVG default), else the nearest HTML ancestor that clips.
    const clipBoxOf = (svg: SVGSVGElement): DOMRect => {
      if (getComputedStyle(svg).overflow !== 'visible')
        return svg.getBoundingClientRect()
      let node: HTMLElement | null = svg.parentElement
      while (node) {
        const cs = getComputedStyle(node)
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')
          return node.getBoundingClientRect()
        node = node.parentElement
      }
      return new DOMRect(0, 0, window.innerWidth, window.innerHeight)
    }
    const clipped: Array<{ text: string; overshoot: number }> = []
    for (const t of ticks) {
      const svg = t.closest('svg')
      if (!svg) continue
      const tr = t.getBoundingClientRect()
      const sr = clipBoxOf(svg)
      if (tr.width === 0) continue
      const left = tr.left - sr.left
      const right = sr.right - tr.right
      const overshoot = left < -0.5 ? left : right < -0.5 ? -right : 0
      if (overshoot !== 0)
        clipped.push({
          text: (t.textContent ?? '').trim(),
          overshoot: round(overshoot),
        })
    }

    // 9. Clipped single-line text --------------------------------------------
    const clippedText: Array<
      Box & { scrollWidth: number; clientWidth: number; overflowX: string }
    > = []
    for (const el of scoped) {
      if (!isRendered(el) || inSanctionedScroller(el)) continue
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim()
      )
      if (!hasText) continue
      const cs = getComputedStyle(el)
      if (!/^(nowrap|pre)$/.test(cs.whiteSpace)) continue
      if (cs.textOverflow === 'ellipsis') continue
      if (el.scrollWidth > el.clientWidth + 1) {
        clippedText.push({
          ...box(el),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: cs.overflowX,
        })
      }
    }

    return {
      route: a.route,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      tier: a.tier,
      scope: a.scope,
      page: pageMetrics,
      beyondViewport,
      beyondViewportTotal,
      internalOverflow,
      touch,
      unnamed,
      bottomNav,
      fixedSticky,
      axisTicks: { total: ticks.length, clipped },
      clippedText,
      interactiveCount: interactive.length,
    }
  }, args)
}

/**
 * Flatten a report into the rules it breaks — one line per violation, so a
 * failing assertion prints the whole picture instead of the first hit.
 *
 * Fixed/sticky is inventory, not a rule, and is never listed here.
 */
export function probeViolations(report: ProbeReport): string[] {
  const out: string[] = []
  const at = `${report.route}@${report.viewport.width}`

  if (report.page.scrollWidth > report.page.innerWidth) {
    out.push(
      `${at} page scrolls sideways: scrollWidth ${report.page.scrollWidth} > viewport ${report.page.innerWidth}`
    )
  }
  for (const b of report.beyondViewport) {
    out.push(
      `${at} beyond viewport: ${b.el} (x ${b.x}, w ${b.width}) outside data-scroll="x"`
    )
  }
  for (const o of report.internalOverflow) {
    out.push(
      `${at} internal overflow (${o.overflowX}): ${o.el} scrollWidth ${o.scrollWidth} > clientWidth ${o.clientWidth}`
    )
  }
  for (const t of report.touch) {
    const need =
      t.rule === 'inline-line-box'
        ? `≥ ${INLINE_LINK_MIN_PX} tall (inline link)`
        : t.rule === 'dense-min'
          ? `≥ ${TOUCH_DENSE_PX}×${TOUCH_DENSE_PX}`
          : `≥ ${TOUCH_PRIMARY_PX} tall (no data-dense)`
    out.push(`${at} touch: ${t.el} is ${t.width}×${t.height}, needs ${need}`)
  }
  for (const u of report.unnamed) {
    out.push(`${at} unnamed control: ${u.el} (${u.width}×${u.height})`)
  }
  if (
    report.tier === 'phone' &&
    report.bottomNav &&
    report.bottomNav.scrollWidth > report.bottomNav.clientWidth
  ) {
    out.push(
      `${at} bottom nav scrolls: scrollWidth ${report.bottomNav.scrollWidth} > clientWidth ${report.bottomNav.clientWidth}`
    )
  }
  for (const c of report.axisTicks.clipped) {
    out.push(`${at} axis tick "${c.text}" clipped by ${c.overshoot}px`)
  }
  for (const c of report.clippedText) {
    out.push(
      `${at} clipped text: ${c.el} scrollWidth ${c.scrollWidth} > clientWidth ${c.clientWidth} without ellipsis`
    )
  }
  return out
}

/** A compact one-screen summary for logs and test annotations. */
export function probeSummary(report: ProbeReport): string {
  const v = probeViolations(report)
  return [
    `${report.route} @ ${report.viewport.width}×${report.viewport.height} (${report.tier})`,
    `  page ${report.page.scrollWidth}/${report.page.innerWidth}` +
      (report.bottomNav
        ? ` · bottom nav ${report.bottomNav.scrollWidth}/${report.bottomNav.clientWidth}`
        : ''),
    `  beyond ${report.beyondViewport.length} (${report.beyondViewportTotal} incl. descendants) · overflow ${report.internalOverflow.length} · touch ${report.touch.length}/${report.interactiveCount} · unnamed ${report.unnamed.length} · ticks ${report.axisTicks.clipped.length}/${report.axisTicks.total} · clipped text ${report.clippedText.length} · fixed/sticky ${report.fixedSticky.length}`,
    ...v.slice(0, 40).map((line) => `  - ${line}`),
    ...(v.length > 40 ? [`  … ${v.length - 40} more`] : []),
  ].join('\n')
}
