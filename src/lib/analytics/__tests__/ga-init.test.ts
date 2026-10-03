import fs from 'node:fs'
import path from 'node:path'
import { GA_MEASUREMENT_ID, gaInitScript } from '../ga-init'

/**
 * SEO-059: GA4 sends the full page URL (`dl`) with every hit. Password-reset
 * and email-change links carry one-time tokens in the query string, and
 * `/join/{token}` carries a gym's self-registration credential in the path —
 * so before this, GA4 received each of them. A probe on 2026-10-02 saw an
 * unspent recovery token in a /g/collect request.
 *
 * The snippet runs at global scope, exactly as the browser runs an inline
 * script, so `function gtag` becomes `window.gtag` as it does in production.
 */

type GaWindow = Window & { dataLayer?: IArguments[] }
const w = window as GaWindow

function boot(url: string) {
  window.history.replaceState(null, '', url)
  ;(0, eval)(gaInitScript())
}

const commands = () => (w.dataLayer ?? []).map((entry) => Array.from(entry))
const gtagScripts = () =>
  Array.from(document.querySelectorAll('script')).filter((s) =>
    s.src.includes('googletagmanager.com/gtag/js')
  )

beforeEach(() => {
  delete w.dataLayer
  delete w.gtag
  gtagScripts().forEach((s) => s.remove())
})

afterAll(() => window.history.replaceState(null, '', '/'))

describe('gaInitScript', () => {
  describe('a URL carrying a credential is never measured', () => {
    it.each([
      [
        'an unspent password-recovery token',
        '/reset-password?token_hash=x&type=recovery',
      ],
      ['a recovery token under its legacy name', '/reset-password?token=x'],
      ['an email-change token', '/verify-email?type=email_change&token_hash=x'],
      ['a PKCE code', '/auth/callback?code=x'],
      ['an email address', '/verify-email?email=a%40b.lk'],
      ["a gym's self-registration token", '/join/tok_abc'],
    ])('%s (%s): no config, no Google script', (_name, url) => {
      boot(url)

      expect(commands().some(([command]) => command === 'config')).toBe(false)
      expect(gtagScripts()).toHaveLength(0)
      // trackEvent() still finds a gtag to call, so callers never need a guard.
      expect(typeof w.gtag).toBe('function')
      expect(() =>
        w.gtag?.('event', 'sign_up', { method: 'email' })
      ).not.toThrow()
    })
  })

  describe('every other URL is measured exactly as before', () => {
    it.each([
      '/',
      '/pricing',
      '/register',
      '/verify-email',
      '/login?redirect=%2Fmembers',
      '/joinery', // the prefix is `/join/`, not `/join`
    ])('%s: config once, one Google script', (url) => {
      boot(url)

      expect(commands().filter(([command]) => command === 'config')).toEqual([
        ['config', GA_MEASUREMENT_ID],
      ])
      expect(commands().some(([command]) => command === 'js')).toBe(true)
      expect(gtagScripts().map((s) => s.src)).toEqual([
        `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
      ])
    })
  })

  it('is the only way the root layout loads Google Analytics', () => {
    // A raw <Script src="…/gtag/js"> or gtag('config') added beside it would
    // load and configure GA on every URL again, credentials included.
    const layout = fs.readFileSync(
      path.resolve(__dirname, '../../../app/layout.tsx'),
      'utf8'
    )
    expect(layout).toContain('gaInitScript()')
    expect(layout).not.toMatch(/googletagmanager\.com/)
    expect(layout).not.toMatch(/gtag\(\s*['"]config['"]/)
  })
})
