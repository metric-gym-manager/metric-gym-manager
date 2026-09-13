/**
 * VERIFY spike (a), mobile rebuild plan §31 / §5.3 / §14: can a fullscreen
 * overlay push its own history entry inside the App Router and close on
 * `popstate`, without fighting Next's history handling?
 *
 * The plan's `useHistoryBack(open, onClose)` (Phase 1) depends on four
 * things being true in the real router, none of which jsdom can tell us:
 *
 * 1. `history.pushState(state, '')` with **no URL** adds an entry that Next
 *    adopts as its own (it copies `__NA` and its tree into the state) and does
 *    *not* dispatch a navigation — the page stays put, nothing re-renders.
 * 2. Browser/hardware **back** from that entry fires `popstate` on the same
 *    URL, the document is **not** reloaded, and Next does not navigate
 *    anywhere — so an overlay can close itself and the list beneath survives.
 * 3. A **second** back then performs the ordinary client-side navigation to
 *    the previous route.
 * 4. Closing the overlay by its own button — `history.back()` from script to
 *    drop the entry it pushed — behaves identically to the hardware button.
 *
 * Also recorded, because the hook has to cope with them: what **forward**
 * does after an overlay was closed by back (the dead entry is re-entered on
 * the same URL and `popstate` fires with the overlay's own state), and what
 * pushing **with** the same URL does (Next then dispatches a same-URL
 * restore, which is a render the no-URL form avoids).
 *
 * Reading `node_modules/next/dist/client/components/app-router.js`
 * predicted all of this: the patched `pushState` skips
 * `applyUrlFromHistoryPushReplace` when `url` is empty, and `onPopState`
 * dispatches a traverse to `location.href`, which is unchanged. This spec
 * exists because "predicted from source" is not "observed" (CLAUDE.md,
 * Verification Directives). Runs on `phone-390`, where back is a hardware
 * button.
 */

import { test, expect } from '@playwright/test'
import { E2E_ACCESS_CONTROL_ENABLED } from '../helpers/access-control'
import { gotoSettled, openTierPage, type TierPage } from '../helpers/tier-page'

test.skip(
  !E2E_ACCESS_CONTROL_ENABLED,
  'requires E2E_ACCESS_CONTROL=1 + a seeded Enterprise gym'
)

declare global {
  interface Window {
    __spike?: {
      marker: number
      overlayOpen: boolean
      pops: Array<{ path: string; state: unknown }>
    }
  }
}

let tier: TierPage
const consoleErrors: string[] = []

test.beforeAll(async ({ browser }, testInfo) => {
  tier = await openTierPage(browser, testInfo)
  tier.page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  tier.page.on('pageerror', (err) => consoleErrors.push(err.message))
})

test.afterAll(async () => {
  await tier?.context.close()
})

/** Install the overlay simulation: a marker that dies on reload, a popstate log. */
async function arm(page: TierPage['page']): Promise<number> {
  return page.evaluate(() => {
    const marker = Math.random()
    window.__spike = { marker, overlayOpen: false, pops: [] }
    window.addEventListener('popstate', (e) => {
      window.__spike!.pops.push({ path: location.pathname, state: e.state })
      // What useHistoryBack will do: a popstate while open means "close".
      if (window.__spike!.overlayOpen) window.__spike!.overlayOpen = false
    })
    return marker
  })
}

const snapshot = (page: TierPage['page']) =>
  page.evaluate(() => ({
    path: location.pathname,
    search: location.search,
    marker: window.__spike?.marker ?? null,
    overlayOpen: window.__spike?.overlayOpen ?? null,
    pops: window.__spike?.pops.length ?? null,
    lastPopState: window.__spike?.pops.at(-1)?.state ?? null,
    historyState: history.state as Record<string, unknown> | null,
  }))

