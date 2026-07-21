import { getSafeRedirect } from './getSafeRedirect'

describe('getSafeRedirect', () => {
  describe('allows internal absolute paths', () => {
    it('returns the dashboard path unchanged', () => {
      expect(getSafeRedirect('/dashboard')).toBe('/dashboard')
    })

    it('returns a nested internal path unchanged', () => {
      expect(getSafeRedirect('/members')).toBe('/members')
      expect(getSafeRedirect('/settings/security')).toBe('/settings/security')
    })

    it('preserves query strings on internal paths', () => {
      expect(getSafeRedirect('/members?status=active')).toBe(
        '/members?status=active'
      )
    })
  })

  describe('falls back to the dashboard for unsafe or missing values', () => {
    it('rejects a null value (no redirect param present)', () => {
      expect(getSafeRedirect(null)).toBe('/dashboard')
    })

    it('rejects an empty string', () => {
      expect(getSafeRedirect('')).toBe('/dashboard')
    })

    it('rejects absolute external URLs', () => {
      expect(getSafeRedirect('https://evil.com')).toBe('/dashboard')
      expect(getSafeRedirect('http://evil.com/phish')).toBe('/dashboard')
    })

    it('rejects protocol-relative URLs that resolve off-site', () => {
      expect(getSafeRedirect('//evil.com')).toBe('/dashboard')
      expect(getSafeRedirect('//evil.com/dashboard')).toBe('/dashboard')
    })

    it('rejects relative paths that are not rooted at "/"', () => {
      expect(getSafeRedirect('dashboard')).toBe('/dashboard')
      expect(getSafeRedirect('members/1')).toBe('/dashboard')
    })
  })
})
