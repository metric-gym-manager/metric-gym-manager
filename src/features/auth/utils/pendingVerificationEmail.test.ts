import {
  PENDING_VERIFICATION_EMAIL_KEY,
  readPendingVerificationEmail,
  rememberPendingVerificationEmail,
} from './pendingVerificationEmail'

describe('pendingVerificationEmail', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('keeps the address for this tab only — sessionStorage, never localStorage', () => {
    expect(rememberPendingVerificationEmail('owner+gym@example.lk')).toBe(true)

    expect(readPendingVerificationEmail()).toBe('owner+gym@example.lk')
    expect(sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBe(
      'owner+gym@example.lk'
    )
    expect(localStorage.length).toBe(0)
  })

  it('offers nothing when no address was remembered', () => {
    expect(readPendingVerificationEmail()).toBe('')
  })

  describe('when the browser refuses storage', () => {
    // Safari private mode and blocked site data throw on access; sign-up must
    // still complete, and the verify page must still render.
    let spy: jest.SpyInstance

    beforeEach(() => {
      spy = jest
        .spyOn(window, 'sessionStorage', 'get')
        .mockImplementation(() => {
          throw new DOMException('denied', 'SecurityError')
        })
    })

    afterEach(() => spy.mockRestore())

    it('reports the write as refused instead of throwing', () => {
      expect(rememberPendingVerificationEmail('owner@gym.lk')).toBe(false)
    })

    it('reads as empty instead of throwing', () => {
      expect(readPendingVerificationEmail()).toBe('')
    })
  })
})