test('a pushed entry closes on hardware back without navigating or reloading', async () => {
  const { page } = tier

  // Build a real App Router history: /dashboard → /members by client nav.
  await gotoSettled(page, '/dashboard')
  await page
    .getByRole('navigation', { name: 'Workspace' })
    .getByRole('link', { name: 'Members', exact: true })
    .click()
  await page.waitForURL('**/members')
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()

  const marker = await arm(page)

  // (1) Open the "overlay": push an entry with no URL.
  await page.evaluate(() => {
    window.__spike!.overlayOpen = true
    history.pushState({ overlay: 'member' }, '')
  })
  let s = await snapshot(page)
  expect(s.path).toBe('/members')
  expect(s.overlayOpen).toBe(true)
  expect(s.marker).toBe(marker)
  // Next adopted the entry: its internals were copied onto our state.
  expect(s.historyState).toMatchObject({ overlay: 'member', __NA: true })
  expect(s.historyState?.__PRIVATE_NEXTJS_INTERNALS_TREE).toBeDefined()
  // …and nothing re-rendered away from the members screen.
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()

  // (2) Hardware back.
  await page.goBack()
  await expect
    .poll(async () => (await snapshot(page)).pops, { timeout: 5_000 })
    .toBe(1)
  s = await snapshot(page)
  expect(s.path, 'back must not navigate').toBe('/members')
  expect(s.marker, 'back must not reload the document').toBe(marker)
  expect(s.overlayOpen, 'the overlay closes').toBe(false)
  // The entry we land on is Next's own for /members.
  expect(s.historyState).toMatchObject({ __NA: true })
  expect(s.historyState?.overlay).toBeUndefined()
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()

  // (3) Back again is an ordinary client-side navigation.
  await page.goBack()
  await page.waitForURL('**/dashboard')
  s = await snapshot(page)
  expect(s.path).toBe('/dashboard')
  expect(s.marker, 'client-side navigation, not a reload').toBe(marker)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
})

test('closing from the overlay itself (history.back from script) behaves the same', async () => {
  const { page } = tier
  await gotoSettled(page, '/members')
  const marker = await arm(page)

  await page.evaluate(() => {
    window.__spike!.overlayOpen = true
    history.pushState({ overlay: 'member' }, '')
  })
  // (4) The user taps Close: the hook drops the entry it pushed.
  await page.evaluate(() => {
    window.__spike!.overlayOpen = false
    history.back()
  })
  await expect
    .poll(async () => (await snapshot(page)).pops, { timeout: 5_000 })
    .toBe(1)
  const s = await snapshot(page)
  expect(s.path).toBe('/members')
  expect(s.marker).toBe(marker)
  expect(s.overlayOpen).toBe(false)
  expect(s.historyState?.overlay).toBeUndefined()
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()
})

test('recorded: forward re-enters the dead entry, and a same-URL push is a same-URL restore', async ({}, testInfo) => {
  const { page } = tier
  await gotoSettled(page, '/members')
  const marker = await arm(page)

  await page.evaluate(() => {
    window.__spike!.overlayOpen = true
    history.pushState({ overlay: 'member' }, '')
  })
  await page.goBack()
  await expect
    .poll(async () => (await snapshot(page)).pops, { timeout: 5_000 })
    .toBe(1)

  // Forward: lands on the entry the overlay pushed, overlay still closed.
  await page.goForward()
  await expect
    .poll(async () => (await snapshot(page)).pops, { timeout: 5_000 })
    .toBe(2)
  const afterForward = await snapshot(page)
  expect(afterForward.path).toBe('/members')
  expect(afterForward.marker).toBe(marker)
  expect(afterForward.lastPopState).toMatchObject({ overlay: 'member' })
  expect(afterForward.overlayOpen).toBe(false)

  // Same-URL push: Next dispatches a restore to the same URL. Still no
  // navigation, no reload — but it is a router action the no-URL form avoids.
  await page.evaluate(() => {
    history.pushState({ overlay: 'member', withUrl: true }, '', location.href)
  })
  const afterUrlPush = await snapshot(page)
  expect(afterUrlPush.path).toBe('/members')
  expect(afterUrlPush.marker).toBe(marker)
  expect(afterUrlPush.historyState).toMatchObject({ withUrl: true, __NA: true })
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()

  testInfo.annotations.push({
    type: 'spike',
    description:
      'forward after back-close re-enters the overlay entry (popstate carries the overlay state; the hook must treat it as a no-op when closed); ' +
      'pushState with the same URL is adopted by Next and dispatches a same-URL restore — prefer the no-URL form.',
  })
})

test('no console errors across the sequences', async () => {
  // Risk r02 detection: "zero console errors in Playwright". Hydration
  // warnings and router errors would land here.
  expect(consoleErrors).toEqual([])
})
