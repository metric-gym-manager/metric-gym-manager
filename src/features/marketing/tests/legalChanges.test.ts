/**
 * @jest-environment node
 */
import { LEGAL_CHANGES } from '../config/legalChanges'
import { MARKETING_PAGES } from '../config/pages'

/**
 * Every change to a legal page is announced by email to the gyms, or recorded
 * as not worth announcing — never forgotten. `lastModified` in the page
 * registry is the date a page's CONTENT last changed, so a legal page whose
 * date moved without an entry here fails this suite: the person editing the
 * policy has to decide, in the same commit, whether gyms are told.
 */
const LEGAL_PAGES = MARKETING_PAGES.filter((page) => page.kind === 'legal')

describe('LEGAL_CHANGES', () => {
  it('covers every legal page', () => {
    expect(LEGAL_PAGES.length).toBeGreaterThan(0)
  })

  it.each(LEGAL_PAGES.map((page) => [page.path, page.lastModified]))(
    'records the current version of %s (%s)',
    (path, lastModified) => {
      expect(
        LEGAL_CHANGES.some(
          (change) => change.path === path && change.date === lastModified
        )
      ).toBe(true)
    }
  )

  it('names only legal pages', () => {
    const legal = new Set(LEGAL_PAGES.map((page) => page.path))
    for (const change of LEGAL_CHANGES) {
      expect(legal.has(change.path)).toBe(true)
    }
  })

  it('never records a page twice for one date', () => {
    const keys = LEGAL_CHANGES.map((c) => `${c.path}@${c.date}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('dates each change as a calendar day', () => {
    for (const change of LEGAL_CHANGES) {
      expect(change.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('never dates a change after the page itself', () => {
    for (const change of LEGAL_CHANGES) {
      const page = LEGAL_PAGES.find((p) => p.path === change.path)
      expect(change.date <= (page?.lastModified ?? '')).toBe(true)
    }
  })

  it('gives every announced change a short summary of finished sentences', () => {
    for (const change of LEGAL_CHANGES.filter((c) => c.notify)) {
      expect(change.summary.length).toBeGreaterThanOrEqual(1)
      expect(change.summary.length).toBeLessThanOrEqual(5)
      for (const line of change.summary) {
        expect(line).toMatch(/^[A-Z].*[.]$/)
      }
    }
  })
})
